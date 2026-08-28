import { Skeleton } from "@/components/ui/skeleton";

/** Loading /admin — muncul instan saat navigasi antar menu admin. */
export default function AdminLoading() {
  return (
    <div className="space-y-4 p-6 md:p-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}
