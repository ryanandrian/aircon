/**
 * Alias lama untuk webhook IoT. Kini SEMUA notifikasi Midtrans ditangani oleh
 * webhook tunggal /api/billing/midtrans-webhook (dibedakan via lookup order_id).
 * Endpoint ini diteruskan ke handler tunggal agar URL lama tetap berfungsi.
 */
export { POST } from "@/app/api/billing/midtrans-webhook/route";
