import { redirect } from "next/navigation";
import { getPartnerSession } from "@/lib/partner/partner-session";
import { resellerDashboard } from "@/lib/partner/partner-portal-service";
import { listPartnerNotifications } from "@/lib/services/partner-notification-service";
import { PartnerInbox } from "@/app/agen/_components/partner-inbox";
import { actionPartnerLogout } from "@/app/agen/actions";
import { CopyButton } from "@/app/agen/copy-button";
import { SubmitButton } from "@/components/submit-button";

export const dynamic = "force-dynamic";
const rupiah = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default async function ResellerDashboard() {
  const sess = await getPartnerSession();
  if (sess?.kind !== "reseller") redirect("/reseller/login");
  const [d, inbox] = await Promise.all([
    resellerDashboard(sess.id),
    listPartnerNotifications("reseller", sess.id, 20),
  ]);

  return (
    <main className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-3 py-3 backdrop-blur sm:px-5">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="break-words text-sm font-semibold text-foreground">{d.name}</div>
            <div className="break-words text-xs text-muted-foreground">Reseller · {d.agentName}</div>
          </div>
          <form action={actionPartnerLogout} className="w-full sm:w-auto"><SubmitButton className="min-h-[44px] w-full sm:w-auto" variant="outline" pendingLabel="Keluar…">Keluar</SubmitButton></form>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-5 p-3 sm:p-5">
        <section className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-3">
          <Stat label="Pelanggan" value={String(d.tenantCount)} />
          <Stat label="Bulan Ini" value={rupiah(d.commissionThisMonth)} accent />
          <Stat label="Total" value={rupiah(d.commissionTotal)} />
        </section>

        {d.code && (
          <section className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10 sm:p-4">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Kode Anda (sebarkan ke calon pelanggan)</div>
              <div className="break-all text-lg font-bold text-foreground">{d.code}</div>
            </div>
            <CopyButton text={`/onboarding?ref=${d.code}`} full />
          </section>
        )}

        {/* Notifikasi (F4) */}
        <PartnerInbox items={inbox} />

        <section className="min-w-0 break-words rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sm text-foreground dark:border-sky-900/40 dark:bg-sky-950/30 sm:p-4">
          <b>Cara kerja:</b> sebarkan kode Anda. Setiap usaha AC yang mendaftar &amp; berlangganan dengan kode Anda tercatat sebagai bawaan Anda — aturan komisi per paket tersimpan di sistem. Yang membayar Anda adalah <b>agen ({d.agentName})</b>, dihitung otomatis oleh sistem.
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 sm:p-4 ${accent ? "border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30" : "bg-card"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-bold tabular-nums text-foreground">{value}</div>
    </div>
  );
}