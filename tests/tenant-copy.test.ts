import { describe, it, expect } from "vitest";
import { renderTenantCopy, validateTenantCopy, TENANT_COPY_VARS } from "../src/lib/domain/tenant-copy";

// Default di schema BillingPolicy (sumber kebenaran copy tenant). Harus lolos validator baru.
const DEFAULTS = {
  dunningReminderTemplate: "Halo {nama}, langganan Aircon Anda jatuh tempo dan menunggak {telat} hari. Mohon segera perpanjang agar layanan tidak terputus.",
  dunningWarningTemplate: "Halo {nama}, langganan Aircon Anda menunggak {telat} hari. PERINGATAN: bila tidak dibayar dalam {sisa} hari lagi, data usaha Anda akan dihapus permanen. Segera perpanjang untuk menghindari kehilangan data.",
  inactivityReminder1Template: "Halo {nama}, akun Aircon Anda belum ada aktivitas selama {hari} hari. Kami menantikan Anda kembali — buka aplikasi kapan saja untuk melanjutkan.",
  inactivityReminder2Template: "Halo {nama}, akun Aircon Anda sudah {hari} hari tanpa aktivitas. PERINGATAN: bila tetap tidak digunakan, akun beserta seluruh data akan DIHAPUS PERMANEN dalam {sisa} hari. Buka aplikasi untuk membatalkan penghapusan.",
} as const;

describe("tenant copy — validasi (dunning & inactivity)", () => {
  it("default schema lolos validasi (admin tetap bisa menyimpan kebijakan)", () => {
    for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
      expect(validateTenantCopy(k, DEFAULTS[k]), k).toEqual({ ok: true });
    }
  });

  it("placeholder typo ditolak (tidak lagi jadi string kosong diam-diam)", () => {
    const r = validateTenantCopy("dunningReminderTemplate", "Halo {nmaa}, menunggak {telat} hari.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{nmaa}");
  });

  it("peringatan wajib memuat {sisa}", () => {
    const r = validateTenantCopy("dunningWarningTemplate", "Halo {nama}, menunggak {telat} hari segera bayar.");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain("{sisa}");
  });

  it("reminder biasa tidak wajib {sisa}", () => {
    expect(validateTenantCopy("dunningReminderTemplate", "Halo {nama}, tagihan menunggak {telat} hari.")).toEqual({ ok: true });
  });

  it("kurung kurawal tak berpasangan ditolak", () => {
    const r = validateTenantCopy("inactivityReminder1Template", "Halo {nama}, {hari hari tanpa aktivitas.");
    expect(r.ok).toBe(false);
  });
});

describe("tenant copy — renderer tunggal", () => {
  it("mengganti placeholder yang dikenal", () => {
    expect(renderTenantCopy("Halo {nama}, {hari} hari, sisa {sisa}", { nama: "AC Jaya", hari: "40", sisa: "12" }))
      .toBe("Halo AC Jaya, 40 hari, sisa 12");
  });

  it("perilaku lama dijaga: kunci tak ada → string kosong", () => {
    expect(renderTenantCopy("A{x}B", {})).toBe("AB");
  });

  it("setiap key punya daftar variabel yang tidak kosong", () => {
    for (const v of Object.values(TENANT_COPY_VARS)) expect(v.length).toBeGreaterThan(0);
  });
});
