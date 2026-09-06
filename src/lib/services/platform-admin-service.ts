/**
 * Layanan kelola Admin Platform (super-admin Lumite, lintas tenant).
 * SEMUA fungsi dipanggil HANYA dari server action ber-guard requirePlatformAdmin.
 *
 * INVARIAN KEAMANAN: sistem tak boleh kehilangan SEMUA admin aktif (terkunci total).
 * Karena itu penghapusan/penonaktifan admin aktif TERAKHIR ditolak.
 */
import "server-only";
import { prisma } from "@/lib/prisma";

export interface PlatformAdminRow {
  id: string;
  email: string;
  name: string;
  active: boolean;
  createdAt: Date;
}

/** Normalisasi email: trim + lowercase (email Google case-insensitive). */
function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Daftar semua admin platform (terbaru dulu). */
export async function listPlatformAdmins(): Promise<PlatformAdminRow[]> {
  return prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
}

/** Jumlah admin AKTIF (untuk guard "admin terakhir"). */
async function countActive(): Promise<number> {
  return prisma.platformAdmin.count({ where: { active: true } });
}

export class AdminMgmtError extends Error {}

/** Tambah admin platform baru (atau aktifkan kembali bila email sudah ada). */
export async function addPlatformAdmin(emailRaw: string, nameRaw: string): Promise<void> {
  const email = normEmail(emailRaw);
  const name = nameRaw.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminMgmtError("Format email tidak valid.");
  }
  if (!name) throw new AdminMgmtError("Nama wajib diisi.");

  const existing = await prisma.platformAdmin.findUnique({ where: { email } });
  if (existing) {
    // Idempoten: bila sudah ada, pastikan aktif & perbarui nama.
    await prisma.platformAdmin.update({
      where: { email },
      data: { active: true, name },
    });
    return;
  }
  await prisma.platformAdmin.create({ data: { email, name, active: true } });
}

/** Aktif/nonaktifkan admin. Menolak menonaktifkan admin aktif TERAKHIR. */
export async function setPlatformAdminActive(id: string, active: boolean): Promise<void> {
  const target = await prisma.platformAdmin.findUnique({ where: { id } });
  if (!target) throw new AdminMgmtError("Admin tidak ditemukan.");

  if (!active && target.active) {
    // akan menonaktifkan satu admin aktif — pastikan bukan yang terakhir.
    const activeCount = await countActive();
    if (activeCount <= 1) {
      throw new AdminMgmtError(
        "Tidak bisa menonaktifkan admin aktif terakhir. Tambahkan admin lain dulu.",
      );
    }
  }
  await prisma.platformAdmin.update({ where: { id }, data: { active } });
}

/** Hapus admin. Menolak menghapus admin aktif TERAKHIR. */
export async function removePlatformAdmin(id: string): Promise<void> {
  const target = await prisma.platformAdmin.findUnique({ where: { id } });
  if (!target) throw new AdminMgmtError("Admin tidak ditemukan.");

  if (target.active) {
    const activeCount = await countActive();
    if (activeCount <= 1) {
      throw new AdminMgmtError(
        "Tidak bisa menghapus admin aktif terakhir. Tambahkan admin lain dulu.",
      );
    }
  }
  await prisma.platformAdmin.delete({ where: { id } });
}
