"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import {
  actionCreateAsset, actionSuggestLocations, actionCheckDuplicates, actionListCustomersForAsset,
} from "./asset-actions";

const TYPES = [
  { value: "SPLIT", label: "Split" },
  { value: "CASSETTE", label: "Cassette" },
  { value: "STANDING", label: "Standing / Floor" },
  { value: "WINDOW", label: "Window" },
  { value: "CENTRAL", label: "Central" },
  { value: "OTHER", label: "Lainnya" },
];

export function AssetForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [locSuggest, setLocSuggest] = useState<string[]>([]);
  const [dups, setDups] = useState<{ id: string; label: string }[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState("SPLIT");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [pk, setPk] = useState("");
  const [loc, setLoc] = useState("");
  const [serial, setSerial] = useState("");
  const [count, setCount] = useState(1);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Muat pelanggan sekali.
  useEffect(() => {
    actionListCustomersForAsset().then((c) => {
      setCustomers(c);
      if (c.length > 0) setCustomerId((prev) => prev || c[0].id);
    });
  }, []);

  // Saran lokasi mengikuti pelanggan terpilih.
  useEffect(() => {
    if (!customerId) return;
    actionSuggestLocations(customerId).then(setLocSuggest);
  }, [customerId]);

  // Cek duplikat lunak (debounce) saat brand/pk/lokasi berubah.
  useEffect(() => {
    if (dupTimer.current) clearTimeout(dupTimer.current);
    if (!customerId || (!brand && !pk) || !loc) { setDups([]); return; }
    dupTimer.current = setTimeout(() => {
      actionCheckDuplicates(customerId, {
        brand: brand || undefined,
        capacityPk: pk ? Number(pk) : undefined,
        roomLocation: loc || undefined,
      }).then(setDups);
    }, 400);
    return () => { if (dupTimer.current) clearTimeout(dupTimer.current); };
  }, [customerId, brand, pk, loc]);

  function submit() {
    if (!customerId) { toast.error("Pilih pelanggan dulu"); return; }
    start(async () => {
      const res = await actionCreateAsset({
        customerId, type, brand, model,
        capacityPk: pk ? Number(pk) : undefined,
        roomLocation: loc, serial,
        count,
      });
      if (!res.ok) { toast.error(res.error ?? "Gagal menyimpan"); return; }
      toast.success(res.createdCount && res.createdCount > 1 ? `${res.createdCount} unit ditambahkan` : "Unit ditambahkan");
      setBrand(""); setModel(""); setPk(""); setLoc(""); setSerial(""); setCount(1); setDups([]);
      router.refresh();
      onDone?.();
    });
  }

  const locListId = "loc-suggest";

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">Tambah Unit AC</h2>

        <div className="space-y-1.5">
          <Label htmlFor="af-customer">Pelanggan <span className="text-red-500">*</span></Label>
          <select
            id="af-customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)}
            className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-sm"
          >
            {customers.length === 0 && <option value="">Belum ada pelanggan</option>}
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="af-type">Tipe</Label>
            <select id="af-type" value={type} onChange={(e) => setType(e.target.value)} className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-sm">
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="af-pk">Kapasitas (PK)</Label>
            <Input id="af-pk" type="number" step="0.25" min="0" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="mis. 0.75" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="af-brand">Merek</Label>
            <Input id="af-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="mis. Daikin" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="af-model">Tipe/Model</Label>
            <Input id="af-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="mis. FTKQ" />
          </div>
        </div>

        {/* Lokasi = combobox free-text dgn saran dari data */}
        <div className="space-y-1.5">
          <Label htmlFor="af-loc">Lokasi / Ruangan</Label>
          <Input id="af-loc" list={locListId} value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="mis. Ruang Tamu, Kantor Lt.2, Musala" />
          <datalist id={locListId}>
            {locSuggest.map((l) => <option key={l} value={l} />)}
          </datalist>
          {locSuggest.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {locSuggest.slice(0, 6).map((l) => (
                <button key={l} type="button" onClick={() => setLoc(l)}
                  className="rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:bg-sky-50 hover:text-sky-700 dark:hover:bg-sky-950/40">
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dedup-warning LUNAK */}
        {dups.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <Icon.Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              Sepertinya unit serupa sudah terdaftar untuk pelanggan ini:
              <ul className="mt-1 list-disc pl-4">
                {dups.slice(0, 3).map((d) => <li key={d.id}>{d.label}</li>)}
              </ul>
              <span className="text-xs">Kalau ini unit tambahan (mis. beberapa AC identik), lanjutkan saja.</span>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="af-serial">Serial (opsional)</Label>
            <Input id="af-serial" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="bila ada" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="af-count">Jumlah unit (buat sekaligus)</Label>
            <Input id="af-count" type="number" min="1" max="100" value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
            {count > 1 && <p className="text-xs text-muted-foreground">Akan dibuat {count} unit terpisah: {loc ? `${loc} #1..#${count}` : "beri lokasi agar diberi nomor"}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <SubmitButton pending={pending} pendingLabel="Menyimpan…" onClick={submit} type="button">
            {count > 1 ? `Tambah ${count} Unit` : "Tambah Unit"}
          </SubmitButton>
          {onDone && <Button type="button" variant="ghost" onClick={onDone}>Batal</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
