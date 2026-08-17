import { describe, it, expect } from "vitest";
import { assertRole, canAccessTenant, AuthError } from "../src/lib/auth/guard";

describe("RBAC guard", () => {
  it("mengizinkan role yang cocok", () => {
    expect(() => assertRole("OWNER", ["OWNER", "ADMIN"])).not.toThrow();
  });
  it("menolak role yang tidak diizinkan dengan AuthError FORBIDDEN", () => {
    try {
      assertRole("TECHNICIAN", ["OWNER", "ADMIN"]);
      throw new Error("seharusnya throw");
    } catch (e) {
      expect(e).toBeInstanceOf(AuthError);
      expect((e as AuthError).code).toBe("FORBIDDEN");
    }
  });
  it("menolak akses lintas-tenant", () => {
    expect(canAccessTenant("tenant-A", "tenant-A")).toBe(true);
    expect(canAccessTenant("tenant-A", "tenant-B")).toBe(false);
  });
});
