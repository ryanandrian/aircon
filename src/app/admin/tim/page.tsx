import { listPlatformAdmins } from "@/lib/services/platform-admin-service";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { AdminTeamManager } from "./team-manager";

export const dynamic = "force-dynamic";

export default async function AdminTimPage() {
  // Layout sudah guard; ambil email admin aktif utk tandai "ini Anda".
  const me = await requirePlatformAdmin();
  const admins = await listPlatformAdmins();
  const rows = admins.map((a) => ({
    id: a.id,
    email: a.email,
    name: a.name,
    active: a.active,
    isSelf: a.email.toLowerCase() === me.email.toLowerCase(),
  }));
  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Admin Platform</h1>
        <p className="text-sm text-muted-foreground">
          Kelola siapa saja yang boleh masuk panel admin Lumite (super-admin lintas usaha).
          Login memakai akun Google yang emailnya terdaftar &amp; aktif di sini.
        </p>
      </div>
      <AdminTeamManager initialRows={rows} activeCount={activeCount} />
    </div>
  );
}
