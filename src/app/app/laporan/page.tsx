import { redirect } from "next/navigation";
import { tryGetServerContext } from "@/lib/auth/context";
import {
  getAccountsReceivable, getOverdueInvoices, getReceiptPositions, getReceiptHistory, getRemittances,
  getUnremittedCashByHolder, refreshOverdueStatus,
  summarizeReceiptHistory, receiptTrendPoints,
} from "@/lib/services/ar-service";
import { computeIncentives } from "@/lib/services/incentive-service";
import { prisma } from "@/lib/prisma";
import {
  monthRangeForKey, monthKeyLabel, monthKeyInZone, parseMonthKey,
} from "@/lib/domain/tenant-timezone";
import { AppHeader } from "../_components/app-header";
import { Card, CardContent } from "@/components/ui/card";
import { RemitButton } from "./remit-button";
import { MonthNav } from "./month-nav";
import { ReceiptTrendChart } from "../_components/receipt-trend-chart";

export const dynamic = "force-dynamic";

const rp = (n: number) => "Rp" + n.toLocaleString("id-ID");
const fmt = (d: Date | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";
// M9: peran pemegang uang ditulis menurut apa adanya — bukan selalu "teknisi".
const HOLDER_ROLE: Record<string, string> = { OWNER: "pemilik", ADMIN: "admin", TECHNICIAN: "teknisi" };

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const ctx = await tryGetServerContext();
  if (!ctx) redirect("/login?next=/app/laporan");
  if (ctx.role !== "OWNER" && ctx.role !== "ADMIN") redirect("/app");

  const now = new Date();
  await refreshOverdueStatus(ctx.tenantId, now); // sinkron status OVERDUE saat buka laporan

  // L1 (K7): baca zona tenant lebih dulu — penanggalan dihitung di zona TENANT,
  // bukan zona server (M5). Kolom masih nullable; seluruh tenant lama = WIB (bawaan).
  const tenantCfg = await prisma.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { incentiveEnabled: true, timezone: true },
  });
  const tz = tenantCfg?.timezone;

  // L10/K16a: pemilih bulan + deep-link `?bulan=YYYY-MM` — PENERIMAAN & INSENTIF
  // mengikuti bulan terpilih. Nilai tidak valid → bulan ini (parseMonthKey menolak).
  const rawParams = await searchParams;
  const rawBulan = Array.isArray(rawParams.bulan) ? rawParams.bulan[0] : rawParams.bulan;
  const monthKey = parseMonthKey(rawBulan) ?? monthKeyInZone(now, tz);
  const { start: monthStart, end: monthEnd } = monthRangeForKey(monthKey, tz);

  const [ar, overdue, pos, unremitted, remittances, history] = await Promise.all([
    getAccountsReceivable(ctx.tenantId, now),
    getOverdueInvoices(ctx.tenantId, now),
    // K11: penerimaan = ARUS bulan terpilih; posisi "menunggu"/"disetor-tanpa-jejak"
    // adalah KEADAAN seluruh waktu di DALAM getReceiptPositions → tidak perlu filter.
    getReceiptPositions(ctx.tenantId, monthStart, monthEnd),
    getUnremittedCashByHolder(ctx.tenantId),
    getRemittances(ctx.tenantId),
    // Riwayat SELURUH bulan — sumber kartu riwayat, ringkasan, dan grafik (nol query ganda).
    getReceiptHistory(ctx.tenantId, tz),
  ]);
  const summary = summarizeReceiptHistory(history, monthKey);
  const trend = receiptTrendPoints(history, monthKey, tz);

  const incentiveEnabled = tenantCfg?.incentiveEnabled ?? false;
  // computeIncentives sudah ter-gerbang di SUMBER (return [] bila tenant tak menerapkan).
  const incentives = await computeIncentives(ctx.tenantId, monthStart, monthEnd);
  const totalIncentive = incentives.reduce((s, i) => s + i.amount, 0);

  return (
    <main className="min-h-screen">
      <AppHeader title="Laporan Keuangan" helpKey="laporan" />
      <div className="mx-auto max-w-4xl space-y-5 px-5 py-6">

        {/* Ringkasan posisi uang (L4 / K1): Penerimaan = HANYA uang yang sudah
            terverifikasi masuk; sisanya tampil terpisah — tidak pernah hilang.
            L10/K16a: pemilih bulan — Penerimaan mengikuti bulan terpilih (arus),
            posisi "menunggu"/"disetor" TETAP seluruh waktu (K11 — keadaan tak
            kedaluwarsa walau pindah bulan). */}
        <MonthNav
          monthKey={monthKey}
          timezone={tz}
          exportHref={`/app/laporan/export?bulan=${monthKey}&detail=1`}
          exportAllHref="/app/laporan/export"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Total Piutang" value={rp(ar.total)} tone="sky" />
          {/* K11 (2026-10-18): Penerimaan = ARUS bulan terpilih (diterima bulan itu);
              posisi "menunggu" & "disetor tanpa jejak" = KEADAAN seluruh waktu —
              identik dengan tabel di bawah, jadi tak pernah lagi angka beda dalam
              satu layar. */}
          {/* Aturan 15: saat Rp0 sub-label harus menjelaskan KENAPA (belum ada
              setoran/verifikasi tercatat bulan ini) — bukan sekadar "0 invoice". */}
          <Stat
            label={`Penerimaan ${monthKeyLabel(monthKey)} (sudah masuk)`}
            value={rp(pos.penerimaan.total)}
            sub={pos.penerimaan.count > 0
              ? `${pos.penerimaan.count} invoice`
              : "0 · belum ada setoran/verifikasi tercatat bulan ini"}
            tone="emerald"
          />
          <Stat label="Menunggu Setoran (di tangan pemegang)" value={rp(pos.menungguSetoran.total)} sub={`${pos.menungguSetoran.count} invoice · seluruh waktu`} tone="amber" />
          <Stat label="Menunggu Verifikasi (transfer/QRIS)" value={rp(pos.menungguVerifikasi.total)} sub={`${pos.menungguVerifikasi.count} invoice · seluruh waktu`} tone="violet" />
          {/* M7/K13: tunai SUDAH ditandai disetor tapi jejak buktinya kosong (data
              setoran lama). Tampil terpisah — bukan hilang, bukan diklaim masuk kantor
              tanpa bukti (K5).
              K14 (2026-10-18, koreksi setelah pemilik menunjuk): sub-label KONDISIONAL —
              begitu semua setoran lama dilengkapi (tujuan akhir K14), angka 0 dan kalimat
              "belum tercatat" harus ikut hilang; kartu TETAP tampil agar tata letak grid
              tidak berpindah dan posisi tetap bisa diaudit (identitas 4 posisi). */}
          <Stat
            label="Disetor — Belum Ada Bukti"
            value={rp(pos.disetorTanpaJejak.total)}
            sub={pos.disetorTanpaJejak.count > 0
              ? `${pos.disetorTanpaJejak.count} invoice · jejak setoran lama belum tercatat`
              : "semua setoran sudah tercatat berbukti"}
            tone="amber"
          />
        </div>

        {/* Riwayat Penerimaan per bulan (L9, 2026-10-18) — total + detail per bulan,
            urut terbaru. Baris pakai <details> (pola src/app/app/pengingat/inbox.tsx):
            tanpa komponen client baru (aturan 11) dan tanpa query tambahan.
            Hanya bulan yang PUNYA jejak penerimaan — baris tanpa jejak tidak pernah
            ditempatkan ke bulan mana pun (mengarang tanggal = dilarang).
            L10/K16(b,d): ditambah ringkasan (total tahun + vs bulan lalu) dan grafik
            tren 12 bulan — keduanya turunan dari `history` yang sudah dibaca (0 query). */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Riwayat Penerimaan</h2>
                <p className="text-xs text-muted-foreground">
                  Total &amp; rincian penerimaan per bulan (menurut waktu uang diterima — setoran
                  tercatat / verifikasi tercatat). Klik satu bulan untuk melihat invoice penyusunnya.
                </p>
              </div>
              {/* Ringkasan tahun terpilih + arah vs bulan sebelumnya (K16b).
                  changePct null = bulan lalu tanpa jejak → TIDAK menampilkan persen
                  (pembagian nol ditolak di summarizeReceiptHistory). */}
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total {monthKeyLabel(monthKey).slice(-4)}</div>
                <div className="text-lg font-bold tabular-nums text-emerald-600">{rp(summary.totalYear)}</div>
                <div className="text-xs text-muted-foreground">
                  Bulan ini {rp(summary.thisMonth)}
                  {summary.changePct !== null && (
                    <span className={summary.changePct >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {" "}· {summary.changePct >= 0 ? "▲" : "▼"} {Math.abs(summary.changePct)}% vs bln lalu
                    </span>
                  )}
                  {summary.changePct === null && summary.prevMonth === 0 && summary.thisMonth > 0 && " · bln lalu Rp0"}
                </div>
              </div>
            </div>

            {/* Tren 12 bulan (K16d) — komponen chart existing, data dari `history`. */}
            <div className="mb-4">
              <ReceiptTrendChart data={trend} monthKey={monthKeyLabel(monthKey)} />
            </div>

            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada penerimaan tercatat — riwayat mulai terisi sejak setoran/verifikasi
                dicatat lewat aplikasi.
              </p>
            ) : (
              <div className="space-y-2">
                {[...history].reverse().map((m) => (
                  <details key={m.month} className="rounded-xl border p-3 [&_summary]:cursor-pointer">
                    <summary className="flex items-center justify-between gap-3 text-sm font-medium text-foreground marker:content-none">
                      <span>{monthKeyLabel(m.month)}</span>
                      <span className="shrink-0 text-right">
                        <span className="font-bold text-emerald-600">{rp(m.total)}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{m.count} invoice</span>
                      </span>
                    </summary>
                    <div className="mt-2 space-y-1.5 border-t pt-2">
                      {m.items.map((it) => (
                        <a key={it.id} href={`/app/faktur/${it.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:border-emerald-300">
                          <span className="min-w-0">
                            <span className="block truncate text-sm text-foreground">{it.customerName}</span>
                            <span className="block font-mono text-xs text-muted-foreground">
                              {it.number} · {it.payMethod} · diterima {fmt(it.receivedAt)}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-bold text-foreground">{rp(it.total)}</span>
                        </a>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aging piutang */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">Umur Piutang (Aging)</h2>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Aging label="Belum jatuh tempo" value={rp(ar.current)} />
              <Aging label="1–30 hari" value={rp(ar.d1_30)} />
              <Aging label="31–60 hari" value={rp(ar.d31_60)} />
              <Aging label="61–90 hari" value={rp(ar.d61_90)} />
              <Aging label="> 90 hari" value={rp(ar.d90plus)} warn />
            </div>
          </CardContent>
        </Card>

        {/* Invoice jatuh tempo */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-3 text-sm font-bold text-foreground">Invoice Jatuh Tempo ({overdue.length})</h2>
            {overdue.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada invoice jatuh tempo. 👍</p>
            ) : (
              <div className="space-y-2">
                {overdue.map((o) => (
                  <a key={o.id} href={`/app/faktur/${o.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:border-red-300">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{o.customerName}</div>
                      <div className="font-mono text-xs text-muted-foreground">{o.number} · jatuh tempo {fmt(o.dueDate)} · telat {o.daysLate} hari</div>
                    </div>
                    <div className="shrink-0 font-bold text-red-600">{rp(o.total)}</div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setoran kas teknisi (K17) */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-bold text-foreground">Kas Belum Disetor per Pemegang Uang</h2>
            <p className="mb-3 text-xs text-muted-foreground">Uang tunai dari invoice lunas yang belum disetor — terus tampil sampai admin mencatat setorannya, lintas periode (K3).</p>
            {unremitted.length === 0 ? (
              <p className="text-sm text-muted-foreground">Semua kas sudah disetor. 👍</p>
            ) : (
              <div className="space-y-2">
                {unremitted.map((u) => (
                  <div key={u.holderId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      {/* M9: pemegang uang BUKAN selalu teknisi — tampil menurut peran
                          aslinya (kasus live: pemilik memegang kas lapangan). */}
                      <div className="text-sm font-medium text-foreground">
                        {u.holderName}{u.holderRole ? <span className="ml-1 text-xs font-normal text-muted-foreground">({HOLDER_ROLE[u.holderRole] ?? u.holderRole})</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{u.count} transaksi · {rp(u.total)}</div>
                    </div>
                    <RemitButton holderName={u.holderName} invoiceIds={u.invoiceIds} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Riwayat setoran (L5) — tracing untuk owner tenant: siapa menyetor,
            siapa menerima, kapan, dan buktinya (bisa dibuka). */}
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-bold text-foreground">Riwayat Setoran Kas</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Penelusuran uang tunai: pemegang uang → admin penerima → waktu → bukti setoran.
            </p>
            {remittances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada setoran tercatat.</p>
            ) : (
              <div className="space-y-2">
                {remittances.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {r.holderName} → {r.receiverName ?? "belum tercatat"}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {r.number} · {rp(r.total)} · disetor {fmt(r.remittedAt)}
                      </div>
                    </div>
                    {r.proofUrl ? (
                      <a href={r.proofUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-xs font-medium text-sky-600 hover:bg-muted dark:text-sky-400">
                        Lihat Bukti
                      </a>
                    ) : (
                      // K14: setoran LAMA tanpa jejak kini punya aksi — tombol memakai
                      // RemitButton + action + unggah S3 yang sudah ada (tanpa komponen baru).
                      // Penerima diambil dari sesi admin yang menekan; wajib foto (K5).
                      <RemitButton holderName={r.holderName} invoiceIds={[r.id]} mode="legacy" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insentif personel bulan ini (K5/K6/K7) — hanya bila tenant menerapkan insentif */}
        {incentiveEnabled && (
        <Card>
          <CardContent className="p-5">
            <h2 className="mb-1 text-sm font-bold text-foreground">Insentif Personel {monthKeyLabel(monthKey)}</h2>
            <p className="mb-3 text-xs text-muted-foreground">Total {rp(totalIncentive)} · acuan & mode diatur di Pengaturan.</p>
            {incentives.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada insentif periode ini.</p>
            ) : (
              <div className="space-y-2">
                {incentives.map((i) => (
                  <div key={i.personId} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div>
                      <div className="text-sm font-medium text-foreground">{i.personName}</div>
                      <div className="text-xs text-muted-foreground">{i.itemCount} pekerjaan</div>
                    </div>
                    <div className="font-bold text-sky-600">{rp(i.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

      </div>
    </main>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "sky" | "emerald" | "amber" | "violet" }) {
  const toneCls = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : tone === "violet" ? "text-violet-600" : "text-sky-600";
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${toneCls}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </CardContent></Card>
  );
}

function Aging({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-2 ${warn ? "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${warn ? "text-red-600" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
