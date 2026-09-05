import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTechniciansAndInvites } from "@/lib/services/technician-service";
import { TechnicianManager } from "./manager";
import { AppHeader } from "../_components/app-header";

export const dynamic = "force-dynamic";

export default async function TeknisiPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/teknisi");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const { techs, invites } = await listTechniciansAndInvites(ctx.tenantId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="min-h-screen">
      <AppHeader title="Teknisi" helpKey="teknisi" />

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Undang teknisi dengan nomor HP. Mereka menerima link untuk membuat PIN dan langsung bisa menerima pekerjaan.
        </p>
        <TechnicianManager
          appUrl={appUrl}
          technicians={techs.map((t) => ({
            id: t.id,
            name: t.user.name,
            phone: t.user.phone,
            active: t.active,
            position: t.position,
            status: t.user.status,
          }))}
          invites={invites.map((i) => ({ id: i.id, name: i.name, phone: i.phone, token: i.token }))}
        />
      </div>
    </main>
  );
}
