import { getPublicUnitByCode } from "@/lib/services/unit-code-service";
import { SERVICE_TYPE_LABEL } from "@/lib/copy/terms";
import { TenantLogo } from "@/components/tenant-logo";
import { Icon } from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
      <div aria-hidden className="h-24 bg-gradient-to-br from-sky-500 via-sky-600 to-cyan-500" />
      <div className="mx-auto -mt-12 w-full max-w-lg px-5 pb-16">
        {!unit ? (
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
        ) : (
          <>
            {/* Branding tenant (pemilik usaha yang merawat) */}
            <div className="mb-4 flex items-center gap-3">
              <TenantLogo name={unit.tenantName} logoUrl={unit.tenantLogoUrl} size={44} className="border-2 border-background shadow" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Dirawat oleh</p>
                <p className="truncate font-semibold text-foreground">{unit.tenantName}</p>
              </div>
            </div>

            {/* Identitas mesin (bukan pemilik) */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white">
                    <Icon.AC className="h-6 w-6" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-foreground">
                      {unit.brand ?? "Unit AC"}{unit.capacityPk ? ` ${unit.capacityPk} PK` : ""}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {[AC_TYPE_LABEL[unit.type] ?? unit.type, unit.model, unit.roomLocation].filter(Boolean).join(" · ")}
                    </p>
                    <Badge variant="secondary" className="mt-2 font-mono">{unit.code}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Riwayat perawatan (descending) */}
            <div className="mt-5">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Riwayat Perawatan
              </h2>
              {unit.history.length === 0 ? (
                <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Belum ada catatan perawatan.</CardContent></Card>
              ) : (
                <>
                  {/* Sorot perawatan terakhir */}
                  <Card className="border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/30">
                    <CardContent className="p-4">
                      <div className="text-xs font-medium text-sky-700 dark:text-sky-300">Perawatan terakhir</div>
                      <div className="mt-0.5 font-semibold text-foreground">
                        {fmtDate(unit.history[0].date)} — {unit.history[0].activity}
                      </div>
                    </CardContent>
                  </Card>
                  <ol className="mt-3 space-y-2">
                    {unit.history.map((h, i) => (
                      <li key={i} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                        <Icon.Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        <div className="flex-1">
                          <div className="text-sm font-medium text-foreground">{h.activity}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(h.date)}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Kartu perawatan digital · dibuat dengan Aircon
            </p>
          </>
        )}
      </div>
    </main>
  );
}
