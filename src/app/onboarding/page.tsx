/**
 * Halaman wizard setup usaha (/onboarding) — Server Component.
 *
 * Penjaga alur:
 *  - Belum ada sesi login → /login.
 *  - Sudah punya usaha    → /app (tidak perlu setup lagi).
 *  - Selain itu           → tampilkan wizard.
 *
 * Konsisten dengan gaya src/app/page.tsx & /p/[slug] (sky-500, rounded-2xl).
 */
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { findDomainUser } from "@/lib/services/onboarding-service";
import OnboardingWizard from "./wizard";
import { HelpButton } from "@/components/help/help-button";
import { getHelpTopic } from "@/lib/help/help-content";

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/onboarding");
  }

  const domainUser = await findDomainUser({
    email: user.email ?? null,
    phone: user.phone ?? null,
  });
  if (domainUser) {
    redirect("/app");
  }

  const ownerName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-50 to-white">
      <div className="mx-auto w-full max-w-lg px-5 pb-16 pt-10">
        <div className="flex justify-end">
          <HelpButton topic={getHelpTopic("onboarding")} />
        </div>
        {/* Header */}
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500 text-2xl font-bold text-white shadow-lg shadow-sky-200">
            A
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {ownerName ? `Halo, ${ownerName}!` : "Selamat datang!"}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-slate-600">
            Yuk siapkan usaha Anda dulu. Cukup 1 menit — isi 3 hal di bawah,
            langsung bisa dipakai. Gratis coba 14 hari.
          </p>
        </header>

        <OnboardingWizard initialRef={ref ?? ""} />

        <p className="mt-6 text-center text-xs text-slate-400">
          Data ini bisa Anda ubah kapan saja lewat pengaturan usaha.
        </p>
      </div>
    </main>
  );
}
