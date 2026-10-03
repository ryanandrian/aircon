-- FASE 6 (bagian G5): ReviewRequest dibuat tepat 1× per pekerjaan pada penyelesaian.
-- Alasan: closeWorkSession kini membuat ReviewRequest di dalam transaksi yang sama; tanpa
-- unique, klik ganda/interaksi paralel bisa menggandakan permintaan ulasan.
-- Bukti data (read-only 2026-10-03): 10 baris, 10 kombinasi (tenantId,jobId) — nol duplikat,
-- jadi constraint ini bersifat formalisasi fakta, bukan perbaikan data.
CREATE UNIQUE INDEX "ReviewRequest_tenantId_jobId_key"
  ON "ReviewRequest"("tenantId", "jobId");
