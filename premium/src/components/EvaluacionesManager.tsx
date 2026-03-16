import { useState, useEffect } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { Evaluacion, Proceso } from "@/types/clinica";

// Placeholder import for the Form we will build next
import { EvaluacionForm } from "@/components/EvaluacionForm";
import { ReadOnlyEvaluacion } from "./evaluacion-steps/ReadOnlyEvaluacion";

interface EvaluacionesManagerProps {
    usuariaId: string;
    usuariaName: string;
    proceso: Proceso;
    remoteHistorySnapshot?: any;
    pacienteSnapshot?: any;
    onBack: () => void;
}
export function EvaluacionesManager({ usuariaId, usuariaName, proceso, remoteHistorySnapshot, pacienteSnapshot, onBack }: EvaluacionesManagerProps) {
    const { globalActiveYear } = useYear();

    const [view, setView] = useState<'lista' | 'formulario' | 'lectura'>('lista');
    const [selectedEvaluacion, setSelectedEvaluacion] = useState<Evaluacion | null>(null);
    const [evaluacionType, setEvaluacionType] = useState<'INITIAL' | 'REEVALUATION'>('INITIAL');

    const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    const loadEvaluaciones = async () => {
        if (!globalActiveYear || !proceso.id) return;

        try {
            setLoadingData(true);
            const evalsRef = collection(db, "programs", globalActiveYear, "evaluaciones");
            const q = query(
                evalsRef,
                where("procesoId", "==", proceso.id),
                orderBy("sessionAt", "desc")
            );

            const querySnapshot = await getDocs(q);
            const fetchedList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Evaluacion[];

            setEvaluaciones(fetchedList);
        } catch (error) {
            console.error("Error obteniendo Evaluaciones", error);
            // Ignore index error UX for now, similar to others if composite missing.
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        loadEvaluaciones();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, proceso.id]);

    const handleFormSaved = (saved: Evaluacion, isNew: boolean) => {
        loadEvaluaciones();
        setView('lista');
    };

    if (view === 'formulario') {
        return (
            <div className="fixed inset-0 z-[9999] bg-white w-screen h-[100dvh] overflow-hidden flex flex-col animate-in slide-in-from-bottom-4">
                <div className="w-full flex-1 h-full text-slate-500 font-medium bg-slate-50">
                    <EvaluacionForm
                        usuariaId={usuariaId}
                        procesoId={proceso.id!}
                        type={evaluacionType}
                        initialData={(selectedEvaluacion || (remoteHistorySnapshot || pacienteSnapshot ? { remoteHistorySnapshot, paciente: pacienteSnapshot } : null)) as any}
                        onClose={() => { 
                            setView('lista');
                            loadEvaluaciones();
                        }}
                        onSaveSuccess={handleFormSaved}
                    />
                </div>
            </div>
        );
    }

    if (view === 'lectura' && selectedEvaluacion) {
        return (
            <ReadOnlyEvaluacion
                evaluacion={selectedEvaluacion}
                usuariaName={usuariaName}
                onClose={() => setView('lista')}
                onEdit={() => { setView('formulario'); }}
            />
        );
    }

    const hasInitial = evaluaciones.some(e => e.type === 'INITIAL');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Evaluaciones Clínicas</h3>
                    <p className="text-sm text-slate-500 font-medium">{usuariaName}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-slate-700 bg-slate-100 px-4 py-2.5 rounded-xl transition-all mr-auto sm:mr-4">
                        Atrás
                    </button>
                    {!hasInitial && (
                        <button
                            onClick={() => { setSelectedEvaluacion(null); setEvaluacionType('INITIAL'); setView('formulario'); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            Nueva Evaluación Inicial
                        </button>
                    )}
                    <button
                        onClick={() => { setSelectedEvaluacion(null); setEvaluacionType('REEVALUATION'); setView('formulario'); }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Nueva Re-Evaluación
                    </button>
                </div>
            </div>

            {loadingData ? (
                <div className="py-16 flex justify-center animate-pulse"><div className="w-12 h-12 bg-slate-200 rounded-full"></div></div>
            ) : evaluaciones.length === 0 ? (
                <div className="bg-slate-50 border border-slate-200/60 border-dashed rounded-3xl p-12 text-center">
                    <p className="text-slate-500 font-medium">Aún no hay evaluaciones realizadas en este proceso clínico.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {evaluaciones.map(ev => (
                        <div key={ev.id} className="bg-white border text-sm border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer" onClick={() => { setSelectedEvaluacion(ev); setEvaluacionType(ev.type); setView('lectura'); }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wide flex items-center gap-1.5
                                    ${ev.type === 'INITIAL' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}
                                    ${ev.status === 'DRAFT' ? 'opacity-80' : ''}
                                `}>
                                    {ev.type === 'INITIAL' ? 'Evaluación Inicial' : 'Re-Evaluación'}
                                    {ev.status === 'DRAFT' && ' (Borrador)'}
                                </span>
                                <span className="text-xs text-slate-400 font-medium">
                                    {new Date(ev.sessionAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="text-slate-700 mb-2">
                                <span className="text-xs uppercase text-slate-400 font-bold block mb-1">Focos de Atención</span>
                                <p className="font-semibold">{ev.type === 'INITIAL' && (ev as any).interview?.focos && (ev as any).interview.focos.length > 0 ? (ev as any).interview.focos.map((f: any) => `${f.region} ${f.lado}`).join(', ') : (ev.type === 'REEVALUATION' ? 'Reevaluación de Seguimiento' : 'Sin focos registrados')}</p>
                            </div>
                            <div className="text-slate-600 line-clamp-2 italic text-xs">
                                "{ev.type === 'INITIAL' ? ((ev as any).geminiDiagnostic?.narrativeDiagnosis || (ev as any).geminiDiagnostic?.kinesiologicalDxNarrative || ev.clinicalSynthesis || 'Evaluación sin diagnóstico narrativo completado.') : ((ev as any).reevaluation?.progressSummary || 'Reevaluación sin resumen de progreso completado.')}"
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
