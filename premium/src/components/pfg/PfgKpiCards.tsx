"use client";

import { motion } from "framer-motion";
import type { PfgEvaluacion, PfgDeportista } from "@/types/pfg";
import { PFG_METRICS } from "@/lib/pfg/metrics-config";
import { extraerValorMetrica, cambioAbsoluto, cambioPorcentual, direccionCambio } from "@/lib/pfg/calculations";

interface Props {
  evaluaciones: PfgEvaluacion[];
  deportista: PfgDeportista;
}

const DISPLAYED_METRICS = ["kujala", "enaReposo", "enaStepDown", "fuerzaExtRodilla", "fuerzaAbdCadera", "fuerzaReCadera"];

export default function PfgKpiCards({ evaluaciones, deportista }: Props) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const latest = sorted[sorted.length - 1] || null;
  const first = sorted[0] || null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {DISPLAYED_METRICS.map((key, i) => {
        const metric = PFG_METRICS[key];
        const currentVal = latest ? extraerValorMetrica(latest, key) : null;
        const baseVal = first && first !== latest ? extraerValorMetrica(first, key) : null;
        const delta = cambioAbsoluto(baseVal, currentVal);
        const deltaPct = cambioPorcentual(baseVal, currentVal);
        const dir = direccionCambio(delta, metric.higherIsBetter);

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
              {metric.labelCorto}
            </p>
            <p className="text-3xl font-black font-mono text-slate-800 mt-1">
              {currentVal !== null ? (Number.isInteger(currentVal) ? currentVal : currentVal.toFixed(1)) : "—"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">{metric.unit}</p>

            {delta !== null && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <span
                  className={`text-xs font-bold ${
                    dir === "mejora"
                      ? "text-green-600"
                      : dir === "empeora"
                      ? "text-red-500"
                      : "text-slate-400"
                  }`}
                >
                  {dir === "mejora" ? "▲" : dir === "empeora" ? "▼" : "—"}{" "}
                  {delta > 0 ? "+" : ""}
                  {Number.isInteger(delta) ? delta : delta.toFixed(1)}
                  {deltaPct !== null && (
                    <span className="ml-1 opacity-70">
                      ({deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(0)}%)
                    </span>
                  )}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">vs S{first?.semana ?? 0}</p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
