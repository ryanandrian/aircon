"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/submit-button";
import { actionGenerateCodes, actionListCodes, actionExportCodesCsv, actionUnbindCode } from "./code-actions";

type Row = {
  code: string;
  status: string;
  assetLabel: string | null;
  customerId: string | null;
  customerName: string | null;
  batchId: string | null;
};

type StatusFilter = "ALL" | "POOL" | "BOUND";

/**
 * Pengelola Kode QR — siklus hidup stiker: Buat → Cetak(CSV) → Tempel/Tautkan → Pantau → Pulihkan.
 * Hierarki data ditegakkan di UI: kode → unit → pelanggan (baris Terpasang menampilkan unit + pelanggan,
 * bisa dibuka ke detail pelanggan tempat unit dikelola).
 */
export function CodeManager({ baseUrl }: { baseUrl: string }) {
  const [pending, start] = useTransition();
  const [count, setCount] = useState(10);
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [lastBatch, setLastBatch] = useState<string | null>(null);

  function refresh() {
    actionListCodes().then((r) => { setRows(r); setLoaded(true); });
  }
  useEffect(() => { refresh(); }, []);

  function generate() {
    start(async () => {
      const res = await actionGenerateCodes(count);
      if (!res.ok) { toast.error(res.error ?? "Gagal"); return; }
      setLastBatch(res.batchId ?? null);
      toast.success(`${res.codes?.length ?? 0} kode dibuat`);
      refresh();
    });
  }

  function exportCsv(batchId?: string) {
    start(async () => {
      const res = await actionExportCodesCsv(batchId);
      if (!res.ok || !res.csv) { toast.error(res.error ?? "Gagal export"); return; }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `kode-unit-aircon-${batchId ?? "semua"}-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV terunduh");
    });
  }

  function copyUrl(code: string) {
    navigator.clipboard.writeText(`${baseUrl}/u/${code}`).then(
      () => toast.success("Tautan disalin"),
      () => toast.error("Gagal menyalin"),
    );
  }

  function unbind(code: string) {
    if (!confirm(`Lepas kode ${code} dari unitnya? Kode kembali jadi "Tersedia" dan bisa ditautkan ke unit lain. Riwayat unit tetap utuh.`)) return;
    start(async () => {
      const res = await actionUnbindCode(code);
      if (!res.ok) { toast.error(res.error ?? "Gagal melepas kode"); return; }
      toast.success(`Kode ${code} dilepas`);
      refresh();
    });
  }

  const total = rows.length;
  const poolCount = rows.filter((r) => r.status === "POOL").length;
  const boundCount = rows.filter((r) => r.status === "BOUND").length;

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    const s = q.trim().toLowerCase();
    if (s) {
      list = list.filter((r) =>
        [r.code, r.assetLabel, r.customerName].some((f) => (f ?? "").toLowerCase().includes(s)),
      );
    }
    return list;
  }, [rows, q, statusFilter]);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Kode QR Sticker (opsional)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Beri tiap unit AC pelanggan satu stiker Kode QR agar riwayat perawatannya bisa dibuka lewat scan.
            Cocok untuk pelanggan banyak unit (kantor, sekolah, masjid). Export CSV untuk cetak sendiri, atau pesan stiker jadi ke Lumite.
          </p>
        </div>

        {/* Ringkasan (chip statis, bukan link palsu) */}
        {loaded && total > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1 font-medium">Total {total}</span>
            <span className="rounded-full bg-muted px-3 py-1">Tersedia <b className="text-foreground">{poolCount}</b></span>
            <span className="rounded-full bg-muted px-3 py-1">Terpasang <b className="text-foreground">{boundCount}</b></span>
          </div>
        )}

        {/* Buat + Export */}
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
          {total > 0 && (
            <Button type="button" variant="outline" onClick={() => exportCsv()} disabled={pending}>
              Export CSV
            </Button>
          )}
          {lastBatch && (
            <Button type="button" variant="ghost" onClick={() => exportCsv(lastBatch)} disabled={pending}>
              Export batch terakhir
            </Button>
          )}
        </div>

        {/* Cari + filter status (inti: layak institusi) */}
        {total > 0 && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Cari kode, unit, atau pelanggan…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-11 flex-1 rounded-xl"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-11 rounded-xl border bg-card px-3 text-sm"
              aria-label="Filter status kode"
            >
              <option value="ALL">Semua status</option>
              <option value="POOL">Tersedia</option>
              <option value="BOUND">Terpasang</option>
            </select>
          </div>
        )}

        {/* Daftar kode */}
        {total === 0 ? (
          loaded && (
            <div className="rounded-xl border border-dashed p-6 text-center">
              <p className="text-sm font-medium text-foreground">Belum ada kode QR</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tentukan jumlah lalu tekan &quot;Buat Kode&quot; untuk mulai. Butuh panduan? Buka menu Panduan.
              </p>
            </div>
          )
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Tidak ada kode cocok dengan pencarian.</p>
        ) : (
          <div className="max-h-[28rem] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Kode</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Unit &amp; Pelanggan</th>
                  <th className="px-3 py-2 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.code} className="border-t align-middle">
                    <td className="px-3 py-2 font-mono font-semibold text-foreground">{r.code}</td>
                    <td className="px-3 py-2">
                      {r.status === "BOUND"
                        ? <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">Terpasang</Badge>
                        : <Badge variant="secondary">Tersedia</Badge>}
                    </td>
                    <td className="px-3 py-2">
                      {r.status === "BOUND" ? (
                        <div className="min-w-0">
                          <div className="truncate text-foreground">{r.assetLabel ?? "Unit AC"}</div>
                          {r.customerId ? (
                            <Link href={`/app/pelanggan/${r.customerId}`} className="truncate text-xs text-sky-600 hover:underline dark:text-sky-400">
                              {r.customerName ?? "Pelanggan"}
                            </Link>
                          ) : (
                            <div className="truncate text-xs text-muted-foreground">{r.customerName ?? "—"}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {r.status === "BOUND" ? (
                          <>
                            <a href={`/u/${r.code}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-sky-600 hover:bg-muted dark:text-sky-400">
                              Buka
                            </a>
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => unbind(r.code)} disabled={pending}>
                              Lepas
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => copyUrl(r.code)}>
                              Salin URL
                            </Button>
                            <a href={`/u/${r.code}`} target="_blank" rel="noopener noreferrer"
                              className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-muted">
                              Pratinjau
                            </a>
                          </>
                        )}
                      </div>
                    </td>
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
