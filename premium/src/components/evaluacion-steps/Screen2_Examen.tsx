import React, { useMemo, useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { computeIrritability, computeSafety, buildExamChecklist, autoSynthesizeFindings } from "@/lib/auto-engine";

export interface Screen2Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
    onNext?: () => void;
}

export function Screen2_Examen({ formData, updateFormData, isClosed, onNext }: Screen2Props) {
    const [isGeneratingSynthesis, setIsGeneratingSynthesis] = useState(false);

    const exam = (formData.guidedExam as any) || {};
    const romAndMmt = exam.romAndMmt || [];
    const orthoTests = exam.orthopedicTests || [];

    const engine = useMemo(() => {
        const principalFocus = formData.interview?.v3?.focos?.[0] || null;
        const irritability = principalFocus ? computeIrritability(principalFocus as any) : { level: 'Desconocida', reasons: [] };
        const safety = computeSafety(formData.interview as any);
        const checklist = buildExamChecklist(formData.interview as any, irritability.level as any);
        return { irritability, safety, checklist };
    }, [formData.interview]);

    const handleUpdateExam = (patch: any) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, ...patch }
        }));
    };

    const addRomRow = () => {
        handleUpdateExam({
            romAndMmt: [...romAndMmt, {
                id: Date.now().toString(), joint: '', movement: '', romDeg: '', endFeel: '', mmt: '', painLevel: '', reproducesFocus: false
            }]
        });
    };

    const updateRomRow = (index: number, patch: any) => {
        const next = [...romAndMmt];
        next[index] = { ...next[index], ...patch };
        handleUpdateExam({ romAndMmt: next });
    };

    const removeRomRow = (index: number) => {
        const next = [...romAndMmt];
        next.splice(index, 1);
        handleUpdateExam({ romAndMmt: next });
    };

    const addOrthoTest = () => {
        handleUpdateExam({
            orthopedicTests: [...orthoTests, { test: '', result: '', reproducesFocusIds: [], notes: '' }]
        });
    };

    const updateOrthoTest = (index: number, patch: any) => {
        const next = [...orthoTests];
        next[index] = { ...next[index], ...patch };
        handleUpdateExam({ orthopedicTests: next });
    };

    const removeOrthoTest = (index: number) => {
        const next = [...orthoTests];
        next.splice(index, 1);
        handleUpdateExam({ orthopedicTests: next });
    };

    return (
        <div className="flex flex-col gap-8 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ENCABEZADO */}
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Examen Físico Guiado</h2>
                <p className="text-sm text-slate-500 mt-1">Sigue las recomendaciones del motor clínico basado en la entrevista.</p>
            </div>

            {/* PANEL DEL MOTOR CLÍNICO */}
            <div className="bg-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-700 text-slate-100">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">🤖</span>
                    <h3 className="font-bold text-white tracking-wide">Motor de Triage y Examen</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 pb-5 border-b border-slate-700">
                    <div>
                        <span className="text-xs uppercase text-slate-400 font-bold block mb-1">Irritabilidad Proyectada</span>
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${engine.irritability.level === 'Alta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : engine.irritability.level === 'Media' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                            {engine.irritability.level.toUpperCase()}
                        </div>
                    </div>
                    <div>
                        <span className="text-xs uppercase text-slate-400 font-bold block mb-1">Semáforo de Carga / Triage</span>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1 items-center bg-slate-900 px-2 py-1.5 rounded-md border border-slate-700">
                                <span className={`w-3 h-3 rounded-full ${engine.safety.level === 'Verde' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'} transition-all`} />
                                <span className={`w-3 h-3 rounded-full ${engine.safety.level === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]' : 'bg-slate-600'} transition-all`} />
                                <span className={`w-3 h-3 rounded-full ${engine.safety.level === 'Rojo' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' : 'bg-slate-600'} transition-all`} />
                            </div>
                            <span className="text-[10px] font-medium text-slate-300 leading-tight">
                                {engine.safety.reasons[0] || 'Triage seguro.'}
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <span className="text-xs text-slate-400 font-bold block mb-3 flex items-center justify-between">
                        <span className="uppercase">Checklist Clínico a Evaluar</span>
                        {exam.checklistSuggested && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">✨ Asistencia IA Activa</span>}
                    </span>

                    {/* renderItems function to handle both Engine and AI types */}
                    {(() => {
                        const hasAI = !!exam.checklistSuggested;
                        const srcEss = hasAI ? exam.checklistSuggested.essential : engine.checklist.essentials;
                        const srcRec = hasAI ? exam.checklistSuggested.recommended : engine.checklist.recommended;
                        const srcOpt = hasAI ? exam.checklistSuggested.optional : engine.checklist.avoidOrPostpone;

                        const renderList = (title: string, colorClass: string, items: any[], type: 'essential' | 'recommended' | 'optional') => {
                            if (!items || items.length === 0) return null;
                            return (
                                <div className="mb-4">
                                    <h4 className={`text-[10px] font-bold ${colorClass.split('|')[0]} uppercase tracking-widest mb-2 flex items-center gap-2`}>
                                        <span className={`${colorClass.split('|')[1]} px-1.5 py-0.5 rounded`}>{title}</span>
                                    </h4>
                                    <ul className="space-y-2">
                                        {items.map((m: any, i: number) => (
                                            <li key={`${type}-${i}`} className={`flex gap-3 items-start ${colorClass.split('|')[2]} p-3 rounded-xl border ${colorClass.split('|')[3]} group relative pr-8`}>
                                                <div className={`shrink-0 mt-0.5 ${colorClass.split('|')[0]}`}>{type === 'essential' ? '✓' : type === 'recommended' ? '◦' : '-'}</div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-100">{hasAI ? m.label : m.test}</div>
                                                    <p className="text-xs text-slate-400 mt-0.5 leading-snug">{hasAI ? m.why : `${m.category} — ${m.rationale}`}</p>
                                                    <p className={`text-[10px] ${colorClass.split('|')[0]} opacity-80 mt-1.5 font-medium flex items-center gap-1.5`}>
                                                        {hasAI ? `Técnica: ${m.how}` : `🎯 Qué buscar: ${m.whatToLookFor}`}
                                                    </p>
                                                </div>
                                                {hasAI && !isClosed && (
                                                    <button
                                                        onClick={() => {
                                                            const nextList = [...items];
                                                            nextList.splice(i, 1);
                                                            handleUpdateExam({ checklistSuggested: { ...exam.checklistSuggested, [type]: nextList } });
                                                        }}
                                                        className="absolute right-2 top-2 p-1 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity" title="Remover de lista"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        };

                        return (
                            <>
                                {renderList('Requeridos (Esenciales)', 'text-indigo-400|bg-indigo-500/20|bg-slate-700/30|border-indigo-500/20', srcEss, 'essential')}
                                {renderList('Sugeridos (Recomendados)', 'text-emerald-400|bg-emerald-500/20|bg-slate-700/30|border-emerald-500/20', srcRec, 'recommended')}
                                {renderList('Evitar o Precaución', 'text-slate-500|bg-slate-700|bg-slate-800|border-slate-700/50', srcOpt, 'optional')}
                            </>
                        );
                    })()}

                </div>
            </div>

            {/* OBSERVACION Y PALPACION */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white border text-sm border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><span className="text-lg">👀</span> Observación y Postura</h3>
                    <textarea className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:bg-white focus:border-indigo-400 min-h-[120px] disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" placeholder="Alineación, asimetrías, trofismo, marcha..." value={exam.posture || ''} onChange={(e) => handleUpdateExam({ posture: e.target.value })} disabled={isClosed} />
                </div>
                <div className="bg-white border text-sm border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><span className="text-lg">🖐️</span> Palpación</h3>
                    <textarea className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:bg-white focus:border-indigo-400 min-h-[120px] disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" placeholder="Temperatura, puntos gatillo, derrame, dolor a palpación..." value={exam.palpation || ''} onChange={(e) => handleUpdateExam({ palpation: e.target.value })} disabled={isClosed} />
                </div>
            </div>

            {/* ARTROKINEMATICA Y MMT */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">🦾</span> Análisis de Movimiento, ROM y Fuerza</h3>
                    {!isClosed && (
                        <button onClick={addRomRow} className="text-[10px] font-bold bg-white text-indigo-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1 uppercase tracking-wide">
                            + Fila
                        </button>
                    )}
                </div>
                <div className="p-0 overflow-x-auto w-full hide-scrollbar">
                    {romAndMmt.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-xs italic bg-white">Sin registros numéricos. Opcional.</div>
                    ) : (
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="bg-white border-b border-slate-100 uppercase text-[9px] tracking-wider text-slate-400">
                                    <th className="font-bold p-3">Articulación / Movimiento</th>
                                    <th className="font-bold p-3 w-28 text-center" title="Logrado / Parcial / No Logrado">ROM Fun.</th>
                                    <th className="font-bold p-3 w-24 text-center">Fuerza</th>
                                    <th className="font-bold p-3 w-20 text-center">Dolor</th>
                                    <th className="font-bold p-3 w-28 text-center">Calidad/Contra</th>
                                    <th className="font-bold p-3 w-16 text-center" title="Goniometría">Grados</th>
                                    <th className="font-bold p-3 text-center">Foco</th>
                                    {!isClosed && <th className="p-3 w-10"></th>}
                                </tr>
                            </thead>
                            <tbody>
                                {romAndMmt.map((row: any, idx: number) => (
                                    <tr key={row.id} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50 transition-colors">
                                        <td className="p-2">
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input type="text" placeholder="Joint" className="w-full sm:w-1/3 min-w-[80px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" value={row.joint} onChange={e => updateRomRow(idx, { joint: e.target.value })} disabled={isClosed} />
                                                <input type="text" placeholder="Movimiento..." className="w-full sm:w-2/3 min-w-[120px] bg-slate-50 border border-slate-100 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" value={row.movement} onChange={e => updateRomRow(idx, { movement: e.target.value })} disabled={isClosed} />
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <select className="w-full text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 outline-none focus:border-indigo-400 text-center mx-auto block font-semibold" value={row.functionalRom || ''} onChange={e => updateRomRow(idx, { functionalRom: e.target.value })} disabled={isClosed}>
                                                <option value="">-</option>
                                                <option value="Logrado" className="text-emerald-600">Logrado</option>
                                                <option value="Parcial" className="text-amber-600">Parcial</option>
                                                <option value="No Logrado" className="text-rose-600">No Logrado</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <select className="w-full max-w-[50px] bg-slate-50 border border-slate-200 rounded-lg px-0 py-1.5 text-[10px] outline-none focus:border-indigo-400 text-center mx-auto block font-semibold" value={row.mmt || ''} onChange={e => updateRomRow(idx, { mmt: e.target.value })} disabled={isClosed}>
                                                <option value="">-</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <input type="number" min="0" max="10" placeholder="EVA" className="w-14 text-center bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-xs outline-none focus:border-indigo-400 mx-auto block" value={row.painLevel || ''} onChange={e => updateRomRow(idx, { painLevel: e.target.value })} disabled={isClosed} />
                                        </td>
                                        <td className="p-2">
                                            <div className="flex flex-col gap-1">
                                                <input type="text" placeholder="Ej: Rígido" className="w-full bg-slate-50 border border-slate-100 rounded text-[10px] px-1.5 py-1 outline-none focus:border-indigo-400" value={row.quality || ''} onChange={e => updateRomRow(idx, { quality: e.target.value })} disabled={isClosed} />
                                                <select className="w-full bg-slate-50 border border-slate-100 rounded text-[10px] px-1 py-1 outline-none focus:border-indigo-400" value={row.contralateral || ''} onChange={e => updateRomRow(idx, { contralateral: e.target.value })} disabled={isClosed}>
                                                    <option value="">Lado vs...</option>
                                                    <option value="Simétrico">Simétrico</option>
                                                    <option value="Asimétrico">Asimétrico</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-2 text-center">
                                            <input type="text" placeholder="° (Opc)" className="w-12 text-center bg-slate-50 border border-slate-200 rounded-lg px-1 py-1.5 text-[10px] outline-none focus:border-indigo-400 mx-auto block" value={row.romDeg || ''} onChange={e => updateRomRow(idx, { romDeg: e.target.value })} disabled={isClosed} />
                                        </td>
                                        <td className="p-2 text-center align-middle">
                                            <label className="inline-flex relative items-center cursor-pointer" title="¿Reproduce síntoma/foco?">
                                                <input type="checkbox" className="sr-only peer" checked={!!row.reproducesFocus} disabled={isClosed} onChange={e => updateRomRow(idx, { reproducesFocus: e.target.checked })} />
                                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                            </label>
                                        </td>
                                        {!isClosed && (
                                            <td className="p-2 text-center">
                                                <button onClick={() => removeRomRow(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                                                    <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* NEURO Y ORTOPEDIA */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-6">
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col">
                    <div className="bg-slate-50 border-b border-slate-200 p-4 sm:p-5 flex justify-between items-center rounded-t-2xl">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">🔨</span> Pruebas Especiales</h3>
                        {!isClosed && (
                            <button onClick={addOrthoTest} className="text-[10px] font-bold bg-white text-indigo-600 hover:bg-slate-50 px-2 py-1 rounded-md border border-slate-200 uppercase tracking-wide">
                                Añadir Test
                            </button>
                        )}
                    </div>
                    <div className="p-4 sm:p-5 space-y-3 flex-1 h-full">
                        {orthoTests.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Sin pruebas ortopédicas registradas.</p>}
                        {orthoTests.map((test: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 p-3 rounded-xl relative group">
                                {!isClosed && <button onClick={() => removeOrthoTest(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>}
                                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-2 sm:pr-6">
                                    <input type="text" placeholder="Nombre de la prueba..." className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs outline-none focus:border-indigo-400 font-bold disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" value={test.test} onChange={e => updateOrthoTest(idx, { test: e.target.value })} disabled={isClosed} />
                                    <select className={`w-full sm:w-auto border rounded-md px-2 py-1.5 text-[10px] uppercase tracking-wide font-black outline-none disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100 ${test.result === 'Positivo' ? 'bg-rose-50 border-rose-200 text-rose-700' : test.result === 'Negativo' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-600'}`} value={test.result} onChange={e => updateOrthoTest(idx, { result: e.target.value })} disabled={isClosed}>
                                        <option value="">Status...</option>
                                        <option value="Positivo">Positivo</option>
                                        <option value="Negativo">Negativo</option>
                                        <option value="No Concluyente">No Concluyente</option>
                                    </select>
                                </div>
                                <input type="text" placeholder="Notas adicionales / Modificaciones..." className="w-full bg-transparent border-none px-1 text-[11px] outline-none text-slate-600 placeholder-slate-400" value={test.notes} onChange={e => updateOrthoTest(idx, { notes: e.target.value })} disabled={isClosed} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-4 sm:gap-6 h-full">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-inner flex-1 flex flex-col">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3"><span className="text-lg">⚡</span> Neurológico / Vascular</h3>
                        <textarea className="w-full flex-1 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 min-h-[120px] disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" placeholder="Dermatomas, reflejos, neurodinamia, pulsos..." value={exam.neuro || ''} onChange={(e) => handleUpdateExam({ neuro: e.target.value })} disabled={isClosed} />
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-inner flex-1 flex flex-col">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3"><span className="text-lg">🧘</span> Control Motor / Local</h3>
                        <textarea className="w-full flex-1 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 min-h-[120px] disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed disabled:[-webkit-text-fill-color:inherit] disabled:opacity-100" placeholder="Disociación lumbopélvica, estabilizadores, balance, propiocepción local..." value={exam.motorControl || ''} onChange={(e) => handleUpdateExam({ motorControl: e.target.value })} disabled={isClosed} />
                    </div>
                </div>
            </div>

            {/* BOTONES DE CIERRE PANTALLA EXAMEN */}
            <div className="flex justify-end pt-6 border-t border-slate-200 mt-4">
                <button
                    onClick={() => {
                        const synthesis = autoSynthesizeFindings(exam, formData.interview);
                        updateFormData((prev) => ({
                            autoSynthesis: { ...prev.autoSynthesis, ...synthesis }
                        }));
                        if (onNext) onNext();
                    }}
                    disabled={isClosed}
                    className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Autosintetizar y Continuar
                </button>
            </div>

        </div>
    );
}
