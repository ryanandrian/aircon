import { describe, it, expect } from "vitest";
import { PLATFORM_TEMPLATES, platformTemplateVariables, renderPlatformTemplate } from "../src/lib/domain/platform-templates";

describe("PLATFORM_TEMPLATES — Aircon → tenant", () => {
  it("semua template punya subject/body/label dan known required vars", () => {
    for (const [key, tpl] of Object.entries(PLATFORM_TEMPLATES)) {
      expect(tpl.subject, `${key}.subject`).toBeTruthy();
      expect(tpl.body, `${key}.body`).toBeTruthy();
      expect(tpl.label, `${key}.label`).toBeTruthy();
      expect(tpl.requiredVars.length, `${key}.requiredVars`).toBeGreaterThan(0);
      expect(tpl.requiredVars.every((v) => platformTemplateVariables(tpl).includes(v))).toBe(true);
    }
  });

  it("Basic welcome menerangkan manual; tidak meminta sambung WA", () => {
    const { body } = renderPlatformTemplate("welcome_basic", {
      app: "Aircon", tenant: "Sejuk Abadi", link: "https://app.airconet.id/app/langganan",
    });
    expect(body).toContain("gratis selamanya");
    expect(body).toContain("manual");
    expect(body).toContain("Professional dan Business");
    expect(body).not.toMatch(/sambungkan nomor WhatsApp/i);
    expect(body).not.toContain("{{");
  });

  it("paid welcome meminta sambung WA dan menyebut otomatis setelah koneksi ready", () => {
    const { body } = renderPlatformTemplate("welcome_paid", {
      app: "Aircon", tenant: "Sejuk Abadi", paket: "Professional", link: "https://app.airconet.id/app/pengaturan/wa-connect",
    });
    expect(body).toContain("Professional");
    expect(body).toContain("otomatis");
    expect(body).toContain("tersambung");
    expect(body).not.toContain("{{");
  });

  it("subscription_due memerlukan paket, nominal, tanggal, dan link — tak ada placeholder kosong", () => {
    const { body } = renderPlatformTemplate("subscription_due", {
      app: "Aircon", tenant: "AC Jaya", paket: "Professional", tanggal: "5 Oktober 2026",
      nominal: "Rp149.000", link: "https://app.airconet.id/app/langganan",
    });
    expect(body).toContain("Professional");
    expect(body).toContain("Rp149.000");
    expect(body).toContain("5 Oktober 2026");
    expect(body).not.toContain("{{");
  });

  it("subscription_overdue berisi paket, nominal, tanggal, link", () => {
    const { body } = renderPlatformTemplate("subscription_overdue", {
      app: "Aircon", tenant: "AC Jaya", paket: "Business", tanggal: "5 Oktober 2026",
      nominal: "Rp499.000", link: "https://app.airconet.id/app/langganan",
    });
    expect(body).toContain("Business");
    expect(body).toContain("Rp499.000");
    expect(body).toContain("5 Oktober 2026");
    expect(body).not.toContain("{{");
  });

  it("render ditolak saat placeholder wajib kosong", () => {
    expect(() => renderPlatformTemplate("subscription_due", {
      app: "Aircon", tenant: "AC Jaya", paket: "Professional", tanggal: "5 Oktober 2026", link: "https://x",
    })).toThrow(/nominal/);
  });

  it("Basic tidak punya template trial ending", () => {
    expect(PLATFORM_TEMPLATES).not.toHaveProperty("trial_ending");
  });

  it("payment_failed menegaskan paket TIDAK berubah aktif", () => {
    const { body } = renderPlatformTemplate("payment_failed", {
      app: "Aircon", tenant: "AC Jaya", paket: "Professional",
      nominal: "Rp149.000", tanggal: "27 Oktober 2026",
      link: "https://app.airconet.id/app/langganan",
    });
    expect(body).toContain("tidak berubah menjadi aktif");
    expect(body).toContain("Rp149.000");
    expect(body).toContain("https://app.airconet.id/app/langganan");
    expect(body).not.toMatch(/paket.*aktif\.|lunas|berhasil/i);
    expect(body).not.toContain("{{");
  });

  it("payment_expired tidak mengklaim pembayaran lunas", () => {
    const { body } = renderPlatformTemplate("payment_expired", {
      app: "Aircon", tenant: "AC Jaya", paket: "Business",
      nominal: "Rp499.000", tanggal: "27 Oktober 2026",
      link: "https://app.airconet.id/app/langganan",
    });
    expect(body).toContain("kedaluwarsa");
    expect(body).toContain("tidak berubah menjadi aktif");
    expect(body).toContain("Business");
    expect(body).not.toContain("{{");
  });

  it("payment_failed/expired menolak render tanpa nominal", () => {
    expect(() => renderPlatformTemplate("payment_failed", {
      app: "Aircon", tenant: "AC Jaya", paket: "Professional",
      tanggal: "27 Oktober 2026", link: "https://x",
    })).toThrow(/nominal/);
  });


  it("semua 27 key katalog memiliki producer eksplisit dan kategori tenant/mitra lengkap", async () => {
    const { PARTNER_TEMPLATE_KEYS, isPartnerTemplate } = await import(
      "../src/lib/domain/platform-templates"
    );
    const { TENANT_COPY_KEYS } = await import("../src/lib/domain/tenant-copy");
    const catalogKeys = Object.keys(PLATFORM_TEMPLATES).sort();
    expect(catalogKeys).toHaveLength(27);
    expect(new Set(catalogKeys).size).toBe(27);
    expect([...PARTNER_TEMPLATE_KEYS].sort()).toEqual(
      catalogKeys.filter((key) => key.startsWith("partner_")).sort(),
    );
    expect(PARTNER_TEMPLATE_KEYS).toHaveLength(10);
    expect([...TENANT_COPY_KEYS].sort()).toEqual(
      catalogKeys.filter((key) => key.startsWith("tenant_")).sort(),
    );
    expect(TENANT_COPY_KEYS).toHaveLength(4);
    for (const key of catalogKeys) {
      expect(isPartnerTemplate(key as keyof typeof PLATFORM_TEMPLATES)).toBe(key.startsWith("partner_"));
    }
  });
});
