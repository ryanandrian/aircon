import { describe, it, expect } from "vitest";
import { canTransition, findTransition } from "../src/lib/domain/job-state-machine";
import { evaluateFeasibility, estimateTravelMin } from "../src/lib/domain/feasibility";
import { computeNextServiceDate, isReminderDue } from "../src/lib/domain/money-loop";

describe("job state machine", () => {
  it("mengizinkan DRAFT->ASSIGNED oleh OWNER", () => {
    expect(canTransition("DRAFT", "ASSIGNED", "OWNER").ok).toBe(true);
  });
  it("menolak transisi ilegal DRAFT->COMPLETED", () => {
    expect(canTransition("DRAFT", "COMPLETED", "OWNER").ok).toBe(false);
  });
  it("COMPLETED hanya dari IN_PROGRESS", () => {
    expect(findTransition("IN_PROGRESS", "COMPLETED")).toBeTruthy();
    expect(findTransition("ARRIVED", "COMPLETED")).toBeUndefined();
  });
  it("teknisi tidak boleh assign job", () => {
    expect(canTransition("DRAFT", "ASSIGNED", "TECHNICIAN").ok).toBe(false);
  });
  it("completion memicu efek next_service_date + reminder", () => {
    const t = findTransition("IN_PROGRESS", "COMPLETED");
    expect(t?.effects).toContain("compute_next_service_date");
    expect(t?.effects).toContain("create_repeat_reminder");
  });
});

describe("feasibility", () => {
  it("FEASIBLE bila tidak ada job sebelumnya", () => {
    const r = evaluateFeasibility({
      windowStart: new Date("2026-01-01T09:00:00+07:00"),
      windowEnd: new Date("2026-01-01T11:00:00+07:00"),
      estDurationMin: 60,
    });
    expect(r.status).toBe("FEASIBLE");
  });
  it("UNKNOWN bila window kurang", () => {
    const r = evaluateFeasibility({ estDurationMin: 60 });
    expect(r.status).toBe("UNKNOWN");
    expect(r.missing.length).toBeGreaterThan(0);
  });
  it("CONFLICT bila skill tidak cocok", () => {
    const r = evaluateFeasibility({
      serviceType: "REFILL_FREON",
      techSkills: ["CLEANING"],
      windowStart: new Date(),
      windowEnd: new Date(),
    });
    expect(r.status).toBe("CONFLICT");
  });
  it("CONFLICT bila job sebelumnya terlalu jauh/mepet melewati window end", () => {
    const prevEnd = new Date("2026-01-01T09:00:00+07:00");
    const r = evaluateFeasibility({
      prevEndTime: prevEnd,
      prevLat: -6.2, prevLng: 106.8, // Jakarta
      lat: -7.8, lng: 110.4, // Yogyakarta (jauh)
      windowStart: new Date("2026-01-01T09:30:00+07:00"),
      windowEnd: new Date("2026-01-01T10:00:00+07:00"),
      estDurationMin: 60,
    });
    expect(r.status).toBe("CONFLICT");
  });
  it("travel estimate positif", () => {
    expect(estimateTravelMin(-6.2, 106.8, -6.3, 106.85)).toBeGreaterThan(0);
  });
});

describe("money loop", () => {
  it("next_service_date = completed + interval (asset override)", () => {
    const completed = new Date("2026-01-01T00:00:00Z");
    const next = computeNextServiceDate(completed, 30, 90);
    expect(next.toISOString().slice(0, 10)).toBe("2026-01-31");
  });
  it("pakai tenant default bila asset null", () => {
    const completed = new Date("2026-01-01T00:00:00Z");
    const next = computeNextServiceDate(completed, null, 90);
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
  it("reminder due saat lewat lead time", () => {
    const next = new Date();
    next.setDate(next.getDate() + 3); // due 3 hari lagi, lead 7 -> sudah due
    expect(isReminderDue(next, 7)).toBe(true);
  });
});
