import { redirect } from "next/navigation";
import { getServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listTechnicianJobHistory } from "@/lib/services/technician-service";
import { AppHeader } from "../../app/_components/app-header";
import { JobHistoryView } from "./history-view";

export const dynamic = "force-dynamic";

export default async function TechnicianHistoryPage() {
  const ctx = await getServerContext().catch(() => null);
  if (!ctx) redirect("/masuk-teknisi");
  if (ctx.role !== "TECHNICIAN") redirect("/app");

  const tech = await prisma.technician.findFirst({
    where: { tenantId: ctx.tenantId, userId: ctx.userId }, select: { id: true },
  });
  if (!tech) redirect("/t");

  const { rows, periods, totalIncentive } = await listTechnicianJobHistory(ctx.tenantId, tech.id);

  return (
    <main className="min-h-screen bg-muted/40 pb-16">
      <AppHeader title="Riwayat Pekerjaan" back="/t" />
      <div className="mx-auto max-w-md px-4 py-5">
        <JobHistoryView
          technicianId={tech.id}
          initialRows={rows}
          initialPeriods={periods}
          initialTotal={totalIncentive}
        />
      </div>
    </main>
  );
}
