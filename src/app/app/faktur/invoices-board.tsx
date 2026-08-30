"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { actionLoadInvoices, actionCountInvoices, type InvoiceListItem } from "./actions";

type Bucket = "proforma" | "unpaid" | "paid" | "all";
type Counts = { proforma: number; unpaid: number; paid: number; all: number };

const TABS: { key: Bucket; label: string }[] = [
  { key: "proforma", label: "Perlu Ditagih" },
  { key: "unpaid", label: "Belum Lunas" },
  { key: "paid", label: "Lunas" },
  { key: "all", label: "Semua" },
];

const EMPTY_TEXT: Record<Bucket, string> = {
  proforma: "Tidak ada proforma yang menunggu dibuat invoice.",
  unpaid: "Tidak ada invoice yang belum lunas. 🎉",
  paid: "Belum ada invoice lunas.",
  all: "Belum ada dokumen. Otomatis dibuat saat teknisi menutup sesi pekerjaan.",
};

const STATUS: Record<string, string> = { DRAFT: "Draf", ISSUED: "Terbit", PAID: "Lunas", OVERDUE: "Jatuh Tempo", CANCELLED: "Batal" };
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function InvoicesBoard({
  initialBucket, initialItems, initialCursor, initialCounts,
}: {
  initialBucket: Bucket; initialItems: InvoiceListItem[]; initialCursor: string | null; initialCounts: Counts;
}) {
  const [bucket, setBucket] = useState<Bucket>(initialBucket);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<InvoiceListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [counts, setCounts] = useState<Counts>(initialCounts);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const reqId = useRef(0);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const rid = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await actionLoadInvoices(bucket, { search: q.trim() || undefined });
      if (rid !== reqId.current) return;
      setLoading(false);
      if (!res.ok) { toast.error(res.error); return; }
      setItems(res.items);
      setCursor(res.nextCursor);
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [bucket, q]);

  useEffect(() => {
    if (firstRun.current) return;
    const t = setTimeout(async () => {
      const res = await actionCountInvoices(q.trim() || undefined);
      if (res.ok) setCounts(res.counts);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await actionLoadInvoices(bucket, { search: q.trim() || undefined, cursor });
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
          const urgent = t.key === "proforma" && n > 0;
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
              <span className={`rounded-full px-1.5 text-xs tabular-nums ${
                urgent ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                : active ? "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" : "bg-foreground/10"
              }`}>{n}</span>
            </button>
          );
        })}
      </div>

      {/* Pencarian */}
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nomor dokumen atau nama pelanggan…"
        className="h-11 rounded-xl"
      />

      {/* Petunjuk khusus tab Perlu Ditagih */}
      {bucket === "proforma" && items.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
          Proforma untuk pelanggan tempo. Buka untuk membuat invoice resmi & menagih.
        </p>
      )}

      {/* Daftar */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-[76px] animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : items.length === 0 ? (
        <Card className="border-dashed text-center">
          <CardContent className="p-8 text-sm text-muted-foreground">
            {q ? "Tidak ada dokumen yang cocok dengan pencarian." : EMPTY_TEXT[bucket]}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((inv) => {
            const isProforma = inv.docType === "PROFORMA";
            return (
              <Link key={inv.id} href={`/app/faktur/${inv.id}`} className="block">
                <Card className="interactive py-0">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                      <Icon.Billing className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-foreground">{inv.customerName}</span>
                        <Badge variant={isProforma ? "outline" : "secondary"} className="shrink-0">{isProforma ? "Proforma" : "Invoice"}</Badge>
                        <Badge variant={inv.status === "PAID" ? "secondary" : "outline"} className="shrink-0">{STATUS[inv.status] ?? inv.status}</Badge>
                      </div>
                      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{inv.number}</div>
                      <div className="text-xs text-muted-foreground">Terbit {fmt(inv.issueDate)}{inv.dueDate ? ` · Jatuh tempo ${fmt(inv.dueDate)}` : ""}</div>
                    </div>
                    <div className="shrink-0 text-right font-bold text-foreground">{rp(inv.total)}</div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {cursor && <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">Memuat lagi…</div>}
        </div>
      )}
    </div>
  );
}
