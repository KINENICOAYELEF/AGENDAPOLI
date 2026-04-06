"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
import type { PfgDeportista } from "@/types/pfg";
import { PFG_CAUSAS_ALTERNATIVAS_PREDEFINIDAS } from "@/lib/pfg/metrics-config";
import PfgDiagnosticoOperativoForm from "./PfgDiagnosticoOperativo";
import PfgClasificacionClinicaForm from "./PfgClasificacionClinica";

interface Props {
  deportista?: PfgDeportista | null;
  createdByUid: string;
  onSave: (d: PfgDeportista) => void;
  onCancel: () => void;
}

const EMPTY_DEPORTISTA = (uid: string): PfgDeportista => ({
  id: uuid(),
  alias: "",
  edad: 14,
  sexo: "Masculino",
  pesoKg: 0,
  tallaCm: 0,
  piernaDominante: "Derecha",
  rodillaIndice: "Derecha",
  categoriaKarate: "",
  nivelCompetitivo: "Competitivo regional",
  frecuenciaSemanalEntrenamiento: 3,
  anosPractica: 0,
  diagnosticoOperativo: {
    dolorRetroPeripatelar: false,
    dolorConSentadilla: false,
    dolorConOtraCargaFlexion: false,
    otraCargaFlexionDetalle: [],
    otrasCausasPrincipalesDescartadas: false,
    compatibleDolorPatelofemoral: false,
    causasAlternativas: PFG_CAUSAS_ALTERNATIVAS_PREDEFINIDAS.map((n) => ({
      nombre: n,
      estado: "no_evaluada" as const,
    })),
    observacionesClinicas: "",
  },
  clasificacionClinica: {
    sobrecargaSobreuso: false,
    deficitRendimientoMuscular: false,
    deficitControlMovimiento: false,
    deficitMovilidad: false,
    comentarioClinico: "",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdByUid: uid,
  status: "ACTIVO",
});

export default function PfgDeportistaForm({ deportista, createdByUid, onSave, onCancel }: Props) {
  const [data, setData] = useState<PfgDeportista>(
    deportista || EMPTY_DEPORTISTA(createdByUid)
  );
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const update = (patch: Partial<PfgDeportista>) => {
    setData((prev) => ({ ...prev, ...patch, updatedAt: new Date().toISOString() }));
  };

  const handleSave = () => {
    if (!data.alias.trim()) {
      alert("El alias/nombre es obligatorio");
      return;
    }
    onSave(data);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800">
            {deportista ? "Editar Deportista" : "Nuevo Deportista"}
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-slate-100 flex gap-2 shrink-0">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s as 1 | 2 | 3)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                step === s
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : "bg-slate-50 text-slate-400 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {s === 1 ? "1. Perfil" : s === 2 ? "2. Diagnóstico" : "3. Clasificación"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nombre o Alias *</label>
                <input type="text" value={data.alias} onChange={(e) => update({ alias: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
                  placeholder="Nombre o alias del deportista" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Edad</label>
                <input type="number" min={8} max={25} value={data.edad} onChange={(e) => update({ edad: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Sexo</label>
                <select value={data.sexo} onChange={(e) => update({ sexo: e.target.value as PfgDeportista["sexo"] })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Peso (kg)</label>
                <input type="number" step="0.1" min={0} value={data.pesoKg || ""} onChange={(e) => update({ pesoKg: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="kg" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Talla (cm)</label>
                <input type="number" step="0.1" min={0} value={data.tallaCm || ""} onChange={(e) => update({ tallaCm: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="cm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Pierna Dominante</label>
                <select value={data.piernaDominante} onChange={(e) => update({ piernaDominante: e.target.value as PfgDeportista["piernaDominante"] })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="Derecha">Derecha</option>
                  <option value="Izquierda">Izquierda</option>
                  <option value="Ambidiestro">Ambidiestro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rodilla Índice</label>
                <select value={data.rodillaIndice} onChange={(e) => update({ rodillaIndice: e.target.value as PfgDeportista["rodillaIndice"] })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="Derecha">Derecha</option>
                  <option value="Izquierda">Izquierda</option>
                  <option value="Bilateral">Bilateral</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Categoría Karate</label>
                <input type="text" value={data.categoriaKarate} onChange={(e) => update({ categoriaKarate: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                  placeholder="Ej: Kumite juvenil" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Nivel Competitivo</label>
                <select value={data.nivelCompetitivo} onChange={(e) => update({ nivelCompetitivo: e.target.value as PfgDeportista["nivelCompetitivo"] })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="Recreativo">Recreativo</option>
                  <option value="Competitivo regional">Competitivo regional</option>
                  <option value="Competitivo nacional">Competitivo nacional</option>
                  <option value="Elite">Elite</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Frecuencia Semanal</label>
                <input type="number" min={0} max={14} value={data.frecuenciaSemanalEntrenamiento} onChange={(e) => update({ frecuenciaSemanalEntrenamiento: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" placeholder="sesiones/sem" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Años de Práctica</label>
                <input type="number" min={0} max={20} value={data.anosPractica} onChange={(e) => update({ anosPractica: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Estado</label>
                <select value={data.status} onChange={(e) => update({ status: e.target.value as PfgDeportista["status"] })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none">
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                  <option value="EXCLUIDO">Excluido</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <PfgDiagnosticoOperativoForm
              value={data.diagnosticoOperativo}
              onChange={(v) => update({ diagnosticoOperativo: v })}
            />
          )}

          {step === 3 && (
            <PfgClasificacionClinicaForm
              value={data.clasificacionClinica}
              onChange={(v) => update({ clasificacionClinica: v })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <div className="flex gap-2">
            {step > 1 && (
              <button onClick={() => setStep((step - 1) as 1 | 2 | 3)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">
                ← Anterior
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition">
              Cancelar
            </button>
            {step < 3 ? (
              <button onClick={() => setStep((step + 1) as 1 | 2 | 3)}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm">
                Siguiente →
              </button>
            ) : (
              <button onClick={handleSave}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm">
                💾 Guardar Deportista
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
