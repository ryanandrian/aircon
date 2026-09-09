import { getPublicUnitByCode } from "@/lib/services/unit-code-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { TenantLogo } from "@/components/tenant-logo";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const AC_TYPE_LABEL: Record<string, string> = {
  SPLIT: "Split", CASSETTE: "Cassette", STANDING: "Standing", WINDOW: "Window", CENTRAL: "Central", OTHER: "Lainnya",
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const serviceLabel = (t: string) => SERVICE_TYPE_LABEL[t] ?? t;

export default async function PublicUnitPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unit = await getPublicUnitByCode(code, serviceLabel);

  return (
    <main className="min-h-screen bg-muted/30">
      {!unit ? (
        <>
          <div aria-hidden className="h-24 bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700" />
          <div className="mx-auto -mt-12 w-full max-w-lg px-5 pb-16">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                  <Icon.AC className="h-7 w-7" aria-hidden />
                </div>
                <h1 className="text-lg font-bold text-foreground">Kode belum terdaftar</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Kode <span className="font-mono font-semibold">{code.toUpperCase()}</span> belum ditautkan ke unit AC mana pun.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <>
          {/* Hero premium — branding tenant + identitas mesin (halaman publik untuk pelanggan) */}
          <div className="relative overflow-hidden bg-gradient-to-br from-sky-900 via-sky-800 to-sky-700">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-400/20 blur-2xl" />
            <div className="relative mx-auto w-full max-w-lg px-5 py-6">
              <div className="flex items-center gap-3">
                <TenantLogo name={unit.tenantName} logoUrl={unit.tenantLogoUrl} size={44} className="rounded-xl border-2 border-white/70 shadow-md" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/70">Dirawat oleh</p>
                  <p className="truncate text-lg font-extrabold text-white">{unit.tenantName}</p>
                </div>
              </div>
              <h1 className="mt-4 text-xl font-extrabold text-white">
                {unit.brand ?? "Unit AC"}{unit.capacityPk ? ` ${unit.capacityPk} PK` : ""}
              </h1>
              <p className="text-sm text-white/80">
                {[AC_TYPE_LABEL[unit.type] ?? unit.type, unit.model, unit.roomLocation].filter(Boolean).join(" · ")}
              </p>
              <span className="mt-3 inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-0.5 font-mono text-xs text-white/90">
                {unit.code}
              </span>
            </div>
          </div>

          <div className="mx-auto w-full max-w-lg px-5 py-5 pb-16">
            <h2 className="mb-2.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Riwayat Perawatan
            </h2>
            {unit.history.length === 0 ? (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada catatan perawatan.</CardContent></Card>
            ) : (
              <>
                {/* Sorot perawatan terakhir */}
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900/40 dark:bg-sky-950/30">
                  <Icon.Wrench className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                  <div>
                    <div className="text-xs font-medium text-sky-700 dark:text-sky-300">Perawatan terakhir</div>
                    <div className="mt-0.5 font-semibold text-foreground">
                      {fmtDate(unit.history[0].date)} — {unit.history[0].activity}
                    </div>
                  </div>
                </div>
                {/* Timeline rekam medis */}
                <Card>
                  <CardContent className="p-5">
                    <ol className="relative ml-1.5 border-l-2 border-border pl-4">
                      {unit.history.map((h, i) => (
                        <li key={i} className="relative pb-4 last:pb-0">
                          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/15" aria-hidden />
                          <div className="text-[11px] font-semibold text-muted-foreground">{fmtDate(h.date)}</div>
                          <div className="text-sm text-foreground">{h.activity}</div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              </>
            )}

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Kartu perawatan digital · dibuat dengan Aircon
            </p>
          </div>
        </>
      )}
    </main>
  );
}
