/**
 * Reminder Service — sisi output money loop.
 * List reminder due, kirim WA (antre ke wa-worker), buat repeat job.
 */
import { prisma } from "@/lib/prisma";
import { renderTemplate, normalizePhone } from "@/lib/wa/gateway";
import { getOrCreateCardToken } from "@/lib/services/customer-card-service";
import { customerCardUrl } from "@/lib/unit-code/urls";
import { ServiceError } from "@/lib/services/customer-service";

/** Reminder yang sudah waktunya ditindak (lead time terlewati, status QUEUED). */
export async function listDueReminders(tenantId: string) {
  const today = new Date();
  const reminders = await prisma.repeatReminder.findMany({
    where: { tenantId, status: "QUEUED" },
    orderBy: { dueDate: "asc" },
  });
  // filter due berdasarkan leadTime
  const due = reminders.filter((r) => {
    const trigger = new Date(r.dueDate);
    trigger.setDate(trigger.getDate() - r.leadTimeDays);
    return trigger.getTime() <= today.getTime();
  });
  // enrich dengan asset + customer
  const enriched = await Promise.all(
    due.map(async (r) => {
      const asset = await prisma.asset.findUnique({
        where: { id: r.assetId },
        include: { customer: true },
      });
      return { reminder: r, asset };
    }),
  );
  return enriched;
}

/**
 * Kirim reminder WA per PELANGGAN (batch): 1 pesan untuk SEMUA unit yang due milik pelanggan itu.
 * Cegah banjir notifikasi bagi institusi ber-AC banyak. Semua reminder di grup ditandai SENT,
 * merujuk ke SATU MessageLog.
 *
 * items: daftar { reminder, asset } milik SATU pelanggan (sudah difilter due).
 */
export async function sendCustomerReminderWa(
  tenantId: string,
  customerId: string,
  reminderIds: string[],
) {
  // Ambil ulang reminder (guard tenant + status QUEUED, cegah dobel-kirim balapan).
  const reminders = await prisma.repeatReminder.findMany({
    where: { id: { in: reminderIds }, tenantId, status: "QUEUED" },
  });
  if (reminders.length === 0) return null;

  const assets = await prisma.asset.findMany({
    where: { id: { in: reminders.map((r) => r.assetId) }, tenantId },
    include: { customer: true },
  });
  const customer = assets[0]?.customer;
  if (!customer) throw new Error("Customer tidak ditemukan");

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const labelOf = (aId: string) => {
    const a = assets.find((x) => x.id === aId);
    if (!a) return "AC";
    return `${a.brand ?? ""} ${a.roomLocation ?? ""}`.trim() || "AC";
  };

  let body: string;
  if (reminders.length === 1) {
    const template = await prisma.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key: "reminder" } },
    });
    body = renderTemplate(template?.body ?? "Halo {{customer}}, saatnya servis AC {{unit}}. Balas untuk jadwalkan. — {{usaha}}", {
      customer: customer.name,
      unit: labelOf(reminders[0].assetId),
      usaha: tenant?.name ?? "",
    });
  } else {
    // Versi banyak-unit: 1 pesan berisi daftar. Template key terpisah + fallback default.
    const template = await prisma.messageTemplate.findUnique({
      where: { tenantId_key: { tenantId, key: "reminder_multi" } },
    });
    const daftar = reminders.map((r) => `• ${labelOf(r.assetId)}`).join("\n");
    body = renderTemplate(
      template?.body ??
        "Halo {{customer}}, {{jumlah}} unit AC Anda sudah waktunya servis/cuci:\n{{daftar}}\n\nBalas pesan ini untuk jadwalkan. — {{usaha}}",
      {
        customer: customer.name,
        jumlah: String(reminders.length),
        daftar,
        usaha: tenant?.name ?? "",
      },
    );
  }

  const toPhone = normalizePhone(customer.phone);

  // Sisipkan link kartu perawatan (statis-permanen) di kaki pesan — distribusi otomatis.
  // Tak menambah pesan baru (hanya baris), jadi tak menambah risiko anti-ban.
  try {
    const token = await getOrCreateCardToken(tenantId, customerId);
    if (token) body = `${body}\n\nLihat kartu perawatan AC Anda: ${customerCardUrl(token)}`;
  } catch { /* footer opsional; jangan gagalkan reminder */ }

  // SATU MessageLog + tandai SEMUA reminder di grup SENT (atomik).
  const [msg] = await prisma.$transaction([
    prisma.messageLog.create({
      data: {
        tenantId, customerId, channel: "WA", driver: tenant?.waDriver ?? "WEB",
        templateKey: reminders.length > 1 ? "reminder_multi" : "reminder",
        direction: "OUTBOUND", status: "QUEUED", toPhone, body,
      },
    }),
    prisma.repeatReminder.updateMany({
      where: { id: { in: reminders.map((r) => r.id) }, tenantId, status: "QUEUED" },
      data: { status: "SENT", sentAt: new Date() },
    }),
  ]);

  return { messageLogId: msg.id, toPhone, body, count: reminders.length };
}

/** Kirim reminder WA (SATU unit) — dipakai tombol manual per-reminder di dashboard/demo. */
export async function sendReminderWa(tenantId: string, reminderId: string) {
  const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder) throw new Error("Reminder tidak ditemukan");
  const asset = await prisma.asset.findUnique({ where: { id: reminder.assetId }, select: { customerId: true } });
  if (!asset) throw new Error("Asset tidak ditemukan");
  return sendCustomerReminderWa(tenantId, asset.customerId, [reminderId]);
}

/** Buat repeat job dari reminder (prefill dari job sebelumnya di asset yang sama). */
export async function createRepeatJob(tenantId: string, reminderId: string, createdById: string) {
  const reminder = await prisma.repeatReminder.findFirst({ where: { id: reminderId, tenantId } });
  if (!reminder) throw new Error("Reminder tidak ditemukan");

  const asset = await prisma.asset.findUnique({ where: { id: reminder.assetId } });
  if (!asset) throw new Error("Asset tidak ditemukan");

  // Ambil job terakhir di asset ini sebagai template prefill
  const lastJob = await prisma.jobOrder.findFirst({
    where: { tenantId, assetId: asset.id, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });

  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.jobOrder.create({
      data: {
        tenantId, customerId: asset.customerId, assetId: asset.id,
        serviceType: lastJob?.serviceType ?? "CLEANING",
        status: "DRAFT", source: "REPEAT",
        price: lastJob?.price ?? null,
        parentJobId: lastJob?.id ?? null,
        createdById,
      },
    });
    await tx.repeatReminder.update({
      where: { id: reminder.id },
      data: { status: "CONVERTED", jobId: created.id },
    });
    return created;
  });

  return job;
}

/**
 * RUNNER money loop (dipanggil cron harian): untuk SEMUA tenant aktif,
 * kirim WA reminder untuk RepeatReminder yang due. Dikelompokkan PER PELANGGAN:
 * 1 pelanggan dengan banyak unit due di hari sama -> 1 pesan WA (cegah banjir notifikasi).
 * Idempoten: hanya proses QUEUED. Aman-gagal per grup.
 */
export async function runDueRemindersAllTenants(): Promise<{ tenants: number; sent: number; failed: number }> {
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["TRIAL", "ACTIVE", "PAST_DUE"] } },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  for (const t of tenants) {
    const due = await listDueReminders(t.id);
    // Kelompokkan per pelanggan.
    const byCustomer = new Map<string, string[]>();
    for (const item of due) {
      const cId = item.asset?.customer?.id;
      if (!cId) continue;
      const arr = byCustomer.get(cId) ?? [];
      arr.push(item.reminder.id);
      byCustomer.set(cId, arr);
    }
    // Kirim 1 pesan per pelanggan (berisi semua unit due-nya).
    for (const [customerId, reminderIds] of byCustomer) {
      try {
        await sendCustomerReminderWa(t.id, customerId, reminderIds);
        sent += 1; // hitung per PESAN terkirim (bukan per unit)
      } catch (err) {
        failed += 1;
        console.error(`[reminder-runner] gagal tenant=${t.id} customer=${customerId}:`, err);
      }
    }
  }
  return { tenants: tenants.length, sent, failed };
}


/**
 * INBOX PENGINGAT (FASE 1 modul Pengingat Perawatan AC).
 * SATU-SATUNYA sumber data untuk metrik Ringkasan dan halaman /app/pengingat
 * (risiko R10: dua query terpisah = angka beda).
 *
 * Aturan jatuh tempo (dikunci tes tests/reminder-inbox.test.ts):
 *   unit masuk daftar jika nextServiceDate - Tenant.reminderLeadDays <= sekarang
 * (perintah user: sesuai konfigurasi tenant, misalnya 3 hari sebelum hari H).
 *
 * Status kirim dikorelasi RepeatReminder -> MessageLog (keputusan FASE 0.2):
 * MessageLog dibuat dan RepeatReminder=SENT dalam SATU transaksi
 * (lihat sendCustomerReminderWa) jadi join tenantId+customerId+templateKey
 * dengan rentang waktu sentAt +-5 detik adalah relasi yang DIJAMIN KODE.
 * gagal mencocokkan = TIDAK_DIKETAHUI (jangan menebak).
 */
export type ReminderInboxSendStatus =
  | "BELUM_DIKIRIM" // unit due tapi belum punya RepeatReminder
  | "MENUNGGU_KRIM" // RepeatReminder QUEUED (antre menunggu cron)
  | "Terkirim" // gateway mengonfirmasi terkirim
  | "DITERIMA" // gateway mengonfirmasi delivered
  | "DIBACA" // status dibaca / tidak dapat dipastikan platform
  | "GAGAL"
  | "TIDAK_DIKETAHUI" // reminder SENT tak bisa dikorelasikan ke MessageLog
  | "DITUTUP"; // DISMISSED / CONVERTED / EXPIRED

export type ReminderInboxRow = {
  assetId: string;
  brand: string | null;
  model: string | null;
  capacityPk: number | null;
  roomLocation: string | null;
  nextServiceDate: Date | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  reminderId: string | null;
  reminderStatus: string | null;
  sendStatus: "BELUM_DIKIRIM" | "MENUNGGU_KRIM" | "Terkirim" | "DITERIMA" | "DIBACA" | "GAGAL" | "TIDAK_DIKETAHUI" | "DITUTUP";
  messageLogId: string | null;
  sentAt: Date | null;
  overdueDays: number;
  waLink: string;
};

/** Wa-link manual (pola yang sudah dipakai di 8 tempat lain). */
function waLinkTo(phone: string, text?: string): string {
  const n = normalizePhone(phone);
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${n}${q}`;
}

/** Map MessageStatus -> label inbox (guard naik-monoton di callback sudah ada). */
function mapMessageStatus(s: string): ReminderInboxRow["sendStatus"] {
  if (s === "READ_CONFIRMED" || s === "READ_UNOBSERVED") return "DIBACA";
  if (s === "DELIVERED") return "DITERIMA";
  if (s === "SENT") return "Terkirim";
  if (s === "FAILED") return "GAGAL";
  return "MENUNGGU_KRIM"; // QUEUED / SENDING / LOGGED
}

export const CLOSED_REMINDER_STATUSES = ["DISMISSED", "CONVERTED", "EXPIRED"] as const;

/**
 * includeClosed=true -> tampilkan juga pengingat yang sudah DITUTUP (riwayat/filter).
 * Default false -> keluar dari daftar (prinsip user 2026-10-03: "tidak selamanya ada di list").
 */
export async function listReminderInbox(
  tenantId: string,
  opts: { includeClosed?: boolean } = {},
): Promise<ReminderInboxRow[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { reminderLeadDays: true },
  });
  if (!tenant) throw new ServiceError("NOT_FOUND", "Usaha tidak ditemukan");
  const lead = tenant.reminderLeadDays;
  const now = new Date();

  const units = await prisma.asset.findMany({
    where: { tenantId, deletedAt: null, nextServiceDate: { not: null } },
    include: { customer: true },
  });

  const unitsDue = units.filter((u) => {
    if (!u.nextServiceDate) return false;
    const trigger = new Date(u.nextServiceDate);
    trigger.setDate(trigger.getDate() - lead);
    return trigger.getTime() <= now.getTime();
  });
  if (unitsDue.length === 0) return [];

  const assetIds = unitsDue.map((u) => u.id);
  const reminders = await prisma.repeatReminder.findMany({
    where: { tenantId, assetId: { in: assetIds } },
    orderBy: { dueDate: "desc" },
  });
  const latestByAsset = new Map<string, (typeof reminders)[number]>();
  for (const r of reminders) if (!latestByAsset.has(r.assetId)) latestByAsset.set(r.assetId, r);

  const sentList = [...latestByAsset.values()].filter((r) => r.status === "SENT" && r.sentAt);
  let messages: Awaited<ReturnType<typeof prisma.messageLog.findMany>> = [];
  if (sentList.length > 0) {
    const min = new Date(Math.min(...sentList.map((r) => r.sentAt!.getTime())) - 5000);
    const max = new Date(Math.max(...sentList.map((r) => r.sentAt!.getTime())) + 5000);
    messages = await prisma.messageLog.findMany({
      where: {
        tenantId,
        direction: "OUTBOUND",
        templateKey: { in: ["reminder", "reminder_multi"] },
        at: { gte: min, lte: max },
      },
    });
  }

  const rows: ReminderInboxRow[] = [];
  for (const u of unitsDue) {
    const rem = latestByAsset.get(u.id) ?? null;
    // Pengingat terakhir sudah ditutup (DISMISSED/CONVERTED/EXPIRED) -> keluar dari daftar default.
    if (rem && (CLOSED_REMINDER_STATUSES as readonly string[]).includes(rem.status)) {
      if (!opts.includeClosed) continue;
    }
    let sendStatus: ReminderInboxRow["sendStatus"] = "BELUM_DIKIRIM";
    let messageLogId: string | null = null;
    let sentAt: Date | null = null;

    if (rem) {
      sentAt = rem.sentAt;
      if (rem.status === "QUEUED") {
        sendStatus = "MENUNGGU_KRIM";
      } else if (rem.status === "SENT") {
        if (!rem.sentAt) {
          sendStatus = "TIDAK_DIKETAHUI";
        } else {
          const match = messages.find(
            (m) =>
              m.customerId === u.customerId &&
              Math.abs(m.at.getTime() - rem.sentAt!.getTime()) <= 5000,
          );
          if (match) {
            messageLogId = match.id;
            sendStatus = mapMessageStatus(match.status);
          } else {
            sendStatus = "TIDAK_DIKETAHUI";
          }
        }
      } else if ((CLOSED_REMINDER_STATUSES as readonly string[]).includes(rem.status)) {
        sendStatus = "DITUTUP"; // DISMISSED / CONVERTED / EXPIRED (lihat includeClosed)
      } else {
        sendStatus = "TIDAK_DIKETAHUI";
      }
    }

    const overdueDays = Math.max(0, Math.floor((now.getTime() - u.nextServiceDate!.getTime()) / 86400000));
    rows.push({
      assetId: u.id,
      brand: u.brand,
      model: u.model,
      capacityPk: u.capacityPk,
      roomLocation: u.roomLocation,
      nextServiceDate: u.nextServiceDate,
      customerId: u.customerId,
      customerName: u.customer.name,
      customerPhone: u.customer.phone,
      reminderId: rem?.id ?? null,
      reminderStatus: rem?.status ?? null,
      sendStatus,
      messageLogId,
      sentAt,
      overdueDays,
      waLink: waLinkTo(u.customer.phone),
    });
  }
  return rows;
}
