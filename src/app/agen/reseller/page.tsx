import { redirect } from "next/navigation";
import Link from "next/link";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { agentDashboard } from "@/lib/partner/partner-portal-service";
import { ResellerManager } from "./manager";

export const dynamic = "force-dynamic";

export default async function AgentResellerPage() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "agent") redirect("/agen/login");
  const d = await agentDashboard(sess.id);

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-lg font-bold text-foreground">Kelola Reseller</h1>
          <Link href="/agen" className="text-sm text-muted-foreground hover:text-foreground">← Dasbor</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-4 p-5">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-foreground dark:border-sky-900/40 dark:bg-sky-950/30">
          Reseller dibayar oleh <b>Anda</b> (agen). Aircon menghitung komisinya &amp; menyediakan file transfer — pembayaran ke reseller di luar sistem kami.
        </div>
        <ResellerManager
          joinCode={d.agent.joinCode}
          resellers={d.resellers}
        />
      </div>
    </main>
  );
}
