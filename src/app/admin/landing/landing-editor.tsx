"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { ImageUpload } from "./image-upload";
import { actionSaveLanding } from "./actions";

type Content = Record<string, string | boolean>;

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-sky-500" />
    </label>
  );
}

export function LandingEditor({ initial }: { initial: Content }) {
  const [pending, start] = useTransition();
  const s = (k: string) => (initial[k] as string) ?? "";
  const b = (k: string) => Boolean(initial[k]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await actionSaveLanding(fd);
      if (r.ok) toast.success("Konten landing tersimpan");
      else toast.error(r.error ?? "Gagal menyimpan");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Gambar brand */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Gambar Brand</h2>
          <div className="grid gap-5 sm:grid-cols-3">
            <ImageUpload name="logoUrl" label="Logo" scope="landing" defaultUrl={s("logoUrl")} />
            <ImageUpload name="heroImageUrl" label="Gambar Hero (ganti mock produk)" scope="landing" defaultUrl={s("heroImageUrl")} />
            <ImageUpload name="ogImageUrl" label="OG Image (thumbnail share)" scope="landing" defaultUrl={s("ogImageUrl")} />
          </div>
        </CardContent>
      </Card>

      {/* Hero */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Bagian Hero</h2>
          <div className="space-y-1.5"><Label htmlFor="heroBadge">Badge</Label><Input id="heroBadge" name="heroBadge" defaultValue={s("heroBadge")} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="heroTitle">Judul</Label><Input id="heroTitle" name="heroTitle" defaultValue={s("heroTitle")} /></div>
            <div className="space-y-1.5"><Label htmlFor="heroTitleAccent">Judul (kata beraksen warna)</Label><Input id="heroTitleAccent" name="heroTitleAccent" defaultValue={s("heroTitleAccent")} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="heroSubtitle">Sub-judul</Label><Textarea id="heroSubtitle" name="heroSubtitle" defaultValue={s("heroSubtitle")} rows={3} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="heroCtaPrimary">Tombol utama</Label><Input id="heroCtaPrimary" name="heroCtaPrimary" defaultValue={s("heroCtaPrimary")} /></div>
            <div className="space-y-1.5"><Label htmlFor="heroCtaSecondary">Tombol kedua</Label><Input id="heroCtaSecondary" name="heroCtaSecondary" defaultValue={s("heroCtaSecondary")} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="heroMicrocopy">Microcopy (di bawah tombol)</Label><Input id="heroMicrocopy" name="heroMicrocopy" defaultValue={s("heroMicrocopy")} /></div>
        </CardContent>
      </Card>

      {/* Cara kerja + CTA + footer */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Judul Bagian &amp; Penutup</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="howTitle">Judul &quot;Cara kerja&quot;</Label><Input id="howTitle" name="howTitle" defaultValue={s("howTitle")} /></div>
            <div className="space-y-1.5"><Label htmlFor="howSubtitle">Sub-judul &quot;Cara kerja&quot;</Label><Input id="howSubtitle" name="howSubtitle" defaultValue={s("howSubtitle")} /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="ctaTitle">Judul CTA akhir</Label><Input id="ctaTitle" name="ctaTitle" defaultValue={s("ctaTitle")} /></div>
            <div className="space-y-1.5"><Label htmlFor="ctaButton">Tombol CTA akhir</Label><Input id="ctaButton" name="ctaButton" defaultValue={s("ctaButton")} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="ctaSubtitle">Sub-judul CTA akhir</Label><Input id="ctaSubtitle" name="ctaSubtitle" defaultValue={s("ctaSubtitle")} /></div>
          <div className="space-y-1.5"><Label htmlFor="footerTagline">Teks footer</Label><Input id="footerTagline" name="footerTagline" defaultValue={s("footerTagline")} /></div>
        </CardContent>
      </Card>

      {/* Toggle section */}
      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">Tampilkan / Sembunyikan Bagian</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <Toggle name="showRoi" label="Bar ROI" defaultChecked={b("showRoi")} />
            <Toggle name="showHow" label="Cara kerja" defaultChecked={b("showHow")} />
            <Toggle name="showSegments" label="Untuk siapa" defaultChecked={b("showSegments")} />
            <Toggle name="showPricing" label="Harga" defaultChecked={b("showPricing")} />
            <Toggle name="showTestimonials" label="Testimoni" defaultChecked={b("showTestimonials")} />
            <Toggle name="showFaq" label="FAQ" defaultChecked={b("showFaq")} />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Menyimpan…" className="shadow-lg">Simpan Perubahan</SubmitButton>
      </div>
    </form>
  );
}
