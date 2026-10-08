import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * T3c — Isolasi kegagalan per tenant.
 *
 * Mengapa perlu: route cron dunning menjalankan (1) runDunningCycle (2) purgeMarkedTenants
 * (3) runInactivitySweep (4) flush WA (5) platform notify DALAM SATU try/catch.
 * Sebelum T3c, satu purgeTenantData gagal melempar → seluruh request 500 → langkah 4 & 5
 * gugur hari itu, berulang tiap hari selama kandidatnya ada.
 *
 * Bukti yang dibutuhkan: purgeMarkedTenants TIDAK PERNAH melempar akibat kegagalan
 * 1 tenant; loop tetap memproses kandidat berikutnya; hasilnya mencatat keduanya.
 */
vi.mock("@/lib/prisma", () => {
  // Setiap prisma.<model>.deleteMany harus mengembalikan promise supaya array argumen
  // $transaction bisa dibentuk (dunia nyata: prisma client). Tanpa ini kegagalan terjadi
  // SEBELUM $transaction dan semua kandidat tampak gagal — menutupi perilaku yang diuji.
  const silentModel = () => ({ deleteMany: () => Promise.resolve({ count: 0 }) });
  const target: Record<string, unknown> = {
    // tenant butuh delete juga: purgeTenantData memanggil prisma.tenant.delete(...)
    // SEBELUM $transaction — tanpa method ini kedua kandidat gagal dengan TypeError
    // dan menutupi perilaku isolasi yang diuji.
    tenant: { findMany: vi.fn(), delete: vi.fn(async () => ({})) },
    $transaction: vi.fn(),
  };
  const prisma: Record<string, unknown> = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop as string];
      return silentModel(); // model apa pun di luar yang didefinisikan
    },
  });
  return { prisma };
});

const T_BAIK = { id: "t_baik", name: "Tenant Baik" };
const T_GAGAL = { id: "t_gagal", name: "Tenant Gagal" };

async function svc() {
  return await import("../src/lib/services/dunning-service");
}

describe("purgeMarkedTenants — isolasi kegagalan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1 kandidat gagal → TIDAK melempar, kandidat lain tetap diproses, keduanya tercatat", async () => {
    const { prisma } = (await import("@/lib/prisma")) as unknown as {
      prisma: { tenant: { findMany: ReturnType<typeof vi.fn> } };
    };
    prisma.tenant.findMany.mockResolvedValue([T_GAGAL, T_BAIK]);

    // $transaction dipanggil sekali per tenant (purgeTenantData). Kandidat ke-1 gagal,
    // ke-2 sukses — meniru FK RESTRICT di tenant pertama.
    let call = 0;
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mockImplementation(
      async () => {
        call += 1;
        if (call === 1) throw new Error("FK violation RESTRICT");
        return [];
      },
    );

    const { purgeMarkedTenants } = await svc();
    const res = await purgeMarkedTenants(new Date("2026-10-08T00:00:00Z"), 24);

    // Tidak melempar → pemanggil cron (flush WA + platform notify) di bawahnya tetap aman.
    expect(res.failed).toBe(1);
    expect(res.purged).toBe(1);
    expect(res.tenantIds).toEqual([T_BAIK.id]);
    expect(call).toBe(2); // loop lanjut ke kandidat ke-2 (bukan berhenti)
  });

  it("semua gagal → tetap tidak melempar, hasil jelas", async () => {
    const { prisma } = (await import("@/lib/prisma")) as unknown as {
      prisma: { tenant: { findMany: ReturnType<typeof vi.fn> } };
    };
    prisma.tenant.findMany.mockResolvedValue([T_GAGAL]);
    (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction.mockRejectedValue(
      new Error("FK violation"),
    );

    const { purgeMarkedTenants } = await svc();
    const res = await purgeMarkedTenants(new Date("2026-10-08T00:00:00Z"), 24);
    expect(res).toEqual({ purged: 0, failed: 1, tenantIds: [] });
  });

  it("tidak ada kandidat → hasil bersih tanpa pemanggilan transaksi", async () => {
    const { prisma } = (await import("@/lib/prisma")) as unknown as {
      prisma: { tenant: { findMany: ReturnType<typeof vi.fn> } };
    };
    prisma.tenant.findMany.mockResolvedValue([]);

    const { purgeMarkedTenants } = await svc();
    const res = await purgeMarkedTenants(new Date("2026-10-08T00:00:00Z"), 24);
    expect(res).toEqual({ purged: 0, failed: 0, tenantIds: [] });
    expect(
      (prisma as unknown as { $transaction: ReturnType<typeof vi.fn> }).$transaction,
    ).not.toHaveBeenCalled();
  });

  it("filter keamanan dipertahankan: hanya marked > ambang & SUSPENDED", async () => {
    const { prisma } = (await import("@/lib/prisma")) as unknown as {
      prisma: { tenant: { findMany: ReturnType<typeof vi.fn> } };
    };
    prisma.tenant.findMany.mockResolvedValue([]);

    const { purgeMarkedTenants } = await svc();
    await purgeMarkedTenants(new Date("2026-10-08T12:00:00Z"), 24);

    const arg = prisma.tenant.findMany.mock.calls[0][0] as {
      where: { markedForDeletionAt: { lt: Date }; status: string };
    };
    expect(arg.where.status).toBe("SUSPENDED");
    expect(arg.where.markedForDeletionAt.lt.getTime()).toBe(
      new Date("2026-10-08T12:00:00Z").getTime() - 24 * 3600 * 1000,
    );
  });
});
