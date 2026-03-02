import React, { useState } from "react";
import { Evaluacion } from "@/types/clinica";

interface M12Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M12_ObjetivosSemaforo({ formData, updateFormData, isClosed }: M12Props) {
    const [isGenerating, setIsGenerating] = useState(false);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const objVersion = formData.objectivesVersion || {
        objectiveSetVersionId: generateId(),
        objectives: []
    };

    const opPlan = formData.operationalPlan || {};

    const updateObj = (index: number, field: string, value: any) => {
        updateFormData(prev => {
            const currentObjs = [...(prev.objectivesVersion?.objectives || [])];
            currentObjs[index] = { ...currentObjs[index], [field]: value };
            return {
                objectivesVersion: {
                    ...(prev.objectivesVersion || { objectiveSetVersionId: generateId() }),
                    objectives: currentObjs
                }
            };
        });
    };

    const addObj = (tipo: 'General' | 'Específico') => {
        updateFormData(prev => ({
            objectivesVersion: {
                ...(prev.objectivesVersion || { objectiveSetVersionId: generateId() }),
                objectives: [
                    ...(prev.objectivesVersion?.objectives || []),
                    { id: generateId(), tipo, texto: '', estado: 'Pendiente' as any }
                ]
            }
        }));
    };

    const removeObj = (index: number) => {
        updateFormData(prev => ({
            objectivesVersion: {
                ...(prev.objectivesVersion || { objectiveSetVersionId: generateId() }),
                objectives: (prev.objectivesVersion?.objectives || []).filter((_, i) => i !== index)
            }
        }));
    };

    const updatePlan = (field: string, value: any) => {
        updateFormData(prev => ({
            operationalPlan: {
                ...(prev.operationalPlan || {}),
                [field]: value
            }
        }));
    };

    // Usaremos cast a any para loadTrafficLight si aún no está en main interface
    const updateRoot = (field: string, value: any) => {
        updateFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const rootData = formData as any;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const prompt = `Genera Objetivos SMART, dosificación (semáforo) y pronóstico (M12) basado en:
${JSON.stringify(formData, null, 2)}

Devuelve estrictamente un JSON con "objectives" (array de {id, tipo: 'General'|'Específico', descripcion, medida, tiempoDignostico}), "loadTrafficLight" ('Verde'|'Amarillo'|'Rojo'), "loadTrafficLightJustification", "prognosisLabel", y "operationalPlan" ({educationPlan: string, interventionsPlanned: array de strings}).`;

            const res = await fetch('/api/ai/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, schemaType: 'm12_obj' })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.error || 'Error en Gemini');

            const realOutput = data.data;

            updateFormData(prev => ({
                objectivesVersion: {
                    objectiveSetVersionId: generateId(),
                    objectives: realOutput.objectives.map((o: any) => ({
                        id: generateId(),
                        tipo: o.tipo,
                        texto: o.descripcion,
                        criterioExito: o.medida,
                        estado: 'Pendiente'
                    }))
                },
                operationalPlan: {
                    ...(prev.operationalPlan || {}),
                    educationPlan: realOutput.operationalPlan.educationPlan,
                    interventionsPlanned: realOutput.operationalPlan.interventionsPlanned
                },
                loadTrafficLight: realOutput.loadTrafficLight,
                prognosisLabel: realOutput.prognosisLabel,
                ai: { ...(prev.ai || {}), lastRunAt: new Date().toISOString() }
            }));
        } catch (e) {
            console.error(e);
            alert("Error IA");
        } finally {
            setIsGenerating(false);
        }
    };

    const objList = objVersion.objectives || [];
    const gralCount = objList.filter(o => o.tipo === 'General').length;
    const espCount = objList.filter(o => o.tipo === 'Específico').length;
    const validObjs = gralCount >= 1 && espCount >= 2;

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🎯</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M12: Objetivos, Plan y Semáforo</h3>
                    <p className="text-xs text-slate-500 font-medium">Metas SMART, Semáforo de Carga y plan de acción.</p>
                </div>
            </div>

            <div className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6">

                {/* AI Trigger */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-emerald-900 mb-1 flex items-center gap-2">
                            <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Generación SMART IA
                        </h4>
                        <p className="text-[10px] text-emerald-700/80">Gemini diseña metas y calcula el semáforo basado en tu M9 y M11.</p>
                    </div>
                    {!isClosed && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`shrink-0 px-4 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${isGenerating ? 'bg-emerald-200 text-emerald-600 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md'}`}
                        >
                            {isGenerating ? 'Calculando Plan...' : '✨ Sugerir Plan'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* Objetivos Section */}
                    <div className={`border rounded-xl p-4 transition-colors ${!validObjs ? 'bg-rose-50/30 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><span className="text-indigo-500">🚩</span> Matriz de Objetivos</h5>
                            {!validObjs && <span className="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">Req: 1 Gral, 2 Esp.</span>}
                        </div>

                        <div className="space-y-3">
                            {objList.map((obj, i) => (
                                <div key={obj.id} className="bg-white border text-xs border-slate-200 rounded-lg p-3 relative shadow-sm">
                                    {!isClosed && <button onClick={() => removeObj(i)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500">✗</button>}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${obj.tipo === 'General' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {obj.tipo}
                                        </span>
                                    </div>
                                    <input
                                        type="text" disabled={isClosed} placeholder="Texto del objetivo..." value={obj.texto} onChange={e => updateObj(i, 'texto', e.target.value)}
                                        className="w-full font-medium text-slate-800 bg-transparent outline-none border-b border-dashed border-slate-200 focus:border-indigo-400 mb-2 pb-1"
                                    />
                                    <input
                                        type="text" disabled={isClosed} placeholder="Criterio de éxito (ej. ROM > 90°)..." value={obj.criterioExito || ''} onChange={e => updateObj(i, 'criterioExito', e.target.value)}
                                        className="w-full text-[10px] text-slate-500 bg-slate-50 rounded px-2 py-1 outline-none border border-slate-100 focus:border-indigo-300"
                                    />
                                </div>
                            ))}
                            {objList.length === 0 && <p className="text-[10px] text-slate-400 text-center italic py-2">Sin objetivos definidos.</p>}
                        </div>

                        {!isClosed && (
                            <div className="flex gap-2 mt-4">
                                <button onClick={() => addObj('General')} className="flex-1 bg-white border border-slate-300 text-slate-600 text-[10px] font-bold py-1.5 rounded hover:bg-slate-50">+ General</button>
                                <button onClick={() => addObj('Específico')} className="flex-1 bg-white border border-slate-300 text-slate-600 text-[10px] font-bold py-1.5 rounded hover:bg-slate-50">+ Específico</button>
                            </div>
                        )}
                    </div>

                    {/* Semáforo y Plan */}
                    <div className="space-y-4">

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h5 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">🚦 Load Traffic Light & Pronóstico</h5>
                            <div className="grid grid-cols-3 gap-2 mb-3">
                                {['Verde', 'Amarillo', 'Rojo'].map(col => {
                                    const colStyles: any = {
                                        'Verde': 'bg-emerald-500 text-white border-emerald-600 shadow-sm',
                                        'Amarillo': 'bg-amber-500 text-white border-amber-600 shadow-sm',
                                        'Rojo': 'bg-rose-500 text-white border-rose-600 shadow-sm'
                                    };
                                    const isSel = rootData.loadTrafficLight === col;
                                    return (
                                        <button
                                            key={col} disabled={isClosed} onClick={() => updateRoot('loadTrafficLight', col)}
                                            className={`py-2 rounded-lg text-xs font-bold border transition-colors ${isSel ? colStyles[col] : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {col}
                                        </button>
                                    );
                                })}
                            </div>
                            <input
                                type="text" disabled={isClosed} placeholder="Pronóstico sugerido (ej. Bueno, 4 semanas)..." value={rootData.prognosisLabel || ''} onChange={e => updateRoot('prognosisLabel', e.target.value)}
                                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400"
                            />
                        </div>

                        <div className={`bg-slate-50 border rounded-xl p-4 transition-colors ${!opPlan.educationPlan?.trim() ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'}`}>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between">
                                <span>Plan Operativo & Educación <span className="text-rose-500">*</span></span>
                                {!opPlan.educationPlan?.trim() && <span className="text-[9px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">Req.</span>}
                            </label>
                            <textarea
                                rows={3} disabled={isClosed} placeholder="Educación entregada, intervenciones a realizar..." value={opPlan.educationPlan || ''} onChange={e => updatePlan('educationPlan', e.target.value)}
                                className="w-full text-xs font-medium bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-indigo-400 resize-none"
                            />
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
