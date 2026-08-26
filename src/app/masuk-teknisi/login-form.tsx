"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { techLogin } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function TechLoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await techLogin(phone, pin);
      if (!res.ok) { setMsg(res.error); return; }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          {msg && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{msg}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Nomor HP</Label>
            <Input
              id="phone" type="tel" inputMode="numeric" autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)} required
              placeholder="08xxxxxxxxxx" className="min-h-[48px] text-base"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pin">PIN (6 angka)</Label>
            <Input
              id="pin" type="password" inputMode="numeric" autoComplete="current-password"
              maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} required
              placeholder="••••••" className="min-h-[48px] text-center text-2xl tracking-[0.5em]"
            />
          </div>
          <Button type="submit" disabled={pending || pin.length !== 6} aria-busy={pending} className="min-h-[48px] w-full">
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {pending ? "Masuk…" : "Masuk"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
