/**
 * SUMBER TUNGGAL konten Bantuan (Help) Aircon — dibaca oleh:
 *  - <HelpButton topic> (tombol ? kontekstual di header tiap layar) → Sheet 4-bagian.
 *  - Halaman /app/panduan (Pusat Panduan) → daftar lengkap dikelompokkan.
 *
 * PRINSIP: konten WAJIB akurat terhadap layar nyata (label tombol, alur, field). Panduan salah
 * lebih buruk dari tak ada panduan. Setiap topik diverifikasi terhadap kode layar terkait.
 *
 * STRUKTUR: tipe di help-types.ts; konten per-audiens di content-*.ts; file ini menggabung jadi registry.
 * Migrasi ke DB (configurable admin) nanti: ganti sumber array → query DB; konsumen tak berubah.
 */
import type { HelpTopic, HelpAudience } from "./help-types";
import { OWNER_TOPICS } from "./content-owner";
import { TECH_TOPICS } from "./content-tech";
import { ADMIN_TOPICS } from "./content-admin";

export type { HelpTopic, HelpAudience, HelpFaq } from "./help-types";

/** REGISTRY konten (semua audiens). */
export const HELP_TOPICS: Record<string, HelpTopic> = {};
for (const t of [...OWNER_TOPICS, ...TECH_TOPICS, ...ADMIN_TOPICS]) {
  HELP_TOPICS[t.key] = t;
}

/** Urutan tampil kelompok di Pusat Panduan. */
export const GROUP_ORDER: string[] = [
  "Mulai di sini",
  "Mengelola Pekerjaan",
  "Otomatisasi",
  "Keuangan & Langganan",
  "Pengaturan Usaha",
  "Untuk Teknisi",
  "Administrasi Platform",
];

/** Ambil satu topik by key (null bila tak ada). */
export function getHelpTopic(key: string): HelpTopic | null {
  return HELP_TOPICS[key] ?? null;
}

function sortTopics(a: HelpTopic, b: HelpTopic): number {
  const ga = GROUP_ORDER.indexOf(a.group);
  const gb = GROUP_ORDER.indexOf(b.group);
  if (ga !== gb) return ga - gb;
  return a.order - b.order;
}

/** Semua topik untuk audiens tertentu, terurut grup lalu order. */
export function getHelpTopicsByAudience(audience: HelpAudience): HelpTopic[] {
  return Object.values(HELP_TOPICS).filter((t) => t.audience === audience).sort(sortTopics);
}

/** Kelompokkan topik audiens → [{group, topics[]}] terurut. */
export function groupHelpTopics(audience: HelpAudience): { group: string; topics: HelpTopic[] }[] {
  const topics = getHelpTopicsByAudience(audience);
  const map = new Map<string, HelpTopic[]>();
  for (const t of topics) {
    const arr = map.get(t.group) ?? [];
    arr.push(t);
    map.set(t.group, arr);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, topics: map.get(g)! }));
}
