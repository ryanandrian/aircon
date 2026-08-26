import Link from "next/link";
import Image from "next/image";
import { GoogleSignInButton } from "./google-button";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 p-6">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      {/* Aksen latar lembut */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-100/50 blur-3xl" />

      <div className="relative w-full max-w-sm">
        <Card className="rounded-3xl shadow-lg">
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center">
              <Image src="/brand/aircon-logo.png" alt="Aircon" width={56} height={56} className="h-14 w-14 object-contain" priority />
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">Masuk ke Aircon</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">Operating System usaha servis AC Anda.</p>
            </div>

            {error && (
              <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
                Gagal masuk. Silakan coba lagi.
              </p>
            )}

            <div className="mt-7">
              <GoogleSignInButton next={next} />
              <p className="mt-3 text-center text-xs text-muted-foreground">Untuk pemilik usaha &amp; admin</p>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">atau</span>
              <Separator className="flex-1" />
            </div>

            <div className="mt-6 grid gap-2">
              <Link href="/masuk-teknisi" className={buttonVariants({ variant: "outline", className: "min-h-[44px] gap-2" })}>
                <Icon.Mobile className="h-4 w-4" aria-hidden /> Masuk sebagai Teknisi
              </Link>
              <Link href="/demo" className={buttonVariants({ variant: "ghost", className: "min-h-[44px] text-sky-600" })}>
                Lihat Demo tanpa login →
              </Link>
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Dengan masuk, Anda menyetujui ketentuan layanan Aircon.
        </p>
      </div>
    </main>
  );
}
