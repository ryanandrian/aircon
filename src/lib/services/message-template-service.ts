/**
 * Message Template Service (tenant) — kelola template pesan WhatsApp ke PELANGGAN.
 * Per-tenant, tenant-scoped. Owner/admin tenant boleh edit (personalisasi wajah usaha).
 * Kunci template: reminder, reschedule, on_the_way, review, lead_followup, campaign,
 * iot_alert_offer (technician_invite disembunyikan — pesan sistem).
 */
import { prisma } from "@/lib/prisma";
import { DEFAULT_WA_TEMPLATES } from "@/lib/domain/defaults";

/** Label ramah + deskripsi untuk tiap kunci template (ditampilkan ke owner). */
export const TEMPLATE_META: Record<string, { label: string; desc: string }> = {
  reminder: { label: "Pengingat Servis Rutin", desc: "Dikirim otomatis saat AC pelanggan waktunya servis (money loop)." },
  reschedule: { label: "Ubah Jadwal", desc: "Saat jadwal servis diubah." },
  on_the_way: { label: "Teknisi Menuju Lokasi", desc: "Saat teknisi berangkat ke pelanggan." },
  review: { label: "Minta Ulasan", desc: "Setelah servis selesai, minta ulasan pelanggan." },
  lead_followup: { label: "Tindak Lanjut Calon Pelanggan", desc: "Follow-up prospek yang belum jadi." },
  campaign: { label: "Promo/Kampanye", desc: "Pesan promosi ke pelanggan." },
  iot_alert_offer: { label: "Tawaran dari Alert IoT", desc: "Saat perangkat IoT deteksi AC bermasalah." },
};

const EDITABLE_KEYS = Object.keys(TEMPLATE_META);

export interface TemplateView {
  key: string;
  label: string;
  desc: string;
  body: string;
}

/** Daftar template tenant (gabungkan yang tersimpan + default bila belum ada). */
export async function listTemplates(tenantId: string): Promise<TemplateView[]> {
  const rows = await prisma.messageTemplate.findMany({ where: { tenantId } });
  const byKey = new Map(rows.map((r) => [r.key, r.body]));
  return EDITABLE_KEYS.map((key) => ({
    key,
    label: TEMPLATE_META[key].label,
    desc: TEMPLATE_META[key].desc,
    body: byKey.get(key) ?? DEFAULT_WA_TEMPLATES[key] ?? "",
  }));
}

/** Simpan satu template (tenant-scoped, hanya kunci yang diizinkan). */
export async function saveTemplate(tenantId: string, key: string, body: string): Promise<void> {
  if (!EDITABLE_KEYS.includes(key)) throw new Error("Kunci template tidak dikenal");
  const trimmed = body.trim();
  if (trimmed.length < 5 || trimmed.length > 1000) throw new Error("Isi pesan 5–1000 karakter");
  await prisma.messageTemplate.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, body: trimmed },
    update: { body: trimmed },
  });
}

/** Kembalikan satu template ke default bawaan. */
export async function resetTemplate(tenantId: string, key: string): Promise<string> {
  if (!EDITABLE_KEYS.includes(key)) throw new Error("Kunci template tidak dikenal");
  const def = DEFAULT_WA_TEMPLATES[key] ?? "";
  await prisma.messageTemplate.upsert({
    where: { tenantId_key: { tenantId, key } },
    create: { tenantId, key, body: def },
    update: { body: def },
  });
  return def;
}
