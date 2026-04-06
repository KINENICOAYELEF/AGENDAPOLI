"use client";

import { useState, useMemo } from "react";
import type { PfgDeportista, PfgEvaluacion, PfgSemana, PfgClasificacionClinica } from "@/types/pfg";
import { PFG_DOMINIOS_CLASIFICACION } from "@/lib/pfg/metrics-config";
import { generarAlertas, generarSugerenciasClasificacion } from "@/lib/pfg/calculations";
import PfgResumenSuperior from "./PfgResumenSuperior";
import PfgKpiCards from "./PfgKpiCards";
import PfgRadarChart from "./PfgRadarChart";
import PfgProgressCharts from "./PfgProgressCharts";
import PfgComparisonBars from "./PfgComparisonBars";
import PfgAlertPanel from "./PfgAlertPanel";
import PfgWeekBadge from "./PfgWeekBadge";
import PfgEvaluacionForm from "./PfgEvaluacionForm";
import PfgClasificacionClinicaForm from "./PfgClasificacionClinica";
import PfgInterpretacionClinica from "./PfgInterpretacionClinica";
import { motion } from "framer-motion";

interface Props {
  deportista: PfgDeportista;
  evaluaciones: PfgEvaluacion[];
  onSaveEvaluacion: (e: PfgEvaluacion) => Promise<void>;
  onDeleteEvaluacion: (evalId: string) => Promise<void>;
  onSaveClasificacion: (c: PfgClasificacionClinica) => Promise<void>;
}

type Tab = "resumen" | "evaluaciones" | "clasificacion" | "interpretacion";

export default function PfgDashboardAdmin({ deportista, evaluaciones, onSaveEvaluacion, onDeleteEvaluacion, onSaveClasificacion }: Props) {
  const [tab, setTab] = useState<Tab>("resumen");
  const [showEvalForm, setShowEvalForm] = useState(false);
  const [editEval, setEditEval] = useState<PfgEvaluacion | null>(null);
  const [selectedSemana, setSelectedSemana] = useState<PfgSemana>(0);

  const alertas = generarAlertas(evaluaciones, deportista.diagnosticoOperativo.compatibleDolorPatelofemoral);
  const semanasEvaluadas = new Set(evaluaciones.map((e) => e.semana));

  // Motor de sugerencias (#4, #5)
  const sugerencias = useMemo(
    () => generarSugerenciasClasificacion(deportista, evaluaciones),
    [deportista, evaluaciones]
  );

  const activeDomains = PFG_DOMINIOS_CLASIFICACION.filter(
    (d) => deportista.clasificacionClinica[d.key as keyof typeof deportista.clasificacionClinica] === true
  );

  const handleSaveEval = async (e: PfgEvaluacion) => {
    await onSaveEvaluacion(e);
    setShowEvalForm(false);
    setEditEval(null);
  };

  const handleClasificacionChange = async (c: PfgClasificacionClinica) => {
    await onSaveClasificacion(c);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "resumen", label: "📊 Resumen" },
    { key: "evaluaciones", label: "📋 Evaluaciones" },
    { key: "clasificacion", label: "🔬 Clasificación" },
    { key: "interpretacion", label: "🧠 Interpretación" },
  ];

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
      >
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">{deportista.alias}</h2>
            <p className="text-sm text-slate-500 mt-1">
              {deportista.edad} años · {deportista.sexo} · {deportista.categoriaKarate || "Sin categoría"} ·{" "}
              Rodilla {deportista.rodillaIndice}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold border ${
                deportista.diagnosticoOperativo.compatibleDolorPatelofemoral
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}>
                {deportista.diagnosticoOperativo.compatibleDolorPatelofemoral ? "✅ Compatible PFP" : "❌ No compatible PFP"}
              </span>
              {activeDomains.map((dom) => (
                <span key={dom.key} className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${dom.bgTw} ${dom.textTw} ${dom.borderTw}`}>
                  {dom.icon} {dom.label}
                </span>
              ))}
              {deportista.clasificacionClinica.confirmadaPorDocente && (
                <span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-700 border border-green-300">
                  ✅ Clasificación confirmada
                </span>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2">
            {([0, 5, 10] as const).map((s) => (
              <PfgWeekBadge key={s} semana={s} status={semanasEvaluadas.has(s) ? "completa" : "pendiente"} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Resumen Superior (#6) — siempre visible */}
      <PfgResumenSuperior deportista={deportista} evaluaciones={evaluaciones} />

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t.key
                ? "bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-sm"
                : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Resumen */}
      {tab === "resumen" && (
        <div className="space-y-6">
          <PfgKpiCards evaluaciones={evaluaciones} deportista={deportista} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PfgRadarChart evaluaciones={evaluaciones} />
            <PfgComparisonBars evaluaciones={evaluaciones} />
          </div>

          <PfgProgressCharts evaluaciones={evaluaciones} />

          {alertas.length > 0 && <PfgAlertPanel alertas={alertas} />}
        </div>
      )}

      {/* Tab: Evaluaciones */}
      {tab === "evaluaciones" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Nueva evaluación:</span>
            {([0, 5, 10] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setSelectedSemana(s); setEditEval(null); setShowEvalForm(true); }}
                disabled={semanasEvaluadas.has(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  semanasEvaluadas.has(s)
                    ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                }`}
              >
                + S{s}
              </button>
            ))}
          </div>

          {evaluaciones.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <p className="text-lg font-bold">Sin evaluaciones aún</p>
              <p className="text-sm mt-1">Crea la primera evaluación con los botones de arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...evaluaciones].sort((a, b) => a.semana - b.semana).map((ev) => (
                <div key={ev.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <PfgWeekBadge semana={ev.semana} />
                      <div>
                        <p className="font-bold text-slate-700">{ev.fecha}</p>
                        <p className="text-xs text-slate-400">Evaluador: {ev.evaluador}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-mono">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">Kujala</p>
                        <p className="text-lg font-black text-slate-700">{ev.kujala ?? "—"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">ENA Rep</p>
                        <p className="text-lg font-black text-slate-700">{ev.enaReposo ?? "—"}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-slate-400 font-bold">F. Rod</p>
                        <p className="text-lg font-black text-slate-700">{ev.fuerzaExtensionRodilla.mejorValor ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditEval(ev); setSelectedSemana(ev.semana); setShowEvalForm(true); }}
                        className="px-3 py-1 text-xs font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => { if (confirm("¿Eliminar esta evaluación?")) onDeleteEvaluacion(ev.id); }}
                        className="px-3 py-1 text-xs font-bold text-red-500 bg-red-50 rounded-lg hover:bg-red-100 transition"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  {ev.validezTest !== "valido" && (
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-medium">
                      ⚠️ Test {ev.validezTest}{ev.motivoInvalidez ? `: ${ev.motivoInvalidez}` : ""}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Clasificación (#3, #4, #5) */}
      {tab === "clasificacion" && (
        <PfgClasificacionClinicaForm
          value={deportista.clasificacionClinica}
          sugerencias={sugerencias}
          onChange={handleClasificacionChange}
        />
      )}

      {/* Tab: Interpretación Clínica (#10) */}
      {tab === "interpretacion" && (
        <PfgInterpretacionClinica deportista={deportista} evaluaciones={evaluaciones} />
      )}

      {/* Modal Evaluación */}
      {showEvalForm && (
        <PfgEvaluacionForm
          evaluacion={editEval}
          semana={selectedSemana}
          deportistaId={deportista.id}
          onSave={handleSaveEval}
          onCancel={() => { setShowEvalForm(false); setEditEval(null); }}
        />
      )}
    </div>
  );
}
