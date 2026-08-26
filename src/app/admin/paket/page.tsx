import { listPlanConfigs } from "@/lib/services/admin-config-service";
import { PlanEditor } from "./plan-editor";

export const dynamic = "force-dynamic";

export default async function AdminPaketPage() {
  const plans = await listPlanConfigs();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Paket Langganan</h1>
        <p className="text-sm text-muted-foreground">
          Harga, pajak, dan kuota tiap paket. Perubahan berlaku untuk tagihan/aktivasi berikutnya.
          Kosongkan kuota = tanpa batas.
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanEditor
            key={p.plan}
            plan={p.plan}
            initial={{
              displayName: p.displayName,
              priceMonthly: p.priceMonthly,
              taxable: p.taxable,
              active: p.active,
              sortOrder: p.sortOrder,
              tagline: p.tagline ?? "",
              maxAdmins: p.maxAdmins,
              maxTechnicians: p.maxTechnicians,
              maxCustomers: p.maxCustomers,
              maxAcUnits: p.maxAcUnits,
            }}
          />
        ))}
      </div>
    </div>
  );
}
