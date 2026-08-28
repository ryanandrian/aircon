import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "./mobile-nav";

/**
 * Header halaman aplikasi — konsisten di semua sub-halaman /app.
 * Mobile: hamburger (buka drawer navigasi) + judul. Desktop: sidebar menangani navigasi,
 * hamburger disembunyikan. `back` opsional untuk halaman anak (mis. /app/pekerjaan/baru).
 * Sticky, glass, mobile-first.
 */
export function AppHeader({ title, back, backLabel = "Kembali", action }: {
  title: string;
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <MobileNav />
          {back && (
            <Link
              href={back}
              aria-label={backLabel}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <h1 className="truncate text-lg font-bold tracking-tight text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {action}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
