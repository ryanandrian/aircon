/**
 * Kontrak copy pesan TENANT → pelanggan (dunning & inactivity) — PURE (tanpa prisma).
 * Sumber copy tetap BillingPolicy (editable admin). Modul ini hanya menyatukan:
 *  - renderer tunggal (sebelumnya dua fungsi identik fillSingle & fillTpl),
 *  - daftar placeholder yang DIKENAL per template,
 *  - validasi: placeholder tak dikenal / kurung rusak ditolak saat admin menyimpan.
 * Tidak mengubah jalur kirim (tetap MessageLog) dan tidak memindahkan ke PlatformNotification.
 */

export type TenantCopyKey =
  | "dunningReminderTemplate"
  | "dunningWarningTemplate"
  | "inactivityReminder1Template"
  | "inactivityReminder2Template";

/** Placeholder yang dikenal tiap template (sesuai variabel yang dikirim kode). */
export const TENANT_COPY_VARS: Record<TenantCopyKey, readonly string[]> = {
  dunningReminderTemplate: ["nama", "telat", "sisa"],
  dunningWarningTemplate: ["nama", "telat", "sisa"],
  inactivityReminder1Template: ["nama", "hari", "sisa"],
  inactivityReminder2Template: ["nama", "hari", "sisa"],
};

/** Render: ganti {kunci} dengan nilai; kunci tak ada → string kosong (perilaku lama, dijaga). */
export function renderTenantCopy(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
}

export type TenantCopyValidation = { ok: true } | { ok: false; errors: string[] };

/**
 * Validasi copy admin: semua `{x}` harus dikenal untuk key tsb; tidak boleh ada
 * kurung kurawal sisa (rusak); placeholder wajib tidak boleh hilang seluruhnya
 * (tanpa {sisa} pada warning, pesan tak menyebut tenggat — itu ditolak).
 */
export function validateTenantCopy(key: TenantCopyKey, tpl: string): TenantCopyValidation {
  const errors: string[] = [];
  const known = new Set<string>(TENANT_COPY_VARS[key]);
  for (const m of tpl.matchAll(/\{(\w*)\}/g)) {
    if (!known.has(m[1])) errors.push(`Placeholder tidak dikenal: {${m[1]}}`);
  }
  if (tpl.replace(/\{\w*\}/g, "").match(/[{}]/)) {
    errors.push("Kurung kurawal tidak berpasangan");
  }
  if (key === "dunningWarningTemplate" || key === "inactivityReminder2Template") {
    if (!/\{sisa\}/.test(tpl)) errors.push("Pesan peringatan wajib memuat {sisa} (sisa hari sebelum hapus)");
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true };
}
