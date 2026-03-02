import React from "react";
import { Evaluacion } from "@/types/clinica";

export function Step5PlanObjetivos({
    formData,
    updateFormData,
    isClosed,
    setAiLoading,
    setAiError,
    aiLoading
}: {
    formData: Partial<Evaluacion>,
    updateFormData: (patch: any) => void,
    isClosed: boolean,
    setAiLoading: (val: string | null) => void,
    setAiError: (val: string | null) => void,
    aiLoading: string | null
}) {

    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    const addObjective = () => {
        const newObj = {
            id: generateId(),
            texto: '',
            tipo: 'Específico' as const,
            medidaAsociada: '',
            criterioExito: ''
        };
        updateFormData((prev: any) => {
            const ov = prev.objectivesVersion || { objectiveSetVersionId: '', objectives: [] };
            return {
                ...prev,
                objectivesVersion: { ...ov, objectives: [...(ov.objectives || []), newObj] }
            };
        });
    };

    const updateObjective = (idx: number, field: string, value: any) => {
        updateFormData((prev: any) => {
            if (!prev.objectivesVersion?.objectives) return prev;
            const newObjs = [...prev.objectivesVersion.objectives];
            newObjs[idx][field] = value;
            return {
                ...prev,
                objectivesVersion: { ...prev.objectivesVersion, objectives: newObjs }
            };
        });
    };

    const removeObjective = (idx: number) => {
        updateFormData((prev: any) => {
            if (!prev.objectivesVersion?.objectives) return prev;
            const newObjs = prev.objectivesVersion.objectives.filter((_: any, i: number) => i !== idx);
            return {
                ...prev,
                objectivesVersion: { ...prev.objectivesVersion, objectives: newObjs }
            };
        });
    };

    const handleGeminiSuggestEvaluacion = async (actionType: 'generarPlanPronostico') => {
        try {
            setAiLoading(actionType);
            setAiError(null);

            const payloadContext = {
                tipo: formData.type,
                motivosEvaluados: formData.motivos || [],
                dx: formData.dxKinesico?.primary || formData.dxKinesiologico || ''
            };

            const currentHash = btoa(encodeURIComponent(JSON.stringify(payloadContext)));
            const aiCache = formData.ai?.outputs || {};

            if (aiCache[actionType]?.hash === currentHash && aiCache[actionType]?.text) {
                const cachedText = aiCache[actionType].text;
                updateFormData((p: any) => ({
                    ...p,
                    attendancePlan: { ...p.attendancePlan, prognosisFunctional: cachedText }
                }));
                setAiLoading(null);
                return;
            }

            const response = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionType, context: payloadContext })
            });

            if (!response.ok) throw new Error("Error en API de Gemini");

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.result) {
                updateFormData((p: any) => ({
                    ...p,
                    attendancePlan: { ...p.attendancePlan, prognosisFunctional: data.result },
                    ai: {
                        ...p.ai,
                        lastRunAt: new Date().toISOString(),
                        outputs: { ...p.ai?.outputs, [actionType]: { hash: currentHash, text: data.result } }
                    }
                }));
            }
        } catch (error: any) {
            console.error(error);
            setAiError("La magia falló. Revisa tu conexión u omitamos la sugerencia por ahora.");
        } finally {
            setAiLoading(null);
        }
    };

    const getAiButton = (actionTarget: 'generarPlanPronostico', label: string) => {
        if (isClosed) return null;
        const isLoading = aiLoading === actionTarget;
        return (
            <button
                onClick={(e) => { e.preventDefault(); handleGeminiSuggestEvaluacion(actionTarget); }}
                disabled={isLoading || !!aiLoading}
                className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm w-fit"
            >
                {isLoading ? (
                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <span className="text-xl leading-none">✨</span>
                )}
                {label}
            </button>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">

            {/* Cabecera */}
            <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <span className="text-2xl leading-none">📋</span>
                    5. Pronóstico, Plan y Objetivos
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Establece la dosimetría y los hitos inmutables de alta del proceso.</p>
            </div>

            {/* Attendance & Prognosis */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-4">
                    <h4 className="text-sm font-bold text-slate-700">A. Asistencia y Pronóstico Funcional</h4>
                </div>
                <div className="p-5 md:p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Frecuencia Semanal Sugerida</label>
                            <select
                                value={formData.attendancePlan?.recommendedFrequencyWeekly || formData.planPronostico?.frecuenciaSemanal || ''}
                                onChange={e => updateFormData((p: any) => ({ ...p, attendancePlan: { ...p.attendancePlan, recommendedFrequencyWeekly: e.target.value } }))}
                                disabled={isClosed}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold focus:bg-white focus:border-indigo-400 outline-none"
                            >
                                <option value="">Seleccione Frecuencia...</option>
                                <option value="1 vez por semana">1 vez por semana</option>
                                <option value="2 veces por semana">2 veces por semana</option>
                                <option value="3 veces por semana">3 veces por semana</option>
                                <option value="Sos (Agendamiento Manual)">SOS (Control a demanda)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Duración Estimada</label>
                            <input
                                type="text"
                                value={formData.attendancePlan?.estimatedDurationWeeks || formData.planPronostico?.duracionEstimadaSemanas || ''}
                                onChange={e => updateFormData((p: any) => ({ ...p, attendancePlan: { ...p.attendancePlan, estimatedDurationWeeks: e.target.value } }))}
                                disabled={isClosed}
                                placeholder="Ej. 12 Semanas"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-semibold focus:bg-white focus:border-indigo-400 outline-none"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Pronóstico Evolutivo</label>
                            <textarea
                                rows={2}
                                value={formData.attendancePlan?.prognosisFunctional || formData.planPronostico?.pronosticoTexto || ''}
                                onChange={e => updateFormData((p: any) => ({ ...p, attendancePlan: { ...p.attendancePlan, prognosisFunctional: e.target.value } }))}
                                disabled={isClosed}
                                placeholder="Expectativa clínica de recuperación..."
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50"
                            />
                            {getAiButton('generarPlanPronostico', 'Evaluar e Inferir Pronóstico (IA)')}
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                Criterios de Alta / Metas Resolutivas <span className="text-emerald-500">*</span>
                            </label>
                            <textarea
                                rows={3}
                                value={formData.attendancePlan?.dischargeCriteria || formData.planPronostico?.criteriosAlta || ''}
                                onChange={e => updateFormData((p: any) => ({ ...p, attendancePlan: { ...p.attendancePlan, dischargeCriteria: e.target.value } }))}
                                disabled={isClosed}
                                placeholder="Ej. PASS > 80, Funcionalidad > 90%, Fuerza Simétrica..."
                                className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none resize-none bg-emerald-50/20 font-medium"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Objetivos SMART */}
            <div className="bg-indigo-50/50 rounded-3xl shadow-sm border border-indigo-100 overflow-hidden">
                <div className="border-b border-indigo-100 p-4 px-5 flex justify-between items-center bg-white/60 backdrop-blur-sm">
                    <div>
                        <h4 className="text-sm font-black text-indigo-900">B. Set de Objetivos Terapéuticos (SMART)</h4>
                        <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider mt-0.5">Versión Maestra del Proceso</p>
                    </div>
                    {!isClosed && (
                        <button onClick={addObjective} className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            <span className="hidden md:inline">Inyectar Objetivo</span>
                        </button>
                    )}
                </div>

                <div className="p-4 md:p-6">
                    {(!formData.objectivesVersion?.objectives || formData.objectivesVersion.objectives.length === 0) ? (
                        <div className="text-indigo-400/80 text-sm p-8 text-center border-2 border-indigo-200/50 border-dashed rounded-2xl bg-white/50">
                            <strong>No hay objetivos estructurados.</strong><br />
                            <span className="text-xs mt-1 block">Recuerde que el semáforo exige al menos 1 Obj. General y 2 Específicos para el alta del documento.</span>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {formData.objectivesVersion.objectives.map((obj: any, i: number) => (
                                <div key={obj.id} className="bg-white border text-sm border-indigo-100 rounded-2xl p-4 shadow-sm relative group overflow-hidden">
                                    <div className={`absolute top-0 left-0 w-1.5 h-full ${obj.tipo === 'General' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                    <div className="pl-3 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">

                                        <div className="md:col-span-3">
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nivel / Jerarquía</label>
                                            <select
                                                value={obj.tipo}
                                                onChange={(e) => updateObjective(i, 'tipo', e.target.value)}
                                                disabled={isClosed}
                                                className={`w-full border rounded-xl px-3 py-2.5 text-xs font-bold outline-none cursor-pointer transition-colors ${obj.tipo === 'General' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}
                                            >
                                                <option value="General">General (Macro)</option>
                                                <option value="Específico">Específico (Micro)</option>
                                            </select>
                                        </div>

                                        <div className="md:col-span-9 grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                                    Acción o Función Meta
                                                    <span className="text-rose-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={obj.texto}
                                                    onChange={(e) => updateObjective(i, 'texto', e.target.value)}
                                                    disabled={isClosed}
                                                    placeholder="Ej. Caminar 10 min en cinta sin claudicar..."
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:bg-white focus:border-indigo-400 outline-none font-semibold text-slate-800"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">KPI (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={obj.medidaAsociada || ''}
                                                        onChange={(e) => updateObjective(i, 'medidaAsociada', e.target.value)}
                                                        disabled={isClosed}
                                                        placeholder="Ej. Flexión Activa / Dinamometría..."
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:bg-white focus:border-indigo-400 outline-none"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1.5">Regla de Éxito</label>
                                                    <input
                                                        type="text"
                                                        value={obj.criterioExito || ''}
                                                        onChange={(e) => updateObjective(i, 'criterioExito', e.target.value)}
                                                        disabled={isClosed}
                                                        placeholder="Ej. LSI > 90% / EVA < 3..."
                                                        className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3.5 py-2.5 text-xs focus:bg-white focus:border-emerald-400 outline-none font-medium text-emerald-900"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {!isClosed && (
                                        <button onClick={() => removeObjective(i)} className="absolute top-2 right-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600 transition-colors bg-white rounded-full p-1.5 md:opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-rose-100">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Plan Operacional (Educación & Casa) */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-100 p-4 px-5">
                    <h4 className="text-sm font-bold text-slate-700">C. Plan Operacional y Casa</h4>
                </div>
                <div className="p-5 md:p-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Prescripción Básica / Direcciones Iniciales</label>
                            <textarea
                                rows={2}
                                value={formData.operationalPlan?.educationPlan || ''}
                                onChange={e => updateFormData((p: any) => ({ ...p, operationalPlan: { ...p.operationalPlan, educationPlan: e.target.value } }))}
                                disabled={isClosed}
                                placeholder="Ej. Educar sobre mecanización del dolor, evitar posturas hiperflexión, aplicar frío local PM."
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50"
                            />
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
