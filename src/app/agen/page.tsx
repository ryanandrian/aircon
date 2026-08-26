import { redirect } from "next/navigation";
import Link from "next/link";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { agentDashboard } from "@/lib/partner/partner-portal-service";
import { actionPartnerLogout } from "./actions";
import { CopyButton } from "./copy-button";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function AgentDashboard() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "agent") redirect("/agen/login");
  const d = await agentDashboard(sess.id);

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">{d.agent.companyName}</div>
            <div className="text-xs text-muted-foreground">Portal Agen · Aircon</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/agen/reseller" className={buttonVariants({ className: "bg-sky-500 text-white hover:bg-sky-600" })}>Reseller</Link>
            <form action={actionPartnerLogout}><SubmitButton variant="outline" pendingLabel="Keluar…">Keluar</SubmitButton></form>
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
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Kode &amp; Tautan Anda</h2>
            <p className="mt-1 text-xs text-muted-foreground">Bagikan agar pelanggan tercatat sebagai bawaan Anda (komisi otomatis).</p>
            <div className="mt-3 space-y-2">
              {d.agent.code && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Kode agen (isi saat pelanggan daftar)</div>
                    <div className="font-bold text-foreground">{d.agent.code}</div>
                  </div>
                  <CopyButton text={d.agent.code} />
                </div>
              )}
              {d.agent.code && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/50 p-3">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Tautan daftar langsung</div>
                    <div className="truncate text-sm text-foreground">…/onboarding?ref={d.agent.code}</div>
                  </div>
                  <CopyButton text={`/onboarding?ref=${d.agent.code}`} full />
                </div>
              )}
              {d.agent.joinCode && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-sky-50 p-3 dark:bg-sky-950/30">
                  <div className="min-w-0">
                    <div className="text-xs text-sky-500">Tautan rekrut reseller</div>
                    <div className="truncate text-sm text-foreground">…/reseller/daftar/{d.agent.joinCode}</div>
                  </div>
                  <CopyButton text={`/reseller/daftar/${d.agent.joinCode}`} full />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pelanggan bawaan */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Pelanggan Bawaan ({d.tenants.length})</h2>
            {d.tenants.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pelanggan. Bagikan kode Anda.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {d.tenants.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <div>
                      <div className="font-medium text-foreground">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.viaReseller ? `via ${t.viaReseller}` : "langsung"} · {new Date(t.since).toLocaleDateString("id-ID")}</div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.status}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pencairan */}
        <Card>
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Riwayat Pencairan</h2>
            {d.payouts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Belum ada pencairan.</p>
            ) : (
              <div className="mt-3 divide-y divide-border">
                {d.payouts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{new Date(p.period).toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold tabular-nums text-foreground">{rupiah(p.net)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "PAID" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"}`}>{p.status === "PAID" ? "Lunas" : "Proses"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? "border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
