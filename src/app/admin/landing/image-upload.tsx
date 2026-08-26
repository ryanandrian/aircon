"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { actionPresignAsset } from "./actions";

/**
 * Upload gambar ke S3 via presigned PUT, lalu isi hidden input `name` dengan public URL.
 * Menampilkan preview. URL juga bisa ditempel manual.
 */
export function ImageUpload({ name, label, scope, defaultUrl }: { name: string; label: string; scope: string; defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      toast.error("File harus JPG, PNG, atau WebP");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("Ukuran maksimal 4 MB");
      return;
    }
    setBusy(true);
    try {
      const pre = await actionPresignAsset(scope, file.name, file.type);
      if (!pre.ok || !pre.uploadUrl || !pre.publicUrl) throw new Error(pre.error ?? "Gagal presign");
      const put = await fetch(pre.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload ke storage gagal");
      setUrl(pre.publicUrl);
      toast.success("Gambar terunggah");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="preview" className="h-14 w-14 rounded-lg border object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed text-muted-foreground"><Upload className="h-5 w-5" /></div>
        )}
        <div className="flex-1">
          <label className="inline-flex cursor-pointer">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              disabled={busy}
            />
            <span className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Mengunggah…" : "Pilih gambar"}
            </span>
          </label>
        </div>
      </div>
      <Input name={name} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="atau tempel URL gambar…" className="text-xs" />
      {url && <Button type="button" variant="ghost" size="sm" onClick={() => setUrl("")}>Hapus gambar</Button>}
    </div>
  );
}
