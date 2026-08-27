"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { AssetForm } from "./asset-form";
import { CodeManager } from "./code-manager";
import { QrScanner } from "./qr-scanner";
import { actionResolveScan, actionBindCode } from "./code-actions";
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

export function UnitManager({ units }: { units: Unit[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bindCodeVal, setBindCodeVal] = useState<string | null>(null); // kode POOL menunggu dipilih unitnya
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return units;
    return units.filter((u) =>
      [u.brand, u.model, u.roomLocation, u.customerName].some((f) => (f ?? "").toLowerCase().includes(s)),
    );
  }, [units, q]);

  async function handleScanned(code: string) {
    setScanning(false);
    const res = await actionResolveScan(code);
    if (!res.ok) { toast.error(res.error); return; }
    if (res.status === "BOUND" && res.assetId) {
      toast.success("Unit ditemukan");
      // fokus ke unit (scroll/refresh); detail unit dibuka di halaman ini
      router.refresh();
    } else if (res.status === "POOL") {
      // kode belum terikat → minta pilih unit untuk di-bind
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

  return (
    <div className="space-y-5">
      {scanning && <QrScanner onCode={handleScanned} onClose={() => setScanning(false)} />}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{units.length} unit AC terdaftar</p>
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

      {adding && <AssetForm onDone={() => setAdding(false)} />}

      <div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowCodes((v) => !v)}>
          {showCodes ? "Sembunyikan" : "Kelola"} Kode QR Sticker
        </Button>
      </div>
      {showCodes && <CodeManager />}

      {units.length > 0 && (
        <Input placeholder="Cari unit (merek, lokasi, pelanggan)…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {filtered.length === 0 ? (
        units.length === 0 ? (
          <EmptyState
            icon={Icon.AC}
            title="Belum ada unit AC"
            desc="Daftarkan unit AC pelanggan agar riwayat perawatan tiap mesin tercatat rapi. Bisa tambah satu per satu atau sekaligus banyak (mis. gedung/masjid)."
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada unit cocok dengan pencarian.</p>
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((u) => (
            <Card key={u.id} className="interactive">
              <CardContent className="p-4">
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
                {bindCodeVal && (
                  <Button type="button" size="sm" className="mt-3 w-full" onClick={() => doBind(u.id)}>
                    Tautkan {bindCodeVal} ke unit ini
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
