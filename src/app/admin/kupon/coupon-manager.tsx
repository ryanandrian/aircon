"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { actionCreateCoupon, actionUpdateCoupon, actionToggleCoupon, type CouponFormData } from "./actions";
import type { CouponType, TenantPlan } from "@prisma/client";

interface Row extends CouponFormData {
  id: string;
  redeemedCount: number;
  usedCount: number;
}

const PLANS: TenantPlan[] = ["PROFESSIONAL", "BUSINESS"];
const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");

function emptyForm(): CouponFormData {
  return {
    code: "", description: "", type: "PERCENT", value: 0, active: true,
    maxRedemptions: null, perTenantLimit: 1, validFrom: null, validUntil: null,
    appliesToPlans: [], minMonths: 1, recurring: false, recurringMonths: null,
  };
}

function typeLabel(t: CouponType, v: number): string {
  if (t === "PERCENT") return `${v}%`;
  if (t === "FIXED") return `− ${rp(v)}`;
  return `→ ${rp(v)}`;
}

export function CouponManager({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-5">
      {!creating && !editing && (
        <Button onClick={() => setCreating(true)}>+ Buat Kupon</Button>
      )}

      {(creating || editing) && (
        <CouponForm
          initial={editing ?? emptyForm()}
          editingId={editing?.id ?? null}
          onDone={() => { setCreating(false); setEditing(null); }}
        />
      )}

      <div className="grid gap-3">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada kupon.</p>}
        {rows.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{c.code}</span>
                  <Badge variant="outline">{typeLabel(c.type, c.value)}</Badge>
                  {c.recurring && <Badge variant="secondary">Recurring{c.recurringMonths == null ? " ∞" : ` ${c.recurringMonths}×`}</Badge>}
                  {c.active ? <Badge variant="secondary">Aktif</Badge> : <Badge variant="outline">Nonaktif</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.description || "—"} · dipakai {c.usedCount}{c.maxRedemptions != null ? `/${c.maxRedemptions}` : ""}× · per-tenant {c.perTenantLimit}×
                  {c.appliesToPlans.length > 0 ? ` · ${c.appliesToPlans.join(", ")}` : " · semua paket"}
                  {c.validUntil ? ` · s/d ${c.validUntil}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <ToggleBtn id={c.id} active={c.active} onToggled={(a) => setRows((rs) => rs.map((r) => r.id === c.id ? { ...r, active: a } : r))} />
                <Button size="sm" variant="outline" onClick={() => { setCreating(false); setEditing(c); }}>Edit</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ToggleBtn({ id, active, onToggled }: { id: string; active: boolean; onToggled: (a: boolean) => void }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant={active ? "outline" : "default"} disabled={pending}
      onClick={() => start(async () => {
        const res = await actionToggleCoupon(id, !active);
        if (res.ok) { onToggled(!active); toast.success(active ? "Dinonaktifkan" : "Diaktifkan"); }
        else toast.error(res.error);
      })}>
      {active ? "Nonaktifkan" : "Aktifkan"}
    </Button>
  );
}

function CouponForm({ initial, editingId, onDone }: { initial: CouponFormData; editingId: string | null; onDone: () => void }) {
  const [f, setF] = useState<CouponFormData>(initial);
  const [pending, start] = useTransition();
  function set<K extends keyof CouponFormData>(k: K, v: CouponFormData[K]) { setF((p) => ({ ...p, [k]: v })); }

  function submit() {
    start(async () => {
      const res = editingId ? await actionUpdateCoupon(editingId, f) : await actionCreateCoupon(f);
      if (res.ok) { toast.success("Kupon disimpan"); onDone(); window.location.reload(); }
      else toast.error(res.error);
    });
  }

  const inputCls = "min-h-[44px] w-full rounded-xl border bg-background px-3 text-sm";
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <h2 className="text-lg font-semibold">{editingId ? "Edit Kupon" : "Buat Kupon"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm">Kode</label>
            <input value={f.code} onChange={(e) => set("code", e.target.value)} className={`${inputCls} uppercase`} placeholder="AWAL2026" disabled={!!editingId} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Catatan (opsional)</label>
            <input value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} placeholder="Tenant pendiri" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Tipe diskon</label>
            <select value={f.type} onChange={(e) => set("type", e.target.value as CouponType)} className={inputCls}>
              <option value="PERCENT">Persen (%)</option>
              <option value="FIXED">Potong Rp tetap</option>
              <option value="OVERRIDE">Harga jadi Rp tetap (mis. uji Rp1.000)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">{f.type === "PERCENT" ? "Nilai persen (0-100)" : "Nilai Rupiah"}</label>
            <input type="number" value={f.value} onChange={(e) => set("value", Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Kuota total (kosong = tak terbatas)</label>
            <input type="number" value={f.maxRedemptions ?? ""} onChange={(e) => set("maxRedemptions", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Batas per tenant</label>
            <input type="number" value={f.perTenantLimit} onChange={(e) => set("perTenantLimit", Number(e.target.value))} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Berlaku dari (opsional)</label>
            <input type="date" value={f.validFrom ?? ""} onChange={(e) => set("validFrom", e.target.value || null)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Berlaku sampai (opsional)</label>
            <input type="date" value={f.validUntil ?? ""} onChange={(e) => set("validUntil", e.target.value || null)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm">Durasi minimum (bulan)</label>
            <input type="number" value={f.minMonths} onChange={(e) => set("minMonths", Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm">Berlaku untuk paket (kosong = semua paket berbayar)</label>
          <div className="flex flex-wrap gap-2">
            {PLANS.map((p) => {
              const on = f.appliesToPlans.includes(p);
              return (
                <Button key={p} type="button" size="sm" variant={on ? "default" : "outline"}
                  onClick={() => set("appliesToPlans", on ? f.appliesToPlans.filter((x) => x !== p) : [...f.appliesToPlans, p])}>
                  {p}
                </Button>
              );
            })}
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-xl border p-4">
          <input type="checkbox" checked={f.recurring} onChange={(e) => set("recurring", e.target.checked)} className="mt-0.5 h-5 w-5 accent-sky-600" />
          <span>
            <span className="block text-sm font-medium">Diskon berulang (recurring)</span>
            <span className="block text-xs text-muted-foreground">Diskon otomatis ikut saat tenant perpanjang, tanpa ketik ulang kode.</span>
          </span>
        </label>
        {f.recurring && (
          <div className="space-y-1.5">
            <label className="text-sm">Jumlah periode berdiskon (kosong = selamanya / grandfathered)</label>
            <input type="number" value={f.recurringMonths ?? ""} onChange={(e) => set("recurringMonths", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} placeholder="mis. 6" />
          </div>
        )}

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)} className="h-5 w-5 accent-sky-600" />
          <span className="text-sm">Aktif</span>
        </label>

        <div className="flex gap-2">
          <Button onClick={submit} disabled={pending}>{pending ? "Menyimpan…" : "Simpan"}</Button>
          <Button variant="outline" onClick={onDone} disabled={pending}>Batal</Button>
        </div>
      </CardContent>
    </Card>
  );
}
