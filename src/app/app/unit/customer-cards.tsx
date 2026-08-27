"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { actionListCustomerCards } from "./code-actions";

export function CustomerCards() {
  const [rows, setRows] = useState<{ id: string; name: string; url: string }[]>([]);
  const [q, setQ] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    actionListCustomerCards().then((r) => { setRows(r); setLoaded(true); });
  }, []);

  const filtered = rows.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()));

  function copy(url: string) {
    navigator.clipboard.writeText(url).then(
      () => toast.success("Link disalin"),
      () => toast.error("Gagal menyalin"),
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div>
          <h2 className="text-lg font-semibold">Kartu Perawatan Pelanggan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bagikan link kartu perawatan ke pelanggan (berisi semua unit + riwayat). Link permanen —
            juga otomatis terkirim di pesan pengingat WhatsApp.
          </p>
        </div>
        {rows.length > 0 && (
          <Input placeholder="Cari pelanggan…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
        {loaded && rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">Belum ada pelanggan.</p>
        )}
        <div className="max-h-72 space-y-2 overflow-auto">
          {filtered.map((r) => (
            <div key={r.id} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.url}</div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => copy(r.url)}>Salin</Button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Kartu perawatan AC Anda: ${r.url}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-500 px-3 text-sm font-medium text-white hover:bg-emerald-600"
              >
                Kirim
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
