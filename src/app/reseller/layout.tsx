import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "Aircon — Portal Reseller",
  manifest: "/reseller/manifest.json",
};

export default function ResellerPwaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
