import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listJobsByBucket, countJobsByBucket } from "@/lib/services/job-management-service";
import { buttonVariants } from "@/components/ui/button";
import { AppHeader } from "../_components/app-header";
import { JobsBoard } from "./jobs-board";
import type { JobListItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function PekerjaanPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pekerjaan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const { q } = await searchParams;
  const initialSearch = q?.trim() || "";

  // Muat awal tab "Hari ini" + hitungan semua tab (server-side, antisipasi data besar).
  const [{ jobs, nextCursor }, counts] = await Promise.all([
    listJobsByBucket(ctx.tenantId, "today", { search: initialSearch || undefined }),
    countJobsByBucket(ctx.tenantId, initialSearch || undefined),
  ]);

  const initialItems: JobListItem[] = jobs.map((j) => ({
    id: j.id,
    customerName: j.customer.name,
    address: j.customer.address,
    serviceType: j.serviceType as string,
    status: j.status as string,
    scheduledDate: j.scheduledDate ? j.scheduledDate.toISOString() : null,
    unit: j.asset ? ([j.asset.brand, j.asset.model].filter(Boolean).join(" ").trim() || j.asset.roomLocation || "Unit AC") : null,
    technician: j.technician?.user.name ?? null,
  }));

  return (
    <main className="min-h-screen bg-background">
      <AppHeader title="Pekerjaan" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        {/* Sub-judul + tombol sejajar (pola seragam dgn halaman lain) */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Kelola jadwal & progres pekerjaan tim Anda.
          </p>
          <Link
            href="/app/pekerjaan/baru"
            className={buttonVariants({ size: "sm", className: "shrink-0 bg-sky-500 text-white hover:bg-sky-600" })}
          >
            + Pekerjaan
          </Link>
        </div>

        <JobsBoard
          initialBucket="today"
          initialSearch={initialSearch}
          initialItems={initialItems}
          initialCursor={nextCursor}
          initialCounts={counts}
        />
      </div>
    </main>
  );
}
