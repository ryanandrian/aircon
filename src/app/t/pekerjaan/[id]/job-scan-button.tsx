"use client";

import { TechScanButton } from "../../tech-scan-button";

/** Tombol scan QR unit — hanya aktif saat teknisi sudah di lokasi (ARRIVED/IN_PROGRESS/WAITING). */
export function JobScanButton({ status }: { status: string }) {
  const scanReady = status === "ARRIVED" || status === "IN_PROGRESS" || status === "WAITING";
  if (!scanReady) return null;
  return <TechScanButton />;
}
