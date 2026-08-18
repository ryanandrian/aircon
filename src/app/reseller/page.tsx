import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { resellerDashboard } from "@/lib/partner/partner-portal-service";
import { actionPartnerLogout } from "@/app/agen/actions";
import { CopyButton } from "@/app/agen/copy-button";

export const dynamic = "force-dynamic";
const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function ResellerDashboard() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "reseller") redirect("/reseller/login");
  const d = await resellerDashboard(sess.id);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">{d.name}</div>
            <div className="text-xs text-slate-500">Reseller · {d.agentName}</div>
          </div>
          <form action={actionPartnerLogout}><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Keluar</button></form>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 p-5">
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Pelanggan" value={String(d.tenantCount)} />
          <Stat label="Bulan Ini" value={rupiah(d.commissionThisMonth)} accent />
          <Stat label="Total" value={rupiah(d.commissionTotal)} />
        </section>

        {d.code && (
          <section className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <div className="text-xs text-slate-400">Kode Anda (sebarkan ke calon pelanggan)</div>
              <div className="text-lg font-bold text-slate-900">{d.code}</div>
            </div>
            <CopyButton text={`/onboarding?ref=${d.code}`} full />
          </section>
        )}

        <section className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-slate-700">
          <b>Cara kerja:</b> sebarkan kode Anda. Setiap usaha AC yang mendaftar & berlangganan dengan kode Anda tercatat sebagai bawaan Anda — komisi {d.commissionType === "PERCENT" ? `${d.commissionValue}%` : rupiah(d.commissionValue)} per pembayaran. Yang membayar Anda adalah <b>agen ({d.agentName})</b>, dihitung otomatis oleh sistem.
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
