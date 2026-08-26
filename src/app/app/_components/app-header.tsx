import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Header halaman aplikasi — konsisten di semua sub-halaman /app.
 * Sticky, glass, tombol kembali + toggle tema. Mobile-first.
 */
export function AppHeader({ title, back = "/app", backLabel = "Ringkasan", action }: {
  title: string;
  back?: string;
  backLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={back}
            aria-label={`Kembali ke ${backLabel}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
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
