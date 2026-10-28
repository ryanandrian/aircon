import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F5 versioning/rollback + F3/G30 kill switch).
//
//  - Setiap simpan copy template menulis SATU baris riwayat versi.
//  - Rollback menyalin isi versi lama ke baris aktif; versi aktif NAIK lagi
//    (nomor versi tak pernah dipakai ulang) dan copy hasil rollback divalidasi.
//  - Kill switch: saat off, dispatcher MENAH (tak ada yang dikirim, antrean tetap
//    QUEUED, tak ada recovery stale).

vi.mock("server-only", () => ({}));

const {
  tmplUpsert, tmplDeleteMany, revCreate, revFindUnique, revFindMany, auditCreate,
  infraFindUnique, infraUpsert, pnFindMany, pnUpdateMany, pnCount,
} = vi.hoisted(() => ({
  tmplUpsert: vi.fn(), tmplDeleteMany: vi.fn(), revCreate: vi.fn(), revFindUnique: vi.fn(),
  revFindMany: vi.fn(), auditCreate: vi.fn(), infraFindUnique: vi.fn(), infraUpsert: vi.fn(),
  pnFindMany: vi.fn(), pnUpdateMany: vi.fn(), pnCount: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformTemplate: { upsert: tmplUpsert, deleteMany: tmplDeleteMany },
    platformTemplateRevision: { create: revCreate, findUnique: revFindUnique, findMany: revFindMany },
    platformAuditLog: { create: auditCreate },
    infraConfig: { findUnique: infraFindUnique, upsert: infraUpsert },
    platformNotification: { findMany: pnFindMany, updateMany: pnUpdateMany, count: pnCount },
  },
}));

import { saveTemplate, rollbackTemplate, listTemplateRevisions } from "../src/lib/services/platform-template-service";
import { isNotifySendEnabled, setNotifySendEnabled } from "../src/lib/services/infra-config-service";

describe("versioning & rollback template (F5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revCreate.mockResolvedValue({});
    auditCreate.mockResolvedValue({});
    tmplUpsert.mockResolvedValue({ key: "subscription_due", subject: "S", body: "B", version: 3 });
  });

  it("simpan → riwayat versi ditulis (versi sama dgn baris aktif)", async () => {
    const r = await saveTemplate("subscription_due", {
      subject: "Tagihan {{app}} jatuh tempo {{tanggal}}",
      body: "Halo {{tenant}}, paket {{paket}} sebesar {{nominal}} jatuh tempo {{tanggal}}. Bayar: {{link}}.",
    }, "admin@x.id");
    expect(r.ok).toBe(true);
    expect(revCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ key: "subscription_due", version: 3, actor: "admin@x.id" }),
    }));
  });

  it("rollback: isi versi lama disalin, versi aktif NAIK (tak ada nomor dipakai ulang)", async () => {
    const lama = "Halo {{tenant}}, paket {{paket}} sebesar {{nominal}} jatuh tempo {{tanggal}}. Bayar: {{link}}.";
    revFindUnique.mockResolvedValue({ key: "subscription_due", subject: "Lama", body: lama, version: 1 });
    tmplUpsert.mockResolvedValue({ key: "subscription_due", subject: "Lama", body: lama, version: 7 });
    const r = await rollbackTemplate("subscription_due", 1, "admin@x.id");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe(7);
    const upd = tmplUpsert.mock.calls[0][0];
    expect(upd.update.body).toContain("{{tenant}}");
    expect(upd.update.version).toEqual({ increment: 1 });
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "PLATFORM_TEMPLATE_ROLLBACK" }),
    }));
  });

  it("rollback ke versi yang tak ada → error jelas, tak ada perubahan", async () => {
    revFindUnique.mockResolvedValue(null);
    const r = await rollbackTemplate("subscription_due", 99, "admin@x.id");
    expect(r.ok).toBe(false);
    expect(tmplUpsert).not.toHaveBeenCalled();
  });

  it("rollback dengan copy rusak (placeholder tak dikenal) DITOLAK", async () => {
    revFindUnique.mockResolvedValue({ key: "subscription_due", subject: "X", body: "Halo {{ngawur}}", version: 1 });
    const r = await rollbackTemplate("subscription_due", 1, "admin@x.id");
    expect(r.ok).toBe(false);
    expect(tmplUpsert).not.toHaveBeenCalled();
  });

  it("daftar riwayat diurutkan versi terbaru dulu", async () => {
    revFindMany.mockResolvedValue([{ id: "r2", version: 2 }, { id: "r1", version: 1 }]);
    const rows = await listTemplateRevisions("subscription_due", 5);
    expect(rows.map((r) => r.version)).toEqual([2, 1]);
    expect(revFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: "subscription_due" }, orderBy: { version: "desc" }, take: 5,
    }));
  });
});

describe("kill switch pengiriman platform (G30)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditCreate.mockResolvedValue({});
    infraUpsert.mockResolvedValue({});
  });

  it("aktif bila tak ada InfraConfig (default aman: boleh kirim)", async () => {
    infraFindUnique.mockResolvedValue(null);
    expect(await isNotifySendEnabled()).toBe(true);
  });

  it("aktif bila notifySendEnabled true", async () => {
    infraFindUnique.mockResolvedValue({ notifySendEnabled: true });
    expect(await isNotifySendEnabled()).toBe(true);
  });

  it("TAHAN bila notifySendEnabled false", async () => {
    infraFindUnique.mockResolvedValue({ notifySendEnabled: false });
    expect(await isNotifySendEnabled()).toBe(false);
  });

  it("matikan → upsert + audit log", async () => {
    await setNotifySendEnabled(false, "admin@x.id");
    expect(infraUpsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ notifySendEnabled: false, updatedBy: "admin@x.id" }),
    }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "NOTIFY_SEND_DISABLE" }),
    }));
  });
});
