import React, { useState } from "react";
import { Evaluacion } from "@/types/clinica";

export function Step3ExamenFisico({
    formData,
    updateFormData,
    isClosed
}: {
    formData: Partial<Evaluacion>,
    updateFormData: (patch: any) => void,
    isClosed: boolean
}) {

    const updateMotivoObjectiveArray = (motivoId: string, arrayName: 'rom' | 'strength' | 'specialTests', action: 'add' | 'update' | 'remove', payload?: any, idx?: number) => {
        updateFormData((prev: Partial<Evaluacion>) => {
            const nuevos = [...(prev.motivos || [])];
            const mIdx = nuevos.findIndex(m => m.id === motivoId);
            if (mIdx === -1) return prev;

            const motivo = { ...nuevos[mIdx] };
            const ex = motivo.objectiveExam || {};
            const arr = [...(ex[arrayName] || [])];

            if (action === 'add') {
                arr.push(payload);
            } else if (action === 'update' && idx !== undefined) {
                arr[idx] = { ...arr[idx], ...payload };
            } else if (action === 'remove' && idx !== undefined) {
                arr.splice(idx, 1);
            }

            motivo.objectiveExam = { ...ex, [arrayName]: arr };
            nuevos[mIdx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const updateImpairment = (motivoId: string, field: string, val: boolean) => {
        updateFormData((prev: Partial<Evaluacion>) => {
            const nuevos = [...(prev.motivos || [])];
            const mIdx = nuevos.findIndex(m => m.id === motivoId);
            if (mIdx === -1) return prev;

            const motivo = { ...nuevos[mIdx] };
            motivo.impairmentSummary = { ...(motivo.impairmentSummary || {}), [field]: val };

            nuevos[mIdx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    if (!formData.motivos || formData.motivos.length === 0) {
        return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-300">Debes ingresar primero un motivo de consulta.</div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mb-4">
                <h3 className="text-lg font-black text-sky-800 flex items-center gap-2">
                    <span className="text-2xl leading-none">🩺</span>
                    3. Examen Físico Clínico
                </h3>
                <p className="text-xs font-semibold text-slate-500 mt-1">Registra mediciones objetivas para la línea base del paciente.</p>
            </div>

            {formData.motivos.map((motivo) => {
                const ex = motivo.objectiveExam || {};
                const imp = motivo.impairmentSummary || {};

                return (
                    <div key={motivo.id} className="bg-white rounded-3xl shadow-sm overflow-hidden mb-8 border border-slate-200">
                        <div className="bg-sky-50 border-b border-sky-100 p-4 flex items-center gap-3">
                            <h4 className="text-sm font-bold text-sky-900 capitalize tracking-tight flex-1">
                                {motivo.motivoLabel} <span className="text-sky-600 font-medium">({motivo.region})</span>
                            </h4>
                        </div>

                        <div className="p-4 md:p-6 space-y-8">

                            {/* ROM */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                        Rango de Movimiento (ROM)
                                    </h5>
                                    {!isClosed && (
                                        <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'rom', 'add', { mov: '', lado: 'Bilat', val: '', dolor: false, notes: '' })} className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                                            + Fila ROM
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {ex.rom?.map((r, i) => (
                                        <div key={i} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-2 rounded-xl border border-slate-200 relative group">
                                            <input type="text" placeholder="Movimiento (Ej. Flexión)" value={r.mov} onChange={e => updateMotivoObjectiveArray(motivo.id, 'rom', 'update', { mov: e.target.value }, i)} disabled={isClosed} className="flex-1 min-w-[120px] text-xs font-bold focus:outline-none focus:text-sky-700" />
                                            <div className="hidden md:block w-px h-4 bg-slate-200"></div>
                                            <input type="text" placeholder="G° / Cm" value={r.val} onChange={e => updateMotivoObjectiveArray(motivo.id, 'rom', 'update', { val: e.target.value }, i)} disabled={isClosed} className="w-20 text-xs font-medium focus:outline-none" />
                                            <div className="hidden md:block w-px h-4 bg-slate-200"></div>
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md shrink-0 cursor-pointer">
                                                <input type="checkbox" checked={r.dolor} onChange={e => updateMotivoObjectiveArray(motivo.id, 'rom', 'update', { dolor: e.target.checked }, i)} disabled={isClosed} className="w-3 h-3 text-rose-500 focus:ring-rose-400 rounded-sm" />
                                                Dolor
                                            </label>
                                            <input type="text" placeholder="Nota..." value={r.notes} onChange={e => updateMotivoObjectiveArray(motivo.id, 'rom', 'update', { notes: e.target.value }, i)} disabled={isClosed} className="flex-1 text-[11px] text-slate-500 focus:outline-none" />
                                            {!isClosed && <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'rom', 'remove', null, i)} className="md:opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                        </div>
                                    ))}
                                    {(!ex.rom || ex.rom.length === 0) && <p className="text-xs text-slate-400 text-center py-2">Sin registros de ROM.</p>}
                                </div>
                            </div>

                            {/* FUERZA */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Fuerza / Muscular</h5>
                                    {!isClosed && (
                                        <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'strength', 'add', { group: '', lado: 'Bilat', method: 'M1', val: '', dolor: false, notes: '' })} className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                                            + Fila Fuerza
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {ex.strength?.map((s, i) => (
                                        <div key={i} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-2 rounded-xl border border-slate-200 relative group">
                                            <input type="text" placeholder="Grupo (Ej. Cuádriceps)" value={s.group} onChange={e => updateMotivoObjectiveArray(motivo.id, 'strength', 'update', { group: e.target.value }, i)} disabled={isClosed} className="flex-1 min-w-[120px] text-xs font-bold focus:outline-none" />
                                            <select value={s.method} onChange={e => updateMotivoObjectiveArray(motivo.id, 'strength', 'update', { method: e.target.value }, i)} disabled={isClosed} className="w-16 text-[10px] font-bold text-slate-500 focus:outline-none bg-transparent">
                                                <option value="M1">Mano</option>
                                                <option value="HHD">HHD</option>
                                                <option value="1RM">1RM</option>
                                            </select>
                                            <input type="text" placeholder="Val (ej M4/5)" value={s.val} onChange={e => updateMotivoObjectiveArray(motivo.id, 'strength', 'update', { val: e.target.value }, i)} disabled={isClosed} className="w-16 text-xs font-medium focus:outline-none text-center bg-slate-50 rounded" />
                                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md shrink-0 cursor-pointer">
                                                <input type="checkbox" checked={s.dolor} onChange={e => updateMotivoObjectiveArray(motivo.id, 'strength', 'update', { dolor: e.target.checked }, i)} disabled={isClosed} className="w-3 h-3 text-amber-500 focus:ring-amber-400 rounded-sm" />
                                                Dolor
                                            </label>
                                            <input type="text" placeholder="Nota..." value={s.notes} onChange={e => updateMotivoObjectiveArray(motivo.id, 'strength', 'update', { notes: e.target.value }, i)} disabled={isClosed} className="flex-1 text-[11px] text-slate-500 focus:outline-none" />
                                            {!isClosed && <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'strength', 'remove', null, i)} className="md:opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                        </div>
                                    ))}
                                    {(!ex.strength || ex.strength.length === 0) && <p className="text-xs text-slate-400 text-center py-2">Sin registros de fuerza.</p>}
                                </div>
                            </div>

                            {/* Pruebas Especiales */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest">Pruebas Especiales / Provocación</h5>
                                    {!isClosed && (
                                        <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'specialTests', 'add', { test: '', result: 'Positivo', dolor: false, notes: '' })} className="text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors">
                                            + Fila Prueba
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {ex.specialTests?.map((t, i) => (
                                        <div key={i} className="flex flex-col md:flex-row gap-2 items-start md:items-center bg-white p-2 rounded-xl border border-slate-200 relative group">
                                            <input type="text" placeholder="Test (Ej. Lachman)" value={t.test} onChange={e => updateMotivoObjectiveArray(motivo.id, 'specialTests', 'update', { test: e.target.value }, i)} disabled={isClosed} className="flex-1 min-w-[120px] text-xs font-bold focus:outline-none" />
                                            <select value={t.result} onChange={e => updateMotivoObjectiveArray(motivo.id, 'specialTests', 'update', { result: e.target.value }, i)} disabled={isClosed} className={`w-24 text-[11px] font-bold px-2 py-1 rounded-lg outline-none ${t.result === 'Positivo' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                                                <option value="Positivo">Positivo (+)</option>
                                                <option value="Negativo">Negativo (-)</option>
                                            </select>
                                            <input type="text" placeholder="Nota detallada..." value={t.notes} onChange={e => updateMotivoObjectiveArray(motivo.id, 'specialTests', 'update', { notes: e.target.value }, i)} disabled={isClosed} className="flex-1 text-[11px] text-slate-500 focus:outline-none" />
                                            {!isClosed && <button onClick={() => updateMotivoObjectiveArray(motivo.id, 'specialTests', 'remove', null, i)} className="md:opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                        </div>
                                    ))}
                                    {(!ex.specialTests || ex.specialTests.length === 0) && <p className="text-xs text-slate-400 text-center py-2">Sin pruebas precargadas.</p>}
                                </div>
                            </div>

                            {/* Impairment Summary (Biopsicosocial Tags) */}
                            <div>
                                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-3 border-b pb-2">Clasificador de Disfunciones Principales</h5>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { key: 'mobilityDeficit', label: 'Déficit Movilidad' },
                                        { key: 'strengthDeficit', label: 'Déficit Fuerza/Potencia' },
                                        { key: 'movementCoordinationDeficit', label: 'Déficit Control Motor' },
                                        { key: 'loadIntolerance', label: 'Intolerancia a Carga' },
                                        { key: 'sensitizationFeatures', label: 'Sensibilización Central' }
                                    ].map(tag => (
                                        <button
                                            key={tag.key}
                                            onClick={() => !isClosed && updateImpairment(motivo.id, tag.key, !(imp as any)[tag.key])}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-colors ${(imp as any)[tag.key]
                                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {tag.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
