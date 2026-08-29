"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  updateLandingContent, createTestimonial, updateTestimonial, deleteTestimonial,
  createPreviewItem, updatePreviewItem, deletePreviewItem,
  type LandingUpdateInput,
} from "@/lib/services/landing-service";
import { createAssetUploadUrl } from "@/lib/storage/s3";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";

/** Simpan konten landing (teks + URL gambar + toggle). */
export async function actionSaveLanding(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requirePlatformAdmin();
    const data: LandingUpdateInput = {
      heroBadge: str(fd, "heroBadge"),
      heroTitle: str(fd, "heroTitle"),
      heroTitleAccent: str(fd, "heroTitleAccent"),
      heroSubtitle: str(fd, "heroSubtitle"),
      heroCtaPrimary: str(fd, "heroCtaPrimary"),
      heroCtaSecondary: str(fd, "heroCtaSecondary"),
      heroMicrocopy: str(fd, "heroMicrocopy"),
      heroImageUrl: str(fd, "heroImageUrl"),
      logoUrl: str(fd, "logoUrl"),
      ogImageUrl: str(fd, "ogImageUrl"),
      howTitle: str(fd, "howTitle"),
      howSubtitle: str(fd, "howSubtitle"),
      featuresTitle: str(fd, "featuresTitle"),
      featuresSubtitle: str(fd, "featuresSubtitle"),
      csWhatsapp: str(fd, "csWhatsapp"),
      customTierTitle: str(fd, "customTierTitle"),
      customTierDesc: str(fd, "customTierDesc"),
      ctaTitle: str(fd, "ctaTitle"),
      ctaSubtitle: str(fd, "ctaSubtitle"),
      ctaButton: str(fd, "ctaButton"),
      footerTagline: str(fd, "footerTagline"),
      showRoi: bool(fd, "showRoi"),
      showHow: bool(fd, "showHow"),
      showFeatures: bool(fd, "showFeatures"),
      showPreview: bool(fd, "showPreview"),
      showSegments: bool(fd, "showSegments"),
      showPricing: bool(fd, "showPricing"),
      showTestimonials: bool(fd, "showTestimonials"),
      showFaq: bool(fd, "showFaq"),
    };
    await updateLandingContent(data, admin.email);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan" };
  }
}

/** Presigned URL untuk upload gambar (dipanggil dari klien admin). */
export async function actionPresignAsset(scope: string, filename: string, contentType: string): Promise<{ ok: boolean; uploadUrl?: string; publicUrl?: string; error?: string }> {
  try {
    await requirePlatformAdmin();
    const r = await createAssetUploadUrl({ scope, filename, contentType });
    return { ok: true, uploadUrl: r.uploadUrl, publicUrl: r.publicUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyiapkan upload" };
  }
}

export async function actionSaveTestimonial(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePlatformAdmin();
    const id = str(fd, "id");
    const data = {
      name: str(fd, "name"),
      business: str(fd, "business"),
      quote: str(fd, "quote"),
      photoUrl: str(fd, "photoUrl"),
      rating: Math.max(1, Math.min(5, Number(fd.get("rating") ?? 5))),
      sortOrder: Number(fd.get("sortOrder") ?? 0),
      published: bool(fd, "published"),
    };
    if (!data.name || !data.quote) return { ok: false, error: "Nama & kutipan wajib diisi" };
    if (id) await updateTestimonial(id, data);
    else await createTestimonial(data);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan testimoni" };
  }
}

export async function actionDeleteTestimonial(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePlatformAdmin();
    await deleteTestimonial(id);
    revalidatePath("/");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus" };
  }
}

// ---- Pratinjau (CMS pengganti demo) ----
export async function actionSavePreviewItem(fd: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePlatformAdmin();
    const id = str(fd, "id");
    const data = {
      title: str(fd, "title"),
      caption: str(fd, "caption"),
      imageUrl: str(fd, "imageUrl"),
      category: str(fd, "category"),
      sortOrder: Number(fd.get("sortOrder") ?? 0),
      published: bool(fd, "published"),
    };
    if (!data.title || !data.imageUrl) return { ok: false, error: "Judul & gambar wajib diisi" };
    if (id) await updatePreviewItem(id, data);
    else await createPreviewItem(data);
    revalidatePath("/pratinjau");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menyimpan pratinjau" };
  }
}

export async function actionDeletePreviewItem(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requirePlatformAdmin();
    await deletePreviewItem(id);
    revalidatePath("/pratinjau");
    revalidatePath("/admin/landing");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal menghapus" };
  }
}
