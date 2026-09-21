"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Icon } from "@/components/icons";
import { AppNav } from "./app-nav";
import { TenantLogo } from "@/components/tenant-logo";
import { useTenantIdentity } from "./tenant-identity-context";

/** Hamburger + drawer navigasi untuk mobile (md:hidden). Seragam: shadcn Sheet + AppNav. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { name, logoUrl, email } = useTenantIdentity();
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
        <SheetTitle className="sr-only">Navigasi {name}</SheetTitle>
        <div className="mb-5 flex min-w-0 items-center gap-3 border-b pb-5">
          <TenantLogo name={name} logoUrl={logoUrl} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
          </div>
        </div>
        <AppNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
