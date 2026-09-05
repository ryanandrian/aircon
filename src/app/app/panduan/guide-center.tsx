"use client";

import { useState, useMemo } from "react";
import { Lightbulb, ListChecks, Sparkles, HelpCircle } from "lucide-react";
import type { HelpTopic } from "@/lib/help/help-content";

/**
 * Pusat Panduan (client) — daftar semua topik dikelompokkan + pencarian.
 * Membaca data dari SUMBER TUNGGAL (diteruskan sebagai prop dari server page).
 * Klik topik → expand konten 4-bagian (sama dengan HelpButton, satu sumber).
 */
export function GuideCenter({ groups }: { groups: { group: string; topics: HelpTopic[] }[] }) {
  const [q, setQ] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((g) => ({
        group: g.group,
        topics: g.topics.filter((t) =>
          (t.title + " " + t.whatIsIt + " " + t.steps.join(" ") + " " + (t.tips ?? []).join(" ")).toLowerCase().includes(query),
        ),
      }))
      .filter((g) => g.topics.length > 0);
  }, [q, groups]);

  return (
    <div className="space-y-6">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Cari panduan… (mis. 'pengingat', 'faktur', 'WhatsApp')"
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-sky-500/40"
      />

      {filtered.length === 0 && (
        <p className="rounded-xl border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
          Tidak ada panduan yang cocok dengan “{q}”.
        </p>
      )}

      {filtered.map((g) => (
        <section key={g.group}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{g.group}</h2>
          <div className="space-y-2">
            {g.topics.map((t) => {
              const isOpen = openKey === t.key;
              return (
                <div key={t.key} className="overflow-hidden rounded-xl border bg-card">
                  <button
                    onClick={() => setOpenKey(isOpen ? null : t.key)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-muted/50"
                    aria-expanded={isOpen}
                  >
                    <div>
                      <div className="text-sm font-bold text-foreground">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.whatIsIt}</div>
                    </div>
                    <span className={`shrink-0 text-muted-foreground transition ${isOpen ? "rotate-90" : ""}`}>›</span>
                  </button>

                  {isOpen && (
                    <div className="space-y-5 border-t px-4 py-4">
                      <section>
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                          <ListChecks className="h-4 w-4" /> Cara pakai
                        </div>
                        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground/80 marker:text-muted-foreground">
                          {t.steps.map((s, i) => <li key={i}>{s}</li>)}
                        </ol>
                      </section>
                      {t.tips && t.tips.length > 0 && (
                        <section>
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                            <Sparkles className="h-4 w-4" /> Tips
                          </div>
                          <ul className="list-disc space-y-1.5 pl-5 text-sm text-foreground/80 marker:text-muted-foreground">
                            {t.tips.map((s, i) => <li key={i}>{s}</li>)}
                          </ul>
                        </section>
                      )}
                      {t.faqs && t.faqs.length > 0 && (
                        <section>
                          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                            <HelpCircle className="h-4 w-4" /> Sering ditanya
                          </div>
                          <div className="space-y-2">
                            {t.faqs.map((f, i) => (
                              <div key={i} className="rounded-xl border bg-muted/40 p-3 text-sm">
                                <div className="font-semibold text-foreground">{f.q}</div>
                                <div className="mt-1 text-foreground/70">{f.a}</div>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
