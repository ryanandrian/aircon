"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { actionUnitHistory, type UnitHistoryItem } from "../actions";

type Asset = {
  id: string; brand: string | null; model: string | null; type: string;
  capacityPk: number | null; roomLocation: string | null; nextServiceDate: string | null;
};
type Customer = { id: string; name: string; phone: string; address: string | null; customerType: string };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf", ASSIGNED: "Ditugaskan", ACCEPTED: "Diterima", EN_ROUTE: "Menuju",
  ARRIVED: "Tiba", IN_PROGRESS: "Dikerjakan", WAITING: "Menunggu", COMPLETED: "Selesai", CANCELLED: "Batal",
};

function unitTitle(a: Asset): string {
  const nm = [a.brand, a.model].filter(Boolean).join(" ").trim();
  return nm || a.roomLocation || "Unit AC";
}

export function CustomerHub({
  customer, assets, cardUrl, pricingCount, jobsCount,
}: {
  customer: Customer; assets: Asset[]; cardUrl: string | null; pricingCount: number; jobsCount: number;
}) {
  const waPhone = customer.phone.replace(/^0/, "62");

  return (
    <div className="space-y-6">
      {/* Identitas & kontak */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-foreground">{customer.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{customer.customerType === "BADAN" ? "Badan/Perusahaan" : "Perorangan"}</Badge>
                <span>{customer.phone}</span>
              </div>
              {customer.address && <p className="mt-1 text-sm text-muted-foreground">{customer.address}</p>}
            </div>
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white hover:bg-emerald-600"
            >
              <Icon.Web className="h-4 w-4" aria-hidden /> WhatsApp
            </a>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4 text-center">
            <div>
              <div className="text-lg font-bold tabular-nums text-foreground">{assets.length}</div>
              <div className="text-xs text-muted-foreground">Unit AC</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums text-foreground">{jobsCount}</div>
              <div className="text-xs text-muted-foreground">Pekerjaan</div>
            </div>
            <div>
              <div className="text-lg font-bold tabular-nums text-foreground">{pricingCount}</div>
              <div className="text-xs text-muted-foreground">Harga Khusus</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/app/pelanggan/${customer.id}/harga`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">
              <Icon.Catalog className="h-4 w-4" aria-hidden /> Harga Khusus
            </Link>
            <Link href={`/app/pekerjaan?customer=${customer.id}`} className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">
              <Icon.Job className="h-4 w-4" aria-hidden /> Pekerjaan
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Kartu Perawatan (link publik) */}
      {cardUrl && <MaintenanceCardShare url={cardUrl} />}

      {/* Unit AC pelanggan ini */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Unit AC ({assets.length})</h3>
        {assets.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada unit AC terdaftar untuk pelanggan ini.</CardContent></Card>
        ) : (
          <ul className="space-y-3">
            {assets.map((a) => <UnitRow key={a.id} asset={a} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function MaintenanceCardShare({ url }: { url: string }) {
  function copy() {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link disalin"),
      () => toast.error("Gagal menyalin"),
    );
  }
  return (
    <Card className="border-sky-100 bg-gradient-to-br from-sky-50 to-background dark:border-sky-900/40 dark:from-sky-950/30">
      <CardContent className="p-6">
        <h3 className="font-semibold text-foreground">Kartu Perawatan Online</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Bagikan link ini ke pelanggan — berisi semua unit + riwayat servis. Link permanen, otomatis ikut terkirim di pengingat WhatsApp.
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border bg-card px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{url}</span>
        </div>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={copy} className="gap-1.5">
            <Icon.Catalog className="h-4 w-4" aria-hidden /> Salin Link
          </Button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Kartu perawatan AC Anda: ${url}`)}`}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white hover:bg-emerald-600"
          >
            <Icon.Web className="h-4 w-4" aria-hidden /> Kirim via WhatsApp
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function UnitRow({ asset }: { asset: Asset }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<UnitHistoryItem[] | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && history === null) {
      setLoading(true);
      const res = await actionUnitHistory(asset.id);
      setLoading(false);
      if (res.ok && res.items) setHistory(res.items);
      else { setHistory([]); toast.error(res.error ?? "Gagal memuat riwayat"); }
    }
  }

  const meta = [
    asset.capacityPk ? `${asset.capacityPk} PK` : null,
    asset.roomLocation,
  ].filter(Boolean).join(" · ");

  return (
    <li>
      <Card className="overflow-hidden">
        <button type="button" onClick={toggle} className="interactive flex w-full items-center gap-3 p-4 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
            <Icon.AC className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-foreground">{unitTitle(asset)}</span>
            {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
          </span>
          {asset.nextServiceDate && (
            <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
              Servis berikut<br /><span className="font-medium text-foreground">{fmtDate(asset.nextServiceDate)}</span>
            </span>
          )}
          <Icon.ChevronRight className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
        </button>
        {open && (
          <div className="border-t bg-muted/30 px-4 py-3">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Riwayat Servis</div>
            {loading ? (
              <p className="py-3 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : history && history.length > 0 ? (
              <ul className="space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{h.serviceType}</span>
                        <Badge variant={h.status === "COMPLETED" ? "secondary" : "outline"}>{STATUS_LABEL[h.status] ?? h.status}</Badge>
                      </div>
                      {h.notes && <div className="mt-0.5 truncate text-xs text-muted-foreground">{h.notes}</div>}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{fmtDate(h.date)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">Belum ada riwayat servis untuk unit ini.</p>
            )}
          </div>
        )}
      </Card>
    </li>
  );
}
