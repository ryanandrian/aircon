"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Icon } from "@/components/icons";
import { actionAddWorkItem, actionRemoveWorkItem, actionCloseWorkSession, actionGetItemChecklist, actionSetItemChecklist, actionTechCreateAsset, actionTechSuggestBrands, actionTechSuggestModels } from "../actions";

type Catalog = { id: string; name: string; unit: string; standardPrice: number; category: string };
type Asset = { id: string; label: string };
type Item = { id: string; desc: string; qty: number; unit: string; unitPrice: number; lineTotal: number; assetLabel: string | null };
type Assignment = { assetId: string; assetLabel: string; serviceLabel: string } | null;

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

const AC_TYPES = [
  { value: "SPLIT", label: "Split" },
  { value: "CASSETTE", label: "Cassette" },
  { value: "STANDING", label: "Standing" },
  { value: "WINDOW", label: "Window" },
  { value: "CENTRAL", label: "Central" },
  { value: "OTHER", label: "Lainnya" },
];

/** Form ringkas teknisi menambah unit AC di lapangan (merek combobox kanonik + model autocomplete). */
function NewUnitForm({ customerId, onCreated }: { customerId: string; onCreated: (a: { id: string; label: string }) => void }) {
  const [pending, start] = useTransition();
  const [type, setType] = useState("SPLIT");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [pk, setPk] = useState("");
  const [loc, setLoc] = useState("");
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  useEffect(() => { actionTechSuggestBrands().then(setBrands); }, []);
  useEffect(() => {
    const t = setTimeout(() => { actionTechSuggestModels(brand || undefined).then(setModels); }, 250);
    return () => clearTimeout(t);
  }, [brand]);

  function save() {
    start(async () => {
      const res = await actionTechCreateAsset(customerId, {
        type, brand: brand || undefined, model: model || undefined,
        capacityPk: pk ? Number(pk) : undefined, roomLocation: loc || undefined,
      });
      if (!res.ok || !res.data) { toast.error(res.ok ? "Gagal" : res.error); return; }
      toast.success("Unit ditambahkan");
      onCreated(res.data);
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-xl border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="min-h-[40px] rounded-lg border bg-background px-2 text-sm">
          {AC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <Input type="number" step="0.25" min="0" value={pk} onChange={(e) => setPk(e.target.value)} placeholder="PK (mis. 0.75)" className="min-h-[40px]" />
      </div>
      <Input list="tech-brand-suggest" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Merek (mis. Daikin)" className="min-h-[40px]" />
      <datalist id="tech-brand-suggest">{brands.map((b) => <option key={b} value={b} />)}</datalist>
      <Input list="tech-model-suggest" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model (opsional)" className="min-h-[40px]" />
      <datalist id="tech-model-suggest">{models.map((m) => <option key={m} value={m} />)}</datalist>
      <Input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Lokasi (mis. R. Tamu)" className="min-h-[40px]" />
      <Button type="button" size="sm" onClick={save} disabled={pending} className="w-full">
        {pending ? "Menyimpan…" : "Simpan Unit"}
      </Button>
    </div>
  );
}

type CItem = { key: string; label: string; type: "bool" | "number" | "text" | "photo"; required: boolean; checked: boolean; value: string | null };

/** Checklist per baris pekerjaan (layanan × unit). Lazy-load; sembunyi bila layanan tak punya checklist. */
function ItemChecklist({ workItemId }: { workItemId: string }) {
  const [items, setItems] = useState<CItem[] | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();

  function load() {
    if (items !== null) { setOpen((o) => !o); return; }
    setLoading(true);
    start(async () => {
      const res = await actionGetItemChecklist(workItemId);
      setLoading(false);
      if (res.ok && res.data) { setItems(res.data); setOpen(true); }
      else if (!res.ok) toast.error(res.error);
    });
  }
  function setBool(key: string, checked: boolean) {
    setItems((prev) => prev?.map((i) => (i.key === key ? { ...i, checked } : i)) ?? prev);
    start(async () => { const r = await actionSetItemChecklist(workItemId, key, { checked }); if (!r.ok) toast.error(r.error); });
  }
  function setVal(key: string, value: string) {
    setItems((prev) => prev?.map((i) => (i.key === key ? { ...i, value } : i)) ?? prev);
  }
  function saveVal(key: string, value: string) {
    start(async () => { const r = await actionSetItemChecklist(workItemId, key, { value }); if (!r.ok) toast.error(r.error); });
  }

  // Sembunyikan sepenuhnya bila sudah dimuat & ternyata kosong (layanan tanpa checklist).
  if (items !== null && items.length === 0) return null;

  const doneCount = items?.filter((i) => (i.type === "bool" ? i.checked : !!i.value)).length ?? 0;
  const reqPending = items?.filter((i) => i.required && (i.type === "bool" ? !i.checked : !i.value)).length ?? 0;

  return (
    <div className="mt-2 border-t pt-2">
      <button type="button" onClick={load} className="flex w-full items-center justify-between text-left text-xs">
        <span className="flex items-center gap-1.5 font-medium text-sky-700 dark:text-sky-400">
          <Icon.Check className="h-3.5 w-3.5" aria-hidden />
          Checklist{items ? ` (${doneCount}/${items.length})` : ""}
          {reqPending > 0 && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">{reqPending} wajib</span>}
        </span>
        <span className="text-muted-foreground">{loading ? "…" : open ? "▲" : "▼"}</span>
      </button>
      {open && items && (
        <ul className="mt-2 space-y-2">
          {items.map((it) => (
            <li key={it.key}>
              {it.type === "bool" ? (
                <label className="flex min-h-[36px] items-center gap-2">
                  <input type="checkbox" checked={it.checked} disabled={pending} onChange={(e) => setBool(it.key, e.target.checked)} className="h-5 w-5 rounded border-border" />
                  <span className="text-sm text-foreground">{it.label}{it.required && <span className="text-red-500"> *</span>}</span>
                </label>
              ) : (
                <div>
                  <label className="block text-xs text-muted-foreground">{it.label}{it.required && <span className="text-red-500"> *</span>}</label>
                  <Input
                    type={it.type === "number" ? "number" : "text"}
                    defaultValue={it.value ?? ""}
                    onChange={(e) => setVal(it.key, e.target.value)}
                    onBlur={(e) => saveVal(it.key, e.target.value)}
                    className="mt-0.5 min-h-[36px]"
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WorkSessionScreen({
  wsId, customerId, customerName, isTempo, catalog, assets, initialItems, assignment,
}: {
  wsId: string; customerId: string; customerName: string; isTempo: boolean;
  catalog: Catalog[]; assets: Asset[]; initialItems: Item[]; assignment?: Assignment;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [assetList, setAssetList] = useState<Asset[]>(assets);
  const [addingUnit, setAddingUnit] = useState(false);
  // B2: prefill unit dari penugasan SPESIFIK (teknisi tetap bisa ganti / tambah unit lain).
  const [assetId, setAssetId] = useState<string>(assignment?.assetId ?? "");
  const [serviceId, setServiceId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const [gateErr, setGateErr] = useState<string | null>(null);

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
      setGateErr(null);
      const res = await actionCloseWorkSession(wsId);
      if (!res.ok) {
        toast.error("Belum bisa dibuat tagihan");
        setGateErr(res.error);
        return;
      }
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
        {/* B2: banner konteks penugasan spesifik — unit & layanan yang diminta */}
        {assignment && (assignment.assetLabel || assignment.serviceLabel) && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900/40 dark:bg-sky-950/20">
            <p className="font-medium text-sky-800 dark:text-sky-300">Penugasan spesifik</p>
            <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-400">
              {assignment.assetLabel && <>Unit: <span className="font-medium">{assignment.assetLabel}</span> · </>}
              Layanan diminta: <span className="font-medium">{assignment.serviceLabel}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Unit sudah dipilih otomatis. Anda tetap bisa mengganti atau menambah pekerjaan lain.</p>
          </div>
        )}
        {/* Form tambah — minim ketik */}
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-foreground">Tambah Pekerjaan (per unit)</h2>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Unit AC (opsional)</Label>
                <button type="button" onClick={() => setAddingUnit((v) => !v)}
                  className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">
                  {addingUnit ? "Tutup" : "+ Unit baru"}
                </button>
              </div>
              <select value={assetId} onChange={(e) => setAssetId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="">— Tanpa unit tertentu —</option>
                {assetList.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {addingUnit && (
                <NewUnitForm
                  customerId={customerId}
                  onCreated={(a) => {
                    setAssetList((prev) => [...prev, a]);
                    setAssetId(a.id);
                    setAddingUnit(false);
                  }}
                />
              )}
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
                  <div key={it.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {it.assetLabel && <div className="text-xs font-medium text-sky-600 dark:text-sky-400">{it.assetLabel}</div>}
                        <div className="truncate text-sm font-medium text-foreground">{it.desc}</div>
                        <div className="text-xs text-muted-foreground">{it.qty} {it.unit} × {rp(it.unitPrice)} = {rp(it.lineTotal)}</div>
                      </div>
                      <button onClick={() => remove(it.id)} disabled={pending} aria-label="Hapus" className="p-1 text-destructive">
                        <Icon.Close className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                    <ItemChecklist workItemId={it.id} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bar total + tutup */}
      <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-md p-4">
          {gateErr && (
            <div role="alert" className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              <span className="font-semibold">Checklist belum lengkap.</span> {gateErr}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
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
    </div>
  );
}
