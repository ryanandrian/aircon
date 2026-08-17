import { redirect } from "next/navigation";
import { getTechSessionUserId } from "@/lib/auth/tech-session";
import { TechLoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function MasukTeknisiPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getTechSessionUserId()) redirect(next || "/t");

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aircon-logo.png" alt="Aircon" className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl font-bold">Masuk Teknisi</h1>
          <p className="mt-1 text-sm text-slate-500">Gunakan nomor HP &amp; PIN dari pemilik usaha.</p>
        </div>
        <TechLoginForm next={next || "/t"} />
      </div>
    </main>
  );
}
