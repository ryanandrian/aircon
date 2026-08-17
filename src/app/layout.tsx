import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aircon — Operating System untuk Usaha Servis AC",
  description:
    "Dapatkan customer, atur teknisi & jadwal, dan buat customer kembali otomatis. Semua dari HP.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
