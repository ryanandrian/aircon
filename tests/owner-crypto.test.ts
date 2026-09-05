import { describe, it, expect } from "vitest";
import {
  makeOwnerToken,
  parseOwnerToken,
  makeOAuthState,
  verifyOAuthState,
} from "../src/lib/auth/owner-crypto";

// SESSION_SECRET wajib ada untuk HMAC.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-owner-crypto-xyz";

describe("owner-crypto: token sesi owner", () => {
  it("round-trip: token valid → email kembali", () => {
    const t = makeOwnerToken("budi@example.com");
    expect(parseOwnerToken(t)).toBe("budi@example.com");
  });

  it("email dengan karakter khusus tetap utuh", () => {
    const email = "a.b+tag@sub.domain.co.id";
    expect(parseOwnerToken(makeOwnerToken(email))).toBe(email);
  });

  it("tolak token kosong / rusak", () => {
    expect(parseOwnerToken(undefined)).toBeNull();
    expect(parseOwnerToken("")).toBeNull();
    expect(parseOwnerToken("abc")).toBeNull();
    expect(parseOwnerToken("abc.def")).toBeNull();
  });

  it("tolak token yang di-tamper (signature tak cocok)", () => {
    const t = makeOwnerToken("owner@example.com");
    const idx = t.lastIndexOf(".");
    const body = t.slice(0, idx);
    const tampered = body + "." + "0".repeat(64);
    expect(parseOwnerToken(tampered)).toBeNull();
  });

  it("tolak token kedaluwarsa", () => {
    // buat token dengan waktu 40 hari lalu (maxage 30 hari)
    const past = Date.now() - 40 * 24 * 60 * 60 * 1000;
    const t = makeOwnerToken("old@example.com", past);
    expect(parseOwnerToken(t)).toBeNull();
  });

  it("tolak body diganti email lain (signature lama)", () => {
    const t = makeOwnerToken("victim@example.com");
    const sig = t.slice(t.lastIndexOf(".") + 1);
    const fakeBody = Buffer.from(`attacker@example.com\n${Date.now() + 1e9}`).toString("base64url");
    expect(parseOwnerToken(`${fakeBody}.${sig}`)).toBeNull();
  });
});

describe("owner-crypto: state anti-CSRF", () => {
  it("state valid terverifikasi", () => {
    const s = makeOAuthState();
    expect(verifyOAuthState(s)).toBe(true);
  });

  it("tolak state kosong / rusak / tamper", () => {
    expect(verifyOAuthState(undefined)).toBe(false);
    expect(verifyOAuthState("x")).toBe(false);
    const s = makeOAuthState();
    const body = s.slice(0, s.lastIndexOf("."));
    expect(verifyOAuthState(body + ".deadbeef")).toBe(false);
  });

  it("tolak state kedaluwarsa (>10 mnt)", () => {
    const old = Date.now() - 11 * 60 * 1000;
    const s = makeOAuthState(old);
    expect(verifyOAuthState(s)).toBe(false);
  });
});
