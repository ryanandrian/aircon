/**
 * IoT order — fungsi MURNI, tanpa DB. Aman diuji unit.
 */

/** Nomor pesanan IoT unik: IOT-<tenant6>-<ts36>-<rand>. */
export function makeIotOrderNo(tenantId: string): string {
  const t = tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `IOT-${t}-${ts}-${rand}`;
}

/** Hitung subtotal, pajak, total pesanan device (jual putus). */
export function computeOrderTotals(
  unitPrice: number,
  qty: number,
  taxPercent: number,
): { subtotal: number; taxAmount: number; total: number } {
  const q = Math.max(1, Math.floor(qty));
  const subtotal = unitPrice * q;
  const taxAmount = Math.round((subtotal * taxPercent) / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}
