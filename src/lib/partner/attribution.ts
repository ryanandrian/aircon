/**
 * Logika atribusi tenant (bawaan) — PURE, tanpa akses database.
 *
 * SSOT: tabel `TenantAttribution`.
 * - Tidak ada baris            → tenant daftar sendiri (tanpa kode agen/reseller).
 * - `resellerId` null           → tenant bawaan AGEN langsung.
 * - `resellerId` terisi         → tenant bawaan RESELLER (agen tetap pemilik skema).
 *
 * Dipakai bersama oleh halaman Admin (Daftar Usaha, Detail Usaha, Program Keagenan)
 * agar label konsisten di seluruh aplikasi.
 */

export type AttributionKind = "NONE" | "AGENT" | "RESELLER";

export interface AttributionInput {
  agentId: string;
  agentName: string;
  resellerId: string | null;
  resellerName: string | null;
}

/** Sumber tenant. */
export function attributionKind(attribution: AttributionInput | null): AttributionKind {
  if (!attribution) return "NONE";
  return attribution.resellerId ? "RESELLER" : "AGENT";
}

/** Label badge sumber tenant. */
export function attributionLabel(attribution: AttributionInput | null): string {
  switch (attributionKind(attribution)) {
    case "RESELLER":
      return "Bawaan Reseller";
    case "AGENT":
      return "Bawaan Agen";
    default:
      return "Tanpa Bawaan";
  }
}

/** Label pendek untuk badge di dalam sel tabel. */
export function attributionShortLabel(attribution: AttributionInput | null): string {
  switch (attributionKind(attribution)) {
    case "RESELLER":
      return "Reseller";
    case "AGENT":
      return "Agen";
    default:
      return "Tanpa Bawaan";
  }
}

/**
 * Nama partner yang ditampilkan — prioritas reseller (lebih spesifik),
 * lalu agen. `null` bila tenant tanpa bawaan.
 */
export function attributionPartnerName(attribution: AttributionInput | null): string | null {
  if (!attribution) return null;
  return attribution.resellerName ?? attribution.agentName;
}

/**
 * Ringkasan teks sumber tenant untuk laporan (mis. kolom tabel).
 * - tanpa bawaan → string kosong (kolom dikosongkan).
 * - bawaan agen  → "Agen: {nama agen}".
 * - bawaan reseller → "Reseller: {nama reseller} · Agen: {nama agen}".
 */
export function attributionSummary(attribution: AttributionInput | null): string {
  if (!attribution) return "";
  if (attribution.resellerId && attribution.resellerName) {
    return `Reseller: ${attribution.resellerName} · Agen: ${attribution.agentName}`;
  }
  return `Agen: ${attribution.agentName}`;
}
