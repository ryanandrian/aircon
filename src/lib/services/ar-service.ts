/**
 * AR / Piutang Service (F5.1) — query piutang, aging, penerimaan, jatuh tempo. Tenant-scoped.
 * Piutang = invoice docType INVOICE, status ISSUED/OVERDUE (belum PAID/CANCELLED).
 * Aging bucket dihitung dari dueDate (bila null → pakai issueDate) relatif tanggal acuan.
 */
import { prisma } from "@/lib/prisma";
import { ServiceError } from "@/lib/services/customer-service";

export interface AgingBuckets {
  current: number;   // belum jatuh tempo
  d1_30: number;     // telat 1-30 hari
  d31_60: number;    // telat 31-60
  d61_90: number;    // telat 61-90
  d90plus: number;   // telat >90
  total: number;
}

/** Bucket aging MURNI dari daftar {amount, dueDate} relatif `asOf`. */
export function bucketAging(
  rows: { amount: number; dueDate: Date | null; issueDate: Date }[],
  asOf: Date,
): AgingBuckets {
  const b: AgingBuckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
  const asOfMs = asOf.getTime();
  for (const r of rows) {
    const ref = r.dueDate ?? r.issueDate;
    const daysLate = Math.floor((asOfMs - ref.getTime()) / 86400000);
    if (daysLate <= 0) b.current += r.amount;
    else if (daysLate <= 30) b.d1_30 += r.amount;
    else if (daysLate <= 60) b.d31_60 += r.amount;
    else if (daysLate <= 90) b.d61_90 += r.amount;
    else b.d90plus += r.amount;
    b.total += r.amount;
  }
  return b;
}

/** Ringkasan piutang tenant per tanggal acuan (aging). */
export async function getAccountsReceivable(tenantId: string, asOf: Date = new Date()): Promise<AgingBuckets> {
  const rows = await prisma.invoice.findMany({
    where: { tenantId, docType: "INVOICE", status: { in: ["ISSUED", "OVERDUE"] } },
    select: { total: true, dueDate: true, issueDate: true },
  });
  return bucketAging(rows.map((r) => ({ amount: Number(r.total), dueDate: r.dueDate, issueDate: r.issueDate })), asOf);
}

/** Daftar invoice jatuh tempo (dueDate < asOf, belum lunas). Untuk notif admin & tindak lanjut. */
export async function getOverdueInvoices(tenantId: string, asOf: Date = new Date()) {
  const rows = await prisma.invoice.findMany({
    where: {
      tenantId, docType: "INVOICE", status: { in: ["ISSUED", "OVERDUE"] },
      dueDate: { not: null, lt: asOf },
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, number: true, total: true, dueDate: true, customer: { select: { name: true, phone: true } } },
  });
  return rows.map((r) => ({
    id: r.id, number: r.number, total: Number(r.total), dueDate: r.dueDate,
    customerName: r.customer?.name ?? "—", customerPhone: r.customer?.phone ?? "",
    daysLate: r.dueDate ? Math.floor((asOf.getTime() - r.dueDate.getTime()) / 86400000) : 0,
  }));
}

export interface ReceiptPositions {
  /** ARUS periode: uang yang benar-benar DITERIMA kantor pada rentang ini
   *  (setoran tercatat / verifikasi tercatat dalam rentang). */
  penerimaan: { total: number; count: number };
  /** KEADAAN saat ini (seluruh waktu): uang tunai lunas yang BELUM disetor —
   *  uang fisik di tangan teknisi tidak kedaluwarsa di akhir bulan (K3). */
  menungguSetoran: { total: number; count: number };
  /** KEADAAN saat ini (seluruh waktu): transfer/QRIS lunas BELUM diverifikasi (K4). */
  menungguVerifikasi: { total: number; count: number };
  /** KEADAAN saat ini: seluruh invoice lunas — identitas snapshot:
   *  totalKotor = penerimaan(all) + menungguSetoran + menungguVerifikasi. */
  totalKotor: number;
}

/**
 * Tiga posisi uang lunas pada periode (L4 — keputusan K1, 2026-10-17).
 * Menggantikan `getReceipts` (F-01/M1: satu angka campur tiga posisi berbeda).
 *
 * Aturan:
 *  - CASH + REMITTED                  → penerimaan (uang sudah di kantor)
 *  - CASH lain (HELD_BY_TECH / null)  → menungguSetoran (dana fisik dipegang teknisi)
 *  - TRANSFER/QRIS + verifiedAt       → penerimaan (sudah dipastikan masuk rekening)
 *  - TRANSFER/QRIS tanpa verifikasi   → menungguVerifikasi (K4 — belum boleh dihitung)
 *  - payMethod null pada invoice PAID → menungguVerifikasi (konservatif: TIDAK dihitung
 *    masuk sebelum jelas; data live 2026-10-18: 0 kasus — dijaga tetap 0-untuk-masuk)
 *
 * Posisi saling lepas dan mencakup seluruh invoice lunas → identitas selalu terpenuhi.
 */
export async function getReceiptPositions(
  tenantId: string, start: Date, end: Date,
): Promise<ReceiptPositions> {
  // TANPA filter paidAt (KOREKSI K11, 2026-10-18): dua posisi "menunggu" adalah
  // KEADAAN, jadi seluruh waktu — selaras dengan tabel "Kas Belum Disetor per
  // Teknisi" (juga seluruh waktu). Kartu berperiode menyembunyikan uang yang SEDANG
  // dipegang teknisi (laporan pemilik: kartu Rp225.000 vs tabel Rp2.855.000).
  const rows = await prisma.invoice.findMany({
    where: { tenantId, docType: "INVOICE", status: "PAID" },
    select: {
      total: true, payMethod: true, cashRemitStatus: true,
      remittedAt: true, verifiedAt: true,
    },
  });
  const acc = { penerimaan: { total: 0, count: 0 }, menungguSetoran: { total: 0, count: 0 }, menungguVerifikasi: { total: 0, count: 0 }, totalKotor: 0 };
  const inRange = (d: Date | null) => d !== null && d >= start && d <= end;
  for (const r of rows) {
    const amt = Number(r.total);
    acc.totalKotor += amt;
    if (r.payMethod === "CASH") {
      if (r.cashRemitStatus === "REMITTED") {
        // Arus: diterima pada rentang KETIKA setoran dicatat.
        if (inRange(r.remittedAt)) { acc.penerimaan.total += amt; acc.penerimaan.count += 1; }
      } else { acc.menungguSetoran.total += amt; acc.menungguSetoran.count += 1; }
    } else {
      // Transfer/QRIS (dan payMethod null — konservatif, tidak diklaim masuk).
      if (r.payMethod === "TRANSFER" || r.payMethod === "QRIS") {
        if (r.verifiedAt) {
          // Arus: diterima pada rentang KETIKA verifikasi dicatat.
          if (inRange(r.verifiedAt)) { acc.penerimaan.total += amt; acc.penerimaan.count += 1; }
        } else { acc.menungguVerifikasi.total += amt; acc.menungguVerifikasi.count += 1; }
      } else { acc.menungguVerifikasi.total += amt; acc.menungguVerifikasi.count += 1; }
    }
  }
  return acc;
}

/**
 * Sinkron status OVERDUE: invoice ISSUED yang dueDate < asOf → OVERDUE.
 * Dipanggil saat buka laporan (idempoten). Return jumlah yang diubah.
 */
export async function refreshOverdueStatus(tenantId: string, asOf: Date = new Date()): Promise<number> {
  const res = await prisma.invoice.updateMany({
    where: { tenantId, docType: "INVOICE", status: "ISSUED", dueDate: { not: null, lt: asOf } },
    data: { status: "OVERDUE" },
  });
  return res.count;
}

// ─────────── Setoran Kas Teknisi (K17) ───────────

/**
 * Laporan kas belum disetor per teknisi (K17): invoice CASH lunas, cashRemitStatus HELD_BY_TECH.
 * Dikelompokkan per createdById (teknisi yang menutup sesi & memegang uang).
 */
export async function getUnremittedCashByTech(tenantId: string) {
  const rows = await prisma.invoice.findMany({
    where: {
      tenantId, docType: "INVOICE", status: "PAID",
      payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH",
    },
    select: { id: true, number: true, total: true, paidAt: true, createdById: true },
  });
  // Nama personel dari User.
  const ids = [...new Set(rows.map((r) => r.createdById))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  const byTech = new Map<string, { techId: string; techName: string; total: number; count: number; invoiceIds: string[] }>();
  for (const r of rows) {
    const key = r.createdById;
    if (!byTech.has(key)) byTech.set(key, { techId: key, techName: nameOf.get(key) ?? "—", total: 0, count: 0, invoiceIds: [] });
    const g = byTech.get(key)!;
    g.total += Number(r.total); g.count += 1; g.invoiceIds.push(r.id);
  }
  return [...byTech.values()].sort((a, b) => b.total - a.total);
}

/**
 * Tandai setoran kas: invoice HELD_BY_TECH → REMITTED (K17). Owner/admin (dijaga di action).
 *
 * L2 (keputusan K5, 2026-10-17): setoran MENINGGALKAN JEJAK dalam satu transaksi atomik —
 * waktu setoran, admin penerima (tenant bisa punya >1 admin), dan foto bukti (S3).
 * Setoran TANPA foto bukti / TANPA admin penerima DITOLAK di service (bukan hanya di layar).
 * Data lama (REMITTED tanpa jejak) tetap terbaca — kolom baru nullable.
 */
export interface CashRemitDetails {
  /** Admin tenant yang MENERIMA setoran (siapa di kantor yang menadah uang). */
  receiverId: string;
  /** URL foto bukti setoran di S3 (wajib — K5). */
  proofUrl: string;
  /** Waktu setoran (disediakan caller agar bisa diuji deterministik). */
  at?: Date;
}

export async function markCashRemitted(
  tenantId: string,
  invoiceIds: string[],
  details: CashRemitDetails,
): Promise<number> {
  if (invoiceIds.length === 0) return 0;
  const proofUrl = details.proofUrl?.trim() ?? "";
  const receiverId = details.receiverId?.trim() ?? "";
  if (!proofUrl) {
    throw new ServiceError("CONFLICT", "Setoran wajib menyertakan foto bukti setoran.");
  }
  if (!receiverId) {
    throw new ServiceError("CONFLICT", "Setoran wajib mencatat admin penerima setoran.");
  }
  const at = details.at ?? new Date();
  return prisma.$transaction(async (tx) => {
    const res = await tx.invoice.updateMany({
      where: {
        tenantId, id: { in: invoiceIds },
        docType: "INVOICE", status: "PAID", cashRemitStatus: "HELD_BY_TECH",
      },
      data: {
        cashRemitStatus: "REMITTED",
        remittedAt: at,
        remittedById: receiverId,
        remitProofUrl: proofUrl,
      },
    });
    return res.count;
  });
}

export interface RemittanceRow {
  id: string;
  number: string;
  total: number;
  paidAt: Date | null;
  /** Waktu setoran — null = setoran lama sebelum jejak ada (tetap tampil). */
  remittedAt: Date | null;
  /** Teknisi yang memegang uang sebelum disetor. */
  techName: string;
  /** Admin tenant penerima setoran — null = setoran lama tanpa jejak. */
  receiverName: string | null;
  /** Foto bukti setoran (S3) yang bisa dibuka untuk audit. */
  proofUrl: string | null;
}

/**
 * Daftar SETORAN kas untuk laporan tracing owner tenant (L5 / K5): per invoice —
 * siapa menyetor (teknisi) → siapa menerima (admin) → kapan → buktinya di mana.
 * Baris setoran LAMA tanpa jejak tetap tampil (jejaknya kosong), tidak disembunyikan.
 * Tenant-scoped: hanya invoice milik tenant ini.
 */
export async function getRemittances(tenantId: string): Promise<RemittanceRow[]> {
  const rows = await prisma.invoice.findMany({
    where: { tenantId, docType: "INVOICE", cashRemitStatus: "REMITTED" },
    orderBy: { remittedAt: { sort: "desc", nulls: "last" } },
    select: {
      id: true, number: true, total: true, paidAt: true,
      remittedAt: true, remitProofUrl: true,
      createdById: true, remittedById: true,
    },
  });

  // Nama teknisi pemegang & admin penerima (pola sama dengan getUnremittedCashByTech).
  const ids = [...new Set(rows.flatMap((r) => [r.createdById, r.remittedById]).filter((v): v is string => !!v))];
  const users = ids.length
    ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    total: Number(r.total),
    paidAt: r.paidAt,
    remittedAt: r.remittedAt,
    techName: nameOf.get(r.createdById) ?? "—",
    // Setoran lama (sebelum jejak ada) → null; tampil apa adanya, tidak dikarang.
    receiverName: r.remittedById ? nameOf.get(r.remittedById) ?? "—" : null,
    proofUrl: r.remitProofUrl,
  }));
}
