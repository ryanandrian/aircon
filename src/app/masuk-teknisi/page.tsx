import { redirect } from "next/navigation";
import { getTechSessionUserId } from "@/lib/auth/tech-session";
import { TechLoginForm } from "./login-form";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function MasukTeknisiPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getTechSessionUserId()) redirect(next || "/t");

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aircon-logo.png" alt="Aircon" className="mx-auto h-14 w-auto" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Masuk Teknisi</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gunakan nomor HP &amp; PIN dari pemilik usaha.</p>
        </div>
        <TechLoginForm next={next || "/t"} />
      </div>
    </main>
  );
}
