import { redirect } from "next/navigation";
import Link from "next/link";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { agentDashboard } from "@/lib/partner/partner-portal-service";
import { actionPartnerLogout } from "./actions";
import { CopyButton } from "./copy-button";

export const dynamic = "force-dynamic";
const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function AgentDashboard() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "agent") redirect("/agen/login");
  const d = await agentDashboard(sess.id);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">{d.agent.companyName}</div>
            <div className="text-xs text-slate-500">Portal Agen · Aircon</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agen/reseller" className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-600">Reseller</Link>
            <form action={actionPartnerLogout}><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600">Keluar</button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-5">
        {/* Statistik */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Pelanggan Bawaan" value={String(d.stats.tenantCount)} />
          <Stat label="Reseller" value={String(d.stats.resellerCount)} />
          <Stat label="Komisi Bulan Ini" value={rupiah(d.stats.commissionThisMonth)} accent />
          <Stat label="Total Komisi" value={rupiah(d.stats.commissionTotal)} />
        </section>

        {/* Kode & tautan */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Kode & Tautan Anda</h2>
          <p className="mt-1 text-xs text-slate-500">Bagikan agar pelanggan tercatat sebagai bawaan Anda (komisi otomatis).</p>
          <div className="mt-3 space-y-2">
            {d.agent.code && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <div>
                  <div className="text-xs text-slate-400">Kode agen (isi saat pelanggan daftar)</div>
                  <div className="font-bold text-slate-900">{d.agent.code}</div>
                </div>
                <CopyButton text={d.agent.code} />
              </div>
            )}
            {d.agent.code && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">Tautan daftar langsung</div>
                  <div className="truncate text-sm text-slate-700">…/onboarding?ref={d.agent.code}</div>
                </div>
                <CopyButton text={`/onboarding?ref=${d.agent.code}`} full />
              </div>
            )}
            {d.agent.joinCode && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-sky-50 p-3">
                <div className="min-w-0">
                  <div className="text-xs text-sky-500">Tautan rekrut reseller</div>
                  <div className="truncate text-sm text-slate-700">…/reseller/daftar/{d.agent.joinCode}</div>
                </div>
                <CopyButton text={`/reseller/daftar/${d.agent.joinCode}`} full />
              </div>
            )}
          </div>
        </section>

        {/* Pelanggan bawaan */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Pelanggan Bawaan ({d.tenants.length})</h2>
          {d.tenants.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">Belum ada pelanggan. Bagikan kode Anda.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {d.tenants.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-slate-900">{t.name}</div>
                    <div className="text-xs text-slate-400">{t.viaReseller ? `via ${t.viaReseller}` : "langsung"} · {new Date(t.since).toLocaleDateString("id-ID")}</div>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{t.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Pencairan */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">Riwayat Pencairan</h2>
          {d.payouts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Belum ada pencairan.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {d.payouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-slate-600">{new Date(p.period).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-slate-900">{rupiah(p.net)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{p.status === "PAID" ? "Lunas" : "Proses"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-slate-900">{value}</div>
    </div>
  );
}
