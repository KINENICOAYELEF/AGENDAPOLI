import React, { useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { useAuth } from "@/context/AuthContext";

export interface Screen4Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

export function Screen4_Diagnostico({ formData, updateFormData, isClosed }: Screen4Props) {
    const { user } = useAuth();
    // Use the new P4 structure, with a fallback to avoid nested undefined errors
    const p4_plan_structured = formData.p4_plan_structured || {} as any;
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // Legacy fallback so that "Modo IA" doesn't reset on already evaluated cases
    const [modeSelected, setModeSelected] = useState<boolean>(
        !!p4_plan_structured.diagnostico_kinesiologico_narrativo || !!formData.geminiDiagnostic?.narrativeDiagnosis || !!formData.geminiDiagnostic?.kinesiologicalDxNarrative
    );

    const autoSynth = formData.autoSynthesis || {};

    const handleUpdateP4 = (patch: any) => {
        updateFormData(prev => ({
            p4_plan_structured: { ...(prev.p4_plan_structured || {}), ...patch }
        }));
    };

    const updateDeepObj = (key: string, patch: any) => {
        handleUpdateP4({
            [key]: { ...(p4_plan_structured[key] || {}), ...patch }
        });
    };

    const handleGenerateAi = async (actionType: 'P4_BASE' | 'P4_PREMIUM' = 'P4_BASE') => {
        if (isClosed) return;
        setIsGenerating(true);
        setAiError(null);
        setModeSelected(true);
        try {
            // Reconstruct the minimal compact context requested by the user parameters:
            // "P4 DEBE LEER SOLO: p3_case_organizer, compact_case_package, p2_summary_structured"
            const payloadForAI = {
                p3_case_organizer: autoSynth,
                compact_case_package: formData.aiOutputs?.p3_compact_package_last_input ? JSON.parse(formData.aiOutputs.p3_compact_package_last_input) : null,
                p2_summary_structured: (formData.guidedExam as any)?.autoSynthesis || null,
                aiAction: actionType
            };

            const stringifiedPayloadForAI = JSON.stringify(payloadForAI);
            
            // FRONTEND CACHE GUARD FOR P4
            if (formData.aiOutputs?.p4_last_input === stringifiedPayloadForAI && p4_plan_structured.diagnostico_kinesiologico_narrativo && p4_plan_structured.ia_metadata?.draft_mode === actionType && !aiError) {
                alert(`Resultado recuperado de cache: No hubo cambios en inputs para regenerar el borrador (${actionType}).`);
                setIsGenerating(false);
                return;
            }

            const res = await fetch('/api/ai/narrative', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadForAI)
            });
            if (!res.ok) throw new Error("Error en IA Gemini de P4 Diagnóstico y Planificación.");
            const resBody = await res.json();
            const aiData = resBody.data; 

            handleUpdateP4({
                referencia_p3_breve: aiData.referencia_p3_breve || '',
                diagnostico_kinesiologico_narrativo: aiData.diagnostico_kinesiologico_narrativo || '',
                objetivo_general: aiData.objetivo_general || { opciones_sugeridas: [], seleccionado: '' },
                objetivos_smart: aiData.objetivos_smart || [],
                pronostico_biopsicosocial: aiData.pronostico_biopsicosocial || { corto_plazo: '', mediano_plazo: '', categoria: '', justificacion_clinica_integral: '', comparativa_adherencia: '' },
                pilares_intervencion: aiData.pilares_intervencion || [],
                plan_maestro: aiData.plan_maestro || '',
                reglas_reevaluacion: aiData.reglas_reevaluacion || { signo_comparable_principal: '', variables_seguimiento: [], frecuencia_sugerida: '', criterio_mejora_real: '', criterio_estancamiento_derivacion: '' },
                ia_metadata: aiData.ia_metadata || {}
            });

            // Persist telemetry and last input stringification
            updateFormData(prev => ({
                aiOutputs: { 
                    ...(prev.aiOutputs || {}), 
                    p4_last_input: stringifiedPayloadForAI,
                    narrativeTelemetry: resBody.telemetry
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

    const moveItem = (key: 'objetivos_smart' | 'pilares_intervencion', idx: number, direction: 'up' | 'down') => {
        if (isClosed) return;
        const copy = [...(p4_plan_structured[key] || [])];
        if (direction === 'up' && idx > 0) {
            [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
        } else if (direction === 'down' && idx < copy.length - 1) {
            [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
        }
        handleUpdateP4({ [key]: copy });
    };

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Narrativa y Planificación P4</h2>
                <p className="text-sm text-slate-500 mt-1">Utiliza la estructura clínica de la Síntesis P3 para construir el diagnóstico narrativo y el plan de tratamiento clínico.</p>
            </div>

            {/* BLOQUE A — MODO DE TRABAJO */}
            <div className="bg-gradient-to-br from-emerald-50/50 to-teal-50/50 border border-emerald-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex-1">
                    <h3 className="font-bold text-emerald-900 mb-1">A. Modo de Trabajo</h3>
                    <p className="text-xs text-emerald-800">Puedes usar la propuesta de IA como base o completar esta etapa manualmente basándote en P3 de forma pasiva.</p>
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
                            onClick={() => handleGenerateAi('P4_BASE')} 
                            disabled={isClosed || isGenerating} 
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm px-6 py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <><span className="animate-spin text-lg">⚙️</span> Procesando...</> : <><span className="text-lg">✨</span> Generar borrador base con IA</>}
                        </button>
                        {modeSelected && (
                             <button 
                                onClick={() => handleGenerateAi('P4_PREMIUM')} 
                                disabled={isClosed || isGenerating} 
                                className="bg-amber-500 hover:bg-amber-600 text-white font-black text-[12px] px-4 py-2 rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                             >
                                 🚀 Refinar redacción premium (Opcional)
                             </button>
                        )}
                        <span className="text-[10px] text-emerald-800 text-center font-medium opacity-80">Respeta la clasificación P3 sin alterar resultados clínicos.</span>
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
                        <h4 className="font-bold text-blue-900 text-sm mb-2 flex items-center gap-2">🔍 Referencia P3 Breve (Base Pasiva)</h4>
                        <div className="bg-white/60 p-3 rounded text-xs text-slate-700 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono border border-blue-100">
                            {p4_plan_structured.referencia_p3_breve 
                                ? p4_plan_structured.referencia_p3_breve
                                : formData.autoSynthesis?.clasificacion_dolor 
                                    ? `${formData.autoSynthesis.clasificacion_dolor.categoria} - ${[...(formData.autoSynthesis.clasificacion_dolor.subtipos || []), formData.autoSynthesis.clasificacion_dolor.subtipo_manual].filter(Boolean).join(', ')}\n${formData.autoSynthesis.clasificacion_dolor.fundamento?.conclusion || ''}\n\nMAPA ESTRUCTURAL:\n${formData.autoSynthesis.sistema_y_estructuras?.estructuras_mas_afectan || ''}`
                                    : (formData.clinicalSynthesis || 'Sin referencia P3 sintetizada.')
                            }
                        </div>
                    </div>

                    {/* BLOQUE B — DIAGNÓSTICO KINESIOLÓGICO NARRATIVO FINAL */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-2 border-b pb-2 flex items-center gap-2"><span className="text-lg">📜</span> B. Diagnóstico Kinesiológico Narrativo</h3>
                        <p className="text-xs text-slate-500 mb-3">Sigue estrictamente la plantilla lógica estructural solicitada, vinculando dimensiones CIF sin re-clasificar.</p>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[220px] text-sm text-slate-800 outline-none focus:border-emerald-400 focus:bg-white leading-relaxed disabled:opacity-75"
                            placeholder="[Nombre], consulta por... Presenta alteraciones estructurales a nivel de... A nivel funcional presenta alteraciones de... Lo anterior limita... Restringiendo su participación en... Presenta como factores personales... ambientales..."
                            value={p4_plan_structured.diagnostico_kinesiologico_narrativo || formData.geminiDiagnostic?.narrativeDiagnosis || ''}
                            onChange={(e) => handleUpdateP4({ diagnostico_kinesiologico_narrativo: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>

                    {/* BLOQUE C — OBJETIVO GENERAL */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🎯</span> C. Objetivo General</h3>
                        
                        {(p4_plan_structured.objetivo_general?.opciones_sugeridas || []).length > 0 && (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Opciones Sugeridas IA (Selecciona para fijar)</label>
                                <div className="space-y-2">
                                    {p4_plan_structured.objetivo_general?.opciones_sugeridas?.map((opt: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded cursor-pointer hover:bg-emerald-100 transition-colors group">
                                            <input type="radio" className="mt-1" checked={p4_plan_structured.objetivo_general?.seleccionado === opt} readOnly onClick={() => !isClosed && updateDeepObj('objetivo_general', { seleccionado: opt })} />
                                            <span className="text-sm text-emerald-900 flex-1" onClick={() => !isClosed && updateDeepObj('objetivo_general', { seleccionado: opt })}>{opt}</span>
                                            {!isClosed && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={(e) => { e.stopPropagation(); const copy = [...(p4_plan_structured.objetivo_general?.opciones_sugeridas || [])]; if (idx > 0) [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]]; updateDeepObj('objetivo_general', { opciones_sugeridas: copy }); }} className="text-emerald-600 hover:bg-emerald-200 p-1 rounded font-bold leading-none text-xs" disabled={idx === 0}>↑</button>
                                                    <button onClick={(e) => { e.stopPropagation(); const copy = [...(p4_plan_structured.objetivo_general?.opciones_sugeridas || [])]; if (idx < copy.length - 1) [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]]; updateDeepObj('objetivo_general', { opciones_sugeridas: copy }); }} className="text-emerald-600 hover:bg-emerald-200 p-1 rounded font-bold leading-none text-xs" disabled={idx === (p4_plan_structured.objetivo_general?.opciones_sugeridas?.length || 0) - 1}>↓</button>
                                                    <button onClick={(e) => { e.stopPropagation(); const copy = [...(p4_plan_structured.objetivo_general?.opciones_sugeridas || [])]; copy.splice(idx, 1); updateDeepObj('objetivo_general', { opciones_sugeridas: copy }); }} className="text-rose-500 hover:bg-rose-100 p-1 rounded font-bold leading-none text-xs">✕</button>
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
                                value={p4_plan_structured.objetivo_general?.seleccionado || ''}
                                onChange={(e) => updateDeepObj('objetivo_general', { seleccionado: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>

                    {/* BLOQUE D — OBJETIVOS SMART */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">📏</span> D. Objetivos SMART</h3>
                            {!isClosed && (
                                <button onClick={() => handleUpdateP4({ objetivos_smart: [...(p4_plan_structured.objetivos_smart || []), { texto: '', variable_base: '', basal: '', meta: '', plazo: '', prioridad: '' }] })} className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded hover:bg-emerald-100">
                                    + Agregar SMART
                                </button>
                            )}
                        </div>
                        <div className="space-y-4">
                            {(p4_plan_structured.objetivos_smart || []).length === 0 && (
                                <p className="text-sm text-slate-400 italic text-center py-4">No hay metas SMART configuradas.</p>
                            )}
                            {(p4_plan_structured.objetivos_smart || []).map((goal: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 relative group grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {!isClosed && (
                                        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-slate-50 border border-slate-200 rounded-md shadow-sm p-1 z-10">
                                            <button onClick={() => moveItem('objetivos_smart', idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1 rounded font-bold leading-none disabled:opacity-30">↑</button>
                                            <button onClick={() => moveItem('objetivos_smart', idx, 'down')} disabled={idx === (p4_plan_structured.objetivos_smart?.length || 0) - 1} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1 rounded font-bold leading-none disabled:opacity-30">↓</button>
                                            <div className="w-px h-3 bg-slate-200 mx-1"></div>
                                            <button onClick={() => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy.splice(idx, 1); handleUpdateP4({ objetivos_smart: copy }); }} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1 rounded font-bold leading-none">✕</button>
                                        </div>
                                    )}
                                    
                                    <div className="md:col-span-2 pr-6">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Descripción SMART {idx + 1}</label>
                                        <textarea
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-sm disabled:opacity-75 resize-none h-16"
                                            value={goal.texto}
                                            onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].texto = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }}
                                            disabled={isClosed}
                                            placeholder="[verbo] + [variable] + [basal] + [meta] + [plazo]..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Variable Base</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75"
                                            value={goal.variable_base}
                                            onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].variable_base = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }}
                                            disabled={isClosed}
                                            placeholder="Ej: Rango de flexión..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Basal vs Meta</label>
                                        <div className="flex gap-2">
                                            <input type="text" className="w-1/2 bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75" value={goal.basal} onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].basal = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }} disabled={isClosed} placeholder="Basal" />
                                            <input type="text" className="w-1/2 bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75" value={goal.meta} onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].meta = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }} disabled={isClosed} placeholder="Meta" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Plazo</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75"
                                            value={goal.plazo}
                                            onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].plazo = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }}
                                            disabled={isClosed}
                                            placeholder="Ej: 3 semanas"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Prioridad</label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-slate-200 rounded p-2 text-xs disabled:opacity-75"
                                            value={goal.prioridad}
                                            onChange={(e) => { const copy = [...(p4_plan_structured.objetivos_smart || [])]; copy[idx].prioridad = e.target.value; handleUpdateP4({ objetivos_smart: copy }); }}
                                            disabled={isClosed}
                                            placeholder="Alta / Media / Baja"
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
                                <textarea className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-[60px]" value={p4_plan_structured.pronostico_biopsicosocial?.corto_plazo || ''} onChange={(e) => updateDeepObj('pronostico_biopsicosocial', { corto_plazo: e.target.value })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Pronóstico a Mediano Plazo</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm h-[60px]" value={p4_plan_structured.pronostico_biopsicosocial?.mediano_plazo || ''} onChange={(e) => updateDeepObj('pronostico_biopsicosocial', { mediano_plazo: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoría Principal</label>
                                <select className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm" value={p4_plan_structured.pronostico_biopsicosocial?.categoria || ''} onChange={(e) => updateDeepObj('pronostico_biopsicosocial', { categoria: e.target.value })} disabled={isClosed}>
                                    <option value="">Selecciona...</option>
                                    <option value="favorable">Favorable</option>
                                    <option value="favorable con vigilancia">Favorable con vigilancia</option>
                                    <option value="reservado">Reservado</option>
                                    <option value="reservado dependiente de adherencia/contexto">Reservado dependiente</option>
                                    <option value="desfavorable">Desfavorable</option>
                                    <option value="incierto">Incierto</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Justificación Clínica Integral</label>
                                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded p-2 text-sm" placeholder="Ej: Basado en severidad actual, adherencia y barreras ambientales..." value={p4_plan_structured.pronostico_biopsicosocial?.justificacion_clinica_integral || ''} onChange={(e) => updateDeepObj('pronostico_biopsicosocial', { justificacion_clinica_integral: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 mt-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Comparativa c/ vs s/ Adherencia al Tratamiento</label>
                                <textarea className="w-full bg-amber-50 border border-amber-200 rounded p-2 text-sm text-amber-900 placeholder:text-amber-700/50 min-h-[60px]" placeholder="Escenario favorable vs desfavorable si abandona..." value={p4_plan_structured.pronostico_biopsicosocial?.comparativa_adherencia || ''} onChange={(e) => updateDeepObj('pronostico_biopsicosocial', { comparativa_adherencia: e.target.value })} disabled={isClosed} />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE F — PILARES DE INTERVENCIÓN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">🏛️</span> F. Pilares de Intervención</h3>
                            {!isClosed && (
                                <button onClick={() => handleUpdateP4({ pilares_intervencion: [...(p4_plan_structured.pilares_intervencion || []), { titulo: '', justificacion: '', foco_que_aborda: [] }] })} className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded hover:bg-emerald-100 uppercase tracking-wider">
                                    + Agregar Pilar
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(p4_plan_structured.pilares_intervencion || []).length === 0 && <p className="text-xs text-slate-400">Sin pilares definidos.</p>}
                            {(p4_plan_structured.pilares_intervencion || []).map((pilar: any, idx: number) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-lg relative group">
                                    {!isClosed && (
                                        <div className="absolute top-1 right-1 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-md shadow-sm p-1 z-10">
                                            <button onClick={() => moveItem('pilares_intervencion', idx, 'up')} disabled={idx === 0} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1.5 rounded text-[10px] leading-none disabled:opacity-30">▲</button>
                                            <button onClick={() => moveItem('pilares_intervencion', idx, 'down')} disabled={idx === (p4_plan_structured.pilares_intervencion?.length || 0) - 1} className="text-slate-400 hover:text-emerald-600 hover:bg-slate-100 p-1.5 rounded text-[10px] leading-none disabled:opacity-30">▼</button>
                                            <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                                            <button onClick={() => { const copy = [...(p4_plan_structured.pilares_intervencion || [])]; copy.splice(idx, 1); handleUpdateP4({ pilares_intervencion: copy }); }} className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded text-[10px] font-bold leading-none">✕</button>
                                        </div>
                                    )}
                                    <input type="text" className="w-full bg-white border border-slate-200 rounded p-1.5 text-sm font-bold text-slate-800 mb-2 truncate pr-6" value={pilar.titulo} onChange={(e) => { const copy = [...(p4_plan_structured.pilares_intervencion || [])]; copy[idx].titulo = e.target.value; handleUpdateP4({ pilares_intervencion: copy }); }} placeholder="Título del Pilar (Ej: Educación)" disabled={isClosed} />
                                    <textarea className="w-full bg-transparent border-none p-0 text-xs text-slate-600 outline-none resize-none h-12 mb-2" value={pilar.justificacion} onChange={(e) => { const copy = [...(p4_plan_structured.pilares_intervencion || [])]; copy[idx].justificacion = e.target.value; handleUpdateP4({ pilares_intervencion: copy }); }} placeholder="Por qué es necesario..." disabled={isClosed} />
                                    <div>
                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Focos (Separados por coma)</label>
                                        <input type="text" className="w-full bg-white border border-slate-200 rounded p-1.5 text-xs text-slate-600" value={(pilar.foco_que_aborda || []).join(', ')} onChange={(e) => { const copy = [...(p4_plan_structured.pilares_intervencion || [])]; copy[idx].foco_que_aborda = e.target.value.split(',').map((x: string) => x.trim()).filter(Boolean); handleUpdateP4({ pilares_intervencion: copy }); }} placeholder="Ej: kinesiofobia, fuerza..." disabled={isClosed} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* BLOQUE G — PLAN MAESTRO */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-2 border-b pb-2 flex items-center gap-2"><span className="text-lg">🗺️</span> G. Plan Maestro (Hoja de Ruta)</h3>
                        <p className="text-xs text-slate-500 mb-3">Narrativa libre que guía las primeras sesiones, progresiones esperadas, criterios de ajuste y alertas.</p>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[240px] text-sm text-slate-800 outline-none focus:border-emerald-400 disabled:opacity-75"
                            placeholder="Desarrolla el enfoque, sesiones sugeridas, focos de inicio de cuidado..."
                            value={p4_plan_structured.plan_maestro || ''}
                            onChange={(e) => handleUpdateP4({ plan_maestro: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>

                    {/* BLOQUE H — REGLAS DE REEVALUACIÓN */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-emerald-900 mb-4 border-b border-emerald-200 pb-2 flex items-center gap-2"><span className="text-lg">🔄</span> H. Reglas de Reevaluación y Seguimiento</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Signo Comparable Principal</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" value={p4_plan_structured.reglas_reevaluacion?.signo_comparable_principal || ''} onChange={(e) => updateDeepObj('reglas_reevaluacion', { signo_comparable_principal: e.target.value })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Variables de Seguimiento (coma)</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" value={(p4_plan_structured.reglas_reevaluacion?.variables_seguimiento || []).join(', ')} onChange={(e) => updateDeepObj('reglas_reevaluacion', { variables_seguimiento: e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Frecuencia Sugerida</label>
                                <input type="text" className="w-full bg-white border border-emerald-200 rounded p-2 text-sm" placeholder="Ej: Todas las sesiones / Quincenal" value={p4_plan_structured.reglas_reevaluacion?.frecuencia_sugerida || ''} onChange={(e) => updateDeepObj('reglas_reevaluacion', { frecuencia_sugerida: e.target.value })} disabled={isClosed} />
                            </div>
                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                    <label className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">Criterio de Mejora Real</label>
                                    <textarea className="w-full border-none outline-none text-xs h-[40px] resize-none" placeholder="Ej: Aumento >20% en dinamometría sin irritación..." value={p4_plan_structured.reglas_reevaluacion?.criterio_mejora_real || ''} onChange={(e) => updateDeepObj('reglas_reevaluacion', { criterio_mejora_real: e.target.value })} disabled={isClosed} />
                                </div>
                                <div className="bg-white p-3 rounded-lg border border-emerald-100">
                                    <label className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block mb-1">Criterio de Estancamiento / Derivación</label>
                                    <textarea className="w-full border-none outline-none text-xs h-[40px] resize-none" placeholder="Ej: Mismo dolor a las 4 semanas, derivar..." value={p4_plan_structured.reglas_reevaluacion?.criterio_estancamiento_derivacion || ''} onChange={(e) => updateDeepObj('reglas_reevaluacion', { criterio_estancamiento_derivacion: e.target.value })} disabled={isClosed} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PANEL DE TELEMETRÍA (ADMIN/DOCENTE) */}
            {((user?.role as string) === 'ADMIN' || (user?.role as string) === 'DOCENTE') && p4_plan_structured.ia_metadata && (
                <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-xs font-mono mt-6 mb-2 flex flex-col gap-1 border border-slate-700 shadow-inner">
                    <h4 className="text-slate-100 font-bold mb-2 flex items-center gap-2"><span className="text-base">📡</span> Terminal de Telemetría P4 (Admin)</h4>
                    <p><span className="text-slate-500">Action Type:</span> {p4_plan_structured.ia_metadata.draft_mode || 'N/A'}</p>
                    <p><span className="text-slate-500">Active Model:</span> <span className="text-amber-400 font-bold">{p4_plan_structured.ia_metadata.model_used || 'Desconocido'}</span></p>
                    <p><span className="text-slate-500">Fallback Triggereado:</span> {p4_plan_structured.ia_metadata.fallback_used ? <span className="text-rose-400 font-bold">SÍ</span> : <span className="text-emerald-400">NO</span>}</p>
                    <p><span className="text-slate-500">Payload Hash:</span> <span className="text-emerald-400 font-bold truncate inline-block w-48 align-bottom">{p4_plan_structured.ia_metadata.input_hash}</span></p>
                    <p><span className="text-slate-500">Cache local hit:</span> {p4_plan_structured.ia_metadata.cache_hit ? <span className="text-emerald-400 font-bold">Activa (Prevenida re-query)</span> : 'No'}</p>
                    <p><span className="text-slate-500">Network Latency (último API):</span> {formData.aiOutputs?.narrativeTelemetry?.latencyMs}ms</p>
                </div>
            )}
        </div>
    );
}
