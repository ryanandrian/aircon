import { describe, it, expect, vi } from "vitest";

// agenda-service punya import prisma di top-level; netralkan agar unit test ini
// murni menguji agendaWhere (fungsi murni, tidak memanggil prisma).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@prisma/client", () => ({ Prisma: {} }));

import { agendaWhere } from "../src/lib/services/agenda-service";
import { parseAgendaParams, agendaRange } from "../src/lib/domain/agenda";
import type { Prisma } from "@prisma/client";

/** Ekstrak klausul OR rentang (elemen AND pertama) untuk diperiksa. */
function rangeOr(where: Prisma.JobOrderWhereInput): Prisma.JobOrderWhereInput[] {
  const and = where.AND;
  const first = Array.isArray(and) ? and[0] : undefined;
  return first && typeof first === "object" && Array.isArray(first.OR) ? first.OR : [];
}

const weekParams = parseAgendaParams({ tampilan: "week", tahun: "2026", bulan: "10", tanggal: "4" });
const weekRange = agendaRange(weekParams)!;

const ACTIVE = ["DRAFT", "ASSIGNED", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS", "WAITING"];

describe("agendaWhere — grup 'Belum terjadwal' hanya untuk job AKTIF", () => {
  // REGRESI (temuan produksi 2026-10-04): tenant AC Depok Jaya menampilkan
  // "Belum terjadwal 2 pekerjaan" padahal keduanya COMPLETED & CANCELLED.
  const or = rangeOr(agendaWhere("t1", weekParams, weekRange));

  const unscheduledClause = or.find(
    (c) => JSON.stringify(c).includes('"scheduledDate":null'),
  )!;

  it("klausul tanpa jadwal WAJIB membatasi status aktif", () => {
    expect(unscheduledClause).toBeDefined();
    const status = (unscheduledClause.AND as { status: { in: string[] } }[])[1].status;
    expect(status.in).toEqual(ACTIVE);
  });

  it("job COMPLETED/CANCELLED tanpa jadwal TIDAK termasuk (dicek via tabel kebenaran)", () => {
    const inRange = (clause: unknown, status: string, scheduledDate: Date | null) => {
      const c = clause as { AND?: Record<string, unknown>[] };
      if (!c.AND) return false;
      // kondisi jadwal
      const dateOk = c.AND.some((cond) => {
        if ("scheduledDate" in cond) {
          const f = cond.scheduledDate as { gte?: Date; lte?: Date } | null;
          if (f === null) return scheduledDate === null;
          if (f?.gte && scheduledDate) return scheduledDate >= f.gte;
          if (f?.lte && scheduledDate) return scheduledDate <= f.lte;
          return false;
        }
        return false;
      });
      // kondisi status
      const statusOk = c.AND.some(
        (cond) => "status" in cond && (cond.status as { in: string[] }).in.includes(status),
      );
      return dateOk && statusOk;
    };

    expect(inRange(unscheduledClause, "COMPLETED", null)).toBe(false);
    expect(inRange(unscheduledClause, "CANCELLED", null)).toBe(false);
    expect(inRange(unscheduledClause, "ASSIGNED", null)).toBe(true);
  });

  it("pekerjaan terjadwal dalam rentang tetap ikut (bukan hanya yang tanpa jadwal)", () => {
    const scheduledInRange = or.find(
      (c) => JSON.stringify(c).includes('"scheduledDate":{"gte"'),
    );
    expect(scheduledInRange).toBeDefined();
    expect(JSON.stringify(scheduledInRange)).toContain("lte");
  });

  it("pekerjaan terlambat tapi masih aktif tetap tampil (tidak hilang)", () => {
    const overdue = or.find(
      (c) => JSON.stringify(c).includes('"scheduledDate":{"lt"'),
    )!;
    expect(overdue).toBeDefined();
    const status = (overdue.AND as { status: { in: string[] } }[])[1].status;
    expect(status.in).toEqual(ACTIVE);
  });
});

describe("agendaWhere — tanpa rentang (Riwayat)", () => {
  it("semua status tanpa jadwal tetap terlihat di Riwayat", () => {
    const where = agendaWhere("t1", parseAgendaParams({ tampilan: "riwayat" }), null);
    expect(where.AND).toBeUndefined(); // tanpa klausul rentang sama sekali
    expect(where.status).toBeUndefined(); // SEMUA → semua status
  });

  it("filter status BELUM tetap membatasi ke status aktif", () => {
    const where = agendaWhere(
      "t1",
      parseAgendaParams({ tampilan: "riwayat", status: "BELUM" }),
      null,
    );
    expect(where.status).toEqual({ in: ACTIVE });
  });
});
