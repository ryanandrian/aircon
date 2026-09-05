import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { getTenantProfile } from "@/lib/services/tenant-profile-service";
import { AppHeader } from "../_components/app-header";
import { SettingsForm } from "./settings-form";
import { WaConnect } from "./wa-connect";

export const dynamic = "force-dynamic";

export default async function PengaturanPage({
  searchParams,
}: {
  searchParams: Promise<{ baru?: string }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pengaturan");
  const { baru } = await searchParams;
  const isNew = baru === "1";

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
        {isNew && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
            <p className="font-semibold">Usaha Anda siap! Satu langkah lagi 🎉</p>
            <p className="mt-1 text-sm text-sky-800/80 dark:text-sky-200/70">
              Hubungkan WhatsApp usaha Anda di bawah ini (scan QR) agar pengingat servis terkirim
              otomatis ke pelanggan — inti keunggulan Aircon. Bisa juga dilakukan nanti kapan saja.
            </p>
          </div>
        )}
        <WaConnect />
        <SettingsForm profile={profile} />
      </div>
    </main>
  );
}
