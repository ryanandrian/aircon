"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { actionSetCustomerPrice, actionRemoveCustomerPrice } from "./actions";

type CatalogLite = { id: string; code: string; name: string; unit: string; standardPrice: number };
type Override = { serviceId: string; code: string; name: string; unit: string; standardPrice: number; price: number };

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function CustomerPricingManager({
  customerId, customerName, catalog, initialOverrides,
}: {
  customerId: string; customerName: string; catalog: CatalogLite[]; initialOverrides: Override[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [overrides, setOverrides] = useState<Override[]>(initialOverrides);
  const [adding, setAdding] = useState(false);
  const [pickId, setPickId] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>("");

  // layanan yang BELUM punya override (pola tambah per item — hanya yang belum ada)
  const available = useMemo(() => {
    const taken = new Set(overrides.map((o) => o.serviceId));
    return catalog.filter((c) => !taken.has(c.id));
  }, [catalog, overrides]);

  function onPick(id: string | null) {
    setPickId(id ?? "");
    const svc = catalog.find((c) => c.id === id);
    setPrice(svc ? String(svc.standardPrice) : ""); // pre-fill harga standar sbg titik awal
  }

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!pickId) { toast.error("Pilih layanan dulu"); return; }
    const p = Number(price);
    if (!Number.isFinite(p) || p < 0) { toast.error("Harga tidak valid"); return; }
    start(async () => {
      const res = await actionSetCustomerPrice(customerId, pickId, p);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      const svc = catalog.find((c) => c.id === pickId)!;
      setOverrides((prev) => [
        { serviceId: svc.id, code: svc.code, name: svc.name, unit: svc.unit, standardPrice: svc.standardPrice, price: p },
        ...prev,
      ]);
      setAdding(false); setPickId(""); setPrice("");
      toast.success("Harga khusus ditambahkan");
      router.refresh();
    });
  }

  function saveEdit(o: Override) {
    const p = Number(editPrice);
    if (!Number.isFinite(p) || p < 0) { toast.error("Harga tidak valid"); return; }
    start(async () => {
      const res = await actionSetCustomerPrice(customerId, o.serviceId, p);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      setOverrides((prev) => prev.map((x) => x.serviceId === o.serviceId ? { ...x, price: p } : x));
      setEditId(null);
      toast.success("Harga khusus diperbarui");
      router.refresh();
    });
  }

  function remove(o: Override) {
    if (!confirm(`Hapus harga khusus "${o.name}"? Item ini kembali ke harga standar ${rp(o.standardPrice)}.`)) return;
    start(async () => {
      const res = await actionRemoveCustomerPrice(customerId, o.serviceId);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      setOverrides((prev) => prev.filter((x) => x.serviceId !== o.serviceId));
      toast.success("Harga khusus dihapus");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Harga khusus untuk</p>
          <p className="font-semibold text-foreground">{customerName}</p>
        </div>
        {!adding && available.length > 0 && (
          <Button size="sm" onClick={() => { setAdding(true); setPickId(""); setPrice(""); }}>
            <Icon.Job className="h-4 w-4" aria-hidden /> Tambah Harga Khusus
          </Button>
        )}
      </div>

      <p className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        Hanya item yang Anda tambahkan di sini yang memakai harga khusus. Item lain otomatis memakai harga standar
        katalog. Saat membuat invoice, sistem memakai harga khusus bila ada, jika tidak memakai harga standar.
      </p>

      {adding && (
        <Card>
          <CardContent className="p-5">
            <form onSubmit={submitAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Pilih Layanan</Label>
                <Select value={pickId} onValueChange={onPick}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih layanan dari katalog…" /></SelectTrigger>
                  <SelectContent>
                    {available.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} — standar {rp(c.standardPrice)}/{c.unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {pickId && (
                <div className="space-y-1.5">
                  <Label htmlFor="cp-price">Harga Khusus (Rp)</Label>
                  <Input id="cp-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Harga standar: {rp(catalog.find((c) => c.id === pickId)?.standardPrice ?? 0)}</p>
                </div>
              )}
              <div className="flex gap-2">
                <SubmitButton pending={pending} pendingLabel="Menyimpan…">Simpan</SubmitButton>
                <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {overrides.length === 0 && !adding ? (
        <EmptyState icon={Icon.Billing} title="Belum ada harga khusus"
          desc="Pelanggan ini memakai harga standar untuk semua layanan. Tambahkan harga khusus hanya untuk item tertentu yang berbeda." />
      ) : (
        <div className="space-y-2">
          {overrides.map((o) => {
            const diff = o.price - o.standardPrice;
            return (
              <Card key={o.serviceId}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-foreground">{o.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{o.code}</div>
                      {editId === o.serviceId ? (
                        <div className="mt-2 flex items-center gap-2">
                          <Input type="number" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="h-9 w-32" />
                          <Button type="button" size="sm" disabled={pending} onClick={() => saveEdit(o)}>Simpan</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Batal</Button>
                        </div>
                      ) : (
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-foreground">{rp(o.price)}</span>
                          <span className="text-xs text-muted-foreground line-through">standar {rp(o.standardPrice)}</span>
                          {diff !== 0 && (
                            <Badge variant={diff < 0 ? "secondary" : "outline"} className="shrink-0">
                              {diff < 0 ? "−" : "+"}{rp(Math.abs(diff))}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {editId !== o.serviceId && (
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Ubah"
                          onClick={() => { setEditId(o.serviceId); setEditPrice(String(o.price)); }}>
                          <Icon.Note className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pending} onClick={() => remove(o)}>
                          <Icon.Close className="h-4 w-4 text-destructive" aria-hidden />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
