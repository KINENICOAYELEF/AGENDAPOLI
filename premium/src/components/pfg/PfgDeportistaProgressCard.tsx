"use client";

import type { PfgEvaluacion } from "@/types/pfg";
import { extraerValorMetrica, cambioAbsoluto, direccionCambio } from "@/lib/pfg/calculations";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";

interface Props {
  evaluaciones: PfgEvaluacion[];
}

const DISPLAY_METRICS = ["kujala", "enaReposo", "fuerzaExtRodilla", "fuerzaAbdCadera"];

export default function PfgDeportistaProgressCard({ evaluaciones }: Props) {
  if (evaluaciones.length < 2) return null;

  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  return (
    <div className="space-y-3">
      {DISPLAY_METRICS.map((key) => {
        const metric = PFG_METRICS[key];
        const val0 = extraerValorMetrica(first, key);
        const valN = extraerValorMetrica(last, key);
        const delta = cambioAbsoluto(val0, valN);
        const dir = direccionCambio(delta, metric.higherIsBetter);

        const maxVal = metric.range[1];
        const pct0 = val0 !== null ? (val0 / maxVal) * 100 : 0;
        const pctN = valN !== null ? (valN / maxVal) * 100 : 0;

        // Invertir visual para dolor
        const barPct0 = metric.higherIsBetter ? pct0 : 100 - pct0;
        const barPctN = metric.higherIsBetter ? pctN : 100 - pctN;

        return (
          <div key={key} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">{metric.labelCorto}</span>
              <span className={`text-xs font-bold ${
                dir === "mejora" ? "text-green-600" : dir === "empeora" ? "text-red-500" : "text-slate-400"
              }`}>
                {dir === "mejora" ? "▲" : dir === "empeora" ? "▼" : "—"}{" "}
                {delta !== null ? `${delta > 0 ? "+" : ""}${Number.isInteger(delta) ? delta : delta.toFixed(1)}` : "—"}{" "}
                {metric.unit}
              </span>
            </div>
            <div className="flex gap-1 h-3">
              <div className="flex-1 bg-indigo-100 rounded-full overflow-hidden" title={`S${first.semana}`}>
                <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${Math.min(Math.max(barPct0, 2), 100)}%` }} />
              </div>
              <div className="flex-1 bg-emerald-100 rounded-full overflow-hidden" title={`S${last.semana}`}>
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(Math.max(barPctN, 2), 100)}%` }} />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>S{first.semana}: {val0 ?? "—"}</span>
              <span>S{last.semana}: {valN ?? "—"}</span>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-indigo-400 rounded-sm inline-block" />Evaluación inicial</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 rounded-sm inline-block" />Evaluación más reciente</span>
      </div>
    </div>
  );
}
