/**
 * Push client helpers — murni (tanpa window saat import; akses window hanya
 * di dalam fungsi). Dipakai komponen client /t (push-permission.tsx).
 * World-class: semua logika yang BISA diuji dipisah dari React component
 * (environment vitest = node; test murni mengunci perilaku).
 */

/** Base64url (VAPID publik) → Uint8Array utk applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

const DEVICE_ID_KEY = "aircon-push-device";

/**
 * ID perangkat stabil utk subscription (unique tenantId+userId+deviceId).
 * localStorage → idempoten; crypto.randomUUID utk pembuatan awal.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const fresh =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `d-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, fresh);
  return fresh;
}

/** Konversi PushSubscriptionJSON (endpoint+keys) ke bentuk input service. */
export function subscriptionToInput(sub: {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string } | null;
}): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  if (!sub.endpoint?.startsWith("https://")) return null;
  const p256dh = sub.keys?.p256dh ?? "";
  const auth = sub.keys?.auth ?? "";
  if (p256dh.length < 20 || auth.length < 10) return null;
  return { endpoint: sub.endpoint, keys: { p256dh, auth } };
}

/** Label status jujur utk ditampilkan (nol emoji-asli, teks Indonesia). */
export type PushStatusLabel =
  | "not-supported"
  | "permission-denied"
  | "active"
  | "inactive"
  | "server-disabled"
  | "checking";

export function pushStatusLabel(input: {
  notificationSupported: boolean;
  permission: NotificationPermission | "unavailable";
  subscriptionActive: boolean;
  serverVapidAvailable: boolean;
}): PushStatusLabel {
  if (!input.serverVapidAvailable) return "server-disabled";
  if (!input.notificationSupported) return "not-supported";
  if (input.permission === "denied") return "permission-denied";
  if (input.subscriptionActive) return "active";
  return "inactive";
}
