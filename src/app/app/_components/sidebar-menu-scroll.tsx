"use client";

import { useRef, type ReactNode } from "react";

/**
 * Kontainer scroll SIDEBAR desktop — meniru overlay scrollbar HP:
 * tampil hanya selama digulir, hilang kembali setelah jeda.
 *
 * Cara kerja: saat `scroll` terjadi → tambahkan `.is-scrolling`; setelah 900ms
 * tidak ada gulir lagi → kelas dilepas. Gaya thumb/rail ada di globals.css
 * (`.sidebar-menu-scroll`); secara default thumb transparan, hanya diungkap
 * saat hover, sedang digulir, atau menerima fokus keyboard.
 *
 * Hanya untuk sidebar desktop. Drawer navigasi HP memakai scrollbar native
 * sistem dan sengaja tidak diubah. Pembaruan lewat ref langsung ke DOM —
 * tidak memicu render ulang.
 */
export function SidebarMenuScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleScroll() {
    const el = ref.current;
    if (!el) return;
    el.classList.add("is-scrolling");
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => ref.current?.classList.remove("is-scrolling"), 900);
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="sidebar-menu-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      {children}
    </div>
  );
}
