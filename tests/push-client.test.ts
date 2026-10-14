import { describe, it, expect } from "vitest";

// G-A4 — helper murni klien push (src/lib/push-client.ts).
// Environment = node; helper sengaja dibuat murni (window hanya di dalam fungsi)
// supaya perilaku terkunci tanpa DOM/jsdom.

import {
  urlBase64ToUint8Array,
  subscriptionToInput,
  pushStatusLabel,
} from "@/lib/push-client";

// Base64url valid utk VAPID publik dites via kasus konkret di bawah.

describe("urlBase64ToUint8Array", () => {
  it("mengubah base64url (dgn - dan _) menjadi byte benar", () => {
    // "SGVsbG8=" = "Hello"
    const out = urlBase64ToUint8Array("SGVsbG8");
    expect(new TextDecoder().decode(out)).toBe("Hello");
  });

  it("menangani pemetaan - → + dan _ → /", () => {
    // Bukti pemetaan: base64url DAN base64 standar dgn padding yang identik
    // nilainya → HARUS menghasilkan byte sama persis.
    const b64url = "Pz8-Pz8_Pz8";
    const standard = "Pz8+Pz8/Pz8=";
    const fromUrl = urlBase64ToUint8Array(b64url);
    const fromStandard = urlBase64ToUint8Array(standard);
    expect(fromUrl.length).toBe(fromStandard.length);
    expect([...fromUrl]).toEqual([...fromStandard]);
    expect(fromUrl.length).toBe(8);
  });

  it("panjang tidak kelipatan 4 (padding otomatis)", () => {
    const out = urlBase64ToUint8Array("SGVsbG8"); // 8 char → ok
    expect(out.length).toBeGreaterThan(0);
    const out2 = urlBase64ToUint8Array("SGVsbG9Xb3JsZA"); // 14 char
    expect(new TextDecoder().decode(out2)).toBe("HelloWorld");
  });
});

describe("subscriptionToInput", () => {
  it("menerima subscription valid (https + key panjang)", () => {
    const r = subscriptionToInput({
      endpoint: "https://fcm.googleapis.com/wp/x",
      keys: { p256dh: "x".repeat(80), auth: "y".repeat(30) },
    });
    expect(r).not.toBeNull();
    expect(r?.endpoint).toBe("https://fcm.googleapis.com/wp/x");
  });

  it("menolak endpoint non-https", () => {
    expect(subscriptionToInput({ endpoint: "http://x", keys: { p256dh: "x".repeat(80), auth: "y".repeat(30) } })).toBeNull();
    expect(subscriptionToInput({ endpoint: "", keys: { p256dh: "x".repeat(80), auth: "y".repeat(30) } })).toBeNull();
  });

  it("menolak key pendek / hilang", () => {
    expect(subscriptionToInput({ endpoint: "https://x", keys: { p256dh: "short", auth: "y".repeat(30) } })).toBeNull();
    expect(subscriptionToInput({ endpoint: "https://x", keys: { p256dh: "x".repeat(80), auth: "sh" } })).toBeNull();
    expect(subscriptionToInput({ endpoint: "https://x", keys: null })).toBeNull();
  });
});

describe("pushStatusLabel (label jujur)", () => {
  const base = { notificationSupported: true, permission: "default" as NotificationPermission, subscriptionActive: false, serverVapidAvailable: true };

  it("VAPID server belum diset → server-disabled (paling dominan)", () => {
    expect(pushStatusLabel({ ...base, serverVapidAvailable: false })).toBe("server-disabled");
  });

  it("perangkat tanpa Notification API → not-supported", () => {
    expect(pushStatusLabel({ ...base, notificationSupported: false })).toBe("not-supported");
  });

  it("izin diblokir → permission-denied", () => {
    expect(pushStatusLabel({ ...base, permission: "denied" })).toBe("permission-denied");
  });

  it("subscription aktif → active", () => {
    expect(pushStatusLabel({ ...base, subscriptionActive: true })).toBe("active");
  });

  it("default → inactive (tombol aktifkan ditampilkan)", () => {
    expect(pushStatusLabel(base)).toBe("inactive");
  });

  it("permission granted tapi belum subscribe → inactive (bukan active palsu)", () => {
    expect(pushStatusLabel({ ...base, permission: "granted" })).toBe("inactive");
  });
});
