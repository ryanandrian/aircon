import { Badge } from "@/components/ui/badge";
import {
  attributionLabel,
  attributionPartnerName,
  attributionShortLabel,
  type AttributionInput,
} from "@/lib/partner/attribution";

/**
 * Sumber tenant (bawaan) untuk laporan Admin Platform.
 * - attribution null → tenant daftar sendiri tanpa kode agen/reseller.
 * - resellerId null → bawaan AGEN langsung.
 * - resellerId terisi → bawaan RESELLER (agen tetap pemilik skema).
 *
 * Memakai Badge yang sudah ada + helper `attribution.ts` (SSOT label)
 * agar konsisten di seluruh aplikasi.
 */
export function AttributionBadge({ attribution }: { attribution: AttributionInput | null }) {
  if (!attribution) {
    return <Badge variant="secondary">Tanpa Bawaan</Badge>;
  }
  if (attribution.resellerId) {
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/50 dark:text-violet-300"
      >
        {attributionLabel(attribution)}
      </Badge>
    );
  }
  return <Badge>{attributionLabel(attribution)}</Badge>;
}

/**
 * Badge RINGKAS untuk sel tabel (label pendek: Agen / Reseller / Tanpa Bawaan).
 * Nama partner ditampilkan terpisah di kolom "Agen / Reseller".
 */
export function AttributionBadgeShort({ attribution }: { attribution: AttributionInput | null }) {
  if (!attribution) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (attribution.resellerId) {
    return (
      <Badge
        variant="outline"
        className="border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-900/40 dark:bg-violet-950/50 dark:text-violet-300"
      >
        {attributionShortLabel(attribution)}
      </Badge>
    );
  }
  return <Badge variant="secondary">{attributionShortLabel(attribution)}</Badge>;
}

/**
 * Nama partner: reseller kalau ada, kalau tidak agen.
 * `null` bila tenant tanpa bawaan — kolom dikosongkan (bukan "—"),
 * sesuai ketentuan laporan: bagian yang tak ada isinya dibiarkan kosong.
 */
export function AttributionPartner({ attribution }: { attribution: AttributionInput | null }) {
  const name = attributionPartnerName(attribution);
  if (!name) return null;
  return (
    <span className="min-w-0">
      <span className="block break-words font-medium text-foreground">{name}</span>
      {attribution?.resellerName && (
        <span className="block break-words text-xs text-muted-foreground">
          Agen: {attribution.agentName}
        </span>
      )}
    </span>
  );
}
