"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";

export function CopyButton({ text, full }: { text: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const value = full && typeof window !== "undefined" ? window.location.origin + text : text;
    navigator.clipboard?.writeText(value);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
      {copied ? <><Icon.Check className="h-3.5 w-3.5" aria-hidden /> Tersalin</> : "Salin"}
    </button>
  );
}
