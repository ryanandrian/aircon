import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listCustomerRows } from "@/lib/services/customer-service";
import { AppHeader } from "../_components/app-header";
import { CustomerManager } from "./customer-manager";

export const dynamic = "force-dynamic";

export default async function PelangganPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pelanggan");

  // Batch pertama (lazy-load lanjutan via server action). Antisipasi ratusan pelanggan.
  const { rows, nextCursor } = await listCustomerRows(ctx.tenantId, {});

  return (
    <main className="min-h-screen">
      <AppHeader title="Pelanggan" />
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        <CustomerManager initialRows={rows} initialCursor={nextCursor} />
      </div>
    </main>
  );
}
