/**
 * WorkSession Service (F4.3) — layar lapangan teknisi (K8).
 * Alur: buka sesi per pelanggan → tambah WorkItem per unit (harga auto resolvePrice + SNAPSHOT) →
 * tutup sesi → auto-generate Invoice (Cash) / Proforma (Tempo) sesuai customer.topType.
 * SECURITY: tenant-scoped. Teknisi tak input biaya (harga dari katalog/harga khusus).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError, resolveBillingCustomer } from "@/lib/services/customer-service";
import { resolvePrice } from "@/lib/services/service-catalog-service";
import {
  computeInvoiceTotals, computeDueDate, nextInvoiceNumber,
  type InvoiceLineInput, type TopType,
} from "@/lib/services/invoice-service";
import { collectChecklistGaps, type ChecklistItemDef } from "@/lib/domain/checklist-validation";
import { computeNextServiceDate, REPEAT_DEFAULTS } from "@/lib/domain/money-loop";
import { isOwnedPhotoUrl } from "@/lib/storage/s3";

/** Buka (atau ambil) sesi kerja OPEN untuk pelanggan. Idempoten: 1 sesi OPEN per pelanggan. */
export async function openWorkSession(
  tenantId: string, customerId: string, openedById: string, jobId?: string,
): Promise<string> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
  if (!customer) throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");

  // Keamanan FASE 6: jobId dari klien wajib diverifikasi — harus milik tenant ini DAN
  // untuk customer yang sama. Tanpa ini, sesi pelanggan A bisa tertaut ke pekerjaan pelanggan B.
  if (jobId) {
    const job = await prisma.jobOrder.findFirst({
      where: { id: jobId, tenantId },
      select: { id: true, customerId: true },
    });
    if (!job || job.customerId !== customerId) {
      throw new ServiceError("NOT_FOUND", "Pekerjaan tidak ditemukan atau bukan milik pelanggan ini");
    }
  }

  const existing = await prisma.workSession.findFirst({
    where: { tenantId, customerId, status: "OPEN" }, select: { id: true, jobId: true },
  });
  if (existing) {
    // B1 fix: bila sesi OPEN lama belum tertaut job & sekarang dibuka dari sebuah job, taut-kan.
    if (jobId && !existing.jobId) {
      await prisma.workSession.update({ where: { id: existing.id }, data: { jobId } });
    }
    return existing.id;
  }
  const ws = await prisma.workSession.create({
    data: { tenantId, customerId, openedById, jobId: jobId ?? null, status: "OPEN" },
    select: { id: true },
  });
  return ws.id;
}

/** Tambah satu baris pekerjaan ke sesi. Harga = resolvePrice (khusus?standar) lalu di-SNAPSHOT (K8). */
export async function addWorkItem(
  tenantId: string,
  workSessionId: string,
  input: {
    assetId?: string; serviceId: string; qty: number;
    techIds?: string[]; kernetIds?: string[];
  },
): Promise<void> {
  const ws = await prisma.workSession.findFirst({
    where: { id: workSessionId, tenantId, status: "OPEN" },
    select: { id: true, customerId: true },
  });
  if (!ws) throw new ServiceError("NOT_FOUND", "Sesi kerja tidak aktif");
  const svc = await prisma.serviceCatalog.findFirst({
    where: { id: input.serviceId, tenantId },
    select: { id: true, name: true, unit: true, category: true },
  });
  if (!svc) throw new ServiceError("NOT_FOUND", "Layanan tidak ditemukan");

  const unitPrice = await resolvePrice(tenantId, ws.customerId, input.serviceId); // snapshot
  const qty = input.qty > 0 ? input.qty : 1;
  const lineTotal = Math.round(qty * unitPrice);

  await prisma.workItem.create({
    data: {
      tenantId, workSessionId,
      assetId: input.assetId ?? null,
      serviceId: svc.id,
      descSnapshot: svc.name,
      category: svc.category,
      qty: new Prisma.Decimal(qty),
      unit: svc.unit,
      unitPriceSnapshot: new Prisma.Decimal(unitPrice),
      lineTotal: new Prisma.Decimal(lineTotal),
      techIds: input.techIds ?? [],
      kernetIds: input.kernetIds ?? [],
    },
  });
}

/** Hapus baris (hanya sesi OPEN). */
export async function removeWorkItem(tenantId: string, workSessionId: string, itemId: string): Promise<void> {
  const ws = await prisma.workSession.findFirst({ where: { id: workSessionId, tenantId, status: "OPEN" }, select: { id: true } });
  if (!ws) throw new ServiceError("NOT_FOUND", "Sesi kerja tidak aktif");
  await prisma.workItem.deleteMany({ where: { id: itemId, workSessionId, tenantId } });
}

/** Detail sesi (item + info pelanggan). */
export async function getWorkSession(tenantId: string, workSessionId: string) {
  const ws = await prisma.workSession.findFirst({
    where: { id: workSessionId, tenantId },
    include: {
      customer: { select: { id: true, name: true, topType: true, customerType: true } },
      items: { include: { asset: { select: { brand: true, roomLocation: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!ws) throw new ServiceError("NOT_FOUND", "Sesi kerja tidak ditemukan");
  return ws;
}

/**
 * GATE checklist (SATU titik penegakan): sebelum menutup sesi & terbit nota, pastikan
 * tiap WorkItem yang layanannya punya checklist per-layanan dgn item WAJIB sudah dilengkapi.
 * OPT-IN: layanan tanpa template / tanpa item wajib = tidak mengunci.
 * @throws ServiceError('GUARD_FAILED') dgn daftar unit+item yang belum lengkap.
 */
export async function assertWorkSessionChecklist(tenantId: string, workSessionId: string): Promise<void> {
  // Konteks kepemilikan foto: item `photo` harus URL milik tenant+pekerjaan sesi ini.
  const wsCtx = await prisma.workSession.findFirst({
    where: { id: workSessionId, tenantId },
    select: { jobId: true },
  });
  const ownerJobId = wsCtx?.jobId ?? null;

  const items = await prisma.workItem.findMany({
    where: { tenantId, workSessionId, serviceId: { not: null } },
    select: { id: true, serviceId: true, descSnapshot: true },
  });
  if (items.length === 0) return;

  const serviceIds = [...new Set(items.map((w) => w.serviceId as string))];
  const templates = await prisma.checklistTemplate.findMany({
    where: { tenantId, serviceId: { in: serviceIds } },
    select: { serviceId: true, items: true },
  });
  if (templates.length === 0) return;
  const tplByService = new Map(
    templates.map((t) => [t.serviceId as string, (t.items as unknown as ChecklistItemDef[]) ?? []]),
  );

  // Ambil hasil SEMUA item sekali (bukan N+1) lalu serahkan ke validator SATU-satunya (domain).
  const allResults = await prisma.checklistResult.findMany({
    where: { tenantId, workItemId: { in: items.map((w) => w.id) } },
    select: { workItemId: true, itemKey: true, checked: true, value: true },
  });
  const resultsByWorkItem = new Map<string, Record<string, { checked: boolean; value: string | null }>>();
  for (const r of allResults) {
    const m = resultsByWorkItem.get(r.workItemId as string) ?? {};
    m[r.itemKey] = { checked: r.checked, value: r.value };
    resultsByWorkItem.set(r.workItemId as string, m);
  }

  const missing: string[] = [];
  for (const wi of items) {
    const tpl = tplByService.get(wi.serviceId as string);
    if (!tpl || tpl.length === 0) continue;
    const gaps = collectChecklistGaps({
      label: wi.descSnapshot,
      items: tpl,
      results: resultsByWorkItem.get(wi.id) ?? {},
      // Foto hanya sah bila URL milik tenant+pekerjaan sesi ini. Tanpa jobId → selalu gagal
      // (satu-satunya jalur upload menuntut pekerjaan), jadi tak ada "lolos palsu".
      photoOwned: ownerJobId
        ? (url: string) => isOwnedPhotoUrl(tenantId, ownerJobId, url)
        : () => false,
    });
    for (const g of gaps) missing.push(`${wi.descSnapshot}: ${g.label}`);
  }
  if (missing.length > 0) {
    throw new ServiceError(
      "CONFLICT",
      `Checklist wajib belum lengkap untuk: ${missing.join("; ")}. Lengkapi dulu sebelum membuat tagihan.`,
    );
  }
}

/**
 * Tutup sesi → GENERATE dokumen otomatis (K8):
 *  - customer.topType === CASH  → Invoice (docType INVOICE, status ISSUED)
 *  - selain itu (tempo)         → Proforma (docType PROFORMA, status ISSUED) + dueDate dari TOP (K19)
 * Pajak: PPN hanya bila tenant PKP (K4). Nama personel TIDAK masuk invoice (K18).
 * @returns { invoiceId, docType, number }
 */
export async function closeWorkSession(
  tenantId: string, workSessionId: string, createdById: string,
): Promise<{ invoiceId: string; docType: "INVOICE" | "PROFORMA"; number: string }> {
  const ws = await prisma.workSession.findFirst({
    where: { id: workSessionId, tenantId, status: "OPEN" },
    include: { items: true, customer: { select: { id: true, topType: true, billingCustomerId: true } } },
  });
  if (!ws) throw new ServiceError("NOT_FOUND", "Sesi kerja tidak aktif");
  if (ws.items.length === 0) throw new ServiceError("CONFLICT", "Sesi kosong — tambah pekerjaan dulu");

  // GATE checklist (satu titik penegakan) — tolak terbit nota bila item wajib per-unit belum lengkap.
  await assertWorkSessionChecklist(tenantId, workSessionId);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { isPkp: true, taxPercent: true },
  });

  // BILL-TO (kantor pusat): bila customer punya billingCustomerId, tagihan mengacu ke entitas itu.
  // docType & jatuh tempo mengikuti TOP entitas PENAGIHAN (keputusan owner). customerId invoice tetap
  // customer LOKASI (outlet) agar jejak "servis di mana" utuh; billingCustomerId invoice = bill-to (null=self).
  const billTo = await resolveBillingCustomer(tenantId, ws.customer.id);
  const isCentralBilling = billTo.id !== ws.customer.id;
  // TOP/jatuh tempo: bila tagih ke kantor pusat → ikut TOP pusat; bila diri sendiri → TOP customer sesi.
  const top = (isCentralBilling ? billTo.topType : ws.customer.topType) as TopType ?? "CASH";
  const docType: "INVOICE" | "PROFORMA" = top === "CASH" ? "INVOICE" : "PROFORMA";

  const lines: InvoiceLineInput[] = ws.items.map((it) => ({
    category: it.category, qty: Number(it.qty), unitPrice: Number(it.unitPriceSnapshot),
  }));
  const totals = computeInvoiceTotals({
    items: lines,
    tenantIsPkp: tenant?.isPkp ?? false,
    taxPercent: tenant?.taxPercent ?? 0,
  });
  const issueDate = new Date();
  const dueDate = computeDueDate(issueDate, top);
  const number = await nextInvoiceNumber(tenantId, docType, issueDate.getFullYear());

  const result = await prisma.$transaction(async (tx) => {
    // B3 fix: klaim sesi secara atomik (OPEN→CLOSED) di dalam transaksi.
    // Bila 0 baris terpengaruh, sesi sudah ditutup proses lain → batalkan (cegah dobel invoice).
    const claimed = await tx.workSession.updateMany({
      where: { id: ws.id, tenantId, status: "OPEN" },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new ServiceError("CONFLICT", "Sesi sudah ditutup. Muat ulang halaman.");
    }

    if (ws.jobId) {
      const job = await tx.jobOrder.findUnique({ where: { id: ws.jobId } });
      if (!job || job.tenantId !== tenantId || job.customerId !== ws.customer.id) {
        throw new ServiceError("CONFLICT", "Pekerjaan pada sesi tidak cocok dengan pelanggan.");
      }
      if (job.status !== "IN_PROGRESS" && job.status !== "WAITING" && job.status !== "ARRIVED") {
        throw new ServiceError("CONFLICT", `Pekerjaan tidak dapat diselesaikan dari status ${job.status}.`);
      }
      // FASE 4: satukan COMPLETED + next-service + reminder/review/event dengan invoice dan close sesi.
      // Efek & batas interval mengikuti `transitionJob(COMPLETED)` yang sebelumnya hidup terpisah.
      const completedAt = new Date();
      const primaryAsset = job.assetId
        ? await tx.asset.findUnique({ where: { id: job.assetId } })
        : null;
      const tenantSchedule = await tx.tenant.findUnique({ where: { id: tenantId } });
      const nextServiceDate = computeNextServiceDate(
        completedAt,
        primaryAsset?.maintenanceIntervalDays,
        tenantSchedule?.maintenanceIntervalDays,
      );
      await tx.jobOrder.update({
        where: { id: job.id },
        data: { status: "COMPLETED", completedAt, nextServiceDate },
      });

      const leadDays = tenantSchedule?.reminderLeadDays ?? REPEAT_DEFAULTS.reminderLeadDays;
      const servicedAssetIds = new Set<string>();
      if (job.assetId) servicedAssetIds.add(job.assetId);
      const sessions = await tx.workSession.findMany({
        where: { tenantId, jobId: job.id },
        select: { items: { select: { assetId: true } } },
      });
      for (const session of sessions) {
        for (const item of session.items) if (item.assetId) servicedAssetIds.add(item.assetId);
      }
      const extraAssetIds = [...servicedAssetIds].filter((id) => id !== job.assetId);
      const extraAssets = extraAssetIds.length
        ? await tx.asset.findMany({
            where: { id: { in: extraAssetIds }, tenantId },
            select: { id: true, maintenanceIntervalDays: true },
          })
        : [];
      if (primaryAsset) {
        await tx.asset.update({ where: { id: primaryAsset.id }, data: { nextServiceDate } });
        await tx.repeatReminder.upsert({
          where: { tenantId_assetId_dueDate: { tenantId, assetId: primaryAsset.id, dueDate: nextServiceDate } },
          create: { tenantId, assetId: primaryAsset.id, dueDate: nextServiceDate, leadTimeDays: leadDays, status: "QUEUED" },
          update: {},
        });
      }
      for (const asset of extraAssets) {
        const due = computeNextServiceDate(completedAt, asset.maintenanceIntervalDays, tenantSchedule?.maintenanceIntervalDays);
        await tx.asset.update({ where: { id: asset.id }, data: { nextServiceDate: due } });
        await tx.repeatReminder.upsert({
          where: { tenantId_assetId_dueDate: { tenantId, assetId: asset.id, dueDate: due } },
          create: { tenantId, assetId: asset.id, dueDate: due, leadTimeDays: leadDays, status: "QUEUED" },
          update: {},
        });
      }
      await tx.reviewRequest.create({
        data: { tenantId, jobId: job.id, channel: "WA", status: "REQUESTED" },
      });
      await tx.jobProgressEvent.create({
        data: {
          tenantId, jobId: job.id, fromStatus: job.status, toStatus: "COMPLETED",
          actorId: createdById, clientEventId: null, meta: { source: "WORK_SESSION_CLOSE" },
        },
      });
    }

    const inv = await tx.invoice.create({
      data: {
        tenantId, docType, number, customerId: ws.customer.id,
        billingCustomerId: isCentralBilling ? billTo.id : null,
        workSessionId: ws.id, jobId: ws.jobId ?? null,
        status: "ISSUED", issueDate, dueDate,
        subtotal: new Prisma.Decimal(totals.subtotal),
        discountAmount: new Prisma.Decimal(totals.discountAmount),
        taxableService: new Prisma.Decimal(totals.taxableService),
        taxableGoods: new Prisma.Decimal(totals.taxableGoods),
        ppnPercent: totals.ppnPercent,
        ppnAmount: new Prisma.Decimal(totals.ppnAmount),
        total: new Prisma.Decimal(totals.total),
        cashRemitStatus: docType === "INVOICE" ? "HELD_BY_TECH" : null,
        createdById,
        items: {
          create: ws.items.map((it) => ({
            assetId: it.assetId,
            descSnapshot: it.descSnapshot,
            category: it.category,
            qty: it.qty,
            unit: it.unit,
            unitPrice: it.unitPriceSnapshot,
            lineTotal: it.lineTotal,
          })),
        },
      },
      select: { id: true },
    });
    return inv.id;
  });

  return { invoiceId: result, docType, number };
}

/**
 * Ringkasan biaya resmi per pekerjaan, dibaca dari WorkSession/WorkItem dan Invoice.
 *
 * TIDAK membaca JobOrder.price. Jalurnya sama dengan alur teknisi:
 * CustomerPricing/ServiceCatalog → resolvePrice → WorkItem.unitPriceSnapshot →
 * closeWorkSession → Invoice (INVOICE cash / PROFORMA tempo sesuai TOP).
 *
 * Belum ada sesi: null (bukan Rp0, sebab biaya belum dicatat).
 * Sesi OPEN: subtotal sementara dari snapshot item.
 * Invoice terbit: tampilkan subtotal/diskon/PPN/total persis dari invoice final.
 */
export async function getJobCost(tenantId: string, jobId: string) {
  const sessions = await prisma.workSession.findMany({
    where: { tenantId, jobId },
    select: {
      id: true,
      status: true,
      items: { select: { qty: true, unitPriceSnapshot: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  if (sessions.length === 0) return null;

  const wsIds = sessions.map((s) => s.id);
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, workSessionId: { in: wsIds } },
    select: {
      id: true,
      workSessionId: true,
      docType: true,
      status: true,
      subtotal: true,
      discountAmount: true,
      ppnAmount: true,
      total: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Satu sesi OPEN per pelanggan (enforced oleh openWorkSession); sesi CLOSED dapat
  // lebih dari satu bila pekerjaan dicicil/dipecah — jumlahkan snapshot sesi tanpa
  // invoice untuk subtotal aktivitas; invoice final terbaru tetap ditampilkan.
  const latestInvoice = invoices[0] ?? null;
  const subtotal = sessions.reduce((sum, ws) => {
    const sessionSubtotal = ws.items.reduce((s, item) => {
      return s + Math.round(Number(item.qty) * Number(item.unitPriceSnapshot));
    }, 0);
    return sum + sessionSubtotal;
  }, 0);

  return {
    subtotal,
    invoice: latestInvoice
      ? {
          id: latestInvoice.id,
          docType: latestInvoice.docType,
          status: latestInvoice.status,
          subtotal: Number(latestInvoice.subtotal),
          discountAmount: Number(latestInvoice.discountAmount),
          ppnAmount: Number(latestInvoice.ppnAmount),
          total: Number(latestInvoice.total),
        }
      : null,
    sessions: sessions.map((ws) => ({ id: ws.id, status: ws.status })),
  };
}

