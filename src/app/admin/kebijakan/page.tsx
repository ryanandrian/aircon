import { getBillingPolicyForAdmin } from "@/lib/services/admin-config-service";
import { PolicyEditor } from "./policy-editor";

export const dynamic = "force-dynamic";

export default async function AdminKebijakanPage() {
  const p = await getBillingPolicyForAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Kebijakan Billing</h1>
        <p className="text-sm text-muted-foreground">
          Pajak, masa tenggang sebelum suspend/hapus, jadwal pengingat, dan ambang sweeper
          akun tidak aktif. Semua tanpa hardcode — perubahan langsung berlaku pada siklus
          penagihan berikutnya.
        </p>
      </div>
      <PolicyEditor
        initial={{
          taxPercent: p.taxPercent,
          graceDaysBeforeSuspend: p.graceDaysBeforeSuspend,
          daysBeforeDelete: p.daysBeforeDelete,
          dunningReminderDays: p.dunningReminderDays,
          deleteWarningDay: p.deleteWarningDay,
          inactivitySweepEnabled: p.inactivitySweepEnabled,
          inactivityDryRun: p.inactivityDryRun,
          inactivityReminder1Days: p.inactivityReminder1Days,
          inactivityReminder2Days: p.inactivityReminder2Days,
          inactivityDeleteDays: p.inactivityDeleteDays,
          inactivityMinCustomers: p.inactivityMinCustomers,
          inactivityMinJobs: p.inactivityMinJobs,
          inactivityExemptPaid: p.inactivityExemptPaid,
        }}
        updatedBy={p.updatedBy}
      />
    </div>
  );
}
