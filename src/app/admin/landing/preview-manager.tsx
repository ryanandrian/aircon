"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { ImageUpload } from "./image-upload";
import { actionSavePreviewItem, actionDeletePreviewItem } from "./actions";

type P = {
  id: string; title: string; caption: string; imageUrl: string;
  category: string; sortOrder: number; published: boolean;
};

export function PreviewManager({ items }: { items: P[] }) {
  const [editing, setEditing] = useState<P | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await actionSavePreviewItem(fd);
      if (r.ok) { toast.success("Pratinjau tersimpan"); setEditing(null); setAdding(false); }
      else toast.error(r.error ?? "Gagal menyimpan");
    });
  }

  function del(id: string) {
    if (!confirm("Hapus item pratinjau ini?")) return;
    start(async () => {
      const r = await actionDeletePreviewItem(id);
      if (r.ok) toast.success("Pratinjau dihapus");
      else toast.error(r.error ?? "Gagal menghapus");
    });
  }

  const editForm = (p: P | null) => (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" defaultValue={p?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="p-title">Judul layar*</Label><Input id="p-title" name="title" defaultValue={p?.title ?? ""} required placeholder="Buat Invoice Otomatis" /></div>
            <div className="space-y-1.5"><Label htmlFor="p-cat">Kategori</Label><Input id="p-cat" name="category" defaultValue={p?.category ?? ""} placeholder="Invoice" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="p-cap">Keterangan singkat</Label><Textarea id="p-cap" name="caption" defaultValue={p?.caption ?? ""} rows={2} placeholder="Selesai kerja, faktur ber-logo langsung jadi." /></div>
          <ImageUpload name="imageUrl" label="Tangkapan layar / foto*" scope="preview" defaultUrl={p?.imageUrl} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="p-order">Urutan</Label><Input id="p-order" name="sortOrder" type="number" defaultValue={p?.sortOrder ?? 0} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="published" defaultChecked={p?.published ?? true} className="h-4 w-4 accent-sky-500" /> Tampilkan</label>
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Pratinjau Aplikasi (pengganti demo)</h2>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Tambah</Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Tangkapan layar/foto yang tampil di halaman <b>/pratinjau</b>. Tiap item: gambar + judul + keterangan. Gambar diunggah ke S3.
      </p>

      {adding && editForm(null)}
      {editing && editForm(editing)}

      {!adding && !editing && (
        items.length === 0 ? (
          <Card className="border-dashed bg-muted/20 shadow-none">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Belum ada item pratinjau. Tambahkan tangkapan layar aplikasi.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.title} className="h-12 w-16 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{p.title}</span>
                      {p.category && <Badge variant="secondary">{p.category}</Badge>}
                      {!p.published && <Badge variant="secondary">Tersembunyi</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{p.caption}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pending} onClick={() => del(p.id)}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
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
