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
import { actionSaveTestimonial, actionDeleteTestimonial } from "./actions";

type T = {
  id: string; name: string; business: string; quote: string; photoUrl: string;
  rating: number; sortOrder: number; published: boolean;
};

export function TestimonialManager({ items }: { items: T[] }) {
  const [editing, setEditing] = useState<T | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingDel, startDel] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startDel(async () => {
      const r = await actionSaveTestimonial(fd);
      if (r.ok) { toast.success("Testimoni tersimpan"); setEditing(null); setAdding(false); }
      else toast.error(r.error ?? "Gagal menyimpan");
    });
  }

  function del(id: string) {
    if (!confirm("Hapus testimoni ini?")) return;
    startDel(async () => {
      const r = await actionDeleteTestimonial(id);
      if (r.ok) toast.success("Testimoni dihapus");
      else toast.error(r.error ?? "Gagal menghapus");
    });
  }

  const editForm = (t: T | null) => (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <input type="hidden" name="id" defaultValue={t?.id ?? ""} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="t-name">Nama*</Label><Input id="t-name" name="name" defaultValue={t?.name ?? ""} required /></div>
            <div className="space-y-1.5"><Label htmlFor="t-biz">Usaha</Label><Input id="t-biz" name="business" defaultValue={t?.business ?? ""} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="t-quote">Kutipan*</Label><Textarea id="t-quote" name="quote" defaultValue={t?.quote ?? ""} rows={3} required /></div>
          <ImageUpload name="photoUrl" label="Foto" scope="testimonial" defaultUrl={t?.photoUrl} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="t-rating">Rating (1-5)</Label><Input id="t-rating" name="rating" type="number" min={1} max={5} defaultValue={t?.rating ?? 5} /></div>
            <div className="space-y-1.5"><Label htmlFor="t-order">Urutan</Label><Input id="t-order" name="sortOrder" type="number" defaultValue={t?.sortOrder ?? 0} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="published" defaultChecked={t?.published ?? true} className="h-4 w-4 accent-sky-500" /> Tampilkan</label>
          </div>
          <div className="flex gap-2">
            <SubmitButton pending={pendingDel} pendingLabel="Menyimpan…">Simpan</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => { setEditing(null); setAdding(false); }}>Batal</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Testimoni Pelanggan</h2>
        {!adding && !editing && (
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Tambah</Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Isi HANYA dengan testimoni nyata dari pelanggan Anda. Testimoni tampil di landing bila bagian &quot;Testimoni&quot; diaktifkan.
      </p>

      {adding && editForm(null)}
      {editing && editForm(editing)}

      {!adding && !editing && (
        items.length === 0 ? (
          <Card className="border-dashed bg-muted/20 shadow-none">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">Belum ada testimoni. Tambahkan saat pelanggan pertama memberi ulasan.</CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <Card key={t.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  {t.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.photoUrl} alt={t.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500 font-bold text-white">{t.name.charAt(0).toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-foreground">{t.name}</span>
                      {!t.published && <Badge variant="secondary">Tersembunyi</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{t.quote}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" aria-label="Hapus" disabled={pendingDel} onClick={() => del(t.id)}>
                    {pendingDel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
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
