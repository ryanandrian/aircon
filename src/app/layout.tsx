import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aircon — Operating System untuk Usaha Servis AC",
  description:
    "Dapatkan customer, atur teknisi & jadwal, dan buat customer kembali otomatis. Semua dari HP.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#0ea5e9",
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
