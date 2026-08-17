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

export const DEFAULT_CHECKLISTS: Record<string, ChecklistItem[]> = {
  CLEANING: [
    { key: "unit_off", label: "Matikan unit sebelum bekerja", type: "bool", required: true },
    { key: "filter_clean", label: "Cuci filter", type: "bool", required: true },
    { key: "coil_clean", label: "Cuci evaporator/kondensor", type: "bool", required: true },
    { key: "drain_check", label: "Cek & bersihkan saluran air", type: "bool", required: true },
    { key: "photo_before", label: "Foto sebelum", type: "photo", required: true },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: true },
    { key: "temp_after", label: "Suhu keluar setelah servis (°C)", type: "number", required: false },
  ],
  REFILL_FREON: [
    { key: "pressure_before", label: "Tekanan awal (psi)", type: "number", required: true },
    { key: "leak_check", label: "Cek kebocoran", type: "bool", required: true },
    { key: "freon_type", label: "Jenis freon (R32/R410/R22)", type: "text", required: true },
    { key: "pressure_after", label: "Tekanan akhir (psi)", type: "number", required: true },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: true },
  ],
  REPAIR: [
    { key: "problem_found", label: "Kerusakan ditemukan", type: "text", required: true },
    { key: "action_taken", label: "Tindakan", type: "text", required: true },
    { key: "part_replaced", label: "Sparepart diganti", type: "text", required: false },
    { key: "photo_before", label: "Foto sebelum", type: "photo", required: true },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: true },
  ],
  INSTALL: [
    { key: "location_ok", label: "Lokasi pemasangan sesuai", type: "bool", required: true },
    { key: "bracket_mounted", label: "Bracket terpasang kuat", type: "bool", required: true },
    { key: "pipe_length_m", label: "Panjang pipa (m)", type: "number", required: true },
    { key: "vacuum_done", label: "Vakum dilakukan", type: "bool", required: true },
    { key: "test_run", label: "Uji nyala OK", type: "bool", required: true },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: true },
  ],
  INSPECTION: [
    { key: "visual_ok", label: "Kondisi visual baik", type: "bool", required: true },
    { key: "temp_measured", label: "Suhu terukur (°C)", type: "number", required: true },
    { key: "current_measured", label: "Arus (A)", type: "number", required: false },
    { key: "recommendation", label: "Rekomendasi", type: "text", required: false },
  ],
  DISMANTLE: [
    { key: "photo_before", label: "Foto sebelum", type: "photo", required: true },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: true },
    { key: "notes", label: "Catatan", type: "text", required: false },
  ],
  OTHER: [
    { key: "photo_before", label: "Foto sebelum", type: "photo", required: false },
    { key: "photo_after", label: "Foto sesudah", type: "photo", required: false },
    { key: "notes", label: "Catatan", type: "text", required: false },
  ],
};

/** Template WA default (Bahasa Indonesia). Placeholder: {{customer}} {{tanggal}} {{jam}} {{teknisi}} {{unit}} {{alamat}} {{usaha}} {{harga}} */
export const DEFAULT_WA_TEMPLATES: Record<string, string> = {
  reminder:
    "Halo {{customer}}, AC {{unit}} Anda sudah waktunya servis rutin. Boleh kami jadwalkan kunjungan teknisi? — {{usaha}}",
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
