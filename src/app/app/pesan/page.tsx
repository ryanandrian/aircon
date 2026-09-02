import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import { listTemplates } from "@/lib/services/message-template-service";
import { AppHeader } from "../_components/app-header";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export default async function PesanPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const templates = await listTemplates(ctx.tenantId);

  return (
    <main className="min-h-screen bg-background">
      <AppHeader title="Template Pesan WhatsApp" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-foreground/80 dark:border-sky-900/40 dark:bg-sky-950/30">
          Sesuaikan kalimat pesan otomatis ke pelanggan Anda. Gunakan tanda seperti{" "}
          <code className="rounded bg-background px-1">{"{{customer}}"}</code>,{" "}
          <code className="rounded bg-background px-1">{"{{unit}}"}</code>,{" "}
          <code className="rounded bg-background px-1">{"{{usaha}}"}</code>{" "}
          — nanti otomatis diganti data asli. Pengingat servis rutin adalah inti agar pelanggan datang lagi.
        </div>
        {templates.map((t) => (
          <TemplateEditor key={t.key} tpl={t} />
        ))}
      </div>
    </main>
  );
}
