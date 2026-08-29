import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/billing/config", () => ({ getBillingPolicy: vi.fn() }));
vi.mock("@/lib/services/dunning-service", () => ({ purgeTenantData: vi.fn() }));
import { decideInactivityAction } from "../src/lib/services/inactivity-sweeper-service";

/** Sweeper akun tidak aktif — keputusan MURNI. Ambang uji: R1=30, R2=45, DEL=52. */
const cfg = { r1: 30, r2: 45, del: 52 };
const decide = (idleDays: number, stage: number, exempt = false) =>
  decideInactivityAction({ idleDays, stage, exempt, ...cfg });

describe("decideInactivityAction", () => {
  it("masih aktif (< R1), belum pernah diperingatkan → none", () => {
    expect(decide(10, 0)).toBe("none");
  });
  it("aktif kembali setelah pernah diperingatkan → reset", () => {
    expect(decide(5, 1)).toBe("reset");
    expect(decide(5, 2)).toBe("reset");
  });
  it("idle >= R1, stage 0 → reminder1", () => {
    expect(decide(30, 0)).toBe("reminder1");
    expect(decide(40, 0)).toBe("reminder1");
  });
  it("reminder1 sudah terkirim, belum sampai R2 → none (tak dobel)", () => {
    expect(decide(35, 1)).toBe("none");
  });
  it("idle >= R2, stage 1 → reminder2", () => {
    expect(decide(45, 1)).toBe("reminder2");
    expect(decide(50, 1)).toBe("reminder2");
  });
  it("idle >= R2, stage 0 (lompat) → reminder2", () => {
    expect(decide(46, 0)).toBe("reminder2");
  });
  it("reminder2 sudah terkirim, belum sampai DEL → none", () => {
    expect(decide(48, 2)).toBe("none");
  });
  it("idle >= DEL → delete", () => {
    expect(decide(52, 2)).toBe("delete");
    expect(decide(60, 1)).toBe("delete");
    expect(decide(100, 0)).toBe("delete");
  });
  it("PENGECUALIAN: exempt selalu aman (none walau idle tinggi)", () => {
    expect(decide(80, 0, true)).toBe("none");
    expect(decide(200, 0, true)).toBe("none");
  });
  it("exempt + pernah diperingatkan → reset (bersihkan penanda)", () => {
    expect(decide(80, 1, true)).toBe("reset");
  });
  it("idle Infinity (tak ada aktivitas sama sekali) → delete bila lewat DEL", () => {
    expect(decide(Infinity, 0)).toBe("delete");
  });
});
