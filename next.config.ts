import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri untuk deploy VPS (Node) — hasilkan .next/standalone/server.js.
  // Tak mengubah perilaku di Vercel; hanya menambah output standalone.
  output: "standalone",
};

export default nextConfig;
