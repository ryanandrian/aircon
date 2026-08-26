"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actionCreateJob } from "../actions";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
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
import { SubmitButton } from "@/components/submit-button";

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

  const customerItems = useMemo(
    () =>
      customers.map((c) => ({
        value: c.id,
        label: c.address ? `${c.name} — ${c.address}` : c.name,
      })),
    [customers],
  );
  const assetItems = useMemo(
    () => [
      { value: "", label: "— Tidak terkait unit tertentu —" },
      ...customerAssets.map((a) => ({ value: a.id, label: a.label })),
    ],
    [customerAssets],
  );
  const serviceItems = useMemo(
    () => SERVICE_TYPES.map((s) => ({ value: s, label: SERVICE_TYPE_LABEL[s] ?? s })),
    [],
  );
  const technicianItems = useMemo(
    () => [
      { value: "", label: "— Tugaskan nanti —" },
      ...technicians.map((t) => ({ value: t.id, label: t.name })),
    ],
    [technicians],
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
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="customer">
          Pelanggan <span className="text-red-500">*</span>
        </Label>
        <Select
          items={customerItems}
          value={customerId}
          onValueChange={(v) => {
            setCustomerId((v as string) ?? "");
            setAssetId("");
          }}
        >
          <SelectTrigger id="customer" className="min-h-[48px] w-full rounded-2xl text-base">
            <SelectValue placeholder={customers.length === 0 ? "Belum ada pelanggan" : "Pilih pelanggan"} />
          </SelectTrigger>
          <SelectContent>
            {customerItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="asset">
          Unit AC <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Select
          items={assetItems}
          value={assetId}
          onValueChange={(v) => setAssetId((v as string) ?? "")}
        >
          <SelectTrigger id="asset" className="min-h-[48px] w-full rounded-2xl text-base">
            <SelectValue placeholder="— Tidak terkait unit tertentu —" />
          </SelectTrigger>
          <SelectContent>
            {assetItems.map((a) => (
              <SelectItem key={a.value || "none"} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="serviceType">
          Jenis servis <span className="text-red-500">*</span>
        </Label>
        <Select
          items={serviceItems}
          value={serviceType}
          onValueChange={(v) => setServiceType(v as (typeof SERVICE_TYPES)[number])}
        >
          <SelectTrigger id="serviceType" className="min-h-[48px] w-full rounded-2xl text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {serviceItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="date">Tanggal</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-h-[48px] rounded-2xl text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="time">Jam mulai</Label>
          <Input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-[48px] rounded-2xl text-base"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endTime">Jam selesai</Label>
          <Input
            id="endTime"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="min-h-[48px] rounded-2xl text-base"
          />
        </div>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">
        Isi tanggal + teknisi agar pekerjaan langsung berstatus &quot;Ditugaskan&quot;.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="technician">
          Teknisi <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Select
          items={technicianItems}
          value={technicianId}
          onValueChange={(v) => setTechnicianId((v as string) ?? "")}
        >
          <SelectTrigger id="technician" className="min-h-[48px] w-full rounded-2xl text-base">
            <SelectValue placeholder="— Tugaskan nanti —" />
          </SelectTrigger>
          <SelectContent>
            {technicianItems.map((t) => (
              <SelectItem key={t.value || "none"} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="price">
          Harga <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <div className="flex items-center rounded-2xl border border-input px-4 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span className="text-muted-foreground">Rp</span>
          <input
            id="price"
            inputMode="numeric"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="0"
            className="min-h-[48px] w-full bg-transparent px-2 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        {price && (
          <p className="mt-1 text-xs text-muted-foreground">
            Rp{Number(price).toLocaleString("id-ID")}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">
          Catatan <span className="text-muted-foreground">(opsional)</span>
        </Label>
        <Textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan untuk teknisi, patokan alamat, keluhan pelanggan…"
          className="rounded-2xl text-base"
        />
      </div>

      <SubmitButton
        pending={pending}
        disabled={customers.length === 0}
        pendingLabel="Menyimpan…"
        size="lg"
        className="min-h-[48px] w-full rounded-2xl bg-sky-500 px-6 text-white hover:bg-sky-600"
      >
        Simpan Pekerjaan
      </SubmitButton>
    </form>
  );
}
