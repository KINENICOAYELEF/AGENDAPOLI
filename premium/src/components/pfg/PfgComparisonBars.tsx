"use client";

import { ResponsiveBar } from "@nivo/bar";
import type { PfgEvaluacion } from "@/types/pfg";
import { extraerValorMetrica } from "@/lib/pfg/calculations";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";

interface Props {
  evaluaciones: PfgEvaluacion[];
}

const METRICS_TO_COMPARE = ["kujala", "enaReposo", "fuerzaExtRodilla", "fuerzaAbdCadera", "fuerzaReCadera"];
const WEEK_COLORS: Record<string, string> = { S0: "#818cf8", S5: "#fbbf24", S10: "#34d399" };

export default function PfgComparisonBars({ evaluaciones }: Props) {
  if (evaluaciones.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-slate-300 text-sm font-medium">
        Sin datos para comparar
      </div>
    );
  }

  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const weekKeys = sorted.map((e) => `S${e.semana}`);

  const data = METRICS_TO_COMPARE.map((key) => {
    const row: Record<string, string | number> = { metric: PFG_METRICS[key].labelCorto };
    sorted.forEach((ev) => {
      const val = extraerValorMetrica(ev, key);
      row[`S${ev.semana}`] = val ?? 0;
    });
    return row;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
        Comparación por Semana
      </p>
      <div className="h-[320px]">
        <ResponsiveBar
          data={data}
          keys={weekKeys}
          indexBy="metric"
          layout="horizontal"
          margin={{ top: 10, right: 20, bottom: 40, left: 100 }}
          padding={0.3}
          groupMode="grouped"
          colors={(d) => WEEK_COLORS[d.id as string] || "#94a3b8"}
          borderRadius={4}
          enableLabel={true}
          labelTextColor={{ from: "color", modifiers: [["darker", 2]] }}
          labelSkipWidth={24}
          animate={true}
          motionConfig="gentle"
          axisBottom={{
            tickSize: 0,
            tickPadding: 8,
          }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
          }}
          legends={[
            {
              dataFrom: "keys",
              anchor: "bottom",
              direction: "row",
              translateY: 36,
              itemWidth: 60,
              itemHeight: 18,
              itemTextColor: "#64748b",
              symbolSize: 10,
              symbolShape: "circle",
            },
          ]}
          theme={{
            text: { fontSize: 11, fontFamily: "var(--font-geist-sans)" },
            grid: { line: { stroke: "#f1f5f9", strokeWidth: 1 } },
            axis: { ticks: { text: { fill: "#94a3b8", fontSize: 11 } } },
            tooltip: {
              container: {
                background: "#1e293b",
                color: "#f8fafc",
                fontSize: 12,
                borderRadius: "10px",
                padding: "8px 12px",
                boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
