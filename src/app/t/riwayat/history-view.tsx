"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { techJobHistory } from "../actions";

type Row = { id: string; date: string | null; customer: string; unit: string; role: "TECHNICIAN" | "KERNET"; service: string; status: string; incentive: number };

const SERVICE_LABEL: Record<string, string> = {
  CLEANING: "Cuci AC", REFILL_FREON: "Isi Freon", REPAIR: "Perbaikan",
  INSTALL: "Pasang Baru", DISMANTLE: "Bongkar", INSPECTION: "Pengecekan", OTHER: "Lainnya",
};
const JOB_STATUS: Record<string, string> = {
  DRAFT: "Draf", ASSIGNED: "Ditugaskan", ACCEPTED: "Diterima", EN_ROUTE: "Menuju",
  ARRIVED: "Tiba", IN_PROGRESS: "Dikerjakan", WAITING: "Menunggu", COMPLETED: "Selesai", CANCELLED: "Batal",
};
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
function fmtPeriod(p: string): string {
  const [y, m] = p.split("-");
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return `${bulan[Number(m) - 1] ?? m} ${y}`;
}
const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function JobHistoryView({
  technicianId, initialRows, initialPeriods, initialTotal,
}: {
  technicianId: string; initialRows: Row[]; initialPeriods: string[]; initialTotal: number;
}) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [periods] = useState<string[]>(initialPeriods);
  const [period, setPeriod] = useState("ALL");
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  async function changePeriod(p: string | null) {
    const v = p ?? "ALL";
    setPeriod(v);
    setLoading(true);
    const res = await techJobHistory(v === "ALL" ? undefined : v);
    setLoading(false);
    if (!res.ok) { toast.error(res.error); return; }
    setRows(res.rows);
    setTotal(res.totalIncentive);
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan insentif */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 p-4 text-white shadow-sm">
        <p className="text-sm text-white/80">Total insentif {period === "ALL" ? "(semua periode)" : fmtPeriod(period)}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">{rp(total)}</p>
        <p className="mt-1 text-xs text-white/70">Insentif dihitung setelah invoice pelanggan LUNAS.</p>
      </div>

      {/* Filter periode */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{rows.length} pekerjaan</p>
        <Select value={period} onValueChange={changePeriod}>
          <SelectTrigger className="h-11 w-44 rounded-xl">
            <SelectValue>{(v: string | null) => (v && v !== "ALL" ? fmtPeriod(v) : "Semua periode")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua periode</SelectItem>
            {periods.map((p) => <SelectItem key={p} value={p}>{fmtPeriod(p)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Daftar pekerjaan (kartu per baris, ramah HP) */}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Memuat…</p>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pekerjaan{period !== "ALL" ? " pada periode ini" : ""}.</p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="rounded-xl border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{i + 1}. {r.customer}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(r.date)} · {r.unit}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold tabular-nums ${r.incentive > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                    {r.incentive > 0 ? rp(r.incentive) : "—"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant={r.role === "KERNET" ? "secondary" : "outline"}>{r.role === "KERNET" ? "Kernet" : "Teknisi"}</Badge>
                <Badge variant="outline">{SERVICE_LABEL[r.service] ?? r.service}</Badge>
                <Badge variant={r.status === "COMPLETED" ? "secondary" : "outline"}>{JOB_STATUS[r.status] ?? r.status}</Badge>
                {r.incentive === 0 && r.status === "COMPLETED" && (
                  <span className="text-xs text-muted-foreground">insentif menunggu pelunasan</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
