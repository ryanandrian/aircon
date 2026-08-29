import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/unit-code/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appBaseUrl();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pratinjau`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
