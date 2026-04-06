"use client";

import type { KujalaResult } from "@/lib/pfg/kujala-utils";

interface Props {
  result: KujalaResult;
  previousResult?: KujalaResult | null;
}

export default function PfgKujalaSummary({ result, previousResult }: Props) {
  const delta = previousResult && previousResult.completed && result.completed
    ? result.totalScore - previousResult.totalScore
    : null;

  const deltaLabel = delta !== null
    ? delta > 0 ? "Mejoró" : delta < 0 ? "Empeoró" : "Sin cambio"
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {result.instrumentName}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {new Date(result.answeredAt).toLocaleDateString("es-CL")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-slate-800">
              {result.totalScore}
            </span>
            <span className="text-sm font-semibold text-slate-400 ml-0.5">
              /{result.maxScore}
            </span>
          </div>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${
            result.completed
              ? "bg-green-100 text-green-700 border-green-300"
              : "bg-amber-100 text-amber-700 border-amber-300"
          }`}>
            {result.completed ? "Completo" : `${result.completionPercent}%`}
          </span>
        </div>
      </div>

      {delta !== null && (
        <div className={`mt-3 px-3 py-2 rounded-xl text-xs font-bold text-center border ${
          delta > 0
            ? "bg-green-50 text-green-700 border-green-200"
            : delta < 0
            ? "bg-red-50 text-red-600 border-red-200"
            : "bg-slate-50 text-slate-500 border-slate-200"
        }`}>
          {deltaLabel} · Δ = {delta > 0 ? "+" : ""}{delta} puntos vs medición previa
        </div>
      )}
    </div>
  );
}
