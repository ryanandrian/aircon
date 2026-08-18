import { describe, it, expect } from "vitest";
import { detectAlert, alertMessage, DEFAULT_THRESHOLDS } from "../src/lib/iot/alert-detection";

describe("detectAlert", () => {
  it("normal → null", () => {
    expect(detectAlert({ tempC: 24, currentA: 5, online: true })).toBeNull();
  });

  it("offline → OFFLINE (prioritas tertinggi)", () => {
    const a = detectAlert({ online: false, currentA: 99, tempC: 99 });
    expect(a?.type).toBe("OFFLINE");
    expect(a?.severity).toBe("WARNING");
  });

  it("arus berlebih → OVERCURRENT CRITICAL", () => {
    const a = detectAlert({ currentA: 12, tempC: 25, online: true });
    expect(a?.type).toBe("OVERCURRENT");
    expect(a?.severity).toBe("CRITICAL");
  });

  it("AC nyala tapi panas → NO_COOLING WARNING", () => {
    const a = detectAlert({ currentA: 4, tempC: 33, online: true });
    expect(a?.type).toBe("NO_COOLING");
  });

  it("suhu tinggi TAPI AC mati (arus < runningMin) → bukan no-cooling", () => {
    expect(detectAlert({ currentA: 0, tempC: 33, online: true })).toBeNull();
  });

  it("overcurrent menang atas no-cooling", () => {
    const a = detectAlert({ currentA: 15, tempC: 35, online: true });
    expect(a?.type).toBe("OVERCURRENT");
  });

  it("ambang custom dihormati", () => {
    const th = { ...DEFAULT_THRESHOLDS, overcurrentA: 20 };
    expect(detectAlert({ currentA: 15, tempC: 25, online: true }, th)).toBeNull();
  });

  it("data suhu/arus null → tak error, null", () => {
    expect(detectAlert({ tempC: null, currentA: null, online: true })).toBeNull();
  });
});

describe("alertMessage", () => {
  it("punya pesan ramah untuk tiap tipe", () => {
    expect(alertMessage("OVERCURRENT")).toContain("arus");
    expect(alertMessage("NO_COOLING")).toContain("dingin");
    expect(alertMessage("OFFLINE")).toContain("terputus");
  });
});
