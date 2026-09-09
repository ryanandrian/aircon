/** Nomor kwitansi diturunkan dari nomor invoice (KW menggantikan prefix INV), tanpa sekuens baru. */
export function receiptNumber(invoiceNumber: string): string {
  return invoiceNumber.replace(/^INV\//, "KW/");
}
