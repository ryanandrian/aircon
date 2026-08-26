"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAssignJob, actionCancelJob } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TechOption {
  id: string;
  name: string;
}

export function OwnerActions({
  jobId,
  canAssign,
  canCancel,
  technicians,
  defaultDate,
}: {
  jobId: string;
  canAssign: boolean;
  canCancel: boolean;
  technicians: TechOption[];
  defaultDate: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [showAssign, setShowAssign] = useState(false);
  const [technicianId, setTechnicianId] = useState(technicians[0]?.id ?? "");
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");

  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  function submitAssign() {
    setMsg(null);
    start(async () => {
      const res = await actionAssignJob(jobId, technicianId, date, time);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Teknisi berhasil ditugaskan." });
      setShowAssign(false);
      router.refresh();
    });
  }

  function submitCancel() {
    setMsg(null);
    start(async () => {
      const res = await actionCancelJob(jobId, reason);
      if (!res.ok) {
        setMsg({ kind: "err", text: res.error });
        return;
      }
      setMsg({ kind: "ok", text: "Pekerjaan dibatalkan." });
      setShowCancel(false);
      router.refresh();
    });
  }

  if (!canAssign && !canCancel) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-base font-bold text-foreground">Aksi Pemilik</h2>

        {msg && (
          <p
            role={msg.kind === "err" ? "alert" : "status"}
            className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
              msg.kind === "err"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-400"
            }`}
          >
            {msg.text}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canAssign && (
            <Button
              type="button"
              onClick={() => {
                setShowAssign((v) => !v);
                setShowCancel(false);
              }}
              size="lg"
              className="min-h-[44px] bg-sky-500 text-white hover:bg-sky-600"
            >
              {technicians.length ? "Tugaskan Teknisi" : "Teknisi belum ada"}
            </Button>
          )}
          {canCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCancel((v) => !v);
                setShowAssign(false);
              }}
              size="lg"
              className="min-h-[44px] border-red-300 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              Batalkan
            </Button>
          )}
        </div>

        {showAssign && (
          <div className="mt-4 space-y-3 rounded-2xl bg-muted/40 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="assign-tech">Teknisi</Label>
              <Select
                items={technicians.map((t) => ({ value: t.id, label: t.name }))}
                value={technicianId}
                onValueChange={(v) => setTechnicianId((v as string) ?? "")}
                disabled={technicians.length === 0}
              >
                <SelectTrigger id="assign-tech" className="min-h-[48px] w-full rounded-2xl text-base">
                  <SelectValue placeholder="Belum ada teknisi terdaftar" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="assign-date">Tanggal</Label>
                <Input
                  id="assign-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="min-h-[48px] rounded-2xl text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assign-time">Jam</Label>
                <Input
                  id="assign-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="min-h-[48px] rounded-2xl text-base"
                />
              </div>
            </div>
            <SubmitButton
              type="button"
              onClick={submitAssign}
              pending={pending}
              disabled={!technicianId || !date}
              pendingLabel="Menyimpan…"
              size="lg"
              className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-white hover:bg-sky-600"
            >
              Simpan Penugasan
            </SubmitButton>
          </div>
        )}

        {showCancel && (
          <div className="mt-4 space-y-3 rounded-2xl bg-muted/40 p-4">
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Alasan pembatalan</Label>
              <Textarea
                id="cancel-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: pelanggan menunda, alamat tidak ditemukan…"
                className="rounded-2xl text-base"
              />
            </div>
            <SubmitButton
              type="button"
              onClick={submitCancel}
              pending={pending}
              pendingLabel="Memproses…"
              size="lg"
              className="min-h-[48px] w-full rounded-2xl bg-red-500 px-6 text-white hover:bg-red-600"
            >
              Ya, Batalkan Pekerjaan
            </SubmitButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
