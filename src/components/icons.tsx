/**
 * Icon set terpusat (Lucide) — SATU sumber kebenaran ikon UI Aircon.
 * Aturan: JANGAN pakai emoji untuk ikon antarmuka (navigasi/tombol/metrik/badge).
 * Emoji hanya boleh di ISI pesan WhatsApp ke pelanggan (komunikasi manusia), bukan di UI.
 *
 * Pakai: import { Icon } from "@/components/icons"; lalu <Icon.Job className="h-5 w-5" />
 * Semua ikon Lucide menerima className (ukuran/warna via Tailwind) + aria otomatis.
 * Standar ukuran: metrik/nav 20-24px (h-5/h-6), inline teks 16px (h-4), hero 28-32px.
 */
import {
  ClipboardList, Wrench, Bell, Zap, HardHat, Radio, Smartphone, CreditCard,
  MessageSquare, ClipboardCheck, Globe, RefreshCw, Check, X, Copy, Printer,
  Phone, Navigation, MapPin, Calendar, Snowflake, Wind, Building2, DollarSign,
  Hand, FileText, PartyPopper, Clock, ShieldCheck, Users, Package, Send,
  Menu, Settings, LayoutDashboard, BarChart3, Star, ChevronRight,
} from "lucide-react";

/** Pemetaan semantik nama-domain -> komponen ikon (agar konsisten lintas halaman). */
export const Icon = {
  Job: ClipboardList,          // pekerjaan / job order
  Wrench: Wrench,              // servis / sedang dikerjakan
  Bell: Bell,                 // pengingat / reminder
  Zap: Zap,                   // peluang IoT / respons cepat
  Technician: HardHat,        // teknisi
  Device: Radio,              // perangkat IoT / pemantauan
  Mobile: Smartphone,         // mode teknisi / masuk teknisi
  Billing: CreditCard,        // langganan / pembayaran
  Message: MessageSquare,     // template pesan / chat WA
  Checklist: ClipboardCheck,  // checklist servis
  Web: Globe,                 // halaman usaha / booking online
  Repeat: RefreshCw,          // money loop / pelanggan datang lagi
  Check: Check,               // status sukses / poin fitur / tersalin
  Close: X,                   // hapus / tutup
  Copy: Copy,                 // salin link/kode
  Print: Printer,             // cetak faktur
  Phone: Phone,               // telepon pelanggan
  Navigate: Navigation,       // navigasi ke lokasi
  Location: MapPin,           // alamat / lokasi
  Calendar: Calendar,         // tanggal / jadwal
  AC: Snowflake,              // unit AC
  Wind: Wind,                 // AC / pendingin (alternatif)
  Business: Building2,        // segmen perusahaan
  Money: DollarSign,          // revenue / money loop
  Wave: Hand,                 // greeting (pengganti emoji lambaian)
  Note: FileText,             // catat / dokumen
  Success: PartyPopper,       // selesai / berhasil
  Clock: Clock,               // waktu / respons
  Shield: ShieldCheck,        // terverifikasi / aman
  Users: Users,               // tim / pelanggan
  Package: Package,           // produk IoT / paket
  Send: Send,                 // kirim
  Menu: Menu,                 // hamburger navigasi mobile
  Catalog: Wrench,            // daftar layanan / katalog
  Chart: BarChart3,           // laporan / analitik
  Star: Star,                 // rating testimoni
  ChevronRight: ChevronRight,  // accordion / navigasi
  Settings: Settings,         // pengaturan
  Dashboard: LayoutDashboard, // ringkasan / dashboard
};

export type IconName = keyof typeof Icon;
