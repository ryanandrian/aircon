/**
 * Kontrak copy pesan TENANT → pelanggan (dunning & inactivity) — PURE (tanpa prisma).
 *
 * G23 — SATU sumber kebenaran:
 *  - Copy tenant→pelanggan HANYA ada di katalog platform (`PlatformTemplate`),
 *    diedit admin di Admin → Notifikasi → Template.
 *  - Kolom copy `BillingPolicy` sudah di-retire (migrasi drop kolom) — tak ada
 *    lagi dua sumber kebenaran yang bisa berbeda isi.
 *  - Key copy = key katalog platform (satu namespace; tak ada lagi nama warisan
 *    seperti `dunningReminderTemplate` yang dulu jadi kolom).
 *
 * Modul ini menyatikan:
 *  - renderer tunggal (menerima `{{x}}` format katalog dan `{x}` format lama),
 *  - daftar placeholder yang DIKENAL per template,
 *  - validasi: placeholder tak dikenal / kurung rusak ditolak saat admin menyimpan.
 *
 * Tidak mengubah jalur kirim (tetap MessageLog) dan tidak memindahkan ke PlatformNotification.
 */

/** Key copy tenant→pelanggan (identik dengan key katalog platform). */
export const TENANT_COPY_KEYS = [
  "tenant_dunning_reminder",
  "tenant_dunning_warning",
  "tenant_inactivity_reminder1",
  "tenant_inactivity_reminder2",
] as const;

export type TenantCopyKey = (typeof TENANT_COPY_KEYS)[number];

/**
 * Placeholder yang DIKENAL tiap template = variabel yang benar-benar dikirim
 * kode saat render (nama/telat/hari/sisa). Placeholder lain (mis. `{{paket}}`)
 * tak akan pernah terisi → string kosong diam-diam. Karena itu daftar ini juga
 * dipakai saat admin menyimpan template katalog (lihat platform-templates.ts).
 */
export const TENANT_COPY_VARS: Record<TenantCopyKey, readonly string[]> = {
  tenant_dunning_reminder: ["nama", "telat", "sisa"],
  tenant_dunning_warning: ["nama", "telat", "sisa"],
  tenant_inactivity_reminder1: ["nama", "hari", "sisa"],
  tenant_inactivity_reminder2: ["nama", "hari", "sisa"],
};

/**
 * Render: ganti placeholder dengan nilai; kunci tak ada → string kosong.
 *
 * Mendukung DUA format sekaligus:
 *  - `{{nama}}` → format katalog platform (format resmi).
 *  - `{nama}`   → format lama (copy warisan yang masih mungkin tersimpan).
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
 * Validasi copy tenant→pelanggan: semua `{x}`/`{{x}}` harus dikenal untuk key tsb;
 * tidak boleh ada kurung kurawal sisa (rusak); placeholder wajib tidak boleh
 * hilang seluruhnya (tanpa sisa pada warning, pesan tak menyebut tenggat — itu
 * ditolak).
 *
 * Dipakai dua tempat: (1) saat admin menyimpan template katalog, (2) saat runtime
 * membaca baris katalog sebelum memakai copy-nya.
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
  if (key === "tenant_dunning_warning" || key === "tenant_inactivity_reminder2") {
    if (!/\{\{?sisa\}?\}/.test(tpl)) {
      errors.push("Pesan peringatan wajib memuat {sisa} (sisa hari sebelum hapus)");
    }
  }
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true };
}

/**
 * Ambil copy tenant→pelanggan dari katalog platform (G23).
 *
 * Urutan sumber:
 *  1. Baris `PlatformTemplate` (katalog platform) — inilah yang diedit admin
 *     di Admin → Notifikasi. Format `{{x}}`.
 *  2. Default kode (kalimat yang sama persis dengan copy live saat katalog diisi).
 *
 * Copy katalog yang placeholder-nya tak valid TIDAK dipakai (bisa jadi pesan
 * dengan bagian hilang tanpa jejak) → fallback ke default kode + log.
 */
export async function resolveTenantCopy(
  key: TenantCopyKey,
): Promise<{ body: string; source: "katalog" | "default" }> {
  const { prisma } = await import("@/lib/prisma");
  const { PLATFORM_TEMPLATES } = await import("@/lib/domain/platform-templates");
  try {
    const row = await prisma.platformTemplate.findUnique({
      where: { key },
      select: { body: true },
    });
    if (row) {
      const check = validateTenantCopy(key, row.body);
      if (!check.ok) {
        console.error(
          `[tenant-copy] katalog ${key} punya placeholder tidak valid — pakai default kode: ${check.errors.join("; ")}`,
        );
        return { body: PLATFORM_TEMPLATES[key].body, source: "default" };
      }
      return { body: row.body, source: "katalog" };
    }
  } catch (e) {
    console.error(
      `[tenant-copy] gagal membaca katalog untuk ${key}:`,
      e instanceof Error ? e.message : e,
    );
  }
  return { body: PLATFORM_TEMPLATES[key].body, source: "default" };
}
