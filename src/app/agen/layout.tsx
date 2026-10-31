import type { Metadata } from "next";

export const metadata: Metadata = {
  applicationName: "Aircon — Portal Agen",
  manifest: "/agen/manifest.json",
};

export default function AgentPwaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
