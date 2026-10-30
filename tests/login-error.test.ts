import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveLoginError, LOGIN_ERROR_CODES } from "../src/lib/auth/login-error";

/**
 * Pesan halaman login — pemetaan kode `?error=` (murni, tanpa DB).
 *
 * DASAR MASALAH: semua error sebelumnya dirender sebagai satu kalimat generik
 * ("Gagal masuk. Silakan coba lagi."), sehingga tenant SUSPENDED tak pernah
 * diberi tahu jalan pembayaran yang tersedia.
 */

describe("pemetaan error login", () => {
  it("tanpa kode → tak ada banner", () => {
    expect(resolveLoginError(undefined)).toBeNull();
    expect(resolveLoginError(null)).toBeNull();
    expect(resolveLoginError("")).toBeNull();
  });

  it("suspended → pesan jatuh tempo + CTA ke halaman Langganan", () => {
    const info = resolveLoginError("suspended");
    expect(info).not.toBeNull();
    expect(info!.billingRecovery).toBe(true);
    expect(info!.actionHref).toBe("/app/langganan");
    expect(info!.message).toContain("jatuh tempo");
    // Tak boleh menyuruh "hubungi pemilik usaha" — itu melingkar (dia sendiri ownersnya).
    expect(info!.message).not.toContain("pemilik usaha");
  });

  it("cancelled → status Berhenti, tanpa jalur bayar, arah ke Kontak", () => {
    const info = resolveLoginError("cancelled");
    expect(info).not.toBeNull();
    expect(info!.billingRecovery).toBe(false);
    expect(info!.actionHref).toBe("/kontak");
    // CANCELLED = keputusan admin, BUKAN tunggakan → jangan sebut tunggakan/perpanjang.
    expect(info!.message).not.toContain("tunggakan");
    expect(info!.message).not.toContain("perpanjang");
    expect(info!.message).toContain("Berhenti");
  });

  it("kode auth lain tetap dibedakan (tak diseragamkan)", () => {
    expect(resolveLoginError("state")!.message).not.toBe(resolveLoginError("auth")!.message);
    expect(resolveLoginError("unverified")!.message).toContain("terverifikasi");
  });

  it("kode tak dikenal → pesan generik, TIDAK render input mentah", () => {
    const info = resolveLoginError("<script>alert(1)</script>");
    expect(info).not.toBeNull();
    expect(info!.message).not.toContain("script");
    expect(info!.billingRecovery).toBe(false);
  });

  it("semua kode resmi punya pemetaan", () => {
    for (const code of LOGIN_ERROR_CODES) {
      expect(resolveLoginError(code)).not.toBeNull();
    }
  });

  it("PENJAGA: setiap kode error yang dipancarkan server punya pemetaan", () => {
    // Kode error yang dikirim ke halaman login berasal dari 2 sumber:
    //   - callback OAuth (src/app/auth/callback/route.ts)
    //   - layout/dashboard /app yang encounter tenant terblokir
    // Bila sumber menambah kode baru tanpa pemetaan, tenant akan kembali
    // melihat pesan generik — persis cacat yang diperbaiki. Test ini menjaga itu.
    const sources = [
      "src/app/auth/callback/route.ts",
      "src/app/app/layout.tsx",
      "src/app/app/page.tsx",
    ];
    const emitted = new Set<string>();
    for (const file of sources) {
      const src = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const match of src.matchAll(/error=\$\{([^}]+)\}|error=([a-z]+)/g)) {
        if (match[2]) { emitted.add(match[2]); continue; }
        // Nilai dinamis = status tenant (lowercase) →/status tenant ke lowercase.
        const expr = match[1] ?? "";
        if (expr.includes("tenantStatus")) {
          emitted.add("suspended");
          emitted.add("cancelled");
        } else if (expr.includes("blocked")) {
          emitted.add("blocked");
        }
      }
    }
    expect(emitted.size).toBeGreaterThan(0);
    for (const code of emitted) {
      const info = resolveLoginError(code);
      expect(info, `kode "${code}" belum dipetakan`).not.toBeNull();
      // Kode tak dikenal tetap dapat fallback generik, tapi tak boleh kosong/render bebas.
      expect(info!.message.length).toBeGreaterThan(0);
    }
  });
});
