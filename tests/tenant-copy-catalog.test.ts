import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G23 — copy dunning/inactivity masuk katalog platform).
//
//  - Sumber copy TUNGGAL: Admin → Notifikasi (katalog `PlatformTemplate`).
//  - Urutan sumber: baris katalog → kolom BillingPolicy (warisan) → default kode.
//    Copy yang sedang terkirim TIDAK berubah hanya karena kode naik versi.
//  - Renderer menerima DUA format: `{x}` (warisan) dan `{{x}}` (katalog).
//  - Validator menerima placeholder ganda; placeholder wajib `{sisa}` tetap
//    dituntut pada template peringatan (dalam kedua format).

vi.mock("server-only", () => ({}));

const { tmplFindUnique } = vi.hoisted(() => ({ tmplFindUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformTemplate: { findUnique: tmplFindUnique } },
}));

import {
  renderTenantCopy, validateTenantCopy, resolveTenantCopy, TENANT_COPY_TO_PLATFORM_KEY,
} from "../src/lib/domain/tenant-copy";

describe("G23 — pemetaan katalog", () => {
  it("4 template tenant dipetakan ke key katalog", () => {
    expect(TENANT_COPY_TO_PLATFORM_KEY.dunningReminderTemplate).toBe("tenant_dunning_reminder");
    expect(TENANT_COPY_TO_PLATFORM_KEY.dunningWarningTemplate).toBe("tenant_dunning_warning");
    expect(TENANT_COPY_TO_PLATFORM_KEY.inactivityReminder1Template).toBe("tenant_inactivity_reminder1");
    expect(TENANT_COPY_TO_PLATFORM_KEY.inactivityReminder2Template).toBe("tenant_inactivity_reminder2");
  });
});

describe("G23 — renderer & validator dua format", () => {
  it("{{x}} dan {x} sama-sama terganti", () => {
    expect(renderTenantCopy("Halo {{nama}} / {nama} / {{telat}}", { nama: "Budi", telat: "3" }))
      .toBe("Halo Budi / Budi / 3");
  });

  it("validasi menerima dua format placeholder yang dikenal", () => {
    expect(validateTenantCopy("dunningReminderTemplate", "Halo {nama}, telat {telat} hari").ok).toBe(true);
    expect(validateTenantCopy("dunningReminderTemplate", "Halo {{nama}}, telat {{telat}} hari").ok).toBe(true);
  });

  it("placeholder tak dikenal tetap DITOLAK di kedua format", () => {
    expect(validateTenantCopy("dunningReminderTemplate", "Halo {ngawur}").ok).toBe(false);
    expect(validateTenantCopy("dunningReminderTemplate", "Halo {{ngawur}}").ok).toBe(false);
  });

  it("warning tanpa {sisa} / {{sisa}} ditolak", () => {
    expect(validateTenantCopy("dunningWarningTemplate", "Halo {{nama}} telat {{telat}}").ok).toBe(false);
    expect(validateTenantCopy("dunningWarningTemplate", "Halo {nama} telat {telat} sisa {sisa}").ok).toBe(true);
  });
});

describe("G23 — resolveTenantCopy urutan sumber", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("baris katalog ADA → dipakai dengan format {{x}}", async () => {
    tmplFindUnique.mockResolvedValue({
      key: "tenant_dunning_reminder", subject: "Pengingat", body: "Halo {{nama}}, menunggak {{telat}} hari.",
    });
    const r = await resolveTenantCopy("dunningReminderTemplate", "POLICY_LAMA {telat}");
    expect(r.source).toBe("katalog");
    expect(r.body).toBe("Halo {{nama}}, menunggak {{telat}} hari.");
  });

  it("baris katalog TAK ada → kolom BillingPolicy (warisan) dipakai", async () => {
    tmplFindUnique.mockResolvedValue(null);
    const r = await resolveTenantCopy("dunningReminderTemplate", "POLICY_LAMA: telat {telat} hari");
    expect(r.source).toBe("policy");
    expect(r.body).toBe("POLICY_LAMA: telat {telat} hari");
  });

  it("katalog kosong + policy kosong → default kode", async () => {
    tmplFindUnique.mockResolvedValue(null);
    const r = await resolveTenantCopy("dunningWarningTemplate", "");
    expect(r.source).toBe("default");
    expect(r.body).toContain("PERINGATAN");
    expect(r.body).toContain("{{sisa}}");
  });

  it("gagal baca DB → fallback ke policy (pesannya tetap terkirim, tidak error)", async () => {
    tmplFindUnique.mockRejectedValue(new Error("db down"));
    const r = await resolveTenantCopy("dunningReminderTemplate", "POLICY_LAMA {telat}");
    expect(r.source).toBe("policy");
    expect(r.body).toBe("POLICY_LAMA {telat}");
  });
});