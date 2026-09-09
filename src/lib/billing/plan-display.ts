/**
 * SATU sumber format tampilan kuota paket — dipakai marketing landing & in-app "Paket Langganan".
 * Angka berasal dari PlanConfig (DB, diedit di Lumite admin "Paket Langganan"); modul ini hanya
 * menyeragamkan KATA & URUTAN agar kedua halaman IDENTIK. Pure (tanpa DB) → mudah diuji.
 */

export interface PlanQuotaInput {
  maxTechnicians: number | null;
  maxAdmins: number | null;
  maxCustomers: number | null;
  maxAcUnits: number | null;
}

/** Baris fitur/kuota paket, URUTAN & TEKS resmi (Teknisi → Admin → Pelanggan → Unit AC → Booking). */
export function planQuotaLines(p: PlanQuotaInput): string[] {
  return [
    p.maxTechnicians === null ? "Teknisi tanpa batas" : `${p.maxTechnicians} teknisi (termasuk helper)`,
    p.maxAdmins === null ? "Admin tanpa batas" : p.maxAdmins > 0 ? `${p.maxAdmins} admin` : "Dijalankan pemilik sendiri",
    p.maxCustomers === null ? "Pelanggan tanpa batas" : `${p.maxCustomers.toLocaleString("id-ID")} pelanggan`,
    p.maxAcUnits === null ? "Unit AC tanpa batas" : `${p.maxAcUnits.toLocaleString("id-ID")} unit AC`,
    "Booking online + pengingat WhatsApp",
  ];
}
