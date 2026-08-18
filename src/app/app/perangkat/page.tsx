import { redirect } from "next/navigation";
import Link from "next/link";
import { tryGetServerContext } from "@/lib/auth/context";
import { prisma } from "@/lib/prisma";
import { countInstalledDevices } from "@/lib/services/iot-order-service";
import { listOpenAlerts } from "@/lib/services/iot-ingest-service";
import { alertMessage } from "@/lib/iot/alert-detection";
import { AlertCard } from "./alert-card";
import { AppHeader } from "../_components/app-header";

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
    <main className="min-h-screen bg-slate-50">
      <AppHeader title="Pemantauan Perangkat" />

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* PELUANG SERVIS dari IoT — inti demand generator */}
        {alerts.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <span aria-hidden>🔔</span> Peluang Servis ({alerts.length})
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-3xl">📡</div>
            <h2 className="text-xl font-bold text-slate-900">Belum ada perangkat terpasang</h2>
            <p className="mx-auto mt-2 max-w-md text-slate-600">
              Pantau suhu, arus, dan kesehatan AC pelanggan secara otomatis. Pasang perangkat
              Aircon pada unit AC untuk mengaktifkan pemantauan dan notifikasi otomatis.
            </p>
            <Link
              href="/app/perangkat/pesan"
              className="mt-5 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600"
            >
              Pesan Perangkat
            </Link>
            <p className="mt-3 text-xs text-slate-400">
              Sudah pesan? Cek <Link href="/app/perangkat/pesanan" className="underline">status pesanan</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">{deviceCount} perangkat terpasang</p>
              <Link href="/app/perangkat/pesan" className="text-sm font-medium text-sky-600 hover:text-sky-700">
                + Pesan lagi
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {devices.map((d) => (
                <div key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">
                      {d.asset ? `${d.asset.brand ?? "AC"} ${d.asset.model ?? ""}`.trim() : "Perangkat"}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${d.lastSeenAt ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {d.lastSeenAt ? "Aktif" : "Menunggu data"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {d.asset?.roomLocation ?? "Lokasi belum diatur"}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    Terakhir terlihat: {d.lastSeenAt ? d.lastSeenAt.toLocaleString("id-ID") : "—"}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
