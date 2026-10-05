import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { AppHeader } from "../_components/app-header";
import { parseKinerjaParams, kinRange, kinLabel } from "@/lib/domain/kinerja";
import { listKinerja } from "@/lib/services/kinerja-service";
import { KinerjaBoard } from "./kinerja-board";

export const dynamic = "force-dynamic";

export default async function KinerjaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/kinerja");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const params = parseKinerjaParams(await searchParams);
  const range = kinRange(params);
  const data = await listKinerja(ctx.tenantId, range.start, range.end);

  return (
    <main className="min-h-screen">
      <AppHeader title="Kinerja Tim" helpKey="kinerja" />
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-5 sm:py-6">
        <p className="text-sm text-muted-foreground">
          Pekerjaan yang <span className="font-medium text-foreground">benar-benar dikerjakan</span> oleh tiap
          personel pada periode ini (dari catatan sesi kerja teknisi — bukan penugasan).
        </p>
        <KinerjaBoard
          initialParams={params}
          initialLabel={kinLabel(params)}
          initialData={{
            people: data.people,
            totalPeople: data.totalPeople,
            totalItems: data.totalItems,
            totalJobs: data.totalJobs,
            incentiveEnabled: data.incentiveEnabled,
          }}
        />
      </div>
    </main>
  );
}
