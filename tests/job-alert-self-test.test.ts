import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION — F3: self-test alert email (tombol "Uji Alert Email" di Admin).
 *
 * Aturan yang dikunci:
 * 1. Hanya admin platform yang boleh memicu (server action memanggil
 *    requirePlatformAdmin — dimock di sini).
 * 2. Self-test memakai JALUR YANG SUDAH ADA (`alertJobFailure`), job sintetis
 *    "self-test" — bukan cron sungguhan, bukan missed-run, bukan alert palsu.
 * 3. Tidak menyentuh tenant/pelanggan/antrean: hanya jejak audit PlatformAuditLog
 *    + email ke admin platform aktif.
 * 4. Error dikembalikan sebagai pesan, tak pernah melempar.
 * 5. Kegagalan alert (email tak terkirim) ⇒ hasil "gagal" yang jujur, bukan
 *    klaim sukses.
 */
vi.mock("server-only", () => ({}));
const { admin, alertJobFailure } = vi.hoisted(() => ({
  admin: vi.fn(async () => ({ email: "admin@example.test" })),
  alertJobFailure: vi.fn(async (_input: Record<string, unknown>) => ({
    audited: true, emailed: 2, problems: [] as string[],
  })),
}));
vi.mock("@/lib/auth/platform-admin", () => ({ requirePlatformAdmin: admin }));
vi.mock("@/lib/services/job-alert-service", () => ({ alertJobFailure }));

import { actionSelfTestJobAlert } from "../src/app/admin/notifikasi/actions";

describe("self-test alert email (F3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    admin.mockResolvedValue({ email: "admin@example.test" } as never);
    alertJobFailure.mockResolvedValue({ audited: true, emailed: 2, problems: [] } as never);
  });

  it("memakai alertJobFailure dengan job sintetis self-test (bukan cron nyata)", async () => {
    const r = await actionSelfTestJobAlert();
    expect(r.ok, JSON.stringify(r)).toBe(true);
    expect(r.emailed).toBe(2);
    expect(alertJobFailure).toHaveBeenCalledTimes(1);
    const input = alertJobFailure.mock.calls[0][0] as Record<string, unknown>;
    expect(input.job).toBe("self-test");
    expect(String(input.error)).toMatch(/SELF-TEST/i);
    expect((input.details as Record<string, unknown>).selfTest).toBe(true);
  });

  it("menolak bila bukan admin platform", async () => {
    admin.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const r = await actionSelfTestJobAlert();
    expect(r.ok).toBe(false);
    expect(alertJobFailure).not.toHaveBeenCalled();
  });

  it("email tak terkirim ⇒ hasil gagal yang jujur, tak klaim sukses", async () => {
    alertJobFailure.mockResolvedValueOnce({
      audited: true, emailed: 0, problems: ["email ops@example.test: smtp down"],
    } as never);
    const r = await actionSelfTestJobAlert();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/smtp down/);
  });

  it("tak ada admin aktif ⇒ hasil gagal dengan alasan jelas", async () => {
    alertJobFailure.mockResolvedValueOnce({
      audited: true, emailed: 0, problems: [],
    } as never);
    const r = await actionSelfTestJobAlert();
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/admin|SMTP/i);
  });
});
