/**
 * Default seed constants — checklist per service + template WA.
 * Sumber: docs/BuildSpecPack_Part3_BusinessRules_and_Defaults.md §3 & §4
 * Dipakai saat provisioning tenant baru (default; tenant boleh edit).
 */

export type ChecklistItem = {
  key: string;
  label: string;
  type: "bool" | "number" | "text" | "photo";
  required: boolean;
};
// Catatan: constant bawaan DEFAULT_CHECKLISTS (contoh per jenis servis) DIHAPUS —
// checklist kini per layanan, opt-in, default kosong (keputusan user 2026-10-03).
// Konsumen terakhirnya (legacy editor serviceType) sudah ikut dihapus di FASE 2.

/** Template WA default (Bahasa Indonesia). Placeholder: {{customer}} {{tanggal}} {{jam}} {{teknisi}} {{unit}} {{alamat}} {{usaha}} {{harga}} */
export const DEFAULT_WA_TEMPLATES: Record<string, string> = {
  reminder:
    "Halo {{customer}}, AC {{unit}} Anda sudah waktunya servis rutin. Boleh kami jadwalkan kunjungan teknisi? — {{usaha}}",
  reminder_multi:
    "Halo {{customer}}, {{jumlah}} unit AC Anda sudah waktunya servis/cuci:\n{{daftar}}\n\nBoleh kami jadwalkan kunjungan teknisi? Balas pesan ini ya. — {{usaha}}",
  reschedule:
    "Halo {{customer}}, mohon maaf jadwal servis AC diubah ke {{tanggal}} pukul {{jam}}. Mohon konfirmasinya ya. — {{usaha}}",
  on_the_way:
    "Halo {{customer}}, teknisi {{teknisi}} sedang menuju lokasi Anda untuk servis AC {{unit}}. — {{usaha}}",
  review:
    "Terima kasih {{customer}} 🙏 Servis AC sudah selesai. Boleh bantu beri ulasan singkat pengalaman Anda? — {{usaha}}",
  lead_followup:
    "Halo {{customer}}, menindaklanjuti kebutuhan servis AC Anda. Apakah boleh kami bantu jadwalkan? — {{usaha}}",
  campaign:
    "Halo {{customer}}, promo servis AC dari {{usaha}}. Hubungi kami untuk jadwal ya!",
  iot_alert_offer:
    "Halo {{customer}}, sistem kami mendeteksi AC {{unit}} perlu pengecekan. Boleh kami kirim teknisi? — {{usaha}}",
  technician_invite:
    "Halo {{teknisi}}, Anda diundang bergabung sebagai teknisi di {{usaha}}. Buka tautan untuk mengatur PIN Anda.",
};
