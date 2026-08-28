import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
import { bucketAging } from "../src/lib/services/ar-service";

/** F5.1 — aging bucket MURNI. */
const d = (s: string) => new Date(s + "T00:00:00");
const asOf = d("2026-09-01");

describe("bucketAging", () => {
  it("belum jatuh tempo → current", () => {
    const b = bucketAging([{ amount: 100000, dueDate: d("2026-09-15"), issueDate: d("2026-09-01") }], asOf);
    expect(b.current).toBe(100000);
    expect(b.total).toBe(100000);
    expect(b.d1_30).toBe(0);
  });
  it("telat 10 hari → 1-30", () => {
    const b = bucketAging([{ amount: 50000, dueDate: d("2026-08-22"), issueDate: d("2026-08-01") }], asOf);
    expect(b.d1_30).toBe(50000);
  });
  it("telat 45 hari → 31-60", () => {
    const b = bucketAging([{ amount: 70000, dueDate: d("2026-07-18"), issueDate: d("2026-07-01") }], asOf);
    expect(b.d31_60).toBe(70000);
  });
  it("telat 75 hari → 61-90", () => {
    const b = bucketAging([{ amount: 80000, dueDate: d("2026-06-18"), issueDate: d("2026-06-01") }], asOf);
    expect(b.d61_90).toBe(80000);
  });
  it("telat >90 → d90plus", () => {
    const b = bucketAging([{ amount: 90000, dueDate: d("2026-01-01"), issueDate: d("2026-01-01") }], asOf);
    expect(b.d90plus).toBe(90000);
  });
  it("dueDate null → pakai issueDate", () => {
    const b = bucketAging([{ amount: 60000, dueDate: null, issueDate: d("2026-08-20") }], asOf);
    expect(b.d1_30).toBe(60000); // 12 hari sejak issue
  });
  it("campuran → total = jumlah semua", () => {
    const b = bucketAging([
      { amount: 100000, dueDate: d("2026-09-15"), issueDate: d("2026-09-01") },
      { amount: 50000, dueDate: d("2026-08-22"), issueDate: d("2026-08-01") },
      { amount: 90000, dueDate: d("2026-01-01"), issueDate: d("2026-01-01") },
    ], asOf);
    expect(b.total).toBe(240000);
    expect(b.current).toBe(100000);
    expect(b.d1_30).toBe(50000);
    expect(b.d90plus).toBe(90000);
  });
  it("kosong → semua 0", () => {
    const b = bucketAging([], asOf);
    expect(b.total).toBe(0);
  });
});
