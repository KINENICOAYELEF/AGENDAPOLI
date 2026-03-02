import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M6Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M6_ComparableSign({ formData, updateFormData, isClosed }: M6Props) {
    const defaultAsterisco = {
        tipo: '',
        condiciones: '',
        dolor: '',
        afterEffect: ''
    };

    const updateMotivo = (motivoId: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === motivoId);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };

            if (fieldPath === 'asteriscoPrincipal') {
                motivo.comparableSign = {
                    ...(motivo.comparableSign || { secundarios: [] }),
                    asteriscoPrincipal: value
                };
            } else if (fieldPath === 'secundarios') {
                motivo.comparableSign = {
                    ...(motivo.comparableSign || { asteriscoPrincipal: defaultAsterisco }),
                    secundarios: value
                };
            }

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const updatePrincipal = (motivoId: string, current: any, field: keyof typeof defaultAsterisco, value: string) => {
        const newVal = { ...(current || defaultAsterisco), [field]: value };
        updateMotivo(motivoId, 'asteriscoPrincipal', newVal);
    };

    const addSecundario = (motivoId: string, currentSecundarios: any[]) => {
        if ((currentSecundarios?.length || 0) >= 2) {
            alert("Máximo 2 asteriscos secundarios por motivo.");
            return;
        }
        updateMotivo(motivoId, 'secundarios', [...(currentSecundarios || []), { descripcion: '', dolor: '' }]);
    };

    const updateSecundario = (motivoId: string, currentSecundarios: any[], index: number, field: 'descripcion' | 'dolor', value: string) => {
        const newSec = [...(currentSecundarios || [])];
        newSec[index] = { ...newSec[index], [field]: value };
        updateMotivo(motivoId, 'secundarios', newSec);
    };

    const removeSecundario = (motivoId: string, currentSecundarios: any[], index: number) => {
        const newSec = currentSecundarios?.filter((_, i) => i !== index) || [];
        updateMotivo(motivoId, 'secundarios', newSec);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">⭐</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M6: Comparable Sign (Asterisco)</h3>
                    <p className="text-xs text-slate-500 font-medium">Movimiento o carga exacta que reproduce el dolor para diagnóstico y re-test.</p>
                </div>
            </div>

            {formData.motivos?.map((motivo, mIndex) => {
                const comp = motivo.comparableSign || { asteriscoPrincipal: defaultAsterisco, secundarios: [] };
                return (
                    <div key={motivo.id} className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6 mb-6">

                        <div className="border-b border-indigo-100 pb-3 mb-4 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-lg">Foco {mIndex + 1}</span>
                            <h4 className="font-bold text-slate-700">{motivo.motivoLabel || 'Sin Nombre'}</h4>
                        </div>

                        {/* Asterisco Principal */}
                        <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 md:p-5 relative overflow-hidden">
                            <h4 className="text-sm font-bold text-indigo-900 mb-4 flex items-center gap-2">⭐ Asterisco Principal <span className="text-rose-500">*</span></h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Movimiento o Tarea</label>
                                    <input
                                        type="text"
                                        value={comp.asteriscoPrincipal?.tipo || ''}
                                        onChange={e => updatePrincipal(motivo.id, comp.asteriscoPrincipal, 'tipo', e.target.value)}
                                        disabled={isClosed}
                                        placeholder="Ej. Sentadilla búlgara, Elevación de brazo..."
                                        className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2.5 text-sm focus:border-indigo-400 outline-none font-semibold text-slate-800 shadow-sm"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Condiciones Exactas (Params para replicar)</label>
                                    <textarea
                                        rows={2}
                                        value={comp.asteriscoPrincipal?.condiciones || ''}
                                        onChange={e => updatePrincipal(motivo.id, comp.asteriscoPrincipal, 'condiciones', e.target.value)}
                                        disabled={isClosed}
                                        placeholder="Ej. Con mancuerna de 12kg por lado, bajando en 3 segundos, rango completo."
                                        className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none resize-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 flex items-center gap-1.5"><span className="text-rose-500">⚡</span> Dolor Actual (Basal)</label>
                                    <input
                                        type="text"
                                        value={comp.asteriscoPrincipal?.dolor || ''}
                                        onChange={e => updatePrincipal(motivo.id, comp.asteriscoPrincipal, 'dolor', e.target.value)}
                                        disabled={isClosed}
                                        placeholder="Ej. EVA 6/10 tipo punzante profundo"
                                        className="w-full border border-rose-200 bg-rose-50/50 rounded-lg px-3 py-2.5 text-sm focus:border-rose-400 outline-none shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5 flex justify-between items-center">
                                        <span>After-Effect</span>
                                        <span className="text-[8px] text-indigo-400 lowercase normal-case">(Respuesta tardía)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={comp.asteriscoPrincipal?.afterEffect || ''}
                                        onChange={e => updatePrincipal(motivo.id, comp.asteriscoPrincipal, 'afterEffect', e.target.value)}
                                        disabled={isClosed}
                                        placeholder="Ej. Sube a EVA 8 post 2 hrs, dura todo el día"
                                        className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2.5 text-sm focus:border-indigo-400 outline-none shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Asteriscos Secundarios */}
                        <div>
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                <h4 className="text-sm font-bold text-slate-700">Asteriscos Secundarios (Opcionales)</h4>
                                {!isClosed && (comp.secundarios?.length || 0) < 2 && (
                                    <button
                                        onClick={() => addSecundario(motivo.id, comp.secundarios || [])}
                                        className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-1 rounded transition-colors"
                                    >
                                        + Agregar ({comp.secundarios?.length || 0}/2)
                                    </button>
                                )}
                            </div>

                            {comp.secundarios?.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-2">No hay asteriscos secundarios registrados en este Módulo.</p>
                            ) : (
                                <div className="space-y-4">
                                    {comp.secundarios?.map((sec, idx) => (
                                        <div key={idx} className="flex flex-col md:flex-row gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-start md:items-center relative">
                                            <div className="absolute -top-2 -left-2 bg-slate-200 text-slate-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border border-white">
                                                {idx + 1}
                                            </div>
                                            <div className="flex-1 w-full mt-1 md:mt-0">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Descripción corta</label>
                                                <input
                                                    type="text"
                                                    value={sec.descripcion}
                                                    onChange={e => updateSecundario(motivo.id, comp.secundarios!, idx, 'descripcion', e.target.value)}
                                                    disabled={isClosed}
                                                    placeholder="Ej. Palpación tendón rotuliano polo inferior"
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none"
                                                />
                                            </div>
                                            <div className="w-full md:w-48">
                                                <label className="block text-[10px] font-bold text-slate-500 mb-1">Dolor asociado</label>
                                                <input
                                                    type="text"
                                                    value={sec.dolor}
                                                    onChange={e => updateSecundario(motivo.id, comp.secundarios!, idx, 'dolor', e.target.value)}
                                                    disabled={isClosed}
                                                    placeholder="Ej. EVA 4"
                                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 outline-none"
                                                />
                                            </div>
                                            {!isClosed && (
                                                <button onClick={() => removeSecundario(motivo.id, comp.secundarios!, idx)} className="self-end md:self-center p-2 mt-4 text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 rounded transition-colors">
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
