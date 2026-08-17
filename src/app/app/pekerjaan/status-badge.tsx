import { JOB_STATUS_LABEL } from "@/lib/copy/terms";
import type { JobStatus } from "@prisma/client";

/** Warna badge per status pekerjaan (kontras cukup, teks gelap di latar terang). */
const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-sky-100 text-sky-800",
  ACCEPTED: "bg-indigo-100 text-indigo-800",
  EN_ROUTE: "bg-violet-100 text-violet-800",
  ARRIVED: "bg-cyan-100 text-cyan-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  WAITING: "bg-orange-100 text-orange-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-700",
  RESCHEDULED: "bg-fuchsia-100 text-fuchsia-800",
};

export function StatusBadge({ status }: { status: JobStatus }) {
  const style = STATUS_STYLE[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {JOB_STATUS_LABEL[status] ?? status}
    </span>
  );
}
