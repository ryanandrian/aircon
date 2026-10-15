import { describe, it, expect, vi, beforeEach } from "vitest";

// F9f/D2 — K17 kas teknisi (uji service EXISTING ar-service, no new code path).
//
// Kontrak pemilik: kas teknisi = invoice INVOICE, PAID, payMethod CASH,
// cashRemitStatus HELD_BY_TECH; admin REMITTED mengeluarkannya dari daftar.
// TRANSFER/QRIS tidak boleh muncul sebagai kas fisik teknisi.

vi.mock("@/lib/prisma", () => {
  const state = {
    invoices: [] as any[],
    users: [] as any[],
    updateManyResult: { count: 0 },
    updateManyArgs: null as any,
  };
  return {
    __state: state,
    prisma: {
      invoice: {
        findMany: vi.fn(async ({ where }: any) =>
          state.invoices.filter((i) =>
            (!where?.tenantId || i.tenantId === where.tenantId) &&
            (!where?.docType || i.docType === where.docType) &&
            (!where?.status || i.status === where.status) &&
            (!where?.payMethod || i.payMethod === where.payMethod) &&
            (!where?.cashRemitStatus || i.cashRemitStatus === where.cashRemitStatus))),
        updateMany: vi.fn(async (args: any) => {
          state.updateManyArgs = args;
          return state.updateManyResult;
        }),
      },
      user: { findMany: vi.fn(async ({ where }: any) => state.users.filter((u) => where.id.in.includes(u.id))) },
    },
  };
});

import * as prismaModule from "@/lib/prisma";
import { getUnremittedCashByTech, markCashRemitted } from "@/lib/services/ar-service";

const state = (prismaModule as any).__state;

beforeEach(() => {
  vi.clearAllMocks();
  state.invoices = [
    { id: "cash-held", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-CASH", total: 50000 },
    { id: "cash-remitted", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "REMITTED", createdById: "tech-1", number: "INV-REM", total: 10000 },
    { id: "transfer-stale", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "TRANSFER", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-TR", total: 70000 },
    { id: "qris-stale", tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "QRIS", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-Q", total: 80000 },
    { id: "unpaid-cash", tenantId: "t1", docType: "INVOICE", status: "ISSUED", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "INV-U", total: 90000 },
    { id: "proforma", tenantId: "t1", docType: "PROFORMA", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-1", number: "PRO-1", total: 30000 },
    { id: "other-tenant", tenantId: "t2", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH", createdById: "tech-2", number: "INV-OTHER", total: 40000 },
  ];
  state.users = [{ id: "tech-1", name: "Ryan" }];
  state.updateManyResult = { count: 1 };
  state.updateManyArgs = null;
});

describe("F9f — getUnremittedCashByTech (K17)", () => {
  it("hanya PAID+CASH+HELD_BY_TECH INVOICE tenant itu dihitung — TRANSFER/QRIS tak pernah tampil", async () => {
    const r = await getUnremittedCashByTech("t1");
    expect(r).toEqual([{ techId: "tech-1", techName: "Ryan", total: 50000, count: 1, invoiceIds: ["cash-held"] }]);
  });

  it("query K17 punya filter tenant+INVOICE+PAID+CASH+HELD_BY_TECH (guard di DB query)", async () => {
    await getUnremittedCashByTech("t1");
    const q = vi.mocked(prismaModule.prisma.invoice.findMany).mock.calls[0][0] as any;
    expect(q.where).toMatchObject({ tenantId: "t1", docType: "INVOICE", status: "PAID", payMethod: "CASH", cashRemitStatus: "HELD_BY_TECH" });
  });
});

describe("F9f — markCashRemitted (K17)", () => {
  it("ditandai REMITTED hanya row invoice PAID+HELD_BY_TECH dalam tenant", async () => {
    const n = await markCashRemitted("t1", ["cash-held", "transfer-stale"]);
    expect(n).toBe(1);
    const q = state.updateManyArgs.where;
    expect(q).toMatchObject({ tenantId: "t1", id: { in: ["cash-held", "transfer-stale"] }, docType: "INVOICE", status: "PAID", cashRemitStatus: "HELD_BY_TECH" });
    expect(state.updateManyArgs.data).toEqual({ cashRemitStatus: "REMITTED" });
  });

  it("input kosong → tak membuat query update", async () => {
    const n = await markCashRemitted("t1", []);
    expect(n).toBe(0);
    expect(prismaModule.prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});
