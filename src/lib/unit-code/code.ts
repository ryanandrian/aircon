/**
 * Generator kode unit fisik (QR sticker).
 * - UPPERCASE + angka, charset TANPA karakter ambigu (hindari 0/O, 1/I/L) → mudah dibaca manusia.
 * - Panjang 7 → ~30 char aman: 31^7 ≈ 27,5 miliar kombinasi (cukup, anti-tebak).
 * - QR "mode alfanumerik" (uppercase+angka) lebih rapat → sticker kecil tetap terbaca.
 */
const CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa I,L,O,0,1
const CODE_LEN = 7;

export function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return out;
}

/** Validasi bentuk kode (uppercase, charset benar, panjang benar). Untuk parse hasil scan. */
export function isValidCodeShape(code: string): boolean {
  if (code.length !== CODE_LEN) return false;
  for (const ch of code) if (!CHARSET.includes(ch)) return false;
  return true;
}

/**
 * Ekstrak kode dari hasil scan QR. Menerima:
 *  - URL penuh: https://ac.lumite.biz.id/u/7F3K9M2  → "7F3K9M2" (bila /u/ ada)
 *  - kode telanjang: "7F3K9M2"
 * Mengembalikan kode uppercase valid, atau null bila bukan pola kita.
 */
export function extractCode(scanned: string): string | null {
  const s = scanned.trim();
  // coba sebagai URL
  const m = s.match(/\/u\/([A-Za-z0-9]+)/);
  const candidate = (m ? m[1] : s).toUpperCase();
  return isValidCodeShape(candidate) ? candidate : null;
}
