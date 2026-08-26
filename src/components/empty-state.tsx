import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * EmptyState — keadaan kosong yang MEMANDU (bukan layar hampa).
 * Komposisi dari shadcn Card (UI library tunggal). Dipakai konsisten di semua daftar/dashboard.
 *
 * - icon: ikon dari @/components/icons (opsional)
 * - title: judul singkat
 * - desc: penjelasan/arahan (opsional)
 * - actionHref + actionLabel: tombol aksi utama (opsional)
 * - secondary: elemen aksi tambahan (opsional, mis. link/tombol kedua)
 * - variant: "card" (default, berbingkai) atau "bare" (tanpa Card, untuk di dalam Card lain)
 */
export function EmptyState({
  icon: IconCmp,
  title,
  desc,
  actionHref,
  actionLabel,
  secondary,
  variant = "card",
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  actionHref?: string;
  actionLabel?: string;
  secondary?: ReactNode;
  variant?: "card" | "bare";
  className?: string;
}) {
  const body = (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {IconCmp && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950/40 dark:text-sky-400">
          <IconCmp className="h-7 w-7" aria-hidden />
        </div>
      )}
      <p className="text-base font-semibold text-foreground">{title}</p>
      {desc && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{desc}</p>}
      {(actionHref && actionLabel) || secondary ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionHref && actionLabel && (
            <Link href={actionHref} className={buttonVariants({ size: "sm" })}>{actionLabel}</Link>
          )}
          {secondary}
        </div>
      ) : null}
    </div>
  );

  if (variant === "bare") return body;
  return (
    <Card className="border-dashed bg-muted/20 shadow-none">
      <CardContent className="p-0">{body}</CardContent>
    </Card>
  );
}
