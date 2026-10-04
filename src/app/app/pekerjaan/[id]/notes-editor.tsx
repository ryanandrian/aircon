"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateJobNotes } from "../actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Icon } from "@/components/icons";

/**
 * Poin 3 — edit Catatan pekerjaan inline di kartu detail (jalur edit umum BARU yang
 * terbukti belum pernah ada — audit: actionUpdateJob/EditJob 0 kemunculan).
 *
 * - Inline card di halaman detail yang sudah ada (bukan form/halaman/menu baru);
 *   komponen ui repo (Textarea/Button) + Icon aplikasi.
 * - Props `notes` dari server = sumber kebenaran tunggal; setelah sukses `router.refresh()`
 *   memperbarui tampilan — tanpa state duplikat yang bisa basi.
 * - Guard status (COMPLETED/CANCELLED) ditegakkan SERVER di `updateJobNotes`;
 *   prop `editable` hanya mengatur visibilitas tombol.
 */
export function NotesEditor({
  jobId, notes, editable,
}: {
  jobId: string;
  notes: string | null;
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function beginEdit() {
    setValue(notes ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await actionUpdateJobNotes(jobId, value);
      if (!res.ok) { setError(res.error); return; }
      setEditing(false);
      router.refresh(); // server mengirim notes terbaru → props diperbarui
    });
  }

  if (!editing) {
    // Kartu selalu tampil: ada catatan → teksnya; kosong → "Belum ada catatan."
    // Tombol Ubah/Tambah hanya bila status mengizinkan (pagar final tetap di server).
    return (
      <div className="mt-3 rounded-xl bg-muted/40 p-3 text-sm text-muted-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="font-medium text-foreground">Catatan: </span>
            {notes ?? "Belum ada catatan."}
          </div>
          {editable && (
            <button
              type="button"
              onClick={beginEdit}
              className="shrink-0 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              {notes ? "Ubah" : "Tambah"}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-background p-3">
      <label htmlFor="job-notes" className="text-xs font-medium text-foreground">
        Catatan pekerjaan
      </label>
      <Textarea
        id="job-notes"
        rows={3}
        value={value}
        maxLength={4000}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Patokan alamat, keluhan pelanggan, catatan untuk teknisi…"
        className="mt-1.5 rounded-xl text-base"
        autoFocus
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {value.length}/4000 karakter · dikosongkan = catatan dihapus.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <Button
          type="button"
          onClick={save}
          disabled={pending}
          size="sm"
          className="min-h-[44px] flex-1 rounded-xl bg-sky-500 text-white hover:bg-sky-600"
        >
          {pending ? "Menyimpan…" : "Simpan Catatan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditing(false)}
          disabled={pending}
          size="sm"
          className="min-h-[44px] rounded-xl"
        >
          <Icon.Close className="h-4 w-4" aria-hidden />
          Batal
        </Button>
      </div>
    </div>
  );
}
