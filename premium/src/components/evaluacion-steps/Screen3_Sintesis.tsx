import React, { useEffect, useMemo, useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { computeIrritability, autoSynthesizeFindings, computeSafety } from "@/lib/auto-engine";

export interface Screen3Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const COMMON_STRUCTURAL = ['Tendinopatía', 'Desgarro muscular', 'Esguince ligamentos', 'Disfunción articular', 'Radiculopatía', 'Artrosis sintomática', 'Sobrecarga ósea', 'Síndrome compresivo'];
const COMMON_FUNCTIONAL = ['Déficit ROM', 'Debilidad MMT < 4', 'Déficit Control Motor', 'Alteración Propioceptiva', 'Rigidez matinal', 'Pobre tolerancia a la carga'];
const COMMON_BPS = ['Kinesiofobia alta', 'Expectativas bajas', 'Estrés laboral', 'Pobre red apoyo', 'Catastrofización', 'Miedo al movimiento'];

export function Screen3_Sintesis({ formData, updateFormData, isClosed }: Screen3Props) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const autoSynth = formData.autoSynthesis || {};
    const engine = useMemo(() => {
        const irritability = computeIrritability({} as any); // Screen3 doesn't display it directly
        const safety = computeSafety(formData.interview);
        const synth = autoSynthesizeFindings(formData.guidedExam, formData.interview);
        return { safety, synth };
    }, [formData.interview, formData.guidedExam]);

    // Pre-poblar el Semáforo si no existe basado en el Engine
    useEffect(() => {
        if (!isClosed && !autoSynth.trafficLight && engine.safety.level !== 'Verde') {
            handleUpdateSynth({ trafficLight: engine.safety.level });
        } else if (!isClosed && !autoSynth.trafficLight && engine.safety.level === 'Verde') {
            handleUpdateSynth({ trafficLight: 'Verde' });
        }
    }, [isClosed, autoSynth.trafficLight, engine.safety.level]);

    // Pre-poblar Estructurales
    useEffect(() => {
        if (!isClosed && (!autoSynth.structuralSuspicions || autoSynth.structuralSuspicions.length === 0)) {
            const labels = engine.synth.structuralCandidates.map((c: any) => c.label);
            if (labels.length > 0) handleUpdateSynth({ structuralSuspicions: labels });
        }
    }, [isClosed, autoSynth.structuralSuspicions, engine.synth.structuralCandidates]);

    // Pre-poblar Funcionales
    useEffect(() => {
        if (!isClosed && (!autoSynth.functionalDeficits || autoSynth.functionalDeficits.length === 0)) {
            const labels = engine.synth.functionalDeficits.map((c: any) => c.label);
            if (labels.length > 0) handleUpdateSynth({ functionalDeficits: labels });
        }
    }, [isClosed, autoSynth.functionalDeficits, engine.synth.functionalDeficits]);

    // Pre-poblar BPS
    useEffect(() => {
        if (!isClosed && (!autoSynth.contextBps || autoSynth.contextBps.length === 0)) {
            const labels = [...engine.synth.bpsNotes.topBarriers, ...engine.synth.bpsNotes.topFacilitators];
            if (labels.length > 0) handleUpdateSynth({ contextBps: labels });
        }
    }, [isClosed, autoSynth.contextBps, engine.synth.bpsNotes]);

    const handleUpdateSynth = (patch: any) => {
        updateFormData((prev: any) => ({
            autoSynthesis: { ...(prev.autoSynthesis || {}), ...patch }
        }));
    };

    const toggleArrayItemObj = (key: 'structuralSuspicions' | 'functionalDeficits', value: string) => {
        if (isClosed) return;
        const current: any[] = autoSynth[key] || [];
        const exists = current.find(item => item.label === value);
        const next = exists ? current.filter(item => item.label !== value) : [...current, { label: value, source: 'Manual', linkedPsfs: false, side: 'N/A', baseline: '', confidence: 'Media', reproduceSymptom: false }];
        handleUpdateSynth({ [key]: next });
    };

    const handleCustomAddObj = (key: 'structuralSuspicions' | 'functionalDeficits', e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
            e.preventDefault();
            if (isClosed) return;
            const current: any[] = autoSynth[key] || [];
            handleUpdateSynth({ [key]: [...current, { label: e.currentTarget.value.trim(), source: 'Manual', linkedPsfs: false, side: 'N/A', baseline: '', confidence: 'Media', reproduceSymptom: false }] });
            e.currentTarget.value = '';
        }
    };

    const toggleArrayItem = (key: 'contextBps', value: string) => {
        if (isClosed) return;
        const current: string[] = autoSynth[key] || [];
        const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
        handleUpdateSynth({ [key]: next });
    };

    const handleCustomAdd = (key: 'contextBps', e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim() !== '') {
            e.preventDefault();
            if (isClosed) return;
            const current: string[] = autoSynth[key] || [];
            handleUpdateSynth({ [key]: [...current, e.currentTarget.value.trim()] });
            e.currentTarget.value = '';
        }
    };

    const handleRefineSynthesis = async () => {
        setIsGenerating(true);
        setAiError(null);
        try {
            const response = await fetch('/api/ai/diagnosis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        interview: formData.interview,
                        guidedExam: formData.guidedExam,
                        autoEngineOutputs: { trafficLight: engine.safety, synthesis: engine.synth }
                    }
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al conectar con la IA de Síntesis');

            // Save raw output for next screen to avoid double billing
            updateFormData(prev => ({
                aiOutputs: { ...(prev.aiOutputs || {}), diagnosis: data.data }
            }));

            // Map AI Structured Diagnosis back to Synthesis UI
            const struct = data.data?.diagnosis_structured;
            if (struct) {
                const newStructural = struct.body_structures?.map((s: any) => ({
                    label: `${s.region} - ${s.finding}`, confidence: s.confidence, source: 'IA Analítica', reproduceSymptom: false
                })) || [];
                const newFunctional = struct.body_functions?.map((f: any) => ({
                    label: `${f.domain}: ${f.severity}`, baseline: f.baseline, side: f.side, linkedPsfs: f.reproduces_comparable
                })) || [];
                const newBps = [
                    ...(struct.personal_factors?.map((p: any) => `${p.valence === 'positivo' ? '(+)' : '(-)'} ${p.factor}`) || []),
                    ...(struct.environment_factors?.map((e: any) => `${e.valence === 'facilitador' ? '(F)' : '(B)'} ${e.factor}`) || [])
                ];

                updateFormData(prev => ({
                    autoSynthesis: {
                        ...prev.autoSynthesis,
                        structuralSuspicions: newStructural.length > 0 ? newStructural : prev.autoSynthesis?.structuralSuspicions,
                        functionalDeficits: newFunctional.length > 0 ? newFunctional : prev.autoSynthesis?.functionalDeficits,
                        contextBps: newBps.length > 0 ? newBps : prev.autoSynthesis?.contextBps,
                        trafficLight: struct.classifications?.irritabilidad === 'alta' ? 'Rojo' :
                            struct.classifications?.irritabilidad === 'media' ? 'Amarillo' : 'Verde'
                    }
                }));
            }
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Síntesis y Clasificación</h2>
                    <p className="text-sm text-slate-500 mt-1">Sintetiza los hallazgos del examen físico y confirma el Semáforo clínico de carga.</p>
                </div>

                {/* AI Assist Block */}
                <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-xl p-4 shadow-sm relative overflow-hidden shrink-0 min-w-[280px]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-500" />
                    <h3 className="font-bold text-indigo-900 flex items-center gap-2 text-sm mb-2">
                        <span className="text-base">✨</span> Pulir Síntesis con IA
                    </h3>
                    <p className="text-[10px] text-indigo-700/70 mb-3 leading-tight">
                        Envía la data cruda a Gemini para detectar faltantes y ordenar déficits antes de pasar a P4.
                    </p>

                    {aiError && (
                        <div className="bg-rose-50 text-rose-700 p-2 rounded-lg text-[10px] font-medium border border-rose-200 mb-3">
                            ❌ {aiError}
                        </div>
                    )}

                    {!isGenerating ? (
                        <button onClick={handleRefineSynthesis} disabled={isClosed} className="w-full bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-indigo-700 transition shadow-sm border border-indigo-700 disabled:opacity-50">
                            Analizar y Auto-completar
                        </button>
                    ) : (
                        <span className="w-full flex justify-center text-xs text-indigo-600 font-bold animate-pulse items-center gap-2 bg-indigo-100 px-4 py-2 rounded-lg border border-indigo-200">
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" /></svg>
                            Sintetizando...
                        </span>
                    )}
                </div>
            </div>

            {/* SEMÁFORO GLOBAL DE CARGA */}
            <div className={`p-6 rounded-2xl border flex flex-col md:flex-row gap-6 items-center shadow-lg transition-colors ${autoSynth.trafficLight === 'Rojo' ? 'bg-rose-50 border-rose-200' : autoSynth.trafficLight === 'Amarillo' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="shrink-0 flex flex-col items-center gap-3 bg-white p-4 rounded-xl border shadow-sm">
                    <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Semáforo Clínico</span>
                    <div className="flex gap-2">
                        <button onClick={() => handleUpdateSynth({ trafficLight: 'Verde' })} disabled={isClosed} className={`w-10 h-10 rounded-full border-2 transition-all ${autoSynth.trafficLight === 'Verde' ? 'bg-emerald-500 border-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-110' : 'bg-slate-200 border-slate-300 hover:bg-emerald-200'}`} />
                        <button onClick={() => handleUpdateSynth({ trafficLight: 'Amarillo' })} disabled={isClosed} className={`w-10 h-10 rounded-full border-2 transition-all ${autoSynth.trafficLight === 'Amarillo' ? 'bg-amber-500 border-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)] scale-110' : 'bg-slate-200 border-slate-300 hover:bg-amber-200'}`} />
                        <button onClick={() => handleUpdateSynth({ trafficLight: 'Rojo' })} disabled={isClosed} className={`w-10 h-10 rounded-full border-2 transition-all ${autoSynth.trafficLight === 'Rojo' ? 'bg-rose-500 border-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.5)] scale-110' : 'bg-slate-200 border-slate-300 hover:bg-rose-200'}`} />
                    </div>
                </div>
                <div className="flex-1 w-full">
                    <h3 className={`font-bold text-lg mb-1 ${autoSynth.trafficLight === 'Rojo' ? 'text-rose-800' : autoSynth.trafficLight === 'Amarillo' ? 'text-amber-800' : 'text-emerald-800'}`}>
                        {autoSynth.trafficLight === 'Rojo' ? 'Alta Precaución (Carga Limitada)' : autoSynth.trafficLight === 'Amarillo' ? 'Progresión Cautelosa' : 'Carga Activa Agresiva'}
                    </h3>
                    <p className="text-xs text-slate-600 mb-3">Recomendación original del motor: <strong>{engine.safety.level}</strong>. {engine.safety.reasons[0]}</p>
                    <input type="text" placeholder="Justificación breve de la clasificación elegida..." className={`w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${autoSynth.trafficLight === 'Rojo' ? 'border-rose-200 focus:ring-rose-200' : autoSynth.trafficLight === 'Amarillo' ? 'border-amber-200 focus:ring-amber-200' : 'border-emerald-200 focus:ring-emerald-200'}`} value={autoSynth.trafficLightRationale || ''} onChange={e => handleUpdateSynth({ trafficLightRationale: e.target.value })} disabled={isClosed} />
                </div>
            </div>

            {/* SEPARACIÓN SINTÉTICA (DRAG/DROP O CHIPS) */}
            <div className="grid grid-cols-1 gap-6">

                {/* Sospecha Estructural */}
                <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><span className="text-lg">🦴</span> 1. Sospecha Estructural Principal</h3>
                    <p className="text-xs text-slate-500 mb-4">Estructuras anatómicas que se presumen como la fuente generadora del dolor (nocicepción primaria).</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {COMMON_STRUCTURAL.map(tag => {
                            const isActive = (autoSynth.structuralSuspicions || []).some((i: any) => i.label === tag);
                            return (
                                <button key={tag} onClick={() => toggleArrayItemObj('structuralSuspicions', tag)} disabled={isClosed} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isActive ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                    {tag}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {(autoSynth.structuralSuspicions || []).filter((t: any) => !COMMON_STRUCTURAL.includes(t.label)).map((tagObj: any) => (
                            <div key={tagObj.label} className="flex flex-col gap-1 bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-lg text-xs font-bold border border-indigo-200">
                                <div className="flex items-center gap-1">
                                    {tagObj.label}
                                    {!isClosed && <button onClick={() => toggleArrayItemObj('structuralSuspicions', tagObj.label)} className="hover:text-rose-500 ml-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                </div>
                                <span className="font-normal text-[10px] opacity-70 border-t border-indigo-200 pt-0.5 mt-0.5">{tagObj.source} | {tagObj.confidence}</span>
                            </div>
                        ))}
                        {!isClosed && <input type="text" placeholder="+ Añadir otro (Enter)" onKeyDown={(e) => handleCustomAddObj('structuralSuspicions', e)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-400 focus:bg-white w-48" />}
                    </div>
                </div>

                {/* Déficits Funcionales (Base para Objetivos) */}
                <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><span className="text-lg">⚙️</span> 2. Déficits Funcionales Clave</h3>
                    <p className="text-xs text-slate-500 mb-4">Alteraciones medibles de la función que están contribuyendo a la condición. (Serán la base para los Metas SMART en el siguiente paso).</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {COMMON_FUNCTIONAL.map(tag => {
                            const isActive = (autoSynth.functionalDeficits || []).some((i: any) => i.label === tag);
                            return (
                                <button key={tag} onClick={() => toggleArrayItemObj('functionalDeficits', tag)} disabled={isClosed} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isActive ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                    {tag}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {(autoSynth.functionalDeficits || []).filter((t: any) => !COMMON_FUNCTIONAL.includes(t.label)).map((tagObj: any) => (
                            <div key={tagObj.label} className="flex items-center gap-1 bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-lg text-xs font-bold border border-emerald-200 flex-col items-start">
                                <div className="flex justify-between w-full gap-2">
                                    <span>{tagObj.label}</span>
                                    {!isClosed && <button onClick={() => toggleArrayItemObj('functionalDeficits', tagObj.label)} className="hover:text-rose-500" title="Eliminar"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                </div>
                                {(tagObj.baseline || tagObj.side !== 'N/A') && (
                                    <span className="font-normal text-[10px] opacity-70 border-t border-emerald-200 pt-0.5 mt-0.5 w-full">Medición base: {tagObj.baseline || 'N/A'} {tagObj.side !== 'N/A' && `(${tagObj.side})`}</span>
                                )}
                            </div>
                        ))}
                        {!isClosed && <input type="text" placeholder="+ Añadir otro (Enter)" onKeyDown={(e) => handleCustomAddObj('functionalDeficits', e)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-emerald-400 focus:bg-white w-48" />}
                    </div>
                </div>

                {/* Contexto BPS */}
                <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><span className="text-lg">🧠</span> 3. Moduladores Biopsicosociales</h3>
                    <p className="text-xs text-slate-500 mb-4">Factores extrínsecos e intrínsecos que perpetúan o modulan la percepción de la amenaza.</p>

                    <div className="flex flex-wrap gap-2 mb-4">
                        {COMMON_BPS.map(tag => {
                            const isActive = (autoSynth.contextBps || []).includes(tag);
                            return (
                                <button key={tag} onClick={() => toggleArrayItem('contextBps', tag)} disabled={isClosed} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${isActive ? 'bg-amber-600 text-white border-amber-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                    {tag}
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {(autoSynth.contextBps || []).filter((t: string) => !COMMON_BPS.includes(t)).map((tag: string) => (
                            <div key={tag} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-200">
                                {tag}
                                {!isClosed && <button onClick={() => toggleArrayItem('contextBps', tag)} className="hover:text-rose-500 ml-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                            </div>
                        ))}
                        {!isClosed && <input type="text" placeholder="+ Añadir otro (Enter)" onKeyDown={(e) => handleCustomAdd('contextBps', e)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-amber-400 focus:bg-white w-48" />}
                    </div>
                </div>

            </div>
        </div>
    );
}
