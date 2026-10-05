import { describe, it, expect, vi } from "vitest";

/**
 * Kinerja Tim — periode (hari/minggu/bulan) & agregasi dari pekerjaan YANG
 * BENAR-BENAR DIKERJAKAN (WorkItem.techIds/kernetIds, sesi CLOSED), bukan penugasan.
 * Fakta audit: JobAssignment = penugasan; WorkItem = pekerjaan dikerjakan (88/88 terisi).
 */
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/services/customer-service", () => ({
  ServiceError: class ServiceError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

import {
  parseKinerjaParams, kinRange, kinLabel, shiftKinerja, kinerjaQueryString,
} from "../src/lib/domain/kinerja";
import { aggregateKinerja, type KinerjaSession } from "../src/lib/domain/kinerja-aggregate";

// ---------- periode ----------
const sp = (o: Record<string, string>) => o as { [k: string]: string | string[] | undefined };

describe("parseKinerjaParams", () => {
  it("default hari + anchor hari ini", () => {
    const p = parseKinerjaParams({});
    expect(p.period).toBe("hari");
    const now = new Date();
    expect(p.anchor.getFullYear()).toBe(now.getFullYear());
    expect(p.anchor.getMonth()).toBe(now.getMonth());
    expect(p.anchor.getDate()).toBe(now.getDate());
  });
  it("param periode valid diterima; anchor diabaikan bila tidak valid", () => {
    const p = parseKinerjaParams(sp({ periode: "minggu", t: "2026-09-30" }));
    expect(p.period).toBe("minggu");
    expect([p.anchor.getFullYear(), p.anchor.getMonth() + 1, p.anchor.getDate()]).toEqual([2026, 9, 30]);
  });
  it("periode sampah → default hari (tanpa crash)", () => {
    expect(parseKinerjaParams(sp({ periode: "ngawur" })).period).toBe("hari");
    expect(parseKinerjaParams(sp({ t: "bukan-tanggal" })).period).toBe("hari");
  });
  it("anchor bulan (YYYY-MM) dibaca", () => {
    const p = parseKinerjaParams(sp({ periode: "bulan", t: "2026-08" }));
    expect(p.anchor.getFullYear()).toBe(2026);
    expect(p.anchor.getMonth()).toBe(7);
  });
});

describe("kinRange", () => {
  it("hari: rentang 00:00–23:59 hari anchor", () => {
    const { start, end } = kinRange({ period: "hari", anchor: new Date(2026, 9, 5) });
    expect(start.getTime()).toBe(new Date(2026, 9, 5, 0, 0, 0, 0).getTime());
    expect(end.getTime()).toBe(new Date(2026, 9, 5, 23, 59, 59, 999).getTime());
  });
  it("minggu: Senin–Minggu (startOfWeek Senin, konsisten agenda)", () => {
    // 2026-10-05 = Senin
    const { start, end } = kinRange({ period: "minggu", anchor: new Date(2026, 9, 7) });
    expect(start.getDay()).toBe(1); // Senin
    expect(start.getTime()).toBe(new Date(2026, 9, 5, 0, 0, 0, 0).getTime());
    expect(end.getTime()).toBe(new Date(2026, 9, 11, 23, 59, 59, 999).getTime());
  });
  it("bulan: tgl 1 – akhir bulan anchor", () => {
    const { start, end } = kinRange({ period: "bulan", anchor: new Date(2026, 1, 10) });
    expect(start.getTime()).toBe(new Date(2026, 1, 1, 0, 0, 0, 0).getTime());
    expect(end.getTime()).toBe(new Date(2026, 1, 28, 23, 59, 59, 999).getTime()); // 2026 bukan kabisat
  });
});

describe("kinLabel / shiftKinerja", () => {
  it("label id-ID (hari lengkap, pekan, bulan+tahun)", () => {
    expect(kinLabel({ period: "hari", anchor: new Date(2026, 9, 5) })).toContain("5");
    const w = kinLabel({ period: "minggu", anchor: new Date(2026, 9, 7) });
    expect(w).toContain("2026");
    expect(kinLabel({ period: "bulan", anchor: new Date(2026, 9, 5) })).toContain("Oktober");
  });
  it("geser: hari ±1, minggu ±7 hari, bulan ±1 bulan (lintas tahun aman)", () => {
    const d = { period: "hari" as const, anchor: new Date(2026, 11, 31) };
    expect(shiftKinerja(d, 1).anchor.getTime()).toBe(new Date(2027, 0, 1).getTime());
    expect(shiftKinerja(d, -1).anchor.getTime()).toBe(new Date(2026, 11, 30).getTime());
    const w = { period: "minggu" as const, anchor: new Date(2026, 0, 5) };
    expect(shiftKinerja(w, 1).anchor.getTime()).toBe(new Date(2026, 0, 12).getTime());
    const m = { period: "bulan" as const, anchor: new Date(2026, 11, 15) };
    expect(shiftKinerja(m, 1).anchor.getTime()).toBe(new Date(2027, 0, 15).getTime());
  });
  it("URL query round-trip (bulan YYYY-MM, hari/YYYY-MM-DD)", () => {
    const sp = (s: string) => Object.fromEntries(new URLSearchParams(s)) as { [k: string]: string | string[] | undefined };
    const h = { period: "hari" as const, anchor: new Date(2026, 9, 5) };
    expect(parseKinerjaParams(sp(kinerjaQueryString(h)))).toMatchObject({ period: "hari" });
    expect([parseKinerjaParams(sp(kinerjaQueryString(h))).anchor.getDate()]).toEqual([5]);
    const m = { period: "bulan" as const, anchor: new Date(2026, 11, 31) };
    const back = parseKinerjaParams(sp(kinerjaQueryString(m)));
    expect(back.period).toBe("bulan");
    expect([back.anchor.getFullYear(), back.anchor.getMonth()]).toEqual([2026, 11]);
  });
});

// ---------- agregasi kinerja ----------
const catalog = new Map([
  ["s1", { standardPrice: 100000, techIncentiveType: "VALUE" as const, techIncentiveValue: 20000, kernetIncentiveType: "VALUE" as const, kernetIncentiveValue: 10000 }],
  ["s2", { standardPrice: 50000, techIncentiveType: "VALUE" as const, techIncentiveValue: 0, kernetIncentiveType: "VALUE" as const, kernetIncentiveValue: 0 }],
]);
const names = new Map([["p1", "Andi"], ["p2", "Budi"], ["p3", "Coki"]]);

const session = (over: Partial<KinerjaSession>): KinerjaSession => ({
  sessionId: "ws1",
  jobId: "j1",
  closedAt: new Date(2026, 9, 5, 10, 0),
  customer: "PT Sejuk",
  jobType: "CLEANING",
  items: [],
  ...over,
});
const item = (over: Partial<KinerjaSession["items"][number]> = {}) => ({
  serviceId: "s1",
  desc: "Cuci AC Split",
  qty: 1,
  unit: "unit",
  unitPrice: 100000,
  lineTotal: 100000,
  techIds: [] as string[],
  kernetIds: [] as string[],
  assetLabel: "LG · 1PK · Kamar 1",
  ...over,
});

describe("aggregateKinerja — kinerja = yang DIKERJAKAN (bukan penugasan)", () => {
  it("ringkasan per orang: pekerjaan (sesi/job unik), jumlah layanan, insentif", () => {
    const r = aggregateKinerja([
      session({ items: [item({ techIds: ["p1"] })] }),
      session({ sessionId: "ws2", jobId: "j2", items: [item({ techIds: ["p1"], kernetIds: ["p2"] })] }),
    ], { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true });
    const andi = r.find((p) => p.personId === "p1")!;
    expect(andi.jobCount).toBe(2);
    expect(andi.itemCount).toBe(2);
    expect(andi.incentive).toBe(40000); // 2 item × 20000
    const budi = r.find((p) => p.personId === "p2")!;
    expect(budi.jobCount).toBe(1);
    expect(budi.itemCount).toBe(1);
    expect(budi.incentive).toBe(10000);
  });

  it("PEKERJAAN TANPA jobId tetap dihitung (sesi = 1 pekerjaan)", () => {
    const r = aggregateKinerja(
      [session({ jobId: null, items: [item({ techIds: ["p1"] })] })],
      { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true },
    );
    expect(r.find((p) => p.personId === "p1")!.jobCount).toBe(1);
  });

  it("peran tertera per baris: techIds→Teknisi, kernetIds→Kernet (orang sama boleh dua peran di item beda)", () => {
    const r = aggregateKinerja([
      session({ items: [item({ techIds: ["p1"], kernetIds: ["p2"] })] }),
      session({ sessionId: "ws2", jobId: "j2", items: [item({ techIds: ["p2"] })] }),
    ], { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true });
    const andi = r.find((p) => p.personId === "p1")!;
    expect(andi.rows[0].role).toBe("TECHNICIAN");
    const budi = r.find((p) => p.personId === "p2")!;
    const roles = budi.rows.map((x) => x.role).sort();
    expect(roles).toEqual(["KERNET", "TECHNICIAN"]);
  });

  it("insentif TENGGELAM bila tenant incentiveEnabled=false (aturan gerbang source, sama computeIncentives)", () => {
    const r = aggregateKinerja(
      [session({ items: [item({ techIds: ["p1"] })] })],
      { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: false },
    );
    expect(r.find((p) => p.personId === "p1")!.incentive).toBe(0);
    // tapi kinerja tetap terlihat
    expect(r.find((p) => p.personId === "p1")!.itemCount).toBe(1);
  });

  it("teamMode PENUH dipakai utk insentif item (aturan K7 existing)", () => {
    const r = aggregateKinerja([
      session({ items: [item({ techIds: ["p1", "p3"] })] }),
    ], { names, catalogById: catalog, teamMode: "PENUH", incentiveEnabled: true });
    expect(r.find((p) => p.personId === "p1")!.incentive).toBe(20000); // penuh, bukan dibagi
    expect(r.find((p) => p.personId === "p3")!.incentive).toBe(20000);
  });

  it("nama & urutan: urut by jumlah layanan lalu nama; personel tanpa item tidak muncul", () => {
    const r = aggregateKinerja([
      session({ items: [item({ techIds: ["p1"] }), item({ techIds: ["p3"] })] }),
    ], { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true });
    expect(r.map((x) => x.personId)).toEqual(["p1", "p3"]); // sama-sama 1 → nama Andi, Coki
    expect(r.find((x) => x.personId === "p2")).toBeUndefined();
  });

  it("detail rows mengandung tautan pekerjaan & tanggal sesi (urut terbaru dulu)", () => {
    const r = aggregateKinerja([
      session({ closedAt: new Date(2026, 9, 5, 9, 0), items: [item({ techIds: ["p1"] })] }),
      session({ sessionId: "ws2", jobId: "j2", closedAt: new Date(2026, 9, 6, 9, 0), items: [item({ techIds: ["p1"] })] }),
    ], { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true });
    const andi = r.find((p) => p.personId === "p1")!;
    expect(andi.rows).toHaveLength(2);
    expect(andi.rows[0].date.getTime()).toBeGreaterThan(andi.rows[1].date.getTime());
    expect(andi.rows[0].jobId).toBe("j2");
    expect(andi.rows[0].customer).toBe("PT Sejuk");
    expect(andi.rows[0].asset).toBe("LG · 1PK · Kamar 1");
  });

  it("layanan tanpa katalog config → tetap dihitung sebagai pekerjaan dikerjakan (insentif 0)", () => {
    const r = aggregateKinerja([
      session({ items: [item({ serviceId: null, techIds: ["p1"] })] }),
    ], { names, catalogById: catalog, teamMode: "BAGI_RATA", incentiveEnabled: true });
    const andi = r.find((p) => p.personId === "p1")!;
    expect(andi.itemCount).toBe(1);
    expect(andi.incentive).toBe(0);
  });
});
