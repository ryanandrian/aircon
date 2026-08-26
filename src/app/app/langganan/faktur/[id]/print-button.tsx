"use client";

import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button onClick={() => window.print()} className="min-h-[40px] gap-2">
      <Icon.Print className="h-4 w-4" aria-hidden /> Cetak / Simpan PDF
    </Button>
  );
}
