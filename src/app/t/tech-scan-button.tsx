"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { QrScanner } from "@/app/app/unit/qr-scanner";
import { actionTechScan } from "@/app/t/kerja/actions";

/**
 * Tombol Scan QR di beranda teknisi. Alur:
 *  - kode BOUND (unit tenant ini) → buka rekam-medis unit (/u/{code}).
 *  - kode POOL (belum tertaut) → beri tahu cara menautkan (lewat layar kerja pelanggan).
 *  - kode usaha lain / tak dikenal → pesan jelas.
 */
export function TechScanButton() {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);

  async function onCode(code: string) {
    setScanning(false);
    const res = await actionTechScan(code);
    if (!res.ok) { toast.error(res.error); return; }
    const d = res.data!;
    if (d.action === "open") {
      toast.success("Membuka rekam-medis unit…");
      router.push(`/u/${d.code}`);
    } else if (d.action === "pool") {
      toast.info(`Kode ${d.code} belum tertaut ke unit. Buka pekerjaan pelanggan, lalu "+ Unit baru" atau pilih unit untuk menautkannya.`);
    } else if (d.action === "forbidden") {
      toast.error("Kode ini milik usaha lain.");
    } else {
      toast.error(`Kode ${d.code} tidak dikenal.`);
    }
  }

  return (
    <>
      {scanning && <QrScanner onCode={onCode} onClose={() => setScanning(false)} />}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Scan Kode QR unit"
        onClick={() => setScanning(true)}
      >
        <Icon.Web className="h-5 w-5" aria-hidden />
      </Button>
    </>
  );
}
