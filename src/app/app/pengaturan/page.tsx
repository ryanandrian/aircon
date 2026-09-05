import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getTenantProfile } from "@/lib/services/tenant-profile-service";
import { AppHeader } from "../_components/app-header";
import { SettingsForm } from "./settings-form";
import { WaConnect } from "./wa-connect";

export const dynamic = "force-dynamic";

export default async function PengaturanPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pengaturan");

  const p = await getTenantProfile(ctx.tenantId);
  const profile = {
    name: p.name,
    phone: p.phone ?? "",
    address: p.address ?? "",
    tagline: p.tagline ?? "",
    logoUrl: p.logoUrl ?? "",
    isPkp: p.isPkp ?? false,
    npwp: p.npwp ?? "",
    taxPercent: p.taxPercent ?? 0,
    bankName: p.bankName ?? "",
    bankAccountNo: p.bankAccountNo ?? "",
    bankAccountName: p.bankAccountName ?? "",
    qrisImageUrl: p.qrisImageUrl ?? "",
    teamIncentiveMode: p.teamIncentiveMode ?? "BAGI_RATA",
    incentiveBasis: p.incentiveBasis ?? "LUNAS",
    incentiveEnabled: p.incentiveEnabled ?? false,
  };

  return (
    <main className="min-h-screen">
      <AppHeader title="Pengaturan Usaha" helpKey="pengaturan" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <WaConnect />
        <SettingsForm profile={profile} />
      </div>
    </main>
  );
}
