/**
 * Terbilang — konversi bilangan bulat Rupiah ke kata Bahasa Indonesia (PURE, no I/O, teruji).
 * Kaidah standar: satuan/belas/puluh/ratus + ribu/juta/miliar/triliun; "seribu"/"seratus"
 * (bukan "satu ribu"/"satu ratus"); negatif → "minus ...". Dipakai kwitansi (wajib terbilang).
 */
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];

function tigaDigit(n: number): string {
  let s = "";
  const ratus = Math.floor(n / 100);
  const sisa = n % 100;
  if (ratus > 0) s += (ratus === 1 ? "seratus" : SATUAN[ratus] + " ratus") + (sisa > 0 ? " " : "");
  if (sisa > 0) {
    if (sisa < 12) s += SATUAN[sisa];
    else if (sisa < 20) s += SATUAN[sisa - 10] + " belas";
    else {
      const puluh = Math.floor(sisa / 10);
      const satu = sisa % 10;
      s += SATUAN[puluh] + " puluh" + (satu > 0 ? " " + SATUAN[satu] : "");
    }
  }
  return s;
}

const SKALA = ["", "ribu", "juta", "miliar", "triliun"];

/** Bilangan bulat → kata Indonesia (tanpa "rupiah"). 0 → "nol". */
export function angkaKeKata(n: number): string {
  if (!Number.isFinite(n)) return "";
  n = Math.trunc(n);
  if (n === 0) return "nol";
  if (n < 0) return "minus " + angkaKeKata(-n);

  // Pecah per 3 digit dari belakang.
  const grup: number[] = [];
  let x = n;
  while (x > 0) { grup.push(x % 1000); x = Math.floor(x / 1000); }

  const bagian: string[] = [];
  for (let i = grup.length - 1; i >= 0; i--) {
    const g = grup[i];
    if (g === 0) continue;
    if (i === 1 && g === 1) {
      bagian.push("seribu"); // 1000 → "seribu"
    } else {
      bagian.push(tigaDigit(g) + (SKALA[i] ? " " + SKALA[i] : ""));
    }
  }
  return bagian.join(" ").replace(/\s+/g, " ").trim();
}

/** Terbilang lengkap untuk Rupiah: "<kata> rupiah" (huruf pertama kapital). */
export function terbilangRupiah(n: number): string {
  const kata = angkaKeKata(Math.abs(Math.trunc(n)));
  const full = (n < 0 ? "minus " : "") + kata + " rupiah";
  return full.charAt(0).toUpperCase() + full.slice(1);
}
