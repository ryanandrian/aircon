"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icons";
import {
  kinerjaQueryString,
  shiftKinerja,
  type KinParams,
} from "@/lib/domain/kinerja";
// type-only (terhapus saat transpile → TIDAK menarik modul server/prisma ke bundle)
import type { KinPerson } from "@/lib/domain/kinerja-aggregate";

const PERIODS: { value: KinParams["period"]; label: string }[] = [
  { value: "hari", label: "Harian" },
  { value: "minggu", label: "Mingguan" },
  { value: "bulan", label: "Bulanan" },
];

type KinData = {
  people: KinPerson[];
  totalPeople: number;
  totalItems: number;
  totalJobs: number;
  incentiveEnabled: boolean;
};

/**
 * Board Kinerja Tim — pola YANG SAMA dgn AgendaBoard: navigasi = ganti URL,
 * page force-dynamic me-render ulang, server mengirim data segar, state
 * disinkron dari props saat render (guarded render-time update, BUKAN setState
 * di effect — menghindari lint react-hooks/set-state-in-effect).
 */
export function KinerjaBoard({
  initialParams,
  initialLabel,
  initialData,
}: {
  initialParams: KinParams;
  initialLabel: string;
  initialData: KinData;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [params, setParams] = useState(initialParams);
  const [label, setLabel] = useState(initialLabel);
  const [data, setData] = useState(initialData);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);

  // Sinkronisasi server → client saat props berubah (back/forward/pergantian periode).
  const [previousServerData, setPreviousServerData] = useState({
    params: initialParams, label: initialLabel, data: initialData,
  });
  if (
    previousServerData.params !== initialParams ||
    previousServerData.label !== initialLabel ||
    previousServerData.data !== initialData
  ) {
    setPreviousServerData({ params: initialParams, label: initialLabel, data: initialData });
    setParams(initialParams);
    setLabel(initialLabel);
    setData(initialData);
    // personel terpilih mungkin tidak ada di data baru → tutup rinciannya.
    setSelectedPerson((current) =>
      current && initialData.people.some((p) => p.personId === current) ? current : null,
    );
  }

  const navigate = (next: KinParams) => {
    setParams(next);
    startTransition(() => {
      router.replace(`/app/kinerja?${kinerjaQueryString(next)}`, { scroll: false });
    });
  };

  const selected = data.people.find((p) => p.personId === selectedPerson) ?? null;

  return (
    <div className="space-y-4">
      <Tabs
        value={params.period}
        onValueChange={(v) => navigate({ period: v as KinParams["period"], anchor: params.anchor })}
      >
        <TabsList className="grid w-full grid-cols-3">
          {PERIODS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button" variant="outline" aria-label="Periode sebelumnya"
          className="min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9"
          onClick={() => navigate(shiftKinerja(params, -1))}
        >
          <Icon.ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
        </Button>
        <p className="min-w-[10rem] flex-1 text-center text-sm font-semibold tabular-nums text-foreground">
          {label}
        </p>
        <Button
          type="button" variant="outline" aria-label="Periode berikutnya"
          className="min-h-[44px] w-11 shrink-0 sm:h-9 sm:w-9"
          onClick={() => navigate(shiftKinerja(params, 1))}
        >
          <Icon.ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button" variant="outline" className="min-h-[44px] shrink-0 sm:h-9"
          onClick={() => navigate({ period: params.period, anchor: new Date() })}
        >
          Hari ini
        </Button>
      </div>

      {pending && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 animate-pulse bg-sky-500" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Personel" value={String(data.totalPeople)} />
        <Stat label="Pekerjaan" value={String(data.totalJobs)} />
        <Stat label="Layanan dikerjakan" value={String(data.totalItems)} />
      </div>

      {data.people.length === 0 ? (
        <EmptyState
          icon={Icon.Technician}
          title="Belum ada pekerjaan tercatat"
          desc="Pekerjaan yang ditutup teknisi pada periode ini akan muncul di sini. Penugasan yang belum dikerjakan tidak dihitung."
          variant="card"
        />
      ) : (
        <div className="space-y-3">
          {data.people.map((person) => {
            const active = selectedPerson === person.personId;
            return (
              <Card key={person.personId}>
                <button
                  type="button"
                  aria-expanded={active}
                  onClick={() => setSelectedPerson(active ? null : person.personId)}
                  className="w-full text-left"
                >
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-foreground">{person.personName}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {person.jobCount} pekerjaan · {person.itemCount} layanan dikerjakan
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {data.incentiveEnabled && (
                        <span className="text-sm font-semibold tabular-nums text-sky-600">
                          Rp{person.incentive.toLocaleString("id-ID")}
                        </span>
                      )}
                      <Icon.ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform ${active ? "rotate-90" : ""}`}
                        aria-hidden
                      />
                    </div>
                  </CardContent>
                </button>

                {active && selected && (
                  <PersonDetail person={selected} incentiveEnabled={data.incentiveEnabled} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div>
        <div className="mt-0.5 text-lg font-bold tabular-nums text-sky-600 sm:text-xl">{value}</div>
      </CardContent>
    </Card>
  );
}

function PersonDetail({ person, incentiveEnabled }: { person: KinPerson; incentiveEnabled: boolean }) {
  const rows = person.rows;
  return (
    <div className="border-t border-border px-4 pb-4 pt-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Rincian pekerjaan
      </h3>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={`${row.sessionId}:${i}`} className="rounded-xl border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{row.service}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {row.date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                  {" · "}
                  {row.customer}
                  {row.jobType && <> · {row.jobType}</>}
                </div>
                {row.jobId && (
                  <a
                    href={`/app/pekerjaan/${row.jobId}`}
                    className="mt-1 inline-block text-xs text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Buka pekerjaan →
                  </a>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
                {row.role === "TECHNICIAN" ? "Teknisi" : "Kernet"}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground">
                {row.asset ?? "Unit tidak dicatat"} · {row.qty} {row.unit} × Rp{row.unitPrice.toLocaleString("id-ID")}
              </span>
              <span className="font-semibold tabular-nums text-foreground">
                Rp{row.lineTotal.toLocaleString("id-ID")}
              </span>
            </div>
            {incentiveEnabled && (
              <div className="mt-1 text-right text-[11px] text-sky-600">
                Insentif baris: Rp{row.incentive.toLocaleString("id-ID")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
