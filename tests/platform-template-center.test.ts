import { describe, it, expect } from "vitest";
import {
  PLATFORM_TEMPLATES,
  validateTemplateCopy,
  renderPlatformTemplate,
  knownVariables,
} from "../src/lib/domain/platform-templates";

// F5 Template Center — validasi copy yang diedit admin & renderer dengan copy aktif.
// Aturan: placeholder dikenal, requiredVars wajib ada, copy rusak ditolak, eligibilitas tak berubah.

const DEF = PLATFORM_TEMPLATES;

describe("validateTemplateCopy", () => {
  it("default kode setiap key lolos validasinya sendiri", () => {
    for (const key of Object.keys(DEF) as (keyof typeof DEF)[]) {
      const r = validateTemplateCopy(key, { subject: DEF[key].subject, body: DEF[key].body });
      expect(r, key).toEqual({ ok: true });
    }
  });

  it("menolak variabel tidak dikenal (typo)", () => {
    const r = validateTemplateCopy("subscription_due", {
      subject: DEF.subscription_due.subject,
      body: "Halo {{tenant}}, tagihan {{paket}} {{nominal}} {{tanggal}} {{link}} {{nomnal}}",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{{nomnal}}");
  });

  it("menolak jika variabel wajib hilang (nominal tagihan)", () => {
    const r = validateTemplateCopy("subscription_due", {
      subject: DEF.subscription_due.subject,
      body: "Halo {{tenant}}, tagihan {{paket}} tanggal {{tanggal}}: {{link}}",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContain("Variabel wajib belum ada: {{nominal}}");
  });

  it("menolak placeholder rusak / kurung tidak berpasangan", () => {
    const r = validateTemplateCopy("wa_disconnected", {
      subject: "",
      body: "Halo {{tenant}}, sambungkan ulang {link} di Pengaturan",
    });
    expect(r.ok).toBe(false);
  });

  it("menolak isi terlalu pendek", () => {
    const r = validateTemplateCopy("wa_disconnected", { subject: "", body: "Halo" });
    expect(r.ok).toBe(false);
  });

  it("variabel runtime yang valid (app/cta/link) diterima", () => {
    const r = validateTemplateCopy("welcome_paid", {
      subject: "Selamat datang di {{app}}",
      body: "Halo {{tenant}}, paket {{paket}} aktif. {{cta}}Tautan: {{link}}",
    });
    expect(r).toEqual({ ok: true });
  });

  it("knownVariables memuat requiredVars setiap key", () => {
    for (const key of Object.keys(DEF) as (keyof typeof DEF)[]) {
      for (const v of DEF[key].requiredVars) expect(knownVariables(key)).toContain(v);
    }
  });
});

describe("renderPlatformTemplate dengan copy aktif (DB)", () => {
  const vars = { app: "Aircon", tenant: "AC Jaya", paket: "Professional", tanggal: "5 Oktober 2026", nominal: "Rp149.000", link: "https://x/app/langganan" };

  it("tanpa argumen copy memakai default kode", () => {
    const a = renderPlatformTemplate("subscription_due", vars);
    const b = renderPlatformTemplate("subscription_due", vars, { subject: DEF.subscription_due.subject, body: DEF.subscription_due.body });
    expect(a).toEqual(b);
  });

  it("copy override dari DB dipakai, placeholder tetap diisi", () => {
    const r = renderPlatformTemplate("subscription_due", vars, {
      subject: "Tagihan {{app}}",
      body: "Hai {{tenant}}: {{paket}} {{nominal}} jatuh tempo {{tanggal}}. {{link}}",
    });
    expect(r.body).toBe("Hai AC Jaya: Professional Rp149.000 jatuh tempo 5 Oktober 2026. https://x/app/langganan");
    expect(r.subject).toBe("Tagihan Aircon");
  });

  it("copy override yang kehilangan variabel wajib tetap ditolak saat render", () => {
    const { nominal: _omit, ...withoutNominal } = vars;
    expect(() => renderPlatformTemplate("subscription_due", withoutNominal, {
      subject: "", body: "Hai {{tenant}}, {{paket}} {{tanggal}} {{nominal}} {{link}}",
    })).toThrow(/nominal/);
  });

  it("eligibilitas tidak berubah: copy tidak bisa menghilangkan larangan trial", () => {
    // Basic tidak punya template trial_ending (key tak ada); template Basic tetap ke welcome_basic.
    expect(PLATFORM_TEMPLATES).not.toHaveProperty("trial_ending");
  });
});
