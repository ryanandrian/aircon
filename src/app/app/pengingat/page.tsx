import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { listReminderInbox, type ReminderInboxSendStatus } from "@/lib/services/reminder-service";
import { renderTemplate } from "@/lib/wa/gateway";
import { AppHeader } from "../_components/app-header";
import { ReminderInbox, type ReminderInboxItem, type Filter as InboxFilter } from "./inbox";

export const dynamic = "force-dynamic";

/** G-A10 — pemetaan tombol filter -> daftar status yang diproses di SERVER.
 *  Nilai SEMUA = undefined (tanpa filter). "Terkirim" = 4 status (sama persis
 *  dgn pemetaan useMemo lama di inbox.tsx — perilaku tidak berubah). */
const FILTER_SENDSTATUS: Record<string, ReminderInboxSendStatus[] | undefined> = {
  SEMUA: undefined,
  BELUM: ["BELUM_DIKIRIM"],
  MENUNGGU: ["MENUNGGU_KRIM"],
  SENT: ["TERKIRIM_OTOMATIS", "TERKIRIM_MANUAL", "DITERIMA", "DIBACA"],
  GAGAL: ["GAGAL"],
  TIDAK_DIKETAHUI: ["TIDAK_DIKETAHUI"],
  DITUTUP: ["DITUTUP"],
};

/**
 * /app/pengingat — daftar unit AC yang sudah memasuki rentang kirim pengingat
 * (jatuh tempo sesuai konfigurasi Tenant.reminderLeadDays, default 3 hari sebelum H).
 * Sumber data SATU: listReminderInbox (FASE 1) — juga dipakai kartu Ringkasan.
 */
export default async function PengingatPage({
  searchParams,
}: {
  searchParams: Promise<{ riwayat?: string; filter?: string; cursor?: string }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/pengingat");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const { riwayat, filter, cursor } = await searchParams;
  const includeClosed = riwayat === "1";
  const activeFilter = (filter ?? "SEMUA") as InboxFilter;

  // G-A10: filter dikirim sebagai daftar status (kelompok "Terkirim" = 4 status),
  // persis dgn pemetaan Filter UI di inbox.tsx — diproses di SERVER, bukan useMemo.
  const res = await listReminderInbox(ctx.tenantId, {
    includeClosed,
    sendStatus: FILTER_SENDSTATUS[activeFilter],
    cursor,
  });
  const rows = res.rows;
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
        <ReminderInbox
          // Reset state lokal (items/cursor/total) saat filter/riwayat berubah —
          // tanpa key, useState(initial*) di inbox.tsx mempertahankan daftar lama
          // sehingga klik filter tidak mengganti isi daftar (perilaku React).
          key={`${activeFilter}:${includeClosed}`}
          initialItems={items}
          showClosed={includeClosed}
          activeFilter={activeFilter}
          initialCursor={res.nextCursor}
          initialTotal={res.totalCount}
          sendStatus={FILTER_SENDSTATUS[activeFilter]}
        />
      </div>
    </main>
  );
}
