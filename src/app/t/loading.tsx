import { Skeleton } from "@/components/ui/skeleton";

/** Loading /t (teknisi) — muncul instan saat navigasi. */
export default function TechLoading() {
  return (
    <main className="min-h-screen bg-muted/40 p-5">
      <Skeleton className="mb-4 h-7 w-40" />
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
