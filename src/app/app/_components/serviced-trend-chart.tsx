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
  value: { label: "Unit dilayani", color: "#0ea5e9" },
} satisfies ChartConfig;

/**
 * Grafik area "Unit AC dilayani (30 hari)".
 * Memakai komponen Chart resmi shadcn/ui (di atas Recharts) — konsisten dgn UI library,
 * bukan komponen bespoke. Data diagregasi server-side di page.
 */
export function ServicedTrendChart({ data, total }: { data: Point[]; total: number }) {
  const hasData = total > 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Unit AC dilayani</p>
            <p className="text-xs text-muted-foreground">30 hari terakhir</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">total unit</div>
          </div>
        </div>

        {hasData ? (
          <ChartContainer config={chartConfig} className="h-44 w-full">
            <AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="fillServiced" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#fillServiced)"
                stroke="var(--color-value)"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center rounded-xl bg-muted/30 text-center">
            <p className="text-sm text-muted-foreground">Belum ada unit dilayani dalam 30 hari terakhir.</p>
            <p className="mt-1 text-xs text-muted-foreground">Grafik akan tampil setelah pekerjaan pertama selesai.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
