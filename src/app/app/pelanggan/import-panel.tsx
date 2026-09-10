"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { actionImportPreview, actionImportCommit, type ImportPreviewResult } from "./import-actions";

type Preview = Extract<ImportPreviewResult, { ok: true }>;

/**
 * Panel Impor Pelanggan — hidup di layar Pelanggan (bukan gerbang onboarding).
 * Alur: unduh template → unggah → pratinjau (validasi + dedup) → simpan.
 */
export function ImportPanel({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setPreview(null);
    setMsg(null);
    if (f && f.size > 8 * 1024 * 1024) {
      setMsg({ ok: false, text: "File terlalu besar (maks 8MB)." });
      e.target.value = "";
      setFile(null);
      return;
    }
    setFile(f);
  }

  function doPreview() {
    if (!file) return;
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await actionImportPreview(fd);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setPreview(res);
      if (res.validCount === 0) {
        setMsg({ ok: false, text: res.errorCount > 0 ? "Tidak ada baris yang bisa disimpan — perbaiki baris bermasalah di bawah." : "Tidak ada data baru untuk disimpan." });
      }
    });
  }

  function doCommit() {
    if (!file) return;
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await actionImportCommit(fd);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setMsg({ ok: true, text: `Berhasil menyimpan ${res.created} pelanggan${res.skipped > 0 ? ` · ${res.skipped} dilewati (duplikat/kosong)` : ""}.` });
      setPreview(null);
      setFile(null);
      onDone();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Impor Pelanggan dari Excel</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>Tutup</Button>
        </div>

        {msg && (
          <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`}>
            {msg.text}
          </p>
        )}

        {/* Langkah 1: unduh template */}
        <div className="rounded-xl border border-dashed p-4">
          <p className="text-sm font-medium text-foreground">1. Unduh template Excel</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sudah berisi panduan, contoh, & dropdown. Ada 2 sheet: <b>Pelanggan Tunai</b> (bayar di tempat) &amp;
            <b> Pelanggan Tempo</b> (institusi/ditagih). Isi yang sesuai — boleh salah satu atau keduanya.
          </p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- endpoint unduh file (route handler), bukan navigasi halaman; Link akan gagal memicu download */}
          <a
            href="/app/pelanggan/import/template"
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <Icon.Download className="h-4 w-4" aria-hidden /> Unduh Template
          </a>
        </div>

        {/* Langkah 2: unggah */}
        <div className="rounded-xl border border-dashed p-4">
          <p className="text-sm font-medium text-foreground">2. Isi lalu unggah kembali</p>
          <p className="mt-1 text-xs text-muted-foreground">Buka pakai Excel / Google Sheets / WPS. Wajib: Nama &amp; Nomor. Lalu unggah di sini.</p>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={onPick}
            className="mt-3 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:opacity-90"
          />
          {file && !preview && (
            <Button size="sm" className="mt-3" onClick={doPreview} disabled={pending}>
              {pending ? "Memeriksa…" : "Periksa File"}
            </Button>
          )}
        </div>

        {/* Langkah 3: pratinjau + simpan */}
        {preview && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-900 dark:bg-emerald-950">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{preview.validCount}</div>
                <div className="text-[0.65rem] font-semibold text-muted-foreground">Siap disimpan</div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-900 dark:bg-amber-950">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{preview.existingCount + preview.dupInFileCount}</div>
                <div className="text-[0.65rem] font-semibold text-muted-foreground">Sudah ada / dobel</div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center dark:border-red-900 dark:bg-red-950">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{preview.errorCount}</div>
                <div className="text-[0.65rem] font-semibold text-muted-foreground">Bermasalah</div>
              </div>
            </div>

            {preview.sampleErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                <p className="font-semibold">Baris perlu diperbaiki:</p>
                <ul className="mt-1 space-y-0.5">
                  {preview.sampleErrors.map((e, i) => (
                    <li key={i}>• Baris {e.excelRow} ({e.name}) — {e.reason}</li>
                  ))}
                </ul>
                <p className="mt-1 text-muted-foreground">Baris valid tetap bisa disimpan; yang ini dilewati.</p>
              </div>
            )}

            {preview.sampleValid.length > 0 && (
              <div className="rounded-lg border p-2">
                {preview.sampleValid.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 border-b py-1.5 last:border-0">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                      {v.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium">{v.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{v.phone}</span>
                  </div>
                ))}
                {preview.validCount > preview.sampleValid.length && (
                  <p className="pt-1.5 text-center text-xs text-muted-foreground">…dan {preview.validCount - preview.sampleValid.length} lainnya</p>
                )}
              </div>
            )}

            {preview.validCount > 0 && (
              <Button className="w-full" onClick={doCommit} disabled={pending}>
                {pending ? "Menyimpan…" : `Simpan ${preview.validCount} Pelanggan`}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
