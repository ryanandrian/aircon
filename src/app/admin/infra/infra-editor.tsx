"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionUpdateInfra } from "@/app/admin/config-actions";

interface Initial {
  waGatewayUrl: string; hasKey: boolean; hasCallbackSecret: boolean;
  waMinGapMs: number; waMaxGapMs: number; waMaxPerMin: number; waMaxPerDay: number;
  waWarmupEnabled: boolean; waWarmupDays: number; waWarmupDay1Cap: number;
  waQuietStartHour: number; waQuietEndHour: number; waTzOffset: number;
  waMaxLiveSessions: number; waIdleEvictMs: number;
  mqttBrokerHost: string; mqttBrokerPort: number; mqttTlsEnabled: boolean; mqttTopicPrefix: string;
  updatedAt: string;
}

export function InfraEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(fd: FormData) {
    start(async () => {
      const res = await actionUpdateInfra(fd);
      setMsg(res.ok ? { ok: true, text: "Tersimpan. Policy akan berlaku di gateway dalam ±1 menit." } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  }

  const field = "mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm";
  const label = "text-xs font-medium text-slate-600";

  return (
    <form action={submit} className="space-y-6">
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      {/* Koneksi Gateway */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Koneksi WhatsApp Gateway</h2>
        <p className="mt-1 text-xs text-slate-500">Alamat gateway (VPS-INFRA) + kredensial. Rahasia disimpan terenkripsi; kosongkan untuk tidak mengubah.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className={label}>URL Gateway</span>
            <input name="waGatewayUrl" defaultValue={initial.waGatewayUrl} placeholder="https://gateway.domain" className={field} /></label>
          <label><span className={label}>API Key {initial.hasKey ? "(tersimpan ✓)" : "(belum diisi)"}</span>
            <input name="waGatewayKey" type="password" placeholder={initial.hasKey ? "••••• (biarkan kosong = tetap)" : "isi API key"} className={field} /></label>
          <label><span className={label}>Callback Secret {initial.hasCallbackSecret ? "(tersimpan ✓)" : "(belum diisi)"}</span>
            <input name="waCallbackSecret" type="password" placeholder={initial.hasCallbackSecret ? "••••• (biarkan kosong = tetap)" : "isi secret"} className={field} /></label>
        </div>
      </section>

      {/* Anti-ban policy */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Kebijakan Anti-Blokir (Notifikasi)</h2>
        <p className="mt-1 text-xs text-slate-500">Server ini untuk NOTIFIKASI, bukan blasting. Angka konservatif menjaga nomor dari blokir WhatsApp.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Num name="waMinGapMs" label="Jeda min antar pesan (ms)" v={initial.waMinGapMs} />
          <Num name="waMaxGapMs" label="Jeda maks (ms)" v={initial.waMaxGapMs} />
          <Num name="waMaxPerMin" label="Maks pesan / menit / nomor" v={initial.waMaxPerMin} />
          <Num name="waMaxPerDay" label="Plafon harian / nomor" v={initial.waMaxPerDay} />
          <Num name="waWarmupDays" label="Durasi warm-up (hari)" v={initial.waWarmupDays} />
          <Num name="waWarmupDay1Cap" label="Plafon hari-1 (nomor baru)" v={initial.waWarmupDay1Cap} />
          <Num name="waQuietStartHour" label="Jam tenang mulai (0-23)" v={initial.waQuietStartHour} />
          <Num name="waQuietEndHour" label="Jam tenang selesai (0-23)" v={initial.waQuietEndHour} />
          <Num name="waTzOffset" label="Offset zona waktu (WIB=7)" v={initial.waTzOffset} />
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="waWarmupEnabled" defaultChecked={initial.waWarmupEnabled} className="h-4 w-4" />
          Aktifkan warm-up nomor baru (disarankan)
        </label>
      </section>

      {/* Hemat RAM */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Hemat RAM (Sesi)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Num name="waMaxLiveSessions" label="Maks sesi WhatsApp hidup bersamaan" v={initial.waMaxLiveSessions} />
          <Num name="waIdleEvictMs" label="Tutup sesi idle setelah (ms)" v={initial.waIdleEvictMs} />
        </div>
      </section>

      {/* MQTT */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Broker MQTT (IoT)</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label><span className={label}>Host broker</span>
            <input name="mqttBrokerHost" defaultValue={initial.mqttBrokerHost} placeholder="mqtt.domain / IP VPS-INFRA" className={field} /></label>
          <Num name="mqttBrokerPort" label="Port (TLS 8883)" v={initial.mqttBrokerPort} />
          <label><span className={label}>Prefix topik (namespace app)</span>
            <input name="mqttTopicPrefix" defaultValue={initial.mqttTopicPrefix} className={field} /></label>
          <label className="flex items-center gap-2 self-end text-sm text-slate-700">
            <input type="checkbox" name="mqttTlsEnabled" defaultChecked={initial.mqttTlsEnabled} className="h-4 w-4" />
            Gunakan TLS (disarankan)
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="min-h-[44px] rounded-xl bg-sky-500 px-6 text-sm font-semibold text-white hover:bg-sky-600 disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan Konfigurasi"}
        </button>
        <span className="text-xs text-slate-400">Terakhir diubah: {new Date(initial.updatedAt).toLocaleString("id-ID")}</span>
      </div>
    </form>
  );
}

function Num({ name, label, v }: { name: string; label: string; v: number }) {
  return (
    <label><span className="text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type="number" defaultValue={v} className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm" />
    </label>
  );
}
