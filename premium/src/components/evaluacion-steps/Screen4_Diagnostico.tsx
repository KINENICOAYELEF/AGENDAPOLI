import React, { useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";

export interface Screen4Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

export function Screen4_Diagnostico({ formData, updateFormData, isClosed }: Screen4Props) {
    const { geminiDiagnostic = {} } = formData;
    const [isGeneratingDx, setIsGeneratingDx] = useState(false);
    const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleUpdateGemini = (patch: any) => {
        updateFormData(prev => ({
            geminiDiagnostic: { ...(prev.geminiDiagnostic || {}), ...patch }
        }));
    };

    const handleGenerateDx = async () => {
        if (isClosed) return;
        setIsGeneratingDx(true);
        setAiError(null);
        try {
            const res = await fetch('/api/ai/diagnosis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    interview: formData.interview,
                    exam: formData.guidedExam,
                    synthesis: formData.autoSynthesis
                })
            });
            if (!res.ok) throw new Error("Error en IA Gemini de Diagnóstico.");
            const data = await res.json();
            handleUpdateGemini({
                kinesiologicalDxNarrative: data.data?.diagnosis_narrative || '',
                differentialFunctional: data.data?.differential_functional?.join('\\n') || '',
                safetyAlerts: data.data?.safety_alerts || [],
                clinicalConsiderations: data.data?.clinical_considerations || [],
                missingData: data.data?.missing_data_to_confirm || []
            });
        } catch (err: any) {
            setAiError(err.message || 'Falló la generación de diagnóstico IA.');
        } finally {
            setIsGeneratingDx(false);
        }
    };

    const handleGeneratePlan = async () => {
        if (isClosed) return;
        setIsGeneratingPlan(true);
        setAiError(null);
        try {
            const res = await fetch('/api/ai/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    diagnosticContext: formData.geminiDiagnostic,
                    synthesis: formData.autoSynthesis
                })
            });
            if (!res.ok) throw new Error("Error en IA Gemini de Planificación.");
            const data = await res.json();
            const plan = data.data; // Zod parsed PlanSchema

            const fetchedSmart = plan.specific_goals?.map((g: any) => ({
                text: g.statement,
                linkedDeficit: g.linked_deficits?.join(', ') || ''
            })) || [];

            const fetchedInterventions = plan.interventions_by_goal?.flatMap((g: any) =>
                g.interventions.map((i: any) => `- ${i.type.toUpperCase()}: ${i.summary} | Dosis: ${i.dose.freq_per_week}, ${i.dose.sets}x${i.dose.reps_or_time} (${i.dose.intensity}).`)
            ) || [];

            const fetchedProgRules = plan.load_management ?
                `Carga sugerida: ${plan.load_management.traffic_light.toUpperCase()}\\nDolor permitido: ${plan.load_management.rules.pain_rule}\\nProgresión: ${plan.load_management.rules.progression_rule}`
                : '';

            handleUpdateGemini({
                objectivesGeneral: plan.general_goals || [],
                objectivesSmart: fetchedSmart,
                operationalPlan: {
                    interventions: fetchedInterventions,
                    dosage: fetchedInterventions.join('\\n') + '\\n\\n-- REGLAS DE CARGA --\\n' + fetchedProgRules
                },
                prognosis: `${plan.functional_prognosis?.category?.toUpperCase()} - ${plan.functional_prognosis?.rationale?.join(' ')}`,
                prognosisFactors: plan.functional_prognosis?.modifiable_factors?.join(', ') || ''
            });
        } catch (err: any) {
            setAiError(err.message || 'Falló la generación de metas IA.');
        } finally {
            setIsGeneratingPlan(false);
        }
    };

    // Helper functions for array updates
    const updateSmartObj = (idx: number, patch: any) => {
        const next = [...(geminiDiagnostic.objectivesSmart || [])];
        next[idx] = { ...next[idx], ...patch };
        handleUpdateGemini({ objectivesSmart: next });
    };
    const addSmartObj = () => {
        handleUpdateGemini({ objectivesSmart: [...(geminiDiagnostic.objectivesSmart || []), { text: '', linkedDeficit: '' }] });
    };
    const removeSmartObj = (idx: number) => {
        const next = [...(geminiDiagnostic.objectivesSmart || [])];
        next.splice(idx, 1);
        handleUpdateGemini({ objectivesSmart: next });
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">IA Gemini: Diagnóstico y Metas</h2>
                <p className="text-sm text-slate-500 mt-1">Integra el motor inteligente para formatear narrativas y objetivos precisos (SMART).</p>
            </div>

            {aiError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm flex gap-3 items-center">
                    <span className="text-xl">⚠️</span> {aiError}
                </div>
            )}

            {/* SECCIÓN 1: DIAGNÓSTICO KINESIOLÓGICO */}
            <div className="bg-white border border-indigo-100 rounded-2xl shadow-md overflow-hidden flex flex-col">
                <div className="bg-indigo-50 border-b border-indigo-100 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2"><span className="text-xl">🧠</span> 1. Categorización y Diagnóstico</h3>
                        <p className="text-xs text-indigo-700 mt-0.5">Narrativa BPS, Diagnóstico Kinesiológico y Funcional Diferencial.</p>
                    </div>
                    {!isClosed && (
                        <button onClick={handleGenerateDx} disabled={isGeneratingDx} className="shrink-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50">
                            {isGeneratingDx ? <span className="animate-spin">🔄</span> : <span>✨</span>}
                            {isGeneratingDx ? 'Procesando...' : 'Generar Dx. Kinesiológico'}
                        </button>
                    )}
                </div>

                <div className="p-5 flex flex-col gap-5">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Diagnóstico Kinesiológico Narrativo</label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white min-h-[120px] leading-relaxed"
                            placeholder="Ej: Impingement subacromial secundario a disquinesia escapular y déficit de control motor en rotadores externos, en contexto de sobrecarga deportiva y kinesiofobia moderada..."
                            value={geminiDiagnostic.kinesiologicalDxNarrative || ''}
                            onChange={e => handleUpdateGemini({ kinesiologicalDxNarrative: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Diferencial Funcional</label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white min-h-[80px]"
                            placeholder="Descarte o principal hipótesis funcional contrastante..."
                            value={geminiDiagnostic.differentialFunctional || ''}
                            onChange={e => handleUpdateGemini({ differentialFunctional: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>

                    {/* ALERTAS DEL DIAGNÓSTICO IA */}
                    {((geminiDiagnostic.missingData?.length ?? 0) > 0 || (geminiDiagnostic.safetyAlerts?.length ?? 0) > 0) && (
                        <div className="flex flex-col gap-3 mt-2 border-t border-indigo-100 pt-5">
                            {(geminiDiagnostic.missingData?.length ?? 0) > 0 && (
                                <div className="bg-amber-50 text-amber-800 p-3 rounded-xl border border-amber-200 text-xs shadow-sm flex gap-3">
                                    <span className="text-base shrink-0">⚠️</span>
                                    <div>
                                        <strong className="block mb-1">Información Faltante Relevante:</strong>
                                        <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                                            {geminiDiagnostic.missingData!.map((m: string, i: number) => <li key={i}>{m}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}
                            {(geminiDiagnostic.safetyAlerts?.length ?? 0) > 0 && (
                                <div className="bg-rose-50 text-rose-800 p-3 rounded-xl border border-rose-200 text-xs shadow-sm flex gap-3">
                                    <span className="text-base shrink-0">🛑</span>
                                    <div>
                                        <strong className="block mb-1">Alertas de Seguridad:</strong>
                                        <ul className="list-disc pl-4 space-y-0.5 opacity-90">
                                            {geminiDiagnostic.safetyAlerts!.map((a: string, i: number) => <li key={i}>{a}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN 2: METAS Y PLAN (DEPENDIENTE DEL DX) */}
            <div className={`transition-all duration-700 ${!geminiDiagnostic.kinesiologicalDxNarrative ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                <div className="bg-white border border-emerald-100 rounded-2xl shadow-md overflow-hidden flex flex-col">
                    <div className="bg-emerald-50 border-b border-emerald-100 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h3 className="font-bold text-emerald-900 flex items-center gap-2"><span className="text-xl">🎯</span> 2. Plan Maestro y Objetivos SMART</h3>
                            <p className="text-xs text-emerald-700 mt-0.5">Requiere tener contexto de evaluación completo y diagnóstico trazado.</p>
                        </div>
                        {!isClosed && (
                            <button onClick={handleGeneratePlan} disabled={isGeneratingPlan || !geminiDiagnostic.kinesiologicalDxNarrative} className="shrink-0 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50">
                                {isGeneratingPlan ? <span className="animate-spin">🔄</span> : <span>✨</span>}
                                {isGeneratingPlan ? 'Calculando Plan...' : 'Generar Metas + Plan'}
                            </button>
                        )}
                    </div>

                    <div className="p-5 flex flex-col gap-8">

                        {/* OBJETIVOS GENERALES */}
                        {geminiDiagnostic.objectivesGeneral && geminiDiagnostic.objectivesGeneral.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Objetivos Generales (Propuesta IA)</label>
                                <ul className="list-disc pl-5 text-sm space-y-1 text-slate-700">
                                    {geminiDiagnostic.objectivesGeneral.map((og: string, idx: number) => <li key={idx}>{og}</li>)}
                                </ul>
                            </div>
                        )}

                        {/* OBJETIVOS SMART */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Objetivos Funcionales Específicos (SMART)</label>
                                {!isClosed && (
                                    <button onClick={addSmartObj} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-2 py-1 rounded border border-slate-200 uppercase tracking-wide">
                                        + Agregar Meta
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3">
                                {(geminiDiagnostic.objectivesSmart || []).length === 0 && (
                                    <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-6 text-center text-sm text-slate-500 italic">
                                        Aún no hay metas SMART generadas. Presiona "Generar Metas + Plan".
                                    </div>
                                )}
                                {(geminiDiagnostic.objectivesSmart || []).map((obj: any, idx: number) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm relative group flex flex-col gap-3">
                                        {!isClosed && <button onClick={() => removeSmartObj(idx)} className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}

                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black flex items-center justify-center shrink-0 border border-emerald-200 mt-1">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 pr-8">
                                                <textarea
                                                    className="w-full bg-transparent border-b border-dashed border-slate-300 pb-1 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 min-h-[40px] resize-y"
                                                    placeholder="Meta medible (Ej: Lograr 90° flexión activa hombro sin dolor pasadas 2 semanas)..."
                                                    value={obj.text}
                                                    onChange={e => updateSmartObj(idx, { text: e.target.value })}
                                                    disabled={isClosed}
                                                />
                                            </div>
                                        </div>

                                        <div className="pl-11">
                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 focus-within:border-emerald-300 focus-within:bg-emerald-50/30 transition-colors">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0">Déficit Dirigido:</span>
                                                <input
                                                    type="text"
                                                    className="w-full bg-transparent text-xs text-slate-700 outline-none"
                                                    placeholder="Ej: Déficit ROM Flexión GH"
                                                    value={obj.linkedDeficit}
                                                    onChange={e => updateSmartObj(idx, { linkedDeficit: e.target.value })}
                                                    disabled={isClosed}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* PLAN OPERACIONAL Y PRONÓSTICO */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="text-sm">🏥</span> Pilar de Intervención</label>
                                <textarea
                                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-emerald-400 min-h-[100px]"
                                    placeholder="Terapia Manual, Educación al paciente, Ejercicio Terapéutico (Dosificación sugerida)..."
                                    value={geminiDiagnostic.operationalPlan?.dosage || ''}
                                    onChange={e => handleUpdateGemini({ operationalPlan: { ...geminiDiagnostic.operationalPlan, dosage: e.target.value } })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><span className="text-sm">🔮</span> Pronóstico Funcional</label>
                                <textarea
                                    className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-700 outline-none focus:border-emerald-400 min-h-[100px]"
                                    placeholder="Favorable / Reservado... dependiente de..."
                                    value={geminiDiagnostic.prognosis || ''}
                                    onChange={e => handleUpdateGemini({ prognosis: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>

                    </div>
                </div>
            </div>

        </div>
    );
}
