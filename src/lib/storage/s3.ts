/**
 * S3-compatible object storage (foto bukti pekerjaan seluruh tenant).
 * ENV-DRIVEN — jalan dengan BiznetGio S3, AWS S3, Cloudflare R2, MinIO:
 *   S3_ENDPOINT        (mis. https://s3.biznetgio.com atau https://s3.nevacloud.id)
 *   S3_REGION          (mis. id-jkt-1 / us-east-1)
 *   S3_BUCKET
 *   S3_ACCESS_KEY_ID
 *   S3_SECRET_ACCESS_KEY
 *   S3_PUBLIC_BASE_URL (opsional; base URL publik/CDN. Default: {endpoint}/{bucket})
 *   S3_FORCE_PATH_STYLE (opsional "true" — wajib utk MinIO/beberapa provider)
 *
 * Server-only. Upload via presigned PUT (browser upload langsung, hemat egress server).
 * Key foto SELALU diawali tenantId → isolasi antar-tenant di level path.
 */
import "server-only";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ENDPOINT = process.env.S3_ENDPOINT ?? "";
const REGION = process.env.S3_REGION ?? "us-east-1";
const BUCKET = process.env.S3_BUCKET ?? "";
const ACCESS_KEY = process.env.S3_ACCESS_KEY_ID ?? "";
const SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY ?? "";
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL ?? "";
const FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE === "true";

export function isStorageConfigured(): boolean {
  return Boolean(ENDPOINT && BUCKET && ACCESS_KEY && SECRET_KEY);
}

let _client: S3Client | null = null;
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: ENDPOINT,
      region: REGION,
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      forcePathStyle: FORCE_PATH_STYLE,
    });
  }
  return _client;
}

/** URL publik untuk sebuah key. */
export function publicUrl(key: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE.replace(/\/+$/, "")}/${key}`;
  const base = `${ENDPOINT.replace(/\/+$/, "")}/${BUCKET}`;
  return `${base}/${key}`;
}

/**
 * Verifikasi URL foto benar-benar berada di folder S3 milik tenant+job ini.
 * Mencegah teknisi menyimpan URL eksternal/tenant lain sebagai bukti.
 */
export function isOwnedPhotoUrl(tenantId: string, jobId: string, url: string): boolean {
  if (!isStorageConfigured()) return false;
  const prefix = publicUrl(`jobs/${tenantId}/${jobId}/`);
  return url.startsWith(prefix);
}

/** Sanitasi ekstensi file (whitelist gambar). */
function safeExt(filename: string): string {
  const ext = (filename.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
}

const ALLOWED_CT = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Buat presigned PUT URL untuk upload foto bukti.
 * SECURITY: key diawali `jobs/{tenantId}/{jobId}/` → tenant tak bisa menulis ke folder tenant lain.
 * @returns { uploadUrl, publicUrl, key }
 */
export async function createPhotoUploadUrl(params: {
  tenantId: string;
  jobId: string;
  kind: "before" | "after" | "general";
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!isStorageConfigured()) throw new Error("S3 storage belum dikonfigurasi");
  if (!ALLOWED_CT.has(params.contentType)) throw new Error("Tipe file harus JPG/PNG/WebP");

  const ext = safeExt(params.filename);
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `jobs/${params.tenantId}/${params.jobId}/${params.kind}-${rand}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: params.contentType,
    ACL: "public-read",
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 300 });
  return { uploadUrl, publicUrl: publicUrl(key), key };
}

/** Hapus objek (mis. saat foto salah). */
export async function deleteObject(key: string): Promise<void> {
  if (!isStorageConfigured()) return;
  await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Presigned PUT untuk aset publik (landing: logo, hero, OG, foto testimoni).
 * Bukan tenant-scoped — hanya dipanggil dari admin platform (guarded di server action).
 */
export async function createAssetUploadUrl(params: {
  scope: string; // mis. "landing" | "testimonial"
  filename: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!isStorageConfigured()) throw new Error("S3 storage belum dikonfigurasi");
  if (!ALLOWED_CT.has(params.contentType)) throw new Error("Tipe file harus JPG/PNG/WebP");

  const ext = safeExt(params.filename);
  const safeScope = params.scope.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || "asset";
  const rand = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const key = `assets/${safeScope}/${rand}.${ext}`;

  const cmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: params.contentType,
    ACL: "public-read",
  });
  const uploadUrl = await getSignedUrl(client(), cmd, { expiresIn: 300 });
  return { uploadUrl, publicUrl: publicUrl(key), key };
}
