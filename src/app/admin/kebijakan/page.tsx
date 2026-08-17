import { getBillingPolicyForAdmin } from "@/lib/services/admin-config-service";
import { PolicyEditor } from "./policy-editor";

export const dynamic = "force-dynamic";

export default async function AdminKebijakanPage() {
  const p = await getBillingPolicyForAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">Kebijakan Billing</h1>
        <p className="text-sm text-slate-500">
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
        }}
        updatedBy={p.updatedBy}
      />
    </div>
  );
}
