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
    <main className="min-h-screen">
      <AppHeader title="Checklist Servis" helpKey="checklist" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-foreground/80 dark:border-sky-900/40 dark:bg-sky-950/30">
          Checklist bersifat <span className="font-semibold text-foreground">opsional</span> — secara bawaan tidak ada checklist,
          jadi teknisi tidak diwajibkan apa pun. Aktifkan hanya untuk jenis servis yang Anda mau: tambahkan langkah,
          tentukan mana yang <span className="font-semibold text-foreground">wajib</span>, lalu Simpan. Item wajib harus dipenuhi
          teknisi sebelum pekerjaan bisa diselesaikan.
        </div>
        {checklists.map((c) => (
          <ChecklistEditor key={c.serviceType} serviceType={c.serviceType} label={c.label} initialItems={c.items} applied={c.applied} example={c.example} />
        ))}
      </div>
    </main>
  );
}
