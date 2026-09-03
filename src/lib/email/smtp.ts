/**
 * Email sender platform — SMTP (admin@lumite.biz.id via cPanel idcloudhost).
 * Kredensial HANYA dari ENV (12-factor; JANGAN hardcode). Server-only.
 *
 * ENV yang dibaca:
 *   SMTP_HOST      (mis. mail.lumite.biz.id)
 *   SMTP_PORT      (465 SSL / 587 STARTTLS; default 465)
 *   SMTP_USER      (admin@lumite.biz.id)
 *   SMTP_PASS      (password mailbox)
 *   SMTP_FROM      (opsional, default "Lumite <admin@lumite.biz.id>")
 *
 * Bila ENV belum lengkap → isEmailConfigured()=false; pemanggil MENAHAN antrean (tak error keras),
 * konsisten dengan pola gateway WA (isGatewayConfigured).
 */
import "server-only";
import nodemailer from "nodemailer";

let _transport: nodemailer.Transporter | null = null;

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport(): nodemailer.Transporter {
  if (_transport) return _transport;
  const port = Number(process.env.SMTP_PORT ?? 465);
  _transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465=SSL langsung, selain itu STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return _transport;
}

export async function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (!isEmailConfigured()) return { ok: false, error: "SMTP belum dikonfigurasi (ENV)" };
  const from = process.env.SMTP_FROM || `Lumite <${process.env.SMTP_USER}>`;
  try {
    // body plaintext → juga kirim sebagai HTML sederhana (newline → <br>) agar rapi di klien email.
    const html = body.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>");
    const info = await transport().sendMail({ from, to, subject, text: body, html });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "smtp error" };
  }
}
