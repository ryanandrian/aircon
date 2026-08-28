"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/icons";
import { techSaveCustomerLocation } from "../../actions";

/**
 * Tombol teknisi menyimpan koordinat GPS pelanggan saat berada di lokasi.
 * Memakai navigator.geolocation (butuh HTTPS + izin). Memudahkan kunjungan berikutnya.
 */
export function SaveLocationButton({ jobId, hasLocation }: { jobId: string; hasLocation: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  function save() {
    if (!("geolocation" in navigator)) {
      toast.error("Perangkat tak mendukung GPS");
      return;
    }
    if (hasLocation && !confirm("Lokasi pelanggan sudah tersimpan. Perbarui dengan lokasi Anda sekarang?")) return;
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await techSaveCustomerLocation(jobId, pos.coords.latitude, pos.coords.longitude);
        setBusy(false);
        if (!res.ok) { toast.error(res.error); return; }
        toast.success("Lokasi pelanggan tersimpan");
        router.refresh();
      },
      (err) => {
        setBusy(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Izin lokasi ditolak" : "Gagal mengambil lokasi");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <button
      type="button"
      onClick={save}
      disabled={busy}
      className="flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-xl bg-muted text-sm font-medium text-foreground disabled:opacity-60"
    >
      <Icon.Location className="h-4 w-4" aria-hidden />
      {busy ? "Mengambil…" : hasLocation ? "Perbarui Lokasi" : "Simpan Lokasi"}
    </button>
  );
}
