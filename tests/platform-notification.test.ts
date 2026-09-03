import { describe, it, expect } from "vitest";
import { PLATFORM_TEMPLATES } from "../src/lib/domain/platform-templates";
import { renderTemplate } from "../src/lib/wa/gateway";

describe("PLATFORM_TEMPLATES — notifikasi platform Lumite→tenant", () => {
  it("semua template punya subject, body, label", () => {
    for (const [key, t] of Object.entries(PLATFORM_TEMPLATES)) {
      expect(t.subject, `${key}.subject`).toBeTruthy();
      expect(t.body, `${key}.body`).toBeTruthy();
      expect(t.label, `${key}.label`).toBeTruthy();
    }
  });

  it("render subscription_due mengisi placeholder", () => {
    const t = PLATFORM_TEMPLATES.subscription_due;
    const body = renderTemplate(t.body, {
      app: "Aircon", tenant: "AC Jaya", paket: "Pro", tanggal: "5 September 2026",
      nominal: "Rp99.000", link: "https://x",
    });
    expect(body).toContain("AC Jaya");
    expect(body).toContain("5 September 2026");
    expect(body).not.toContain("{{"); // tak ada placeholder tersisa
  });

  it("wa_disconnected mengarahkan ke Pengaturan (money-loop recovery)", () => {
    const body = renderTemplate(PLATFORM_TEMPLATES.wa_disconnected.body, { app: "Aircon", tenant: "AC Jaya" });
    expect(body.toLowerCase()).toContain("hubungkan");
    expect(body).not.toContain("{{");
  });

  it("welcome menyapa tenant + ajak connect WA", () => {
    const body = renderTemplate(PLATFORM_TEMPLATES.welcome.body, { app: "Aircon", tenant: "Sejuk Abadi" });
    expect(body).toContain("Sejuk Abadi");
    expect(body.toLowerCase()).toContain("whatsapp");
  });
});
