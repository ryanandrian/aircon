"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/empty-state";
import { actionCreateCustomer, actionUpdateCustomer, actionDeleteCustomer } from "./actions";

type Cust = {
  id: string; name: string; phone: string; address: string | null;
  source: string; notes: string | null; assetCount: number; jobCount: number;
};

const SOURCE_LABEL: Record<string, string> = {
  REFERRAL: "Referensi", WHATSAPP: "WhatsApp", WALK_IN: "Datang langsung", MARKETING: "Marketing",
  WEBSITE: "Booking online", IOT_ALERT: "Alert IoT", REPEAT: "Servis ulang", OTHER: "Lainnya",
};
const SOURCE_OPTIONS = Object.entries(SOURCE_LABEL);

export function CustomerManager({ customers }: { customers: Cust[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Cust | null>(null);
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      [c.name, c.phone, c.address].some((f) => (f ?? "").toLowerCase().includes(s)),
    );
  }, [customers, q]);

  function save(e: React.FormEvent<HTMLFormElement>, id?: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      address: String(fd.get("address") ?? ""),
      source: String(fd.get("source") ?? "OTHER"),
      notes: String(fd.get("notes") ?? ""),
    };
    start(async () => {
      const res = id ? await actionUpdateCustomer(id, payload) : await actionCreateCustomer(payload);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(id ? "Pelanggan diperbarui" : "Pelanggan ditambahkan");
      setEditing(null); setAdding(false);
      router.refresh();
    });
  }

  function del(c: Cust) {
    if (!confirm(`Hapus pelanggan "${c.name}"? Data unit & riwayat tetap tersimpan.`)) return;
    start(async () => {
      const res = await actionDeleteCustomer(c.id);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success("Pelanggan dihapus");
      router.refresh();
    });
  }

  const form = (c: Cust | null) => (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={(e) => save(e, c?.id)} className="space-y-4">
          <h2 className="text-lg font-semibold">{c ? "Ubah Pelanggan" : "Tambah Pelanggan"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nama <span className="text-red-500">*</span></Label>
              <Input id="c-name" name="name" defaultValue={c?.name ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">No. WhatsApp <span className="text-red-500">*</span></Label>
              <Input id="c-phone" name="phone" defaultValue={c?.phone ?? ""} placeholder="0812…" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-address">Alamat</Label>
            <Textarea id="c-address" name="address" defaultValue={c?.address ?? ""} rows={2} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-source">Sumber</Label>
              <select id="c-source" name="source" defaultValue={c?.source ?? "OTHER"} className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-sm">
                {SOURCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Catatan</Label>
              <Input id="c-notes" name="notes" defaultValue={c?.notes ?? ""} placeholder="opsional" />
            </div>
          </div>
          <div className="flex gap-2">
            <SubmitButton pending={pending} pendingLabel="Menyimpan…">Simpan</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => { setEditing(null); setAdding(false); }}>Batal</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{customers.length} pelanggan</p>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Icon.Users className="h-4 w-4" aria-hidden /> Tambah Pelanggan
          </Button>
        )}
      </div>

      {adding && form(null)}
      {editing && form(editing)}

      {!adding && !editing && customers.length > 0 && (
        <Input placeholder="Cari pelanggan (nama, nomor, alamat)…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {!adding && !editing && (
        filtered.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState
              icon={Icon.Users}
              title="Belum ada pelanggan"
              desc="Tambahkan pelanggan pertama Anda. Pelanggan juga otomatis masuk saat ada booking online atau saat teknisi membuat pekerjaan."
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Tidak ada pelanggan cocok.</p>
          )
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500 font-bold text-white">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{c.name}</span>
                      <Badge variant="secondary" className="shrink-0">{SOURCE_LABEL[c.source] ?? c.source}</Badge>
                    </div>
                    <div className="truncate text-sm text-muted-foreground">{c.phone}{c.address ? ` · ${c.address}` : ""}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{c.assetCount} unit AC · {c.jobCount} pekerjaan</div>
                  </div>
                  <a
                    href={`https://wa.me/${c.phone.replace(/^0/, "62")}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    aria-label="Chat WhatsApp"
                  >
                    <Icon.Message className="h-4 w-4" aria-hidden />
                  </a>
                  <Button type="button" variant="ghost" size="icon" aria-label="Ubah" onClick={() => setEditing(c)}>
                    <Icon.Note className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pending} onClick={() => del(c)}>
                    <Icon.Close className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
