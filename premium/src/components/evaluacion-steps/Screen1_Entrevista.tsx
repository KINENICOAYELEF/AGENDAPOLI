import React, { useState, useEffect } from "react";
import { EvaluacionInicial, KineFocusArea, KineComparableSign } from "@/types/clinica";
import { computeIrritability, computeLoadTrafficLight, suggestPainMechanism } from "@/lib/auto-engine";
import { InterviewAssistType } from "@/lib/ai/schemas";

export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];
const TIPO_INICIO = ['Súbito', 'Insidioso', 'Post-quirúrgico'];
const SINTOMAS_DOMINANTES = ['Dolor punzante', 'Quemazón', 'Hormigueo', 'Adormecimiento', 'Debilidad', 'Inestabilidad', 'Bloqueo', 'Inflamación', 'Chasquido', 'Pesadez', 'Fallo'];

export function Screen1_Entrevista({ formData, updateFormData, isClosed }: Screen1Props) {
    const interview = (formData.interview || { focos: [] }) as any;
    const focos = interview.focos || [];

    // State for AI Assistant
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<InterviewAssistType | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [freeNarrativeText, setFreeNarrativeText] = useState("");

    // --- Deterministic Engine ---
    const engine = React.useMemo(() => {
        const irritability = computeIrritability(interview);
        const traffic = computeLoadTrafficLight(irritability, interview);
        const mechanism = suggestPainMechanism(interview);
        return { irritability, traffic, mechanism };
    }, [interview]);

    const showNeuroRedFlags = focos.some((f: any) => (f.symptomNature || []).some((s: string) => ['Hormigueo', 'Adormecimiento', 'Debilidad'].includes(s)));

    // --- Helpers ---
    const handleUpdateInterview = (patch: any) => {
        updateFormData(prev => ({
            interview: { ...(prev.interview || {}), ...patch }
        }));
    };

    const handleUpdateFoco = (index: number, patch: any) => {
        const newFocos = [...focos];
        newFocos[index] = { ...newFocos[index], ...patch };
        handleUpdateInterview({ focos: newFocos });
    };

    const handleAddFoco = () => {
        if (focos.length >= 3) return;
        const newFoco = {
            id: Date.now().toString(),
            isPrincipal: focos.length === 0,
            region: '',
            side: 'N/A',
            onsetType: '',
            onsetDuration: '',
            course2w: '',
            mainLimitation: '',
            freeNarrative: '',
            painScaleId: 'EVA',
            painCurrent: '',
            painWorst24h: '',
            painBest24h: '',
            pattern24h: '',
            morningStiffness: '',
            wakesAtNight: false,
            afterEffectFreq: 'Nunca',
            settlingTime: '',
            provocationEase: 'Media',
            symptomNature: [],
            symptomRadiates: 'Local',
            symptomAssociated: [],
            psfs: [],
            fastIcfActivities: [],
            sportContextActive: false,
            prevTreatmentsTags: []
        } as unknown as KineFocusArea;
        handleUpdateInterview({ focos: [...focos, newFoco] });
    };

    const handleRemoveFoco = (index: number) => {
        if (focos.length <= 1) return; // Prevent removing last focus if you want, or handle empty state natively.
        const newFocos = [...focos];
        newFocos.splice(index, 1);
        handleUpdateInterview({ focos: newFocos });
    };

    // --- AI Assistant Handler ---
    const handleAskAI = async () => {
        if (!freeNarrativeText.trim()) return;
        setIsAiLoading(true);
        setAiError(null);
        setAiSuggestions(null);

        try {
            const res = await fetch('/api/ai/interview-assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ freeNarrative: freeNarrativeText })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error de IA');

            setAiSuggestions(data.data as InterviewAssistType);
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">

            {/* STICKY SUMMARY WIDGET (Engine Outputs) */}
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 pb-3 pt-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">Anamnesis Próxima</h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">Razonamiento Clínico Kine Real</p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                        <div className={`px-3 py-1.5 rounded-full border flex items-center gap-1.5 shadow-sm 
                             ${engine.traffic.color === 'Rojo' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                engine.traffic.color === 'Amarillo' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                                    'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                            <span className={`w-2 h-2 rounded-full ${engine.traffic.color === 'Rojo' ? 'bg-rose-500' : engine.traffic.color === 'Amarillo' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                            Triage {engine.traffic.color}
                        </div>
                        <div className="px-3 py-1.5 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200 flex items-center shadow-sm">
                            Irritabilidad {engine.irritability.level}
                        </div>
                        <div className="px-3 py-1.5 rounded-full border bg-indigo-50 text-indigo-800 border-indigo-200 flex items-center shadow-sm">
                            Mecanismo: {engine.mechanism.dominant}
                        </div>
                    </div>
                </div>
            </div>

            {/* A. RELATO LIBRE & AI ASSISTANT */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="text-xl">🎙️</span> A. Relato Libre del Episodio
                    </h3>
                </div>
                <div className="p-4 space-y-4">
                    <textarea
                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-3 outline-none focus:border-indigo-400 focus:bg-white min-h-[100px] transition-colors"
                        placeholder="Escribe aquí lo que cuenta el paciente. Ej: 'Ayer jugando a la pelota sentí un pinchazo fuerte en el muslo derecho al picar, tuve que salir y hoy me duele mucho al caminar y no puedo subir escalas...'"
                        value={freeNarrativeText}
                        onChange={(e) => setFreeNarrativeText(e.target.value)}
                        disabled={isClosed}
                    />

                    <div className="flex justify-end relative">
                        <button
                            onClick={handleAskAI}
                            disabled={isAiLoading || isClosed || !freeNarrativeText.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-2"
                        >
                            {isAiLoading ? (
                                <><svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" /></svg> Analizando...</>
                            ) : (
                                <>✨ Extraer Tags Estructurados</>
                            )}
                        </button>
                    </div>

                    {aiError && (
                        <div className="text-xs text-rose-600 font-medium bg-rose-50 p-3 rounded-lg border border-rose-200">
                            Error Extrayendo IA: {aiError}
                        </div>
                    )}

                    {aiSuggestions && (
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h4 className="text-xs font-bold text-indigo-900 mb-3 uppercase tracking-wider flex items-center gap-2">
                                Insights Extraídos (Confianza: {aiSuggestions.confidence})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">Sugerencias Estructuradas:</span>
                                    <ul className="space-y-2">
                                        {aiSuggestions.proposedSelections.map((sel, idx) => (
                                            <li key={idx} className="bg-white px-3 py-2 rounded-lg text-xs border border-indigo-100/50 shadow-sm">
                                                <strong className="text-indigo-700">{sel.field}:</strong> {sel.value}
                                                <span className="block text-[10px] text-slate-500 mt-0.5">{sel.rationale}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                {aiSuggestions.missingQuestions && aiSuggestions.missingQuestions.length > 0 && (
                                    <div>
                                        <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1.5 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Preguntas Sugeridas al Paciente:
                                        </span>
                                        <ul className="space-y-1.5">
                                            {aiSuggestions.missingQuestions.map((q, idx) => (
                                                <li key={idx} className="bg-amber-50/50 text-amber-900 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200/50">
                                                    "{q}"
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* B Y C. TRIAGE Y SAFETY (Engine Driven + Manual Toggles) */}
            <div className={`p-5 rounded-2xl border transition-colors shadow-sm ${engine.traffic.color === 'Rojo' ? 'bg-rose-50 border-rose-200' : engine.traffic.color === 'Amarillo' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
                            <span className="text-xl">🚦</span> B. Triage de Carga Automático
                        </h3>
                        <p className="text-xs text-slate-600 mb-3 block">Calculado en T.R. (Banderas, BPS, Irritabilidad)</p>

                        <div className="space-y-1">
                            <p className="text-sm font-bold text-slate-800 mb-2">Resolución: {engine.traffic.rules.progressionRule || engine.traffic.rules.redFlagRule || engine.traffic.rules.painRule}</p>
                            {engine.traffic.reasons.map((r, i) => (
                                <div key={i} className="flex gap-2 items-start text-xs text-slate-700">
                                    <span className="text-slate-400 mt-0.5">•</span>
                                    <span>{r}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full md:w-[350px] shrink-0 border-l border-black/5 pl-0 md:pl-6 space-y-4">
                        {/* Manual Override URGENCE */}
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 transition-all">
                            <label className="flex items-center justify-between cursor-pointer mb-2">
                                <span className="text-xs font-bold text-slate-700">Override: Urgencia Médica Pura</span>
                                <input type="checkbox" className="sr-only peer" checked={!!interview.hasUrgency} disabled={isClosed} onChange={(e) => handleUpdateInterview({ hasUrgency: e.target.checked })} />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                            </label>

                            {interview.hasUrgency && (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-300 mt-3">
                                    <label className="block text-[10px] font-bold text-rose-600 mb-1 uppercase">Justificación Alarma</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 outline-none focus:border-rose-400 min-h-[40px]"
                                        placeholder="Trauma alta E, Pérdida de peso..."
                                        value={interview.redFlagsAction || ''}
                                        onChange={(e) => handleUpdateInterview({ redFlagsAction: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Neuro Red Flags */}
                        {showNeuroRedFlags && (
                            <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 animate-in fade-in duration-500">
                                <span className="text-xs font-bold text-rose-800 flex items-center gap-1 mb-2">Banderas Rojas Neurológicas Confirmar:</span>
                                <div className="space-y-2">
                                    {['Alteración esfínteres', 'Anestesia en silla de montar', 'Déficit motor progresivo'].map(flag => {
                                        const isChecked = !!(interview.redFlagsCheck || {})[flag];
                                        return (
                                            <label key={flag} className="flex items-start gap-2 cursor-pointer bg-white/50 p-1.5 rounded-lg">
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

            {/* D. FOCOS CLINICOS (Acordeón iterativo) */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
                        <span className="text-indigo-500">📍</span> C. Mapa de Síntomas (Focos: {focos.length}/3)
                    </h3>
                    {!isClosed && focos.length < 3 && (
                        <button onClick={handleAddFoco} className="text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors border border-indigo-100 shadow-sm flex items-center gap-1">
                            + Foco Nuevo
                        </button>
                    )}
                </div>

                {focos.length === 0 && (
                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-2xl p-8 text-center animate-pulse">
                        <p className="text-slate-500 text-sm font-medium">Pulsa "+ Foco Nuevo" para mapear el primer dolor.</p>
                    </div>
                )}

                <div className="space-y-4">
                    {focos.map((foco: any, idx: number) => (
                        <div key={foco.id} className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-visible">
                            <div className="bg-slate-50 border-b border-slate-200 py-3 px-4 flex items-center justify-between gap-4 rounded-t-2xl">
                                <div className="flex items-center gap-3 w-full">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${foco.isPrincipal ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200 ring-offset-1' : 'bg-slate-200 text-slate-600'}`}>
                                        F{idx + 1}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full max-w-2xl">
                                        <select
                                            className="bg-white border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                                            value={foco.region}
                                            onChange={(e) => handleUpdateFoco(idx, { region: e.target.value })}
                                            disabled={isClosed}
                                        >
                                            <option value="">Región...</option>
                                            {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                        <select
                                            className="bg-white border border-slate-200 text-slate-700 font-semibold text-xs sm:text-sm rounded-lg px-2.5 py-1.5 outline-none focus:border-indigo-400"
                                            value={foco.lado}
                                            onChange={(e) => handleUpdateFoco(idx, { lado: e.target.value as any })}
                                            disabled={isClosed}
                                        >
                                            {LADOS.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                                {!isClosed && (
                                    <button onClick={() => handleRemoveFoco(idx)} className="text-slate-400 hover:text-rose-500 transition-colors shrink-0 bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>

                            {/* Foco Body */}
                            <div className="p-4 sm:p-5 space-y-6">

                                {/* Row 1: Instalación y Naturaleza */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Cronología</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                                    value={foco.onsetType} onChange={(e) => handleUpdateFoco(idx, { onsetType: e.target.value })} disabled={isClosed}>
                                                    <option value="">Tipo Inicio...</option>
                                                    {TIPO_INICIO.map(ti => <option key={ti} value={ti}>{ti}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <input type="text" placeholder="Tiempo (Ej: 2 sem)" className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                                    value={foco.onsetDuration} onChange={(e) => handleUpdateFoco(idx, { onsetDuration: e.target.value })} disabled={isClosed} />
                                            </div>
                                        </div>
                                        <div>
                                            <input type="text" placeholder="Contexto/Mecanismo (Ej: Cayó corriendo)" className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg px-3 py-2 outline-none focus:bg-white focus:border-indigo-400"
                                                value={foco.context} onChange={(e) => handleUpdateFoco(idx, { context: e.target.value })} disabled={isClosed} />
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Perfil Síntomas (Tags)</h4>
                                        <div className="flex flex-wrap gap-1.5">
                                            {SINTOMAS_DOMINANTES.map(sym => {
                                                const currentTags = foco.symptomNature || foco.dominantSymptoms || [];
                                                const isActive = currentTags.includes(sym);
                                                return (
                                                    <button
                                                        key={sym}
                                                        onClick={() => {
                                                            if (isClosed) return;
                                                            const next = isActive ? currentTags.filter((s: string) => s !== sym) : [...currentTags, sym];
                                                            handleUpdateFoco(idx, { symptomNature: next });
                                                        }}
                                                        className={`px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-semibold transition-all border shadow-sm ${isActive ? 'bg-indigo-600 text-white border-indigo-700 ring-1 ring-indigo-300' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    >
                                                        {sym}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                {/* Row 2: Irritabilidad ENA/EVA */}
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Niveles de Dolor (EVA/ENA)</h4>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <span className="text-[10px] text-slate-500 font-bold block mb-1">Actual</span>
                                                <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-white border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none shadow-sm" value={foco.painCurrent} onChange={e => handleUpdateFoco(idx, { painCurrent: e.target.value })} disabled={isClosed} />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[10px] text-slate-500 font-bold block mb-1">Peor 24h</span>
                                                <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-white border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none shadow-sm" value={foco.painWorst24h} onChange={e => handleUpdateFoco(idx, { painWorst24h: e.target.value })} disabled={isClosed} />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-[10px] text-slate-500 font-bold block mb-1">Mejor 24h</span>
                                                <input type="number" min="0" max="10" placeholder="0-10" className="w-full bg-white border border-slate-200 text-center rounded-lg py-1.5 focus:border-indigo-400 outline-none shadow-sm" value={foco.painBest24h} onChange={e => handleUpdateFoco(idx, { painBest24h: e.target.value })} disabled={isClosed} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Rigidez y Recuperación Tissue</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="text-[10px] text-slate-500 font-bold block mb-1">Dolor Post-Carga</span>
                                                <select className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-sm shadow-sm font-medium" value={foco.afterEffect} onChange={e => handleUpdateFoco(idx, { afterEffect: e.target.value as any })} disabled={isClosed}>
                                                    <option>Nunca</option>
                                                    <option>A veces</option>
                                                    <option>Siempre</option>
                                                </select>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-500 font-bold block mb-1">Tiempo de calma</span>
                                                <input type="text" placeholder="Ej: < 30min, 1 hora..." className="w-full bg-white border border-slate-200 text-slate-700 rounded-lg px-3 py-1.5 outline-none text-sm shadow-sm" value={foco.settlingTime} onChange={e => handleUpdateFoco(idx, { settlingTime: e.target.value })} disabled={isClosed} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Row 3: Agravantes y Aliviantes */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <input type="text" placeholder="Agravantes Claves (Ej: Bajar escalas)" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-indigo-400"
                                            value={(foco.aggravatingFactors || []).join(', ')}
                                            onChange={e => handleUpdateFoco(idx, { aggravatingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} disabled={isClosed}
                                        />
                                    </div>
                                    <div>
                                        <input type="text" placeholder="Aliviantes (Ej: Reposo, Hielo)" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:bg-white focus:border-indigo-400"
                                            value={(foco.easingFactors || []).join(', ')}
                                            onChange={e => handleUpdateFoco(idx, { easingFactors: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} disabled={isClosed}
                                        />
                                    </div>
                                </div>

                                {/* Row 4: Comparable (Critical) */}
                                <div className="p-4 bg-indigo-50/40 rounded-xl border border-indigo-100">
                                    <div className="flex gap-2 items-center mb-3">
                                        <h4 className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                                            Signo Comparable Estrella
                                        </h4>
                                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold uppercase">Obligatorio*</span>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <input type="text" placeholder="Ej: Sentadilla a 90°, Rot Externa Activa..." className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 font-medium text-slate-800 shadow-sm"
                                            value={foco.comparableSign?.name || ''}
                                            onChange={e => handleUpdateFoco(idx, { comparableSign: { ...(foco.comparableSign as any) || {}, name: e.target.value } })} disabled={isClosed} />

                                        <div className="flex gap-2">
                                            <input type="number" min="0" max="10" placeholder="EVA (0-10)" className="w-24 bg-white border border-slate-200 text-center rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400 font-bold shadow-sm"
                                                value={foco.comparableSign?.painLevel || ''}
                                                onChange={e => handleUpdateFoco(idx, { comparableSign: { ...(foco.comparableSign as any) || {}, painLevel: e.target.value } })} disabled={isClosed} />
                                            <input type="text" placeholder="Dosis/Condición (ej: 3 reps, carga 5kg)" className="w-full sm:w-48 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 shadow-sm"
                                                value={foco.comparableSign?.conditions || ''}
                                                onChange={e => handleUpdateFoco(idx, { comparableSign: { ...(foco.comparableSign as any) || {}, conditions: e.target.value } })} disabled={isClosed} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* E. PSFS Y FUNCION GLOBAL */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xl mb-4">
                        <span className="text-emerald-500">🏃</span> D. Función Global y Metas (PSFS)
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Limitación Principal General</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-emerald-400 min-h-[60px]"
                                placeholder="Ej: 'No puedo agacharme a recoger a mi hijo'..."
                                value={interview.functionalLimitationPrimary || ''}
                                onChange={(e) => handleUpdateInterview({ functionalLimitationPrimary: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Expectativas / Meta Paciente</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2.5 outline-none focus:bg-white focus:border-emerald-400 min-h-[60px]"
                                placeholder="Ej: Me gustaría volver a correr mi Maratón en 3 meses..."
                                value={interview.personGoal || ''}
                                onChange={(e) => handleUpdateInterview({ personGoal: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                            <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] font-black uppercase">Req*</span>
                            Escala Específica Funcional (PSFS)
                        </label>
                        {!isClosed && (
                            <button onClick={() => handleUpdateInterview({ psfs: [...(interview.psfs || []), { activity: '', score: 0, linkedFocusId: focos[0]?.id || '' }] })} className="text-xs text-indigo-600 font-bold hover:text-indigo-800 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 shadow-sm transition">+ Añadir (Máx 3)</button>
                        )}
                    </div>

                    <div className="space-y-3">
                        {(interview.psfs || []).map((pItem: any, i: number) => (
                            <div key={i} className="flex gap-2">
                                <input type="text" placeholder="Actividad Restringida (Ej. Subir escaleras)" className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 shadow-sm" value={pItem.activity} onChange={e => {
                                    const newPsfs = [...interview.psfs];
                                    newPsfs[i].activity = e.target.value;
                                    handleUpdateInterview({ psfs: newPsfs });
                                }} disabled={isClosed} />
                                <input type="number" min="0" max="10" placeholder="0-10" className="w-20 font-bold bg-white border border-slate-200 text-center rounded-lg px-2 py-2 text-sm outline-none focus:border-indigo-400 shadow-sm text-indigo-700" value={pItem.score} onChange={e => {
                                    const newPsfs = [...interview.psfs];
                                    newPsfs[i].score = Number(e.target.value);
                                    handleUpdateInterview({ psfs: newPsfs });
                                }} disabled={isClosed} />
                                {!isClosed && (
                                    <button onClick={() => {
                                        const newPsfs = [...interview.psfs];
                                        newPsfs.splice(i, 1);
                                        handleUpdateInterview({ psfs: newPsfs });
                                    }} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>
                        ))}
                        {(!interview.psfs || interview.psfs.length === 0) && (
                            <div className="text-[11px] text-slate-500 italic p-3 bg-white rounded-lg text-center border border-slate-200 border-dashed">
                                Obligatorio para cerrar la Evaluación. Agrega al menos 1 ítem funcional basal (0 = Inhabil, 10 = Normal).
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* F. BPS FACTORS (Banderas Amarillas Múltiples) */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
                    <span className="text-amber-500">🧠</span> E. Dominio Biopsicosocial (Factores BPS)
                </h3>
                <p className="text-xs text-slate-500">Factores modificables o barreras (Banderas Amarillas/Azules) que comprometen la recuperación optima.</p>

                <div className="flex flex-wrap gap-2 pt-2">
                    {['Estrés severo', 'Ansiedad T.', 'Depresión clínica', 'Miedo al Movimiento (Kinesiop.)', 'Catastrofización', 'Expectativas muy bajas', 'Falta de apoyo', 'Litigio legal/laboral', 'Mala calidad sueño'].map(flag => {
                        const isActive = interview.bpsFactors?.includes(flag);
                        return (
                            <button
                                key={flag}
                                onClick={() => {
                                    if (isClosed) return;
                                    const curr = interview.bpsFactors || [];
                                    const next = isActive ? curr.filter((s: string) => s !== flag) : [...curr, flag];
                                    handleUpdateInterview({ bpsFactors: next });
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${isActive ? 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                {flag}
                            </button>
                        )
                    })}
                </div>
            </div>

        </div>
    );
}
