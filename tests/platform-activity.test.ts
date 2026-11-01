import { describe, it, expect } from "vitest";
import {
  ACTIVITY_LEVEL_OPTIONS,
  ACTIVITY_PERIOD_OPTIONS,
} from "../src/lib/services/platform-activity-service";
import {
  activityLabel,
  activityLevel,
  activitySummary,
  type ActivityInput,
} from "../src/lib/services/platform-activity";

const zero: ActivityInput = { jobs: 0, jobsCompleted: 0, customers: 0, invoices: 0 };

describe("klasifikasi aktivitas tenant (deskriptif, tanpa threshold kinerja)", () => {
  it("ada satu atau lebih job → JOBS", () => {
    expect(activityLevel({ ...zero, jobs: 1 })).toBe("JOBS");
    expect(activityLevel({ ...zero, jobs: 30 })).toBe("JOBS");
  });

  it("tanpa job tetapi ada aktivitas lain → OTHER", () => {
    expect(activityLevel({ ...zero, customers: 2 })).toBe("OTHER");
    expect(activityLevel({ ...zero, invoices: 1 })).toBe("OTHER");
    expect(activityLevel({ ...zero, jobsCompleted: 1 })).toBe("OTHER");
  });

  it("semua sinyal nol → NONE", () => {
    expect(activityLevel(zero)).toBe("NONE");
  });

  it("label tidak menyatakan ranking tanpa dasar", () => {
    expect(activityLabel("JOBS")).toBe("Ada pekerjaan");
    expect(activityLabel("OTHER")).toBe("Aktivitas lain");
    expect(activityLabel("NONE")).toBe("Belum tercatat");
  });
});

describe("activitySummary", () => {
  it("merangkum semua angka > 0 dengan label eksplisit", () => {
    expect(activitySummary({ jobs: 2, jobsCompleted: 1, customers: 3, invoices: 2 })).toBe(
      "2 pekerjaan dibuat · 1 selesai · 3 pelanggan baru · 2 invoice terbit",
    );
  });

  it("menghilangkan sinyal bernilai nol", () => {
    expect(activitySummary({ jobs: 4, jobsCompleted: 0, customers: 0, invoices: 0 })).toBe(
      "4 pekerjaan dibuat",
    );
  });

  it("menyebut kosong sebagai tidak tercatat, bukan dormant", () => {
    expect(activitySummary(zero)).toBe("Tidak ada sinyal aktivitas tercatat");
  });
});

describe("opsi filter laporan (harus lengkap & konsisten)", () => {
  it("3 opsi periode (7/30/90 hari)", () => {
    expect(ACTIVITY_PERIOD_OPTIONS.map((o) => o.value)).toEqual(["7d", "30d", "90d"]);
    expect(ACTIVITY_PERIOD_OPTIONS.every((o) => o.label.length > 0)).toBe(true);
  });

  it("3 opsi status aktivitas, label unique & sinkron dengan activityLabel", () => {
    expect(ACTIVITY_LEVEL_OPTIONS.map((o) => o.value)).toEqual(["JOBS", "OTHER", "NONE"]);
    const labels = ACTIVITY_LEVEL_OPTIONS.map((o) => o.label);
    expect(new Set(labels).size).toBe(labels.length);
    for (const o of ACTIVITY_LEVEL_OPTIONS) {
      expect(o.label).toBe(activityLabel(o.value));
    }
  });
});
