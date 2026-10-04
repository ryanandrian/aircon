import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpButton } from "@/components/help/help-button";
import { getHelpTopic } from "@/lib/help/help-content";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { JobForm } from "./job-form";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function PekerjaanBaruPage({ searchParams }: {
  searchParams: Promise<{ assetId?: string; customerId?: string; reminderId?: string }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pekerjaan/baru");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  // SECURITY: semua query tenant-scoped dari ctx.tenantId (sesi).
  const [customers, assets, technicianRows] = await Promise.all([
    prisma.customer.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, name: true, address: true },
      orderBy: { name: "asc" },
    }),
    prisma.asset.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, customerId: true, brand: true, capacityPk: true, roomLocation: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.technician.findMany({
      where: { tenantId: ctx.tenantId, active: true },
      select: { id: true, user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const assetOptions = assets.map((a) => ({
    id: a.id,
    customerId: a.customerId,
    // Label = pola unit-manager.tsx (merek · PK · ruangan) agar unit se-merek
    // pada pelanggan yang sama bisa dibedakan (17 pelanggan bermerek sama).
    label: [a.brand ?? "AC", a.capacityPk ? `${a.capacityPk} PK` : null, a.roomLocation]
      .filter(Boolean)
      .join(" · "),
  }));
  const technicians = technicianRows.map((t) => ({ id: t.id, name: t.user.name }));

  const params = await searchParams;
  // Prefill dikunci ulang terhadap opsi tenant-scoped; ID asing tidak pernah dipantulkan ke form.
  // (D) `customerId` saja kini valid juga — dipakai pintasan "Buat Pekerjaan" dari inbox Booking
  // Online. Guard tetap sama: id harus ada di daftar customers tenant ini (query di atas sudah
  // tenantId + deletedAt:null), sehingga id asing tetap tak pernah dirender.
  const initialAsset = assetOptions.find((a) => a.id === params.assetId);
  const initialCustomerId =
    initialAsset && initialAsset.customerId === params.customerId
      ? params.customerId
      : customers.some((c) => c.id === params.customerId)
        ? params.customerId
        : undefined;
  const initialAssetId = initialCustomerId && initialAsset?.customerId === initialCustomerId ? initialAsset.id : undefined;
  const reminderId = params.reminderId && params.reminderId.length <= 64 ? params.reminderId : undefined;

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
          <h1 className="text-lg font-bold text-foreground">Pekerjaan Baru</h1>
          <div className="flex items-center gap-1.5">
            <HelpButton topic={getHelpTopic("pekerjaan-baru")} />
            <Link href="/app/pekerjaan" className="text-sm text-muted-foreground hover:text-foreground">
              ← Kembali
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-5 py-6">
        {customers.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
            <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
              Belum ada pelanggan. Tambahkan pelanggan dulu sebelum membuat pekerjaan.
            </CardContent>
          </Card>
        ) : (
          <JobForm
            customers={customers}
            assets={assetOptions}
            technicians={technicians}
            initialCustomerId={initialCustomerId}
            initialAssetId={initialAssetId}
            reminderId={reminderId}
          />
        )}
      </div>
    </main>
  );
}
