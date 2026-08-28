"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { actionInvoiceFromProforma } from "@/app/t/faktur/actions";

/** Panel admin: ubah proforma → invoice resmi + diskon (K11/K12). */
export function ProformaConvert({ proformaId, isB2B }: { proformaId: string; isB2B: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [discount, setDiscount] = useState<number>(0);

  function convert() {
    start(async () => {
      const res = await actionInvoiceFromProforma(proformaId, isB2B ? discount : 0);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Invoice ${res.data!.number} dibuat`);
      router.push(`/app/faktur/${res.data!.invoiceId}`);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <h2 className="text-sm font-semibold text-foreground">Terbitkan Invoice Resmi</h2>
        <p className="text-xs text-muted-foreground">Proforma ini akan menjadi invoice resmi. Setelah itu proforma ditutup.</p>
        {isB2B && (
          <div className="space-y-1.5">
            <Label htmlFor="disc">Diskon (opsional, per-invoice)</Label>
            <Input id="disc" type="number" min="0" step="1000" value={discount}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)} className="min-h-[44px]" />
            <p className="text-xs text-muted-foreground">Pajak dihitung setelah diskon.</p>
          </div>
        )}
        <Button type="button" onClick={convert} disabled={pending}
          className="w-full min-h-[44px] bg-sky-500 text-white hover:bg-sky-600">
          Buat Invoice dari Proforma
        </Button>
      </CardContent>
    </Card>
  );
}
