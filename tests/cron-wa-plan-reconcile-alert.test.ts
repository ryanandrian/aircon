import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
const { reconcile, alert } = vi.hoisted(() => ({
  reconcile: vi.fn(),
  alert: vi.fn(async () => ({ audited: true, emailed: 0, problems: [] })),
}));
vi.mock("@/lib/services/wa-identity-service", () => ({ reconcileWaPlanSessions: reconcile }));
vi.mock("@/lib/services/job-alert-service", () => ({ alertJobFailure: alert }));

import { GET, POST } from "../src/app/api/cron/wa-plan-reconcile/route";

function req(method: "GET" | "POST", auth = "Bearer test-secret") {
  return new Request("http://localhost/api/cron/wa-plan-reconcile", {
    method,
    headers: { authorization: auth },
  }) as never;
}

describe("cron wa-plan-reconcile alert + safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    alert.mockResolvedValue({ audited: true, emailed: 0, problems: [] });
  });

  it("unauthorized → 401, service/alert tidak dipanggil", async () => {
    const res = await GET(req("GET", "Bearer wrong"));
    expect(res.status).toBe(401);
    expect(reconcile).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  });

  it("failed per-tenant >0 → audit/email alert, status tetap 200 dengan hasil", async () => {
    reconcile.mockResolvedValue({ checked: 5, revoked: 0, numbersCleared: 0, failed: 2 });
    const res = await POST(req("POST"));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: false, failed: 2 });
    expect(alert).toHaveBeenCalledWith({
      job: "wa-plan-reconcile",
      error: "Rekonsiliasi sebagian gagal untuk 2 tenant.",
      details: { checked: 5, revoked: 0, numbersCleared: 0, failed: 2 },
    });
  });

  it("uncaught service exception → alert, HTTP 500 tetap", async () => {
    reconcile.mockRejectedValue(new Error("gateway unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(req("GET"));
    expect(res.status).toBe(500);
    expect(alert).toHaveBeenCalledWith({
      job: "wa-plan-reconcile",
      error: "gateway unavailable",
    });
    vi.restoreAllMocks();
  });

  it("alert sendiri gagal → endpoint tetap memberi hasil/500 aslinya", async () => {
    reconcile.mockRejectedValue(new Error("db down"));
    alert.mockRejectedValueOnce(new Error("smtp/audit down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req("POST"));
    expect(res.status).toBe(500);
    vi.restoreAllMocks();
  });

  it("sukses tanpa failure → tidak kirim alert", async () => {
    reconcile.mockResolvedValue({ checked: 5, revoked: 0, numbersCleared: 0, failed: 0 });
    const res = await GET(req("GET"));
    expect(res.status).toBe(200);
    expect(alert).not.toHaveBeenCalled();
  });
});
