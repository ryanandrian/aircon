import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build mandiri untuk deploy VPS (Node) — hasilkan .next/standalone/server.js.
  // Tak mengubah perilaku di Vercel; hanya menambah output standalone.
  output: "standalone",
  // navigasi dinamis (A↔B) cepat di perangkat/jaringan lambat — cache in-memory
  // (bukan cache CDN/data): data tetap segar karena server actions eksplisit
  // revalidatePath + router.refresh; ini hanya menghindari RSC refetch yang
  // berulang saat pengguna bolak-balik. Diuji dengan test nav-tech-stuck.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
