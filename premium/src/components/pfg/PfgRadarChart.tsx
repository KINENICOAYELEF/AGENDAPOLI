"use client";

import { ResponsiveRadar } from "@nivo/radar";
import type { PfgEvaluacion } from "@/types/pfg";
import { buildRadarData } from "@/lib/pfg/calculations";

interface Props {
  evaluaciones: PfgEvaluacion[];
}

const WEEK_COLORS: Record<string, string> = {
  S0: "#6366f1",   // indigo
  S5: "#f59e0b",   // amber
  S10: "#10b981",  // emerald
};

export default function PfgRadarChart({ evaluaciones }: Props) {
  if (evaluaciones.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-slate-300 text-sm font-medium">
        Sin datos para el radar
      </div>
    );
  }

  const data = buildRadarData(evaluaciones);
  const keys = [...new Set(evaluaciones.map((e) => `S${e.semana}`))].sort();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">
        Radar de Rendimiento
      </p>
      <div className="h-[350px]">
        <ResponsiveRadar
          data={data}
          keys={keys}
          indexBy="metric"
          maxValue={100}
          margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
          curve="linearClosed"
          borderWidth={2}
          borderColor={{ from: "color" }}
          gridLevels={5}
          gridShape="circular"
          gridLabelOffset={16}
          enableDots={true}
          dotSize={8}
          dotColor={{ theme: "background" }}
          dotBorderWidth={2}
          dotBorderColor={{ from: "color" }}
          colors={(d) => WEEK_COLORS[d.key as string] || "#94a3b8"}
          fillOpacity={0.15}
          blendMode="multiply"
          animate={true}
          motionConfig="gentle"
          legends={[
            {
              anchor: "top-left",
              direction: "column",
              translateX: -50,
              translateY: -30,
              itemWidth: 60,
              itemHeight: 18,
              itemTextColor: "#64748b",
              symbolSize: 10,
              symbolShape: "circle",
            },
          ]}
          theme={{
            text: { fontSize: 11, fontFamily: "var(--font-geist-sans)" },
            grid: { line: { stroke: "#e2e8f0", strokeWidth: 1 } },
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
