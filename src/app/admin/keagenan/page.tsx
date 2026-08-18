import { listAgents, listPayouts } from "@/lib/partner/partner-admin-service";
import { KeagenanManager } from "./manager";

export const dynamic = "force-dynamic";

const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function AdminKeagenanPage() {
  const [agents, payouts] = await Promise.all([listAgents(), listPayouts()]);

  const totalCommissionMonth = agents.reduce((s, a) => s + a.commissionThisMonth, 0);
  const totalTenants = agents.reduce((s, a) => s + a.tenantCount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Program Keagenan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola agen mitra pemasaran, komisi, dan pencairan bulanan. Uang pelanggan tetap masuk ke Lumite; kita transfer komisi ke agen.
        </p>
      </div>

      {/* Ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Agen Aktif" value={String(agents.filter((a) => a.status === "ACTIVE").length)} />
        <Stat label="Total Pelanggan Ter-atribusi" value={String(totalTenants)} />
        <Stat label="Komisi Bulan Ini" value={rupiah(totalCommissionMonth)} accent />
        <Stat label="Pencairan Menunggu" value={String(payouts.filter((p) => p.status === "DRAFT").length)} />
      </div>

      <KeagenanManager
        agents={agents}
        payouts={payouts.map((p) => ({
          id: p.id,
          agentName: p.agent.companyName,
          period: p.periodMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
          gross: p.grossCommissionIdr,
          tax: p.taxWithheldIdr,
          net: p.netPaidIdr ?? 0,
          status: p.status,
        }))}
      />
    </div>
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
