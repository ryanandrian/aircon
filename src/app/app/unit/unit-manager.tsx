"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { AssetForm } from "./asset-form";
import { CodeManager } from "./code-manager";
import { QrScanner } from "./qr-scanner";
import { actionResolveScan, actionBindCode } from "./code-actions";
import { actionUpdateAsset, actionDeleteAsset, actionLoadAssets } from "./asset-actions";
import { useRouter } from "next/navigation";

type Unit = {
  id: string;
  brand: string | null;
  model: string | null;
  type: string;
  capacityPk: number | null;
  roomLocation: string | null;
  quantity: number;
  customerName: string;
  jobCount: number;
  nextServiceDate: string | null;
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export function UnitManager({
  initialUnits,
  initialCursor,
}: {
  initialUnits: Unit[];
  initialCursor: string | null;
}) {
  const router = useRouter();
  const [units, setUnits] = useState<Unit[]>(initialUnits);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bindCodeVal, setBindCodeVal] = useState<string | null>(null); // kode POOL menunggu dipilih unitnya
  const [editId, setEditId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Muat ulang batch pertama (dipakai setelah mutasi & saat pencarian berubah).
  const reload = useCallback(async (search: string) => {
    const res = await actionLoadAssets({ search: search.trim() || undefined });
    if (res.ok && res.rows) { setUnits(res.rows); setCursor(res.nextCursor ?? null); }
  }, []);

  // Pencarian server-side (debounce).
  useEffect(() => {
    const t = setTimeout(() => { reload(q); }, 350);
    return () => clearTimeout(t);
  }, [q, reload]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await actionLoadAssets({ search: q.trim() || undefined, cursor });
    if (res.ok && res.rows) {
      setUnits((prev) => [...prev, ...res.rows!]);
      setCursor(res.nextCursor ?? null);
    }
    setLoadingMore(false);
  }, [cursor, loadingMore, q]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  async function handleScanned(code: string) {
    setScanning(false);
    const res = await actionResolveScan(code);
    if (!res.ok) { toast.error(res.error); return; }
    if (res.status === "BOUND" && res.assetId) {
      toast.success("Unit ditemukan");
      router.refresh();
    } else if (res.status === "POOL") {
      setBindCodeVal(code);
      toast.info(`Kode ${code} belum terpasang. Pilih unit untuk ditautkan.`);
    }
  }

  async function doBind(assetId: string) {
    if (!bindCodeVal) return;
    const res = await actionBindCode(bindCodeVal, assetId);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success(`Kode ${bindCodeVal} terpasang ke unit`);
    setBindCodeVal(null);
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await actionUpdateAsset(id, {
      brand: String(fd.get("brand") ?? ""),
      model: String(fd.get("model") ?? ""),
      capacityPk: fd.get("pk") ? Number(fd.get("pk")) : undefined,
      roomLocation: String(fd.get("loc") ?? ""),
    });
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success("Unit diperbarui");
    setEditId(null);
    await reload(q);
  }

  async function delUnit(u: Unit) {
    if (!confirm(`Hapus unit "${(u.brand ?? "AC")}${u.roomLocation ? ` — ${u.roomLocation}` : ""}"? Riwayat servis tetap tersimpan.`)) return;
    const res = await actionDeleteAsset(u.id);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success("Unit dihapus");
    setUnits((prev) => prev.filter((x) => x.id !== u.id));
  }

  return (
    <div className="space-y-5">
      {scanning && <QrScanner onCode={handleScanned} onClose={() => setScanning(false)} />}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Kelola stiker Kode QR & tautkan ke unit AC pelanggan</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setScanning(true)}>
            <Icon.Web className="h-4 w-4" aria-hidden /> Scan QR
          </Button>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Icon.AC className="h-4 w-4" aria-hidden /> Tambah Unit
            </Button>
          )}
        </div>
      </div>

      {/* Mode pilih unit untuk bind kode hasil scan */}
      {bindCodeVal && (
        <Card className="border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">Tautkan kode <span className="font-mono font-semibold">{bindCodeVal}</span> ke unit — pilih di bawah:</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setBindCodeVal(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {adding && <AssetForm onDone={() => { setAdding(false); reload(q); }} />}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowCodes((v) => !v)}>
          {showCodes ? "Sembunyikan" : "Kelola"} Kode QR Sticker
        </Button>
      </div>
      {showCodes && <CodeManager />}

      <Input placeholder="Cari unit (merek, lokasi, pelanggan)…" value={q} onChange={(e) => setQ(e.target.value)} />

      {units.length === 0 ? (
        q.trim() ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada unit cocok dengan pencarian.</p>
        ) : (
          <EmptyState
            icon={Icon.AC}
            title="Belum ada unit AC"
            desc="Daftarkan unit AC pelanggan agar riwayat perawatan tiap mesin tercatat rapi. Bisa tambah satu per satu atau sekaligus banyak (mis. gedung/masjid)."
          />
        )
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {units.map((u) => (
              <Card key={u.id} className="interactive">
                <CardContent className="p-4">
                  {editId === u.id ? (
                    <form onSubmit={(e) => saveEdit(e, u.id)} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input name="brand" defaultValue={u.brand ?? ""} placeholder="Merek" />
                        <Input name="pk" type="number" step="0.25" defaultValue={u.capacityPk ?? ""} placeholder="PK" />
                      </div>
                      <Input name="model" defaultValue={u.model ?? ""} placeholder="Model" />
                      <Input name="loc" defaultValue={u.roomLocation ?? ""} placeholder="Lokasi" />
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">Simpan</Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">
                            {(u.brand ?? "AC")}{u.capacityPk ? ` ${u.capacityPk} PK` : ""}
                          </div>
                          <div className="truncate text-sm text-muted-foreground">{u.roomLocation ?? "Lokasi belum diatur"}</div>
                        </div>
                        {u.quantity > 1 && <Badge variant="secondary">{u.quantity} unit</Badge>}
                      </div>
                      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Icon.Users className="h-3.5 w-3.5" aria-hidden /> {u.customerName}</span>
                        <span>{u.jobCount} riwayat</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Servis berikutnya: {fmtDate(u.nextServiceDate)}
                      </div>
                      {bindCodeVal ? (
                        <Button type="button" size="sm" className="mt-3 w-full" onClick={() => doBind(u.id)}>
                          Tautkan {bindCodeVal} ke unit ini
                        </Button>
                      ) : (
                        <div className="mt-3 flex gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(u.id)}>
                            <Icon.Note className="h-3.5 w-3.5" aria-hidden /> Ubah
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => delUnit(u)}>
                            <Icon.Close className="h-3.5 w-3.5 text-destructive" aria-hidden /> Hapus
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Sentinel infinite-scroll + skeleton */}
          {cursor && (
            <div ref={sentinelRef} className="grid gap-3 pt-1 sm:grid-cols-2">
              <Skeleton className="h-[132px] w-full rounded-xl" />
              {loadingMore && <Skeleton className="h-[132px] w-full rounded-xl" />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
