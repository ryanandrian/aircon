import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (F4 — notifikasi agent/reseller).
//
// Yang dijaga:
//  - Notifikasi mitra membungkus EMAIL di antrean `PlatformNotification` yang
//    SAMA (bukan mailer terpisah) ⇒ satu lease/dedupe/kill switch.
//  - Email mitra tak punya tenantId (tak ada tenant dipalsukan); target lewat
//    agentId/resellerId.
//  - In-app inbox lewat `PartnerNotification` terpisah (mitra bukan tenant).
//  - Idempoten: dedupe per event (ledgerId / payoutId / resellerId).
//  - Privasi: tak ada nomor rekening / data pelanggan di isi notifikasi.
//  - Akrual komisi bukan janji payout (copy menyatakan pencatatan).
//  - Kegagalan notifikasi tak menggagalkan operasi bisnis.

vi.mock("server-only", () => ({}));

const {
  pnCreate, pnCount, partnerNotifCreate, partnerNotifCount,
  agentFindUnique, resellerFindUnique, templateFindUnique, auditCreate, ledgerFindFirst,
} = vi.hoisted(() => ({
  pnCreate: vi.fn(), pnCount: vi.fn(), partnerNotifCreate: vi.fn(), partnerNotifCount: vi.fn(),
  agentFindUnique: vi.fn(), resellerFindUnique: vi.fn(), templateFindUnique: vi.fn(),
  auditCreate: vi.fn(), ledgerFindFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    platformNotification: { create: pnCreate, count: pnCount },
    partnerNotification: { create: partnerNotifCreate, count: partnerNotifCount },
    agent: { findUnique: agentFindUnique },
    reseller: { findUnique: resellerFindUnique },
    platformTemplate: { findUnique: templateFindUnique },
    platformAuditLog: { create: auditCreate },
  },
}));

import {
  notifyPartner, loadPartnerTarget, listPartnerNotifications,
  countUnreadPartnerNotifications, markPartnerNotificationRead,
} from "../src/lib/services/partner-notification-service";
import { notifyCommissionAccrued, notifyPayoutPaid, notifyTenantAttributed } from "../src/lib/services/partner-notification-hooks";

describe("notifikasi mitra — email lewat antrean platform (F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templateFindUnique.mockResolvedValue(null); // default dari kode
    pnCreate.mockResolvedValue({ id: "pn1" });
    partnerNotifCreate.mockResolvedValue({ id: "pnn1" });
    agentFindUnique.mockResolvedValue({ id: "a1", companyName: "CV Mitra", picEmail: "mitra@x.id" });
    resellerFindUnique.mockResolvedValue({ id: "r1", name: "Reseller X", email: "reseller@x.id" });
  });

  it("email mitra: tenantId NULL, target via agentId/resellerId, channel EMAIL", async () => {
    const r = await notifyPartner(
      { kind: "agent", id: "a1", name: "CV Mitra", email: "mitra@x.id" },
      "partner_agent_invited",
      { link: "https://app.airconet.id/agen/aktivasi/tok" },
      { dedupeKey: "agent_invited:a1:1" },
    );
    expect(r.emailCreated).toBe(1);
    const data = pnCreate.mock.calls[0][0].data;
    expect(data.tenantId).toBeNull();
    expect(data.agentId).toBe("a1");
    expect(data.resellerId).toBeNull();
    expect(data.partnerKind).toBe("agent");
    expect(data.channel).toBe("EMAIL");
    expect(data.toAddress).toBe("mitra@x.id");
    expect(data.dedupeKey).toContain("partner:");
    expect(data.body).not.toContain("{{");
  });

  it("reseller: resellerId terisi, agentId NULL", async () => {
    await notifyPartner(
      { kind: "reseller", id: "r1", name: "Reseller X", email: "reseller@x.id" },
      "partner_reseller_approved",
      { kode: "ABC123", link: "https://app.airconet.id/reseller/aktivasi/tok" },
      { dedupeKey: "reseller_approved:r1:ABC123" },
    );
    const data = pnCreate.mock.calls[0][0].data;
    expect(data.resellerId).toBe("r1");
    expect(data.agentId).toBeNull();
    expect(data.partnerKind).toBe("reseller");
  });

  it("tanpa email → email dilewati, in-app tetap dibuat", async () => {
    const r = await notifyPartner(
      { kind: "reseller", id: "r1", name: "Tanpa Email", email: null },
      "partner_reseller_rejected",
      {},
      { dedupeKey: "x", inapp: { type: "RESELLER_REJECTED", title: "Ditolak", body: "Hubungi agen." } },
    );
    expect(r.emailCreated).toBe(0);
    expect(r.inappCreated).toBe(1);
    expect(r.skipped.some((s) => s.includes("email"))).toBe(true);
  });

  it("P2002 (duplikat) → dianggap dedupe, bukan error fatal", async () => {
    pnCreate.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await notifyPartner(
      { kind: "agent", id: "a1", name: "CV Mitra", email: "mitra@x.id" },
      "partner_agent_invited", { link: "https://x/y" }, { dedupeKey: "agent_invited:a1:1" },
    );
    expect(r.emailCreated).toBe(0);
    expect(r.skipped.some((s) => s.includes("dedupe"))).toBe(true);
  });

  it("copy template diedit admin dipakai (snapshot di baris antrean)", async () => {
    templateFindUnique.mockResolvedValue({
      key: "partner_agent_invited", subject: "Judul Baru", body: "Halo {{nama}}, tautan {{link}}",
      version: 2, updatedBy: "admin@x.id",
    });
    await notifyPartner(
      { kind: "agent", id: "a1", name: "CV Mitra", email: "mitra@x.id" },
      "partner_agent_invited", { link: "https://x/y" }, { dedupeKey: "k" },
    );
    const data = pnCreate.mock.calls[0][0].data;
    expect(data.subject).toBe("Judul Baru");
    expect(data.body).toContain("CV Mitra");
  });
});

describe("privasi notifikasi mitra (F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    templateFindUnique.mockResolvedValue(null);
    pnCreate.mockResolvedValue({ id: "pn1" });
    partnerNotifCreate.mockResolvedValue({ id: "pnn1" });
    agentFindUnique.mockResolvedValue({ id: "a1", companyName: "CV Mitra", picEmail: "mitra@x.id" });
    resellerFindUnique.mockResolvedValue({ id: "r1", name: "Reseller X", email: "reseller@x.id" });
  });

  it("akrual komisi: menyebut 'pencatatan, bukan pembayaran' & tak menyebut rekening", async () => {
    await notifyCommissionAccrued({
      ledgerId: 77, agentId: "a1", resellerId: null,
      agentAmountIdr: 125000, resellerAmountIdr: 0, periodMonth: new Date(Date.UTC(2026, 9, 1)),
    });
    const email = pnCreate.mock.calls[0][0].data;
    expect(email.body).toContain("Rp 125.000");
    expect(email.body).toContain("pencatatan");
    const inapp = partnerNotifCreate.mock.calls[0][0].data;
    expect(inapp.body).toContain("belum pembayaran");
    expect(inapp.body).not.toMatch(/rekening|bank|account/i);
    expect(inapp.body).not.toMatch(/\d{9,}/); // tak ada nomor rekening
  });

  it("tenant terattribusi: hanya nama+status tenant, tanpa kontak pelanggan", async () => {
    await notifyTenantAttributed({
      tenantId: "t1", tenantName: "CV warned", tenantStatus: "ACTIVE",
      agentId: "a1", resellerId: null, code: "ABC123",
    });
    const email = pnCreate.mock.calls[0][0].data;
    expect(email.body).toContain("CV warned");
    expect(email.body).toContain("ACTIVE");
    expect(email.body).not.toMatch(/wa\.me|@gmail|62\d{8,}/);
  });

  it("payout paid: menyebut referensi transfer, bukan rekening", async () => {
    await notifyPayoutPaid({
      payoutId: "p1", agentId: "a1", periodMonth: new Date(Date.UTC(2026, 9, 1)),
      netPaidIdr: 500000, transferRef: "TRX-123",
    });
    const email = pnCreate.mock.calls[0][0].data;
    expect(email.body).toContain("TRX-123");
    expect(email.body).toContain("Rp 500.000");
    expect(email.body).not.toMatch(/rekening/i);
  });
});

describe("inbox in-app mitra — isolasi (F4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    partnerNotifCount.mockResolvedValue(0);
  });

  it("loadPartnerTarget: agen ambil picEmail, reseller ambil email", async () => {
    const a = await loadPartnerTarget("agent", "a1");
    expect(a?.email).toBe("mitra@x.id");
    const r = await loadPartnerTarget("reseller", "r1");
    expect(r?.email).toBe("reseller@x.id");
  });

  it("listPartnerNotifications untuk reseller memfilter resellerId", async () => {
    const prismaFind = vi.fn().mockResolvedValue([]);
    // prisma mock di atas tak punya partnerNotification.findMany; pakai spy
    const mod = await import("@/lib/prisma");
    (mod.prisma.partnerNotification as unknown as { findMany: unknown }).findMany = prismaFind;
    await listPartnerNotifications("reseller", "r1");
    expect(prismaFind).toHaveBeenCalledWith(expect.objectContaining({
      where: { resellerId: "r1" },
    }));
  });

  it("markPartnerNotificationRead: updateMany ter-scope ke mitra tsb", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const mod = await import("@/lib/prisma");
    (mod.prisma.partnerNotification as unknown as { updateMany: unknown }).updateMany = updateMany;
    const ok = await markPartnerNotificationRead("agent", "a1", "n1");
    expect(ok).toBe(true);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "n1", agentId: "a1" },
    }));
  });

  it("countUnread: hanya belum dibaca milik mitra tsb", async () => {
    const mod = await import("@/lib/prisma");
    (mod.prisma.partnerNotification as unknown as { count: unknown }).count = partnerNotifCount;
    await countUnreadPartnerNotifications("reseller", "r1");
    expect(partnerNotifCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { resellerId: "r1", readAt: null },
    }));
  });
});
