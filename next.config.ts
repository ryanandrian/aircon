import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri untuk deploy VPS (Node) — hasilkan .next/standalone/server.js.
  // Tak mengubah perilaku di Vercel; hanya menambah output standalone.
  output: "standalone",
  // Impor pelanggan mengunggah file .xlsx via Server Action. Default 1MB terlalu kecil
  // (file dgn ratusan baris + styling bisa >1MB) → naikkan ke 8MB (selaras batas upload lain).
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
