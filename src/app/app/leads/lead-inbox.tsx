"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { actionConvertLead, actionUpdateLeadStatus } from "./actions";

type Lead = { id: string; name: string; phone: string; source: string; status: string; notes: string | null; createdAt: string; convertedCustomerId: string | null };

const statuses = ["NEW", "CONTACTED", "QUOTED", "LOST"] as const;
const labels: Record<string, string> = { NEW: "Baru", CONTACTED: "Sudah dihubungi", QUOTED: "Sudah dikutip", LOST: "Tidak jadi" };

export function LeadInbox({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState("ALL");
  const [pending, startTransition] = useTransition();
  const visible = filter === "ALL" ? leads : leads.filter((lead) => lead.status === filter);

  function updateStatus(id: string, status: (typeof statuses)[number]) {
    startTransition(async () => {
      const result = await actionUpdateLeadStatus(id, status);
      if (!result.ok) { toast.error(result.error); return; }
      setLeads((rows) => rows.map((row) => row.id === id ? { ...row, status } : row));
      toast.success("Status lead diperbarui");
    });
  }

  function convert(id: string) {
    startTransition(async () => {
      const result = await actionConvertLead(id);
      if (!result.ok) { toast.error(result.error); return; }
      setLeads((rows) => rows.map((row) => row.id === id ? { ...row, status: "WON", convertedCustomerId: result.customerId ?? null } : row));
      toast.success("Lead menjadi pelanggan");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["ALL", ...statuses].map((value) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value === "ALL" ? "Semua" : labels[value]}</Button>)}
      </div>
      {visible.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada booking online.</div> : (
        <div className="space-y-3">
          {visible.map((lead) => (
            <article key={lead.id} className="rounded-xl border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="font-semibold">{lead.name}</h2>
                  <a className="text-sm text-sky-600 hover:underline" href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{lead.phone}</a>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes || "Tidak ada catatan tambahan."}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Masuk {new Date(lead.createdAt).toLocaleString("id-ID")} · Website</p>
                </div>
                <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-medium">{lead.status === "WON" ? "Pelanggan" : labels[lead.status]}</span>
              </div>
              {lead.status !== "WON" && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                <Button type="button" size="sm" onClick={() => convert(lead.id)} disabled={pending}>Jadikan Pelanggan</Button>
                {lead.status === "NEW" && <Button type="button" size="sm" variant="outline" onClick={() => updateStatus(lead.id, "CONTACTED")} disabled={pending}>Tandai Dihubungi</Button>}
                {lead.status !== "QUOTED" && <Button type="button" size="sm" variant="outline" onClick={() => updateStatus(lead.id, "QUOTED")} disabled={pending}>Tandai Dikutip</Button>}
                <Button type="button" size="sm" variant="ghost" onClick={() => updateStatus(lead.id, "LOST")} disabled={pending}>Tidak Jadi</Button>
              </div>}
              {lead.convertedCustomerId && <Link className="mt-3 inline-block text-sm text-sky-600 hover:underline" href={`/app/pelanggan/${lead.convertedCustomerId}`}>Buka pelanggan →</Link>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
