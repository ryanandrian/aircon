import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(),
  txUpdateMany: vi.fn(), txFindFirst: vi.fn(), txCustomerCreate: vi.fn(),
}));

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    lead: { findMany: mocks.findMany, findFirst: mocks.findFirst, create: mocks.create },
    $transaction: async (fn: (tx: unknown) => unknown) => fn({
      customer: { create: mocks.txCustomerCreate },
      lead: { updateMany: mocks.txUpdateMany, findFirst: mocks.txFindFirst },
    }),
  },
}));

import { createLeadFromBooking, listLeads, convertLeadToCustomer } from "../src/lib/services/lead-service";

describe("lead-service tenant isolation", () => {
  it("creates website lead with tenant scope", async () => {
    mocks.create.mockResolvedValue({ id: "lead-1", tenantId: "tenant-a" });
    await createLeadFromBooking("tenant-a", { name: "Budi", phone: "62812", serviceType: "CLEANING", note: "Pagi", preferredDate: "2026-09-21" });
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tenantId: "tenant-a", source: "WEBSITE", status: "NEW" }) }));
  });

  it("lists only the requested tenant", async () => {
    mocks.findMany.mockResolvedValue([]);
    await listLeads("tenant-a");
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: "tenant-a" } }));
  });

  it("conversion looks up lead with tenant scope and creates customer", async () => {
    mocks.findFirst.mockResolvedValue({ id: "lead-1", tenantId: "tenant-a", name: "Budi", phone: "62812", notes: null, convertedCustomerId: null });
    mocks.txCustomerCreate.mockResolvedValue({ id: "customer-1", tenantId: "tenant-a" });
    mocks.txUpdateMany.mockResolvedValue({ count: 1 });
    mocks.txFindFirst.mockResolvedValue({ id: "lead-1", status: "WON" });
    const result = await convertLeadToCustomer("tenant-a", "lead-1");
    expect(mocks.findFirst).toHaveBeenCalledWith({ where: { id: "lead-1", tenantId: "tenant-a" } });
    expect(result.customer.id).toBe("customer-1");
  });
});
