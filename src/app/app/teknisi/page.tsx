import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTechniciansAndInvites } from "@/lib/services/technician-service";
import { TechnicianManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function TeknisiPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/teknisi");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const { techs, invites } = await listTechniciansAndInvites(ctx.tenantId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <h1 className="text-lg font-bold">Teknisi</h1>
          <Link href="/app" className="text-sm text-slate-500 hover:text-slate-800">← Ringkasan</Link>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <p className="text-sm text-slate-500">
          Undang teknisi dengan nomor HP. Mereka menerima link untuk membuat PIN dan langsung bisa menerima pekerjaan.
        </p>
        <TechnicianManager
          appUrl={appUrl}
          technicians={techs.map((t) => ({
            id: t.id,
            name: t.user.name,
            phone: t.user.phone,
            active: t.active,
          }))}
          invites={invites.map((i) => ({ id: i.id, name: i.name, phone: i.phone, token: i.token }))}
        />
      </div>
    </main>
  );
}
