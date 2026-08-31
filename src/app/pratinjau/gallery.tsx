"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Item = { id: string; title: string; caption: string; imageUrl: string; category: string };

const ALL = "Semua";

export function PreviewGallery({ items }: { items: Item[] }) {
  // Kategori unik (urut sesuai kemunculan) + tab "Semua".
  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const it of items) {
      const c = it.category?.trim();
      if (c && !seen.includes(c)) seen.push(c);
    }
    return [ALL, ...seen];
  }, [items]);

  const [tab, setTab] = useState<string>(ALL);
  // Daftar yang tampil sesuai tab aktif.
  const shown = useMemo(
    () => (tab === ALL ? items : items.filter((it) => it.category?.trim() === tab)),
    [items, tab],
  );

  // index gambar aktif di lightbox (relatif ke `shown`); null = tertutup.
  const [idx, setIdx] = useState<number | null>(null);
  const open = idx !== null;
  const active = open && idx < shown.length ? shown[idx] : null;

  const close = useCallback(() => setIdx(null), []);
  const prev = useCallback(() => setIdx((i) => (i === null ? i : (i - 1 + shown.length) % shown.length)), [shown.length]);
  const next = useCallback(() => setIdx((i) => (i === null ? i : (i + 1) % shown.length)), [shown.length]);

  // Navigasi keyboard + kunci scroll body saat lightbox terbuka.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close, prev, next]);

  return (
    <>
      {/* Tab kategori (tampil bila >1 kategori) */}
      {categories.length > 2 && (
        <div className="mb-7 flex flex-wrap justify-center gap-2">
          {categories.map((c) => {
            const isActive = tab === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setTab(c)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((it, i) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setIdx(i)}
            className="group rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <Card className="interactive h-full overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
                  alt={it.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {it.category && (
                  <Badge className="absolute left-3 top-3 bg-sky-600 text-white hover:bg-sky-600">{it.category}</Badge>
                )}
                {/* Petunjuk klik untuk memperbesar */}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                  <span className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow">Lihat penuh</span>
                </span>
              </div>
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground">{it.title}</h3>
                {it.caption && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{it.caption}</p>}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {/* Lightbox full-size dengan navigasi kiri/kanan */}
      {open && active && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
          onClick={close}
        >
          {/* Bar atas: counter + tutup */}
          <div className="flex shrink-0 items-center justify-between px-4 py-3 text-white/90 sm:px-6">
            <span className="text-sm font-medium tabular-nums">{(idx as number) + 1} / {shown.length}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); close(); }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Area gambar + tombol kiri/kanan */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
            {shown.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-4 sm:h-12 sm:w-12"
                aria-label="Sebelumnya"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={active.imageUrl}
              alt={active.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />

            {shown.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-4 sm:h-12 sm:w-12"
                aria-label="Berikutnya"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* Judul + caption */}
          <div className="shrink-0 px-4 py-4 text-center text-white sm:px-6" onClick={(e) => e.stopPropagation()}>
            {active.category && <Badge className="mb-2 bg-sky-600 text-white hover:bg-sky-600">{active.category}</Badge>}
            <h2 className="text-base font-bold sm:text-lg">{active.title}</h2>
            {active.caption && <p className="mx-auto mt-1 max-w-2xl text-sm text-white/70">{active.caption}</p>}
          </div>
        </div>
      )}
    </>
  );
}
