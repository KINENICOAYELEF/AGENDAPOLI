"use client";

import type { PfgDiagnosticoOperativo, PfgTareaCargaFlexion } from "@/types/pfg";
import { PFG_CAUSAS_ALTERNATIVAS_PREDEFINIDAS, PFG_TAREAS_CARGA_FLEXION } from "@/lib/pfg/metrics-config";

interface Props {
  value: PfgDiagnosticoOperativo;
  onChange: (v: PfgDiagnosticoOperativo) => void;
}

export default function PfgDiagnosticoOperativoForm({ value, onChange }: Props) {
  const compatible =
    value.dolorRetroPeripatelar &&
    value.dolorConSentadilla &&
    value.dolorConOtraCargaFlexion &&
    value.otrasCausasPrincipalesDescartadas;

  const update = (patch: Partial<PfgDiagnosticoOperativo>) => {
    const next = { ...value, ...patch };
    // Recalcular compatibilidad
    next.compatibleDolorPatelofemoral =
      next.dolorRetroPeripatelar &&
      next.dolorConSentadilla &&
      next.dolorConOtraCargaFlexion &&
      next.otrasCausasPrincipalesDescartadas;
    onChange(next);
  };

  const toggleTarea = (tarea: PfgTareaCargaFlexion) => {
    const current = value.otraCargaFlexionDetalle || [];
    const next = current.includes(tarea)
      ? current.filter((t) => t !== tarea)
      : [...current, tarea];
    update({ otraCargaFlexionDetalle: next });
  };

  const updateCausaEstado = (nombre: string, estado: 'descartada' | 'sospechada' | 'no_evaluada') => {
    const causas = [...value.causasAlternativas];
    const idx = causas.findIndex((c) => c.nombre === nombre);
    if (idx >= 0) {
      causas[idx] = { ...causas[idx], estado };
    }
    update({ causasAlternativas: causas });
  };

  return (
    <div className="space-y-6">
      {/* Título de sección */}
      <div>
        <h3 className="text-lg font-bold text-slate-800">Diagnóstico Operativo</h3>
        <p className="text-xs text-slate-500 mt-1">Criterios de compatibilidad con dolor patelofemoral</p>
      </div>

      {/* Badge resultado */}
      <div className={`px-4 py-3 rounded-xl border-2 font-bold text-center text-sm ${
        compatible
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-slate-50 border-slate-200 text-slate-500"
      }`}>
        {compatible ? "✅ Compatible con Dolor Patelofemoral" : "❌ No compatible con Dolor Patelofemoral"}
      </div>

      {/* Criterios de inclusión */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Criterios de Inclusión (todos deben cumplirse)</p>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={value.dolorRetroPeripatelar}
            onChange={(e) => update({ dolorRetroPeripatelar: e.target.checked })}
            className="mt-0.5 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <span className="font-semibold text-slate-700 group-hover:text-slate-900">Dolor retro/peripatelar</span>
            <p className="text-xs text-slate-400">Dolor retroperipatelar o peripatelar presente</p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={value.dolorConSentadilla}
            onChange={(e) => update({ dolorConSentadilla: e.target.checked })}
            className="mt-0.5 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <span className="font-semibold text-slate-700 group-hover:text-slate-900">Dolor reproducible con sentadilla</span>
          </div>
        </label>

        <div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={value.dolorConOtraCargaFlexion}
              onChange={(e) => update({ dolorConOtraCargaFlexion: e.target.checked })}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <span className="font-semibold text-slate-700 group-hover:text-slate-900">
                Dolor con al menos otra tarea de carga en flexión
              </span>
            </div>
          </label>
          {value.dolorConOtraCargaFlexion && (
            <div className="ml-8 mt-3 flex flex-wrap gap-2">
              {PFG_TAREAS_CARGA_FLEXION.map((t) => {
                const active = (value.otraCargaFlexionDetalle || []).includes(t.key);
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => toggleTarea(t.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      active
                        ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {active && "✓ "}{t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={value.otrasCausasPrincipalesDescartadas}
            onChange={(e) => update({ otrasCausasPrincipalesDescartadas: e.target.checked })}
            className="mt-0.5 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <div>
            <span className="font-semibold text-slate-700 group-hover:text-slate-900">
              Otras causas principales descartadas
            </span>
            <p className="text-xs text-slate-400">No existe otra causa principal más probable de dolor anterior de rodilla</p>
          </div>
        </label>
      </div>

      {/* Causas alternativas */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Causas Alternativas</p>
        <div className="space-y-2">
          {value.causasAlternativas.map((causa) => (
            <div key={causa.nombre} className="flex items-center justify-between gap-3 py-1.5 border-b border-slate-100 last:border-0">
              <span className="text-sm text-slate-700 flex-1">{causa.nombre}</span>
              <div className="flex gap-1">
                {(['descartada', 'sospechada', 'no_evaluada'] as const).map((est) => (
                  <button
                    key={est}
                    type="button"
                    onClick={() => updateCausaEstado(causa.nombre, est)}
                    className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                      causa.estado === est
                        ? est === 'descartada'
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : est === 'sospechada'
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : 'bg-slate-100 text-slate-600 border border-slate-300'
                        : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-200'
                    }`}
                  >
                    {est === 'descartada' ? '✓ Desc.' : est === 'sospechada' ? '⚠ Sosp.' : '— N/E'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Observaciones Clínicas
        </label>
        <textarea
          value={value.observacionesClinicas}
          onChange={(e) => update({ observacionesClinicas: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none resize-none"
          placeholder="Observaciones clínicas breves..."
        />
      </div>
    </div>
  );
}
