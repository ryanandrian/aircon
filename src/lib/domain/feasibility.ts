/**
 * Smart Scheduling feasibility.
 * Sumber: BuildSpecPack Part1 §11.1 + Part3 §1
 * Status: FEASIBLE | RISK | CONFLICT | UNKNOWN
 */
import type { FeasibilityStatus } from "@prisma/client";

export const SCHED_DEFAULTS = {
  bufferMinutes: 15,
  travelFactor: 1.4, // Haversine * faktor kota
  speedKmh: 25, // asumsi kecepatan kota
  estDurationByService: {
    CLEANING: 45, REFILL_FREON: 60, REPAIR: 90, INSTALL: 120,
    DISMANTLE: 60, INSPECTION: 30, OTHER: 60,
  } as Record<string, number>,
};

export interface FeasibilityInput {
  // job sebelumnya (opsional)
  prevEndTime?: Date | null;
  prevLat?: number | null;
  prevLng?: number | null;
  // job kandidat
  lat?: number | null;
  lng?: number | null;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  estDurationMin?: number | null;
  // teknisi
  techSkills?: string[];
  serviceType?: string;
  bufferMinutes?: number;
}

export interface FeasibilityResult {
  status: FeasibilityStatus;
  reasons: { code: string; message: string; slackMin?: number }[];
  missing: string[];
}

/** Jarak Haversine (km). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Estimasi travel (menit) via Haversine * faktor / kecepatan. */
export function estimateTravelMin(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const km = haversineKm(lat1, lng1, lat2, lng2) * SCHED_DEFAULTS.travelFactor;
  return Math.round((km / SCHED_DEFAULTS.speedKmh) * 60);
}

export function evaluateFeasibility(input: FeasibilityInput): FeasibilityResult {
  const missing: string[] = [];
  const reasons: FeasibilityResult["reasons"] = [];
  const buffer = input.bufferMinutes ?? SCHED_DEFAULTS.bufferMinutes;

  // Skill check dulu (CONFLICT keras)
  if (input.serviceType && input.techSkills && input.techSkills.length > 0) {
    if (!input.techSkills.includes(input.serviceType)) {
      return {
        status: "CONFLICT",
        reasons: [{ code: "SKILL_MISMATCH", message: `Teknisi tidak memiliki skill ${input.serviceType}` }],
        missing: [],
      };
    }
  }

  // Data window wajib
  if (!input.windowStart) missing.push("windowStart");
  if (!input.windowEnd) missing.push("windowEnd");

  // Bila tidak ada job sebelumnya, cukup cek window valid → FEASIBLE
  const hasPrev = !!(input.prevEndTime && input.prevLat != null && input.prevLng != null);
  if (hasPrev && (input.lat == null || input.lng == null)) missing.push("job_location");

  if (missing.length > 0) {
    return { status: "UNKNOWN", reasons: [{ code: "MISSING_DATA", message: "Data belum cukup" }], missing };
  }

  if (!hasPrev) {
    return { status: "FEASIBLE", reasons: [{ code: "OK", message: "Tidak ada job sebelumnya, slot tersedia" }], missing: [] };
  }

  // Hitung earliest start
  const travel = estimateTravelMin(input.prevLat!, input.prevLng!, input.lat!, input.lng!);
  const earliest = new Date(input.prevEndTime!.getTime() + (travel + buffer) * 60000);
  const wStart = input.windowStart!;
  const wEnd = input.windowEnd!;
  const slackMin = Math.round((wStart.getTime() - earliest.getTime()) / 60000);

  if (earliest.getTime() <= wStart.getTime()) {
    return { status: "FEASIBLE", reasons: [{ code: "OK", message: `Cukup waktu (travel ${travel}m + buffer ${buffer}m)`, slackMin }], missing: [] };
  }
  if (earliest.getTime() <= wEnd.getTime()) {
    return { status: "RISK", reasons: [{ code: "TIGHT_TRAVEL", message: `Mepet: mulai paling cepat lewat ${Math.abs(slackMin)}m dari window start`, slackMin }], missing: [] };
  }
  return { status: "CONFLICT", reasons: [{ code: "TIME_CONFLICT", message: `Tidak muat: earliest start melewati window end`, slackMin }], missing: [] };
}
