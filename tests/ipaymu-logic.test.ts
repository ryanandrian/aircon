import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { mapIpaymuStatus, mapIpaymuStatusCode } from "../src/lib/billing/ipaymu-logic";

describe("iPaymu status mapping (pure)", () => {
  it("maps callback status", () => {
    expect(mapIpaymuStatus("berhasil")).toBe("PAID");
    expect(mapIpaymuStatus("pending")).toBe("PENDING");
    expect(mapIpaymuStatus("expired")).toBe("EXPIRED");
    expect(mapIpaymuStatus("unknown")).toBe("PENDING");
  });

  it("maps callback status codes", () => {
    expect(mapIpaymuStatusCode(1)).toBe("PAID");
    expect(mapIpaymuStatusCode(0)).toBe("PENDING");
    expect(mapIpaymuStatusCode(-2)).toBe("EXPIRED");
    expect(mapIpaymuStatusCode(99)).toBe("PENDING");
  });
});

describe("iPaymu callback signature pattern", () => {
  it("hashes alphabetically sorted callback keys", () => {
    const body: Record<string, string> = {
      reference_id: "TEST123",
      status: "berhasil",
      status_code: "1",
      amount: "100000",
    };
    const sorted: Record<string, string> = {};
    Object.keys(body).sort().forEach((key) => { sorted[key] = body[key]; });
    const hash = crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
    expect(hash).toHaveLength(64);
    expect(Object.keys(sorted)).toEqual(["amount", "reference_id", "status", "status_code"]);
  });
});
