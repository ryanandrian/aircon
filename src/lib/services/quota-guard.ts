/**
 * Quota Guard — tegakkan kuota paket saat menambah admin/teknisi/pelanggan/unit AC.
 * Kuota dibaca dari PlanConfig (DB) via checkQuota. Pesan ramah-teknisi Indonesia.
 */
import { prisma } from "@/lib/prisma";
import { checkQuota } from "@/lib/billing/gating";
import { QUOTA_LABEL, type QuotaKind } from "@/lib/billing/gating-pure";

export class QuotaError extends Error {
  code = "QUOTA_EXCEEDED" as const;
  kind: QuotaKind;
  limit: number | null;
  constructor(kind: QuotaKind, limit: number | null) {
    const label = QUOTA_LABEL[kind];
    super(
      limit === null
        ? `Batas ${label} paket Anda tercapai.`
        : `Batas ${label} paket Anda tercapai (maks ${limit}). Tingkatkan paket untuk menambah ${label}.`,
    );
    this.name = "QuotaError";
    this.kind = kind;
    this.limit = limit;
  }
}

/**
 * Pastikan tenant masih boleh menambah entitas `kind`. Lempar QuotaError bila penuh.
 * SECURITY: tenantId dari pemanggil ber-auth; plan diambil dari record tenant.
 */
export async function assertQuota(tenantId: string, kind: QuotaKind): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) throw new QuotaError(kind, 0);

  const res = await checkQuota(tenantId, tenant.plan, kind);
  if (!res.allowed) {
    throw new QuotaError(kind, res.limit);
  }
}
