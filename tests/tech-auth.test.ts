import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-for-vitest-only";
});

import { hashPin, verifyPin, parseToken, isValidPin } from "../src/lib/auth/tech-crypto";

describe("isValidPin", () => {
  it("terima 6 digit", () => {
    expect(isValidPin("123456")).toBe(true);
  });
  it("tolak bukan 6 digit / ada huruf", () => {
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a456")).toBe(false);
    expect(isValidPin("")).toBe(false);
  });
});

describe("hashPin / verifyPin", () => {
  it("PIN benar terverifikasi", () => {
    const h = hashPin("246810");
    expect(verifyPin("246810", h)).toBe(true);
  });
  it("PIN salah ditolak", () => {
    const h = hashPin("246810");
    expect(verifyPin("000000", h)).toBe(false);
  });
  it("hash berbeda tiap kali (salt acak)", () => {
    expect(hashPin("111111")).not.toBe(hashPin("111111"));
  });
  it("stored null ditolak", () => {
    expect(verifyPin("111111", null)).toBe(false);
  });
});

describe("parseToken", () => {
  it("token ngawur ditolak", () => {
    expect(parseToken("bukan.token.valid")).toBeNull();
    expect(parseToken(undefined)).toBeNull();
    expect(parseToken("")).toBeNull();
  });
});
