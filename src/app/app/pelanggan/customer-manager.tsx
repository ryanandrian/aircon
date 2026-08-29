"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import {
  actionCreateCustomer, actionUpdateCustomer, actionDeleteCustomer, actionLoadCustomers,
  type CustomerFormInput,
} from "./actions";

export type CustomerRow = {
  id: string; name: string; phone: string; address: string | null;
  source: string; category: string | null; customerType: string; topType: string;
  assetCount: number; jobCount: number;
};

const SOURCE_LABEL: Record<string, string> = {
  REFERRAL: "Referensi", WHATSAPP: "WhatsApp", WALK_IN: "Datang langsung", MARKETING: "Marketing",
  WEBSITE: "Booking online", IOT_ALERT: "Alert IoT", REPEAT: "Servis ulang", OTHER: "Lainnya",
};
const CATEGORY_LABEL: Record<string, string> = {
  RUMAH: "Rumah / Perorangan", SEKOLAH_KAMPUS: "Sekolah / Kampus", MASJID_MUSHOLA: "Masjid / Mushola",
  TOKO_OUTLET: "Toko / Outlet", RUKO_RUKAN: "Ruko / Rukan", KANTOR_PERUSAHAAN: "Kantor / Perusahaan", LAINNYA: "Lainnya",
};
const TOP_LABEL: Record<string, string> = {
  CASH: "Tunai (Cash)", TEMPO_7: "Tempo 7 hari", TEMPO_14: "Tempo 14 hari", TEMPO_30: "Tempo 30 hari",
  TEMPO_45: "Tempo 45 hari", TEMPO_60: "Tempo 60 hari", TEMPO_90: "Tempo 90 hari",
};

const SOURCE_OPTIONS = Object.entries(SOURCE_LABEL);
const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL);
const TOP_OPTIONS = Object.entries(TOP_LABEL);

type FormState = CustomerFormInput;

function emptyForm(): FormState {
  return {
    name: "", phone: "", address: "", source: "OTHER", notes: "",
    category: "RUMAH", customerType: "PERORANGAN", topType: "CASH", npwp: "",
    isPphWithholder: false, picWorkName: "", picWorkPhone: "", picWorkRole: "",
    picFinanceName: "", picFinancePhone: "",
  };
}

export function CustomerManager({
  initialRows,
  initialCursor,
}: {
  initialRows: CustomerRow[];
  initialCursor: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState<CustomerRow[]>(initialRows);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const showingForm = adding || editing !== null;

  // Pencarian server-side (debounce): reset daftar.
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await actionLoadCustomers({ search: q.trim() || undefined });
      if (res.ok && res.rows) { setRows(res.rows); setCursor(res.nextCursor ?? null); }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const res = await actionLoadCustomers({ search: q.trim() || undefined, cursor });
    if (res.ok && res.rows) {
      setRows((prev) => [...prev, ...res.rows!]);
      setCursor(res.nextCursor ?? null);
    }
    setLoadingMore(false);
  }, [cursor, loadingMore, q]);

  // Infinite scroll via IntersectionObserver.
  useEffect(() => {
    if (showingForm) return;
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore, showingForm]);

  function openAdd() { setForm(emptyForm()); setAdding(true); setEditing(null); }
  function openEdit(c: CustomerRow) {
    setForm({
      name: c.name, phone: c.phone, address: c.address ?? "", source: c.source, notes: "",
      category: c.category ?? "RUMAH", customerType: c.customerType, topType: c.topType,
      npwp: "", isPphWithholder: false, picWorkName: "", picWorkPhone: "", picWorkRole: "",
      picFinanceName: "", picFinancePhone: "",
    });
    setEditing(c); setAdding(false);
  }
  function closeForm() { setEditing(null); setAdding(false); }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const id = editing?.id;
    start(async () => {
      const res = id ? await actionUpdateCustomer(id, form) : await actionCreateCustomer(form);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(id ? "Pelanggan diperbarui" : "Pelanggan ditambahkan");
      closeForm();
      router.refresh();
      const fresh = await actionLoadCustomers({ search: q.trim() || undefined });
      if (fresh.ok && fresh.rows) { setRows(fresh.rows); setCursor(fresh.nextCursor ?? null); }
    });
  }

  function del(c: CustomerRow) {
    if (!confirm(`Hapus pelanggan "${c.name}"? Data unit & riwayat tetap tersimpan.`)) return;
    start(async () => {
      const res = await actionDeleteCustomer(c.id);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success("Pelanggan dihapus");
      setRows((prev) => prev.filter((x) => x.id !== c.id));
    });
  }

  const isBadan = form.customerType === "BADAN";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Kelola data pelanggan usaha Anda</p>
        {!showingForm && (
          <Button size="sm" onClick={openAdd}>
            <Icon.Users className="h-4 w-4" aria-hidden /> Tambah Pelanggan
          </Button>
        )}
      </div>

      {showingForm && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={submit} className="space-y-4">
              <h2 className="text-lg font-semibold">{editing ? "Ubah Pelanggan" : "Tambah Pelanggan"}</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="c-name">Nama <span className="text-red-500">*</span></Label>
                  <Input id="c-name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="c-phone">No. WhatsApp <span className="text-red-500">*</span></Label>
                  <Input id="c-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0812…" required />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="c-address">Alamat</Label>
                <Textarea id="c-address" value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Kategori</Label>
                  <Select value={form.category} onValueChange={(v) => set("category", v as string)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Jenis Pelanggan</Label>
                  <Select value={form.customerType} onValueChange={(v) => set("customerType", v as string)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERORANGAN">Perorangan</SelectItem>
                      <SelectItem value="BADAN">Badan / Perusahaan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Termin Pembayaran (TOP)</Label>
                  <Select value={form.topType} onValueChange={(v) => set("topType", v as string)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TOP_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sumber</Label>
                  <Select value={form.source} onValueChange={(v) => set("source", v as string)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Data pajak & PIC — hanya untuk pelanggan Badan (B2B) */}
              {isBadan && (
                <div className="space-y-4 rounded-xl border border-dashed p-4">
                  <p className="text-xs font-medium text-muted-foreground">Data Badan / Perusahaan (opsional)</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-npwp">NPWP</Label>
                      <Input id="c-npwp" value={form.npwp} onChange={(e) => set("npwp", e.target.value)} placeholder="00.000.000.0-000.000" />
                    </div>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm">
                      <input type="checkbox" checked={!!form.isPphWithholder} onChange={(e) => set("isPphWithholder", e.target.checked)} className="h-4 w-4 rounded border-input" />
                      Pemotong PPh 23 (badan)
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pw-name">PIC Pekerjaan</Label>
                      <Input id="c-pw-name" value={form.picWorkName} onChange={(e) => set("picWorkName", e.target.value)} placeholder="Nama" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pw-phone">HP PIC Pekerjaan</Label>
                      <Input id="c-pw-phone" value={form.picWorkPhone} onChange={(e) => set("picWorkPhone", e.target.value)} placeholder="0812…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pw-role">Jabatan/Divisi</Label>
                      <Input id="c-pw-role" value={form.picWorkRole} onChange={(e) => set("picWorkRole", e.target.value)} placeholder="mis. Building Mgmt" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pf-name">PIC Keuangan</Label>
                      <Input id="c-pf-name" value={form.picFinanceName} onChange={(e) => set("picFinanceName", e.target.value)} placeholder="Nama (untuk tagihan)" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="c-pf-phone">HP PIC Keuangan</Label>
                      <Input id="c-pf-phone" value={form.picFinancePhone} onChange={(e) => set("picFinancePhone", e.target.value)} placeholder="0812…" />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <SubmitButton pending={pending} pendingLabel="Menyimpan…">Simpan</SubmitButton>
                <Button type="button" variant="ghost" onClick={closeForm}>Batal</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {!showingForm && (
        <>
          <Input placeholder="Cari pelanggan (nama, nomor, alamat)…" value={q} onChange={(e) => setQ(e.target.value)} />

          {rows.length === 0 ? (
            q.trim() ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada pelanggan cocok.</p>
            ) : (
              <EmptyState
                icon={Icon.Users}
                title="Belum ada pelanggan"
                desc="Tambahkan pelanggan pertama Anda. Pelanggan juga otomatis masuk saat ada booking online atau saat teknisi membuat pekerjaan."
              />
            )
          ) : (
            <div className="space-y-3">
              {rows.map((c) => (
                <Card key={c.id} className="interactive">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Link href={`/app/pelanggan/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-semibold text-foreground">{c.name}</span>
                          {c.category && <Badge variant="secondary" className="shrink-0">{CATEGORY_LABEL[c.category] ?? c.category}</Badge>}
                          {c.topType && c.topType !== "CASH" && <Badge variant="outline" className="shrink-0">{TOP_LABEL[c.topType]}</Badge>}
                        </div>
                        <div className="truncate text-sm text-muted-foreground">{c.phone}{c.address ? ` · ${c.address}` : ""}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{c.assetCount} unit AC · {c.jobCount} pekerjaan</div>
                      </div>
                    </Link>
                    <Link
                      href={`/app/pelanggan/${c.id}`}
                      className="hidden shrink-0 items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium hover:bg-muted sm:inline-flex"
                    >
                      Lihat <Icon.ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
                    <Button type="button" variant="ghost" size="icon" aria-label="Ubah" onClick={() => openEdit(c)}>
                      <Icon.Note className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pending} onClick={() => del(c)}>
                      <Icon.Close className="h-4 w-4 text-destructive" aria-hidden />
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {/* Sentinel infinite-scroll + skeleton */}
              {cursor && (
                <div ref={sentinelRef} className="space-y-2 pt-1">
                  <Skeleton className="h-[76px] w-full rounded-xl" />
                  {loadingMore && <Skeleton className="h-[76px] w-full rounded-xl" />}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
