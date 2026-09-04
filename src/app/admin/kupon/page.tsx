import { listCoupons } from "@/lib/services/coupon-admin-service";
import { CouponManager } from "./coupon-manager";

export const dynamic = "force-dynamic";

export default async function AdminKuponPage() {
  const coupons = await listCoupons();
  const rows = coupons.map((c) => ({
    id: c.id,
    code: c.code,
    description: c.description ?? "",
    type: c.type,
    value: c.value,
    active: c.active,
    maxRedemptions: c.maxRedemptions,
    redeemedCount: c.redeemedCount,
    perTenantLimit: c.perTenantLimit,
    validFrom: c.validFrom ? c.validFrom.toISOString().slice(0, 10) : null,
    validUntil: c.validUntil ? c.validUntil.toISOString().slice(0, 10) : null,
    appliesToPlans: c.appliesToPlans,
    minMonths: c.minMonths,
    recurring: c.recurring,
    recurringMonths: c.recurringMonths,
    usedCount: c._count.redemptions,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Kupon Diskon</h1>
        <p className="text-sm text-muted-foreground">
          Kelola kupon diskon langganan. Diskon dihitung dari harga dasar sebelum pajak.
          Kupon recurring otomatis berlaku di perpanjangan tenant sampai jatah habis.
        </p>
      </div>
      <CouponManager initialRows={rows} />
    </div>
  );
}
