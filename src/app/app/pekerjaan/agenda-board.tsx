"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "./status-badge";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { actionLoadAgenda, type AgendaCounts, type AgendaJobItem, type AgendaPeople } from "./actions";
import {
  STATUS_FILTERS,
  agendaQueryString,
  agendaRangeLabel,
  agendaToday,
  fmtDurasi,
  fmtJam,
  groupByDay,
  shiftAgenda,
  type AgendaParams,
  type AgendaView,
} from "@/lib/domain/agenda";

const VIEWS: { value: AgendaView; label: string }[] = [
  { value: "week", label: "Minggu" },
  { value: "month", label: "Bulan" },
  { value: "riwayat", label: "Riwayat" },
];

const EMPTY_TITLE: Record<AgendaParams["view"], string> = {
  week: "Tidak ada pekerjaan pada pekan ini",
  month: "Tidak ada pekerjaan pada bulan ini",
  riwayat: "Belum ada riwayat pekerjaan",
};

const EMPTY_DESC: Record<AgendaParams["view"], string> = {
  week: "Pekan ini bersih. Geser periode atau buat pekerjaan baru.",
  month: "Bulan ini bersih. Geser periode atau buat pekerjaan baru.",
  riwayat: "Pekerjaan yang selesai dan dibatalkan akan tampil di sini.",
};

export function AgendaBoard({
  initialParams,
  initialItems,
  initialCursor,
  initialCounts,
  people,
}: {
  initialParams: AgendaParams;
  initialItems: AgendaJobItem[];
  initialCursor: string | null;
  initialCounts: AgendaCounts;
  people: AgendaPeople;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [params, setParams] = useState<AgendaParams>(initialParams);
  const [items, setItems] = useState<AgendaJobItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [counts, setCounts] = useState<AgendaCounts>(initialCounts);
  const [q, setQ] = useState(initialParams.q);
  const [loadingMore, setLoadingMore] = useState(false);

  // React docs pattern: adjust state when server props change (e.g. browser back/forward).
  // Guarded render-time update; unlike setState inside an effect, avoids an extra stale paint.
  const [previousServerData, setPreviousServerData] = useState({
    params: initialParams,
    items: initialItems,
    cursor: initialCursor,
    counts: initialCounts,
  });
  if (
    previousServerData.params !== initialParams ||
    previousServerData.items !== initialItems ||
    previousServerData.cursor !== initialCursor ||
    previousServerData.counts !== initialCounts
  ) {
    setPreviousServerData({ params: initialParams, items: initialItems, cursor: initialCursor, counts: initialCounts });
    setParams(initialParams);
    setItems(initialItems);
    setCursor(initialCursor);
    setCounts(initialCounts);
    if (q !== initialParams.q) setQ(initialParams.q);
  }

  // Navigasi = ganti URL. Page (force-dynamic) me-render ulang → server mengirim
  // data segar; state di atas otomatis disinkronkan dari props saat render berikutnya.
  const navigate = useCallback(
    (next: AgendaParams) => {
      // Optimis: label filter/periode langsung mencerminkan pilihan pengguna.
      // Data daftar menyusul (dibuat redup selama pending) — menghindari Select
      // yang seolah kembali ke pilihan lama, sekaligus membatalkan debounce
      // pencarian yang masih tertunda (guard `q === params.q` jadi aktif).
      setParams(next);
      startTransition(() => {
        router.replace(`/app/pekerjaan?${agendaQueryString(next)}`, { scroll: false });
      });
    },
    [router],
  );

  // Semua interaksi memakai q yang sedang diketik (jangan sampai ketikan hilang
  // saat pengguna sekalian menggeser periode).
  const withQ = useCallback(
    (patch: Partial<AgendaParams>): AgendaParams => ({ ...params, q, ...patch }),
    [params, q],
  );

  // Pencarian: debounce 350ms → URL (lihat jobs-board lama; pola sama).
  // Guard q === params.q = perubahan berasal dari sinkronisasi server
  // (back/forward / hasil navigasi), bukan ketikan pengguna → tidak navigasi balik.
  useEffect(() => {
    if (q === params.q) return;
    const t = setTimeout(() => navigate(withQ({})), 350);
    return () => clearTimeout(t);
  }, [q, params.q, navigate, withQ]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const sp = Object.fromEntries(new URLSearchParams(agendaQueryString(params)));
    const res = await actionLoadAgenda(sp, { cursor });
    setLoadingMore(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems((prev) => [...prev, ...res.data.items]);
    setCursor(res.data.nextCursor);
  }, [cursor, loadingMore, params]);

  const filtered = q.trim() !== "" || params.tim !== "" || params.status !== "SEMUA";
  const clearHref = `/app/pekerjaan?${agendaQueryString({ ...params, q: "", tim: "", status: "SEMUA" })}`;

  const groups = groupByDay(items, {
    dateOf: (row) => row.scheduledDate,
    desc: params.view === "riwayat",
  });

  return (
    <div className="space-y-4">
      {/* Ringkasan periode — kartu seragam dgn dashboard (ikon berwarna, angka tebal). */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Ringkasan pekerjaan">
        <Metric icon={Icon.Calendar} label="Pekerjaan periode ini" value={counts.total} />
        <Metric icon={Icon.Clock} label="Hari ini" value={counts.today} />
        <Metric
          icon={Icon.Technician}
          label="Belum ada tim"
          value={counts.noTeam}
          tone={counts.noTeam > 0 ? "amber" : "sky"}
        />
        <Metric icon={Icon.Check} label="Selesai" value={counts.done} tone="emerald" />
      </section>

      {/* Tampilan: Minggu / Bulan / Riwayat */}
      <Tabs
        value={params.view}
        onValueChange={(v) => navigate(withQ({ view: v as AgendaParams["view"] }))}
      >
        <TabsList className="w-full">
          {VIEWS.map((v) => (
            <TabsTrigger key={v.value} value={v.value} className="min-h-9 flex-1">
              {v.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Navigasi periode (tersembunyi di Riwayat — tanpa periode untuk digeser). */}
      {params.view !== "riwayat" && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            aria-label="Periode sebelumnya"
            className="min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9"
            onClick={() => navigate(withQ(shiftAgenda(params, -1)))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <p className="min-w-0 flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
            {agendaRangeLabel(params)}
          </p>
          <Button
            type="button"
            variant="outline"
            aria-label="Periode berikutnya"
            className="min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9"
            onClick={() => navigate(withQ(shiftAgenda(params, 1)))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] shrink-0 px-3 sm:h-9"
            onClick={() => navigate(withQ(agendaToday(params)))}
          >
            Hari ini
          </Button>
        </div>
      )}
      {params.view === "riwayat" && (
        <p className="text-center text-sm font-semibold text-foreground">Seluruh riwayat</p>
      )}

      {/* Pencarian + filter tim & status — ukuran sentuh 44px di HP. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama / telepon pelanggan atau unit…"
          aria-label="Cari pekerjaan"
          className="min-h-[44px] rounded-xl sm:min-h-9 sm:flex-1"
        />
        <Select
          value={params.tim || "SEMUA"}
          onValueChange={(v) => navigate(withQ({ tim: !v || v === "SEMUA" ? "" : v }))}
        >
          <SelectTrigger className="min-h-[44px] w-full rounded-xl sm:h-9 sm:w-52">
            <span className="sr-only">Saring berdasarkan tim</span>
            <SelectValue placeholder="Semua tim" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua tim</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.status}
          onValueChange={(v) =>
            navigate(withQ({ status: (v ?? "SEMUA") as AgendaParams["status"] }))
          }
        >
          <SelectTrigger className="min-h-[44px] w-full rounded-xl sm:h-9 sm:w-48">
            <span className="sr-only">Saring berdasarkan status</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.key} value={f.key}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Peringatan operasional — pekerjaan yang gampang terlewat (masih berjalan). */}
      {(counts.noTeam > 0 || counts.noSchedule > 0) && (
        <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
              <Icon.Alert className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">
                {counts.noTeam > 0 && `${counts.noTeam} pekerjaan belum ada tim`}
                {counts.noTeam > 0 && counts.noSchedule > 0 && " · "}
                {counts.noSchedule > 0 && `${counts.noSchedule} belum terjadwal`}
              </p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
                Masih berjalan — buka pekerjaannya untuk menugaskan tim atau mengatur jadwal.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Isi agenda */}
      <div aria-busy={pending} className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {items.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={Icon.Job}
              title="Tidak ada yang cocok"
              desc="Coba ubah kata kunci atau filter status/tim."
              actionHref={clearHref}
              actionLabel="Hapus filter"
            />
          ) : (
            <EmptyState
              icon={Icon.Job}
              title={EMPTY_TITLE[params.view]}
              desc={EMPTY_DESC[params.view]}
              actionHref="/app/pekerjaan/baru"
              actionLabel="+ Pekerjaan"
            />
          )
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <section key={group.key} aria-label={group.label}>
                {/* Kepala hari */}
                <div className="mb-2 flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                    <span className="text-sm font-bold leading-none tabular-nums">{group.box.top}</span>
                    {group.box.bottom && (
                      <span className="mt-0.5 text-[10px] font-medium uppercase leading-none">
                        {group.box.bottom}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-foreground">{group.label}</h2>
                    <p className="text-xs text-muted-foreground">
                      {group.jobs.length} pekerjaan
                    </p>
                  </div>
                </div>

                <ul className="space-y-2">
                  {group.jobs.map((job) => (
                    <li key={job.id}>
                      <AgendaRow job={job} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {cursor && (
              <div className="pt-1 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] w-full sm:h-9 sm:w-auto"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Memuat…" : "Muat lebih banyak"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Kartu ringkasan — pola Metric pada dashboard (ikon + angka + label). */
function Metric({
  icon: IconCmp,
  label,
  value,
  tone = "sky",
}: {
  icon: typeof Icon.Calendar;
  label: string;
  value: number;
  tone?: "sky" | "amber" | "emerald";
}) {
  const toneClass = {
    sky: "text-sky-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className={toneClass}>
        <IconCmp className="h-6 w-6" aria-hidden />
      </span>
      <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

/** Satu baris pekerjaan — seluruh kartu tertaut ke halaman detail yang sudah ada. */
function AgendaRow({ job }: { job: AgendaJobItem }) {
  const mulai = job.scheduledDate;
  const selesai = job.windowEnd;
  const durasi =
    mulai && selesai
      ? fmtDurasi(Math.round((new Date(selesai).getTime() - new Date(mulai).getTime()) / 60000))
      : null;

  const teknisi = job.technicians.length > 0 ? job.technicians : job.legacyTechnician ? [job.legacyTechnician] : [];
  const tanpaTim = teknisi.length === 0 && job.kernets.length === 0;

  const layanan = SERVICE_TYPE_LABEL[job.serviceType] ?? job.serviceType;
  const barisUnit = job.unit ? `${job.unit} · ${layanan}` : layanan;

  return (
    <Link
      href={`/app/pekerjaan/${job.id}`}
      className="block rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition hover:ring-sky-300 dark:hover:ring-sky-800"
    >
      <div className="flex gap-3">
        {/* Waktu */}
        <div className="w-16 shrink-0">
          {mulai ? (
            <>
              <p className="text-sm font-bold tabular-nums text-foreground">{fmtJam(mulai)}</p>
              {selesai && (
                <p className="text-xs tabular-nums text-muted-foreground">– {fmtJam(selesai)}</p>
              )}
              {durasi && <p className="mt-0.5 text-[11px] text-muted-foreground">{durasi}</p>}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Belum diatur</p>
          )}
        </div>

        {/* Isi */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate font-semibold text-foreground">{job.customerName}</p>
            <StatusBadge status={job.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">{barisUnit}</p>

          {/* Tim: teknisi + kernet (fallback teknisi legacy bila belum ada penugasan). */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tanpaTim ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                <Icon.Alert className="h-3.5 w-3.5" aria-hidden />
                Belum ada tim
              </span>
            ) : (
              <>
                {teknisi.map((name, index) => (
                  <PersonChip key={`t-${index}`} role="Teknisi" name={name} />
                ))}
                {job.kernets.map((name, index) => (
                  <PersonChip key={`k-${index}`} role="Kernet" name={name} />
                ))}
              </>
            )}
          </div>

          {job.address && (
            <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <Icon.Location className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{job.address}</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

function PersonChip({ role, name }: { role: "Teknisi" | "Kernet"; name: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
      <span className="shrink-0 font-medium text-muted-foreground">{role}</span>
      <span className="truncate font-medium">{name}</span>
    </span>
  );
}
