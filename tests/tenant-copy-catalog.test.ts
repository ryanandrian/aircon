import { describe, it, expect, vi, beforeEach } from "vitest";

// REGRESSION (G23 — copy dunning/inactivity jadi satu katalog platform).
//
//  - Sumber copy TUNGGAL: Admin → Notifikasi (katalog `PlatformTemplate`).
//  - Urutan sumber: baris katalog → default kode. Kolom BillingPolicy SUDAH
//    di-retire (tidak ada lagi fallback "policy").
//  - Copy katalog yang placeholder-nya tak valid TIDAK dipakai → default kode
//    + log (pesan tak pernah dikirim dengan bagian hilang tanpa jejak).
//  - Renderer menerima DUA format: `{x}` (warisan) dan `{{x}}` (katalog).

vi.mock("server-only", () => ({}));

const { tmplFindUnique } = vi.hoisted(() => ({ tmplFindUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformTemplate: { findUnique: tmplFindUnique } },
}));

import {
  renderTenantCopy, validateTenantCopy, resolveTenantCopy,
} from "../src/lib/domain/tenant-copy";
import { knownVariables, validateTemplateCopy } from "../src/lib/domain/platform-templates";

describe("G23 — renderer & validator dua format", () => {
  it("{{x}} dan {x} sama-sama terganti", () => {
    expect(renderTenantCopy("Halo {{nama}} / {nama} / {{telat}}", { nama: "Budi", telat: "3" }))
      .toBe("Halo Budi / Budi / 3");
  });

  it("validasi menerima dua format placeholder yang dikenal", () => {
    expect(validateTenantCopy("tenant_dunning_reminder", "Halo {nama}, telat {telat} hari").ok).toBe(true);
    expect(validateTenantCopy("tenant_dunning_reminder", "Halo {{nama}}, telat {{telat}} hari").ok).toBe(true);
  });

  it("placeholder tak dikenal tetap DITOLAK di kedua format", () => {
    expect(validateTenantCopy("tenant_dunning_reminder", "Halo {ngawur}").ok).toBe(false);
    expect(validateTenantCopy("tenant_dunning_reminder", "Halo {{ngawur}}").ok).toBe(false);
  });

  it("warning tanpa {sisa} / {{sisa}} ditolak", () => {
    expect(validateTenantCopy("tenant_dunning_warning", "Halo {{nama}} telat {{telat}}").ok).toBe(false);
    expect(validateTenantCopy("tenant_dunning_warning", "Halo {nama} telat {telat} sisa {sisa}").ok).toBe(true);
  });
});

describe("G23 — validasi katalog saat admin menyimpan (jalur TULIS)", () => {
  it("variabel yang tak akan terisi saat render DITOLAK (mis. {{paket}})", () => {
    const r = validateTemplateCopy("tenant_dunning_reminder", {
      subject: "",
      body: "Halo {{nama}}, tunggakan {{telat}} hari. Paket {{paket}}.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("paket");
  });

  it("knownVariables untuk key tenant_ = HANYA variabel yang di-render", () => {
    expect(knownVariables("tenant_dunning_reminder").sort()).toEqual(["nama", "sisa", "telat"]);
    expect(knownVariables("tenant_inactivity_reminder1").sort()).toEqual(["hari", "nama", "sisa"]);
  });

  it("copy katalog yang benar-format & variabelnya lengkap DITERIMA", () => {
    const r = validateTemplateCopy("tenant_dunning_warning", {
      subject: "",
      body: "Halo {{nama}}, menunggak {{telat}} hari. Bayar dalam {{sisa}} hari.",
    });
    expect(r.ok).toBe(true);
  });

  it("format {x} (satu kurung) ditolak di katalog — katalog wajib {{x}}", () => {
    const r = validateTemplateCopy("tenant_dunning_reminder", {
      subject: "",
      body: "Halo {nama}, tunggakan {telat} hari.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{{nama}}");
  });

  it("template peringatan tanpa {{sisa}} ditolak saat disimpan", () => {
    const r = validateTemplateCopy("tenant_dunning_warning", {
      subject: "",
      body: "Halo {{nama}}, menunggak {{telat}} hari.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("sisa");
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
    const r = await resolveTenantCopy("tenant_dunning_reminder");
    expect(r.source).toBe("katalog");
    expect(r.body).toBe("Halo {{nama}}, menunggak {{telat}} hari.");
  });

  it("baris katalog TAK ada → default kode (tak ada lagi kolom BillingPolicy)", async () => {
    tmplFindUnique.mockResolvedValue(null);
    const r = await resolveTenantCopy("tenant_dunning_reminder");
    expect(r.source).toBe("default");
    expect(r.body).toContain("{{nama}}");
  });

  it("katalog kosong → default kode (pesan peringatan memuat PERINGATAN + {{sisa}})", async () => {
    tmplFindUnique.mockResolvedValue(null);
    const r = await resolveTenantCopy("tenant_dunning_warning");
    expect(r.source).toBe("default");
    expect(r.body).toContain("PERINGATAN");
    expect(r.body).toContain("{{sisa}}");
  });

  it("katalog placeholder tak valid → default kode (bukan copy rusak)", async () => {
    tmplFindUnique.mockResolvedValue({
      key: "tenant_dunning_reminder", body: "Halo {{nama}}, paket {{paket}}.",
    });
    const r = await resolveTenantCopy("tenant_dunning_reminder");
    expect(r.source).toBe("default");
    expect(r.body).not.toContain("{{paket}}");
  });

  it("gagal baca DB → default kode (pesannya tetap terkirim, tidak error)", async () => {
    tmplFindUnique.mockRejectedValue(new Error("db down"));
    const r = await resolveTenantCopy("tenant_dunning_reminder");
    expect(r.source).toBe("default");
    expect(r.body).toContain("{{nama}}");
  });
});
