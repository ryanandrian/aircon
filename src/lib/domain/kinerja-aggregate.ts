/**
 * Domain Kinerja — agregasi PERFORMED (server-only).
 *
 * Terpisah dari ./kinerja (client-safe) karena mengimpor computeItemIncentive
 * yang rantainya menarik prisma/pg — tidak boleh masuk browser bundle.
 * Sumber kebenaran: WorkItem.techIds/kernetIds pada WorkSession CLOSED
 * (pekerjaan BENAR-BENAR dikerjakan), bukan JobAssignment (penugasan).
 */
import { computeItemIncentive, type IncentiveCatalogItem } from "@/lib/services/service-catalog-service";

type TeamMode = "BAGI_RATA" | "PENUH";

// ---------- agregasi kinerja (murni — diuji tanpa prisma) ----------

export interface KinItem {
  serviceId: string | null;
  desc: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  techIds: string[];
  kernetIds: string[];
  assetLabel: string | null;
}

export interface KinerjaSession {
  sessionId: string;
  jobId: string | null;
  closedAt: Date;
  customer: string;
  jobType: string | null;
  items: KinItem[];
}

export interface KinRow {
  date: Date;
  sessionId: string;
  jobId: string | null;
  customer: string;
  jobType: string | null;
  asset: string | null;
  service: string;
  qty: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  role: "TECHNICIAN" | "KERNET";
  incentive: number;
}

export interface KinPerson {
  personId: string;
  personName: string;
  jobCount: number;
  itemCount: number;
  incentive: number;
  rows: KinRow[];
}

export interface KinOptions {
  names: Map<string, string>;
  catalogById: Map<string, IncentiveCatalogItem>;
  teamMode: TeamMode;
  incentiveEnabled: boolean;
}

/**
 * Agregasi murni dari sesi CLOSED dalam periode → ringkasan + detail per personel.
 * Insentif = computeItemIncentive (aturan K6/K7 existing) dan NOL bila tenant
 * tidak menerapkan insentif (gerbang source, sama dgn computeIncentives).
 */
export function aggregateKinerja(sessions: KinerjaSession[], opts: KinOptions): KinPerson[] {
  const byPerson = new Map<string, KinRow[]>();

  for (const ws of sessions) {
    for (const it of ws.items) {
      const cat = it.serviceId ? opts.catalogById.get(it.serviceId) : undefined;
      const roles: { pid: string; role: "TECHNICIAN" | "KERNET" }[] = [
        ...it.techIds.map((pid) => ({ pid, role: "TECHNICIAN" as const })),
        ...it.kernetIds.map((pid) => ({ pid, role: "KERNET" as const })),
      ];
      for (const { pid, role } of roles) {
        let incentive = 0;
        if (opts.incentiveEnabled && cat) {
          const sameRole = role === "TECHNICIAN" ? it.techIds.length : it.kernetIds.length;
          incentive = computeItemIncentive(cat, role, it.unitPrice, it.qty, sameRole, opts.teamMode);
        }
        const rows = byPerson.get(pid) ?? [];
        rows.push({
          date: ws.closedAt,
          sessionId: ws.sessionId,
          jobId: ws.jobId,
          customer: ws.customer,
          jobType: ws.jobType,
          asset: it.assetLabel,
          service: it.desc,
          qty: it.qty,
          unit: it.unit,
          unitPrice: it.unitPrice,
          lineTotal: it.lineTotal,
          role,
          incentive,
        });
        byPerson.set(pid, rows);
      }
    }
  }

  const out: KinPerson[] = [];
  for (const [personId, rows] of byPerson) {
    rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    const jobKeys = new Set(rows.map((r) => r.jobId ?? `ws:${r.sessionId}`));
    out.push({
      personId,
      personName: opts.names.get(personId) ?? "—",
      jobCount: jobKeys.size,
      itemCount: rows.length,
      incentive: rows.reduce((s, r) => s + r.incentive, 0),
      rows,
    });
  }
  // Ringkasan: terbanyak layanan dulu → nama (A–Z).
  out.sort((a, b) => b.itemCount - a.itemCount || a.personName.localeCompare(b.personName, "id"));
  return out;
}
