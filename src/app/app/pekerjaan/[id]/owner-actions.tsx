"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionAssignJob, actionCancelJob } from "../actions";

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
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-bold text-slate-900">Aksi Pemilik</h2>

      {msg && (
        <p
          role={msg.kind === "err" ? "alert" : "status"}
          className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
            msg.kind === "err"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {canAssign && (
          <button
            type="button"
            onClick={() => {
              setShowAssign((v) => !v);
              setShowCancel(false);
            }}
            className="min-h-[44px] rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600"
          >
            {technicians.length ? "Tugaskan Teknisi" : "Teknisi belum ada"}
          </button>
        )}
        {canCancel && (
          <button
            type="button"
            onClick={() => {
              setShowCancel((v) => !v);
              setShowAssign(false);
            }}
            className="min-h-[44px] rounded-2xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Batalkan
          </button>
        )}
      </div>

      {showAssign && (
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
          <div>
            <label htmlFor="assign-tech" className="mb-1 block text-sm font-medium text-slate-700">
              Teknisi
            </label>
            <select
              id="assign-tech"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
              disabled={technicians.length === 0}
              className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base disabled:opacity-50"
            >
              {technicians.length === 0 ? (
                <option value="">Belum ada teknisi terdaftar</option>
              ) : (
                technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="assign-date" className="mb-1 block text-sm font-medium text-slate-700">
                Tanggal
              </label>
              <input
                id="assign-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="assign-time" className="mb-1 block text-sm font-medium text-slate-700">
                Jam
              </label>
              <input
                id="assign-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={submitAssign}
            disabled={pending || !technicianId || !date}
            className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {pending ? "Menyimpan…" : "Simpan Penugasan"}
          </button>
        </div>
      )}

      {showCancel && (
        <div className="mt-4 space-y-3 rounded-2xl bg-slate-50 p-4">
          <div>
            <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium text-slate-700">
              Alasan pembatalan
            </label>
            <textarea
              id="cancel-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: pelanggan menunda, alamat tidak ditemukan…"
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
            />
          </div>
          <button
            type="button"
            onClick={submitCancel}
            disabled={pending}
            className="min-h-[48px] w-full rounded-2xl bg-red-500 px-6 py-3 font-semibold text-white hover:bg-red-600 disabled:opacity-50"
          >
            {pending ? "Memproses…" : "Ya, Batalkan Pekerjaan"}
          </button>
        </div>
      )}
    </section>
  );
}
