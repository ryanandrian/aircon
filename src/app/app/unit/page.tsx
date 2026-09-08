import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { AppHeader } from "../_components/app-header";
import { QrManager } from "./unit-manager";
import { appBaseUrl } from "@/lib/unit-code/urls";

export const dynamic = "force-dynamic";

export default async function KodeQrPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/unit");

  return (
    <main className="min-h-screen">
      <AppHeader title="Kode QR" helpKey="unit" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <QrManager baseUrl={appBaseUrl()} />
      </div>
    </main>
  );
}
