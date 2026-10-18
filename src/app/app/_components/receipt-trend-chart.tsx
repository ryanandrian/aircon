"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Point = { label: string; value: number };

const chartConfig = {
  value: { label: "Penerimaan", color: "#10b981" },
} satisfies ChartConfig;

/**
 * Grafik tren "Penerimaan (12 bulan terakhir)" (L10/K16d).
 * POLA IDENTIK ServicedTrendChart — memakai komponen Chart resmi shadcn/ui di atas
 * Recharts (jalur yang sudah ada), bukan komponen bespoke.
 *
 * Makna titik: nilai = penerimaan TERKUMPUL pada bulan itu menurut jejak (K1).
 * Bulan tanpa jejak = 0 penerimaan tercatat (fakta) — BUKAN "data hilang"; baris
 * tanpa jejak tidak pernah dipaksakan ke bulan mana pun (aturan K15).
 * Data diagregasi di server (page), nol query tambahan.
 */
export function ReceiptTrendChart({ data, monthKey }: { data: Point[]; monthKey: string }) {
  const hasData = data.some((d) => d.value > 0);
  const last = data[data.length - 1]?.value ?? 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Tren Penerimaan</p>
            <p className="text-xs text-muted-foreground">12 bulan terakhir — berakhir {monthKey}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-foreground">{rpSafe(last)}</div>
            <div className="text-xs text-muted-foreground">bulan terakhir</div>
          </div>
        </div>

        {hasData ? (
          <ChartContainer config={chartConfig} className="h-44 w-full min-w-0 overflow-hidden">
            <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillReceipts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.15} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={40}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                width={36}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                tick={{ fontSize: 11 }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
              <Area
                dataKey="value"
                type="natural"
                fill="url(#fillReceipts)"
                stroke="var(--color-value)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center rounded-xl bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground">Belum ada penerimaan tercatat dalam 12 bulan terakhir.</p>
            <p className="mt-1 text-xs text-muted-foreground">Grafik akan terisi sejak setoran/verifikasi dicatat lewat aplikasi.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Formatter kecil (identik gaya halaman laporan) — khusus komponen ini.
const rpSafe = (n: number) => "Rp" + n.toLocaleString("id-ID");
