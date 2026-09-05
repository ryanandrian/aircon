import { GuideCenter } from "../../app/panduan/guide-center";
import { groupHelpTopics } from "@/lib/help/help-content";

export const dynamic = "force-dynamic";

/**
 * Panduan Admin (/admin/panduan) — panduan seluruh panel administrasi platform.
 * Baca dari SUMBER TUNGGAL help-content (audiens 'admin').
 */
export default function AdminPanduanPage() {
  const groups = groupHelpTopics("admin");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Panduan Admin</h1>
        <p className="text-sm text-muted-foreground">
          Panduan lengkap tiap menu panel administrasi. Ketuk topik untuk melihat langkah-langkahnya.
        </p>
      </div>
      <GuideCenter groups={groups} />
    </div>
  );
}
