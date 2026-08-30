"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { StatusBadge } from "./status-badge";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { actionLoadJobs, actionCountJobs, type JobListItem } from "./actions";

type Bucket = "today" | "upcoming" | "done";
type Counts = { today: number; upcoming: number; done: number };

const TABS: { key: Bucket; label: string }[] = [
  { key: "today", label: "Hari ini" },
  { key: "upcoming", label: "Akan datang" },
  { key: "done", label: "Telah selesai" },
];

const EMPTY_TEXT: Record<Bucket, string> = {
  today: "Tidak ada pekerjaan untuk hari ini.",
  upcoming: "Belum ada jadwal berikutnya.",
  done: "Belum ada pekerjaan selesai.",
};

function fmtTanggal(iso: string | null): string {
  if (!iso) return "Jadwal belum diatur";
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtJam(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function JobsBoard({
  initialBucket, initialSearch = "", initialItems, initialCursor, initialCounts,
}: {
  initialBucket: Bucket; initialSearch?: string; initialItems: JobListItem[]; initialCursor: string | null; initialCounts: Counts;
}) {
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [q, setQ] = useState(initialSearch);
  const [items, setItems] = useState<JobListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const reqId = useRef(0);
  const firstRun = useRef(true);

  // Muat ulang saat ganti tab atau pencarian. Lewati run pertama (pakai data server awal).
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const rid = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await actionLoadJobs(bucket, { search: q.trim() || undefined });
      if (rid !== reqId.current) return; // balapan: abaikan hasil basi
      setLoading(false);
      if (!res.ok) { toast.error(res.error); return; }
      setItems(res.items);
      setCursor(res.nextCursor);
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [bucket, q]);

  // Perbarui hitungan tab saat pencarian berubah (debounce).
  useEffect(() => {
    if (firstRun.current) return;
    const t = setTimeout(async () => {
      const res = await actionCountJobs(q.trim() || undefined);
      if (res.ok) setCounts(res.counts);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await actionLoadJobs(bucket, { search: q.trim() || undefined, cursor });
    setLoadingMore(false);
    if (!res.ok) { toast.error(res.error); return; }
    setItems((prev) => [...prev, ...res.items]);
    setCursor(res.nextCursor);
  }, [cursor, loadingMore, bucket, q]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((e) => { if (e[0]?.isIntersecting) loadMore(); }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-muted p-1">
        {TABS.map((t) => {
          const active = bucket === t.key;
          const n = counts[t.key];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setBucket(t.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition ${
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="truncate">{t.label}</span>
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${active ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" : "bg-foreground/10"}`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Pencarian */}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama atau nomor HP pelanggan…"
        className="h-11 rounded-xl"
      />

      {/* Daftar */}
      {loading ? (
        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[92px] animate-pulse rounded-xl bg-muted" />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q ? "Tidak ada pekerjaan yang cocok dengan pencarian." : EMPTY_TEXT[bucket]}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {items.map((job) => <li key={job.id}><JobCard job={job} /></li>)}
          {cursor && <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">Memuat lagi…</div>}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job }: { job: JobListItem }) {
  const jam = fmtJam(job.scheduledDate);
  return (
    <Link
      href={`/app/pekerjaan/${job.id}`}
      className="block rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-sky-300 hover:shadow-sm dark:hover:ring-sky-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-foreground">{job.customerName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{SERVICE_TYPE_LABEL[job.serviceType] ?? job.serviceType}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>
      {job.address && (
        <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Icon.Location className="h-3.5 w-3.5 shrink-0" aria-hidden /> {job.address}</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Icon.Calendar className="h-3.5 w-3.5" aria-hidden /> {fmtTanggal(job.scheduledDate)}{jam ? ` · ${jam}` : ""}</span>
        {job.unit && <span className="flex items-center gap-1.5"><Icon.AC className="h-3.5 w-3.5" aria-hidden /> {job.unit}</span>}
        <span className="flex items-center gap-1.5"><Icon.Technician className="h-3.5 w-3.5" aria-hidden /> {job.technician ?? "Belum ada teknisi"}</span>
      </div>
    </Link>
  );
}
