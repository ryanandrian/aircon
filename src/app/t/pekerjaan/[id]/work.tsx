"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { techTransition, techUploadPhoto } from "../../actions";
import { nextTechAction } from "@/lib/copy/job-status";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { JobStatus } from "@prisma/client";

interface Photo { id: string; kind: string; url: string }

function genEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TechJobWork({
  jobId, customerId, status, photos, storageReady,
}: {
  jobId: string; customerId: string; status: JobStatus; photos: Photo[]; storageReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [pics, setPics] = useState(photos);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const action = nextTechAction(status);
  const working = status === "IN_PROGRESS" || status === "WAITING";
  const showWork = ["ARRIVED", "IN_PROGRESS", "WAITING"].includes(status);
  // Tombol non-final tetap memakai state-machine action. COMPLETED dikerjakan via WorkSession.
  const finalizationAction = action?.to === "COMPLETED" ? null : action;


  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const kind = status === "IN_PROGRESS" || status === "WAITING" ? "after" : "before";
      // Upload LEWAT SERVER (hindari CORS browser→S3) + catat ke DB sekaligus.
      const fd = new FormData();
      fd.set("file", file);
      const res = await techUploadPhoto(jobId, kind as "before" | "after", fd);
      if (!res.ok) { setMsg(res.error); return; }
      setPics((prev) => [...prev, { id: genEventId(), kind, url: res.publicUrl }]);
    } catch (err) {
      setMsg("Gagal mengunggah foto. Coba lagi.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function doTransition(to: JobStatus) {
    setMsg(null);
    start(async () => {
      const res = await techTransition(jobId, to, { clientEventId: genEventId() });
      if (!res.ok) { setMsg(res.error); return; }
      router.refresh();
    });
  }

  return (
    <>
      {showWork && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Foto Bukti</h2>
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !storageReady}
                className="bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-900/50"
              >
                {uploading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {uploading ? "Mengunggah…" : "+ Ambil Foto"}
              </Button>
              <input
                ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={onPhoto} className="hidden"
              />
            </div>
            {pics.length > 0 ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {pics.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.url} alt={p.kind} className="aspect-square w-full rounded-xl object-cover" />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Belum ada foto. Foto sebelum &amp; sesudah membantu bukti kerja.</p>
            )}
          </CardContent>
        </Card>
      )}

      {msg && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400">{msg}</p>
      )}

      {/* Aksi utama — sticky bawah, jempol mudah menjangkau.
          Saat IN_PROGRESS, tombol "Selesaikan" diganti rujukan ke Catat Pekerjaan (jalur finalisasi);
          tombol "Tunda" tetap tampil agar pekerjaan bisa ditunda. */}
      {(finalizationAction || working) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background p-4">
          <div className="mx-auto flex max-w-md gap-2">
            {working && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const reason = window.prompt("Alasan menunda pekerjaan?");
                  if (reason) start(async () => {
                    const res = await techTransition(jobId, "WAITING", { reason, clientEventId: genEventId() });
                    if (!res.ok) setMsg(res.error); else router.refresh();
                  });
                }}
                disabled={pending || status === "WAITING"}
                className="min-h-[52px] rounded-2xl px-4"
              >
                Tunda
              </Button>
            )}
            {finalizationAction ? (
              <Button
                type="button"
                onClick={() => doTransition(finalizationAction.to)}
                disabled={pending || uploading}
                className="min-h-[52px] flex-1 rounded-2xl bg-sky-500 text-white hover:bg-sky-600"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {pending ? "Memproses…" : finalizationAction.label}
              </Button>
            ) : status === "IN_PROGRESS" && showWork ? (
              <a
                href={`/t/kerja/${customerId}?job=${jobId}`}
                className="min-h-[52px] flex-1 rounded-2xl bg-emerald-600 px-4 text-center font-semibold text-white hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Icon.Check className="h-5 w-5" aria-hidden /> Selesaikan &amp; Tagihan
              </a>
            ) : null}
          </div>
        </div>
      )}

      {status === "COMPLETED" && (
        <Card className="border-emerald-200 bg-emerald-50 text-center dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <CardContent className="p-4">
            <p className="flex items-center justify-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300"><Icon.Success className="h-5 w-5" aria-hidden /> Pekerjaan selesai</p>
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">Pengingat servis berikutnya sudah dibuat otomatis.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
