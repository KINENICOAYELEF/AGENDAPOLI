import React from "react";
import { Evaluacion, MotivoEvaluacion } from "@/types/clinica";

interface M2Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M2_AnamnesisProxima({ formData, updateFormData, isClosed }: M2Props) {
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

    const addMotivo = () => {
        if ((formData.motivos?.length || 0) >= 3) {
            alert("Máximo 3 motivos por evaluación permitidos en V2.");
            return;
        }

        const newMotivo: MotivoEvaluacion = {
            id: generateId(),
            motivoLabel: `Nuevo Foco o Motivo`,
            region: '',
            lado: 'N/A',
            subjective: { mechanism: '', onsetDateOrDuration: '', irritability: 'Media', functionalLimitationPrimary: '' } as any,
            redFlagsChecklist: {},
            objectiveExam: {},
            impairmentSummary: {}
        };
        updateFormData(prev => ({
            motivos: [...(prev.motivos || []), newMotivo]
        }));
    };

    const updateMotivo = (id: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
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
            return { motivos: nuevos };
        });
    };

    const removeMotivo = (id: string, label: string) => {
        if ((formData.motivos?.length || 0) <= 1) {
            alert("Debe existir al menos un motivo principal.");
            return;
        }
        if (confirm(`¿Eliminar la zona ${label}?`)) {
            updateFormData(prev => ({
                motivos: prev.motivos?.filter(m => m.id !== id)
            }));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-2 px-1">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🗣️</span>
                    <div>
                        <h3 className="text-lg font-black text-slate-800">M2: Anamnesis Próxima</h3>
                        <p className="text-xs text-slate-500 font-medium">Define las quejas principales, mecanismo y comportamiento del dolor.</p>
                    </div>
                </div>
                {!isClosed && (formData.motivos?.length || 0) < 3 && (
                    <button
                        onClick={addMotivo}
                        className="text-[10px] md:text-xs uppercase tracking-wider font-bold text-indigo-700 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-2.5 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Añadir Foco ({formData.motivos?.length || 0}/3)
                    </button>
                )}
            </div>

            {formData.motivos?.map((motivo, index) => (
                <div key={motivo.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">
                    {/* Header Motivo */}
                    <div className="bg-slate-50/70 border-b border-slate-100 p-4 lg:px-6 flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 border-l-4 border-indigo-400 pl-3">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre / Zona</label>
                                <input type="text" value={motivo.motivoLabel} onChange={e => updateMotivo(motivo.id, 'motivoLabel', e.target.value)} disabled={isClosed} placeholder="Ej. Rodilla D., Cervical" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Región Anatómica</label>
                                <input type="text" value={motivo.region} onChange={e => updateMotivo(motivo.id, 'region', e.target.value)} disabled={isClosed} placeholder="Ej. Rodilla, Hombro, Columna L." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm focus:border-indigo-400 outline-none transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Lado Afectado</label>
                                <select value={motivo.lado} onChange={e => updateMotivo(motivo.id, 'lado', e.target.value)} disabled={isClosed} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm focus:border-indigo-400 outline-none transition-all">
                                    <option value="N/A">N/A</option>
                                    <option value="Derecho">Derecho</option>
                                    <option value="Izquierdo">Izquierdo</option>
                                    <option value="Bilateral">Bilateral</option>
                                    <option value="Axial">Axial</option>
                                </select>
                            </div>
                        </div>
                        {!isClosed && formData.motivos!.length > 1 && (
                            <button onClick={() => removeMotivo(motivo.id, motivo.motivoLabel)} className="w-full md:w-auto px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-100 transition-colors shrink-0 flex items-center justify-center gap-1.5">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Quitar
                            </button>
                        )}
                    </div>

                    {/* Entrevista Structurada */}
                    <div className="p-4 lg:p-6 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                            <div className="lg:col-span-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Mecanismo de Lesión / Contexto de Inicio <span className="text-rose-500">*</span></label>
                                <textarea rows={2} value={motivo.subjective?.mechanism || ''} onChange={e => updateMotivo(motivo.id, 'subjective.mechanism', e.target.value)} disabled={isClosed} placeholder="Ej. Caída esquiando, torsión de rodilla con pie fijo. Empezó al levantar caja de 20kg del suelo, sintió un 'pop'." className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-100 outline-none resize-none bg-slate-50 transition-colors shadow-inner font-medium text-slate-800" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between">
                                    Tiempo de Evolución (Onset)
                                    <span className="text-[10px] text-slate-400 font-normal">Agudo vs Crónico</span>
                                </label>
                                <input type="text" value={motivo.subjective?.onsetDateOrDuration || ''} onChange={e => updateMotivo(motivo.id, 'subjective.onsetDateOrDuration', e.target.value)} disabled={isClosed} placeholder="Ej. 3 días, 6 meses (Insidioso progresivo)" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none bg-slate-50 font-medium" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex justify-between">
                                    Nivel de Irritabilidad
                                    <span className="text-[10px] text-slate-400 font-normal">Impacto en la terapia</span>
                                </label>
                                <select value={motivo.subjective?.irritability || 'Media'} onChange={e => updateMotivo(motivo.id, 'subjective.irritability', e.target.value)} disabled={isClosed} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold focus:border-indigo-500 outline-none bg-slate-50">
                                    <option value="Baja">🟢 Baja (Tolera carga, cesa rápido)</option>
                                    <option value="Media">🟡 Media (Moderado, demora en bajar)</option>
                                    <option value="Alta">🔴 Alta (Agudo, reposo no alivia o reposo &gt;24hr)</option>
                                </select>
                            </div>

                            {/* Factores del Dolor (SIN 24hr pattern yet, solo Agravantes y Aliviadores que pide SINSS/Maitland) */}
                            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><span className="text-rose-500 text-sm">↑</span> Factores Agravantes</label>
                                    <input type="text" value={motivo.subjective?.aggravatingFactors?.join(', ') || motivo.subjective?.agravantes || ''} onChange={e => updateMotivo(motivo.id, 'subjective.agravantes', e.target.value)} disabled={isClosed} placeholder="Ej. Bajar escaleras mecánicas, sentadilla >90°" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:border-rose-400 focus:ring-1 focus:ring-rose-100 outline-none shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5"><span className="text-emerald-500 text-sm">↓</span> Factores Aliviadores</label>
                                    <input type="text" value={motivo.subjective?.easingFactors?.join(', ') || motivo.subjective?.alivios || ''} onChange={e => updateMotivo(motivo.id, 'subjective.alivios', e.target.value)} disabled={isClosed} placeholder="Ej. Calor local en la noche, elevar la pierna" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none shadow-sm" />
                                </div>
                            </div>

                            <div className="lg:col-span-2 mt-2">
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">Limitación Funcional Principal <span className="text-rose-500">*</span></label>
                                <input type="text" value={motivo.subjective?.functionalLimitationPrimary || (motivo.subjective as any)?.limitacionFuncional || ''} onChange={e => updateMotivo(motivo.id, 'subjective.functionalLimitationPrimary', e.target.value)} disabled={isClosed} placeholder="Actividad más importante o necesaria que NO puede hacer o hace con dolor" className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none bg-white font-semibold text-slate-800 shadow-sm" />
                            </div>

                            <div className="lg:col-span-2">
                                <label className="block text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-1.5">Meta / Expectativa del Paciente (Patient Goal)</label>
                                <textarea rows={2} value={motivo.subjective?.goalOfPerson || (motivo.subjective as any)?.metasPersonaUsuaria || ''} onChange={e => updateMotivo(motivo.id, 'subjective.goalOfPerson', e.target.value)} disabled={isClosed} placeholder="Ej. Quiero volver a jugar pádel en 2 meses sin la rodillera." className="w-full border border-indigo-200 bg-indigo-50/50 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none resize-none font-medium text-indigo-900" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
