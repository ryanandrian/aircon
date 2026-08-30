"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import {
  actionCreateCatalog, actionUpdateCatalog, actionDeleteCatalog, actionListOverrides,
} from "./actions";

export type CatalogRow = {
  id: string; code: string; name: string; category: string; standardPrice: number;
  unit: string; description: string | null; active: boolean;
  techIncentiveType: string; techIncentiveValue: number;
  kernetIncentiveType: string; kernetIncentiveValue: number;
  overrideCount: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  MAINTENANCE: "Perawatan", SERVICE: "Servis", CONSUMABLE: "Consumable", SPAREPART: "Sparepart",
  PAKET: "Paket", SURVEI: "Survei", GARANSI: "Garansi", LAINNYA: "Lainnya",
};
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL);
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

type Form = {
  code: string; name: string; category: string; standardPrice: string; unit: string; description: string;
  techIncentiveType: string; techIncentiveValue: string;
  kernetIncentiveType: string; kernetIncentiveValue: string;
};
const emptyForm = (): Form => ({
  code: "", name: "", category: "SERVICE", standardPrice: "", unit: "unit", description: "",
  techIncentiveType: "VALUE", techIncentiveValue: "", kernetIncentiveType: "VALUE", kernetIncentiveValue: "",
});

export function CatalogManager({ items }: { items: CatalogRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [drill, setDrill] = useState<{ id: string; rows: { customerName: string; price: number }[] } | null>(null);
  const showForm = adding || editId !== null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i) => [i.code, i.name, CATEGORY_LABEL[i.category]].some((f) => (f ?? "").toLowerCase().includes(s)));
  }, [items, q]);

  function set<K extends keyof Form>(k: K, v: Form[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function openAdd() { setForm(emptyForm()); setAdding(true); setEditId(null); }
  function openEdit(i: CatalogRow) {
    setForm({
      code: i.code, name: i.name, category: i.category, standardPrice: String(i.standardPrice),
      unit: i.unit, description: i.description ?? "",
      techIncentiveType: i.techIncentiveType, techIncentiveValue: String(i.techIncentiveValue),
      kernetIncentiveType: i.kernetIncentiveType, kernetIncentiveValue: String(i.kernetIncentiveValue),
    });
    setEditId(i.id); setAdding(false);
  }
  function close() { setAdding(false); setEditId(null); }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = {
      code: form.code, name: form.name, category: form.category,
      standardPrice: Number(form.standardPrice) || 0, unit: form.unit, description: form.description,
      techIncentiveType: form.techIncentiveType, techIncentiveValue: Number(form.techIncentiveValue) || 0,
      kernetIncentiveType: form.kernetIncentiveType, kernetIncentiveValue: Number(form.kernetIncentiveValue) || 0,
    };
    start(async () => {
      const res = editId ? await actionUpdateCatalog(editId, payload) : await actionCreateCatalog(payload);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(editId ? "Layanan diperbarui" : "Layanan ditambahkan");
      close(); router.refresh();
    });
  }

  function del(i: CatalogRow) {
    if (!confirm(`Hapus layanan "${i.name}"? Harga khusus terkait juga ikut terhapus.`)) return;
    start(async () => {
      const res = await actionDeleteCatalog(i.id);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success("Layanan dihapus"); router.refresh();
    });
  }

  async function showOverrides(i: CatalogRow) {
    if (drill?.id === i.id) { setDrill(null); return; }
    const res = await actionListOverrides(i.id);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    setDrill({ id: i.id, rows: res.rows ?? [] });
  }

  const incHint = "Nilai insentif per personel. Bila 1 layanan dikerjakan >1 orang peran sama, insentif dibagi rata (atur mode di Pengaturan). Isi 0 = tanpa insentif.";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Daftar layanan, harga standar & insentif</p>
        {!showForm && (
          <div className="flex gap-2">
            <a href="/app/layanan/export" className={buttonVariants({ variant: "outline", size: "sm" })} title="Unduh semua harga khusus (CSV)">
              <Icon.Billing className="h-4 w-4" aria-hidden /> Export CSV
            </a>
            <Button size="sm" onClick={openAdd}><Icon.Job className="h-4 w-4" aria-hidden /> Tambah Layanan</Button>
          </div>
        )}
      </div>

      {showForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-lg font-semibold">{editId ? "Ubah Layanan" : "Tambah Layanan"}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="s-code">Kode <span className="text-red-500">*</span></Label>
                  <Input id="s-code" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="mis. CUCI-SPLIT" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={form.category} onValueChange={(v) => set("category", v as string)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORY_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Nama <span className="text-red-500">*</span></Label>
                <Input id="s-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="mis. Cuci AC Split (¼–2 PK)" required />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="s-price">Harga Standar (Rp)</Label>
                  <Input id="s-price" type="number" min="0" value={form.standardPrice} onChange={(e) => set("standardPrice", e.target.value)} placeholder="75000" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-unit">Satuan</Label>
                  <Input id="s-unit" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="unit / ls / pcs" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-desc">Keterangan</Label>
                  <Input id="s-desc" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="opsional" />
                </div>
              </div>

              {/* Insentif */}
              <div className="space-y-3 rounded-xl border border-dashed p-4">
                <p className="text-xs font-medium text-muted-foreground">{incHint}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Insentif Teknisi</Label>
                    <div className="flex gap-2">
                      <Select value={form.techIncentiveType} onValueChange={(v) => set("techIncentiveType", v as string)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="VALUE">Rp</SelectItem><SelectItem value="PERCENT">%</SelectItem></SelectContent>
                      </Select>
                      <Input type="number" min="0" value={form.techIncentiveValue} onChange={(e) => set("techIncentiveValue", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Insentif Kernet</Label>
                    <div className="flex gap-2">
                      <Select value={form.kernetIncentiveType} onValueChange={(v) => set("kernetIncentiveType", v as string)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="VALUE">Rp</SelectItem><SelectItem value="PERCENT">%</SelectItem></SelectContent>
                      </Select>
                      <Input type="number" min="0" value={form.kernetIncentiveValue} onChange={(e) => set("kernetIncentiveValue", e.target.value)} placeholder="0" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <SubmitButton pending={pending} pendingLabel="Menyimpan…">Simpan</SubmitButton>
                <Button type="button" variant="ghost" onClick={close}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!showForm && (
        <>
          {items.length > 0 && (
            <Input placeholder="Cari layanan (kode, nama, kategori)…" value={q} onChange={(e) => setQ(e.target.value)} />
          )}
          {filtered.length === 0 ? (
            items.length === 0 ? (
              <EmptyState icon={Icon.Job} title="Belum ada layanan"
                desc="Tambahkan daftar layanan (cuci, isi freon, sparepart, dll) beserta harga standar & insentif tim. Dipakai saat membuat invoice." />
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada layanan cocok.</p>
            )
          ) : (
            <div className="space-y-2">
              {filtered.map((i) => (
                <Card key={i.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{i.name}</span>
                          <Badge variant="secondary" className="shrink-0">{CATEGORY_LABEL[i.category] ?? i.category}</Badge>
                          {!i.active && <Badge variant="outline" className="shrink-0">nonaktif</Badge>}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">{i.code}</div>
                        <div className="mt-1 text-sm text-foreground">{rp(i.standardPrice)} <span className="text-xs text-muted-foreground">/ {i.unit}</span></div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Insentif: teknisi {i.techIncentiveType === "PERCENT" ? `${i.techIncentiveValue}%` : rp(i.techIncentiveValue)} · kernet {i.kernetIncentiveType === "PERCENT" ? `${i.kernetIncentiveValue}%` : rp(i.kernetIncentiveValue)}
                        </div>
                        {i.overrideCount > 0 && (
                          <button type="button" onClick={() => showOverrides(i)} className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
                            <Icon.Users className="h-3 w-3" aria-hidden /> {i.overrideCount} harga khusus
                          </button>
                        )}
                        {drill?.id === i.id && (
                          <div className="mt-2 space-y-1 rounded-lg border bg-muted/40 p-2 text-xs">
                            {drill.rows.length === 0 ? <p className="text-muted-foreground">Tak ada.</p> :
                              drill.rows.map((r, idx) => (
                                <div key={idx} className="flex justify-between"><span className="truncate">{r.customerName}</span><span className="font-medium">{rp(r.price)}</span></div>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon" aria-label="Ubah" onClick={() => openEdit(i)}><Icon.Note className="h-4 w-4" aria-hidden /></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pending} onClick={() => del(i)}><Icon.Close className="h-4 w-4 text-destructive" aria-hidden /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
