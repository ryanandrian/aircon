import { describe, it, expect } from "vitest";
import { wibDay, isBotUserAgent } from "../src/lib/domain/visit-pure";

describe("visit-service — helper murni", () => {
  it("wibDay: format YYYY-MM-DD zona WIB (+07)", () => {
    // 2026-01-01 23:30 UTC → +07 = 2026-01-02
    expect(wibDay(new Date("2026-01-01T23:30:00Z"))).toBe("2026-01-02");
    // 2026-01-01 10:00 UTC → +07 = 2026-01-01
    expect(wibDay(new Date("2026-01-01T10:00:00Z"))).toBe("2026-01-01");
  });

  it("isBotUserAgent: kenali bot & UA kosong", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("Googlebot/2.1")).toBe(true);
    expect(isBotUserAgent("facebookexternalhit/1.1")).toBe(true);
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("WhatsApp/2.23")).toBe(true);
  });

  it("isBotUserAgent: manusia (browser) TIDAK dianggap bot", () => {
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605 Safari/604")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537")).toBe(false);
  });
});
