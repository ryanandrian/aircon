/**
 * URL builder untuk fitur unit/kartu. No-hardcode: baca env, fallback app URL prod.
 */
export function appBaseUrl(): string {
  return (
    process.env.UNIT_CODE_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://aircon-peach.vercel.app"
  ).replace(/\/$/, "");
}

/** URL kartu perawatan pelanggan (statis-permanen). */
export function customerCardUrl(token: string): string {
  return `${appBaseUrl()}/riwayat/${token}`;
}

/** URL publik unit per kode QR. */
export function unitCodeUrl(code: string): string {
  return `${appBaseUrl()}/u/${code}`;
}
