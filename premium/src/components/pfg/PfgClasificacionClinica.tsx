"use client";

import type { PfgClasificacionClinica } from "@/types/pfg";
import { PFG_DOMINIOS_CLASIFICACION } from "@/lib/pfg/metrics-config";

interface Props {
  value: PfgClasificacionClinica;
  onChange: (v: PfgClasificacionClinica) => void;
}

export default function PfgClasificacionClinicaForm({ value, onChange }: Props) {
  const update = (patch: Partial<PfgClasificacionClinica>) => {
    onChange({ ...value, ...patch });
  };

  const activeDomains = PFG_DOMINIOS_CLASIFICACION.filter(
    (d) => value[d.key as keyof PfgClasificacionClinica] === true
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-bold text-slate-800">Clasificación Clínica</h3>
        <p className="text-xs text-slate-500 mt-1">Selecciona 1 o más dominios. No son excluyentes.</p>
      </div>

      {/* Dominios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PFG_DOMINIOS_CLASIFICACION.map((dom) => {
          const isActive = value[dom.key as keyof PfgClasificacionClinica] === true;
          return (
            <button
              key={dom.key}
              type="button"
              onClick={() => update({ [dom.key]: !isActive })}
              className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                isActive
                  ? `${dom.bgTw} ${dom.borderTw} ${dom.textTw} shadow-sm`
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xl">{dom.icon}</span>
                <span className="font-bold text-sm">{dom.label}</span>
                {isActive && (
                  <span className="ml-auto text-xs font-bold bg-white/60 px-2 py-0.5 rounded-full">✓</span>
                )}
              </div>
              <p className="text-xs leading-relaxed opacity-80">{dom.definicion}</p>
            </button>
          );
        })}
      </div>

      {/* Badges resumen */}
      {activeDomains.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Clasificación Activa</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {activeDomains.map((dom) => (
              <span
                key={dom.key}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${dom.bgTw} ${dom.textTw} ${dom.borderTw}`}
              >
                {dom.icon} {dom.label}
              </span>
            ))}
          </div>
          {value.comentarioClinico && (
            <p className="text-sm text-slate-600 italic">
              {value.comentarioClinico}
            </p>
          )}
        </div>
      )}

      {/* Comentario */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
          Comentario Clínico
        </label>
        <textarea
          value={value.comentarioClinico}
          onChange={(e) => update({ comentarioClinico: e.target.value })}
          rows={3}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none resize-none"
          placeholder="Observaciones adicionales sobre la clasificación..."
        />
      </div>
    </div>
  );
}
