import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { AppHeader } from "../_components/app-header";
import { buttonVariants } from "@/components/ui/button";
import { agendaRange, parseAgendaParams } from "@/lib/domain/agenda";
import { countAgendaJobs, listAgendaJobs, listAgendaPeople } from "@/lib/services/agenda-service";
import { AgendaBoard } from "./agenda-board";

export const dynamic = "force-dynamic";

export default async function PekerjaanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pekerjaan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const rawParams = await searchParams;
  const params = parseAgendaParams(rawParams);
  const range = agendaRange(params);
  const [data, counts, people] = await Promise.all([
    listAgendaJobs(ctx.tenantId, params, range),
    countAgendaJobs(ctx.tenantId, params, range),
    listAgendaPeople(ctx.tenantId),
  ]);

  return (
    <main className="min-h-screen">
      <AppHeader title="Pekerjaan" helpKey="pekerjaan" />
      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-5 sm:py-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Agenda, tim, dan riwayat pekerjaan Anda.</p>
          <Link
            href="/app/pekerjaan/baru"
            className={buttonVariants({ size: "sm", className: "min-h-10 shrink-0 bg-sky-500 px-3 text-white hover:bg-sky-600 sm:min-h-9" })}
          >
            + Pekerjaan
          </Link>
        </div>
        <AgendaBoard
          initialParams={params}
          initialItems={data.jobs}
          initialCursor={data.nextCursor}
          initialCounts={counts}
          people={people}
        />
      </div>
    </main>
  );
}
