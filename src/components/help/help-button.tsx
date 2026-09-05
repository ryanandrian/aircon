"use client";

import { useState } from "react";
import { HelpCircle, X, Lightbulb, ListChecks, Sparkles, HelpCircle as FaqIcon } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import type { HelpTopic } from "@/lib/help/help-content";

/**
 * Tombol Bantuan (?) kontekstual + panel geser (Sheet) berisi konten 4-bagian:
 * 💡 Apa ini · 📋 Cara pakai · ✨ Tips · ❓ Sering ditanya.
 * Konten dari SUMBER TUNGGAL help-content (via prop topic — komponen server yang resolve key).
 * Light/dark mengikuti token app (bg-card, text-foreground, dst).
 */
export function HelpButton({ topic }: { topic: HelpTopic | null }) {
  const [open, setOpen] = useState(false);
  if (!topic) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={`Bantuan: ${topic.title}`}
        title="Bantuan layar ini"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-sky-600 dark:hover:text-sky-400"
      >
        <HelpCircle className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[440px] max-w-[92vw] gap-0 p-0">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <SheetTitle className="text-base font-bold text-foreground">Bantuan: {topic.title}</SheetTitle>
          <button
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Apa ini */}
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              <Lightbulb className="h-4 w-4" /> Apa ini?
            </div>
            <p className="text-sm text-foreground/80">{topic.whatIsIt}</p>
          </section>

          {/* Cara pakai */}
          <section>
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              <ListChecks className="h-4 w-4" /> Cara pakai
            </div>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/80 marker:text-muted-foreground">
              {topic.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>

          {/* Tips */}
          {topic.tips && topic.tips.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                <Sparkles className="h-4 w-4" /> Tips
              </div>
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80 marker:text-muted-foreground">
                {topic.tips.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          )}

          {/* FAQ */}
          {topic.faqs && topic.faqs.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                <FaqIcon className="h-4 w-4" /> Sering ditanya
              </div>
              <div className="space-y-2">
                {topic.faqs.map((f, i) => (
                  <div key={i} className="rounded-xl border bg-muted/40 p-3 text-sm">
                    <div className="font-semibold text-foreground">{f.q}</div>
                    <div className="mt-1 text-foreground/70">{f.a}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="border-t px-5 py-4">
          <Link
            href="/app/panduan"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            📖 Buka Panduan Lengkap →
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}
