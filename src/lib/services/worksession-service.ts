/**
 * WorkSession Service (F4.3) — layar lapangan teknisi (K8).
 * Alur: buka sesi per pelanggan → tambah WorkItem per unit (harga auto resolvePrice + SNAPSHOT) →
 * tutup sesi → auto-generate Invoice (Cash) / Proforma (Tempo) sesuai customer.topType.
 * SECURITY: tenant-scoped. Teknisi tak input biaya (harga dari katalog/harga khusus).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";
import { resolvePrice } from "@/lib/services/service-catalog-service";
import {
  computeInvoiceTotals, computeDueDate, nextInvoiceNumber,
  type InvoiceLineInput, type TopType,
} from "@/lib/services/invoice-service";

/** Buka (atau ambil) sesi kerja OPEN untuk pelanggan. Idempoten: 1 sesi OPEN per pelanggan. */
export async function openWorkSession(
  tenantId: string, customerId: string, openedById: string, jobId?: string,
): Promise<string> {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, tenantId }, select: { id: true } });
  if (!customer) throw new ServiceError("NOT_FOUND", "Pelanggan tidak ditemukan");
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
    include: { items: true, customer: { select: { id: true, topType: true } } },
  });
  if (!ws) throw new ServiceError("NOT_FOUND", "Sesi kerja tidak aktif");
  if (ws.items.length === 0) throw new ServiceError("CONFLICT", "Sesi kosong — tambah pekerjaan dulu");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }, select: { isPkp: true, taxPercent: true },
  });
  const top = (ws.customer.topType ?? "CASH") as TopType;
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
    const inv = await tx.invoice.create({
      data: {
        tenantId, docType, number, customerId: ws.customer.id,
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
