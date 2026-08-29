import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";
import { appBaseUrl } from "@/lib/unit-code/urls";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const SITE_URL = appBaseUrl();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Aircon — Software Usaha Servis AC (Kasir, Invoice & Pengingat WhatsApp)",
    template: "%s · Aircon",
  },
  description:
    "Aplikasi manajemen usaha servis AC dari HP: terima booking online, atur teknisi & jadwal, buat invoice profesional, pantau piutang, dan buat pelanggan servis ulang otomatis lewat WhatsApp. Gratis selamanya untuk mulai.",
  keywords: [
    "software usaha AC", "aplikasi servis AC", "manajemen teknisi AC", "aplikasi cuci AC",
    "invoice servis AC", "kasir usaha AC", "reminder servis AC WhatsApp", "aplikasi HVAC Indonesia",
    "booking servis AC online", "manajemen bengkel AC", "Aircon Lumite",
  ],
  authors: [{ name: "PT. Lumite Automasi Indonesia" }],
  creator: "PT. Lumite Automasi Indonesia",
  publisher: "PT. Lumite Automasi Indonesia",
  manifest: "/manifest.json",
  applicationName: "Aircon",
  category: "business",
  alternates: { canonical: "/" },
  icons: {
    icon: "/icon-512.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: SITE_URL,
    siteName: "Aircon",
    title: "Aircon — Software Usaha Servis AC dari HP",
    description:
      "Terima booking online, atur teknisi, buat invoice profesional, dan buat pelanggan servis ulang otomatis lewat WhatsApp. Gratis selamanya untuk mulai.",
    images: [{ url: "/brand/aircon-logo.png", width: 512, height: 512, alt: "Aircon" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aircon — Software Usaha Servis AC dari HP",
    description:
      "Kasir, invoice, jadwal teknisi, dan pengingat servis WhatsApp — semua dari HP. Gratis selamanya untuk mulai.",
    images: ["/brand/aircon-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport = {
  themeColor: "#0ea5e9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <NextTopLoader color="#0ea5e9" height={3} showSpinner={false} shadow="0 0 10px #0ea5e9,0 0 5px #0ea5e9" />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
