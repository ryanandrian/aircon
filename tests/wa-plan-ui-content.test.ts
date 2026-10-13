import { describe, it, expect } from "vitest";

// A2 — perubahan konten bantuan bersifat teks murni: kunci perilaku, tanpa jsdom.
// Basic/TRIAL tidak boleh diajari menghubungkan otomasi; topik `wa-connect`
// tetap benar untuk plan berbayar yang masih punya hak koneksi gateway.
import { getHelpTopic } from "@/lib/help/help-content";
import { planQuotaLines } from "@/lib/billing/plan-display";

describe("A2 — Bantuan & pesan fitur paket otomatis WA", () => {
  it("topik pengaturan tidak lagi memerintahkan semua tenant menghubungkan WA", () => {
    const topic = getHelpTopic("pengaturan");
    expect(topic).not.toBeNull();
    expect(topic!.steps.join(" ")).not.toMatch(/gunakan ['\"]Hubungkan WhatsApp['\"]/i);
    expect(topic!.whatIsIt).not.toMatch(/Atur identitas usaha dan koneksi WhatsApp/i);
  });

  it("topik wa-connect tetap lengkap untuk tenant yang memang berhak (QR + kode tautan)", () => {
    const topic = getHelpTopic("wa-connect");
    expect(topic).not.toBeNull();
    expect(topic!.whatIsIt).toMatch(/Ada dua cara: QR.*kode tautan/i);
    expect(topic!.steps.join(" ")).toContain("Hubungkan dengan QR");
    expect(topic!.steps.join(" ")).toContain("kode tautan (HP saja)");
  });

  it("plan display: autoReminder=false menjelaskan kirim manual, bukan gateway", () => {
    const lines = planQuotaLines({
      maxTechnicians: 2, maxAdmins: 0, maxCustomers: 5, maxAcUnits: 10,
      autoReminder: false,
    });
    const reminder = lines.find((x) => x.startsWith("Pengingat"));
    expect(reminder).toBe("Pengingat Jatuh Tempo Perawatan AC manual dikirim via Whatsapp kepada Pelanggan Anda");
    expect(reminder).not.toMatch(/gateway|otomatis terkirim/i);
  });

  it("plan display: autoReminder=true tetap menjanjikan otomatis (berbayar)", () => {
    const lines = planQuotaLines({
      maxTechnicians: 5, maxAdmins: 1, maxCustomers: 200, maxAcUnits: 500,
      autoReminder: true,
    });
    const reminder = lines.find((x) => x.startsWith("Pengingat"));
    expect(reminder).toMatch(/otomatis terkirim via Whatsapp/i);
  });
});
