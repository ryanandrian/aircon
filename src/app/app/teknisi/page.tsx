import { redirect } from "next/navigation";

// Kompatibilitas: halaman lama /app/teknisi kini menjadi /app/tim (Tim / Staf).
// Redirect permanen agar tautan/bookmark lama tetap berfungsi (tanpa 404).
export default function TeknisiRedirect() {
  redirect("/app/tim");
}
