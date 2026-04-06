"use client";

import { ResponsiveLine } from "@nivo/line";
import type { PfgEvaluacion } from "@/types/pfg";
import { extraerValorMetrica } from "@/lib/pfg/calculations";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";

interface Props {
  evaluaciones: PfgEvaluacion[];
}

export default function PfgProgressCharts({ evaluaciones }: Props) {
  if (evaluaciones.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-slate-300 text-sm font-medium">
        Sin datos para gráficos
      </div>
    );
  }

  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);

  const buildSeries = (keys: string[]) =>
    keys.map((key) => ({
      id: PFG_METRICS[key].labelCorto,
      color: PFG_METRICS[key].colorNivo,
      data: sorted
        .map((ev) => {
          const val = extraerValorMetrica(ev, key);
          return val !== null ? { x: `S${ev.semana}`, y: val } : null;
        })
        .filter(Boolean) as { x: string; y: number }[],
    }));

  const painSeries = buildSeries(["kujala", "enaReposo", "enaStepDown"]);
  const strengthSeries = buildSeries(["fuerzaExtRodilla", "fuerzaAbdCadera", "fuerzaReCadera"]);

  const chartProps = {
    margin: { top: 20, right: 20, bottom: 40, left: 50 },
    xScale: { type: "point" as const },
    yScale: { type: "linear" as const, min: "auto" as const, max: "auto" as const },
    curve: "monotoneX" as const,
    enablePoints: true,
    pointSize: 10,
    pointColor: { theme: "background" as const },
    pointBorderWidth: 2,
    pointBorderColor: { from: "serieColor" as const },
    enableArea: true,
    areaOpacity: 0.08,
    useMesh: true,
    animate: true,
    motionConfig: "gentle" as const,
    enableGridX: false,
    theme: {
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
    },
    legends: [
      {
        anchor: "bottom" as const,
        direction: "row" as const,
        translateY: 36,
        itemWidth: 90,
        itemHeight: 18,
        itemTextColor: "#64748b",
        symbolSize: 10,
        symbolShape: "circle" as const,
      },
    ],
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Dolor & Función */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Función & Dolor
        </p>
        <div className="h-[280px]">
          <ResponsiveLine
            data={painSeries}
            colors={(d) => {
              const map: Record<string, string> = {};
              painSeries.forEach((s) => { map[s.id] = s.color; });
              return map[d.id as string] || "#94a3b8";
            }}
            {...chartProps}
          />
        </div>
      </div>

      {/* Fuerza */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
          Fuerza Isométrica
        </p>
        <div className="h-[280px]">
          <ResponsiveLine
            data={strengthSeries}
            colors={(d) => {
              const map: Record<string, string> = {};
              strengthSeries.forEach((s) => { map[s.id] = s.color; });
              return map[d.id as string] || "#94a3b8";
            }}
            {...chartProps}
          />
        </div>
      </div>
    </div>
  );
}
