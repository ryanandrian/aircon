import { getLandingContent, listTestimonials, listPreviewItems } from "@/lib/services/landing-service";
import { isStorageConfigured } from "@/lib/storage/s3";
import { LandingEditor } from "./landing-editor";
import { TestimonialManager } from "./testimonial-manager";
import { PreviewManager } from "./preview-manager";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminLandingPage() {
  const [content, testimonials, previews, storageOn] = await Promise.all([
    getLandingContent(),
    listTestimonials(false),
    listPreviewItems(false),
    Promise.resolve(isStorageConfigured()),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">Landing Page</h1>
        <p className="text-sm text-muted-foreground">Kelola teks, gambar, testimoni, dan bagian yang tampil di halaman depan — tanpa developer.</p>
      </header>

      {!storageOn && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-300">
            Penyimpanan gambar (S3) belum aktif — unggah gambar tidak akan berfungsi sampai dikonfigurasi. Teks tetap bisa disimpan.
          </CardContent>
        </Card>
      )}

      <LandingEditor initial={content as unknown as Record<string, string | boolean>} />

      <TestimonialManager
        items={testimonials.map((t) => ({
          id: t.id, name: t.name, business: t.business, quote: t.quote,
          photoUrl: t.photoUrl, rating: t.rating, sortOrder: t.sortOrder, published: t.published,
        }))}
      />

      <PreviewManager
        items={previews.map((p) => ({
          id: p.id, title: p.title, caption: p.caption, imageUrl: p.imageUrl,
          category: p.category, sortOrder: p.sortOrder, published: p.published,
        }))}
      />
    </div>
  );
}
