"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/icons";
import { actionAddWorkItem, actionRemoveWorkItem, actionCloseWorkSession } from "../actions";

type Catalog = { id: string; name: string; unit: string; standardPrice: number; category: string };
type Asset = { id: string; label: string };
type Item = { id: string; desc: string; qty: number; unit: string; unitPrice: number; lineTotal: number; assetLabel: string | null };

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function WorkSessionScreen({
  wsId, customerName, isTempo, catalog, assets, initialItems,
}: {
  wsId: string; customerName: string; isTempo: boolean;
  catalog: Catalog[]; assets: Asset[]; initialItems: Item[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [assetId, setAssetId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const runningTotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const svc = catalog.find((c) => c.id === serviceId);

  function add() {
    if (!serviceId) { toast.error("Pilih layanan dulu"); return; }
    start(async () => {
      const res = await actionAddWorkItem(wsId, { assetId: assetId || undefined, serviceId, qty });
      if (!res.ok) { toast.error(res.error); return; }
      // optimistic: reload dari server utk snapshot harga akurat
      const { actionGetWorkSession } = await import("../actions");
      const snap = await actionGetWorkSession(wsId);
      if (snap.ok && snap.data) setItems(snap.data.items);
      setServiceId(""); setQty(1);
      toast.success("Pekerjaan ditambahkan");
    });
  }

  function remove(itemId: string) {
    start(async () => {
      const res = await actionRemoveWorkItem(wsId, itemId);
      if (!res.ok) { toast.error(res.error); return; }
      setItems((p) => p.filter((x) => x.id !== itemId));
    });
  }

  function close() {
    if (items.length === 0) { toast.error("Tambah pekerjaan dulu"); return; }
    const label = isTempo ? "proforma-invoice (tempo)" : "invoice (tunai)";
    if (!confirm(`Tutup sesi & terbitkan ${label}? Setelah ini sesi tak bisa diubah.`)) return;
    start(async () => {
      const res = await actionCloseWorkSession(wsId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.data!.docType === "PROFORMA" ? "Proforma" : "Invoice"} ${res.data!.number} dibuat`);
      router.push(`/t/faktur/${res.data!.invoiceId}`);
    });
  }

  return (
    <div>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-md px-4 py-3">
          <button onClick={() => router.back()} className="text-xs text-muted-foreground">← Kembali</button>
          <h1 className="text-lg font-bold text-foreground">Pekerjaan: {customerName}</h1>
          <p className="text-xs text-muted-foreground">
            {isTempo ? "Pelanggan TEMPO → akan terbit proforma-invoice" : "Pelanggan TUNAI → akan terbit invoice"}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 p-4">
        {/* Form tambah — minim ketik */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-foreground">Tambah Pekerjaan (per unit)</h2>
            <div className="space-y-1.5">
              <Label>Unit AC (opsional)</Label>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="">— Tanpa unit tertentu —</option>
                {assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Layanan</Label>
              <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="">— Pilih layanan —</option>
                {catalog.map((c) => <option key={c.id} value={c.id}>{c.name} ({rp(c.standardPrice)}/{c.unit})</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="w-24 space-y-1.5">
                <Label htmlFor="qty">Jumlah</Label>
                <Input id="qty" type="number" min="1" value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} className="min-h-[44px]" />
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                {svc && <>Harga: <span className="font-semibold text-foreground">{rp(svc.standardPrice * qty)}</span><br /><span className="text-xs">Harga khusus pelanggan otomatis dipakai bila ada.</span></>}
              </div>
            </div>
            <Button type="button" onClick={add} disabled={pending || !serviceId} className="w-full min-h-[44px]">
              <Icon.Job className="h-4 w-4" aria-hidden /> Tambah ke Daftar
            </Button>
          </CardContent>
        </Card>

        {/* Daftar item (bisa dicicil) */}
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Daftar Pekerjaan ({items.length})</h2>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Belum ada. Tambah pekerjaan per unit di atas — bisa dicicil tiap unit selesai.</p>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.id} className="flex items-start justify-between gap-2 rounded-xl border p-3">
                    <div className="min-w-0">
                      {it.assetLabel && <div className="text-xs font-medium text-sky-600 dark:text-sky-400">{it.assetLabel}</div>}
                      <div className="truncate text-sm font-medium text-foreground">{it.desc}</div>
                      <div className="text-xs text-muted-foreground">{it.qty} {it.unit} × {rp(it.unitPrice)} = {rp(it.lineTotal)}</div>
                    </div>
                    <button onClick={() => remove(it.id)} disabled={pending} aria-label="Hapus" className="p-1 text-destructive">
                      <Icon.Close className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar total + tutup */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-3 p-4">
          <div>
            <div className="text-xs text-muted-foreground">Total {items.length} item</div>
            <div className="text-lg font-bold text-foreground">{rp(runningTotal)}</div>
          </div>
          <Button type="button" onClick={close} disabled={pending || items.length === 0}
            className="min-h-[48px] bg-emerald-600 px-6 text-white hover:bg-emerald-700">
            {isTempo ? "Tutup & Buat Proforma" : "Tutup & Buat Invoice"}
          </Button>
        </div>
      </div>
    </div>
  );
}
