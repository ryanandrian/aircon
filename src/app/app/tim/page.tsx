import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTeamAndInvites } from "@/lib/services/technician-service";
import { checkQuota } from "@/lib/billing/gating";
import { prisma } from "@/lib/prisma";
import { TechnicianManager } from "./manager";
import { AppHeader } from "../_components/app-header";

export const dynamic = "force-dynamic";

export default async function TimPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/tim");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const { admins, techs, invites } = await listTeamAndInvites(ctx.tenantId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Kuota admin paket: bila penuh (mis. Basic maxAdmins=0) → sembunyikan opsi undang Admin.
  const tenant = await prisma.tenant.findUnique({ where: { id: ctx.tenantId }, select: { plan: true } });
  const adminQuota = tenant ? await checkQuota(ctx.tenantId, tenant.plan, "admins") : { allowed: false, limit: 0 };
  // Boleh undang admin hanya bila owner DAN kuota masih tersedia (limit null=unlimited → boleh).
  const canInviteAdmin = ctx.role === "OWNER" && adminQuota.allowed;

  return (
    <main className="min-h-screen">
      <AppHeader title="Tim / Staf" helpKey="tim" />

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Kelola tim usaha Anda: undang admin (staf kantor) &amp; teknisi (lapangan) dengan nomor HP.
          Mereka menerima link untuk membuat PIN dan langsung bisa masuk.
        </p>
        <TechnicianManager
          appUrl={appUrl}
          isOwner={ctx.role === "OWNER"}
          canInviteAdmin={canInviteAdmin}
          admins={admins.map((a) => ({
            id: a.id,
            name: a.name,
            phone: a.phone,
            status: a.status,
            jobTitle: a.jobTitle,
          }))}
          technicians={techs.map((t) => ({
            id: t.id,
            name: t.user.name,
            phone: t.user.phone,
            active: t.active,
            position: t.position,
            status: t.user.status,
          }))}
          invites={invites.map((i) => ({ id: i.id, name: i.name, phone: i.phone, token: i.token, role: i.role as "TECHNICIAN" | "ADMIN", jobTitle: i.jobTitle }))}
        />
      </div>
    </main>
  );
}
