import React, { useState, useMemo } from "react";
import { EvaluacionReevaluacion, Proceso } from "@/types/clinica";
import { ExclamationTriangleIcon, ClipboardDocumentListIcon, ChartBarIcon, ArrowTrendingUpIcon } from "@heroicons/react/24/outline";

export interface Screen5Props {
    formData: Partial<EvaluacionReevaluacion>;
    updateFormData: (patch: Partial<EvaluacionReevaluacion> | ((prev: Partial<EvaluacionReevaluacion>) => Partial<EvaluacionReevaluacion>)) => void;
    procesoContext?: Proceso;
    isClosed: boolean;
    onProceed?: () => void;
    onCreateNewInitial?: () => void;
}

export function Screen5_Reevaluacion({ formData, updateFormData, procesoContext, isClosed, onCreateNewInitial, onProceed }: Screen5Props) {
    const { reevaluation = {} } = formData;
    const [view, setView] = useState<0 | 1>(0);

    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    React.useEffect(() => {
        if (!reevaluation.updatedObjectives && procesoContext?.activeObjectiveSet?.objectives) {
            updateFormData({
                reevaluation: {
                    ...reevaluation,
                    updatedObjectives: JSON.parse(JSON.stringify(procesoContext.activeObjectiveSet.objectives))
                }
            });
        }
    }, [procesoContext?.activeObjectiveSet, reevaluation.updatedObjectives]);

    const progressCalc = useMemo(() => {
        if (!reevaluation.retest) return null;
        let reasons: string[] = [];
        let score = 0; // + means better, - means worse

        // PSFS Delta
        const basePsfs = procesoContext?.caseSnapshot?.psfsLast || procesoContext?.caseSnapshot?.psfsBaseline || [];
        const currentPsfs = reevaluation.retest.psfsScores || [];
        if (basePsfs.length > 0 && currentPsfs.length > 0) {
            let totalBase = 0; let totalCurr = 0;
            let count = 0;
            currentPsfs.forEach((cp: any, i: number) => {
                const bp = basePsfs[i];
                if (bp && !isNaN(bp.score) && !isNaN(cp.score)) {
                    totalBase += Number(bp.score);
                    totalCurr += Number(cp.score);
                    count++;
                }
            });
            if (count > 0) {
                const delta = (totalCurr / count) - (totalBase / count);
                if (delta >= 1.5) {
                    score += 2;
                    reasons.push(`Mejora funcional en PSFS (+${delta.toFixed(1)} pts).`);
                } else if (delta <= -1.5) {
                    score -= 2;
                    reasons.push(`Empeoramiento funcional en PSFS (${delta.toFixed(1)} pts).`);
                } else {
                    reasons.push(`Función PSFS estable (delta ${delta.toFixed(1)}).`);
                }
            }
        }

        // EVA
        if (reevaluation.retest.evaCurrent) {
            const currentEva = Number(reevaluation.retest.evaCurrent);
            if (!isNaN(currentEva)) {
                if (currentEva <= 3) {
                    score += 1;
                    reasons.push(`Dolor actual controlado (${currentEva}/10).`);
                } else if (currentEva >= 7) {
                    score -= 1;
                    reasons.push(`Dolor actual severo (${currentEva}/10).`);
                }
            }
        }

        // After Effect
        const ae = reevaluation.retest.afterEffect;
        if (ae === 'Nunca') {
            score += 1;
            reasons.push('Baja irritabilidad pos-esfuerzo.');
        } else if (ae === 'Siempre') {
            score -= 2;
            reasons.push('Alta irritabilidad mantenida.');
        }

        let direction = 'Igual (Mantener curso)';
        let color = 'text-amber-600 bg-amber-50 border-amber-200';
        if (score >= 2) {
            direction = 'Mejor (Progresar)';
            color = 'text-emerald-700 bg-emerald-50 border-emerald-200';
        } else if (score <= -2) {
            direction = 'Peor (Regresar/Re-evaluar)';
            color = 'text-rose-700 bg-rose-50 border-rose-200';
        }

        return { direction, color, reasons };
    }, [reevaluation.retest, procesoContext]);

    const handleGenerateReevaluation = async () => {
        if (!reevaluation.retest) {
            setAiError("Debes llenar el Retest para generar la reevaluación con IA.");
            return;
        }
        setIsGenerating(true);
        setAiError(null);
        try {
            const response = await fetch('/api/ai/plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: {
                        isReevaluation: true,
                        reevaluation: {
                            retest: reevaluation.retest,
                            toggles: {
                                isSameProblem: reevaluation.isSameProblem,
                                newRedFlags: reevaluation.newRedFlags,
                                changedMechanism: reevaluation.changedMechanism,
                                changedComparable: reevaluation.changedComparable,
                                changedPsfs: reevaluation.changedPsfs
                            }
                        },
                        caseSnapshot: procesoContext?.caseSnapshot
                    }
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al conectar con la IA de Reevaluación');

            const reevalPlan = data.data; // Zod parsed ReevaluationPlanSchema
            updateFormData({
                reevaluation: {
                    ...reevaluation,
                    progressSummary: reevalPlan.progress_summary,
                    planModifications: reevalPlan.plan_modifications + (reevalPlan.clinical_alerts?.length ? '\\n\\nALERTAS CLÍNICAS: ' + reevalPlan.clinical_alerts.join(', ') : '')
                }
            });
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Reevaluación Continua</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Compara el baseline de ingreso y ajusta el plan de intervención.
                    {view === 0 ? '(Paso 1: Análisis de Ingreso)' : '(Paso 2: Retest Actual)'}
                </p>
            </div>

            <div className="flex gap-2 mb-4 bg-slate-100 p-1.5 rounded-xl self-start">
                <button
                    onClick={() => setView(0)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 0 ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    1. Snapshot Base
                </button>
                <button
                    onClick={() => setView(1)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 1 ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    2. Retest Cita
                </button>
            </div>

            {view === 0 ? (
                <div className="flex flex-col gap-6">
                    <div className="bg-slate-50 border border-slate-200 p-4 md:p-6 rounded-2xl">
                        <div className="flex items-center gap-2 mb-4">
                            <ClipboardDocumentListIcon className="w-6 h-6 text-indigo-500" />
                            <h3 className="font-bold text-slate-800 text-lg">Snapshot Clínico de Atención Vigente</h3>
                        </div>

                        {procesoContext ? (
                            <div className="bg-white border text-xs border-indigo-100 rounded-xl p-4 shadow-sm mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16 pointer-events-none"></div>
                                <div className="md:col-span-2">
                                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Diagnóstico Actual</span>
                                    <p className="font-medium text-slate-700">{procesoContext.diagnosisVigente || 'Sin diagnóstico vigente registrado'}</p>
                                </div>
                                {procesoContext.caseSnapshot?.baselineComparable && (
                                    <div>
                                        <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Signo Comparable (Baseline)</span>
                                        <p className="font-medium text-emerald-900 bg-emerald-50 px-2 py-1.5 rounded-md border border-emerald-100">
                                            {typeof procesoContext.caseSnapshot.baselineComparable === 'string'
                                                ? procesoContext.caseSnapshot.baselineComparable
                                                : (procesoContext.caseSnapshot.baselineComparable.name || 'Sin dato')}
                                        </p>
                                        {procesoContext.caseSnapshot.lastRetest && (
                                            <p className="text-[10px] text-emerald-700 mt-1 pl-1 flex flex-col gap-0.5"><span className="font-bold">Último Retest Histórico:</span> {procesoContext.caseSnapshot.lastRetest}</p>
                                        )}
                                    </div>
                                )}
                                {procesoContext.caseSnapshot?.psfsBaseline && procesoContext.caseSnapshot.psfsBaseline.length > 0 && (
                                    <div>
                                        <span className="block text-[10px] font-black text-amber-600 uppercase tracking-wider mb-1">PSFS (Baseline / Último)</span>
                                        <div className="bg-amber-50 px-2 py-1.5 rounded-md border border-amber-100 space-y-1">
                                            {procesoContext.caseSnapshot.psfsBaseline.map((psfs: any, i: number) => (
                                                <div key={i} className="flex justify-between items-center border-b border-amber-200/50 last:border-0 pb-1 last:pb-0">
                                                    <span className="font-medium text-amber-900 truncate max-w-[150px]">{psfs.activity}</span>
                                                    <span className="font-bold text-amber-700">{procesoContext.caseSnapshot?.psfsLast?.[i]?.score ?? psfs.score}/10</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {procesoContext.loadManagementVigente?.trafficLight && (
                                    <div className="flex flex-col">
                                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Semáforo de Carga / Irrit.</span>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-3 h-3 rounded-full 
                                                ${procesoContext.loadManagementVigente.trafficLight === 'Rojo' ? 'bg-rose-500' :
                                                    procesoContext.loadManagementVigente.trafficLight === 'Amarillo' ? 'bg-amber-500' : 'bg-emerald-500'}
                                            `}></span>
                                            <span className="font-bold text-slate-700">{procesoContext.loadManagementVigente.trafficLight}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl text-sm text-orange-800 mb-6 flex items-center gap-2">
                                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" /> No se pudo recuperar el Snapshot Base del Proceso para comparación.
                            </div>
                        )}

                        <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2 flex items-center gap-2">
                            Toggles Clínicos Condicionales
                        </h4>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 cursor-pointer hover:border-indigo-300 transition-colors">
                                <input type="checkbox" checked={reevaluation.isSameProblem !== false} onChange={e => updateFormData({ reevaluation: { ...reevaluation, isSameProblem: e.target.checked } })} disabled={isClosed} className="mt-0.5 w-5 h-5 text-indigo-600 rounded bg-slate-100 border-slate-300 focus:ring-indigo-500" />
                                <div>
                                    <span className="text-sm font-bold text-slate-700 block mb-0.5">¿Es la misma condición clínica principal?</span>
                                    <span className="text-xs text-slate-500 leading-tight">Desmarque si la persona viene por algo enteramente nuevo.</span>
                                </div>
                            </label>

                            <div className={`transition-all duration-300 overflow-hidden ${reevaluation.isSameProblem === false ? 'h-0 opacity-0' : 'h-auto opacity-100 flex flex-col gap-3'}`}>
                                <label className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-rose-100 hover:border-rose-300 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={reevaluation.newRedFlags || false} onChange={e => updateFormData({ reevaluation: { ...reevaluation, newRedFlags: e.target.checked } })} disabled={isClosed} className="mt-0.5 w-5 h-5 text-rose-600 rounded bg-slate-100 border-slate-300 focus:ring-rose-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block mb-0.5 text-rose-800">¿Han aparecido nuevas Red Flags / Signos de Alerta?</span>
                                        <span className="text-xs text-rose-600/80 leading-tight">Como pérdida de peso, dolor nocturno intenso, cambios sensitivo-motores bruscos.</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={reevaluation.changedMechanism || false} onChange={e => updateFormData({ reevaluation: { ...reevaluation, changedMechanism: e.target.checked } })} disabled={isClosed} className="mt-0.5 w-5 h-5 text-indigo-600 rounded bg-slate-100 border-slate-300 focus:ring-indigo-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block mb-0.5">¿Cambió la presentación o mecanismo sintomático?</span>
                                        <span className="text-xs text-slate-500 leading-tight">Por ejemplo: el dolor irradiado pasó a dolor radicular constante.</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={reevaluation.changedComparable || false} onChange={e => updateFormData({ reevaluation: { ...reevaluation, changedComparable: e.target.checked } })} disabled={isClosed} className="mt-0.5 w-5 h-5 text-indigo-600 rounded bg-slate-100 border-slate-300 focus:ring-indigo-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block mb-0.5">¿Cambió el Signo Comparable?</span>
                                        <span className="text-xs text-slate-500 leading-tight">Marque si el signo/test que re-testeábamos ya no provoca síntomas y usaremos otro.</span>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:border-amber-300 cursor-pointer transition-colors">
                                    <input type="checkbox" checked={reevaluation.changedPsfs || false} onChange={e => updateFormData({ reevaluation: { ...reevaluation, changedPsfs: e.target.checked } })} disabled={isClosed} className="mt-0.5 w-5 h-5 text-amber-600 rounded bg-slate-100 border-slate-300 focus:ring-amber-500" />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block mb-0.5">¿Cambió significativamente la meta funcional (PSFS)?</span>
                                        <span className="text-xs text-slate-500 leading-tight">Si se cumplieron las actividades pasadas y el foco cambió a otros gestos.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {!isClosed && (
                            <div className="mt-8 pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                                {reevaluation.isSameProblem === false || reevaluation.newRedFlags ? (
                                    <button
                                        onClick={onCreateNewInitial}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-sm text-sm flex gap-2 justify-center items-center w-full"
                                    >
                                        <ChartBarIcon className="w-5 h-5" />
                                        Crear Nueva Evaluación Inicial Absoluta
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setView(1)}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-sm text-sm flex gap-2 justify-center items-center w-full"
                                    >
                                        <ArrowTrendingUpIcon className="w-5 h-5" />
                                        {reevaluation.changedMechanism || reevaluation.changedComparable || reevaluation.changedPsfs ? 'Continuar (Con ajustes condicionales)' : 'Paso Libre -> Ir a Retest Rápido'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-6">

                    {aiError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm flex gap-3 items-center">
                            <span className="text-xl">⚠️</span> {aiError}
                        </div>
                    )}

                    <div className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-3">
                            <span className="text-xl">🎯</span>
                            <h3 className="font-bold text-slate-800 tracking-tight text-base">Retest Estructurado</h3>
                        </div>

                        {/* Fila 1: EVA y Comportamiento */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-1 block">Dolor Actual (0-10)</label>
                                <input
                                    type="number" min="0" max="10"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                                    value={reevaluation.retest?.evaCurrent || ''}
                                    onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, evaCurrent: e.target.value } } })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-1 block">Peor dolor 24h</label>
                                <input
                                    type="number" min="0" max="10"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                                    value={reevaluation.retest?.evaWorst24h || ''}
                                    onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, evaWorst24h: e.target.value } } })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-1 block">Mejor dolor 24h</label>
                                <input
                                    type="number" min="0" max="10"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                                    value={reevaluation.retest?.evaBest24h || ''}
                                    onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, evaBest24h: e.target.value } } })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 mb-1 block">Irritabilidad (After-effect)</label>
                                <select
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white disabled:opacity-50"
                                    value={reevaluation.retest?.afterEffect || ''}
                                    onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, afterEffect: e.target.value } } })}
                                    disabled={isClosed}
                                >
                                    <option value="">Seleccionar...</option>
                                    <option value="Nunca">Nunca (Se pasa rápido)</option>
                                    <option value="A veces">A veces (Dura un poco)</option>
                                    <option value="Siempre">Siempre (Gran latencia)</option>
                                </select>
                            </div>
                        </div>

                        {/* Fila 2: PSFS y Comparable */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                            {/* PSFS Section */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-sm font-bold text-amber-700 block">Re-puntuación PSFS</label>
                                    {!isClosed && (
                                        <button
                                            onClick={() => {
                                                if (!procesoContext?.caseSnapshot?.psfsBaseline) return;
                                                const basePsfs = procesoContext.caseSnapshot.psfsLast || procesoContext.caseSnapshot.psfsBaseline;
                                                updateFormData({
                                                    reevaluation: {
                                                        ...reevaluation,
                                                        retest: { ...reevaluation.retest, psfsScores: JSON.parse(JSON.stringify(basePsfs)) }
                                                    }
                                                });
                                            }}
                                            className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-1 rounded hover:bg-amber-200 transition-colors"
                                        >
                                            Copiar Baseline
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {(reevaluation.retest?.psfsScores || []).length === 0 ? (
                                        <p className="text-xs text-slate-500 italic">Clic en 'Copiar Baseline' para re-evaluar las actividades funcionales.</p>
                                    ) : (
                                        (reevaluation.retest.psfsScores || []).map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    value={item.activity}
                                                    onChange={e => {
                                                        const newArr = [...reevaluation.retest.psfsScores];
                                                        newArr[idx].activity = e.target.value;
                                                        updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, psfsScores: newArr } } });
                                                    }}
                                                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded p-1.5 focus:border-amber-400 outline-none"
                                                    disabled={isClosed || !reevaluation.changedPsfs}
                                                />
                                                <input
                                                    type="number" min="0" max="10" placeholder="0-10"
                                                    value={item.score}
                                                    onChange={e => {
                                                        const newArr = [...reevaluation.retest.psfsScores];
                                                        newArr[idx].score = Number(e.target.value);
                                                        updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, psfsScores: newArr } } });
                                                    }}
                                                    className="w-16 text-center text-xs font-bold bg-amber-50 border border-amber-200 text-amber-900 rounded p-1.5 focus:border-amber-400 outline-none"
                                                    disabled={isClosed}
                                                />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Comparable Section */}
                            <div>
                                <label className="text-sm font-bold text-emerald-700 mb-2 block">Retest Signo Comparable</label>
                                <textarea
                                    className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-900 outline-none focus:border-emerald-400 min-h-[90px]"
                                    placeholder="Al re-evaluar el signo (Ej: Sentadilla profunda a 90°)..."
                                    value={reevaluation.retest?.comparableSignResult || ''}
                                    onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, comparableSignResult: e.target.value } } })}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>

                        {/* Fila 2.5: Outcomes Rápidos (SANE / GROC) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                            <div>
                                <label className="text-sm font-bold text-indigo-700 mb-2 block">Retest SANE (0-100%) - Opcional</label>
                                <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                    <input type="range" min="0" max="100" className="flex-1 accent-indigo-500" value={reevaluation.retest?.saneScore || 0} onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, saneScore: Number(e.target.value) } } })} disabled={isClosed} />
                                    <div className="w-12 text-center text-sm font-bold text-indigo-700 bg-white py-1 rounded-lg border border-indigo-200">
                                        {reevaluation.retest?.saneScore || 0}%
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-bold text-indigo-700 mb-2 block">GROC (-7 a +7) - Opcional</label>
                                <div className="flex items-center gap-4 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                    <input type="range" min="-7" max="7" className="flex-1 accent-indigo-500" value={reevaluation.retest?.grocScore || 0} onChange={e => updateFormData({ reevaluation: { ...reevaluation, retest: { ...reevaluation.retest, grocScore: Number(e.target.value) } } })} disabled={isClosed} />
                                    <div className="w-12 text-center text-sm font-bold text-indigo-700 bg-white py-1 rounded-lg border border-indigo-200">
                                        {(reevaluation.retest?.grocScore || 0) > 0 ? '+' : ''}{reevaluation.retest?.grocScore || 0}
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">Escala global de cambio desde el inicio del proceso.</p>
                            </div>
                        </div>

                        {/* Fila 3: Observaciones Libres */}
                        <div className="pt-4 border-t border-slate-100">
                            <label className="text-xs font-bold text-slate-700 mb-2 block flex items-center gap-1">
                                Notas adicionales / Retest físico <span className="font-normal text-slate-500">(Fuerza, ROM, Tests)</span>
                            </label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white min-h-[80px]"
                                placeholder="Anota cualquier otra prueba física modificada..."
                                value={reevaluation.retest?.freeNotes || (typeof reevaluation.retest === 'string' ? reevaluation.retest : '')}
                                onChange={e => {
                                    const strValue = e.target.value;
                                    // Handle legacy string -> object transformation gracefully if needed
                                    const currentRetest = typeof reevaluation.retest === 'object' ? reevaluation.retest : {};
                                    updateFormData({ reevaluation: { ...reevaluation, retest: { ...currentRetest, freeNotes: strValue } } });
                                }}
                                disabled={isClosed}
                            />
                        </div>
                    </div>

                    <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2"><span className="text-xl">📈</span> Progreso y Ajustes al Plan</h3>
                            {!isClosed && (
                                <button
                                    onClick={handleGenerateReevaluation}
                                    disabled={isGenerating || !reevaluation.retest}
                                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                                >
                                    {isGenerating ? <span className="animate-spin text-sm">🔄</span> : <span className="text-sm">✨</span>}
                                    {isGenerating ? 'Analizando...' : 'Asistente IA (Gemini)'}
                                </button>
                            )}
                        </div>

                        <div className="p-5 space-y-6">
                            {/* Block Calculadora Determinista */}
                            {progressCalc && (
                                <div className={`border p-4 rounded-xl flex flex-col gap-2 ${progressCalc.color}`}>
                                    <h4 className="font-bold text-sm tracking-tight flex items-center gap-1">
                                        Veredicto Matemático: <span className="uppercase">{progressCalc.direction}</span>
                                    </h4>
                                    <ul className="list-disc pl-5 text-xs opacity-90 space-y-0.5 mt-1 font-medium">
                                        {progressCalc.reasons.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Resumen del Progreso</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:bg-white min-h-[100px]"
                                        placeholder="El paciente reporta menor dolor matutino..."
                                        value={reevaluation.progressSummary || ''}
                                        onChange={e => updateFormData({ reevaluation: { ...reevaluation, progressSummary: e.target.value } })}
                                        disabled={isClosed}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Modificaciones al Plan Activo</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:bg-white min-h-[100px]"
                                        placeholder="Progresar carga, reducir serie 2..."
                                        value={reevaluation.planModifications || ''}
                                        onChange={e => updateFormData({ reevaluation: { ...reevaluation, planModifications: e.target.value } })}
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>

                            {/* Bloque de Objetivos */}
                            <div className="pt-4 border-t border-slate-100">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2 block">Gestión de Objetivos (Versionado Automático)</label>
                                <div className="space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                    {(reevaluation.updatedObjectives || []).map((obj: any, idx: number) => (
                                        <div key={obj.id || idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                            <input
                                                type="text"
                                                className="flex-1 w-full bg-white border border-slate-200 rounded p-2 text-xs outline-none focus:border-indigo-400"
                                                value={obj.label || obj.text}
                                                onChange={e => {
                                                    const arr = [...reevaluation.updatedObjectives];
                                                    arr[idx] = { ...arr[idx], label: e.target.value };
                                                    updateFormData({ reevaluation: { ...reevaluation, updatedObjectives: arr } });
                                                }}
                                                disabled={isClosed}
                                            />
                                            <select
                                                className={`p-2 text-xs border rounded outline-none w-full sm:w-auto font-bold ${obj.status === 'activo' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                                                    obj.status === 'logrado' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                                                        'bg-slate-100 border-slate-300 text-slate-600'
                                                    }`}
                                                value={obj.status}
                                                onChange={e => {
                                                    const arr = [...reevaluation.updatedObjectives];
                                                    arr[idx] = { ...arr[idx], status: e.target.value };
                                                    updateFormData({ reevaluation: { ...reevaluation, updatedObjectives: arr } });
                                                }}
                                                disabled={isClosed}
                                            >
                                                <option value="activo">En Curso (Activo)</option>
                                                <option value="pausado">Pausado</option>
                                                <option value="logrado">Logrado ✓</option>
                                            </select>
                                        </div>
                                    ))}
                                    {!isClosed && (
                                        <button
                                            onClick={() => {
                                                const arr = [...(reevaluation.updatedObjectives || [])];
                                                arr.push({ id: `temp_${Date.now()}`, label: 'Nuevo objetivo clínico...', status: 'activo' });
                                                updateFormData({ reevaluation: { ...reevaluation, updatedObjectives: arr } });
                                            }}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                                        >
                                            + Agregar Nuevo Objetivo
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
