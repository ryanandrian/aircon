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
          Pajak, masa trial, tenggang penangguhan & penghapusan, serta jadwal pengingat.
          Semua tanpa hardcode — perubahan langsung berlaku pada siklus penagihan berikutnya.
        </p>
      </div>
      <PolicyEditor
        initial={{
          taxPercent: p.taxPercent,
          trialDays: p.trialDays,
          graceDaysBeforeSuspend: p.graceDaysBeforeSuspend,
          daysBeforeDelete: p.daysBeforeDelete,
          dunningReminderDays: p.dunningReminderDays,
          deleteWarningDay: p.deleteWarningDay,
          dunningReminderTemplate: p.dunningReminderTemplate,
          dunningWarningTemplate: p.dunningWarningTemplate,
          inactivitySweepEnabled: p.inactivitySweepEnabled,
          inactivityDryRun: p.inactivityDryRun,
          inactivityReminder1Days: p.inactivityReminder1Days,
          inactivityReminder2Days: p.inactivityReminder2Days,
          inactivityDeleteDays: p.inactivityDeleteDays,
          inactivityMinCustomers: p.inactivityMinCustomers,
          inactivityMinJobs: p.inactivityMinJobs,
          inactivityExemptPaid: p.inactivityExemptPaid,
          inactivityReminder1Template: p.inactivityReminder1Template,
          inactivityReminder2Template: p.inactivityReminder2Template,
        }}
        updatedBy={p.updatedBy}
      />
    </div>
  );
}
