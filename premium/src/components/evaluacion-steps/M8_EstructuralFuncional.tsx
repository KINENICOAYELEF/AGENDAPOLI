import React from "react";
import { Evaluacion } from "@/types/clinica";

interface M8Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M8_EstructuralFuncional({ formData, updateFormData, isClosed }: M8Props) {

    const updateMotivo = (motivoId: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === motivoId);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };

            motivo.structuralVsFunctional = {
                ...(motivo.structuralVsFunctional || { estructurales: [], funcionales: [], driverPrincipal: 'Mixto' }),
                [fieldPath]: value
            };

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const addListItem = (motivoId: string, svf: any, listName: 'estructurales' | 'funcionales') => {
        const currentList = svf[listName] || [];
        updateMotivo(motivoId, listName, [...currentList, '']);
    };

    const updateListItem = (motivoId: string, svf: any, listName: 'estructurales' | 'funcionales', index: number, value: string) => {
        const currentList = [...(svf[listName] || [])];
        currentList[index] = value;
        updateMotivo(motivoId, listName, currentList);
    };

    const removeListItem = (motivoId: string, svf: any, listName: 'estructurales' | 'funcionales', index: number) => {
        const currentList = (svf[listName] || []).filter((_: any, i: number) => i !== index);
        updateMotivo(motivoId, listName, currentList);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">⚖️</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M8: Estructural vs Funcional</h3>
                    <p className="text-xs text-slate-500 font-medium">Categoriza los hallazgos para orientar los objetivos y el conductor del dolor.</p>
                </div>
            </div>

            {formData.motivos?.map((motivo, mIndex) => {
                const svf = motivo.structuralVsFunctional || { estructurales: [], funcionales: [], driverPrincipal: 'Mixto' };

                return (
                    <div key={motivo.id} className="bg-white border text-left border-slate-200 p-5 lg:p-6 rounded-2xl shadow-sm space-y-6 mb-6">

                        <div className="border-b border-indigo-100 pb-3 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-2.5 py-1 rounded-lg">Foco {mIndex + 1}</span>
                                <h4 className="font-bold text-slate-700">{motivo.motivoLabel || 'Sin Nombre'}</h4>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">Driver Principal:</span>
                                <select
                                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded outline-none py-1 text-indigo-700"
                                    disabled={isClosed}
                                    value={svf.driverPrincipal || 'Mixto'}
                                    onChange={e => updateMotivo(motivo.id, 'driverPrincipal', e.target.value)}
                                >
                                    <option value="Estructural">Estructural</option>
                                    <option value="Funcional">Funcional</option>
                                    <option value="Mixto">Mixto</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Estructurales */}
                            <div className="bg-rose-50/50 border border-rose-100 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><span className="text-rose-500">🧱</span> Fallas Estructurales</h5>
                                    {!isClosed && <button onClick={() => addListItem(motivo.id, svf, 'estructurales')} className="text-[10px] text-rose-600 font-bold bg-white px-2 py-1 rounded shadow-sm hover:bg-rose-50">+ Agregar</button>}
                                </div>
                                <div className="space-y-2">
                                    {(svf.estructurales || []).map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                disabled={isClosed}
                                                placeholder="Ej. Lesión meniscal grado II, Tendinopatía..."
                                                className="flex-1 border border-rose-200 rounded px-3 py-1.5 text-xs outline-none focus:border-rose-400"
                                                value={item}
                                                onChange={e => updateListItem(motivo.id, svf, 'estructurales', idx, e.target.value)}
                                            />
                                            {!isClosed && <button onClick={() => removeListItem(motivo.id, svf, 'estructurales', idx)} className="text-rose-400 hover:text-rose-600">✗</button>}
                                        </div>
                                    ))}
                                    {svf.estructurales?.length === 0 && <p className="text-[10px] text-rose-400/70 italic text-center py-2">Sin hallazgos estructurales.</p>}
                                </div>
                                <p className="text-[9px] text-rose-600/70 mt-3 font-medium leading-snug">Daño a tejidos comprobable, patologías que requieren cicatrización, reposo relativo o protección.</p>
                            </div>

                            {/* Funcionales */}
                            <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5"><span className="text-emerald-500">⚙️</span> Fallas Funcionales</h5>
                                    {!isClosed && <button onClick={() => addListItem(motivo.id, svf, 'funcionales')} className="text-[10px] text-emerald-600 font-bold bg-white px-2 py-1 rounded shadow-sm hover:bg-emerald-50">+ Agregar</button>}
                                </div>
                                <div className="space-y-2">
                                    {(svf.funcionales || []).map((item, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <input
                                                type="text"
                                                disabled={isClosed}
                                                placeholder="Ej. Debilidad glútea, Acortamiento tensor fasia lata..."
                                                className="flex-1 border border-emerald-200 rounded px-3 py-1.5 text-xs outline-none focus:border-emerald-400"
                                                value={item}
                                                onChange={e => updateListItem(motivo.id, svf, 'funcionales', idx, e.target.value)}
                                            />
                                            {!isClosed && <button onClick={() => removeListItem(motivo.id, svf, 'funcionales', idx)} className="text-emerald-400 hover:text-emerald-600">✗</button>}
                                        </div>
                                    ))}
                                    {svf.funcionales?.length === 0 && <p className="text-[10px] text-emerald-400/70 italic text-center py-2">Sin déficit funcional primario.</p>}
                                </div>
                                <p className="text-[9px] text-emerald-600/70 mt-3 font-medium leading-snug">Déficits de movimiento, fuerza diferencial, control motor, miedo-evitación, sobrecarga repetitiva.</p>
                            </div>

                        </div>
                    </div>
                );
            })}
        </div>
    );
}
