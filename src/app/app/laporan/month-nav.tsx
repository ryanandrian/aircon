import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { shiftMonthKey, monthKeyLabel, monthKeyInZone } from "@/lib/domain/tenant-timezone";

/**
 * Navigasi bulan laporan (L10/K16a) — pola tata letak identik navigasi periode
 * `kinerja-board.tsx` (‹ bulan › + tombol reset), tetapi memakai LINK biasa:
 * halaman ini server component, jadi soft-navigation cukup tanpa komponen client baru.
 * URL = `?bulan=YYYY-MM` → deep-link, bisa dibagikan/ditandai.
 */
export function MonthNav({
  monthKey, timezone, exportHref, exportAllHref,
}: {
  monthKey: string;
  timezone: string | null | undefined;
  exportHref: string;
  exportAllHref: string;
}) {
  const nowKey = monthKeyInZone(new Date(), timezone);
  const isCurrent = monthKey === nowKey;
  const href = (k: string) => `/app/laporan?bulan=${k}`;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Link href={href(shiftMonthKey(monthKey, -1))} aria-label="Bulan sebelumnya"
        className={`${buttonVariants({ variant: "outline" })} min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9`}>
        <Icon.ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
      </Link>
      <p className="min-w-[10rem] flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
        {monthKeyLabel(monthKey)}
      </p>
      <Link href={href(shiftMonthKey(monthKey, 1))} aria-label="Bulan berikutnya"
        className={`${buttonVariants({ variant: "outline" })} min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9`}>
        <Icon.ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
      {!isCurrent && (
        <Link href={href(nowKey)} className={`${buttonVariants({ variant: "outline" })} min-h-[44px] shrink-0 sm:h-9`}>
          Bulan ini
        </Link>
      )}
      {/* Unduh (L10/K16c): bulan terpilih + rincian, dan seluruh riwayat. */}
      <a href={exportHref} download
        className={`${buttonVariants({ variant: "outline" })} min-h-[44px] shrink-0 sm:h-9`}
        title="Unduh CSV penerimaan bulan ini (dengan rincian invoice)">
        Unduh bulan (CSV)
      </a>
      <a href={exportAllHref} download
        className={`${buttonVariants({ variant: "outline" })} min-h-[44px] shrink-0 sm:h-9`}
        title="Unduh CSV seluruh riwayat penerimaan">
        Unduh semua
      </a>
    </div>
  );
}
