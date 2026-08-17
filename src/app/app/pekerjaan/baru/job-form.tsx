"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateJob } from "../actions";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";

interface CustomerOption {
  id: string;
  name: string;
  address: string | null;
}

interface AssetOption {
  id: string;
  customerId: string;
  label: string;
}

interface TechOption {
  id: string;
  name: string;
}

const SERVICE_TYPES = [
  "CLEANING",
  "REFILL_FREON",
  "REPAIR",
  "INSTALL",
  "DISMANTLE",
  "INSPECTION",
  "OTHER",
] as const;

export function JobForm({
  customers,
  assets,
  technicians,
}: {
  customers: CustomerOption[];
  assets: AssetOption[];
  technicians: TechOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [assetId, setAssetId] = useState("");
  const [serviceType, setServiceType] = useState<(typeof SERVICE_TYPES)[number]>("CLEANING");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [price, setPrice] = useState("");
  const [notes, setNotes] = useState("");

  const customerAssets = useMemo(
    () => assets.filter((a) => a.customerId === customerId),
    [assets, customerId],
  );

  function submit() {
    setError(null);
    if (!customerId) {
      setError("Pilih pelanggan dulu.");
      return;
    }
    start(async () => {
      const res = await actionCreateJob({
        customerId,
        assetId: assetId || undefined,
        serviceType,
        scheduledDate: date || undefined,
        scheduledTime: time || undefined,
        windowEndTime: endTime || undefined,
        technicianId: technicianId || undefined,
        price: price || undefined,
        notes: notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/app/pekerjaan/${res.data?.id ?? ""}`);
      router.refresh();
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="customer" className="mb-1 block text-sm font-medium text-slate-700">
          Pelanggan <span className="text-red-500">*</span>
        </label>
        <select
          id="customer"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setAssetId("");
          }}
          required
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base"
        >
          {customers.length === 0 ? (
            <option value="">Belum ada pelanggan</option>
          ) : (
            customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.address ? ` — ${c.address}` : ""}
              </option>
            ))
          )}
        </select>
      </div>

      <div>
        <label htmlFor="asset" className="mb-1 block text-sm font-medium text-slate-700">
          Unit AC <span className="text-slate-400">(opsional)</span>
        </label>
        <select
          id="asset"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base"
        >
          <option value="">— Tidak terkait unit tertentu —</option>
          {customerAssets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="serviceType" className="mb-1 block text-sm font-medium text-slate-700">
          Jenis servis <span className="text-red-500">*</span>
        </label>
        <select
          id="serviceType"
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value as (typeof SERVICE_TYPES)[number])}
          required
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base"
        >
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {SERVICE_TYPE_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="date" className="mb-1 block text-sm font-medium text-slate-700">
            Tanggal
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-3 py-3 text-base"
          />
        </div>
        <div>
          <label htmlFor="time" className="mb-1 block text-sm font-medium text-slate-700">
            Jam mulai
          </label>
          <input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-3 py-3 text-base"
          />
        </div>
        <div>
          <label htmlFor="endTime" className="mb-1 block text-sm font-medium text-slate-700">
            Jam selesai
          </label>
          <input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="min-h-[48px] w-full rounded-2xl border border-slate-300 px-3 py-3 text-base"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-slate-400">
        Isi tanggal + teknisi agar pekerjaan langsung berstatus &quot;Ditugaskan&quot;.
      </p>

      <div>
        <label htmlFor="technician" className="mb-1 block text-sm font-medium text-slate-700">
          Teknisi <span className="text-slate-400">(opsional)</span>
        </label>
        <select
          id="technician"
          value={technicianId}
          onChange={(e) => setTechnicianId(e.target.value)}
          className="min-h-[48px] w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base"
        >
          <option value="">— Tugaskan nanti —</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="price" className="mb-1 block text-sm font-medium text-slate-700">
          Harga <span className="text-slate-400">(opsional)</span>
        </label>
        <div className="flex items-center rounded-2xl border border-slate-300 px-4">
          <span className="text-slate-400">Rp</span>
          <input
            id="price"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="min-h-[48px] w-full bg-transparent px-2 py-3 text-base outline-none"
          />
        </div>
        {price && (
          <p className="mt-1 text-xs text-slate-500">
            Rp{Number(price).toLocaleString("id-ID")}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Catatan <span className="text-slate-400">(opsional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan untuk teknisi, patokan alamat, keluhan pelanggan…"
          className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-base"
        />
      </div>

      <button
        type="submit"
        disabled={pending || customers.length === 0}
        className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600 disabled:opacity-50"
      >
        {pending ? "Menyimpan…" : "Simpan Pekerjaan"}
      </button>
    </form>
  );
}
