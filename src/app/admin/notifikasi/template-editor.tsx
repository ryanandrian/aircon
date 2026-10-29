"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { actionSavePlatformTemplate, actionResetPlatformTemplate, actionRollbackPlatformTemplate, actionTestPlatformTemplateEmail } from "./actions";

export type RevisionView = { version: number; actor: string | null; createdAt: string };

export type TemplateView = {
  key: string;
  label: string;
  subject: string;
  body: string;
  hasSubject: boolean;
  requiredVars: string[];
  knownVars: string[];
  version: number;
  isDefault: boolean;
  eventOnly: boolean;
  revisions: RevisionView[];
};

export function TemplateEditor({ templates }: { templates: TemplateView[] }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-lg font-semibold">Isi Pesan Platform</h2>
          <p className="text-sm text-muted-foreground">
            Ubah teks pesan yang dikirim Aircon ke tenant. Aturan paket (Basic/Professional/Business),
            penerima, dan pemicu tidak bisa diubah dari sini. Variabel dalam kurung ganda akan diganti
            otomatis saat pesan dikirim.
          </p>
        </div>
        <div className="space-y-4">
          {templates.map((t) => <TemplateRow key={t.key} t={t} />)}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplateRow({ t }: { t: TemplateView }) {
  const [subject, setSubject] = useState(t.subject);
  const [body, setBody] = useState(t.body);
  const [pending, start] = useTransition();
  const [testRecipient, setTestRecipient] = useState("");
  const dirty = subject !== t.subject || body !== t.body;

  const save = () => start(async () => {
    const r = await actionSavePlatformTemplate(t.key as never, subject, body);
    if (r.ok) toast.success(r.info ?? "Tersimpan");
    else toast.error(r.errors?.join(" · ") ?? r.error ?? "Gagal menyimpan");
  });

  const reset = () => start(async () => {
    const r = await actionResetPlatformTemplate(t.key as never);
    if (r.ok) {
      setSubject(t.subject);
      toast.success(r.info ?? "Dikembalikan");
    } else toast.error(r.error ?? "Gagal");
  });

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-foreground">{t.label}</span>
        <Badge variant="secondary" className="text-xs">{t.key}</Badge>
        <Badge variant="outline" className="text-xs">
          {t.isDefault ? "Default kode" : `Versi ${t.version}`}
        </Badge>
        {t.eventOnly && <Badge variant="outline" className="text-xs">Otomatis dari transaksi</Badge>}
      </div>
      {t.hasSubject && (
        <div className="space-y-1.5">
          <Label htmlFor={`subj-${t.key}`}>{t.key === "booking_inapp" ? "Judul notifikasi" : "Subjek (email)"}</Label>
          <Input id={`subj-${t.key}`} value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`body-${t.key}`}>Isi pesan</Label>
        <Textarea id={`body-${t.key}`} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">
        Wajib memuat: {t.requiredVars.map((v) => `{{${v}}}`).join(" ") || "—"} · Variabel tersedia: {t.knownVars.map((v) => `{{${v}}}`).join(" ")}
      </p>
      <div className="rounded-lg border border-dashed p-3 space-y-2">
        <p className="text-xs text-muted-foreground">Test-send EMAIL hanya ke NOTIFICATION_TEST_EMAIL_ALLOWLIST. Tidak membuat antrean bisnis. Pastikan template placeholder-valid.</p>
        <div className="flex flex-wrap gap-2">
          <Input type="email" value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder="alamat test yang di-allowlist" className="max-w-sm" />
          <Button size="sm" variant="outline" disabled={pending || !testRecipient.trim()} onClick={() => start(async () => {
            const r = await actionTestPlatformTemplateEmail(t.key as never, testRecipient);
            if (r.ok) toast.success(r.info ?? "Test email dikirim"); else toast.error(r.error ?? "Test gagal");
          })}>Kirim Test Email</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending || !dirty} onClick={save}>Simpan</Button>
        {!t.isDefault && (
          <Button size="sm" variant="outline" disabled={pending} onClick={reset}>Kembalikan ke default</Button>
        )}
      </div>
      {t.revisions.length > 0 && (
        <div className="rounded-md border p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Riwayat versi</p>
          <ul className="space-y-1">
            {t.revisions.map((r) => (
              <li key={r.version} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  v{r.version} · {new Date(r.createdAt).toLocaleString("id-ID")}{r.actor ? ` · ${r.actor}` : ""}
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => start(async () => {
                    const res = await actionRollbackPlatformTemplate(t.key as never, r.version);
                    if (res.ok) toast.success(res.info ?? "Dikembalikan");
                    else toast.error(res.error ?? "Gagal");
                  })}
                >
                  Kembalikan
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
