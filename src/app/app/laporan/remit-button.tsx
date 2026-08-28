"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionMarkCashRemitted } from "./actions";

/** Tombol "Tandai Sudah Disetor" untuk kumpulan invoice kas 1 teknisi (K17). */
export function RemitButton({ techName, invoiceIds }: { techName: string; invoiceIds: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function remit() {
    if (!confirm(`Catat setoran kas dari ${techName} (${invoiceIds.length} transaksi) sebagai SUDAH DISETOR?`)) return;
    start(async () => {
      const res = await actionMarkCashRemitted(invoiceIds);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Setoran ${techName} dicatat (${res.data!.count} transaksi)`);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" onClick={remit} disabled={pending || done}
      className="bg-emerald-600 text-white hover:bg-emerald-700">
      {done ? "Tercatat" : "Tandai Disetor"}
    </Button>
  );
}
