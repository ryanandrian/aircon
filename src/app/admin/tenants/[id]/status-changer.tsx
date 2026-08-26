"use client";

import { useState, useTransition } from "react";
import type { TenantStatus } from "@prisma/client";
import { actionSetTenantStatus } from "../../actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

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
      <Select
        value={value}
        onValueChange={(v) => setValue(v as TenantStatus)}
        disabled={pending}
      >
        <SelectTrigger className="min-h-[40px] w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        onClick={submit}
        disabled={!dirty || pending}
        aria-busy={pending}
        className="bg-sky-500 text-white hover:bg-sky-600"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Menyimpan…" : "Ubah Status"}
      </Button>
      {msg ? (
        <span
          className={`text-sm ${msg.kind === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
        >
          {msg.text}
        </span>
      ) : null}
    </div>
  );
}
