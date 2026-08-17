"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { techTransition, techSetChecklist, techAddPhoto, techRequestUploadUrl } from "../../actions";
import { nextTechAction } from "@/lib/copy/job-status";
import type { JobStatus } from "@prisma/client";

interface ChecklistItem {
  key: string;
  label: string;
  type: "bool" | "number" | "text" | "photo";
  required: boolean;
  checked: boolean;
  value: string | null;
}
interface Photo { id: string; kind: string; url: string }

function genEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function TechJobWork({
  jobId, status, checklist, photos, storageReady,
}: {
  jobId: string; status: JobStatus; checklist: ChecklistItem[]; photos: Photo[]; storageReady: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState(checklist);
  const [pics, setPics] = useState(photos);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const action = nextTechAction(status);
  const working = status === "IN_PROGRESS" || status === "WAITING";
  const showWork = ["ARRIVED", "IN_PROGRESS", "WAITING"].includes(status);

  function toggleBool(key: string, checked: boolean) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, checked } : i)));
    start(async () => {
      const res = await techSetChecklist(jobId, key, { checked });
      if (!res.ok) setMsg(res.error);
    });
  }
  function setValue(key: string, value: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, value } : i)));
  }
  function saveValue(key: string, value: string) {
    start(async () => {
      const res = await techSetChecklist(jobId, key, { value });
      if (!res.ok) setMsg(res.error);
    });
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg(null);
    try {
      const kind = status === "IN_PROGRESS" || status === "WAITING" ? "after" : "before";
      // 1) minta presigned URL dari server (key di-namespace per tenant/job)
      const presign = await techRequestUploadUrl(jobId, kind, file.name, file.type || "image/jpeg");
      if (!presign.ok) { setMsg(presign.error); return; }
      // 2) upload file langsung ke S3 (BiznetGio) via PUT
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!put.ok) throw new Error(`upload gagal ${put.status}`);
      // 3) catat URL publik ke DB
      const res = await techAddPhoto(jobId, kind as "before" | "after", presign.publicUrl);
      if (!res.ok) { setMsg(res.error); return; }
      setPics((prev) => [...prev, { id: genEventId(), kind, url: presign.publicUrl }]);
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
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-500">Checklist Pekerjaan</h2>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">Tidak ada checklist untuk servis ini.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {items.map((it) => (
                <li key={it.key}>
                  {it.type === "bool" ? (
                    <label className="flex min-h-[44px] items-center gap-3">
                      <input
                        type="checkbox" checked={it.checked}
                        onChange={(e) => toggleBool(it.key, e.target.checked)}
                        className="h-6 w-6 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">
                        {it.label}{it.required && <span className="text-red-500"> *</span>}
                      </span>
                    </label>
                  ) : (
                    <div>
                      <label className="block text-sm text-slate-700">
                        {it.label}{it.required && <span className="text-red-500"> *</span>}
                      </label>
                      <input
                        type={it.type === "number" ? "number" : "text"}
                        defaultValue={it.value ?? ""}
                        onChange={(e) => setValue(it.key, e.target.value)}
                        onBlur={(e) => saveValue(it.key, e.target.value)}
                        className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {showWork && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500">Foto Bukti</h2>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || !storageReady}
              className="rounded-xl bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700 disabled:opacity-50"
            >
              {uploading ? "Mengunggah…" : "+ Ambil Foto"}
            </button>
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
            <p className="mt-2 text-sm text-slate-400">Belum ada foto. Foto sebelum & sesudah membantu bukti kerja.</p>
          )}
        </section>
      )}

      {msg && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{msg}</p>
      )}

      {/* Aksi utama — sticky bawah, jempol mudah menjangkau */}
      {action && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white p-4">
          <div className="mx-auto flex max-w-md gap-2">
            {working && (
              <button
                onClick={() => {
                  const reason = window.prompt("Alasan menunda pekerjaan?");
                  if (reason) start(async () => {
                    const res = await techTransition(jobId, "WAITING", { reason, clientEventId: genEventId() });
                    if (!res.ok) setMsg(res.error); else router.refresh();
                  });
                }}
                disabled={pending || status === "WAITING"}
                className="min-h-[52px] rounded-2xl bg-slate-100 px-4 font-medium text-slate-700 disabled:opacity-40"
              >
                Tunda
              </button>
            )}
            <button
              onClick={() => doTransition(action.to)}
              disabled={pending || uploading}
              className="min-h-[52px] flex-1 rounded-2xl bg-sky-500 font-semibold text-white active:bg-sky-600 disabled:opacity-50"
            >
              {pending ? "Memproses…" : action.label}
            </button>
          </div>
        </div>
      )}

      {status === "COMPLETED" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="font-semibold text-emerald-800">✅ Pekerjaan selesai</p>
          <p className="mt-1 text-sm text-emerald-700">Pengingat servis berikutnya sudah dibuat otomatis.</p>
        </div>
      )}
    </>
  );
}
