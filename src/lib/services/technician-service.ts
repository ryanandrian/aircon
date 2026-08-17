/**
 * Technician Onboarding & Auth — undangan (invite-only) + login phone+PIN.
 * Owner mengundang teknisi → teknisi buka link → set PIN → akun aktif.
 * SECURITY: semua tenant-scoped; PIN di-hash scrypt; token invite acak & kedaluwarsa.
 */
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { hashPin, verifyPin, isValidPin } from "@/lib/auth/tech-crypto";
import { normalizePhone } from "@/lib/wa/gateway";

export { isValidPin };

export class TechAuthError extends Error {
  code: "NOT_FOUND" | "VALIDATION" | "EXPIRED" | "USED" | "INVALID_PIN" | "LOCKED";
  constructor(code: TechAuthError["code"], message: string) {
    super(message);
    this.name = "TechAuthError";
    this.code = code;
  }
}

const INVITE_TTL_DAYS = 14;

/**
 * Owner/Admin membuat undangan teknisi. Mengembalikan token untuk link undangan.
 * SECURITY: tenant-scoped; cek kuota teknisi di caller.
 */
export async function createInvite(params: {
  tenantId: string;
  createdById: string;
  name: string;
  phone: string;
}): Promise<{ token: string; inviteId: string }> {
  const phone = normalizePhone(params.phone);
  if (!params.name.trim()) throw new TechAuthError("VALIDATION", "Nama wajib diisi");
  if (phone.length < 9) throw new TechAuthError("VALIDATION", "Nomor HP tidak valid");

  // Tolak bila sudah ada user aktif dengan phone ini di tenant.
  const existing = await prisma.user.findFirst({
    where: { tenantId: params.tenantId, phone },
  });
  if (existing) throw new TechAuthError("VALIDATION", "Nomor HP ini sudah terdaftar");

  const token = crypto.randomBytes(24).toString("base64url");
  const invite = await prisma.invite.create({
    data: {
      tenantId: params.tenantId,
      role: "TECHNICIAN",
      name: params.name.trim(),
      phone,
      token,
      status: "PENDING",
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86400_000),
      createdById: params.createdById,
    },
  });
  return { token, inviteId: invite.id };
}

/** Ambil undangan valid by token (untuk halaman terima undangan). */
export async function getInviteByToken(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token } });
  if (!invite) throw new TechAuthError("NOT_FOUND", "Undangan tidak ditemukan");
  if (invite.status !== "PENDING") throw new TechAuthError("USED", "Undangan sudah dipakai / dibatalkan");
  if (invite.expiresAt < new Date()) throw new TechAuthError("EXPIRED", "Undangan sudah kedaluwarsa");
  return invite;
}

/**
 * Teknisi menerima undangan + menetapkan PIN.
 * Membuat User (role TECHNICIAN, ACTIVE) + Technician, tandai invite ACCEPTED.
 * Mengembalikan userId untuk pembuatan sesi.
 */
export async function acceptInvite(token: string, pin: string): Promise<{ userId: string; tenantId: string }> {
  if (!isValidPin(pin)) throw new TechAuthError("VALIDATION", "PIN harus 6 angka");
  const invite = await getInviteByToken(token);

  const result = await prisma.$transaction(async (tx) => {
    // KLAIM ATOMIK: tandai ACCEPTED hanya bila masih PENDING. 0 baris = sudah diklaim
    // proses lain (double-submit) → tolak, cegah duplikat User+Technician (fix TOCTOU).
    const claim = await tx.invite.updateMany({
      where: { id: invite.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    if (claim.count === 0) {
      throw new TechAuthError("USED", "Undangan sudah diproses. Silakan masuk dengan PIN Anda.");
    }

    // Guard tambahan: bila user dgn phone ini sudah ada (balapan), batalkan.
    const dup = await tx.user.findFirst({
      where: { tenantId: invite.tenantId, phone: invite.phone },
      select: { id: true },
    });
    if (dup) {
      throw new TechAuthError("USED", "Nomor HP ini sudah terdaftar.");
    }

    const user = await tx.user.create({
      data: {
        tenantId: invite.tenantId,
        name: invite.name,
        phone: invite.phone,
        role: "TECHNICIAN",
        authProvider: "PIN",
        pinHash: hashPin(pin),
        status: "ACTIVE",
      },
    });
    await tx.technician.create({
      data: { tenantId: invite.tenantId, userId: user.id, skills: [], active: true },
    });
    return { userId: user.id, tenantId: invite.tenantId };
  });
  return result;
}

/**
 * Login teknisi via phone+PIN. Mengembalikan userId bila cocok.
 * SECURITY: cari user PIN aktif by phone (lintas-tenant by phone unik global? phone unik per tenant).
 * Karena phone unik PER tenant, kita cari semua kandidat lalu cocokkan PIN.
 */
export async function loginTechnician(phone: string, pin: string): Promise<{ userId: string; tenantId: string }> {
  const norm = normalizePhone(phone);
  if (!isValidPin(pin)) throw new TechAuthError("INVALID_PIN", "PIN harus 6 angka");

  // Rate-limit brute-force: kunci 15 menit setelah 5 gagal beruntun.
  const MAX_FAILS = 5;
  const LOCK_MIN = 15;
  const throttle = await prisma.loginThrottle.findUnique({ where: { key: norm } });
  if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) {
    throw new TechAuthError("LOCKED", "Terlalu banyak percobaan. Coba lagi dalam beberapa menit.");
  }

  const candidates = await prisma.user.findMany({
    where: { phone: norm, role: "TECHNICIAN", authProvider: "PIN", status: "ACTIVE" },
    select: { id: true, tenantId: true, pinHash: true },
  });
  for (const c of candidates) {
    if (verifyPin(pin, c.pinHash)) {
      // sukses → reset throttle
      if (throttle) await prisma.loginThrottle.delete({ where: { key: norm } }).catch(() => {});
      return { userId: c.id, tenantId: c.tenantId };
    }
  }

  // gagal → catat & mungkin kunci
  const failed = (throttle?.failedCount ?? 0) + 1;
  await prisma.loginThrottle.upsert({
    where: { key: norm },
    create: {
      key: norm,
      failedCount: failed,
      lockedUntil: failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null,
    },
    update: {
      failedCount: failed,
      lockedUntil: failed >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : null,
    },
  });
  throw new TechAuthError("INVALID_PIN", "Nomor HP atau PIN salah");
}

/** Daftar teknisi + status undangan untuk owner. */
export async function listTechniciansAndInvites(tenantId: string) {
  const [techs, invites] = await Promise.all([
    prisma.technician.findMany({
      where: { tenantId },
      include: { user: { select: { name: true, phone: true, status: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.invite.findMany({
      where: { tenantId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { techs, invites };
}

/** Batalkan undangan (owner). */
export async function revokeInvite(tenantId: string, inviteId: string): Promise<void> {
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, tenantId } });
  if (!invite) throw new TechAuthError("NOT_FOUND", "Undangan tidak ditemukan");
  await prisma.invite.update({ where: { id: invite.id }, data: { status: "REVOKED" } });
}
