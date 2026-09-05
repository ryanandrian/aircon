import { AppHeader } from "../_components/app-header";
import { GuideCenter } from "./guide-center";
import { groupHelpTopics } from "@/lib/help/help-content";

export const dynamic = "force-dynamic";

/**
 * Pusat Panduan (/app/panduan) — daftar lengkap panduan pemakaian untuk pemilik usaha.
 * Baca dari SUMBER TUNGGAL help-content (grup audiens 'owner'). Teknisi punya panduan sendiri
 * di aplikasi teknisi; di sini fokus panduan panel usaha.
 */
export default function PanduanPage() {
  const groups = groupHelpTopics("owner");
  return (
    <>
      <AppHeader title="Panduan Aircon" back="/app" />
      <main className="mx-auto max-w-4xl px-5 py-6">
        <p className="mb-5 text-sm text-muted-foreground">
          Panduan lengkap memakai Aircon. Ketuk topik untuk melihat langkah-langkahnya. Anda juga bisa
          menekan tombol <span className="font-semibold text-foreground">?</span> di kanan atas tiap layar
          untuk bantuan cepat sesuai halaman yang sedang dibuka.
        </p>
        <GuideCenter groups={groups} />
      </main>
    </>
  );
}
