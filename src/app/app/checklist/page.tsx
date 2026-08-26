import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listChecklists } from "@/lib/services/checklist-template-service";
import { AppHeader } from "../_components/app-header";
import { ChecklistEditor } from "./checklist-editor";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const checklists = await listChecklists(ctx.tenantId);

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Checklist Servis" />
      <div className="mx-auto max-w-3xl space-y-5 p-6">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-foreground/80 dark:border-sky-900/40 dark:bg-sky-950/30">
          Atur daftar langkah yang harus dikerjakan &amp; difoto teknisi untuk tiap jenis servis.
          Item wajib harus dicentang teknisi sebelum pekerjaan bisa diselesaikan.
        </div>
        {checklists.map((c) => (
          <ChecklistEditor key={c.serviceType} serviceType={c.serviceType} label={c.label} initialItems={c.items} />
        ))}
      </div>
    </main>
  );
}
