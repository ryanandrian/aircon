"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { actionWaStatus } from "@/app/app/pengaturan/actions";

/**
 * Banner pengingat: tampil di beranda bila WhatsApp usaha BELUM tersambung ke gateway.
 * Non-blocking: cek status async saat mount; bila gateway error/down → banner disembunyikan
 * (jangan menakut-nakuti tenant dengan false alarm). Hilang otomatis begitu tersambung.
 */
export function WaConnectBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let alive = true;
    actionWaStatus()
      .then((r) => {
        // Tampilkan HANYA bila panggilan sukses & sesi jelas belum siap.
        if (alive && r.ok && r.ready !== true) setShow(true);
      })
      .catch(() => {
        /* gateway tak terjangkau → jangan tampilkan (hindari false alarm) */
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!show) return null;

  return (
    <Link
      href="/app/pengaturan"
      className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 transition hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-950/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
        <Icon.Message className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">WhatsApp belum tersambung</span>
        <span className="block text-sm text-amber-800/80 dark:text-amber-200/70">
          Hubungkan WhatsApp usaha agar pengingat servis terkirim otomatis ke pelanggan.
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold">
        Hubungkan
        <Icon.ChevronRight className="h-4 w-4" aria-hidden />
      </span>
    </Link>
  );
}
