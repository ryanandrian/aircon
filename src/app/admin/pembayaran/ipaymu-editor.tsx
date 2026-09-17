"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { actionSaveIpaymuConfig } from "./actions";

type Props = {
  initial: {
    activeEnvironment: "SANDBOX" | "PRODUCTION";
    sandboxConfigured: boolean;
    productionConfigured: boolean;
    sandboxVa: string;
    productionVa: string;
    sandboxApiKey: string;
    productionApiKey: string;
  };
};

export function IpaymuEditor({ initial }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    start(async () => {
      setMessage(null);
      const result = await actionSaveIpaymuConfig(data);
      setMessage({ ok: result.ok, text: result.ok ? (result.info ?? "Konfigurasi berhasil disimpan.") : (result.error ?? "Konfigurasi gagal disimpan.") });
      if (result.ok) router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-bold">Pembayaran iPaymu</h1>
        <p className="text-sm text-muted-foreground">Credential disimpan terenkripsi. Environment aktif: <b>{initial.activeEnvironment}</b></p>
      </div>
      <div className="flex gap-5 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="activeEnvironment" value="SANDBOX" defaultChecked={initial.activeEnvironment === "SANDBOX"} /> Sandbox</label>
        <label className="flex items-center gap-2"><input type="radio" name="activeEnvironment" value="PRODUCTION" defaultChecked={initial.activeEnvironment === "PRODUCTION"} /> Production</label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Credential title="Sandbox" vaName="sandboxVa" keyName="sandboxApiKey" configured={initial.sandboxConfigured} maskedVa={initial.sandboxVa} maskedKey={initial.sandboxApiKey} />
        <Credential title="Production" vaName="productionVa" keyName="productionApiKey" configured={initial.productionConfigured} maskedVa={initial.productionVa} maskedKey={initial.productionApiKey} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan & Terapkan"}</Button>
        {message && <p role="status" className={message.ok ? "text-sm text-emerald-600" : "text-sm text-red-600"}>{message.text}</p>}
      </div>
    </form>
  );
}

function Credential({ title, vaName, keyName, configured, maskedVa, maskedKey }: { title: string; vaName: string; keyName: string; configured: boolean; maskedVa: string; maskedKey: string }) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">iPaymu {title}</h2><span className={configured ? "text-sm text-emerald-600" : "text-sm text-amber-600"}>{configured ? "Tersimpan" : "Belum lengkap"}</span></div>
      <p className="mt-1 text-xs text-muted-foreground">VA: {maskedVa} · API Key: {maskedKey}</p>
      <Input name={vaName} placeholder="Masukkan VA" inputMode="numeric" autoComplete="off" className="mt-3" />
      <Input name={keyName} type="password" placeholder="API Key (kosongkan = tetap)" autoComplete="new-password" className="mt-3" />
    </section>
  );
}
