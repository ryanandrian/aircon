"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AdminNav } from "./admin-nav";

/** Mobile drawer Admin Platform; mirrors the existing tenant AppNav + Sheet pattern. */
export function MobileAdminNav({ adminName, adminEmail }: { adminName: string; adminEmail: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Buka menu navigasi Admin Platform"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      <SheetContent side="left" className="w-72 max-w-[85vw] p-4">
        <SheetTitle className="sr-only">Navigasi Admin Platform</SheetTitle>
        <div className="mb-4 shrink-0 border-b pb-4">
          <p className="text-base font-semibold text-sky-600">Admin Platform</p>
          <p className="text-xs text-muted-foreground">Panel tim internal</p>
        </div>
        <div className="h-0 min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain">
          <AdminNav onNavigate={() => setOpen(false)} />
        </div>
        <div className="mt-4 shrink-0 border-t pt-3 text-xs text-muted-foreground">
          <p className="truncate font-medium text-foreground">{adminName}</p>
          <p className="truncate">{adminEmail}</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
