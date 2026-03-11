import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { Evaluacion, Evolucion, Proceso } from "@/types/clinica";
import { EvaluacionForm } from "./EvaluacionForm";
import { EvolucionForm } from "./EvolucionForm";
import {
    PlusIcon,
    ArrowPathIcon,
    ClipboardIcon,
    ChevronLeftIcon,
    DocumentTextIcon,
    CheckBadgeIcon,
    ClockIcon,
    ChartBarIcon
} from '@heroicons/react/20/solid';
import { OutcomesView } from './OutcomesView';

interface ProcesoTimelineProps {
    personaUsuariaId: string;
    personaUsuariaName: string;
    proceso: Proceso;
    onBack: () => void;
}

type TimelineItem =
    | { type: 'evaluacion'; data: Evaluacion; date: Date }
    | { type: 'evolucion'; data: Evolucion; date: Date };

export function ProcesoTimeline({ personaUsuariaId, personaUsuariaName, proceso, onBack }: ProcesoTimelineProps) {
    const { globalActiveYear } = useYear();

    const [items, setItems] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [view, setView] = useState<'timeline' | 'formEval' | 'formReeval' | 'formEvol' | 'editEval' | 'editEvol'>('timeline');
    const [activeTab, setActiveTab] = useState<'timeline' | 'outcomes'>('timeline');
    const [selectedEval, setSelectedEval] = useState<Evaluacion | null>(null);
    const [selectedEvol, setSelectedEvol] = useState<Evolucion | null>(null);

    const loadData = async () => {
        if (!globalActiveYear || !proceso.id) return;
        setLoading(true);
        try {
            const evalsRef = collection(db, "programs", globalActiveYear, "evaluaciones");
            const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");

            const qEvals = query(evalsRef, where("procesoId", "==", proceso.id));
            const qEvols = query(evolsRef, where("procesoId", "==", proceso.id)); // also legacy users by id

            // We do parallel fetching
            const [evalsSnap, evolsSnap] = await Promise.all([getDocs(qEvals), getDocs(qEvols)]);

            const evals = evalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evaluacion));
            const evols = evolsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evolucion));

            const combined: TimelineItem[] = [
                ...evals.map(e => ({ type: 'evaluacion' as const, data: e, date: new Date(e.sessionAt) })),
                ...evols.map(e => ({ type: 'evolucion' as const, data: e, date: new Date(e.sessionAt) }))
            ];

            // sort descending
            combined.sort((a, b) => b.date.getTime() - a.date.getTime());
            setItems(combined);
        } catch (error) {
            console.error("Error cargando timeline:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, proceso.id]);

    const handleEvalSaved = () => {
        setView('timeline');
        loadData();
    };

    const handleEvolSaved = () => {
        setView('timeline');
        loadData();
    };

    if (view !== 'timeline') {
        const isEvalInitial = view === 'formEval' || (view === 'editEval' && selectedEval?.type === 'INITIAL');
        const isReeval = view === 'formReeval' || (view === 'editEval' && selectedEval?.type === 'REEVALUATION');

        return (
            <div className="fixed inset-0 z-[9999] bg-white w-screen h-[100dvh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
                <div className="w-full flex-1 h-full text-slate-500 font-medium bg-slate-50">
                    {(isEvalInitial || isReeval) && (
                        <EvaluacionForm
                            usuariaId={personaUsuariaId}
                            procesoId={proceso.id!}
                            type={isReeval ? 'REEVALUATION' : 'INITIAL'}
                            initialData={selectedEval}
                            onClose={() => setView('timeline')}
                            onSaveSuccess={handleEvalSaved}
                        />
                    )}
                    {(view === 'formEvol' || view === 'editEvol') && (
                        <EvolucionForm
                            usuariaId={personaUsuariaId}
                            procesoId={proceso.id}
                            initialData={selectedEvol}
                            evolucionesAnteriores={items.filter(i => i.type === 'evolucion').map(i => i.data as Evolucion)}
                            onClose={() => setView('timeline')}
                            onSaveSuccess={handleEvolSaved}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-400 hover:text-indigo-600 transition mb-2 flex items-center gap-1">
                        <ChevronLeftIcon className="w-4 h-4" />
                        Atrás
                    </button>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Timeline Clínico</h3>
                    <p className="text-sm text-slate-500 font-medium">{personaUsuariaName} • {proceso.motivoIngresoLibre}</p>
                </div>
            </div>

            {/* FASE 2.2.4: Botones de Acción Rápida */}
            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => { setSelectedEvol(null); setView('formEvol'); }}
                    className="flex-1 min-w-[140px] bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <PlusIcon className="w-4 h-4" />
                    Nueva Evolución
                </button>
                <button
                    onClick={() => { setSelectedEval(null); setView('formReeval'); }}
                    className="flex-1 min-w-[140px] bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    Reevaluación
                </button>
                <button
                    onClick={() => { setSelectedEval(null); setView('formEval'); }}
                    className="flex-1 min-w-[140px] bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold px-4 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                    <ClipboardIcon className="w-4 h-4" />
                    Eval Inicial (Nuevo Caso)
                </button>
            </div>

            {/* Pestañas de Navegación del Proceso */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'timeline'
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <ClockIcon className="w-4 h-4" />
                    Timeline Clínico
                </button>
                <button
                    onClick={() => setActiveTab('outcomes')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'outcomes'
                            ? 'bg-white text-indigo-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                >
                    <ChartBarIcon className="w-4 h-4" />
                    Outcomes
                </button>
            </div>

            {activeTab === 'timeline' ? (
                <>
                    {/* Timeline Mixto */}
                    {loading ? (
                        <div className="py-12 flex justify-center animate-pulse"><div className="w-8 h-8 rounded-full bg-slate-200"></div></div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            No hay atenciones registradas en este proceso.
                        </div>
                    ) : (
                        <div className="relative pl-4 space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                            {items.map((item, idx) => {
                                const isEval = item.type === 'evaluacion';
                                const isReeval = isEval && (item.data as Evaluacion).type === 'REEVALUATION';

                                return (
                                    <div key={item.data.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group select-none">
                                        {/* Marker */}
                                        <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-slate-200 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${isEval ? (isReeval ? 'bg-emerald-500' : 'bg-slate-800') : 'bg-indigo-500'
                                            }`}>
                                            {isEval ? (
                                                isReeval ? <ArrowPathIcon className="w-3 h-3 text-white" /> : <ClipboardIcon className="w-3 h-3 text-white" />
                                            ) : (
                                                <DocumentTextIcon className="w-3 h-3 text-white" />
                                            )}
                                        </div>

                                        {/* Card */}
                                        <div
                                            className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                                            onClick={() => {
                                                if (isEval) {
                                                    setSelectedEval(item.data as Evaluacion);
                                                    setView('editEval');
                                                } else {
                                                    setSelectedEvol(item.data as Evolucion);
                                                    setView('editEvol');
                                                }
                                            }}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${isEval ? (isReeval ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700') : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                    {isEval ? (isReeval ? 'Reevaluación' : 'Evaluación Inicial') : 'Evolución Sesión'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    <ClockIcon className="w-3 h-3" />
                                                    {item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-slate-800 line-clamp-2">
                                                {isEval
                                                    ? (item.data as Evaluacion).type === 'INITIAL'
                                                        ? (item.data as any).geminiDiagnostic?.narrativeDiagnosis || (item.data as any).geminiDiagnostic?.kinesiologicalDxNarrative || 'Diagnóstico no finalizado'
                                                        : (item.data as any).reevaluation?.progressSummary || 'Reevaluación en progreso'
                                                    : (item.data as Evolucion).sessionGoal || 'Sesión sin objetivo'
                                                }
                                            </p>

                                            {(!isEval && (item.data as Evolucion).sessionStatus) && (
                                                <div className="mt-2 text-[10px] font-medium text-slate-500 flex items-center gap-1">
                                                    <CheckBadgeIcon className="w-3 h-3 text-indigo-400" />
                                                    Estado: {(item.data as Evolucion).sessionStatus}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <OutcomesView proceso={proceso} />
            )}
        </div>
    );
}
