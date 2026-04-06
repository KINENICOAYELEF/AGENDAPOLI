"use client";

import type { PfgDeportista, PfgEvaluacion, PfgClasificacionClinica } from "@/types/pfg";
import { PFG_DOMINIOS_CLASIFICACION } from "@/lib/pfg/metrics-config";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
}

export default function PfgInterpretacionClinica({ deportista, evaluaciones }: Props) {
  const dx = deportista.diagnosticoOperativo;
  const clas = deportista.clasificacionClinica;

  const criteriosCumplidos = [
    { label: "Dolor retro/peripatelar", cumple: dx.dolorRetroPeripatelar },
    { label: "Dolor con sentadilla", cumple: dx.dolorConSentadilla },
    { label: "Dolor con otra carga en flexión", cumple: dx.dolorConOtraCargaFlexion },
    { label: "Causas principales descartadas", cumple: dx.otrasCausasPrincipalesDescartadas },
  ];

  const activeDomains = PFG_DOMINIOS_CLASIFICACION.filter(
    (d) => clas[d.key as keyof PfgClasificacionClinica] === true
  );

  const sugeridos = PFG_DOMINIOS_CLASIFICACION.filter(
    (d) => {
      const sug = clas.sugerencias[d.key as keyof typeof clas.sugerencias];
      return sug && sug.sugerida;
    }
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
      <h3 className="text-lg font-bold text-slate-800">🧠 Interpretación Clínica</h3>

      {/* Compatible PFP */}
      <div className={`px-4 py-3 rounded-xl border-2 font-bold text-center text-sm ${
        dx.compatibleDolorPatelofemoral
          ? "bg-emerald-50 border-emerald-300 text-emerald-700"
          : "bg-slate-50 border-slate-200 text-slate-500"
      }`}>
        {dx.compatibleDolorPatelofemoral
          ? "✅ Compatible con Dolor Patelofemoral"
          : "❌ No compatible con Dolor Patelofemoral"
        }
      </div>

      {/* Criterios cumplidos */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Criterios de Inclusión</p>
        <div className="grid grid-cols-2 gap-2">
          {criteriosCumplidos.map((c) => (
            <div key={c.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
              c.cumple ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-400"
            }`}>
              <span>{c.cumple ? "✓" : "✗"}</span>
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Clasificación sugerida vs confirmada */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Sugerida (automática)</p>
          {sugeridos.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {sugeridos.map((dom) => (
                <span key={dom.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${dom.bgTw} ${dom.textTw} ${dom.borderTw} opacity-70`}>
                  {dom.icon} {dom.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin sugerencias activas</p>
          )}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Confirmada por docente
            {clas.confirmadaPorDocente && <span className="ml-1 text-green-600">✅</span>}
          </p>
          {activeDomains.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {activeDomains.map((dom) => (
                <span key={dom.key} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${dom.bgTw} ${dom.textTw} ${dom.borderTw}`}>
                  {dom.icon} {dom.label}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Sin clasificación confirmada</p>
          )}
        </div>
      </div>

      {/* Comentario clínico */}
      {clas.comentarioClinico && (
        <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
          <p className="text-xs font-bold uppercase text-slate-400 mb-1">Comentario</p>
          <p className="text-sm text-slate-700">{clas.comentarioClinico}</p>
        </div>
      )}
    </div>
  );
}
