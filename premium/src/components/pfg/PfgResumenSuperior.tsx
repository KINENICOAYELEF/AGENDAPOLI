"use client";

import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { extraerValorMetrica, cambioAbsoluto, direccionCambio, calcularEstadoGeneral } from "@/lib/pfg/calculations";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";
import { motion } from "framer-motion";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
}

const ESTADO_STYLE = {
  mejorando: { bg: "bg-green-100 border-green-300 text-green-700", label: "✨ Mejorando", icon: "📈" },
  estable: { bg: "bg-slate-100 border-slate-300 text-slate-600", label: "➡️ Estable", icon: "📊" },
  revisar_carga: { bg: "bg-red-100 border-red-300 text-red-700", label: "⚠️ Revisar carga", icon: "🔍" },
};

const SUMMARY_METRICS = [
  { key: "kujala", label: "Kujala", icon: "🏃" },
  { key: "enaStepDown", label: "ENA Step-Down", icon: "🪜" },
  { key: "fuerzaExtRodilla", label: "F. Rodilla", icon: "🦵" },
  { key: "fuerzaAbdCadera", label: "F. Cadera", icon: "💪" },
];

export default function PfgResumenSuperior({ deportista, evaluaciones }: Props) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const first = sorted[0] || null;
  const latest = sorted[sorted.length - 1] || null;
  const estado = calcularEstadoGeneral(evaluaciones);
  const estiloEstado = ESTADO_STYLE[estado];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Resumen Actual</p>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${estiloEstado.bg}`}>
          {estiloEstado.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SUMMARY_METRICS.map((m) => {
          const metric = PFG_METRICS[m.key];
          const current = latest ? extraerValorMetrica(latest, m.key) : null;
          const base = first && first !== latest ? extraerValorMetrica(first, m.key) : null;
          const delta = cambioAbsoluto(base, current);
          const dir = direccionCambio(delta, metric.higherIsBetter);

          return (
            <div key={m.key} className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <span className="text-lg">{m.icon}</span>
              <p className="text-2xl font-black font-mono text-slate-800 mt-1">
                {current !== null ? (Number.isInteger(current) ? current : current.toFixed(1)) : "—"}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-0.5">{m.label}</p>

              {delta !== null && (
                <p className={`text-xs font-bold mt-1 ${
                  dir === "mejora" ? "text-green-600" : dir === "empeora" ? "text-red-500" : "text-slate-400"
                }`}>
                  {dir === "mejora" ? "▲" : dir === "empeora" ? "▼" : "—"}{" "}
                  {delta > 0 ? "+" : ""}{Number.isInteger(delta) ? delta : delta.toFixed(1)}
                  <span className="text-[10px] ml-0.5 opacity-60">vs S{first?.semana}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
