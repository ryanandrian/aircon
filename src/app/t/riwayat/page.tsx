import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listTechnicianJobHistory } from "@/lib/services/technician-service";
import { JobHistoryView } from "./history-view";

export const dynamic = "force-dynamic";

export default async function TechnicianHistoryPage() {
  const ctx = await getServerContext().catch(() => null);
  if (!ctx) redirect("/masuk-teknisi");
  if (ctx.role !== "TECHNICIAN") redirect("/app");

  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId },
    select: { id: true },
  });
  if (!tech) redirect("/t");

  // Default filter = PERIODE SAAT INI (bulan berjalan), bukan semua periode.
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const { rows, periods, totalIncentive, incentiveEnabled } = await listTechnicianJobHistory(ctx.tenantId, tech.id, currentPeriod);
  // Sumber tunggal: flag dari service (gerbang sudah di-enforce di sumber).
  const usesIncentive = incentiveEnabled;

  return (
    <main className="min-h-screen bg-muted/40 pb-16">
      {/* Header khusus teknisi — TANPA drawer nav tenant (teknisi tak perlu lihat menu tenant). */}
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link href="/t" className="text-muted-foreground" aria-label="Kembali">←</Link>
          <h1 className="truncate text-base font-bold text-foreground">Riwayat Pekerjaan</h1>
        </div>
      </header>
      <div className="mx-auto max-w-md px-4 py-5">
        <JobHistoryView
          technicianId={tech.id}
          initialRows={rows}
          initialPeriods={periods}
          initialTotal={totalIncentive}
          usesIncentive={usesIncentive}
          initialPeriod={currentPeriod}
        />
      </div>
    </main>
  );
}
