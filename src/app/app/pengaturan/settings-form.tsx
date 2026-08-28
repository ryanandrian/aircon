"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { TenantLogo } from "@/components/tenant-logo";
import { actionPresignTenantAsset, actionSaveTenantProfile } from "./actions";

type Profile = {
  name: string; logoUrl: string; isPkp: boolean; npwp: string; taxPercent: number;
  bankName: string; bankAccountNo: string; bankAccountName: string; qrisImageUrl: string;
  teamIncentiveMode: "BAGI_RATA" | "PENUH"; incentiveBasis: "LUNAS" | "TERBIT";
};

/** Upload gambar aset tenant (logo/QRIS) via presigned PUT. Seragam dgn pola admin ImageUpload. */
function TenantImageField({
  scope, label, value, onChange, hint,
}: {
  scope: "logo" | "qris"; label: string; value: string; onChange: (url: string) => void; hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function onFile(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) { toast.error("File harus JPG, PNG, atau WebP"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Ukuran maksimal 4 MB"); return; }
    setBusy(true);
    try {
      const pre = await actionPresignTenantAsset(scope, file.name, file.type);
      if (!pre.ok || !pre.uploadUrl || !pre.publicUrl) throw new Error(pre.error ?? "Gagal presign");
      const put = await fetch(pre.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload ke storage gagal");
      onChange(pre.publicUrl);
      toast.success("Gambar terunggah");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="preview" className="h-16 w-16 rounded-lg border object-contain bg-white" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed text-muted-foreground"><Upload className="h-5 w-5" /></div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <label className="inline-flex w-fit cursor-pointer">
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} disabled={busy} />
            <span className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border bg-card px-3 text-sm font-medium hover:bg-muted">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Mengunggah…" : "Pilih gambar"}
            </span>
          </label>
          {value && <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => onChange("")}>Hapus gambar</Button>}
        </div>
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SettingsForm({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState<Profile>(profile);

  function set<K extends keyof Profile>(k: K, v: Profile[K]) { setF((p) => ({ ...p, [k]: v })); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const res = await actionSaveTenantProfile({
      logoUrl: f.logoUrl, isPkp: f.isPkp, npwp: f.npwp, taxPercent: Number(f.taxPercent) || 0,
      bankName: f.bankName, bankAccountNo: f.bankAccountNo, bankAccountName: f.bankAccountName,
      qrisImageUrl: f.qrisImageUrl,
      teamIncentiveMode: f.teamIncentiveMode, incentiveBasis: f.incentiveBasis,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success("Profil usaha disimpan");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Branding */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Branding Usaha</h2>
            <p className="text-sm text-muted-foreground">Logo ini tampil di aplikasi, halaman publik, dan invoice. Ukuran ideal 512×512 (persegi).</p>
          </div>
          <div className="flex items-center gap-4">
            <TenantLogo name={f.name} logoUrl={f.logoUrl} size={56} />
            <span className="text-sm text-muted-foreground">Pratinjau logo saat ini</span>
          </div>
          <TenantImageField scope="logo" label="Logo Usaha" value={f.logoUrl} onChange={(u) => set("logoUrl", u)}
            hint="Kosongkan untuk memakai logo bawaan Aircon." />
        </CardContent>
      </Card>

      {/* Pajak */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Pajak</h2>
            <p className="text-sm text-muted-foreground">Isi hanya bila usaha Anda Pengusaha Kena Pajak (PKP). Tenant kecil non-PKP biarkan kosong — invoice tanpa PPN.</p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.isPkp} onChange={(e) => set("isPkp", e.target.checked)} className="h-4 w-4 rounded border-input" />
            Usaha saya PKP (memungut PPN)
          </label>
          {f.isPkp && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="npwp">NPWP</Label>
                <Input id="npwp" value={f.npwp} onChange={(e) => set("npwp", e.target.value)} placeholder="00.000.000.0-000.000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tax">Tarif PPN (%)</Label>
                <Input id="tax" type="number" step="0.5" min="0" max="100" value={f.taxPercent} onChange={(e) => set("taxPercent", Number(e.target.value))} placeholder="11" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rekening & QRIS */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Rekening & QRIS</h2>
            <p className="text-sm text-muted-foreground">Ditampilkan di invoice/proforma agar pelanggan tahu tujuan transfer. QRIS opsional.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="bank">Nama Bank</Label>
              <Input id="bank" value={f.bankName} onChange={(e) => set("bankName", e.target.value)} placeholder="mis. BCA" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accno">No. Rekening</Label>
              <Input id="accno" value={f.bankAccountNo} onChange={(e) => set("bankAccountNo", e.target.value)} placeholder="1234567890" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accname">Atas Nama</Label>
              <Input id="accname" value={f.bankAccountName} onChange={(e) => set("bankAccountName", e.target.value)} placeholder="Nama pemilik rekening" />
            </div>
          </div>
          <TenantImageField scope="qris" label="Gambar QRIS (opsional)" value={f.qrisImageUrl} onChange={(u) => set("qrisImageUrl", u)}
            hint="Unggah QRIS statis usaha Anda agar pelanggan bisa scan saat bayar." />
        </CardContent>
      </Card>

      {/* Insentif Tim (K5/K7) */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Insentif Tim</h2>
            <p className="text-sm text-muted-foreground">Atur bagaimana insentif teknisi & kernet dihitung. Berlaku untuk semua laporan insentif.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="basis">Acuan perhitungan</Label>
              <select id="basis" value={f.incentiveBasis} onChange={(e) => set("incentiveBasis", e.target.value as "LUNAS" | "TERBIT")}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="LUNAS">Saat invoice LUNAS (disarankan)</option>
                <option value="TERBIT">Saat invoice TERBIT</option>
              </select>
              <p className="text-xs text-muted-foreground">LUNAS: insentif dihitung setelah pelanggan bayar.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teammode">Mode bila dikeroyok banyak orang</Label>
              <select id="teammode" value={f.teamIncentiveMode} onChange={(e) => set("teamIncentiveMode", e.target.value as "BAGI_RATA" | "PENUH")}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="BAGI_RATA">Bagi rata (disarankan)</option>
                <option value="PENUH">Penuh tiap orang</option>
              </select>
              <p className="text-xs text-muted-foreground">Bagi rata: 1 layanan dikerjakan 2 teknisi → insentif dibagi 2. Penuh: masing-masing dapat penuh.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <SubmitButton pending={saving} pendingLabel="Menyimpan…">Simpan Profil Usaha</SubmitButton>
      </div>
    </form>
  );
}
