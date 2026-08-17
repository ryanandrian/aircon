/**
 * Helper: ambil tenant demo untuk mode /demo (tanpa auth).
 * Nanti diganti oleh session auth sungguhan.
 */
import { prisma } from "@/lib/prisma";

export const DEMO_SLUG = "demo-ac-jaya";

export async function getDemoTenant() {
  return prisma.tenant.findUnique({ where: { slug: DEMO_SLUG } });
}
