import { describe, it, expect } from "vitest";
import {
  renderTenantCopy, validateTenantCopy, TENANT_COPY_VARS, TENANT_COPY_KEYS,
} from "../src/lib/domain/tenant-copy";

// G23: copy tenant→pelanggan bersumber dari KATALOG platform. Default di
// `PLATFORM_TEMPLATES` (kode) = kalimat yang sama persis dengan copy live.
const DEFAULTS = {
  tenant_dunning_reminder: "Halo {{nama}}, langganan Aircon Anda jatuh tempo dan menunggak {{telat}} hari. Mohon segera perpanjang agar layanan tidak terputus.",
  tenant_dunning_warning: "Halo {{nama}}, langganan Aircon Anda menunggak {{telat}} hari. PERINGATAN: bila tidak dibayar dalam {{sisa}} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.",
  tenant_inactivity_reminder1: "Halo {{nama}}, akun Aircon Anda belum ada aktivitas selama {{hari}} hari. Kami menantikan Anda kembali — buka aplikasi kapan saja untuk melanjutkan.",
  tenant_inactivity_reminder2: "Halo {{nama}}, akun Aircon Anda sudah {{hari}} hari tanpa aktivitas. PERINGATAN: bila tetap tidak digunakan, akun beserta seluruh data akan DIHAPUS PERMANEN dalam {{sisa}} hari. Buka aplikasi untuk membatalkan penghapusan.",
} as const;

describe("tenant copy — validasi (dunning & inactivity)", () => {
  it("default katalog lolos validasi (copy bawaan selalu bisa dipakai)", () => {
    for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      expect(validateTenantCopy(k, DEFAULTS[k]), k).toEqual({ ok: true });
    }
  });

  it("placeholder typo ditolak (tidak lagi jadi string kosong diam-diam)", () => {
    const r = validateTenantCopy("tenant_dunning_reminder", "Halo {nmaa}, menunggak {telat} hari.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{nmaa}");
  });

  it("peringatan wajib memuat {sisa}", () => {
    const r = validateTenantCopy("tenant_dunning_warning", "Halo {nama}, menunggak {telat} hari segera bayar.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{sisa}");
  });

  it("reminder biasa tidak wajib {sisa}", () => {
    expect(validateTenantCopy("tenant_dunning_reminder", "Halo {nama}, tagihan menunggak {telat} hari.")).toEqual({ ok: true });
  });

  it("kurung kurawal tak berpasangan ditolak", () => {
    const r = validateTenantCopy("tenant_inactivity_reminder1", "Halo {nama}, {hari hari tanpa aktivitas.");
    expect(r.ok).toBe(false);
  });

  it("inactivity reminder #2 juga wajib {sisa} (pesan peringatan hapus)", () => {
    const r = validateTenantCopy("tenant_inactivity_reminder2", "Halo {nama}, {hari} hari tanpa aktivitas.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{sisa}");
  });
});

describe("tenant copy — renderer tunggal", () => {
  it("mengganti placeholder yang dikenal", () => {
    expect(renderTenantCopy("Halo {nama}, {hari} hari, sisa {sisa}", { nama: "AC Jaya", hari: "40", sisa: "12" }))
      .toBe("Halo AC Jaya, 40 hari, sisa 12");
  });

  it("format katalog {{x}} juga terganti (path produksi)", () => {
    expect(renderTenantCopy("Halo {{nama}}, {{hari}} hari, sisa {{sisa}}", { nama: "AC Jaya", hari: "40", sisa: "12" }))
      .toBe("Halo AC Jaya, 40 hari, sisa 12");
  });

  it("perilaku lama dijaga: kunci tak ada → string kosong", () => {
    expect(renderTenantCopy("A{x}B", {})).toBe("AB");
  });

  it("setiap key punya daftar variabel yang tidak kosong", () => {
    for (const v of Object.values(TENANT_COPY_VARS)) expect(v.length).toBeGreaterThan(0);
  });

  it("daftar key = 4 template tenant (satu sumber, tanpa key warisan)", () => {
    expect([...TENANT_COPY_KEYS]).toEqual([
      "tenant_dunning_reminder",
      "tenant_dunning_warning",
      "tenant_inactivity_reminder1",
      "tenant_inactivity_reminder2",
    ]);
  });
});
