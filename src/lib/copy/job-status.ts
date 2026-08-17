/**
 * Label & warna status pekerjaan (JobStatus) — bahasa ramah-teknisi Indonesia.
 * Dipakai di app teknisi & dashboard owner. Konsisten satu sumber.
 */
import type { JobStatus } from "@prisma/client";

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  DRAFT: "Draf",
  ASSIGNED: "Ditugaskan",
  ACCEPTED: "Diterima",
  EN_ROUTE: "Menuju Lokasi",
  ARRIVED: "Tiba di Lokasi",
  IN_PROGRESS: "Dikerjakan",
  WAITING: "Tertunda",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
  RESCHEDULED: "Dijadwalkan Ulang",
};

export const JOB_STATUS_COLOR: Record<JobStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  ASSIGNED: "bg-amber-100 text-amber-700",
  ACCEPTED: "bg-sky-100 text-sky-700",
  EN_ROUTE: "bg-indigo-100 text-indigo-700",
  ARRIVED: "bg-violet-100 text-violet-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  WAITING: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-200 text-slate-500",
  RESCHEDULED: "bg-yellow-100 text-yellow-700",
};

/**
 * Aksi maju berikutnya untuk teknisi berdasarkan status saat ini.
 * Mengembalikan tombol utama (label + status tujuan) atau null.
 */
export function nextTechAction(status: JobStatus): { label: string; to: JobStatus } | null {
  switch (status) {
    case "ASSIGNED": return { label: "Terima Pekerjaan", to: "ACCEPTED" };
    case "ACCEPTED": return { label: "Berangkat", to: "EN_ROUTE" };
    case "EN_ROUTE": return { label: "Tiba di Lokasi", to: "ARRIVED" };
    case "ARRIVED": return { label: "Mulai Kerjakan", to: "IN_PROGRESS" };
    case "IN_PROGRESS": return { label: "Selesaikan", to: "COMPLETED" };
    case "WAITING": return { label: "Lanjutkan", to: "IN_PROGRESS" };
    default: return null;
  }
}
