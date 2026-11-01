import { describe, it, expect } from "vitest";
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
