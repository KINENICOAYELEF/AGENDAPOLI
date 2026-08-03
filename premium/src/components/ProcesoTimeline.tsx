import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, deleteDoc, collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { Evaluacion, Evolucion, Proceso } from "@/types/clinica";
import { EvaluacionForm } from "./EvaluacionForm";
import { EvaluacionExpressForm } from "./EvaluacionExpressForm";
import { ReevaluacionExpressForm } from "./ReevaluacionExpressForm";
import { EvolucionForm } from "./EvolucionForm";
import { ReadOnlyEvaluacion } from "./evaluacion-steps/ReadOnlyEvaluacion";
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
    initialRecordId?: string;
    initialRecordType?: string;
    initialAction?: string;
    initialStep?: string;
    onNavigationChange?: (state: Record<string, string | undefined>) => void;
    onBack: () => void;
}

type TimelineItem =
    | { type: 'evaluacion'; data: Evaluacion; date: Date }
    | { type: 'evolucion'; data: Evolucion; date: Date };

export function ProcesoTimeline({ personaUsuariaId, personaUsuariaName, proceso, initialRecordId, initialRecordType, initialAction, initialStep, onNavigationChange, onBack }: ProcesoTimelineProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();
    const isAdmin = (user?.role as string) === 'ADMIN' || (user?.role as string) === 'DOCENTE';
    const isInterno = (user?.role as string) === 'INTERNO';
    const canUseV2 = isAdmin || isInterno;

    const [items, setItems] = useState<TimelineItem[]>([]);
    const [loading, setLoading] = useState(true);

    const [view, setView] = useState<'timeline' | 'formEval' | 'formExpressEval' | 'formReeval' | 'formEvol' | 'editEval' | 'editEvol' | 'readEval' | 'historyEvol'>('timeline');
    const [activeTab, setActiveTab] = useState<'timeline' | 'outcomes'>('timeline');
    const [selectedEval, setSelectedEval] = useState<Evaluacion | null>(null);
    const [selectedEvol, setSelectedEvol] = useState<Evolucion | null>(null);

    // Estado para el modal de historial
    const [historySnapshots, setHistorySnapshots] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadData = async () => {
        if (!globalActiveYear || !proceso.id) return;
        setLoading(true);
        try {
            const evalsRef = collection(db, "programs", globalActiveYear, "evaluaciones");
            const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");

            const qEvals = query(evalsRef, where("procesoId", "==", proceso.id));
            const qEvols = query(evolsRef, where("procesoId", "==", proceso.id));

            const [snapEvals, snapEvols] = await Promise.all([
                getDocs(qEvals),
                getDocs(qEvols)
            ]);

            const loadedItems: TimelineItem[] = [];

            snapEvals.docs.forEach(docSnap => {
                const data = docSnap.data() as Evaluacion;
                const createdAt = (data as any).createdAt;
                const d = data.sessionAt ? new Date(data.sessionAt) : (createdAt ? new Date(createdAt) : new Date());
                loadedItems.push({ type: 'evaluacion', data: { ...data, id: docSnap.id }, date: d });
            });

            snapEvols.docs.forEach(docSnap => {
                const data = docSnap.data() as Evolucion;
                const createdAt = (data as any).createdAt;
                const d = data.sessionAt ? new Date(data.sessionAt) : (createdAt ? new Date(createdAt) : new Date());
                loadedItems.push({ type: 'evolucion', data: { ...data, id: docSnap.id }, date: d });
            });

            // Ordenar por fecha descendente
            loadedItems.sort((a, b) => b.date.getTime() - a.date.getTime());
            setItems(loadedItems);

            // Auto-open exact record if initialRecordId matches
            if (initialRecordId) {
                const target = loadedItems.find(i => i.data.id === initialRecordId);
                if (target) {
                    if (target.type === 'evaluacion') {
                        setSelectedEval(target.data);
                        setView('readEval');
                    } else if (target.type === 'evolucion') {
                        setSelectedEvol(target.data);
                        setView('editEvol');
                    }
                }
            } else if (initialAction?.toUpperCase() === 'REEVALUAR') {
                const draft = loadedItems.find(item => item.type === 'evaluacion' && item.data.type === 'REEVALUATION' && item.data.status === 'DRAFT');
                setSelectedEval(draft?.type === 'evaluacion' ? draft.data : null);
                setView('formReeval');
            } else if (initialAction?.toUpperCase() === 'EVALUACION_INICIAL') {
                const initial = loadedItems.find(item => item.type === 'evaluacion' && item.data.type === 'INITIAL');
                setSelectedEval(initial?.type === 'evaluacion' ? initial.data : null);
                setView('formExpressEval');
            } else if (initialAction?.toUpperCase() === 'EVOLUCIONAR') {
                setSelectedEvol(null);
                setView('formEvol');
            }
        } catch (e) {
            console.error("Error cargando timeline:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (item: TimelineItem) => {
        const typeStr = item.type === 'evaluacion' ? 'evaluación' : 'evolución';
        if (!window.confirm(`¿Estás seguro de eliminar esta ${typeStr}?\n\nESTA ACCIÓN NO SE PUEDE DESHACER.`)) return;

        try {
            const collectionName = item.type === 'evaluacion' ? 'evaluaciones' : 'evoluciones';
            const docRef = doc(db, "programs", globalActiveYear!, collectionName, item.data.id!);
            await deleteDoc(docRef);
            // Optimization: Filter out the item locally instead of full reload
            setItems(prev => prev.filter(i => i.data.id !== item.data.id));
        } catch (error) {
            console.error("Error eliminando item:", error);
            alert("Error al eliminar. Intente de nuevo.");
        }
    };

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, proceso.id]);

    const handleEvalSaved = () => {
        setView('timeline');
        onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id });
        loadData();
    };

    const handleEvolSaved = () => {
        setView('timeline');
        onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id });
        loadData();
    };

    const evaluationsInTimeline = items
        .filter((item): item is Extract<TimelineItem, { type: 'evaluacion' }> => item.type === 'evaluacion')
        .map(item => item.data);
    const latestInitialEvaluation = evaluationsInTimeline.find(evaluation => evaluation.type === 'INITIAL') || null;
    const hasInitialEvaluation = evaluationsInTimeline.some(evaluation => evaluation.type === 'INITIAL' && evaluation.status === 'CLOSED');
    const latestBaselineEvaluation = evaluationsInTimeline.find(evaluation =>
        evaluation.status === 'CLOSED' && evaluation.id !== selectedEval?.id,
    ) || evaluationsInTimeline.find(evaluation => evaluation.id !== selectedEval?.id) || null;

    if (view === 'readEval' && selectedEval) {
        return (
            <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-in fade-in duration-200 overscroll-none">
                <div className="w-full flex-1 h-full text-slate-500 font-medium bg-slate-50 overflow-y-auto">
                    <ReadOnlyEvaluacion
                        evaluacion={selectedEval}
                        usuariaName={personaUsuariaName}
                        onClose={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }}
                        onEdit={() => setView('formExpressEval')}
                    />
                </div>
            </div>
        );
    }

    if (view !== 'timeline') {
        const isEvalInitial = view === 'formEval' || (view === 'editEval' && selectedEval?.type === 'INITIAL');
        const isReeval = view === 'formReeval' || (view === 'editEval' && selectedEval?.type === 'REEVALUATION');
        const isExpress = view === 'formExpressEval';

        return (
            <div className="fixed inset-0 z-[9999] bg-white flex flex-col animate-in fade-in duration-200 overscroll-none">
                <div className="w-full flex-1 h-full text-slate-500 font-medium bg-slate-50 overflow-y-auto">
                    {isEvalInitial && (
                        <EvaluacionForm
                            usuariaId={personaUsuariaId}
                            procesoId={proceso.id!}
                            type="INITIAL"
                            initialData={selectedEval}
                            reevaluationBaseline={null}
                            procesoContext={proceso}
                            onClose={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }}
                            onSaveSuccess={handleEvalSaved}
                        />
                    )}
                    {isReeval && (
                        <ReevaluacionExpressForm
                            usuariaId={personaUsuariaId}
                            proceso={proceso}
                            baselineEvaluation={latestBaselineEvaluation}
                            recentEvolutions={items.filter(i => i.type === 'evolucion').map(i => i.data as Evolucion)}
                            initialData={selectedEval}
                            initialStep={initialStep}
                            onStepChange={(nextStep) => onNavigationChange?.({ action: 'REEVALUAR', procesoId: proceso.id, step: String(nextStep) })}
                            onClose={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }}
                            onSaveSuccess={handleEvalSaved}
                        />
                    )}
                    {isExpress && (
                        <EvaluacionExpressForm
                            usuariaId={personaUsuariaId}
                            procesoId={proceso.id!}
                            initialData={selectedEval}
                            onClose={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }}
                            onSaveSuccess={handleEvalSaved}
                        />
                    )}
                    {(view === 'formEvol' || view === 'editEvol') && (
                        <EvolucionForm
                            usuariaId={personaUsuariaId}
                            procesoId={proceso.id}
                            initialData={selectedEvol}
                            evolucionesAnteriores={items.filter(i => i.type === 'evolucion').map(i => i.data as Evolucion)}
                            onClose={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }}
                            onSaveSuccess={handleEvolSaved}
                        />
                    )}
                    {view === 'historyEvol' && selectedEvol && (
                        <div className="p-6 h-full overflow-y-auto w-full max-w-2xl mx-auto">
                            <button onClick={() => { setView('timeline'); onNavigationChange?.({ action: 'PROCESOS', procesoId: proceso.id }); }} className="mb-4 text-sm font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                                <ChevronLeftIcon className="w-4 h-4" /> Volver al Timeline
                            </button>
                            <h2 className="text-xl font-black text-slate-800 mb-6">Historial de Revisiones (Snapshots)</h2>
                            {loadingHistory ? (
                                <div className="animate-pulse w-full h-20 bg-slate-200 rounded-xl"></div>
                            ) : historySnapshots.length === 0 ? (
                                <div className="p-6 bg-slate-100 rounded-2xl text-center text-slate-500 font-medium">
                                    No hay historial de modificaciones previas para esta evolución.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {historySnapshots.map(snap => (
                                        <div key={snap.id} className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl">
                                            <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full mb-1 inline-block">
                                                        Copia de Seguridad Antes de Reabrir
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-700">Responsable reapertura: <span className="text-indigo-600">{snap.snapshotMetadata?.snapshotByRole || 'Admin'}</span></p>
                                                    <p className="text-[10px] text-slate-500">Motivo: {snap.snapshotMetadata?.snapshotReason}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold text-slate-400">
                                                        {new Date(snap.snapshotMetadata?.snapshotAt || snap.sessionAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <p className="text-xs font-bold text-slate-600 mb-1">Cuerpo Clínico Original:</p>
                                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 max-h-40 overflow-y-auto font-mono text-[10px] text-slate-600 whitespace-pre-wrap">
                                                    {/* Mostrar un resumen simple de los datos más mutables */}
                                                    Subjetivo: {snap.pain?.patientComment}{'\n'}
                                                    Objetivo/Plan: {snap.sessionGoal}{'\n'}
                                                    Evaluación SANE: {snap.outcomesSnapshot?.sane}{'\n'}
                                                    Ejercicios Registrados: {snap.exercises?.length || 0}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
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
            <div className="grid gap-2 sm:grid-cols-2">
                <button
                    onClick={() => { setSelectedEvol(null); setView('formEvol'); onNavigationChange?.({ action: 'EVOLUCIONAR', procesoId: proceso.id }); }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700"
                >
                    <PlusIcon className="w-4 h-4" />
                    Nueva Evolución
                </button>
                <button
                    onClick={() => {
                        setSelectedEval(hasInitialEvaluation ? null : latestInitialEvaluation);
                        setView(hasInitialEvaluation ? 'formReeval' : 'formExpressEval');
                        onNavigationChange?.({ action: hasInitialEvaluation ? 'REEVALUAR' : 'EVALUACION_INICIAL', procesoId: proceso.id, step: hasInitialEvaluation ? '1' : undefined });
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-700"
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    {hasInitialEvaluation ? 'Reevaluación' : latestInitialEvaluation ? 'Completar evaluación inicial' : 'Crear evaluación inicial'}
                </button>

                {canUseV2 && hasInitialEvaluation && (
                    <button
                        onClick={() => { setSelectedEval(latestInitialEvaluation); setView('formExpressEval'); }}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:col-span-2"
                    >
                        <ClipboardIcon className="h-4 w-4 text-slate-500" />
                        <span>Consultar evaluación inicial</span>
                    </button>
                )}
            </div>
            {isAdmin && <details className="text-xs text-slate-500"><summary className="cursor-pointer py-2 font-semibold">Herramientas docentes heredadas</summary><button onClick={() => { setSelectedEval(null); setView('formEval'); }} className="mt-1 min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-semibold text-slate-600">Abrir formulario inicial antiguo</button></details>}

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
                                const isDraftEvol = !isEval && (item.data as Evolucion).status === 'DRAFT';

                                return (
                                    <div key={item.data.id || idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group select-none">
                                        {/* Marker */}
                                        <div className={`flex items-center justify-center w-6 h-6 rounded-full border-2 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${isDraftEvol ? 'bg-amber-500 animate-bounce' : isEval ? (isReeval ? 'bg-emerald-500' : 'bg-slate-800') : 'bg-indigo-500'
                                            }`}>
                                            {isEval ? (
                                                isReeval ? <ArrowPathIcon className="w-3 h-3 text-white" /> : <ClipboardIcon className="w-3 h-3 text-white" />
                                            ) : (
                                                <DocumentTextIcon className="w-3 h-3 text-white" />
                                            )}
                                        </div>

                                        {/* Card */}
                                        <div
                                            className={`w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] p-4 rounded-2xl border transition-all cursor-pointer ${
                                                isDraftEvol 
                                                    ? 'bg-gradient-to-br from-amber-50/90 to-orange-50/90 border-amber-300 ring-2 ring-amber-400 shadow-md' 
                                                    : 'bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200'
                                            }`}
                                            onClick={() => {
                                                if (isEval) {
                                                    setSelectedEval(item.data as Evaluacion);
                                                    setView('readEval');
                                                } else {
                                                    setSelectedEvol(item.data as Evolucion);
                                                    setView('editEvol');
                                                }
                                            }}
                                        >
                                            {/* ALERTA DE BORRADOR SIN FIRMAR */}
                                            {isDraftEvol && (
                                                <div className="mb-3 bg-amber-500 text-white px-3 py-1.5 rounded-xl flex items-center justify-between shadow-xs">
                                                    <span className="text-xs font-black flex items-center gap-1.5 tracking-wide">
                                                        <span>⚠️</span> BORRADOR PENDIENTE
                                                    </span>
                                                    <span className="text-[10px] bg-white text-amber-900 px-2 py-0.5 rounded-lg font-black uppercase shadow-xs">
                                                        ✍️ FIRMAR AHORA
                                                    </span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {new Date(item.data.sessionAt || 0).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </span>
                                                {isEval ? (
                                                    <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${(item.data as Evaluacion).status === 'CLOSED' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}>
                                                        {(item.data as Evaluacion).status === 'CLOSED' ? 'Cerrada' : 'Abierta'}
                                                    </span>
                                                ) : isDraftEvol ? (
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800">
                                                        Borrador Abierto
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div className="text-sm font-bold text-slate-800 leading-tight mb-2">
                                                {isEval ? (isReeval ? 'Re-Evaluación Seguimiento' : 'Evaluación Inicial') : 'Evolución de Sesión'}
                                            </div>

                                            {/* MINI RESUMEN CLÍNICO */}
                                            {isEval && (item.data as any).autoSynthesis?.clasificacion_dolor && (
                                                <div className="text-[10px] font-bold text-indigo-500 uppercase flex items-center gap-1 mb-1">
                                                    <span className="w-1 h-1 rounded-full bg-indigo-500"></span>
                                                    {(item.data as any).autoSynthesis.clasificacion_dolor.categoria}
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start gap-4">
                                                <div className="text-xs text-slate-500 line-clamp-2 italic flex-1">
                                                    {isEval ? 
                                                        ((item.data as any).p4_plan_structured?.diagnostico_kinesiologico_narrativo || 
                                                         (item.data as any).geminiDiagnostic?.narrativeDiagnosis || 
                                                         "Sin diagnóstico sintetizado") : 
                                                        (item.data as Evolucion).sessionGoal || "Sin objetivo definido"}
                                                </div>
                                                <div className="flex flex-col gap-1 items-end shrink-0">
                                                    {(!isEval || isAdmin) && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (isEval) {
                                                                    setSelectedEval(item.data as Evaluacion);
                                                                    setView('editEval');
                                                                } else {
                                                                    setSelectedEvol(item.data as Evolucion);
                                                                    setView('editEvol');
                                                                }
                                                            }}
                                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                        >
                                                            ✏️ Editar Completo
                                                        </button>
                                                    )}
                                                    {isEval && canUseV2 && (item.data as any).expressDraft && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedEval(item.data as Evaluacion);
                                                                setView('formExpressEval');
                                                            }}
                                                            className="text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md transition-colors flex items-center gap-1"
                                                        >
                                                            ⚡ Editar v2
                                                        </button>
                                                    )}
                                                    {isAdmin && !isEval && (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                setSelectedEvol(item.data as Evolucion);
                                                                setView('historyEvol');
                                                                setLoadingHistory(true);
                                                                try {
                                                                    const docRef = doc(db, "programs", globalActiveYear!, "evoluciones", item.data.id!);
                                                                    const histRef = collection(docRef, "history_snapshots");
                                                                    const snaps = await getDocs(query(histRef, orderBy("snapshotMetadata.snapshotAt", "desc")));
                                                                    setHistorySnapshots(snaps.docs.map(d => ({id: d.id, ...d.data()})));
                                                                } catch (err) {
                                                                    console.error(err);
                                                                } finally {
                                                                    setLoadingHistory(false);
                                                                }
                                                            }}
                                                            className="text-[10px] font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-md transition-colors"
                                                            title="Ver Historial de Ediciones"
                                                        >
                                                            ⏱️ Historial
                                                        </button>
                                                    )}
                                                    {isAdmin && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(item);
                                                            }}
                                                            className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-md transition-colors"
                                                            title="Eliminar"
                                                        >
                                                            🗑️ Borrar
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

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
