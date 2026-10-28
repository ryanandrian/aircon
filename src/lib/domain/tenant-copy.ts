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

/**
 * PEMETAAN ke katalog platform (G23): satu katalog untuk semua copy pesan.
 * Kolom BillingPolicy (format `{x}`) = warisan/lama; katalog platform
 * (format `{{x}}`) = sumber baru yang diedit admin di Admin → Notifikasi.
 */
export const TENANT_COPY_TO_PLATFORM_KEY = {
  dunningReminderTemplate: "tenant_dunning_reminder",
  dunningWarningTemplate: "tenant_dunning_warning",
  inactivityReminder1Template: "tenant_inactivity_reminder1",
  inactivityReminder2Template: "tenant_inactivity_reminder2",
} as const;

export type TenantPlatformCopyKey =
  (typeof TENANT_COPY_TO_PLATFORM_KEY)[TenantCopyKey];

/** Peta terbalik (katalog platform → key kolom warisan). */
export const PLATFORM_COPY_TO_TENANT_COPY = {
  tenant_dunning_reminder: "dunningReminderTemplate",
  tenant_dunning_warning: "dunningWarningTemplate",
  tenant_inactivity_reminder1: "inactivityReminder1Template",
  tenant_inactivity_reminder2: "inactivityReminder2Template",
} as const satisfies Record<TenantPlatformCopyKey, TenantCopyKey>;

/** Placeholder yang dikenal tiap template (sesuai variabel yang dikirim kode). */
export const TENANT_COPY_VARS: Record<TenantCopyKey, readonly string[]> = {
  dunningReminderTemplate: ["nama", "telat", "sisa"],
  dunningWarningTemplate: ["nama", "telat", "sisa"],
  inactivityReminder1Template: ["nama", "hari", "sisa"],
  inactivityReminder2Template: ["nama", "hari", "sisa"],
};

/**
 * Render: ganti placeholder dengan nilai; kunci tak ada → string kosong.
 *
 * Mendukung DUA format sekaligus (G23 — migrasi copy ke katalog platform):
 *  - `{nama}`  → format warisan (kolom BillingPolicy).
 *  - `{{nama}}` → format katalog platform.
 * Regex diurutkan dari `{{...}}` dulu agar placeholder ganda tak terpotong jadi
 * dua kurung tunggal.
 */
export function renderTenantCopy(tpl: string, vars: Record<string, string>): string {
  return tpl
    .replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "")
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
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
  for (const m of tpl.matchAll(/\{\{?(\w*)\}?\}/g)) {
    if (!known.has(m[1])) errors.push(`Placeholder tidak dikenal: {${m[1]}}`);
  }
  if (tpl.replace(/\{\{\w*\}\}/g, "").replace(/\{\w*\}/g, "").match(/[{}]/)) {
    errors.push("Kurung kurawal tidak berpasangan");
  }
  if (key === "dunningWarningTemplate" || key === "inactivityReminder2Template") {
    if (!/\{\{?sisa\}?\}/.test(tpl)) errors.push("Pesan peringatan wajib memuat {sisa} (sisa hari sebelum hapus)");
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true };
}

/**
 * Ambil copy tenant→pelanggan dengan SUATU sumber kebenaran (G23).
 *
 * Urutan sumber:
 *  1. Baris `PlatformTemplate` (katalog platform) — inilah yang diedit admin
 *     di Admin → Notifikasi. Format `{{x}}`.
 *  2. Kolom `BillingPolicy` (warisan) — format `{x}`. Dipakai selama admin
 *     belum pernah mengedit template tsb di katalog, jadi copy lama tak hilang.
 *  3. Default kode (kalimat yang sama persis dengan default DB live).
 *
 * Alasan urutan ini: memindahkan copy ke katalog TAK BOLEH mengubah pesan yang
 * sedang terkirim. Selama baris katalog belum ada, copy lama yang dipakai.
 */
export async function resolveTenantCopy(
  key: TenantCopyKey,
  fallbackFromPolicy: string,
): Promise<{ body: string; source: "katalog" | "policy" | "default" }> {
  const platformKey = TENANT_COPY_TO_PLATFORM_KEY[key];
  const { getActiveTemplate } = await import("@/lib/services/platform-template-service");
  const { PLATFORM_TEMPLATES } = await import("@/lib/domain/platform-templates");
  try {
    const active = await getActiveTemplate(platformKey);
    // `getActiveTemplate` mengembalikan default kode bila baris DB tak ada —
    // itu membuat kolom BillingPolicy tak pernah terpakai. Karena itu cek
    // baris DB secara langsung di sini.
    const { prisma } = await import("@/lib/prisma");
    const row = await prisma.platformTemplate.findUnique({
      where: { key: platformKey },
      select: { subject: true, body: true },
    });
    if (row) {
      // CATATAN: `renderPlatformTemplate` menuntut semua requiredVars terisi —
      // itu benar untuk antrean pesan nyata, tetapi DI SINI kita hanya
      // MEMILIH template, bukan merender pesan akhir. Placeholder sesungguhnya
      // diganti oleh renderTenantCopy dengan variabel runtime (nama/telat/sisa).
      // Karena itu cukup validasi STRUKTUR placeholder (placeholder tak dikenal
      // ditolak) — kelengkapan wajib sudah dijamin saat admin menyimpannya.
      const tenantKey = PLATFORM_COPY_TO_TENANT_COPY[platformKey];
      const check = validateTenantCopy(tenantKey, row.body);
      if (!check.ok) {
        console.error(`[tenant-copy] katalog ${platformKey} punya placeholder tidak valid — fallback ke warisan`);
        return { body: fallbackFromPolicy, source: "policy" };
      }
      return { body: row.body, source: "katalog" };
    }
    void active;
  } catch (e) {
    console.error(`[tenant-copy] gagal membaca katalog untuk ${key}:`, e instanceof Error ? e.message : e);
  }
  if (fallbackFromPolicy && fallbackFromPolicy.trim()) {
    return { body: fallbackFromPolicy, source: "policy" };
  }
  const defaults: Record<TenantPlatformCopyKey, string> = {
    tenant_dunning_reminder: PLATFORM_TEMPLATES.tenant_dunning_reminder.body,
    tenant_dunning_warning: PLATFORM_TEMPLATES.tenant_dunning_warning.body,
    tenant_inactivity_reminder1: PLATFORM_TEMPLATES.tenant_inactivity_reminder1.body,
    tenant_inactivity_reminder2: PLATFORM_TEMPLATES.tenant_inactivity_reminder2.body,
  };
  return { body: defaults[platformKey], source: "default" };
}
