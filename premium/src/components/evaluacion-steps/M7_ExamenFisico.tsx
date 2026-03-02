import React, { useState } from "react";
import { Evaluacion } from "@/types/clinica";

interface M7Props {
    formData: Partial<Evaluacion>;
    updateFormData: (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => void;
    isClosed: boolean;
}

export function M7_ExamenFisico({ formData, updateFormData, isClosed }: M7Props) {
    // Manejo de tabs interno per motivo
    const [activeTabs, setActiveTabs] = useState<{ [motivoId: string]: string }>({});

    const updateMotivo = (motivoId: string, fieldPath: string, value: any) => {
        updateFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === motivoId);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };

            motivo.objectiveExam = {
                ...(motivo.objectiveExam || {}),
                [fieldPath]: value
            };

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const addListItem = (motivoId: string, examData: any, listName: 'rom' | 'strength' | 'specialTests' | 'functionalTests') => {
        const currentList = examData[listName] || [];

        let newItem: any = {};
        if (listName === 'rom') newItem = { mov: '', lado: 'Bilat', val: '', dolor: false, notes: '' };
        if (listName === 'strength') newItem = { group: '', lado: 'Bilat', method: '', val: '', dolor: false, notes: '' };
        if (listName === 'specialTests') newItem = { test: '', result: '', dolor: false, notes: '' };
        if (listName === 'functionalTests') newItem = { test: '', metric: '', result: '', dolor: false, notes: '' };

        updateMotivo(motivoId, listName, [...currentList, newItem]);
    };

    const updateListItem = (motivoId: string, examData: any, listName: string, index: number, field: string, value: any) => {
        const currentList = [...(examData[listName] || [])];
        currentList[index] = { ...currentList[index], [field]: value };
        updateMotivo(motivoId, listName, currentList);
    };

    const removeListItem = (motivoId: string, examData: any, listName: string, index: number) => {
        const currentList = (examData[listName] || []).filter((_: any, i: number) => i !== index);
        updateMotivo(motivoId, listName, currentList);
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-2xl">🤸</span>
                <div>
                    <h3 className="text-lg font-black text-slate-800">M7: Examen Físico / Objetivo</h3>
                    <p className="text-xs text-slate-500 font-medium">Recopilación de mediciones objetivas (ROM, Fuerza, Pruebas) separadas por foco.</p>
                </div>
            </div>

            {formData.motivos?.map((motivo, mIndex) => {
                const exam = motivo.objectiveExam || {};
                const activeTab = activeTabs[motivo.id] || 'universal';

                return (
                    <div key={motivo.id} className="bg-white border text-left border-slate-200 p-4 lg:p-6 rounded-2xl shadow-sm space-y-5 mb-6">

                        <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide">Foco {mIndex + 1}</span>
                                <h4 className="font-bold text-slate-700 text-sm">{motivo.motivoLabel || 'Sin Nombre'}</h4>
                            </div>

                            {/* Tabs */}
                            <div className="flex bg-slate-100 rounded-lg p-1">
                                <button
                                    onClick={() => setActiveTabs(p => ({ ...p, [motivo.id]: 'universal' }))}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeTab === 'universal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >Universal</button>
                                <button
                                    onClick={() => setActiveTabs(p => ({ ...p, [motivo.id]: 'neuro' }))}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${activeTab === 'neuro' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >Neuro/Palp</button>
                            </div>
                        </div>

                        {activeTab === 'universal' && (
                            <div className="space-y-6">
                                {/* Rango de Movimiento (ROM) */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs font-bold text-slate-700">Rango de Movimiento (ROM)</h5>
                                        {!isClosed && <button onClick={() => addListItem(motivo.id, exam, 'rom')} className="text-[10px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded">+ Agregar</button>}
                                    </div>
                                    <div className="space-y-2">
                                        {(exam.rom || []).map((item, idx) => (
                                            <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 items-center text-xs">
                                                <input type="text" placeholder="Movimiento" disabled={isClosed} className="flex-1 min-w-[100px] border border-slate-300 rounded px-2 py-1 outline-none" value={item.mov} onChange={e => updateListItem(motivo.id, exam, 'rom', idx, 'mov', e.target.value)} />
                                                <select disabled={isClosed} className="border border-slate-300 rounded px-2 py-1 outline-none" value={item.lado} onChange={e => updateListItem(motivo.id, exam, 'rom', idx, 'lado', e.target.value)}>
                                                    <option>Der</option><option>Izq</option><option>Bilat</option>
                                                </select>
                                                <input type="text" placeholder="Valor/Grados" disabled={isClosed} className="w-20 border border-slate-300 rounded px-2 py-1 outline-none" value={item.val} onChange={e => updateListItem(motivo.id, exam, 'rom', idx, 'val', e.target.value)} />
                                                <label className="flex items-center gap-1 shrink-0 font-medium text-slate-600">
                                                    <input type="checkbox" disabled={isClosed} checked={item.dolor} onChange={e => updateListItem(motivo.id, exam, 'rom', idx, 'dolor', e.target.checked)} /> P+
                                                </label>
                                                {!isClosed && <button onClick={() => removeListItem(motivo.id, exam, 'rom', idx)} className="text-rose-400 p-1 hover:bg-rose-100 rounded">✗</button>}
                                            </div>
                                        ))}
                                        {!(exam.rom?.length) && <p className="text-[10px] text-slate-400 italic">No hay registros de ROM.</p>}
                                    </div>
                                </div>

                                {/* Fuerza Muscular */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs font-bold text-slate-700">Fuerza Muscular</h5>
                                        {!isClosed && <button onClick={() => addListItem(motivo.id, exam, 'strength')} className="text-[10px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded">+ Agregar</button>}
                                    </div>
                                    <div className="space-y-2">
                                        {(exam.strength || []).map((item, idx) => (
                                            <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 items-center text-xs">
                                                <input type="text" placeholder="Grupo / Músc." disabled={isClosed} className="flex-1 min-w-[100px] border border-slate-300 rounded px-2 py-1 outline-none" value={item.group} onChange={e => updateListItem(motivo.id, exam, 'strength', idx, 'group', e.target.value)} />
                                                <select disabled={isClosed} className="border border-slate-300 rounded px-2 py-1 outline-none" value={item.lado} onChange={e => updateListItem(motivo.id, exam, 'strength', idx, 'lado', e.target.value)}>
                                                    <option>Der</option><option>Izq</option><option>Bilat</option>
                                                </select>
                                                <input type="text" placeholder="Método (MMT, Dnam)" disabled={isClosed} className="w-28 border border-slate-300 rounded px-2 py-1 outline-none" value={item.method} onChange={e => updateListItem(motivo.id, exam, 'strength', idx, 'method', e.target.value)} />
                                                <input type="text" placeholder="Valor" disabled={isClosed} className="w-16 border border-slate-300 rounded px-2 py-1 outline-none" value={item.val} onChange={e => updateListItem(motivo.id, exam, 'strength', idx, 'val', e.target.value)} />
                                                <label className="flex items-center gap-1 shrink-0 font-medium text-slate-600">
                                                    <input type="checkbox" disabled={isClosed} checked={item.dolor} onChange={e => updateListItem(motivo.id, exam, 'strength', idx, 'dolor', e.target.checked)} /> P+
                                                </label>
                                                {!isClosed && <button onClick={() => removeListItem(motivo.id, exam, 'strength', idx)} className="text-rose-400 p-1 hover:bg-rose-100 rounded">✗</button>}
                                            </div>
                                        ))}
                                        {!(exam.strength?.length) && <p className="text-[10px] text-slate-400 italic">No hay registros de fuerza.</p>}
                                    </div>
                                </div>

                                {/* Pruebas Especiales */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <h5 className="text-xs font-bold text-slate-700">Pruebas Especiales Clínicas</h5>
                                        {!isClosed && <button onClick={() => addListItem(motivo.id, exam, 'specialTests')} className="text-[10px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 py-1 rounded">+ Agregar</button>}
                                    </div>
                                    <div className="space-y-2">
                                        {(exam.specialTests || []).map((item, idx) => (
                                            <div key={idx} className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 items-center text-xs">
                                                <input type="text" placeholder="Nombre de la prueba" disabled={isClosed} className="flex-1 min-w-[120px] border border-slate-300 rounded px-2 py-1 outline-none" value={item.test} onChange={e => updateListItem(motivo.id, exam, 'specialTests', idx, 'test', e.target.value)} />
                                                <input type="text" placeholder="Resultado (Ej. +, -, Lax)" disabled={isClosed} className="w-32 border border-slate-300 rounded px-2 py-1 outline-none" value={item.result} onChange={e => updateListItem(motivo.id, exam, 'specialTests', idx, 'result', e.target.value)} />
                                                <label className="flex items-center gap-1 shrink-0 font-medium text-slate-600">
                                                    <input type="checkbox" disabled={isClosed} checked={item.dolor} onChange={e => updateListItem(motivo.id, exam, 'specialTests', idx, 'dolor', e.target.checked)} /> P+
                                                </label>
                                                {!isClosed && <button onClick={() => removeListItem(motivo.id, exam, 'specialTests', idx)} className="text-rose-400 p-1 hover:bg-rose-100 rounded">✗</button>}
                                            </div>
                                        ))}
                                        {!(exam.specialTests?.length) && <p className="text-[10px] text-slate-400 italic">No hay pruebas especiales registradas.</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'neuro' && (
                            <div className="space-y-6">
                                {/* Neuro Screen */}
                                <div>
                                    <h5 className="text-xs font-bold text-slate-700 mb-2">Screening Neurológico</h5>
                                    <textarea
                                        rows={3}
                                        disabled={isClosed}
                                        placeholder="Ej. Reflejos normales, Sensibilidad conservada, Slump negativo..."
                                        value={exam.neuroScreen?.notes || ''}
                                        onChange={e => updateMotivo(motivo.id, 'neuroScreen', { ...exam.neuroScreen, notes: e.target.value })}
                                        className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none"
                                    />
                                </div>

                                {/* Palpación */}
                                <div>
                                    <h5 className="text-xs font-bold text-slate-700 mb-2">Palpación y Otros Hallazgos</h5>
                                    <textarea
                                        rows={3}
                                        disabled={isClosed}
                                        placeholder="Ej. Dolor a la palpación en tendón rotuliano inferior..."
                                        value={exam.palpationOther || ''}
                                        onChange={e => updateMotivo(motivo.id, 'palpationOther', e.target.value)}
                                        className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        )}

                    </div>
                );
            })}
        </div>
    );
}
