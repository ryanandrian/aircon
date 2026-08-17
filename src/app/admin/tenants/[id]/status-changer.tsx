"use client";

import { useState, useTransition } from "react";
import type { TenantStatus } from "@prisma/client";
import { actionSetTenantStatus } from "../../actions";

const OPTIONS: { value: TenantStatus; label: string }[] = [
  { value: "TRIAL", label: "Masa Coba" },
  { value: "ACTIVE", label: "Aktif" },
  { value: "PAST_DUE", label: "Menunggak" },
  { value: "SUSPENDED", label: "Ditangguhkan" },
  { value: "CANCELLED", label: "Berhenti" },
];

export function StatusChanger({
  tenantId,
  current,
}: {
  tenantId: string;
  current: TenantStatus;
}) {
  const [value, setValue] = useState<TenantStatus>(current);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const dirty = value !== current;

  function submit() {
    setMsg(null);
    startTransition(async () => {
      const res = await actionSetTenantStatus(tenantId, value);
      if (res.ok) {
        setMsg({ kind: "ok", text: "Status berhasil diperbarui." });
      } else {
        setMsg({ kind: "err", text: res.error ?? "Gagal memperbarui status." });
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value as TenantStatus)}
        disabled={pending}
        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={!dirty || pending}
        className="rounded-2xl bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Menyimpan…" : "Ubah Status"}
      </button>
      {msg ? (
        <span
          className={`text-sm ${msg.kind === "ok" ? "text-emerald-600" : "text-rose-600"}`}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
