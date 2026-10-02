"use client";

/**
 * Interval Servis — atur berapa hari setelah pekerjaan selesai unit dijadwalkan
 * servis berikutnya. Menyentuh Tenant.maintenanceIntervalDays (aturan default
 * seluruh usaha; unit bisa punya aturan sendiri yang menimpa ini).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import { Icon } from "@/components/icons";
import { actionSaveMaintenanceInterval } from "./maintenance-actions";

const MIN_DAYS = 1;
const MAX_DAYS = 730;

const PRESET = [30, 60, 90, 180] as const;

/** Tanggal hasil "hari ini + N hari" — peniruan formula computeNextServiceDate. */
function previewDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

export function MaintenanceIntervalCard({ initialDays }: { initialDays: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(initialDays));
  const [saved, setSaved] = useState<number | null>(null);

  const parsed = Number(value);
  const valid = Number.isInteger(parsed) && parsed >= MIN_DAYS && parsed <= MAX_DAYS;
  const dirty = valid && parsed !== initialDays;

  function submit() {
    if (!valid) {
      toast.error(`Interval harus bilangan bulat ${MIN_DAYS}–${MAX_DAYS} hari`);
      return;
    }
    start(async () => {
      const res = await actionSaveMaintenanceInterval(parsed);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Jadwal servis disimpan");
      setSaved(res.days);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Interval Servis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Setelah pekerjaan pada satu unit selesai, unit itu otomatis dijadwalkan
            diservis lagi setelah jangka waktu di bawah. Berlaku untuk seluruh unit di
            usaha Anda yang belum punya jadwal sendiri.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40 space-y-1.5">
            <Label htmlFor="mi-days">Servis berikutnya setelah</Label>
            <div className="flex items-center gap-2">
              <Input
                id="mi-days"
                type="number"
                inputMode="numeric"
                min={MIN_DAYS}
                max={MAX_DAYS}
                step={1}
                value={value}
                onChange={(e) => { setValue(e.target.value); setSaved(null); }}
                aria-describedby="mi-hint"
                aria-invalid={!valid}
                className="text-right"
              />
              <span className="shrink-0 text-sm text-muted-foreground">hari</span>
            </div>
          </div>

          <SubmitButton
            pending={pending}
            disabled={!valid || !dirty}
            pendingLabel="Menyimpan…"
            onClick={submit}
            type="button"
          >
            Simpan
          </SubmitButton>
        </div>

        {/* Pratinjau dampak — angka mentah sulit dibayangkan orang non-teknis. */}
        {valid && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-sm text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/30 dark:text-sky-200"
          >
            <Icon.Repeat className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Contoh: unit selesai diservis hari ini → jadwal servis berikutnya{" "}
              <b>{previewDate(parsed)}</b>.
            </span>
          </div>
        )}

        {!valid && value.trim() !== "" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            Masukkan bilangan bulat antara {MIN_DAYS} dan {MAX_DAYS} hari.
          </p>
        )}

        {/* Preset umum industri — mempercepat, tidak menggantikan input bebas. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Cepat:</span>
          {PRESET.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => { setValue(String(d)); setSaved(null); }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                String(d) === value
                  ? "border-sky-500 bg-sky-500 text-white"
                  : "border-border text-muted-foreground hover:border-sky-300 hover:text-sky-700 dark:hover:border-sky-800 dark:hover:text-sky-300"
              }`}
            >
              {d} hari
            </button>
          ))}
        </div>

        <p id="mi-hint" className="text-xs text-muted-foreground">
          {saved !== null
            ? `Tersimpan: setiap ${saved} hari. Pekerjaan yang sudah selesai memakai jadwal ini.`
            : "Bawaan saat ini: " + initialDays + " hari. Perubahan hanya memengaruhi pekerjaan yang selesai berikutnya."}
        </p>
      </CardContent>
    </Card>
  );
}
