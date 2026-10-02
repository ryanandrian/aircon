import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listReminderInbox } from "@/lib/services/reminder-service";
import { renderTemplate } from "@/lib/wa/gateway";
import { AppHeader } from "../_components/app-header";
import { ReminderInbox, type ReminderInboxItem } from "./inbox";

export const dynamic = "force-dynamic";

/**
 * /app/pengingat — daftar unit AC yang sudah memasuki rentang kirim pengingat
 * (jatuh tempo sesuai konfigurasi Tenant.reminderLeadDays, default 3 hari sebelum H).
 * Sumber data SATU: listReminderInbox (FASE 1) — juga dipakai kartu Ringkasan.
 */
export default async function PengingatPage({
  searchParams,
}: {
  searchParams: Promise<{ riwayat?: string }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pengingat");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const { riwayat } = await searchParams;
  const includeClosed = riwayat === "1";

  const rows = await listReminderInbox(ctx.tenantId, { includeClosed });
  const tenant = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { name: true },
  });
  const template = await prisma.messageTemplate.findUnique({
    where: { tenantId_key: { tenantId: ctx.tenantId, key: "reminder" } },
  });
  const body = template?.body ??
    "Halo {{customer}}, saatnya servis AC {{unit}}. Balas untuk jadwalkan. — {{usaha}}";

  const items: ReminderInboxItem[] = rows.map((r) => {
    const unitLabel = [r.brand, r.roomLocation].filter(Boolean).join(" ").trim() || "AC";
    const text = renderTemplate(body, {
      customer: r.customerName,
      unit: unitLabel,
      usaha: tenant?.name ?? "",
    });
    return {
      ...r,
      nextServiceDate: r.nextServiceDate?.toISOString() ?? null,
      sentAt: r.sentAt?.toISOString() ?? null,
      waLinkPesan: `https://wa.me/${r.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`,
    };
  });

  return (
    <main className="min-h-screen">
      <AppHeader title="Pengingat Perawatan AC" helpKey="pengingat" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        <p className="text-sm text-muted-foreground">
          Unit AC yang memasuki jadwal servis{" "}
          {includeClosed ? "termasuk yang sudah ditutup" : "dan sedang menunggu tindakan Anda"}.
          Kirim pengingat, konversi jadi pekerjaan, atau tutup bila tidak jadi.
        </p>
        <ReminderInbox initialItems={items} showClosed={includeClosed} />
      </div>
    </main>
  );
}
