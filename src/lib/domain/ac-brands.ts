/**
 * Daftar merek AC kanonik (kurasi Lumite) — SATU sumber untuk menjaga kerapian data lintas teknisi.
 * Tujuan: cegah varian ejaan ("daikin"/"DAIKIN"/"Daikinn") menjadi banyak merek berbeda di laporan.
 * Teknisi tetap boleh menulis merek langka ("tambah lainnya") — tetap dinormalisasi bentuknya.
 */

/** Merek AC yang umum beredar di Indonesia (urut kira-kira populer). */
export const AC_BRANDS: readonly string[] = [
  "Daikin",
  "Panasonic",
  "LG",
  "Samsung",
  "Sharp",
  "Gree",
  "Midea",
  "Mitsubishi Electric",
  "Mitsubishi Heavy",
  "Haier",
  "Aqua",
  "Polytron",
  "Changhong",
  "TCL",
  "Hisense",
  "Electrolux",
  "Toshiba",
  "Sanyo",
  "Sanken",
  "Denpoo",
  "Fujitsu",
  "York",
  "Carrier",
  "Trane",
];

/** Peta lowercase→kanonik untuk pencocokan cepat (termasuk beberapa alias/salah-ketik umum). */
const CANONICAL_BY_LOWER: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const b of AC_BRANDS) m[b.toLowerCase()] = b;
  // alias & salah-ketik umum
  m["mitsubishi"] = "Mitsubishi Electric";
  m["mitsubishi electric"] = "Mitsubishi Electric";
  m["mitsubishi heavy industries"] = "Mitsubishi Heavy";
  m["mhi"] = "Mitsubishi Heavy";
  m["panasonik"] = "Panasonic";
  m["daikinn"] = "Daikin";
  m["shrp"] = "Sharp";
  return m;
})();

/**
 * Normalisasi merek: rapikan spasi, cocokkan ke bentuk kanonik bila dikenal,
 * kalau tidak dikenal → Title Case ringan agar tetap konsisten (mis. "gree ac" → "Gree Ac").
 * Mengembalikan null untuk input kosong.
 */
export function normalizeBrand(input?: string | null): string | null {
  const raw = (input ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const hit = CANONICAL_BY_LOWER[raw.toLowerCase()];
  if (hit) return hit;
  // tidak dikenal: Title Case ringan (jaga akronim pendek biar tetap kapital)
  return raw
    .split(" ")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Normalisasi model: rapikan spasi saja (model tak dikanonikkan — ribuan variasi). */
export function normalizeModel(input?: string | null): string | null {
  const raw = (input ?? "").trim().replace(/\s+/g, " ");
  return raw || null;
}
