import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listServiceChecklists } from "@/lib/services/checklist-template-service";
import { AppHeader } from "../_components/app-header";
import { ChecklistEditor } from "./checklist-editor";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const services = await listServiceChecklists(ctx.tenantId);

  return (
    <main className="min-h-screen">
      <AppHeader title="Checklist Servis" helpKey="checklist" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm text-foreground/80 dark:border-sky-900/40 dark:bg-sky-950/30">
          Checklist bersifat <span className="font-semibold text-foreground">opsional</span> dan diatur <span className="font-semibold text-foreground">per layanan</span>.
          Secara bawaan tidak ada checklist, jadi teknisi tidak diwajibkan apa pun. Aktifkan hanya untuk layanan yang Anda mau:
          tambahkan langkah, tentukan mana yang <span className="font-semibold text-foreground">wajib</span>, lalu Simpan.
          Saat teknisi mengerjakan layanan itu di sebuah unit, checklist muncul otomatis dan item wajib harus dipenuhi sebelum pekerjaan bisa diselesaikan.
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Belum ada layanan di katalog. Buat layanan dulu di <Link href="/app/layanan" className={buttonVariants({ variant: "link", size: "sm" }) + " px-1"}>Daftar Layanan</Link>,
              lalu kembali ke sini untuk mengatur checklist-nya.
            </p>
          </div>
        ) : (
          services.map((s) => (
            <ChecklistEditor
              key={s.serviceId}
              serviceId={s.serviceId}
              label={s.active ? s.name : `${s.name} (nonaktif)`}
              initialItems={s.items}
              applied={s.applied}
            />
          ))
        )}
      </div>
    </main>
  );
}
