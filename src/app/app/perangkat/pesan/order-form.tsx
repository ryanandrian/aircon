"use client";

import { useState, useTransition } from "react";
import { orderAndPay } from "../actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductView {
  id: string;
  name: string;
  description: string;
  price: number;
  priceLabel: string;
  warrantyDays: number;
}

function loadSnap(): Promise<void> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { snap?: unknown };
    if (w.snap) return resolve();
    const isProd = (process.env.NEXT_PUBLIC_MIDTRANS_ENV ?? "sandbox") === "production";
    const clientKey = isProd
      ? process.env.NEXT_PUBLIC_MIDTRANS_PRODUCTION_CLIENT_KEY
      : process.env.NEXT_PUBLIC_MIDTRANS_SANDBOX_CLIENT_KEY;
    const s = document.createElement("script");
    s.src = isProd
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    s.setAttribute("data-client-key", clientKey ?? "");
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Gagal memuat pembayaran"));
    document.head.appendChild(s);
  });
}

const rupiah = (n: number) => "Rp" + n.toLocaleString("id-ID");

export function OrderForm({ products, taxPercent }: { products: ProductView[]; taxPercent: number }) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const product = products.find((p) => p.id === productId) ?? products[0];
  const subtotal = product ? product.price * Math.max(1, qty) : 0;
  const tax = Math.round((subtotal * taxPercent) / 100);
  const total = subtotal + tax;

  function submit() {
    setMsg(null);
    start(async () => {
      const res = await orderAndPay(productId, qty, address);
      if (!res.ok) {
        setMsg(res.error);
        return;
      }
      try {
        await loadSnap();
        const w = window as unknown as {
          snap?: { pay: (t: string, o: Record<string, unknown>) => void };
        };
        w.snap?.pay(res.snapToken, {
          onSuccess: () => (window.location.href = "/app/perangkat/pesanan?status=sukses"),
          onPending: () => (window.location.href = "/app/perangkat/pesanan?status=pending"),
          onError: () => setMsg("Pembayaran gagal. Coba lagi."),
          onClose: () => (window.location.href = "/app/perangkat/pesanan"),
        });
      } catch {
        window.location.href = res.redirectUrl;
      }
    });
  }

  return (
    <div className="space-y-5">
      {msg && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{msg}</p>}

      <div className="space-y-1.5">
        <Label htmlFor="product">Produk</Label>
        <Select value={productId} onValueChange={(v) => setProductId(v ?? "")}>
          <SelectTrigger id="product" className="min-h-[48px] w-full">
            <SelectValue placeholder="Pilih produk" />
          </SelectTrigger>
          <SelectContent>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name} — {p.priceLabel} (garansi {p.warrantyDays} hari)</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {product?.description && <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="qty">Jumlah unit</Label>
        <Input
          id="qty"
          type="number"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
          className="min-h-[48px] text-base"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Alamat pengiriman</Label>
        <Textarea
          id="address"
          rows={3}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Alamat lengkap untuk pengiriman perangkat"
          className="text-base"
        />
      </div>

      <Card>
        <CardContent className="p-4 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{rupiah(subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pajak ({taxPercent}%)</span><span>{rupiah(tax)}</span></div>
          <div className="mt-2 flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span>{rupiah(total)}</span></div>
        </CardContent>
      </Card>

      <SubmitButton
        type="button"
        onClick={submit}
        pending={pending}
        disabled={!productId}
        pendingLabel="Memproses…"
        className="min-h-[48px] w-full px-6"
      >
        Bayar Sekarang
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        Perangkat dijual putus dengan garansi. Pembayaran aman via Midtrans.
      </p>
    </div>
  );
}
