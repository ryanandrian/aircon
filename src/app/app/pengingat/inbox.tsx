"use client";

/**
 * Inbox Pengingat — mobile-first (sesuai pola Booking Online / leads/).
 *
 * G-A10 (2026-10-14, keputusan pemilik): filter dipindah ke SERVER + cursor
 * pagination (pola persis pelanggan/faktur/pekerjaan — standar repo).
 * Sebelumnya: semua unit due dimuat sekaligus lalu difilter via useMemo di
 * client (berat utk tenant dgn banyak unit — Jaya Mandiri = 142 unit due).
 *
 * Aksi (Tutup Pengingat / Tandai Terkirim) tetap optimis di state lokal —
 * perilaku TIDAK berubah; server action-nya juga tidak disentuh.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/icons";
import { actionCloseReminder, actionMarkReminderSentManual, actionLoadReminderInbox } from "./actions";
import type { ReminderInboxSendStatus } from "@/lib/services/reminder-service";

export type ReminderInboxItem = {
  assetId: string;
  brand: string | null;
  model: string | null;
  capacityPk: number | null;
  roomLocation: string | null;
  nextServiceDate: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  reminderId: string | null;
  reminderStatus: string | null;
  sendStatus: "BELUM_DIKIRIM" | "MENUNGGU_KRIM" | "TERKIRIM_OTOMATIS" | "TERKIRIM_MANUAL" | "DITERIMA" | "DIBACA" | "GAGAL" | "TIDAK_DIKETAHUI" | "DITUTUP";
  messageLogId: string | null;
  sentAt: string | null;
  overdueDays: number;
  waLink: string;
  waLinkPesan: string;
};

export type Filter = "SEMUA" | "BELUM" | "MENUNGGU" | "SENT" | "GAGAL" | "TIDAK_DIKETAHUI" | "DITUTUP";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "SEMUA", label: "Semua" },
  { id: "BELUM", label: "Belum dikirim" },
  { id: "MENUNGGU", label: "Menunggu" },
  { id: "SENT", label: "Terkirim" },
  { id: "GAGAL", label: "Gagal" },
  { id: "TIDAK_DIKETAHUI", label: "Tidak diketahui" },
  { id: "DITUTUP", label: "Ditutup" },
];

/** Label status — kelas seragam sesuai pola inbox leads (lead-inbox.tsx), tanpa varian warna baru. */
const STATUS: Record<ReminderInboxItem["sendStatus"], string> = {
  BELUM_DIKIRIM: "Belum dikirim",
  MENUNGGU_KRIM: "Menunggu antrean",
  TERKIRIM_OTOMATIS: "Terkirim otomatis",
  TERKIRIM_MANUAL: "Terkirim manual",
  DITERIMA: "Diterima WhatsApp",
  DIBACA: "Dibaca",
  GAGAL: "Gagal dikirim",
  TIDAK_DIKETAHUI: "Status tidak diketahui",
  DITUTUP: "Ditutup",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function ReminderInbox({
  initialItems,
  showClosed,
  activeFilter,
  initialCursor,
  initialTotal,
  sendStatus,
  initialQ,
}: {
  initialItems: ReminderInboxItem[];
  showClosed: boolean;
  activeFilter: Filter;
  initialCursor: string | null;
  initialTotal: number;
  /** G-A10: pemetaan status filter aktif dari server — WAJIB ikut lazy-load,
   *  agar batch berikutnya tetap terfilter (dulu dikirim tanpa ini -> bocor). */
  sendStatus?: ReminderInboxSendStatus[];
  /** G-A10+: pencarian nama pelanggan dari URL (server sudah menerapkannya ke daftar). */
  initialQ?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [q, setQ] = useState(initialQ ?? "");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // React docs pattern (pola persis agenda-board): sinkronkan state lokal saat
  // props server berubah — hasil debounce pencarian & back/forward. Tanpa blok ini
  // useState(*) mengabaikan props baru sehingga daftar tidak ikut berubah.
  const serverQ = initialQ ?? "";
  const [previousServerData, setPreviousServerData] = useState({
    items: initialItems,
    cursor: initialCursor,
    total: initialTotal,
    q: serverQ,
  });
  if (
    previousServerData.items !== initialItems ||
    previousServerData.cursor !== initialCursor ||
    previousServerData.total !== initialTotal ||
    previousServerData.q !== serverQ
  ) {
    setPreviousServerData({ items: initialItems, cursor: initialCursor, total: initialTotal, q: serverQ });
    setItems(initialItems);
    setCursor(initialCursor);
    setTotal(initialTotal);
    if (q !== serverQ) setQ(serverQ);
  }

  // Bangun URL pengingat dari keadaan saat ini — pencarian q SELALU ikut supaya
  // ketikan tidak hilang saat pengguna mengganti filter/riwayat.
  const inboxUrl = useCallback(
    (nextFilter: Filter, nextQ: string) => {
      const params = new URLSearchParams();
      if (showClosed) params.set("riwayat", "1");
      if (nextFilter !== "SEMUA") params.set("filter", nextFilter);
      const trimmed = nextQ.trim();
      if (trimmed) params.set("q", trimmed);
      const qs = params.toString();
      return qs ? `/app/pengingat?${qs}` : "/app/pengingat";
    },
    [showClosed],
  );

  // G-A10: ganti filter = navigasi URL (searchParams) — server yang memilah.
  function selectFilter(id: Filter) {
    router.push(inboxUrl(id, q));
  }

  // Pencarian nama pelanggan: debounce 350ms → URL (pola persis agenda-board).
  // Guard q === serverQ: perubahan berasal dari sinkronisasi server (back/forward /
  // navigasi lain), bukan ketikan pengguna → tidak navigasi balik ke teks lama.
  useEffect(() => {
    if (q === serverQ) return;
    const t = setTimeout(() => router.replace(inboxUrl(activeFilter, q), { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [q, serverQ, activeFilter, inboxUrl, router]);

  // G-A10: muat batch berikutnya (pola persis customer-manager: cursor + sentinel).
  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await actionLoadReminderInbox({ cursor, includeClosed: showClosed, sendStatus, q: q.trim() || undefined });
    if (res.ok && res.rows) {
      // action sudah mengirim tipe ReminderInboxActionItem: tanggal string,
      // waLinkPesan sudah dihitung di server — tinggal pakai apa adanya.
      const rows: ReminderInboxItem[] = res.rows;
      setItems((prev) => [...prev, ...rows]);
      setCursor(res.nextCursor ?? null);
      if (typeof res.totalCount === "number") setTotal(res.totalCount);
    } else if (!res.ok) {
      toast.error(res.error ?? "Gagal memuat pengingat berikutnya.");
    }
    setLoadingMore(false);
  }, [cursor, loadingMore, showClosed, sendStatus, q]);

  // Infinite scroll via IntersectionObserver (pola customer-manager).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  async function closeReminder(item: ReminderInboxItem) {
    if (!item.reminderId) {
      toast.error("Pengingat belum tercatat; tidak ada yang bisa ditutup.");
      return;
    }
    setBusyId(item.assetId);
    try {
      const result = await actionCloseReminder(item.reminderId);
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Pengingat ditutup");
      setTotal((t) => Math.max(0, t - 1));
      if (!showClosed) setItems((current) => current.filter((row) => row.assetId !== item.assetId));
      else setItems((current) => current.map((row) => row.assetId === item.assetId ? { ...row, reminderStatus: "DISMISSED", sendStatus: "DITUTUP" } : row));
    } finally {
      setBusyId(null);
    }
  }

  async function markSentManual(item: ReminderInboxItem) {
    // Dua kasus: baris pengingat sudah ada (reminderId), atau belum (BELUM_DIKIRIM =
    // unit due tanpa RepeatReminder) -> action membuat barisnya via assetId+dueDate.
    if (!item.reminderId && !item.nextServiceDate) {
      toast.error("Jadwal servis tidak tersedia untuk ditandai.");
      return;
    }
    setBusyId(item.assetId);
    try {
      const result = await actionMarkReminderSentManual(item.reminderId, {
        assetId: item.assetId,
        dueDate: item.nextServiceDate,
      });
      if (!result.ok) { toast.error(result.error); return; }
      toast.success("Ditandai terkirim manual");
      setItems((current) =>
        current.map((row) =>
          row.assetId === item.assetId
            ? { ...row, reminderStatus: "SENT", sendStatus: "TERKIRIM_MANUAL" }
            : row,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pencarian nama pelanggan — Input seragam dgn halaman pekerjaan/pelanggan
          (ukuran sentuh 44px di HP). Hasil = server-side via URL (debounce 350ms). */}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama pelanggan…"
        aria-label="Cari pengingat berdasarkan nama pelanggan"
        className="min-h-[44px] rounded-xl sm:min-h-9"
      />
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter pengingat">
        {FILTERS.filter((f) => f.id !== "DITUTUP" || showClosed).map((f) => (
          <Button key={f.id} type="button" size="sm" variant={activeFilter === f.id ? "default" : "outline"}
            onClick={() => selectFilter(f.id)} aria-pressed={activeFilter === f.id} className="shrink-0">
            {f.label}{activeFilter === f.id ? ` (${total})` : ""}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {total === 0
            ? q.trim()
              ? "Tidak ada pengingat yang cocok dengan pencarian."
              : "Belum ada unit yang masuk jadwal pengingat."
            : "Tidak ada pengingat pada filter ini."}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const unit = [item.brand, item.model].filter(Boolean).join(" ").trim() || "Unit AC";
            return (
              <Card key={item.assetId}>
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                      <Icon.AC className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{unit}</h2>
                        <Badge variant="secondary">{item.overdueDays > 0 ? `Lewat ${item.overdueDays} hari` : "Jatuh tempo"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[item.capacityPk ? `${item.capacityPk} PK` : null, item.roomLocation].filter(Boolean).join(" · ") || "Lokasi belum diisi"}
                      </p>
                      <p className="mt-1 text-sm font-medium">{item.customerName}</p>
                      <p className="text-xs text-muted-foreground">{item.customerPhone}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <span>Jadwal servis: <b>{formatDate(item.nextServiceDate)}</b></span>
                    <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{STATUS[item.sendStatus]}</span>
                  </div>
                  {item.sentAt && <p className="text-xs text-muted-foreground">Pengingat masuk antrean {new Date(item.sentAt).toLocaleString("id-ID")}</p>}

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <a href={item.waLinkPesan} target="_blank" rel="noopener noreferrer" aria-label={`Kirim pengingat kepada ${item.customerName}`}>
                      <Button type="button" size="sm"><Icon.Message className="mr-1.5 h-4 w-4" aria-hidden />Kirim Pengingat</Button>
                    </a>
                    <a href={item.waLink} target="_blank" rel="noopener noreferrer" aria-label={`Buka WhatsApp ${item.customerName}`}>
                      <Button type="button" size="sm" variant="outline"><Icon.Send className="mr-1.5 h-4 w-4" aria-hidden />Buka WhatsApp</Button>
                    </a>
                    <Link href={`/app/pelanggan/${item.customerId}`}>
                      <Button type="button" size="sm" variant="outline"><Icon.Users className="mr-1.5 h-4 w-4" aria-hidden />Pelanggan</Button>
                    </Link>
                    <Link href={`/app/pekerjaan/baru?assetId=${encodeURIComponent(item.assetId)}&customerId=${encodeURIComponent(item.customerId)}&reminderId=${encodeURIComponent(item.reminderId ?? "")}`}>
                      <Button type="button" size="sm" variant="outline"><Icon.Job className="mr-1.5 h-4 w-4" aria-hidden />Jadikan Pekerjaan</Button>
                    </Link>
                    {!showClosed && (item.reminderId || item.nextServiceDate) && ["BELUM_DIKIRIM", "MENUNGGU_KRIM", "TIDAK_DIKETAHUI"].includes(item.sendStatus) && (
                      <Button type="button" size="sm" variant="outline" disabled={busyId === item.assetId} onClick={() => void markSentManual(item)}>
                        <Icon.Check className="mr-1.5 h-4 w-4" aria-hidden />Tandai Terkirim
                      </Button>
                    )}
                    {!showClosed && item.reminderId && item.reminderStatus !== "CONVERTED" && (
                      <Button type="button" size="sm" variant="ghost" disabled={busyId === item.assetId} onClick={() => void closeReminder(item)}>
                        <Icon.Close className="mr-1.5 h-4 w-4" aria-hidden />Tutup Pengingat
                      </Button>
                    )}
                  </div>

                  <ServiceHistory assetId={item.assetId} />
                </CardContent>
              </Card>
            );
          })}

          {/* Sentinel infinite-scroll (pola customer-manager) */}
          {cursor && (
            <div ref={sentinelRef} className="space-y-2 pt-1">
              {loadingMore ? (
                <p className="py-2 text-center text-sm text-muted-foreground">Memuat pengingat berikutnya…</p>
              ) : (
                <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => void loadMore()}>
                  Muat lebih banyak
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {!showClosed && <div className="text-center">
        <Link href="/app/pengingat?riwayat=1" className="text-sm text-sky-700 underline underline-offset-4 dark:text-sky-300">Lihat riwayat pengingat yang ditutup</Link>
      </div>}
    </div>
  );
}

function ServiceHistory({ assetId }: { assetId: string }) {
  const [items, setItems] = useState<null | { serviceType: string; status: string; date: string | null; notes: string | null }[]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (items !== null || loading) return;
    setLoading(true);
    try {
      const { actionUnitHistory } = await import("@/app/app/pelanggan/actions");
      const result = await actionUnitHistory(assetId);
      if (!result.ok) setError(result.error ?? "Gagal memuat riwayat servis.");
      else setItems(result.items ?? []);
    } catch {
      setError("Gagal memuat riwayat servis.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="border-t pt-2" onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void load(); }}>
      <summary className="cursor-pointer py-1 text-sm font-medium">Riwayat Servis Unit</summary>
      <div className="space-y-2 py-2">
        {loading && <p className="text-sm text-muted-foreground">Memuat riwayat…</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        {items?.length === 0 && <p className="text-sm text-muted-foreground">Belum ada riwayat servis.</p>}
        {items?.map((row, i) => (
          <div key={`${row.serviceType}-${i}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
            <span className="font-medium">{row.serviceType} <Badge variant="secondary" className="ml-1">{row.status}</Badge></span>
            <span className="text-xs text-muted-foreground">{formatDate(row.date)}</span>
            {row.notes && <p className="w-full text-xs text-muted-foreground">{row.notes}</p>}
          </div>
        ))}
      </div>
    </details>
  );
}
