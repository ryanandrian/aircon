"use client";

import { createClient } from "@/lib/supabase/client";
import { logoutOwner } from "./logout-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    // Bersihkan KEDUA jalur sesi (driver apa pun): cookie owner (server) + sesi Supabase (client).
    try {
      await logoutOwner();
    } catch { /* abaikan */ }
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch { /* abaikan bila driver google / supabase tak aktif */ }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {loading ? "Keluar…" : "Keluar"}
    </button>
  );
}
