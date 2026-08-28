"use client";

import { useState, useMemo } from "react";
import { Icon } from "@/components/icons";
import { TenantLogo } from "@/components/tenant-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const AC_TYPE_LABEL: Record<string, string> = {
  SPLIT: "Split", CASSETTE: "Cassette", STANDING: "Standing", WINDOW: "Window", CENTRAL: "Central", OTHER: "Lainnya",
};

type SortKey = "due" | "location" | "last";

export function CardView({ card }: { card: Card }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("due");
  const [open, setOpen] = useState<string | null>(null);

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
      <div aria-hidden className="h-24 bg-gradient-to-br from-sky-500 via-sky-600 to-cyan-500" />
      <div className="mx-auto -mt-12 w-full max-w-2xl px-4 pb-16 sm:px-5">
        {/* Branding tenant */}
        <div className="mb-4 flex items-center gap-3">
          <TenantLogo name={card.tenantName} logoUrl={card.tenantLogoUrl} size={44} className="border-2 border-background shadow" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Dirawat oleh</p>
            <p className="truncate font-semibold text-foreground">{card.tenantName}</p>
          </div>
        </div>
        {/* Ringkasan */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white">
                <Icon.AC className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Kartu Perawatan AC</h1>
                <p className="text-sm text-muted-foreground">{card.customerName}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <div className="flex-1 rounded-xl border bg-muted/40 p-3 text-center">
                <div className="text-2xl font-bold tabular-nums text-foreground">{card.units.length}</div>
                <div className="text-xs text-muted-foreground">Unit AC</div>
              </div>
              <div className="flex-1 rounded-xl border bg-amber-50 p-3 text-center dark:bg-amber-950/30">
                <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{card.dueThisMonthCount}</div>
                <div className="text-xs text-muted-foreground">Jatuh tempo bulan ini</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pencarian + sorting */}
        {card.units.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Cari unit (merek, lokasi, kode)…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1" />
            <select
              value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
              className="min-h-[44px] rounded-xl border bg-card px-3 text-sm"
              aria-label="Urutkan"
            >
              <option value="due">Jatuh tempo terdekat</option>
              <option value="location">Lokasi</option>
              <option value="last">Terakhir diservis</option>
            </select>
          </div>
        )}

        {/* Daftar unit */}
        <div className="mt-4 space-y-2">
          {units.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
              {card.units.length === 0 ? "Belum ada unit AC terdaftar." : "Tidak ada unit cocok."}
            </CardContent></Card>
          ) : units.map((u) => (
            <Card key={u.id}>
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setOpen((o) => (o === u.id ? null : u.id))}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-foreground">
                      {(u.brand ?? "AC")}{u.capacityPk ? ` ${u.capacityPk} PK` : ""}
                      {u.code && <span className="ml-2 font-mono text-xs text-muted-foreground">{u.code}</span>}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {[AC_TYPE_LABEL[u.type] ?? u.type, u.roomLocation].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs text-muted-foreground">Servis berikutnya</div>
                    <div className="text-sm font-medium text-foreground">{fmtDate(u.nextServiceDate)}</div>
                  </div>
                  <span className={`shrink-0 text-muted-foreground transition-transform ${open === u.id ? "rotate-90" : ""}`}>›</span>
                </button>

                {open === u.id && (
                  <div className="border-t px-4 pb-4 pt-3">
                    {u.lastService && (
                      <div className="mb-3 rounded-xl bg-sky-50 px-3 py-2 text-sm dark:bg-sky-950/30">
                        <span className="text-sky-700 dark:text-sky-300">Perawatan terakhir: </span>
                        <span className="font-medium text-foreground">{fmtDate(u.lastService.date)} — {u.lastService.activity}</span>
                      </div>
                    )}
                    {u.history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada catatan perawatan.</p>
                    ) : (
                      <ol className="space-y-1.5">
                        {u.history.map((h, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Icon.Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                            <span className="text-muted-foreground">{fmtDate(h.date)}</span>
                            <span className="text-foreground">— {h.activity}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">Kartu perawatan digital · Ditenagai Aircon</p>
      </div>
    </main>
  );
}
