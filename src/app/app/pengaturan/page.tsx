import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getTenantProfile } from "@/lib/services/tenant-profile-service";
import { AppHeader } from "../_components/app-header";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pengaturan");

  const p = await getTenantProfile(ctx.tenantId);
  const profile = {
    name: p.name,
    logoUrl: p.logoUrl ?? "",
    isPkp: p.isPkp ?? false,
    npwp: p.npwp ?? "",
    taxPercent: p.taxPercent ?? 0,
    bankName: p.bankName ?? "",
    bankAccountNo: p.bankAccountNo ?? "",
    bankAccountName: p.bankAccountName ?? "",
    qrisImageUrl: p.qrisImageUrl ?? "",
  };

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Pengaturan Usaha" />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <SettingsForm profile={profile} />
      </div>
    </main>
  );
}
