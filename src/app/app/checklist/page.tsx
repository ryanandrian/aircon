import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { listServiceChecklists, listChecklists } from "@/lib/services/checklist-template-service";
import { AppHeader } from "../_components/app-header";
import { ChecklistEditor } from "./checklist-editor";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "TECHNICIAN") redirect("/t");

  const [services, legacyAll] = await Promise.all([
    listServiceChecklists(ctx.tenantId),
    listChecklists(ctx.tenantId),
  ]);
  // Hanya checklist lama (per jenis servis) yang BENAR-BENAR masih aktif (tersimpan di DB).
  const legacyApplied = legacyAll.filter((c) => c.applied);

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

        {/* Checklist LAMA (per jenis servis) yang masih aktif — beri kendali penuh ke owner (opt-out).
            Hanya tampil bila memang masih ada, agar owner bisa melihat & menonaktifkan. */}
        {legacyApplied.length > 0 && (
          <div className="space-y-3 pt-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-foreground/80 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="font-semibold text-foreground">Checklist lama (per jenis servis)</p>
              <p className="mt-1">
                Ini checklist versi lama yang masih aktif dari pengaturan sebelumnya. Masih berlaku untuk teknisi.
                Anda bisa <span className="font-semibold text-foreground">menonaktifkannya</span> di sini bila ingin beralih sepenuhnya ke checklist per layanan di atas.
              </p>
            </div>
            {legacyApplied.map((c) => (
              <ChecklistEditor
                key={`legacy-${c.serviceType}`}
                serviceType={c.serviceType}
                label={`${c.label} (lama)`}
                initialItems={c.items}
                applied={c.applied}
                example={c.example}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
