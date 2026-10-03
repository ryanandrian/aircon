import { describe, it, expect, vi, beforeEach } from "vitest";

const store: any = {};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    technician: { findFirst: vi.fn(async () => store.me) },
    jobOrder: { findFirst: vi.fn(async () => store.job) },
    jobAssignment: { findFirst: vi.fn(async () => store.assignment) },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/tech-session", () => ({ clearTechSession: vi.fn() }));
vi.mock("@/lib/auth/context", () => ({ getServerContext: vi.fn(async () => store.ctx) }));
vi.mock("@/lib/storage/s3", () => ({ isStorageConfigured: () => true, putPhoto: vi.fn(async () => ({ publicUrl: "https://s3.test/photo.jpg" })) }));
vi.mock("@/lib/services/job-work-service", () => ({
  addJobPhoto: vi.fn(async () => ({})),
  assertCanOperateOnJob: vi.fn(async () => undefined),
}));

import { techUploadPhoto } from "../src/app/t/actions";

function uploadFile(type = "image/jpeg", size = 4) {
  const file = new File([new Uint8Array(size)], "test.jpg", { type });
  const fd = new FormData();
  fd.set("file", file);
  return fd;
}

describe("techUploadPhoto — upload file dari teknisi/kernet ke S3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.ctx = { tenantId: "t1", userId: "u1", role: "TECHNICIAN" };
    store.me = { id: "kernet1", position: "KERNET" };
    store.job = { id: "job1", technicianId: "techLead" };
    store.assignment = { id: "as1", personId: "kernet1", roleOnJob: "KERNET" };
  });

  it("kernet assigned job lolos izin, foto diunggah & dicatat", async () => {
    const result = await techUploadPhoto("job1", "after", uploadFile());
    expect(result).toEqual({ ok: true, publicUrl: "https://s3.test/photo.jpg" });
    const { assertCanOperateOnJob, addJobPhoto } = await import("../src/lib/services/job-work-service");
    expect(assertCanOperateOnJob).toHaveBeenCalledWith("t1", "kernet1", "job1");
    expect(addJobPhoto).toHaveBeenCalledWith("t1", "job1", "after", "https://s3.test/photo.jpg");
  });

  it("menolak sebelum upload bila izin job ditolak (bukan anggota job)", async () => {
    const { assertCanOperateOnJob } = await import("../src/lib/services/job-work-service");
    const { JobError } = await import("../src/lib/services/job-management-service");
    vi.mocked(assertCanOperateOnJob).mockRejectedValueOnce(new JobError("FORBIDDEN", "Bukan tugas Anda"));
    const result = await techUploadPhoto("job1", "after", uploadFile());
    expect(result).toEqual({ ok: false, error: "Bukan tugas Anda" });
    const { putPhoto } = await import("@/lib/storage/s3");
    expect(putPhoto).not.toHaveBeenCalled();
  });

  it("menolak MIME non-gambar sebelum memanggil uploader", async () => {
    const result = await techUploadPhoto("job1", "after", uploadFile("application/pdf"));
    expect(result).toEqual({ ok: false, error: "File harus JPG, PNG, atau WebP" });
    const { putPhoto } = await import("@/lib/storage/s3");
    expect(putPhoto).not.toHaveBeenCalled();
  });
});
