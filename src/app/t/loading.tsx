import { Skeleton } from "@/components/ui/skeleton";
import { Loader2 } from "lucide-react";

/**
 * Loading /t (teknisi) — muncul instan saat navigasi.
 *
 * F9a (laporan pemilik 2026-10-15 — "sering stuck"): skeleton murni TANPA
 * konteks terasa MACET di HP lambat. Tambah indikator jujur "Memuat…"
 * (spinner + teks) supaya teknisi tahu halaman sedang dimuat, bukan rusak.
 * Kartu skeleton 4 baris TETAP (UX lama tidak hilang).
 */
export default function TechLoading() {
  return (
    <main className="min-h-screen bg-muted/40 p-5">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>Memuat…</span>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card p-4">
            <Skeleton className="mb-2 h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}
