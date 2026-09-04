import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/unit-code/urls";

// Dinamis: baca env RUNTIME (di VPS build lokal, env hanya ada saat service jalan,
// bukan saat build → tanpa ini sitemap "beku" ke fallback yang salah).
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appBaseUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pratinjau`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
