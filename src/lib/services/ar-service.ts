/**
 * AR / Piutang Service (F5.1) — query piutang, aging, penerimaan, jatuh tempo. Tenant-scoped.
 * Piutang = invoice docType INVOICE, status ISSUED/OVERDUE (belum PAID/CANCELLED).
 * Aging bucket dihitung dari dueDate (bila null → pakai issueDate) relatif tanggal acuan.
 */
import { prisma } from "@/lib/prisma";

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

/** Total penerimaan (invoice PAID) dalam rentang [start, end]. */
export async function getReceipts(tenantId: string, start: Date, end: Date): Promise<{ total: number; count: number }> {
  const rows = await prisma.invoice.findMany({
    where: { tenantId, docType: "INVOICE", status: "PAID", paidAt: { gte: start, lte: end } },
    select: { total: true },
  });
  return { total: rows.reduce((s, r) => s + Number(r.total), 0), count: rows.length };
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

/** Tandai setoran kas: invoice HELD_BY_TECH → REMITTED (K17). Owner/admin (dijaga di action). */
export async function markCashRemitted(tenantId: string, invoiceIds: string[]): Promise<number> {
  if (invoiceIds.length === 0) return 0;
  const res = await prisma.invoice.updateMany({
    where: {
      tenantId, id: { in: invoiceIds },
      docType: "INVOICE", status: "PAID", cashRemitStatus: "HELD_BY_TECH",
    },
    data: { cashRemitStatus: "REMITTED" },
  });
  return res.count;
}
