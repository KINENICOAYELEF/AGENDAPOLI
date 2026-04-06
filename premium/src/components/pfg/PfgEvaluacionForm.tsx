"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
import type { PfgEvaluacion, PfgSemana, PfgStepDown, PfgPruebaFuerza, PfgAlgometria } from "@/types/pfg";
import { PFG_POSICIONES_FUERZA } from "@/lib/pfg/metrics-config";
import PfgFuerzaPanel from "./PfgFuerzaPanel";
import PfgAlgometriaPanel from "./PfgAlgometriaPanel";
import PfgWeekBadge from "./PfgWeekBadge";

interface Props {
  evaluacion?: PfgEvaluacion | null;
  semana: PfgSemana;
  deportistaId: string;
  onSave: (e: PfgEvaluacion) => void;
  onCancel: () => void;
}

const EMPTY_FUERZA: PfgPruebaFuerza = { intento1: null, intento2: null, intento3: null, mejorValor: null, unidad: "N", torqueNm: null, notas: "" };
const EMPTY_STEPDOWN: PfgStepDown = { peorDolorENA: null, calidadMovimiento: null, observaciones: "" };
const EMPTY_ALGOMETRIA: PfgAlgometria = { zonaAnatomica: "", intento1: null, intento2: null, intento3: null, valorFinal: null, unidad: "kPa" };

const EMPTY_EVAL = (deportistaId: string, semana: PfgSemana): PfgEvaluacion => ({
  id: uuid(),
  deportistaId,
  semana,
  fecha: new Date().toISOString().split("T")[0],
  evaluador: "",
  kujala: null,
  enaReposo: null,
  stepDown: { ...EMPTY_STEPDOWN },
  fuerzaExtensionRodilla: { ...EMPTY_FUERZA },
  fuerzaAbduccionCadera: { ...EMPTY_FUERZA },
  fuerzaRotacionExternaCadera: { ...EMPTY_FUERZA },
  algometria: semana !== 5 ? { ...EMPTY_ALGOMETRIA } : null,
  validezTest: "valido",
  observaciones: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function PfgEvaluacionForm({ evaluacion, semana, deportistaId, onSave, onCancel }: Props) {
  const [data, setData] = useState<PfgEvaluacion>(evaluacion || EMPTY_EVAL(deportistaId, semana));

  const update = (patch: Partial<PfgEvaluacion>) => {
    setData((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
  };

  const handleSave = () => {
    if (!data.evaluador.trim()) {
      alert("El evaluador es obligatorio");
      return;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-800">
              {evaluacion ? "Editar Evaluación" : "Nueva Evaluación"}
            </h2>
            <PfgWeekBadge semana={semana} />
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Fecha y evaluador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Fecha *</label>
              <input type="date" value={data.fecha} onChange={(e) => update({ fecha: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Evaluador *</label>
              <input type="text" value={data.evaluador} onChange={(e) => update({ evaluador: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                placeholder="Nombre del evaluador" />
            </div>
          </div>

          {/* Kujala + ENA Reposo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Kujala (0–100)</label>
              <input type="number" min={0} max={100} value={data.kujala ?? ""} onChange={(e) => update({ kujala: e.target.value === "" ? null : parseInt(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="0–100" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">ENA Reposo (0–10)</label>
              <input type="number" min={0} max={10} step="0.5" value={data.enaReposo ?? ""} onChange={(e) => update({ enaReposo: e.target.value === "" ? null : parseFloat(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="0–10" />
            </div>
          </div>

          {/* Step-Down */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
            <div>
              <h4 className="font-bold text-sm text-slate-800">Tarea Provocativa Fija: Step-Down</h4>
              <p className="text-xs text-slate-500">Step-down 20 cm · 5 repeticiones · registrar peor dolor</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Peor Dolor ENA (0–10)</label>
                <input type="number" min={0} max={10} step="0.5" value={data.stepDown.peorDolorENA ?? ""}
                  onChange={(e) => update({ stepDown: { ...data.stepDown, peorDolorENA: e.target.value === "" ? null : parseFloat(e.target.value) } })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="0–10" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Calidad de Movimiento</label>
                <select value={data.stepDown.calidadMovimiento || ""}
                  onChange={(e) => update({ stepDown: { ...data.stepDown, calidadMovimiento: (e.target.value || null) as PfgStepDown["calidadMovimiento"] } })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="">— Seleccionar —</option>
                  <option value="buena">Buena</option>
                  <option value="aceptable">Aceptable</option>
                  <option value="deficiente">Deficiente</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Observaciones Step-Down</label>
              <input type="text" value={data.stepDown.observaciones}
                onChange={(e) => update({ stepDown: { ...data.stepDown, observaciones: e.target.value } })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                placeholder="Observaciones del step-down..." />
            </div>
          </div>

          {/* Pruebas de Fuerza */}
          <div className="space-y-4">
            <h4 className="font-bold text-sm text-slate-800">Pruebas de Fuerza Isométrica</h4>
            <PfgFuerzaPanel
              label={PFG_POSICIONES_FUERZA.extensionRodilla.label}
              posicion={PFG_POSICIONES_FUERZA.extensionRodilla.posicion}
              protocolo={PFG_POSICIONES_FUERZA.extensionRodilla.protocolo}
              value={data.fuerzaExtensionRodilla}
              onChange={(v) => update({ fuerzaExtensionRodilla: v })}
            />
            <PfgFuerzaPanel
              label={PFG_POSICIONES_FUERZA.abduccionCadera.label}
              posicion={PFG_POSICIONES_FUERZA.abduccionCadera.posicion}
              protocolo={PFG_POSICIONES_FUERZA.abduccionCadera.protocolo}
              value={data.fuerzaAbduccionCadera}
              onChange={(v) => update({ fuerzaAbduccionCadera: v })}
            />
            <PfgFuerzaPanel
              label={PFG_POSICIONES_FUERZA.rotacionExternaCadera.label}
              posicion={PFG_POSICIONES_FUERZA.rotacionExternaCadera.posicion}
              protocolo={PFG_POSICIONES_FUERZA.rotacionExternaCadera.protocolo}
              value={data.fuerzaRotacionExternaCadera}
              onChange={(v) => update({ fuerzaRotacionExternaCadera: v })}
            />
          </div>

          {/* Algometría — solo S0 y S10 */}
          {data.semana !== 5 && data.algometria && (
            <PfgAlgometriaPanel
              value={data.algometria}
              onChange={(v) => update({ algometria: v })}
            />
          )}

          {/* Validez y observaciones */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Validez del Test</label>
              <select value={data.validezTest} onChange={(e) => update({ validezTest: e.target.value as PfgEvaluacion["validezTest"] })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                <option value="valido">Válido</option>
                <option value="parcialmente_valido">Parcialmente válido</option>
                <option value="invalido">Inválido</option>
              </select>
            </div>
            {data.validezTest !== "valido" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Motivo</label>
                <input type="text" value={data.motivoInvalidez || ""} onChange={(e) => update({ motivoInvalidez: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                  placeholder="Razón de invalidez..." />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Observaciones Generales</label>
            <textarea value={data.observaciones} onChange={(e) => update({ observaciones: e.target.value })}
              rows={3} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none resize-none"
              placeholder="Observaciones de la evaluación..." />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">Cancelar</button>
          <button onClick={handleSave} className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm">
            💾 Guardar Evaluación
          </button>
        </div>
      </div>
    </div>
  );
}
