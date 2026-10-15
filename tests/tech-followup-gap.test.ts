import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// F9b–F9d — Followup job tertunda dari riwayat + guard anggota tim + backlog
// beranda (laporan pemilik 2026-10-15, bukti DB: Effi ACCEPTED 13 Okt &
// Ibu Wati ASSIGNED 14 Okt = via JobAssignment, teknisi utama ORANG LAIN).
//
// TIGA CELAH (semua fitur lama — git log, bukan regresi):
//  C2. kartu riwayat TANPA tautan → job terlihat tapi tak bisa dibuka.
//  C3. [DITARIK — guard detail LOLOS utk kasus Ryan, verifikasi presisi
//      technicianId+assignment 2026-10-15; tidak diuji di sini].
//  C1. beranda filter "hari ini" → job tertunda kemarin tak tampil.
//
// Yang DIKUNCI (source-level — pola mapan repo):
// 1. listTechnicianJobHistory mengembalikan jobId (utk tautan).
// 2. history-view: kartu status AKTIF memuat Link ke /t/pekerjaan/{jobId};
//    kartu COMPLETED/CANCELLED TIDAK (terminal — tak ada yang dilanjutkan).
// 3. Guard detail /t/pekerjaan/[id]: mengizinkan anggota JobAssignment
//    (pola OR yang sama dgn listTechnicianJobsToday), tanpa membuka akses
//    pihak asing.
// 4. Beranda: kartu backlog utk job AKTIF lewat jadwal (tetap tampil walau
//    filter hari ini aktif).

const svc = readFileSync(resolve(process.cwd(), "src/lib/services/technician-service.ts"), "utf8");
const historyView = readFileSync(resolve(process.cwd(), "src/app/t/riwayat/history-view.tsx"), "utf8");
const homePage = readFileSync(resolve(process.cwd(), "src/app/t/page.tsx"), "utf8");
const homeJobs = readFileSync(resolve(process.cwd(), "src/lib/services/job-management-service.ts"), "utf8");

describe("F9b — riwayat: tautan followup utk job AKTIF", () => {
  it("listTechnicianJobHistory menyertakan jobId per baris", () => {
    // row dibentuk dari assignment `a` → jobId sudah tersedia utk di-spread
    expect(svc).toMatch(/jobId:\s*a\.jobId/);
  });

  it("tipe Row history-view memuat jobId", () => {
    expect(historyView).toContain("jobId");
  });

  it("kartu riwayat memuat tautan detail /t/pekerjaan/{jobId}", () => {
    expect(historyView).toMatch(/\/t\/pekerjaan\/\$\{r\.jobId\}/);
  });

  it("riwayat = arsip+pantauan: SEMUA kartu tautan 'Lihat detail'; TANPA jalur 'Tandai LUNAS' (F9c' — beranda saja)", () => {
    expect(historyView).toContain("Lihat detail");
    expect(historyView).not.toContain("/t/faktur/");
    expect(historyView).not.toContain("Tandai LUNAS");
  });
});

describe("F9d — beranda: backlog job AKTIF lewat jadwal", () => {
  it("service punya helper backlog (job aktif lewat jadwal)", () => {
    expect(homeJobs).toContain("listTechnicianBacklogJobs");
  });

  it("beranda /t memuat daftar 'Perlu ditindaklanjuti' (tak sembunyikan job tertunda)", () => {
    expect(homePage).toContain("Perlu ditindaklanjuti");
    expect(homePage).toContain("listTechnicianBacklogJobs");
  });

  it("filter hari ini TETAP (backlog = tambahan, bukan pengganti)", () => {
    expect(homeJobs).toContain("listTechnicianJobsToday");
    expect(homePage).toContain("listTechnicianJobsToday");
  });

  it("doneCount diperbaiki (dulu selalu 0 — menghitung COMPLETED dari daftar ACTIVE)", () => {
    expect(homeJobs).toContain("countTechnicianCompletedToday");
    // penghitungan lama yang salah TIDAK dipertahankan
    expect(homePage).not.toContain('filter((j) => j.status === "COMPLETED")');
  });
});
