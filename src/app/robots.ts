import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/unit-code/urls";

export default function robots(): MetadataRoute.Robots {
  const base = appBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pratinjau", "/login"],
        // Area privat / ber-auth: jangan diindeks.
        disallow: ["/app", "/t", "/admin", "/onboarding", "/agen", "/reseller", "/api", "/riwayat", "/u", "/p"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
