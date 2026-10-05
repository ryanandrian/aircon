import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Poin layout (keputusan user 2026-10-05): aksi "Batalkan pekerjaan" tidak boleh
 * sebaris dengan "Tugaskan Tim" di dalam kartu Jadwal & Tim — harus DI LUAR kartu
 * (di bawahnya, sebelum kartu Foto), dipisah garis.
 *
 * Repo tidak punya React Testing Library/jsdom (terverifikasi), jadi assertion
 * source-level ditambah gate tsc/eslint/build. Action/guard tidak disentuh.
 */
const page = readFileSync(resolve(process.cwd(), "src/app/app/pekerjaan/[id]/page.tsx"), "utf8");
const cancelPanel = readFileSync(
  resolve(process.cwd(), "src/app/app/pekerjaan/[id]/cancel-job.tsx"),
  "utf8",
);

function between(src: string, start: string, end: string) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`section tidak ketemu: ${start} → ${end}`);
  return src.slice(a, b);
}

describe("detail pekerjaan — aksi Batalkan dipisahkan dari kartu Jadwal & Tim", () => {
  it("kartu Jadwal & Tim TIDAK memuat aksi Batalkan (hanya view + panel Tugaskan Tim)", () => {
    const region = between(page, "{/* Jadwal & tim", "{/* Foto */}");
    const lastClose = region.lastIndexOf("</Card>");
    expect(lastClose).toBeGreaterThan(-1);
    const cardPart = region.slice(0, lastClose);
    expect(cardPart).toContain("Jadwal &amp; Tim");
    expect(cardPart).toContain("<OwnerActions");
    expect(cardPart).not.toContain("CancelJobPanel");
    expect(cardPart).not.toContain("Batalkan pekerjaan");
    expect(cardPart).not.toContain("actionCancelJob");
  });

  it("CancelJobPanel dirender DI LUAR kartu (setelah </Card>, sebelum kartu Foto)", () => {
    const region = between(page, "{/* Jadwal & tim", "{/* Foto */}");
    const lastClose = region.lastIndexOf("</Card>");
    const afterCard = region.slice(lastClose);
    expect(afterCard).toContain("<CancelJobPanel");
    // guard peletakan: panel baru ada setelah penutup kartu
    expect(afterCard.indexOf("</Card>")).toBeLessThan(afterCard.indexOf("<CancelJobPanel"));
  });

  it("panel memakai label eksplisit + konfirmasi 2 langkah yang sama", () => {
    expect(cancelPanel).toContain("Batalkan pekerjaan"); // label tombol
    expect(cancelPanel).toContain("Ya, batalkan pekerjaan"); // konfirmasi final
    expect(cancelPanel).toContain("actionCancelJob"); // perilaku lama tidak berubah
    expect(cancelPanel).toContain("cancel-reason"); // alasan tetap diminta
  });
});
