"use client";

import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { mensajeProgreso, extraerValorMetrica, cambioAbsoluto, direccionCambio } from "@/lib/pfg/calculations";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";
import PfgRadarChart from "./PfgRadarChart";
import PfgDeportistaProgressCard from "./PfgDeportistaProgressCard";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
}

export default function PfgDeportistaView({ deportista, evaluaciones }: Props) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const latest = sorted[sorted.length - 1] || null;
  const first = sorted[0] || null;
  const progreso = mensajeProgreso(evaluaciones);

  const bigMetrics = [
    { key: "kujala", icon: "🏃" },
    { key: "enaReposo", icon: "💢" },
    { key: "fuerzaExtRodilla", icon: "💪" },
  ];

  return (
    <div id="pfg-deportista-pdf" className="bg-white max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-lg border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-8 py-8 text-white text-center">
        <p className="text-xs uppercase tracking-[0.3em] font-bold opacity-80 mb-1">
          Programa de Intervención Supervisada
        </p>
        <h1 className="text-2xl font-black tracking-tight">
          Dolor Patelofemoral en Karatekas
        </h1>
      </div>

      {/* Deportista info */}
      <div className="px-8 pt-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl">
            🥋
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{deportista.alias}</h2>
            <p className="text-sm text-slate-500">
              {deportista.edad} años · {deportista.categoriaKarate || "Karate"} · Rodilla {deportista.rodillaIndice}
            </p>
          </div>
        </div>
      </div>

      {/* 3 Big indicators */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-3 gap-4">
          {bigMetrics.map((m) => {
            const metric = PFG_METRICS[m.key];
            const current = latest ? extraerValorMetrica(latest, m.key) : null;
            const base = first && first !== latest ? extraerValorMetrica(first, m.key) : null;
            const delta = cambioAbsoluto(base, current);
            const dir = direccionCambio(delta, metric.higherIsBetter);

            return (
              <div key={m.key} className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-3xl font-black font-mono text-slate-800 mt-1">
                  {current !== null ? (Number.isInteger(current) ? current : current.toFixed(1)) : "—"}
                </p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                  {metric.labelCorto}
                </p>
                {delta !== null && (
                  <p className={`text-xs font-bold mt-1.5 ${
                    dir === "mejora" ? "text-green-600" : dir === "empeora" ? "text-red-500" : "text-slate-400"
                  }`}>
                    {dir === "mejora" ? "▲" : dir === "empeora" ? "▼" : "—"}{" "}
                    {delta > 0 ? "+" : ""}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini Radar */}
      <div className="px-8 pb-4">
        <div className="h-[280px]">
          <PfgRadarChart evaluaciones={evaluaciones} />
        </div>
      </div>

      {/* Progress bars */}
      <div className="px-8 pb-6">
        <PfgDeportistaProgressCard evaluaciones={evaluaciones} />
      </div>

      {/* Progress message */}
      <div className="px-8 pb-6">
        <div className={`text-center px-6 py-4 rounded-2xl font-bold ${
          progreso.tipo === "positivo"
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : progreso.tipo === "atencion"
            ? "bg-amber-50 text-amber-700 border border-amber-200"
            : "bg-slate-50 text-slate-600 border border-slate-200"
        }`}>
          <span className="text-lg">
            {progreso.tipo === "positivo" ? "✨ " : progreso.tipo === "atencion" ? "⚠️ " : ""}
            {progreso.mensaje}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 text-center">
        <p className="text-xs text-slate-400">
          Generado el {new Date().toLocaleDateString("es-CL")} · Programa de intervención supervisada
        </p>
      </div>
    </div>
  );
}
