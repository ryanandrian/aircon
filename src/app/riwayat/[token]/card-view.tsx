"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/icons";
import { TenantLogo } from "@/components/tenant-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Unit = {
  id: string;
  brand: string | null;
  model: string | null;
  type: string;
  capacityPk: number | null;
  roomLocation: string | null;
  code: string | null;
  nextServiceDate: string | null;
  lastService: { date: string; activity: string } | null;
  history: { date: string; activity: string }[];
};
type Card = { customerName: string; tenantName: string; tenantLogoUrl: string; units: Unit[]; dueThisMonthCount: number };

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtShort = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) : "—";

const AC_TYPE_LABEL: Record<string, string> = {
  SPLIT: "Split", CASSETTE: "Cassette", STANDING: "Standing", WINDOW: "Window", CENTRAL: "Central", OTHER: "Lainnya",
};

type SortKey = "due" | "location" | "last";

/** Unit "jatuh tempo bulan ini" bila nextServiceDate berada di bulan & tahun berjalan (atau sudah lewat). */
function isDueThisMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() < now.getFullYear() ||
    (d.getFullYear() === now.getFullYear() && d.getMonth() <= now.getMonth());
}

/** Inisial merek untuk avatar (mis. "Daikin" → "DA"). */
function brandInitials(brand: string | null): string {
  const b = (brand ?? "AC").trim();
  const parts = b.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return b.slice(0, 2).toUpperCase();
}

export function CardView({ card }: { card: Card }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [open, setOpen] = useState<string | null>(null);

  const totalServices = useMemo(
    () => card.units.reduce((sum, u) => sum + u.history.length, 0),
    [card.units],
  );

  const units = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = card.units;
    if (s) {
      list = list.filter((u) =>
        [u.brand, u.model, u.roomLocation, u.code].some((f) => (f ?? "").toLowerCase().includes(s)),
      );
    }
    const sorted = [...list];
    if (sort === "due") {
      sorted.sort((a, b) => (a.nextServiceDate ?? "9999").localeCompare(b.nextServiceDate ?? "9999"));
    } else if (sort === "location") {
      sorted.sort((a, b) => (a.roomLocation ?? "").localeCompare(b.roomLocation ?? ""));
    } else {
      sorted.sort((a, b) => (b.lastService?.date ?? "").localeCompare(a.lastService?.date ?? ""));
    }
    return sorted;
  }, [card.units, q, sort]);

  return (
    <main className="min-h-screen bg-muted/30">
      {/* Hero premium — biru tua elegan, branding + 3 statistik (halaman publik untuk pelanggan) */}
      <div className="relative overflow-hidden bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-2xl" />
        <div className="relative mx-auto w-full max-w-2xl px-4 py-6 sm:px-5">
          <div className="flex items-center gap-3">
            <TenantLogo name={card.tenantName} logoUrl={card.tenantLogoUrl} size={44} className="rounded-xl border-2 border-white/70 shadow-md" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Dirawat oleh</p>
              <p className="truncate text-lg font-extrabold text-white">{card.tenantName}</p>
            </div>
          </div>
          <h1 className="mt-4 text-xl font-extrabold text-white">Kartu Perawatan AC</h1>
          <p className="text-sm text-white/80">{card.customerName}</p>
          <div className="mt-4 flex items-stretch gap-5">
            <div>
              <div className="text-2xl font-extrabold leading-none text-white tabular-nums">{card.units.length}</div>
              <div className="mt-1 text-[11px] text-white/75">Unit AC</div>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <div className="text-2xl font-extrabold leading-none tabular-nums text-amber-300">{card.dueThisMonthCount}</div>
              <div className="mt-1 text-[11px] text-white/75">Jatuh tempo bln ini</div>
            </div>
            <div className="w-px bg-white/20" />
            <div>
              <div className="text-2xl font-extrabold leading-none text-white tabular-nums">{totalServices}</div>
              <div className="mt-1 text-[11px] text-white/75">Total servis</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-4 py-5 pb-16 sm:px-5">
        {/* Pencarian + sorting */}
        {card.units.length > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Cari unit (merek, lokasi, kode)…" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 flex-1 rounded-xl" />
            <select
              value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-11 rounded-xl border bg-card px-3 text-sm"
              aria-label="Urutkan"
            >
              <option value="due">Jatuh tempo terdekat</option>
              <option value="location">Lokasi</option>
              <option value="last">Terakhir diservis</option>
            </select>
          </div>
        )}

        {/* Daftar unit — kartu ber-elevasi, unit jatuh tempo di-highlight, riwayat = timeline */}
        <div className="mt-4 space-y-2.5">
          {units.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              {card.units.length === 0 ? "Belum ada unit AC terdaftar." : "Tidak ada unit cocok."}
            </CardContent></Card>
          ) : units.map((u) => {
            const due = isDueThisMonth(u.nextServiceDate);
            const isOpen = open === u.id;
            return (
              <Card
                key={u.id}
                className={`interactive overflow-hidden ${due ? "border-amber-300 shadow-[0_4px_14px_-6px_rgba(217,119,6,0.25)] dark:border-amber-500/40" : ""}`}
              >
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => (o === u.id ? null : u.id))}
                    className="flex w-full items-center gap-3 p-3.5 text-left"
                    aria-expanded={isOpen}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-sm font-bold text-white">
                      {brandInitials(u.brand)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-bold text-foreground">
                          {(u.brand ?? "AC")}{u.capacityPk ? ` ${u.capacityPk} PK` : ""}
                        </span>
                        {u.code && <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{u.code}</span>}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {AC_TYPE_LABEL[u.type] ?? u.type}
                        </span>
                        {u.roomLocation && (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {u.roomLocation}
                          </span>
                        )}
                        {due ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-300">
                            <Icon.Alert className="h-3 w-3" aria-hidden /> Jatuh tempo {fmtShort(u.nextServiceDate)}
                          </span>
                        ) : u.nextServiceDate ? (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            Servis: {fmtShort(u.nextServiceDate)}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {u.history.length > 0 ? `${u.history.length} riwayat` : "Baru"}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon.ChevronRight className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden />
                  </button>

                  {isOpen && (
                    <div className="border-t bg-muted/20 px-4 pb-4 pt-3">
                      {u.lastService && (
                        <div className="mb-3 flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950/30">
                          <Icon.Wrench className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                          <div>
                            <span className="text-sky-700 dark:text-sky-300">Perawatan terakhir: </span>
                            <span className="font-semibold text-foreground">{fmtDate(u.lastService.date)} — {u.lastService.activity}</span>
                          </div>
                        </div>
                      )}
                      {u.history.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada catatan perawatan.</p>
                      ) : (
                        <ol className="relative ml-1.5 border-l-2 border-border pl-4">
                          {u.history.map((h, i) => (
                            <li key={i} className="relative pb-3 last:pb-0">
                              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" aria-hidden />
                              <div className="text-[11px] font-semibold text-muted-foreground">{fmtDate(h.date)}</div>
                              <div className="text-sm text-foreground">{h.activity}</div>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">Kartu perawatan digital · Ditenagai Aircon</p>
      </div>
    </main>
  );
}
