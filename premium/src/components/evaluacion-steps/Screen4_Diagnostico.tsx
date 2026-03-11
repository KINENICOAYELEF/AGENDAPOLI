import React, { useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { normalizeEvaluationState } from "@/lib/state-normalizer";
import { useAuth } from "@/context/AuthContext";

export interface Screen4Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

export function Screen4_Diagnostico({ formData, updateFormData, isClosed }: Screen4Props) {
    const { user } = useAuth();
    const { geminiDiagnostic = {} } = formData;
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Estado local para "Modo IA" vs "Modo Manual" si queremos ocultar la UI hasta que decida
    const [modeSelected, setModeSelected] = useState<boolean>(!!geminiDiagnostic.narrativeDiagnosis || !!geminiDiagnostic.kinesiologicalDxNarrative);

    const autoSynth = formData.autoSynthesis || {};

    const handleUpdateGemini = (patch: any) => {
        updateFormData(prev => ({
            geminiDiagnostic: { ...(prev.geminiDiagnostic || {}), ...patch }
        }));
    };

    const updateDeepObj = (key: string, patch: any) => {
        handleUpdateGemini({
            [key]: { ...(geminiDiagnostic as any)[key], ...patch }
        });
    };

    const handleGenerateAi = async () => {
        if (isClosed) return;
        setIsGenerating(true);
        setAiError(null);
        setModeSelected(true);
        try {
            const normalizedCase = normalizeEvaluationState(formData);
            const minimalContext = {
                identificacion: normalizedCase.identificacion,
                focoPrincipal: normalizedCase.focoPrincipal ? `${normalizedCase.focoPrincipal.region || 'S/N'} (${normalizedCase.ladoPrincipal})` : 'No definido',
                irritabilidad: normalizedCase.irritabilidad,
                tareaIndice: normalizedCase.tareaIndice,
                quejaPrioritaria: normalizedCase.quejaPrioritaria
            };

            const payloadForAI = {
                normalizedContext: minimalContext,
                synthesis: autoSynth // MUST be autoSynthesis as it contains P3 structured output
            };

            const stringifiedPayloadForAI = JSON.stringify(payloadForAI);
            
            // FRONTEND CACHE GUARD
            if (formData.aiOutputs?.narrativeLastInput === stringifiedPayloadForAI && geminiDiagnostic.narrativeDiagnosis && !aiError) {
                alert("Se reutilizó la última redacción porque no hubo cambios en P3.");
                setIsGenerating(false);
                return;
            }

            const res = await fetch('/api/ai/narrative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadForAI)
            });
            if (!res.ok) throw new Error("Error en IA Gemini de Diagnóstico y Planificación.");
            const data = await res.json();
            const aiData = data.data; // NarrativeSchema parsed

            handleUpdateGemini({
                narrativeDiagnosis: aiData.narrativeDiagnosis || '',
                generalObjectiveOptions: aiData.generalObjectiveOptions || [],
                generalObjective: (aiData.generalObjectiveOptions || [])[0] || '',
                smartGoals: aiData.smartGoals || [],
                prognosis: aiData.prognosis || { shortTerm: '', mediumTerm: '', category: '', justification: '' },
                pillars: aiData.pillars || [],
                masterPlan: aiData.masterPlan || '',
                reassessmentRules: aiData.reassessmentRules || { comparableSign: '', variables: [], frequency: '', progressCriteria: '', stagnationCriteria: '' }
            });

            // Persist telemetry and last input
            updateFormData(prev => ({
                aiOutputs: { 
                    ...(prev.aiOutputs || {}), 
                    narrativeLastInput: stringifiedPayloadForAI,
                    narrativeTelemetry: {
                        latencyMs: data.latencyMs,
                        timestamp: new Date().toISOString(),
                        hash: data.hash,
                        estimatedInputTokens: Math.ceil(stringifiedPayloadForAI.length / 4)
                    }
                }
            }));
        } catch (err: any) {
            setAiError(err.message || 'Falló la generación IA.');
        } finally {
            setIsGenerating(false);
        }
    };

    const enableManualMode = () => {
        setModeSelected(true);
    };

    const moveItem = (key: 'generalObjectiveOptions' | 'smartGoals' | 'pillars', idx: number, direction: 'up' | 'down') => {
        if (isClosed) return;
        const copy = [...(geminiDiagnostic[key] || [])];
        if (direction === 'up' && idx > 0) {
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        } else if (direction === 'down' && idx < copy.length - 1) {
            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
        }
        handleUpdateGemini({ [key]: copy });
    };

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Narrativa y Planificación</h2>
                <p className="text-sm text-slate-500 mt-1">Utiliza la estructura clínica clasificada en P3 para construir el diagnóstico narrativo y el plan de tratamiento.</p>
            </div>

            {/* BLOQUE A — MODO DE TRABAJO */}
            <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border border-emerald-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="font-bold text-emerald-900 mb-1">A. Modo de Trabajo</h3>
                    <p className="text-xs text-emerald-800">Puedes usar la propuesta de IA como base o completar esta etapa manualmente basándote en P3.</p>
                </div>
                <div className="flex gap-3 flex-col sm:flex-row w-full md:w-auto">
                    <button 
                        onClick={enableManualMode} 
                        disabled={isClosed || isGenerating} 
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm px-4 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        📝 Completar manualmente
                    </button>
                    <div className="flex flex-col gap-2 w-full md:w-auto">
                        <button 
                            onClick={handleGenerateAi} 
                            disabled={isClosed || isGenerating} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-6 py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <><span className="animate-spin text-lg">⚙️</span> Procesando...</> : <><span className="text-lg">✨</span> Redactar diagnóstico y plan con IA</>}
                        </button>
                        <span className="text-[10px] text-emerald-800 text-center font-medium opacity-80">⚠️ Esta propuesta puede contener errores y debe ser revisada clínicamente.</span>
                    </div>
                </div>
            </div>

            {aiError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm font-medium">
                    ❌ {aiError}
                </div>
            )}

            {modeSelected && (
                <div className="flex flex-col gap-6 mt-4 animate-in fade-in duration-700">
                    
                    {/* REFERENCIA PASIVA DE P3 */}
                    <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 shadow-sm">
                        <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">🔍 Referencia P3 (Clasificación Estructurada)</h4>
                        <p className="text-xs text-blue-800 mb-2">Utiliza esta información generada en P3 como base pasiva para completar los siguientes bloques.</p>
                        <div className="bg-white/60 p-3 rounded text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono border border-blue-100">
                            {formData.autoSynthesis?.clinicalClassification 
                                ? `${formData.autoSynthesis.clinicalClassification.category} - ${formData.autoSynthesis.clinicalClassification.subtype}\n${formData.autoSynthesis.clinicalClassification.rationale}`
                                : (formData.clinicalSynthesis || 'Sin clasificación P3 disponible en el episodio.')
                            }
                        </div>
                    </div>
                    {/* BLOQUE B — DIAGNÓSTICO KINESIOLÓGICO NARRATIVO FINAL */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-2 border-b pb-2 flex items-center gap-2"><span className="text-lg">📜</span> B. Diagnóstico Kinesiológico Narrativo</h3>
                        <p className="text-xs text-slate-500 mb-3">Redacción única continua que integra la identificación, alteraciones estructurales/funcionales, participación y factores biopsicosociales (bloques P3).</p>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[160px] text-sm text-slate-800 outline-none focus:border-emerald-400 focus:bg-white leading-relaxed disabled:opacity-75"
                            placeholder="Comienza a escribir el diagnóstico en formato narrativo..."
                            value={geminiDiagnostic.narrativeDiagnosis || geminiDiagnostic.kinesiologicalDxNarrative || ''}
                            onChange={(e) => handleUpdateGemini({ narrativeDiagnosis: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>

                    {/* BLOQUE C — OBJETIVO GENERAL */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🎯</span> C. Objetivo General</h3>
                        
                        {(geminiDiagnostic.generalObjectiveOptions || []).length > 0 && (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Opciones Inteligentes (Selecciona para copiar al cuadro final)</label>
                                <div className="space-y-2">
                                    {geminiDiagnostic.generalObjectiveOptions?.map((opt: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded cursor-pointer hover:bg-emerald-100 transition-colors group">
                                            <input type="radio" className="mt-1" checked={geminiDiagnostic.generalObjective === opt} readOnly onClick={() => !isClosed && handleUpdateGemini({ generalObjective: opt })} />
                                            <span className="text-sm text-emerald-900 flex-1" onClick={() => !isClosed && handleUpdateGemini({ generalObjective: opt })}>{opt}</span>
                                            {!isClosed && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); moveItem('generalObjectiveOptions', idx, 'up'); }} className="text-emerald-600 hover:bg-emerald-200 p-1 rounded font-bold leading-none text-xs" disabled={idx === 0}>↑</button>
                                                    <button onClick={(e) => { e.stopPropagation(); moveItem('generalObjectiveOptions', idx, 'down'); }} className="text-emerald-600 hover:bg-emerald-200 p-1 rounded font-bold leading-none text-xs" disabled={idx === (geminiDiagnostic.generalObjectiveOptions?.length || 0) - 1}>↓</button>
                                                    <button onClick={(e) => { e.stopPropagation(); const copy = [...(geminiDiagnostic.generalObjectiveOptions || [])]; copy.splice(idx, 1); handleUpdateGemini({ generalObjectiveOptions: copy }); }} className="text-rose-500 hover:bg-rose-100 p-1 rounded font-bold leading-none text-xs">✕</button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Objetivo General Definido</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm disabled:opacity-75 min-h-[60px]"
                                placeholder="[Verbo] + [problema macro] + para + [participación]..."
                                value={geminiDiagnostic.generalObjective || ''}
                                onChange={(e) => handleUpdateGemini({ generalObjective: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>

                    {/* BLOQUE D — OBJETIVOS SMART */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">📏</span> D. Objetivos SMART</h3>
                            {!isClosed && (
                                <button onClick={() => handleUpdateGemini({ smartGoals: [...(geminiDiagnostic.smartGoals || []), { description: '', linkedVariable: '' }] })} className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100">
                                    + Agregar SMART
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {(geminiDiagnostic.smartGoals || []).length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">No hay metas SMART configuradas.</p>
                            )}
                            {(geminiDiagnostic.smartGoals || []).map((goal: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative group">
                                    {!isClosed && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-slate-50 border border-slate-200 rounded-md shadow-sm p-1 z-10">
                                            <button onClick={() => moveItem('smartGoals', idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1 rounded font-bold leading-none disabled:opacity-30">↑</button>
                                            <button onClick={() => moveItem('smartGoals', idx, 'down')} disabled={idx === (geminiDiagnostic.smartGoals?.length || 0) - 1} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1 rounded font-bold leading-none disabled:opacity-30">↓</button>
                                            <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                            <button onClick={() => { const copy = [...(geminiDiagnostic.smartGoals || [])]; copy.splice(idx, 1); handleUpdateGemini({ smartGoals: copy }); }} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded font-bold leading-none">✕</button>
                                        </div>
                                    )}
                                    
                                    <div className="mb-3 pr-6">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Redacción SMART {idx + 1}</label>
                                        <textarea
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-sm disabled:opacity-75"
                                            value={goal.description}
                                            onChange={(e) => { const copy = [...(geminiDiagnostic.smartGoals || [])]; copy[idx].description = e.target.value; handleUpdateGemini({ smartGoals: copy }); }}
                                            disabled={isClosed}
                                            placeholder="Ej: Aumentar fuerza de cuádriceps de déficit moderado a leve en 6 semanas..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Variable Base Ligada</label>
                                        <input
                                            type="text"
                                            className="w-full md:w-1/2 bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75"
                                            value={goal.linkedVariable}
                                            onChange={(e) => { const copy = [...(geminiDiagnostic.smartGoals || [])]; copy[idx].linkedVariable = e.target.value; handleUpdateGemini({ smartGoals: copy }); }}
                                            disabled={isClosed}
                                            placeholder="Problema funcional, PSFS, o variable..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOQUE E — PRONÓSTICO BPS */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🔮</span> E. Pronóstico Biopsicosocial</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pronóstico a Corto Plazo</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-[60px]" value={geminiDiagnostic.prognosis?.shortTerm || ''} onChange={(e) => updateDeepObj('prognosis', { shortTerm: e.target.value })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pronóstico a Mediano Plazo</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-[60px]" value={geminiDiagnostic.prognosis?.mediumTerm || ''} onChange={(e) => updateDeepObj('prognosis', { mediumTerm: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoría Principal</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm" value={geminiDiagnostic.prognosis?.category || ''} onChange={(e) => updateDeepObj('prognosis', { category: e.target.value })} disabled={isClosed}>
                                    <option value="">Selecciona...</option>
                                    <option value="Favorable">Favorable</option>
                                    <option value="Favorable con vigilancia">Favorable con vigilancia</option>
                                    <option value="Reservado">Reservado</option>
                                    <option value="Desfavorable">Desfavorable</option>
                                    <option value="Incierto">Incierto / Dependiente</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Justificación Clínica Integral</label>
                                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm" placeholder="Ej: Basado en severidad actual, adherencia y barreras ambientales..." value={geminiDiagnostic.prognosis?.justification || ''} onChange={(e) => updateDeepObj('prognosis', { justification: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE F — PILARES DE INTERVENCIÓN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">🏛️</span> F. Pilares de Intervención</h3>
                            {!isClosed && (
                                <button onClick={() => handleUpdateGemini({ pillars: [...(geminiDiagnostic.pillars || []), { name: '', description: '' }] })} className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 uppercase tracking-wider">
                                    + Agregar Pilar
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(geminiDiagnostic.pillars || []).length === 0 && <p className="text-xs text-slate-400">Sin pilares definidos.</p>}
                            {(geminiDiagnostic.pillars || []).map((pilar: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-lg relative group">
                                    {!isClosed && (
                                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-md shadow-sm p-1 z-10">
                                            <button onClick={() => moveItem('pillars', idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1.5 rounded text-[10px] leading-none disabled:opacity-30">▲</button>
                                            <button onClick={() => moveItem('pillars', idx, 'down')} disabled={idx === (geminiDiagnostic.pillars?.length || 0) - 1} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1.5 rounded text-[10px] leading-none disabled:opacity-30">▼</button>
                                            <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                                            <button onClick={() => { const copy = [...(geminiDiagnostic.pillars || [])]; copy.splice(idx, 1); handleUpdateGemini({ pillars: copy }); }} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded text-[10px] font-bold leading-none">✕</button>
                                        </div>
                                    )}
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-bold text-slate-800 mb-2 truncate pr-6" value={pilar.name} onChange={(e) => { const copy = [...(geminiDiagnostic.pillars || [])]; copy[idx].name = e.target.value; handleUpdateGemini({ pillars: copy }); }} placeholder="Nombre del Pilar" disabled={isClosed} />
                                    <textarea className="w-full bg-transparent border-none p-0 text-xs text-slate-600 outline-none resize-none h-16" value={pilar.description} onChange={(e) => { const copy = [...(geminiDiagnostic.pillars || [])]; copy[idx].description = e.target.value; handleUpdateGemini({ pillars: copy }); }} placeholder="Por qué y cómo se abordará..." disabled={isClosed} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOQUE G — PLAN MAESTRO */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-2 border-b pb-2 flex items-center gap-2"><span className="text-lg">🗺️</span> G. Plan Maestro (Hoja de Ruta)</h3>
                        <p className="text-xs text-slate-500 mb-3">Narrativa libre que guía las primeras sesiones, progresiones esperadas, criterios de ajuste y alertas.</p>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[140px] text-sm text-slate-800 outline-none focus:border-emerald-400 disabled:opacity-75"
                            placeholder="Desarrolla el enfoque, sesiones sugeridas, focos de inicio de cuidado..."
                            value={geminiDiagnostic.masterPlan || ''}
                            onChange={(e) => handleUpdateGemini({ masterPlan: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>

                    {/* BLOQUE H — REGLAS DE REEVALUACIÓN */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-2 flex items-center gap-2"><span className="text-lg">🔄</span> H. Reglas de Reevaluación y Seguimiento</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Signo Comparable Principal</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" value={geminiDiagnostic.reassessmentRules?.comparableSign || ''} onChange={(e) => updateDeepObj('reassessmentRules', { comparableSign: e.target.value })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Variables de Seguimiento (coma)</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" value={(geminiDiagnostic.reassessmentRules?.variables || []).join(', ')} onChange={(e) => updateDeepObj('reassessmentRules', { variables: e.target.value.split(',').map(v => v.trim()).filter(Boolean) })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Frecuencia Sugerida</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" placeholder="Ej: Todas las sesiones / Quincenal" value={geminiDiagnostic.reassessmentRules?.frequency || ''} onChange={(e) => updateDeepObj('reassessmentRules', { frequency: e.target.value })} disabled={isClosed} />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                    <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Criterio de Mejora Real</label>
                                    <textarea className="w-full border-none outline-none text-xs h-[40px] resize-none" placeholder="Ej: Aumento >20% en dinamometría sin irritación..." value={geminiDiagnostic.reassessmentRules?.progressCriteria || ''} onChange={(e) => updateDeepObj('reassessmentRules', { progressCriteria: e.target.value })} disabled={isClosed} />
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                    <label className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-1">Criterio de Estancamiento / Derivación</label>
                                    <textarea className="w-full border-none outline-none text-xs h-[40px] resize-none" placeholder="Ej: Mismo dolor a las 4 semanas, derivar..." value={geminiDiagnostic.reassessmentRules?.stagnationCriteria || ''} onChange={(e) => updateDeepObj('reassessmentRules', { stagnationCriteria: e.target.value })} disabled={isClosed} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PANEL DE TELEMETRÍA (ADMIN/DOCENTE) */}
            {((user?.role as string) === 'ADMIN' || (user?.role as string) === 'DOCENTE') && formData.aiOutputs?.narrativeTelemetry && (
                <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-xs font-mono mt-6 mb-2 flex flex-col gap-1 border border-slate-700 shadow-inner">
                    <h4 className="text-slate-100 font-bold mb-2 flex items-center gap-2"><span className="text-base">📡</span> Terminal de Telemetría P4 (Admin)</h4>
                    <p><span className="text-slate-500">Estim. Input Tokens:</span> <span className="text-emerald-400 font-bold">{formData.aiOutputs.narrativeTelemetry.estimatedInputTokens}</span></p>
                    <p><span className="text-slate-500">Network Latency:</span> {formData.aiOutputs.narrativeTelemetry.latencyMs}ms</p>
                    <p><span className="text-slate-500">Payload Hash:</span> {formData.aiOutputs.narrativeTelemetry.hash}</p>
                    <p><span className="text-slate-500">Last Generated:</span> {new Date(formData.aiOutputs.narrativeTelemetry.timestamp).toLocaleString()}</p>
                    <p><span className="text-slate-500">Active Model:</span> <span className="text-amber-400 font-bold">gemini-2.5-pro</span> (Modo Redacción)</p>
                </div>
            )}
        </div>
    );
}
