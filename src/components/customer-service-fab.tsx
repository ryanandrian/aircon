import Link from "next/link";
import { MessageCircle } from "lucide-react";

/** Public/platform CS number. Admin override is stored in LandingContent.csWhatsapp. */
export function CustomerServiceFab({ phone }: { phone: string }) {
  const normalized = phone.replace(/\D/g, "");
  if (!normalized) return null;
  const href = `https://wa.me/${normalized}?text=${encodeURIComponent("Halo CS Aircon, saya membutuhkan bantuan.")}`;
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat Customer Service Aircon via WhatsApp"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-900/20 transition hover:bg-[#1ebe5d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
    >
      <MessageCircle className="h-5 w-5" aria-hidden />
      <span className="hidden sm:inline">Chat CS Aircon</span>
    </Link>
  );
}
