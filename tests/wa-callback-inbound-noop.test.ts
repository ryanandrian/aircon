import { describe, it, expect, vi, beforeEach } from "vitest";

// G7-Aircon — callback WA: pesan TULISAN pelanggan tidak lagi ditulis ke DB.
//
// Bukti hidup (2026-10-13): DB Aircon 4.034 baris MessageLog INBOUND — 100% dari
// nomor yang tidak pernah dituju aplikasi, NOL pembaca, NOL tindak lanjut. Isinya
// percakapan pribadi pelanggan (risiko privasi/hukum) yang menumpuk tanpa gunanya.
// Konsumen Aircon TIDAK membaca direction=INBOUND; yang dipakai = status pengiriman
// keluar (delivery_status).
//
// Keputusan pemilik (2026-10-14, sejalan dengan G7 gateway): callback tipe
// "inbound" TIDAK menulis ke DB. Jalur callback tetap hidup & membalas 200
// (gateway TIDAK boleh memprotes — transport netral).
//
// Yang DIKUNCI test ini:
//   1. callback tipe "inbound" -> prisma.messageLog.create TIDAK dipanggil, respons 200
//   2. callback tipe "delivery_status" -> messageLog.updateMany TETAP terpanggil (utuh)
//   3. callback lifecycle (ready) -> nol tulis apa pun

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    messageLog: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn().mockResolvedValue({}) },
  },
}));
// Auth callback: header X-Callback-Secret (timing-safe). Sediakan secret stabil.
vi.mock("@/lib/services/infra-config-service", () => ({
  getInfraSecrets: vi.fn().mockResolvedValue({ callbackSecret: "test-callback-secret" }),
}));

import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/wa/callback/route";
import { NextRequest } from "next/server";

function req(body: object) {
  return new NextRequest("http://localhost/api/wa/callback", {
    method: "POST",
    headers: { "content-type": "application/json", "x-callback-secret": "test-callback-secret" },
    body: JSON.stringify(body),
  });
}

const mock = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("callback tipe inbound (tulisan pelanggan) — tidak menulis DB", () => {
  it("respons 200 + TANPA messageLog.create", async () => {
    const res = await POST(req({
      type: "inbound",
      externalId: "tenant-x",
      fromPhone: "628111111111",
      body: "pesan pribadi pelanggan",
    }));
    expect(res.status).toBe(200);
    expect(mock.messageLog.create).not.toHaveBeenCalled();
  });
});

describe("callback status pengiriman — TETAP UTUH (batas aman G7)", () => {
  it("delivery_status membaca status lama lalu memperbarui pesan keluar", async () => {
    // guard monotonic: findFirst (baca status lama) -> banding rank -> updateMany.
    // findFirst default = null (tidak ada status tersimpan) -> rank 0;
    // DELIVERED (rank 2) > 0 -> lolos -> updateMany terpanggil.
    const res = await POST(req({
      type: "delivery_status",
      externalId: "tenant-x",
      messageId: "3EB0ABC@sent",
      status: "DELIVERED",
    }));
    expect(res.status).toBe(200);
    expect(mock.messageLog.findFirst).toHaveBeenCalled();
    expect(mock.messageLog.updateMany).toHaveBeenCalled();
  });
});

describe("callback lifecycle lain tidak menulis pesan", () => {
  it("tipe ready tidak menyentuh messageLog", async () => {
    const res = await POST(req({ type: "ready", externalId: "tenant-x" }));
    expect(res.status).toBe(200);
    expect(mock.messageLog.create).not.toHaveBeenCalled();
    expect(mock.messageLog.updateMany).not.toHaveBeenCalled();
  });
});
