import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REGRESSION — F3: jejak alert tak boleh "pasti" tapi tak terlihat, dan email
 * alert tak boleh hilang permanen.
 *
 * CACAT 1 (terbukti): `alertJobFailure` menulis baris `PlatformAuditLog`
 * SEBELUM mencoba email, dan dedupe harian memakai baris audit itu. Bila
 * SMTP gagal sesaat (atau env belum lengkap) pada percobaan pertama, baris
 * audit SUDAH ada ⇒ percobaan berikutnya pada hari yang sama menganggap
 * "sudah dialerkan" ⇒ email TIDAK PERNAH terkirim sampai ganti hari. Alert
 * cron gagal = kerusakan produksi ⇒ operator boleh tak pernah diberi tahu.
 *
 * CACAT 2 (terbukti): tak ada kode membaca `PlatformAuditLog` untuk ditampilkan
 * di Admin → Notifikasi, padahal komentar service & runbook mengklaim
 * "Admin → Notifikasi membaca PlatformAuditLog". Jejak "pasti" itu實際
 * tak terlihat operator; hanya bisa dilihat lewat psql.
 *
 * YANG DIKUNCI DI SINI:
 * 1. Alert pertama hari ini: jejak audit + email.
 * 2. Email gagal (SMTP down) ⇒ JEJAK AUDIT tetap ada, dan alert berikutnya
 *    pada hari yang sama MAYA lalu mencoba email lagi (tak ada email hilang
 *    permanen).
 * 3. Email SUDAH terkirim ⇒ alert berikutnya pada hari yang sama tak
 *    mengirim email lagi (anti-spam tetap berlaku).
 * 4. Tak ada admin aktif ⇒ tak ada email, tak ada error.
 * 5. Jejak audit dalam hitungan menit => "sudah dialerkan" bila email sukses.
 * 6. Admin bisa MEMBACA jejak alert (listAlerts) tanpa menulis apa pun.
 */

vi.mock("server-only", () => ({}));

const {
  auditFindFirst, auditFindMany, auditCreate, adminFindMany,
} = vi.hoisted(() => ({
  auditFindFirst: vi.fn(),
  auditFindMany: vi.fn(),
  auditCreate: vi.fn(),
  adminFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformAuditLog: { findFirst: auditFindFirst, findMany: auditFindMany, create: auditCreate },
    platformAdmin: { findMany: adminFindMany },
    platformNotification: { create: vi.fn() },
  },
}));

const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/email/smtp", () => ({
  sendEmail,
  isEmailConfigured: () => true,
}));

import { alertJobFailure, listJobAlerts } from "../src/lib/services/job-alert-service";

const DAY = "2026-10-29";

describe("alert kegagalan job — jejak tak boleh hilang, email tak boleh hilang permanen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditFindFirst.mockResolvedValue(null);
    auditCreate.mockResolvedValue({ id: "a1" });
    adminFindMany.mockResolvedValue([{ email: "ops@example.com" }]);
    sendEmail.mockResolvedValue({ ok: true, messageId: "m1" });
  });

  it("alert pertama hari ini ⇒ jejak audit + email terkirim", async () => {
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.audited).toBe(true);
    expect(r.emailed).toBe(1);
    // 2 baris audit: jejak kegagalan + marker "email terkirim".
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("SMTP gagal ⇒ jejak audit tetap ada dan email dicoba lagi pada percobaan berikutnya", async () => {
    // Percobaan 1: jejak alert tertulis, email GAGAL ⇒ marker "email terkirim"
    // TIDAK ditulis (kode hanya menulis marker bila SEMUA admin menerima).
    sendEmail.mockResolvedValueOnce({ ok: false, error: "smtp down" });
    const first = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(first.audited).toBe(true);
    expect(first.emailed).toBe(0);
    expect(first.problems.join(" ")).toContain("smtp down");
    const markerTargets = auditCreate.mock.calls.map((c) => c[0].data.target);
    expect(markerTargets).toContain("job-failure:dunning:purge:2026-10-29");
    expect(markerTargets).not.toContain("job-failure-email-delivered:dunning:purge:2026-10-29");

    // Percobaan 2 di hari yang sama: jejak alert SUDAH ada (dedupe jejak),
    // tapi marker email belum ⇒ email WAJIB dicoba lagi (tak ada email hilang).
    auditFindFirst.mockImplementation(async ({ where }: { where: { target?: unknown } }) => {
      const target = where.target as string;
      if (target.startsWith("job-failure-email-delivered:")) return null;
      return { id: "a1" };
    });
    const second = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(second.emailed).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("email SUDAH terkirim ⇒ percobaan berikutnya tak email lagi (anti-spam)", async () => {
    await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    // Penanda email-delivered sudah tertulis ⇒ jangan email ulang.
    auditFindFirst.mockImplementation(async ({ where }: { where: { target?: unknown } }) => {
      const target = where.target as string;
      if (target.startsWith("job-failure-email-delivered:")) return { id: "m1" };
      return { id: "a1" };
    });
    const second = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(second.emailed).toBe(0);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    // Jejak audit tetap dianggap ada (operator tetap bisa melihat).
    expect(second.audited).toBe(true);
  });

  it("tak ada admin aktif ⇒ tak ada email dan tak ada error", async () => {
    adminFindMany.mockResolvedValue([]);
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.audited).toBe(true);
    expect(r.emailed).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("kedua admin aktif menerima alert", async () => {
    adminFindMany.mockResolvedValue([{ email: "a@example.com" }, { email: "b@example.com" }]);
    const r = await alertJobFailure({ job: "dunning", stage: "purge", error: "db down" });
    expect(r.emailed).toBe(2);
  });

  it("listJobAlerts membaca jejak alert tanpa menulis apa pun", async () => {
    auditFindMany.mockResolvedValue([
      {
        id: "a1",
        actor: "system:job-alert",
        action: "JOB_FAILURE_ALERT",
        target: "job-failure:dunning:purge:2026-10-29",
        metadata: { job: "dunning", stage: "purge", error: "db down" },
        createdAt: new Date("2026-10-29T03:16:41.000Z"),
      },
    ]);
    const rows = await listJobAlerts(20);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "JOB_FAILURE_ALERT", target: "job-failure:dunning:purge:2026-10-29" });
    expect(rows[0].createdAt).toBeInstanceOf(Date);
    expect(auditCreate).not.toHaveBeenCalled();
  });
});
