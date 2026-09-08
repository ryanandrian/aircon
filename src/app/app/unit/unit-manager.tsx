"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { CodeManager } from "./code-manager";
import { QrScanner } from "./qr-scanner";
import { actionResolveScan, actionBindCode } from "./code-actions";
import { actionLoadAssets } from "./asset-actions";
import { useRouter } from "next/navigation";

type UnitHit = { id: string; brand: string | null; roomLocation: string | null; capacityPk: number | null; customerName: string };

function unitLabel(u: UnitHit): string {
  return [u.brand ?? "AC", u.capacityPk ? `${u.capacityPk} PK` : null, u.roomLocation].filter(Boolean).join(" · ");
}

/**
 * Halaman KODE QR (opsional). Fokus: kelola kode stiker (generate/export/status) + scan.
 * Pengelolaan unit AC ADA di detail pelanggan & panel teknisi (unit milik pelanggan).
 * Saat scan kode POOL (belum tertaut), tampilkan PENCARI unit untuk menautkan.
 */
export function QrManager() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [bindCodeVal, setBindCodeVal] = useState<string | null>(null); // kode POOL menunggu ditautkan
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<UnitHit[]>([]);
  const [searching, setSearching] = useState(false);

  async function handleScanned(code: string) {
    setScanning(false);
    const res = await actionResolveScan(code);
    if (!res.ok) { toast.error(res.error); return; }
    if (res.status === "BOUND" && res.assetId) {
      toast.success("Kode ini sudah tertaut ke sebuah unit.");
    } else if (res.status === "POOL") {
      setBindCodeVal(code);
      setHits([]); setQ("");
      toast.info(`Kode ${code} belum terpasang. Cari unit untuk ditautkan.`);
    }
  }

  async function searchUnits(term: string) {
    setQ(term);
    if (!term.trim()) { setHits([]); return; }
    setSearching(true);
    const res = await actionLoadAssets({ search: term.trim() });
    setSearching(false);
    if (res.ok && res.rows) {
      setHits(res.rows.map((r) => ({
        id: r.id, brand: r.brand, roomLocation: r.roomLocation, capacityPk: r.capacityPk, customerName: r.customerName,
      })));
    }
  }

  async function doBind(assetId: string) {
    if (!bindCodeVal) return;
    const res = await actionBindCode(bindCodeVal, assetId);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success(`Kode ${bindCodeVal} terpasang ke unit`);
    setBindCodeVal(null); setHits([]); setQ("");
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {scanning && <QrScanner onCode={handleScanned} onClose={() => setScanning(false)} />}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Kelola stiker Kode QR unit AC (opsional — cocok untuk pelanggan institusi banyak unit)</p>
        <Button size="sm" variant="outline" onClick={() => setScanning(true)}>
          <Icon.Web className="h-4 w-4" aria-hidden /> Scan QR
        </Button>
      </div>

      {/* Mode bind: cari unit untuk menautkan kode hasil scan */}
      {bindCodeVal && (
        <Card className="border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">Tautkan kode <span className="font-mono font-semibold">{bindCodeVal}</span> ke unit:</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setBindCodeVal(null); setHits([]); setQ(""); }}>Batal</Button>
            </div>
            <Input
              autoFocus
              placeholder="Cari unit (merek, lokasi, pelanggan)…"
              value={q}
              onChange={(e) => searchUnits(e.target.value)}
            />
            {searching ? (
              <p className="py-2 text-center text-sm text-muted-foreground">Mencari…</p>
            ) : q.trim() && hits.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">Tidak ada unit cocok. Daftarkan unit dulu di detail pelanggan.</p>
            ) : (
              <ul className="space-y-2">
                {hits.map((u) => (
                  <li key={u.id}>
                    <button type="button" onClick={() => doBind(u.id)}
                      className="interactive flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
                        <Icon.AC className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{unitLabel(u)}</span>
                        <span className="block truncate text-xs text-muted-foreground">{u.customerName}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-sky-600 dark:text-sky-400">Tautkan</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <CodeManager />
    </div>
  );
}
