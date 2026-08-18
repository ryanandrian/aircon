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
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900">Kelola Reseller</h1>
          <Link href="/agen" className="text-sm text-slate-500 hover:text-slate-800">← Dasbor</Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-4 p-5">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
          Reseller dibayar oleh <b>Anda</b> (agen). Aircon menghitung komisinya & menyediakan file transfer — pembayaran ke reseller di luar sistem kami.
        </div>
        <ResellerManager
          joinCode={d.agent.joinCode}
          resellers={d.resellers}
        />
      </div>
    </main>
  );
}
