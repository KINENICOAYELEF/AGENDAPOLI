import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M5Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M5_FuncionActividad({ formData, updateFormData, isClosed }: M5Props) {
    const psfs = formData.psfs || {
        activities: [],
        quickActivitiesTags: []
    };

    const addActivity = () => {
        if (psfs.activities.length >= 5) {
            alert("El PSFS recomienda un máximo de 5 actividades.");
            return;
        }
        updateFormData(prev => ({
            psfs: {
                ...prev.psfs,
                activities: [...(prev.psfs?.activities || []), { activity: '', score: 5 }],
                quickActivitiesTags: prev.psfs?.quickActivitiesTags || []
            }
        }));
    };

    const updateActivity = (index: number, field: 'activity' | 'score', value: any) => {
        updateFormData(prev => {
            const newActivities = [...(prev.psfs?.activities || [])];
            newActivities[index] = { ...newActivities[index], [field]: value };
            return {
                psfs: {
                    ...(prev.psfs || { quickActivitiesTags: [] }),
                    activities: newActivities
                }
            };
        });
    };

    const removeActivity = (index: number) => {
        updateFormData(prev => {
            const newActivities = prev.psfs?.activities?.filter((_, i) => i !== index) || [];
            return {
                psfs: {
                    ...(prev.psfs || { quickActivitiesTags: [] }),
                    activities: newActivities
                }
            };
        });
    };

    const toggleQuickTag = (tag: string) => {
        updateFormData(prev => {
            const currentTags = prev.psfs?.quickActivitiesTags || [];
            const newTags = currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag];
            return {
                psfs: {
                    ...(prev.psfs || { activities: [] }),
                    quickActivitiesTags: newTags
                }
            };
        });
    };

    const quickActivities = [
        "Caminar", "Correr", "Subir escaleras", "Bajar escaleras",
        "Sentadilla / Agacharse", "Levantar peso", "Dormir", "Lanzar / Overhead",
        "Saltar", "Estar sentado >1hr"
    ];

    const psfsAverage = psfs.activities.length > 0
        ? (psfs.activities.reduce((sum, item) => sum + Number(item.score), 0) / psfs.activities.length).toFixed(1)
        : '0.0';

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-2 px-1">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🏃</span>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">M5: Función y Actividad (PSFS)</h3>
                        <p className="text-xs text-slate-500 font-medium">Escala Funcional Específica del Paciente y etiquetas de contexto.</p>
                    </div>
                </div>
                {!isClosed && psfs.activities.length < 5 && (
                    <button
                        onClick={addActivity}
                        className="text-[10px] md:text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Añadir Actividad ({psfs.activities.length}/5)
                    </button>
                )}
            </div>

            <div className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6">

                {/* Quick Tags */}
                <div>
                    <h4 className="text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Etiquetas de Actividad Afectada Rápida</h4>
                    <div className="flex flex-wrap gap-2">
                        {quickActivities.map(tag => (
                            <button
                                key={tag}
                                onClick={() => toggleQuickTag(tag)}
                                disabled={isClosed}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors border ${psfs.quickActivitiesTags?.includes(tag)
                                    ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Patient Specific Functional Scale */}
                <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-bold text-slate-800">
                            Tabla PSFS (0 = Incapaz de realizarla, 10 = Nivel previo a la lesión)
                        </h4>
                        {psfs.activities.length > 0 && (
                            <div className="bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200 shadow-sm font-black text-sm">
                                Índice PSFS: {psfsAverage}
                            </div>
                        )}
                    </div>

                    {psfs.activities.length === 0 ? (
                        <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                            <p className="text-sm font-medium text-slate-500 mb-3">Aún no has registrado actividades limitadas.</p>
                            {!isClosed && (
                                <button onClick={addActivity} className="text-xs font-bold bg-white border border-slate-300 shadow-sm px-4 py-2 rounded-lg text-indigo-700 hover:bg-indigo-50 transition-colors">
                                    + Registrar Primera Actividad
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {psfs.activities.map((item, idx) => (
                                <div key={idx} className="flex flex-col md:flex-row gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                                    <div className="flex-1 w-full relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-slate-400 font-bold text-xs">{idx + 1}.</span>
                                        </div>
                                        <input
                                            type="text"
                                            value={item.activity}
                                            onChange={e => updateActivity(idx, 'activity', e.target.value)}
                                            disabled={isClosed}
                                            placeholder="Ej. Caminar 15 minutos sin dolor"
                                            className="w-full pl-8 pr-4 py-2 text-sm border-slate-300 rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none font-medium text-slate-800 border"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-500 mb-1">Puntaje (0-10)</span>
                                            <input
                                                type="range"
                                                min="0"
                                                max="10"
                                                step="1"
                                                value={item.score}
                                                onChange={e => updateActivity(idx, 'score', Number(e.target.value))}
                                                disabled={isClosed}
                                                className="w-32 md:w-24 accent-indigo-600 cursor-pointer"
                                            />
                                        </div>
                                        <div className={`w-8 h-8 flex items-center justify-center rounded-lg font-black text-sm shadow-sm ${item.score <= 3 ? 'bg-rose-100 text-rose-800' :
                                                item.score <= 7 ? 'bg-amber-100 text-amber-800' :
                                                    'bg-emerald-100 text-emerald-800'
                                            }`}>
                                            {item.score}
                                        </div>
                                        {!isClosed && (
                                            <button onClick={() => removeActivity(idx)} className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-2">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
