import React from "react";
import { Evaluacion, MotivoEvaluacion } from "@/types/clinica";

export function Step1Entrevista({
    formData,
    updateFormData,
    isClosed
}: {
    formData: Partial<Evaluacion>,
    updateFormData: (patch: any) => void,
    isClosed: boolean
}) {
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    const addMotivo = () => {
        const newMotivo: MotivoEvaluacion = {
            id: generateId(),
            motivoLabel: `Foco Secundario`,
            region: '',
            lado: 'N/A',
            subjective: { mechanism: '', onsetDateOrDuration: '', irritability: 'Media', functionalLimitationPrimary: '' } as any,
            redFlagsChecklist: {},
            objectiveExam: {},
            impairmentSummary: {}
        };
        updateFormData((prev: Partial<Evaluacion>) => ({
            ...prev,
            motivos: [...(prev.motivos || []), newMotivo]
        }));
    };

    const updateMotivo = (id: string, fieldPath: string, value: any) => {
        updateFormData((prev: Partial<Evaluacion>) => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === id);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };
            const keys = fieldPath.split('.');

            if (keys.length === 1) {
                (motivo as any)[keys[0]] = value;
            } else if (keys.length === 2) {
                (motivo as any)[keys[0]] = { ...(motivo as any)[keys[0]], [keys[1]]: value };
            }

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const removeMotivo = (id: string, label: string) => {
        if (confirm(`¿Eliminar la zona ${label}?`)) {
            updateFormData((prev: Partial<Evaluacion>) => ({
                ...prev,
                motivos: prev.motivos?.filter(m => m.id !== id)
            }));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-between items-center mb-2">
                <div>
                    <h3 className="text-lg font-black text-slate-800">1. Motivos y Entrevista</h3>
                    <p className="text-xs text-slate-500 font-medium">Define las zonas de dolor y la anamnesis subjetiva.</p>
                </div>
                {!isClosed && (
                    <button
                        onClick={addMotivo}
                        className="text-[10px] uppercase tracking-wider font-bold text-indigo-700 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Añadir Zona
                    </button>
                )}
            </div>

            {formData.motivos?.map((motivo, index) => (
                <div key={motivo.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                    {/* Header Motivo */}
                    <div className="bg-slate-50/50 border-b border-slate-100 p-4 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Jerarquía</label>
                                <input type="text" value={motivo.motivoLabel} onChange={e => updateMotivo(motivo.id, 'motivoLabel', e.target.value)} disabled={isClosed} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-indigo-900 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition-all" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Región Corporal</label>
                                <input type="text" value={motivo.region} onChange={e => updateMotivo(motivo.id, 'region', e.target.value)} disabled={isClosed} placeholder="Ej. Rodilla, Hombro" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Lado</label>
                                <select value={motivo.lado} onChange={e => updateMotivo(motivo.id, 'lado', e.target.value)} disabled={isClosed} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:border-indigo-400 outline-none transition-all">
                                    <option value="N/A">N/A</option>
                                    <option value="Derecho">Derecho</option>
                                    <option value="Izquierdo">Izquierdo</option>
                                    <option value="Bilateral">Bilateral</option>
                                </select>
                            </div>
                        </div>
                        {!isClosed && formData.motivos!.length > 1 && (
                            <button onClick={() => removeMotivo(motivo.id, motivo.motivoLabel)} className="w-full md:w-auto mt-2 md:mt-0 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 transition-colors">
                                Quitar Foco
                            </button>
                        )}
                    </div>

                    {/* Entrevista Structurada */}
                    <div className="p-4 md:p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mecanismo de Lesión / Contexto de Inicio <span className="text-rose-500">*</span></label>
                                <textarea rows={2} value={motivo.subjective?.mechanism || ''} onChange={e => updateMotivo(motivo.id, 'subjective.mechanism', e.target.value)} disabled={isClosed} placeholder="Ej. Caída esquiando, torsión de rodilla con pie fijo. Paciente sintió un 'pop'." className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50 transition-colors" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Tiempo de Evolución / Onset</label>
                                <input type="text" value={motivo.subjective?.onsetDateOrDuration || ''} onChange={e => updateMotivo(motivo.id, 'subjective.onsetDateOrDuration', e.target.value)} disabled={isClosed} placeholder="Ej. 3 días, 6 meses (Insidioso)" className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:border-indigo-400 outline-none bg-slate-50" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Irritabilidad</label>
                                <select value={motivo.subjective?.irritability || 'Media'} onChange={e => updateMotivo(motivo.id, 'subjective.irritability', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-semibold focus:border-indigo-400 outline-none bg-slate-50">
                                    <option value="Baja">Baja (Tolera carga, dolor cesa rápido)</option>
                                    <option value="Media">Media (Dolor moderado que demora en bajar)</option>
                                    <option value="Alta">Alta (Dolor agudo constante, reposo no alivia)</option>
                                </select>
                            </div>

                            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Factores Agravantes</label>
                                    <input type="text" value={motivo.subjective?.aggravatingFactors?.join(', ') || motivo.subjective?.agravantes || ''} onChange={e => updateMotivo(motivo.id, 'subjective.agravantes', e.target.value)} disabled={isClosed} placeholder="Ej. Bajar escaleras, sentadilla profunda" className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:border-indigo-400 outline-none bg-slate-50" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Factores Aliviadores</label>
                                    <input type="text" value={motivo.subjective?.easingFactors?.join(', ') || motivo.subjective?.alivios || ''} onChange={e => updateMotivo(motivo.id, 'subjective.alivios', e.target.value)} disabled={isClosed} placeholder="Ej. Calor local, reposo con pierna elevada" className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:border-indigo-400 outline-none bg-slate-50" />
                                </div>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Limitación Funcional Principal <span className="text-rose-500">*</span></label>
                                <input type="text" value={motivo.subjective?.functionalLimitationPrimary || motivo.subjective?.limitacionFuncional || ''} onChange={e => updateMotivo(motivo.id, 'subjective.functionalLimitationPrimary', e.target.value)} disabled={isClosed} placeholder="La actividad más importante que el dolor le impide realizar." className="w-full border border-slate-200 rounded-xl px-3.5 py-3 text-sm focus:border-indigo-400 outline-none bg-slate-50 font-semibold text-slate-800" />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1.5">Expectativa / Meta del Paciente</label>
                                <textarea rows={2} value={motivo.subjective?.goalOfPerson || motivo.subjective?.metasPersonaUsuaria || ''} onChange={e => updateMotivo(motivo.id, 'subjective.goalOfPerson', e.target.value)} disabled={isClosed} placeholder="Ej. Retornar al fútbol competitivo sin miedo a romperse." className="w-full border border-emerald-200 bg-emerald-50 rounded-xl px-3.5 py-3 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none resize-none" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
