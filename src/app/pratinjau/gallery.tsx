"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Item = { id: string; title: string; caption: string; imageUrl: string; category: string };

export function PreviewGallery({ items }: { items: Item[] }) {
  const [active, setActive] = useState<Item | null>(null);

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setActive(it)}
            className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-2xl"
          >
            <Card className="interactive h-full overflow-hidden">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
                  alt={it.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
                {it.category && (
                  <Badge className="absolute left-3 top-3 bg-sky-600 text-white hover:bg-sky-600">{it.category}</Badge>
                )}
              </div>
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground">{it.title}</h3>
                {it.caption && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{it.caption}</p>}
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {active && (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active.imageUrl} alt={active.title} className="max-h-[70vh] w-full object-contain bg-muted" />
              <div className="p-5">
                {active.category && <Badge className="mb-2 bg-sky-600 text-white hover:bg-sky-600">{active.category}</Badge>}
                <DialogTitle className="text-lg font-bold">{active.title}</DialogTitle>
                {active.caption && <DialogDescription className="mt-1 text-sm text-muted-foreground">{active.caption}</DialogDescription>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
