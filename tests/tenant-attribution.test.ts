import { describe, it, expect } from "vitest";
import {
  attributionKind,
  attributionLabel,
  attributionPartnerName,
  attributionShortLabel,
  attributionSummary,
  type AttributionInput,
} from "../src/lib/partner/attribution";
import { planAmountFromMap } from "../src/lib/billing/config";

const AGEN: AttributionInput = {
  agentId: "agent-1",
  agentName: "PT Mitra Sukses",
  resellerId: null,
  resellerName: null,
};

const VIA_RESELLER: AttributionInput = {
  agentId: "agent-1",
  agentName: "PT Mitra Sukses",
  resellerId: "reseller-1",
  resellerName: "CV Abadi Sejahtera",
};

describe("atribusi tenant (bawaan)", () => {
  it("tenant tanpa baris atribusi = tanpa bawaan", () => {
    expect(attributionKind(null)).toBe("NONE");
    expect(attributionLabel(null)).toBe("Tanpa Bawaan");
    expect(attributionPartnerName(null)).toBeNull();
    expect(attributionSummary(null)).toBe("");
  });

  it("resellerId null = bawaan agen langsung", () => {
    expect(attributionKind(AGEN)).toBe("AGENT");
    expect(attributionLabel(AGEN)).toBe("Bawaan Agen");
    expect(attributionPartnerName(AGEN)).toBe("PT Mitra Sukses");
    expect(attributionSummary(AGEN)).toBe("Agen: PT Mitra Sukses");
  });

  it("resellerId terisi = bawaan reseller, agen tetap disebut", () => {
    expect(attributionKind(VIA_RESELLER)).toBe("RESELLER");
    expect(attributionLabel(VIA_RESELLER)).toBe("Bawaan Reseller");
    // Nama reseller lebih spesifik → jadi nama utama.
    expect(attributionPartnerName(VIA_RESELLER)).toBe("CV Abadi Sejahtera");
    expect(attributionSummary(VIA_RESELLER)).toBe(
      "Reseller: CV Abadi Sejahtera · Agen: PT Mitra Sukses",
    );
  });

  it("resellerId terisi tapi nama reseller kosong → tetap agen sebagai sumber", () => {
    const tanpaNama = { ...VIA_RESELLER, resellerName: null };
    expect(attributionLabel(tanpaNama)).toBe("Bawaan Reseller");
    expect(attributionPartnerName(tanpaNama)).toBe("PT Mitra Sukses");
    expect(attributionSummary(tanpaNama)).toBe("Agen: PT Mitra Sukses");
  });

  it("label pendek untuk badge di sel tabel", () => {
    expect(attributionShortLabel(null)).toBe("Tanpa Bawaan");
    expect(attributionShortLabel(AGEN)).toBe("Agen");
    expect(attributionShortLabel(VIA_RESELLER)).toBe("Reseller");
  });
});

describe("nilai paket untuk laporan", () => {
  const priceMap = { TRIAL: 0, PROFESSIONAL: 149000, BUSINESS: 499000 } as Record<string, number>;

  it("snapshot subscription jadi SSOT", () => {
    expect(planAmountFromMap("PROFESSIONAL", 120000, priceMap)).toBe(120000);
  });

  it("fallback ke harga paket bila belum ada subscription", () => {
    expect(planAmountFromMap("PROFESSIONAL", null, priceMap)).toBe(149000);
    expect(planAmountFromMap("BUSINESS", 0, priceMap)).toBe(499000);
  });

  it("paket trial bernilai 0", () => {
    expect(planAmountFromMap("TRIAL", null, priceMap)).toBe(0);
  });

  it("paket tak dikenal → 0 (bukan NaN/undefined)", () => {
    expect(planAmountFromMap("UNKNOWN" as never, null, priceMap)).toBe(0);
  });
});
