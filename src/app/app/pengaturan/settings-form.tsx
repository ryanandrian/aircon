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
import { actionUploadTenantAsset, actionSaveTenantProfile } from "./actions";

type Profile = {
  name: string; phone: string; address: string; tagline: string;
  logoUrl: string; isPkp: boolean; npwp: string; taxPercent: number;
  bankName: string; bankAccountNo: string; bankAccountName: string; qrisImageUrl: string;
  teamIncentiveMode: "BAGI_RATA" | "PENUH"; incentiveBasis: "LUNAS" | "TERBIT";
  incentiveEnabled: boolean;
  publicDescription: string; services: string[]; operatingHours: string;
  trustBadges: string[]; areaCities: string[]; areaDistricts: string[];
  instagram: string; mapUrl: string;
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
      const fd = new FormData();
      fd.append("file", file);
      const res = await actionUploadTenantAsset(scope, fd);
      if (!res.ok || !res.publicUrl) throw new Error(res.error ?? "Gagal mengunggah");
      onChange(res.publicUrl);
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

/** Editor daftar (chip): tambah dengan Enter/koma, hapus dengan ×. Untuk layanan, area, dsb. */
function ChipListInput({
  label, values, onChange, placeholder, hint, max = 30,
}: {
  label: string; values: string[]; onChange: (next: string[]) => void;
  placeholder: string; hint?: string; max?: number;
}) {
  const [draft, setDraft] = useState("");
  function commit(text: string) {
    const parts = text.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = [...values];
    for (const p of parts) {
      if (next.length >= max) break;
      if (!next.some((v) => v.toLowerCase() === p.toLowerCase())) next.push(p);
    }
    onChange(next);
    setDraft("");
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v, i) => (
            <span key={`${v}-${i}`} className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sm text-sky-700 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-300">
              {v}
              <button type="button" aria-label={`Hapus ${v}`} className="ml-0.5 text-sky-500 hover:text-red-500"
                onClick={() => onChange(values.filter((_, idx) => idx !== i))}>×</button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(draft); }
        }}
        onBlur={() => { if (draft.trim()) commit(draft); }}
        placeholder={placeholder}
        disabled={values.length >= max}
      />
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
      name: f.name, phone: f.phone, address: f.address, tagline: f.tagline,
      logoUrl: f.logoUrl, isPkp: f.isPkp, npwp: f.npwp, taxPercent: Number(f.taxPercent) || 0,
      bankName: f.bankName, bankAccountNo: f.bankAccountNo, bankAccountName: f.bankAccountName,
      qrisImageUrl: f.qrisImageUrl,
      teamIncentiveMode: f.teamIncentiveMode, incentiveBasis: f.incentiveBasis,
      incentiveEnabled: f.incentiveEnabled,
      publicDescription: f.publicDescription, services: f.services, operatingHours: f.operatingHours,
      trustBadges: f.trustBadges, areaCities: f.areaCities, areaDistricts: f.areaDistricts,
      instagram: f.instagram, mapUrl: f.mapUrl,
    });
    setSaving(false);
    if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
    toast.success("Profil usaha disimpan");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* Identitas Usaha */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Identitas Usaha</h2>
            <p className="text-sm text-muted-foreground">Nama, moto, kontak & alamat ini tampil di seluruh aplikasi dan pada invoice/kwitansi.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bizname">Nama Usaha</Label>
              <Input id="bizname" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="mis. AC Jaya Teknik" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bizphone">Telepon / WhatsApp Usaha</Label>
              <Input id="bizphone" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0812xxxxxxx" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="biztagline">Moto / Slogan Usaha</Label>
            <Input id="biztagline" value={f.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder="mis. Dingin Cepat, Harga Bersahabat" maxLength={160} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bizaddr">Alamat Usaha</Label>
            <textarea id="bizaddr" value={f.address} onChange={(e) => set("address", e.target.value)} rows={2}
              placeholder="Jl. Contoh No. 123, Kota" maxLength={300}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
        </CardContent>
      </Card>

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

      {/* Halaman Usaha Publik (/p) */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Halaman Usaha Publik</h2>
            <p className="text-sm text-muted-foreground">
              Yang tampil di halaman publik usaha Anda (untuk calon pelanggan). Semua opsional — bila
              dikosongkan, dipakai nilai bawaan yang rapi.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pubdesc">Deskripsi Usaha</Label>
            <textarea id="pubdesc" value={f.publicDescription} onChange={(e) => set("publicDescription", e.target.value)} rows={3}
              placeholder="Perkenalkan usaha Anda: layanan unggulan, pengalaman, wilayah. (Kosongkan untuk teks bawaan.)"
              maxLength={600}
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>

          <ChipListInput
            label="Layanan Kami"
            values={f.services}
            onChange={(v) => set("services", v)}
            placeholder="Ketik layanan lalu Enter (mis. Cuci AC)"
            hint="Kosong = pakai layanan bawaan (Cuci AC, Isi Freon, Perbaikan, Pasang Baru, Pengecekan). Maks 12."
            max={12}
          />

          <ChipListInput
            label="Area Layanan — Kota"
            values={f.areaCities}
            onChange={(v) => set("areaCities", v)}
            placeholder="Ketik kota lalu Enter (mis. Depok)"
            hint="Kota/kabupaten yang Anda layani."
          />
          <ChipListInput
            label="Area Layanan — Kecamatan (opsional)"
            values={f.areaDistricts}
            onChange={(v) => set("areaDistricts", v)}
            placeholder="Ketik kecamatan lalu Enter"
          />

          <div className="space-y-1.5">
            <Label htmlFor="ophours">Jam Operasional</Label>
            <Input id="ophours" value={f.operatingHours} onChange={(e) => set("operatingHours", e.target.value)}
              placeholder="mis. Senin–Sabtu, 08.00–17.00" maxLength={120} />
            <p className="text-xs text-muted-foreground">Kosong = &quot;Setiap hari, 08.00–17.00&quot;.</p>
          </div>

          <ChipListInput
            label="Sinyal Kepercayaan (maks 3)"
            values={f.trustBadges}
            onChange={(v) => set("trustBadges", v)}
            placeholder="mis. Garansi 30 hari, Teknisi bersertifikat"
            hint="3 label singkat di bagian atas halaman. Kosong = bawaan (Respons cepat, Dikonfirmasi WhatsApp, Pesan online 24 jam)."
            max={3}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ig">Instagram (opsional)</Label>
              <Input id="ig" value={f.instagram} onChange={(e) => set("instagram", e.target.value)}
                placeholder="@usaha_anda atau URL" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="map">Google Maps (opsional)</Label>
              <Input id="map" value={f.mapUrl} onChange={(e) => set("mapUrl", e.target.value)}
                placeholder="Tautan lokasi Google Maps" maxLength={500} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Tautan sosial &amp; Maps disembunyikan di halaman publik bila dikosongkan.
          </p>
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
          {/* Master toggle: NIAT eksplisit menerapkan program insentif. Off → teknisi tak lihat UI insentif sama sekali. */}
          <label className="flex items-start gap-3 rounded-xl border p-4">
            <input type="checkbox" checked={f.incentiveEnabled}
              onChange={(e) => set("incentiveEnabled", e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-sky-600" />
            <span>
              <span className="block text-sm font-medium">Terapkan program insentif tim</span>
              <span className="block text-xs text-muted-foreground">Bila dimatikan, teknisi tidak akan melihat kartu, angka, atau riwayat insentif apa pun. Nyalakan hanya jika usaha Anda memberi insentif per pekerjaan.</span>
            </span>
          </label>
          <div className={`grid gap-4 sm:grid-cols-2 ${f.incentiveEnabled ? "" : "pointer-events-none opacity-50"}`}>
            <div className="space-y-1.5">
              <Label htmlFor="basis">Acuan perhitungan</Label>
              <select id="basis" value={f.incentiveBasis} disabled={!f.incentiveEnabled} onChange={(e) => set("incentiveBasis", e.target.value as "LUNAS" | "TERBIT")}
                className="min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm">
                <option value="LUNAS">Saat invoice LUNAS (disarankan)</option>
                <option value="TERBIT">Saat invoice TERBIT</option>
              </select>
              <p className="text-xs text-muted-foreground">LUNAS: insentif dihitung setelah pelanggan bayar.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="teammode">Mode bila dikeroyok banyak orang</Label>
              <select id="teammode" value={f.teamIncentiveMode} disabled={!f.incentiveEnabled} onChange={(e) => set("teamIncentiveMode", e.target.value as "BAGI_RATA" | "PENUH")}
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
