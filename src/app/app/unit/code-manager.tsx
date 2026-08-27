"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { actionGenerateCodes, actionListCodes, actionExportCodesCsv } from "./code-actions";

type Row = { code: string; status: string; assetLabel: string | null; batchId: string | null };

export function CodeManager() {
  const [pending, start] = useTransition();
  const [count, setCount] = useState(10);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);

  function refresh() {
    actionListCodes().then((r) => { setRows(r); setLoaded(true); });
  }
  useEffect(() => { refresh(); }, []);

  function generate() {
    start(async () => {
      const res = await actionGenerateCodes(count);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      toast.success(`${res.codes?.length ?? 0} kode dibuat (batch ${res.batchId})`);
      refresh();
    });
  }

  function exportCsv() {
    start(async () => {
      const res = await actionExportCodesCsv();
      if (!res.ok || !res.csv) { toast.error(res.error ?? "Gagal export"); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `kode-unit-aircon-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV terunduh");
    });
  }

  const poolCount = rows.filter((r) => r.status === "POOL").length;
  const boundCount = rows.filter((r) => r.status === "BOUND").length;

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Kode QR Sticker (opsional)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat kode unik untuk ditempel di unit AC (opsional, cocok untuk institusi banyak unit).
            Export CSV untuk cetak sendiri, atau pesan sticker jadi ke Lumite.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="code-count">Jumlah kode</Label>
            <Input id="code-count" type="number" min="1" max="1000" value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(1000, Number(e.target.value) || 1)))}
              className="w-32" />
          </div>
          <SubmitButton pending={pending} pendingLabel="Membuat…" onClick={generate} type="button">
            Buat Kode
          </SubmitButton>
          {rows.length > 0 && (
            <Button type="button" variant="outline" onClick={exportCsv} disabled={pending}>
              Export CSV
            </Button>
          )}
        </div>

        {loaded && rows.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {rows.length} kode • <span className="text-sky-600 dark:text-sky-400">{poolCount} tersedia</span> • {boundCount} terpasang
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-64 overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Kode</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r) => (
                  <tr key={r.code} className="border-t">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.code}</td>
                    <td className="px-3 py-2">
                      {r.status === "BOUND"
                        ? <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Terpasang</Badge>
                        : <Badge variant="secondary">Tersedia</Badge>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.assetLabel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
