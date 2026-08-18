"use client";

import { useState } from "react";

export function CopyButton({ text, full }: { text: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const value = full && typeof window !== "undefined" ? window.location.origin + text : text;
    navigator.clipboard?.writeText(value);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
      {copied ? "✓ Tersalin" : "Salin"}
    </button>
  );
}
