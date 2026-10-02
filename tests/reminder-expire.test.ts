import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FASE 5.3 — auto-EXPIRED sesuai spec BuildSpecPack_Part3 baris 37:
 * "bila lewat due + 14 hari tanpa aksi -> status EXPIRED | jaga daftar tetap bersih".
 *
 * Semantik yang DIKUNCI di sini (keputusan berbasis kode, bukan asumsi):
 * - EXPIRED hanya utk reminder status SENT (sudah terkirim; "aksi" tenant =
 *   konversi/tutup via inbox). Lewat dueDate + reminderExpireDays (14) = EXPIRED.
 * - Reminder QUEUED TIDAK di-expire otomatis: kalau di-expire, pengingat yang
 *   belum pernah terkirim (mis. cron sempat mati) hilang permanen tanpa pernah
 *   sampai ke pelanggan — anti-duplikat unique(tenant,asset,dueDate) mencegah
 *   pembuatan ulang. QUEUED tetap ditampilkan agar tak pernah lenyap diam-diam.
 */

const store: { reminders: any[] } = { reminders: [] };

vi.mock("@/lib/prisma", () => ({
  prisma: {
    repeatReminder: {
      // Meniru semantik Prisma updateMany: semua where harus cocok.
      updateMany: vi.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const r of store.reminders) {
          const statusOk = (where.status?.in ?? [where.status]).includes(r.status);
          const dueOk = where.dueDate?.lt ? r.dueDate < where.dueDate.lt : true;
          if (statusOk && dueOk) { Object.assign(r, data); count++; }
        }
        return { count };
      }),
      findMany: vi.fn(async ({ where }: any) =>
        store.reminders.filter((r) => r.tenantId === where.tenantId && where.status.in.includes(r.status)),
      ),
    },

  },
}));

import { expireDueReminders } from "../src/lib/services/reminder-service";
import { REPEAT_DEFAULTS } from "../src/lib/domain/money-loop";

const day = 86_400_000;

beforeEach(() => {
  store.reminders = [];
});

function rem(id: string, status: string, dueDaysAgo: number) {
  return { id, tenantId: "t1", status, dueDate: new Date(Date.now() - dueDaysAgo * day), jobId: null };
}

describe("expireDueReminders (BuildSpecPack P3 baris 37)", () => {
  it("SENT lewat due + 14 hari -> EXPIRED", async () => {
    store.reminders = [rem("r1", "SENT", 15)];
    const n = await expireDueReminders();
    expect(n).toBe(1);
    expect(store.reminders[0].status).toBe("EXPIRED");
  });

  it("SENT tepat 13 hari lewat due -> masih SENT (belum lewat 14)", async () => {
    store.reminders = [rem("r1", "SENT", 13)];
    await expireDueReminders();
    expect(store.reminders[0].status).toBe("SENT");
  });

  it("QUEUED lewat due + 14 hari TIDAK di-expire (belum pernah terkirim — jangan hilang)", async () => {
    store.reminders = [rem("r1", "QUEUED", 30)];
    await expireDueReminders();
    expect(store.reminders[0].status).toBe("QUEUED");
  });

  it("reminder CONVERTED/DISMISSED tidak disentuh", async () => {
    store.reminders = [rem("r1", "CONVERTED", 30), rem("r2", "DISMISSED", 30)];
    const n = await expireDueReminders();
    expect(n).toBe(0);
    expect(store.reminders[0].status).toBe("CONVERTED");
    expect(store.reminders[1].status).toBe("DISMISSED");
  });

  it("batas hari diambil dari REPEAT_DEFAULTS.reminderExpireDays (14), bukan angka lekat di kode expire", () => {
    expect(REPEAT_DEFAULTS.reminderExpireDays).toBe(14);
  });
});
