import type { Viewport } from "next";

/**
 * Layout panel teknisi.
 * theme-color khusus /t = biru bold (blue-600) agar STATUS BAR HP seragam
 * dengan kartu insentif (gradient blue-600 → sky-500). Panel owner/landing tetap default.
 */
export const viewport: Viewport = {
  themeColor: "#2563eb",
};

export default function TechnicianLayout({ children }: { children: React.ReactNode }) {
  return children;
}
