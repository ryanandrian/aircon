"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps, ReactNode } from "react";

/**
 * Tombol submit standar dengan indikator loading (spinner) — dipakai di SEMUA form.
 * Otomatis membaca status pending dari <form action={...}> via useFormStatus.
 * Saat submit: spinner berputar + teks pendingLabel + tombol nonaktif (cegah dobel klik).
 */
export function SubmitButton({
  children,
  pendingLabel,
  pending: pendingProp,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: ReactNode; pending?: boolean }) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
