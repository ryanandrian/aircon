import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: null as { email: string | null; phone: string | null } | null,
  user: null as any,
  tenant: null as any,
}));

vi.mock("@/lib/auth/auth-identity", () => ({
  getAuthIdentity: vi.fn(async () => mocks.identity),
}));
vi.mock("@/lib/auth/tech-session", () => ({
  getTechSessionUserId: vi.fn(async () => null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn(async () => mocks.user) },
    tenant: { findUnique: vi.fn(async () => mocks.tenant) },
  },
}));

import { getBillingRecoveryContext, getServerContext } from "../src/lib/auth/context";
import { AuthError } from "../src/lib/auth/guard";

const owner = {
  id: "u1", tenantId: "t1", role: "OWNER", name: "Pemilik", email: "owner@example.test",
};

beforeEach(() => {
  mocks.identity = { email: "owner@example.test", phone: null };
  mocks.user = owner;
  mocks.tenant = { status: "SUSPENDED" };
});

describe("billing recovery context", () => {
  it("SUSPENDED dapat resolve recovery context, tetapi tetap ditolak getServerContext", async () => {
    const recovery = await getBillingRecoveryContext();
    expect(recovery).toMatchObject({ tenantId: "t1", role: "OWNER", tenantStatus: "SUSPENDED" });

    await expect(getServerContext()).rejects.toMatchObject({
      code: "FORBIDDEN", reason: "TENANT_BLOCKED", tenantStatus: "SUSPENDED",
    });
  });

  it("CANCELLED dapat resolve konteks agar halaman bisa menampilkan pesan Kontak", async () => {
    mocks.tenant = { status: "CANCELLED" };
    await expect(getBillingRecoveryContext()).resolves.toMatchObject({ tenantStatus: "CANCELLED" });
    await expect(getServerContext()).rejects.toMatchObject({ tenantStatus: "CANCELLED" });
  });

  it("tenant usable mendapat recovery context seperti biasa", async () => {
    mocks.tenant = { status: "ACTIVE" };
    await expect(getBillingRecoveryContext()).resolves.toMatchObject({ tenantStatus: "ACTIVE" });
  });

  it("tanpa user → AuthError NO_SESSION; tanpa tenant → FORBIDDEN", async () => {
    mocks.user = null;
    await expect(getBillingRecoveryContext()).rejects.toMatchObject({
      code: "UNAUTHORIZED", reason: "NO_SESSION",
    });

    mocks.user = owner;
    mocks.tenant = null;
    await expect(getBillingRecoveryContext()).rejects.toBeInstanceOf(AuthError);
  });
});
