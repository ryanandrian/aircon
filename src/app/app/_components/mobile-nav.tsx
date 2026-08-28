"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Icon } from "@/components/icons";
import { AppNav } from "./app-nav";

/** Hamburger + drawer navigasi untuk mobile (md:hidden). Seragam: shadcn Sheet + AppNav. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        aria-label="Buka menu navigasi"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted md:hidden"
      >
        <Icon.Menu className="h-5 w-5" aria-hidden />
      </button>
      <SheetContent side="left">
        <SheetTitle className="mb-1 text-sky-600">Menu Usaha</SheetTitle>
        <p className="mb-5 text-xs text-muted-foreground">Navigasi Aircon</p>
        <AppNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
