"use client";

import { createClient } from "@/lib/supabase/client";
import { startGoogleLogin } from "./actions";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function GoogleSignInButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    try {
      // Driver google (self-host): server bangun URL + set state cookie → redirect.
      const { url } = await startGoogleLogin(next);
      if (url) {
        window.location.href = url;
        return;
      }
      // Driver supabase (default lama): pakai jalur signInWithOAuth.
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) {
        setLoading(false);
        toast.error("Gagal masuk: " + error.message);
      }
      // sukses → browser diarahkan ke Google
    } catch (e) {
      setLoading(false);
      toast.error("Gagal memulai proses masuk. Coba lagi.");
      console.error("[signIn] gagal:", e);
    }
  }

  return (
    <button
      onClick={signIn}
      disabled={loading}
      aria-busy={loading}
      className="flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl border bg-card px-4 py-3 font-medium text-foreground shadow-sm transition hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-60"
    >
      {loading ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
          <path fill="#FBBC05" d="M5.85 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.67-2.84Z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
        </svg>
      )}
      {loading ? "Mengalihkan…" : "Lanjutkan dengan Google"}
    </button>
  );
}
