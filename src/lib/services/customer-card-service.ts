/**
 * Customer Card Service — "kartu perawatan digital" per PELANGGAN via token permanen.
 * Halaman /riwayat/{token} publik (tanpa login): daftar SEMUA unit + riwayat tiap unit.
 * STRIP: biaya + data internal. Menampilkan identitas pelanggan (nama) karena INI kartu MILIK dia
 * (link privat dibagikan tenant ke pelanggan; token acak tak bisa ditebak).
 */
import { prisma } from "@/lib/prisma";

const TOKEN_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz23456789";
function randToken(len = 12): string {
  let out = "";
  for (let i = 0; i < len; i++) out += TOKEN_CHARS[Math.floor(Math.random() * TOKEN_CHARS.length)];
  return out;
}

/** Ambil/buat token kartu pelanggan (lazy, permanen). tenant-scoped. */
export async function getOrCreateCardToken(tenantId: string, customerId: string): Promise<string | null> {
  const c = await prisma.customer.findFirst({
    where: { id: customerId, tenantId, deletedAt: null },
    select: { id: true, cardToken: true },
  });
  if (!c) return null;
  if (c.cardToken) return c.cardToken;

  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randToken();
    try {
      await prisma.customer.update({ where: { id: c.id }, data: { cardToken: token } });
      return token;
    } catch {
      // tabrakan unik → coba lagi
    }
  }
  return null;
}

export interface CardUnit {
  id: string;
  brand: string | null;
  model: string | null;
  type: string;
  capacityPk: number | null;
  roomLocation: string | null;
  code: string | null; // kode QR bila ada
  nextServiceDate: string | null;
  lastService: { date: string; activity: string } | null;
  history: { date: string; activity: string }[];
}

export interface CustomerCard {
  customerName: string;
  tenantName: string;
  tenantLogoUrl: string;
  units: CardUnit[];
  dueThisMonthCount: number;
}

/** Resolve token → kartu pelanggan (semua unit + riwayat). null bila token tak dikenal. */
export async function getCustomerCardByToken(
  token: string,
  serviceLabel: (t: string) => string,
): Promise<CustomerCard | null> {
  const customer = await prisma.customer.findUnique({
    where: { cardToken: token },
    select: { id: true, name: true, tenantId: true, deletedAt: true },
  });
  if (!customer || customer.deletedAt) return null;

  const tenant = await prisma.tenant.findUnique({
    where: { id: customer.tenantId },
    select: { name: true, logoUrl: true },
  });

  const assets = await prisma.asset.findMany({
    where: { customerId: customer.id, tenantId: customer.tenantId, deletedAt: null },
    include: {
      unitCode: { select: { code: true } },
      jobs: {
        where: { status: "COMPLETED", deletedAt: null },
        orderBy: { completedAt: "desc" },
        take: 50,
        select: { completedAt: true, createdAt: true, serviceType: true },
      },
    },
    orderBy: { nextServiceDate: "asc" },
  });

  const now = new Date();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  let dueThisMonth = 0;

  const units: CardUnit[] = assets.map((a) => {
    const history = a.jobs.map((j) => ({
      date: (j.completedAt ?? j.createdAt).toISOString(),
      activity: serviceLabel(j.serviceType),
    }));
    if (a.nextServiceDate && a.nextServiceDate <= monthEnd) dueThisMonth += 1;
    return {
      id: a.id,
      brand: a.brand,
      model: a.model,
      type: a.type,
      capacityPk: a.capacityPk,
      roomLocation: a.roomLocation,
      code: a.unitCode?.code ?? null,
      nextServiceDate: a.nextServiceDate ? a.nextServiceDate.toISOString() : null,
      lastService: history[0] ?? null,
      history,
    };
  });

  return { customerName: customer.name, tenantName: tenant?.name ?? "Aircon", tenantLogoUrl: tenant?.logoUrl ?? "", units, dueThisMonthCount: dueThisMonth };
}
