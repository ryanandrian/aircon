"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, full }: { text: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    const value = full && typeof window !== "undefined" ? window.location.origin + text : text;
    navigator.clipboard?.writeText(value);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? <><Icon.Check className="h-3.5 w-3.5" aria-hidden /> Tersalin</> : "Salin"}
    </Button>
  );
}
