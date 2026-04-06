"use client";

import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { mensajeProgreso, extraerValorMetrica, cambioAbsoluto, direccionCambio, calcularEstadoGeneral } from "@/lib/pfg/calculations";
import PfgRadarChart from "./PfgRadarChart";
import PfgDeportistaProgressCard from "./PfgDeportistaProgressCard";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
}

// (#11) Lenguaje simple para el deportista
const SIMPLE_METRICS = [
  { key: "kujala", icon: "🏃", label: "Función", desc: "Qué tan bien funciona tu rodilla" },
  { key: "enaStepDown", icon: "🪜", label: "Dolor en carga", desc: "Dolor al bajar escalón", invertLabel: true },
  { key: "fuerzaExtRodilla", icon: "🦵", label: "Fuerza", desc: "Fuerza de tu pierna" },
];

const ESTADO_MSG = {
  mejorando: { text: "¡Vas muy bien! Tu rodilla está mejorando 💪", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  estable: { text: "Tu evolución es estable. Seguimos trabajando 📊", color: "bg-slate-50 text-slate-600 border-slate-200" },
  revisar_carga: { text: "Necesitamos revisar tu carga de entrenamiento ⚠️", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function PfgDeportistaView({ deportista, evaluaciones }: Props) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const latest = sorted[sorted.length - 1] || null;
  const first = sorted[0] || null;
  const estado = calcularEstadoGeneral(evaluaciones);
  const estadoMsg = ESTADO_MSG[estado];

  return (
    <div id="pfg-deportista-pdf" className="bg-white max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-lg border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-8 py-8 text-white text-center">
        <p className="text-xs uppercase tracking-[0.3em] font-bold opacity-80 mb-1">
          Tu Resumen de Progreso
        </p>
        <h1 className="text-2xl font-black tracking-tight">
          Programa de Rodilla
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

      {/* 3 Big indicators — lenguaje simple (#11) */}
      <div className="px-8 py-6">
        <div className="grid grid-cols-3 gap-4">
          {SIMPLE_METRICS.map((m) => {
            const current = latest ? extraerValorMetrica(latest, m.key) : null;
            const base = first && first !== latest ? extraerValorMetrica(first, m.key) : null;
            const delta = cambioAbsoluto(base, current);
            const higherIsBetter = !m.invertLabel;
            const dir = direccionCambio(delta, higherIsBetter);

            return (
              <div key={m.key} className="text-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <span className="text-2xl">{m.icon}</span>
                <p className="text-3xl font-black font-mono text-slate-800 mt-1">
                  {current !== null ? (Number.isInteger(current) ? current : current.toFixed(1)) : "—"}
                </p>
                <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">
                  {m.label}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{m.desc}</p>
                {delta !== null && (
                  <p className={`text-xs font-bold mt-1.5 ${
                    dir === "mejora" ? "text-green-600" : dir === "empeora" ? "text-red-500" : "text-slate-400"
                  }`}>
                    {dir === "mejora" ? "▲ Mejorando" : dir === "empeora" ? "▼ Revisar" : "— Estable"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Control de movimiento — simple */}
      {latest && (
        <div className="px-8 pb-4">
          <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100 text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-1">🎯 Control de movimiento</p>
            <p className="text-lg font-black text-violet-700">
              {latest.stepDown.calidadMovimiento === "buena" ? "Buen control ✓"
                : latest.stepDown.calidadMovimiento === "aceptable" ? "Aceptable — seguir trabajando"
                : latest.stepDown.calidadMovimiento === "deficiente" ? "Necesita trabajo"
                : "Sin evaluar"}
            </p>
          </div>
        </div>
      )}

      {/* Mini Radar (#12 — visualización longitudinal S0 vs S5 vs S10) */}
      <div className="px-8 pb-4">
        <PfgRadarChart evaluaciones={evaluaciones} />
      </div>

      {/* Progress bars */}
      <div className="px-8 pb-6">
        <PfgDeportistaProgressCard evaluaciones={evaluaciones} />
      </div>

      {/* Progreso general — lenguaje simple (#11) */}
      <div className="px-8 pb-6">
        <div className={`text-center px-6 py-4 rounded-2xl font-bold border ${estadoMsg.color}`}>
          <span className="text-lg">{estadoMsg.text}</span>
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
