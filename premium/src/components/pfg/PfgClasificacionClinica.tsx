"use client";

import type { PfgClasificacionClinica, PfgSugerenciaClasificacion } from "@/types/pfg";
import { PFG_DOMINIOS_CLASIFICACION } from "@/lib/pfg/metrics-config";

interface Props {
  value: PfgClasificacionClinica;
  sugerencias: PfgSugerenciaClasificacion;
  onChange: (v: PfgClasificacionClinica) => void;
}

const CONFIANZA_BADGE = {
  fuerte: { bg: "bg-green-100 text-green-700 border-green-300", label: "Sugerencia fuerte" },
  debil: { bg: "bg-amber-100 text-amber-700 border-amber-300", label: "Sugerencia débil" },
  ninguna: { bg: "bg-slate-100 text-slate-400 border-slate-200", label: "Sin sugerencia" },
};

export default function PfgClasificacionClinicaForm({ value, sugerencias, onChange }: Props) {
  const update = (patch: Partial<PfgClasificacionClinica>) => {
    onChange({ ...value, ...patch });
  };

  const toggleDomain = (key: string, currentVal: boolean) => {
    update({ [key]: !currentVal });
  };

  const handleConfirmar = () => {
    update({
      confirmadaPorDocente: true,
      fechaConfirmacion: new Date().toISOString(),
    });
  };

  const handleDesconfirmar = () => {
    update({
      confirmadaPorDocente: false,
      fechaConfirmacion: null,
    });
  };

  const aplicarSugerencias = () => {
    update({
      sobrecargaSobreuso: sugerencias.sobrecargaSobreuso.sugerida,
      deficitRendimientoMuscular: sugerencias.deficitRendimientoMuscular.sugerida,
      deficitControlMovimiento: sugerencias.deficitControlMovimiento.sugerida,
      deficitMovilidad: sugerencias.deficitMovilidad.sugerida,
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800">🔬 Hipótesis de Clasificación Clínica</h3>
          <p className="text-xs text-slate-500 mt-1">Sugerida por hallazgos · Editable y confirmable por docente</p>
        </div>
        {value.confirmadaPorDocente ? (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-300">
            ✅ Confirmada
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
            ⏳ Pendiente de confirmación
          </span>
        )}
      </div>

      {/* Botón para aplicar sugerencias automáticas */}
      <button
        type="button"
        onClick={aplicarSugerencias}
        className="w-full px-4 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition"
      >
        🤖 Aplicar sugerencias basadas en hallazgos
      </button>

      {/* Dominios con sugerencias */}
      <div className="space-y-3">
        {PFG_DOMINIOS_CLASIFICACION.map((dom) => {
          const domKey = dom.key as keyof PfgSugerenciaClasificacion;
          const sug = sugerencias[domKey];
          const isActive = value[dom.key as keyof PfgClasificacionClinica] === true;

          return (
            <div
              key={dom.key}
              className={`rounded-2xl border-2 p-4 transition-all ${
                isActive
                  ? `${dom.bgTw} ${dom.borderTw}`
                  : "bg-white border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => toggleDomain(dom.key, isActive)}
                  className="flex items-center gap-2 text-left flex-1"
                >
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center text-xs font-bold transition-all ${
                    isActive
                      ? `${dom.borderTw} ${dom.textTw} ${dom.bgTw}`
                      : "border-slate-300 bg-white text-transparent"
                  }`}>
                    {isActive && "✓"}
                  </div>
                  <span className="text-xl">{dom.icon}</span>
                  <span className={`font-bold text-sm ${isActive ? dom.textTw : "text-slate-600"}`}>
                    {dom.label}
                  </span>
                </button>

                {/* Badge de sugerencia */}
                <span className={`shrink-0 inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${CONFIANZA_BADGE[sug.confianza].bg}`}>
                  {CONFIANZA_BADGE[sug.confianza].label}
                </span>
              </div>

              {/* Motivo de la sugerencia */}
              <p className="text-xs text-slate-500 mt-2 ml-10 leading-relaxed">
                {sug.motivo}
              </p>

              {/* Definición del dominio */}
              <p className="text-xs text-slate-400 mt-1 ml-10 italic leading-relaxed">
                {dom.definicion}
              </p>
            </div>
          );
        })}
      </div>

      {/* Comentario clínico */}
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

      {/* Botón confirmar/desconfirmar */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
        {value.confirmadaPorDocente ? (
          <button
            type="button"
            onClick={handleDesconfirmar}
            className="px-4 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-xl hover:bg-slate-200 transition"
          >
            🔓 Reabrir para edición
          </button>
        ) : (
          <button
            type="button"
            onClick={handleConfirmar}
            className="px-5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition shadow-sm"
          >
            ✅ Confirmar Clasificación
          </button>
        )}
      </div>
    </div>
  );
}
