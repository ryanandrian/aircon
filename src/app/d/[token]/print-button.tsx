"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";

/**
 * Tombol cetak utk halaman dokumen publik /d/{token} (F7b).
 * Pola SAMA dgn InvoiceActions (window.print) — hanya ini berdiri sendiri
 * karena halaman publik TIDAK memuat chrome app (tanpa tenant session).
 * Tersembunyi saat print (print:hidden) supaya tak ikut tercetak.
 */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()} className="w-full gap-2 print:hidden">
      <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
    </Button>
  );
}
