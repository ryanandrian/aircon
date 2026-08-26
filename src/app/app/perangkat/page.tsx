import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { countInstalledDevices } from "@/lib/services/iot-order-service";
import { listOpenAlerts } from "@/lib/services/iot-ingest-service";
import { alertMessage } from "@/lib/iot/alert-detection";
import { AlertCard } from "./alert-card";
import { AppHeader } from "../_components/app-header";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PerangkatPage() {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/perangkat");

  // Monitor SELALU dapat diakses. Fungsi bergantung ada/tidaknya perangkat terpasang.
  const deviceCount = await countInstalledDevices(ctx.tenantId);
  const [devices, alerts] = await Promise.all([
    deviceCount > 0
      ? prisma.device.findMany({
          where: { tenantId: ctx.tenantId },
          include: { asset: { select: { brand: true, model: true, roomLocation: true } } },
          take: 50,
        })
      : Promise.resolve([]),
    listOpenAlerts(ctx.tenantId),
  ]);

  return (
    <main className="min-h-screen bg-muted/40">
      <AppHeader title="Pemantauan Perangkat" />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* PELUANG SERVIS dari IoT — inti demand generator */}
        {alerts.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Icon.Bell className="h-4 w-4" aria-hidden /> Peluang Servis ({alerts.length})
            </h2>
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                id={a.id}
                type={a.type}
                severity={a.severity}
                message={alertMessage(a.type)}
                hasJob={Boolean(a.createdJobId)}
                jobId={a.createdJobId}
                at={a.at.toISOString()}
              />
            ))}
          </section>
        )}

        {deviceCount === 0 ? (
          // Empty-state fungsional: fitur bisa diakses, tapi belum ada perangkat.
          <Card className="border border-dashed">
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400"><Icon.Device className="h-7 w-7" aria-hidden /></div>
              <h2 className="text-xl font-bold text-foreground">Belum ada perangkat terpasang</h2>
              <p className="mx-auto mt-2 max-w-md text-muted-foreground">
                Pantau suhu, arus, dan kesehatan AC pelanggan secara otomatis. Pasang perangkat
                Aircon pada unit AC untuk mengaktifkan pemantauan dan notifikasi otomatis.
              </p>
              <Link
                href="/app/perangkat/pesan"
                className={buttonVariants({ className: "mt-5 min-h-[48px] px-6" })}
              >
                Pesan Perangkat
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">
                Sudah pesan? Cek <Link href="/app/perangkat/pesanan" className="underline">status pesanan</Link>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{deviceCount} perangkat terpasang</p>
              <Link href="/app/perangkat/pesan" className={buttonVariants({ variant: "ghost", size: "sm", className: "text-sky-600 dark:text-sky-400" })}>
                + Pesan lagi
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {devices.map((d) => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-foreground">
                        {d.asset ? `${d.asset.brand ?? "AC"} ${d.asset.model ?? ""}`.trim() : "Perangkat"}
                      </div>
                      <Badge
                        variant={d.lastSeenAt ? "secondary" : "outline"}
                        className={d.lastSeenAt ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" : ""}
                      >
                        {d.lastSeenAt ? "Aktif" : "Menunggu data"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {d.asset?.roomLocation ?? "Lokasi belum diatur"}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Terakhir terlihat: {d.lastSeenAt ? d.lastSeenAt.toLocaleString("id-ID") : "—"}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
