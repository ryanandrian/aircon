import { AppHeader } from "./_components/app-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading state /app/* — muncul INSTAN saat navigasi (Suspense fallback Next.js).
 * Menjawab "tak ada hourglass": pengguna langsung lihat kerangka halaman, bukan layar beku.
 */
export default function AppLoading() {
  return (
    <main className="min-h-screen">
      <AppHeader title="Memuat…" />
      <div className="mx-auto max-w-4xl space-y-4 px-5 py-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border bg-card p-4">
              <Skeleton className="mb-2 h-5 w-3/4" />
              <Skeleton className="mb-3 h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
