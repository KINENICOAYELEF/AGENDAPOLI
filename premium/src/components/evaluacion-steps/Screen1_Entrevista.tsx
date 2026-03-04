import React, { useState } from "react";
import { EvaluacionInicial, FocusArea } from "@/types/clinica";
import { computeIrritability, computeLoadTrafficLight } from "@/lib/auto-engine";
import { EvalMinimoType } from "@/lib/ai/schemas";

export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];
const TIPO_INICIO = ['Súbito', 'Insidioso', 'Post-quirúrgico'];
const SINTOMAS_DOMINANTES = ['Dolor punzante', 'Quemazón', 'Hormigueo', 'Adormecimiento', 'Debilidad', 'Inestabilidad', 'Bloqueo', 'Inflamación', 'Chasquido'];

export function Screen1_Entrevista({ formData, updateFormData, isClosed }: Screen1Props) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const evalMinimoResult: EvalMinimoType | null = formData.aiOutputs?.evalMinimo || null;

    const handleGenerateChecklist = async () => {
        setIsGenerating(true);
        setAiError(null);
        try {
            const response = await fetch('/api/ai/eval-minimo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        interview: formData.interview,
                        autoEngineOutputs: { trafficLight: engine.traffic, irritability: engine.irritability }
                    }
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al conectar con la IA');

            updateFormData(prev => ({
                aiOutputs: { ...(prev.aiOutputs || {}), evalMinimo: data.data }
            }));
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleApplyToChecklist = () => {
        if (!evalMinimoResult) return;
        updateFormData(prev => ({
            guidedExam: {
                ...(prev.guidedExam || {}),
                checklistSuggested: evalMinimoResult.exam_plan
            }
        }));
        alert("Checklist inyectado exitosamente para el Examen Físico ✔");
    };

    const interview = formData.interview || { focos: [], psfs: [] };
    const focos = interview.focos || [];

    const engine = React.useMemo(() => {
        const irritability = computeIrritability(interview);
        const traffic = computeLoadTrafficLight(irritability, interview);
        return { irritability, traffic };
    }, [interview]);

    const showNeuroRedFlags = focos.some(f => f.dominantSymptoms.includes('Hormigueo') || f.dominantSymptoms.includes('Adormecimiento') || f.dominantSymptoms.includes('Debilidad'));
    const isManualOverride = interview.safetyStatusSuggested && interview.safetyStatusSuggested !== engine.traffic.color;

    const handleUpdateInterview = (patch: any) => {
        updateFormData(prev => ({
            interview: { ...prev.interview, ...patch }
        }));
    };

    const handleUpdateFoco = (index: number, patch: Partial<FocusArea>) => {
        const newFocos = [...focos];
        newFocos[index] = { ...newFocos[index], ...patch };
        handleUpdateInterview({ focos: newFocos });
    };

    const handleAddFoco = () => {
        if (focos.length >= 3) return;
        const newFoco: FocusArea = {
            id: Date.now().toString(),
            isPrincipal: focos.length === 0,
            region: '',
            lado: 'N/A',
            onsetType: '',
            onsetDuration: '',
            context: '',
            dominantSymptoms: [],
            painCurrent: '',
            painWorst24h: '',
            painBest24h: '',
            pattern24h: '',
            morningStiffness: '',
            aggravatingFactors: [],
            easingFactors: [],
            afterEffect: 'Nunca',
            settlingTime: '',
            associatedSymptoms: []
        };
        handleUpdateInterview({ focos: [...focos, newFoco] });
    };

    const handleRemoveFoco = (index: number) => {
        const newFocos = [...focos];
        newFocos.splice(index, 1);
        handleUpdateInterview({ focos: newFocos });
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* ENCABEZADO */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Entrevista Integral</h2>
                <p className="text-sm text-slate-500 mt-1">Registra el motivo de consulta, mapea el dolor e identifica banderas rojas relevantes.</p>
            </div>

            <div className={`p-5 rounded-2xl border transition-colors shadow-sm ${engine.traffic.color === 'Rojo' ? 'bg-rose-50 border-rose-200' : engine.traffic.color === 'Amarillo' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                            <span className="text-xl">🚦</span> Triage Clínico Automático
                        </h3>
                        <p className="text-xs text-slate-600 mb-3">Calculado en tiempo real basado en banderas rojas, factores BPS e irritabilidad general reportada.</p>

                        <div className="space-y-2 mb-4 bg-white/50 rounded-xl p-3 border border-black/5">
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${engine.traffic.color === 'Verde' ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-slate-700">Verde (Carga Activa Permitida)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${engine.traffic.color === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-slate-700">Amarillo (Progresión Cautelosa)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${engine.traffic.color === 'Rojo' ? 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.5)]' : 'bg-slate-300'}`}></span>
                                <span className="text-xs font-bold text-slate-700">Rojo (Precaución / Evaluación Médica)</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            {engine.traffic.reasons.map((r, i) => (
                                <div key={i} className="flex gap-2 items-start text-xs text-slate-700">
                                    <span className="text-slate-400 mt-0.5">•</span>
                                    <span>{r}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full md:w-[350px] shrink-0 border-l border-black/5 pl-0 md:pl-6 space-y-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <label className="flex items-center justify-between cursor-pointer mb-2">
                                <span className="text-xs font-bold text-slate-700">Levantar Alarma Manual (Override)</span>
                                <input type="checkbox" className="sr-only peer" checked={!!interview.hasUrgency} disabled={isClosed} onChange={(e) => handleUpdateInterview({ hasUrgency: e.target.checked })} />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>

                            {interview.hasUrgency && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="block text-[10px] font-bold text-rose-600 mb-1 uppercase">Justificación Obligatoria de Alarma</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:border-rose-400 focus:bg-white min-h-[60px]"
                                        placeholder="Describa trauma grave, dolor no mecánico, fiebre, pérdida de peso, historia oncológica..."
                                        value={interview.redFlagsAction || ''}
                                        onChange={(e) => handleUpdateInterview({ redFlagsAction: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                            )}
                        </div>

                        {showNeuroRedFlags && (
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 animate-in fade-in duration-500">
                                <span className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-2"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> Banderas Rojas Neurológicas</span>
                                <p className="text-[10px] text-rose-700 mb-3">Has reportado síntomas neurológicos periféricos. Descarta afirmativamente estos cuadros graves:</p>
                                <div className="space-y-2">
                                    {['Alteración esfínteres', 'Anestesia en silla de montar', 'Déficit motor motor progresivo'].map(flag => {
                                        const isChecked = !!(interview.redFlagsCheck || {})[flag];
                                        return (
                                            <label key={flag} className="flex items-start gap-2 cursor-pointer">
                                                <input type="checkbox" className="mt-0.5 rounded border-rose-300 text-rose-500 focus:ring-rose-200 h-3.5 w-3.5" checked={isChecked} onChange={e => {
                                                    const nextCheck = { ...(interview.redFlagsCheck || {}) };
                                                    if (e.target.checked) nextCheck[flag] = true; else delete nextCheck[flag];
                                                    handleUpdateInterview({ redFlagsCheck: nextCheck });
                                                }} disabled={isClosed} />
                                                <span className="text-[11px] font-medium text-rose-900 leading-tight">{flag}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* SECCION 2: FOCOS DE ATENCION (MAPA DE SINTOMAS) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                        <span className="text-indigo-500">📍</span> Focos de Atención ({focos.length}/3)
                    </h3>
                    {!isClosed && focos.length < 3 && (
                        <button onClick={handleAddFoco} className="text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            Agregar Foco
                        </button>
                    )}
                </div>

                {focos.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 text-center">
                        <p className="text-slate-500 text-sm">No hay focos registrados. Agrega uno para comenzar.</p>
                    </div>
                )}

                {focos.map((foco, idx) => (
                    <div key={foco.id} className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 w-full">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${foco.isPrincipal ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-600'}`}>
                                    {idx + 1}
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                                    <select
                                        className="bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                                        value={foco.region}
                                        onChange={(e) => handleUpdateFoco(idx, { region: e.target.value })}
                                        disabled={isClosed}
                                    >
                                        <option value="">Región...</option>
                                        {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <select
                                        className="bg-white border border-slate-200 text-slate-700 font-semibold text-sm rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                                        value={foco.lado}
                                        onChange={(e) => handleUpdateFoco(idx, { lado: e.target.value as any })}
                                        disabled={isClosed}
                                    >
                                        {LADOS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>

                                </div>
                            </div>
                            {!isClosed && focos.length > 1 && (
                                <button onClick={() => handleRemoveFoco(idx)} className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors shrink-0">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>

                        {/* CUERPO DEL FOCO */}
                        <div className="p-4 space-y-6">

                            {/* Historia de Instalación */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Inicio</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                        value={foco.onsetType}
                                        onChange={(e) => handleUpdateFoco(idx, { onsetType: e.target.value })}
                                        disabled={isClosed}
                                    >
                                        <option value="">Selecciona...</option>
                                        {TIPO_INICIO.map(ti => <option key={ti} value={ti}>{ti}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Tiempo de Evolución</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: 3 semanas, 2 meses..."
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                        value={foco.onsetDuration}
                                        onChange={(e) => handleUpdateFoco(idx, { onsetDuration: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Contexto / Mecanismo</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Levantando peso libre, Caída..."
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                        value={foco.context}
                                        onChange={(e) => handleUpdateFoco(idx, { context: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>

                            {/* Dolor y Agravantes */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Intensidad (EVA)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5">Actual</span>
                                            <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-slate-50 border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none" value={foco.painCurrent} onChange={e => handleUpdateFoco(idx, { painCurrent: e.target.value })} disabled={isClosed} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5">Peor (24h)</span>
                                            <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-slate-50 border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none" value={foco.painWorst24h} onChange={e => handleUpdateFoco(idx, { painWorst24h: e.target.value })} disabled={isClosed} />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-slate-400 block mb-0.5">Mejor (24h)</span>
                                            <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-slate-50 border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none" value={foco.painBest24h} onChange={e => handleUpdateFoco(idx, { painBest24h: e.target.value })} disabled={isClosed} />
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Factores Agravantes</label>
                                        <input type="text" placeholder="Ej: Correr > 10 min, Bajar escaleras" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                            value={foco.aggravatingFactors.join(', ')}
                                            onChange={e => handleUpdateFoco(idx, { aggravatingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} disabled={isClosed}
                                        />
                                    </div>

                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Comportamiento (Irritabilidad)</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block mb-0.5">Efecto posterior a actividad</span>
                                            <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-sm" value={foco.afterEffect} onChange={e => handleUpdateFoco(idx, { afterEffect: e.target.value as any })} disabled={isClosed}>
                                                <option>Nunca</option>
                                                <option>A veces</option>
                                                <option>Siempre</option>
                                            </select>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-400 block mb-0.5">Tiempo en calmarse</span>
                                            <input type="text" placeholder="Ej: < 30 min, 2 horas, Constante" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-sm" value={foco.settlingTime} onChange={e => handleUpdateFoco(idx, { settlingTime: e.target.value })} disabled={isClosed} />
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Factores de Alivio</label>
                                        <input type="text" placeholder="Ej: Reposo, Calor, NSAIDs" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                            value={foco.easingFactors.join(', ')}
                                            onChange={e => handleUpdateFoco(idx, { easingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} disabled={isClosed}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Síntomas Checkboxes */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">Naturaleza de Síntomas</label>
                                <div className="flex flex-wrap gap-2">
                                    {SINTOMAS_DOMINANTES.map(sym => {
                                        const isActive = foco.dominantSymptoms.includes(sym);
                                        return (
                                            <button
                                                key={sym}
                                                onClick={() => {
                                                    if (isClosed) return;
                                                    const next = isActive ? foco.dominantSymptoms.filter(s => s !== sym) : [...foco.dominantSymptoms, sym];
                                                    handleUpdateFoco(idx, { dominantSymptoms: next });
                                                }}
                                                className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors border ${isActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                            >
                                                {sym}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Signo Comparable Subjetivo */}
                            <div className="pt-4 mt-2 border-t border-slate-100">
                                <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide text-indigo-500 flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                    Signo Comparable (Actividad Estrella)
                                </label>
                                <div className="flex gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                                    <input type="text" placeholder="Ej: Sentadilla profunda" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400"
                                        value={foco.comparableSign?.name || ''}
                                        onChange={e => handleUpdateFoco(idx, { comparableSign: { ...(foco.comparableSign as any) || {}, name: e.target.value } })} disabled={isClosed} />
                                    <input type="number" min="0" max="10" placeholder="EVA" className="w-20 bg-white border border-slate-200 text-center rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400"
                                        value={foco.comparableSign?.painLevel || ''}
                                        onChange={e => handleUpdateFoco(idx, { comparableSign: { ...(foco.comparableSign as any) || {}, painLevel: e.target.value } })} disabled={isClosed} />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* SECCION 3: LIMITACION GLOBAL & PSFS */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg mb-4">
                        <span className="text-emerald-500">🏃</span> Función Global y Participación
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Limitación Funcional Principal de la Persona</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-emerald-400 min-h-[60px]"
                                placeholder="Ej: 'No puedo agacharme a recoger a mi hijo' o 'Duele al caminar más de 3 cuadras'..."
                                value={interview.functionalLimitationPrimary || ''}
                                onChange={(e) => handleUpdateInterview({ functionalLimitationPrimary: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Expectativas y Meta Paciente</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-indigo-400 min-h-[60px]"
                                placeholder="Ej: Me gustaría volver a correr mi Maratón en 3 meses..."
                                value={interview.personGoal || ''}
                                onChange={(e) => handleUpdateInterview({ personGoal: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>

                {/* BLOQUE OUTCOMES (PSFS Obligatorio, SANE opcional) */}
                <div className="pt-4 border-t border-slate-100">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                        <span className="text-indigo-500 text-lg">🎯</span> Escalas Funcionales (Outcomes)
                    </h4>

                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-[11px] font-bold text-indigo-800 uppercase tracking-wide">PSFS (Actividades Específicas) *</label>
                                {!isClosed && (
                                    <button onClick={() => handleUpdateInterview({ psfs: [...(interview.psfs || []), { activity: '', score: 0, linkedFocusId: focos[0]?.id || '' }] })} className="text-xs text-indigo-600 font-bold hover:text-indigo-800">+ Añadir Tarea</button>
                                )}
                            </div>
                            <div className="space-y-2">
                                {(interview.psfs || []).map((pItem: any, i: number) => (
                                    <div key={i} className="flex gap-2">
                                        <input type="text" placeholder="Ej. Subir escaleras" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400" value={pItem.activity} onChange={e => {
                                            const newPsfs = [...interview.psfs];
                                            newPsfs[i].activity = e.target.value;
                                            handleUpdateInterview({ psfs: newPsfs });
                                        }} disabled={isClosed} />
                                        <input type="number" min="0" max="10" placeholder="0-10" className="w-20 bg-white border border-slate-200 text-center rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400" value={pItem.score} onChange={e => {
                                            const newPsfs = [...interview.psfs];
                                            newPsfs[i].score = Number(e.target.value);
                                            handleUpdateInterview({ psfs: newPsfs });
                                        }} disabled={isClosed} />
                                        {!isClosed && (
                                            <button onClick={() => {
                                                const newPsfs = [...interview.psfs];
                                                newPsfs.splice(i, 1);
                                                handleUpdateInterview({ psfs: newPsfs });
                                            }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {(!interview.psfs || interview.psfs.length === 0) && (
                                    <div className="text-xs text-indigo-800/60 italic p-2 bg-white/50 rounded-lg text-center border border-indigo-100/50">
                                        No hay actividades PSFS. Agrega al menos una para medir el progreso funcional.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-3 border-t border-indigo-100/50">
                            <label className="block text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-wide">SANE (Single Assessment Numeric Evaluation) - Opcional</label>
                            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200">
                                <span className="text-xs font-medium text-slate-600 w-32 shrink-0">¿Cómo clasificaría hoy su estado general (0-100%)?</span>
                                <input type="range" min="0" max="100" className="flex-1 accent-indigo-500" value={interview.sane || 0} onChange={e => handleUpdateInterview({ sane: Number(e.target.value) })} disabled={isClosed} />
                                <div className="w-12 text-center text-sm font-bold text-indigo-700 bg-indigo-50 py-1 rounded-lg border border-indigo-100">
                                    {interview.sane || 0}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECCION 4: BPS (Flags mínimas) */}
            <div className="bg-slate-50 border text-sm border-slate-200 rounded-2xl p-5 shadow-inner">
                <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
                    <span className="text-amber-500">🧠</span> Notas Biopsicosociales / Creencias
                </h3>
                <textarea
                    className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:border-amber-400 min-h-[80px]"
                    placeholder="Factores estresores (Amarillas), conductuales (Kinesiophobia, Catastrofización), barreras laborares (Azules/Negras)..."
                    value={interview.bpsFactors?.join('\n') || ''}
                    onChange={(e) => handleUpdateInterview({ bpsFactors: e.target.value.split('\n').filter(Boolean) })}
                    disabled={isClosed}
                />
                {/* SECCION 5: Asistencia IA (Eval. Mínima) */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-2xl p-5 shadow-sm mt-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                <span className="text-xl">✨</span> Asistencia IA: Sugerir Examen Físico
                            </h3>
                            <p className="text-xs text-indigo-700/70 mt-1">Gemini analiza la entrevista e irritabilidad para priorizar el examen clínico seguro.</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                            {!evalMinimoResult && !isGenerating && (
                                <button onClick={handleGenerateChecklist} disabled={isClosed} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition shadow-sm border border-indigo-700">
                                    Generar Sugerencia
                                </button>
                            )}
                            {isGenerating && (
                                <span className="text-xs text-indigo-600 font-bold animate-pulse flex items-center gap-2 bg-indigo-100 px-4 py-2 rounded-xl border border-indigo-200">
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" /></svg>
                                    Analizando caso...
                                </span>
                            )}
                            {evalMinimoResult && !isGenerating && (
                                <>
                                    <button onClick={handleGenerateChecklist} disabled={isClosed} className="bg-white text-indigo-600 border border-indigo-200 text-xs font-bold px-3 py-2 rounded-xl hover:bg-indigo-50 transition">
                                        Regenerar
                                    </button>
                                    <button onClick={handleApplyToChecklist} disabled={isClosed} className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 shadow-sm border border-indigo-700">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        Aplicar checklist al Examen
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {aiError && (
                        <div className="bg-rose-50 text-rose-700 p-3 rounded-xl text-xs font-medium border border-rose-200 mb-4 animate-in fade-in">
                            ❌ Error IA: {aiError}
                        </div>
                    )}

                    {evalMinimoResult && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                            {evalMinimoResult.missing_inputs?.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 font-medium">
                                    <span className="mr-1">⚠️</span> <strong>Falta información clave clínica:</strong> {evalMinimoResult.missing_inputs.join(", ")}
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-100/50">
                                    <h4 className="font-bold text-[11px] text-indigo-800/70 uppercase tracking-widest mb-3 flex justify-between items-center">
                                        Pruebas Esenciales
                                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">{evalMinimoResult.exam_plan.essential.length}</span>
                                    </h4>
                                    <ul className="space-y-3">
                                        {evalMinimoResult.exam_plan.essential.map((item: any, i: number) => (
                                            <li key={i} className="text-xs text-slate-700 leading-relaxed border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                                <span className="font-bold text-slate-800 block mb-0.5">{item.label}</span>
                                                <span className="opacity-80 block">{item.why}</span>
                                                <span className="text-[10px] text-indigo-500/80 mt-1 block font-medium">Técnica: {item.how}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-indigo-100/50">
                                        <h4 className="font-bold text-[11px] text-indigo-800/70 uppercase tracking-widest mb-3">Qué buscar activamente</h4>
                                        <ul className="list-disc pl-4 space-y-1.5">
                                            {evalMinimoResult.what_to_look_for.map((item: string, i: number) => (
                                                <li key={i} className="text-xs text-slate-700 leading-relaxed">{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                    {evalMinimoResult.stop_rules?.length > 0 && (
                                        <div className="bg-rose-50/80 text-rose-800 p-4 rounded-xl text-xs border border-rose-100 flex gap-3">
                                            <span className="text-xl">🛑</span>
                                            <div>
                                                <strong className="block mb-1.5 uppercase font-black text-[10px] tracking-wide">Reglas de detención del examen</strong>
                                                <ul className="list-disc pl-4 space-y-1 opacity-90">
                                                    {evalMinimoResult.stop_rules.map((rule: string, idx: number) => <li key={idx} className="leading-relaxed">{rule}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
