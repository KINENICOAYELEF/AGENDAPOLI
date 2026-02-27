import { useState, useEffect } from "react";
import { Proceso } from "@/types/clinica";
import { ProcesosService } from "@/services/procesos";
import { useYear } from "@/context/YearContext";
import { ProcesoForm } from "@/components/ProcesoForm";
import { EvolucionesManager } from "@/components/EvolucionesManager";

interface ProcesosManagerProps {
    personaUsuariaId: string;
    personaUsuariaName: string;
    onBack: () => void;
}

export function ProcesosManager({ personaUsuariaId, personaUsuariaName, onBack }: ProcesosManagerProps) {
    const { globalActiveYear } = useYear();

    // router interno de este panel
    const [view, setView] = useState<'lista' | 'formulario' | 'evoluciones'>('lista');

    // items
    const [procesos, setProcesos] = useState<Proceso[]>([]);
    const [selectedProceso, setSelectedProceso] = useState<Proceso | null>(null);
    const [loading, setLoading] = useState(true);

    const [indexError, setIndexError] = useState<string | null>(null);

    const loadProcesos = async () => {
        if (!globalActiveYear || !personaUsuariaId) return;
        try {
            setLoading(true);
            setIndexError(false);
            const data = await ProcesosService.getByPersona(globalActiveYear, personaUsuariaId);
            setProcesos(data);
        } catch (error: any) {
            console.error("Error cargando procesos:", error);
            if (error?.message?.includes('indexes?create_composite')) {
                setIndexError(error.message.split("https://console.firebase.google.com")[1]
                    ? `https://console.firebase.google.com${error.message.split("https://console.firebase.google.com")[1]}`
                    : error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProcesos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, personaUsuariaId]);

    const handleFormSaved = (saved: Proceso, isNew: boolean) => {
        if (isNew) {
            setProcesos(prev => [saved, ...prev].sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()));
        } else {
            setProcesos(prev => prev.map(p => p.id === saved.id ? saved : p));
        }
        setView('lista');
    };

    // VISTAS HIJAS
    if (view === 'formulario') {
        return (
            <div className="animate-in fade-in slide-in-from-right-4">
                <ProcesoForm
                    personaUsuariaId={personaUsuariaId}
                    initialData={selectedProceso}
                    onClose={() => setView('lista')}
                    onSaveSuccess={handleFormSaved}
                />
            </div>
        );
    }

    if (view === 'evoluciones' && selectedProceso) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4">
                {/* 
                  En la Fase 2.1 el EvolucionesManager todavía usa usuariaId,
                  pero conceptualmente las evoluciones pronto pertenecerán al Proceso.
                  Por ahora lo montamos pasándole la info de la paciente para no romper retrocompatibilidad,
                  y en las siguientes fases le pasaremos el procesoId.
                */}
                <div className="mb-4 bg-slate-50 border-l-4 border-indigo-500 p-4 rounded-r-xl">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-indigo-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-slate-700 font-medium">
                                Registrando evoluciones en: <span className="font-bold">{selectedProceso.motivoIngresoLibre}</span>
                            </p>
                        </div>
                    </div>
                </div>
                <EvolucionesManager
                    usuariaId={personaUsuariaId}
                    usuariaName={personaUsuariaName}
                    onBack={() => setView('lista')}
                />
            </div>
        );
    }

    // LISTA PRINCIPAL
    // Separamos el Activo del resto para destacarlo
    const procesosActivos = procesos.filter(p => p.estado === 'ACTIVO');
    const procesosInactivos = procesos.filter(p => p.estado !== 'ACTIVO');

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-transparent">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-400 hover:text-indigo-600 transition mb-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Ficha principal
                    </button>
                    <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Procesos Clínicos</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">{personaUsuariaName}</p>
                </div>
                <button
                    onClick={() => { setSelectedProceso(null); setView('formulario'); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 hover:shadow-indigo-200 hover:-translate-y-0.5"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Nuevo Proceso
                </button>
            </div>

            {/* Error Overlay Index Mising */}
            {indexError && (
                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm">
                    <h4 className="text-rose-800 font-bold flex items-center gap-2 mb-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                        Infrastructura de Base de Datos
                    </h4>
                    <p className="text-sm text-rose-700 leading-relaxed max-w-2xl mb-4">
                        Para poder leer y ordenar procesos de forma eficiente, el sistema requiere que generemos un "Composite Index". Por favor, haga clic en el siguiente enlace de seguridad (Demorará unos minutos en los servidores de Google):
                    </p>
                    <a
                        href={indexError}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-white hover:bg-rose-50 text-rose-700 text-sm font-semibold px-4 py-2 rounded-xl shadow-sm border border-rose-200 transition-colors"
                    >
                        <span>Crear Índice Automáticamente en Firebase</span>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    </a>
                </div>
            )}

            {loading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-4 animate-pulse">
                    <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                </div>
            ) : procesos.length === 0 && !indexError ? (
                <div className="bg-slate-50 border border-slate-200/60 border-dashed rounded-3xl p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">El expediente está en blanco</h4>
                    <p className="text-slate-500 max-w-sm">No existen procesos clínicos registrados este año. Haga clic en <span className="font-semibold text-slate-700">Nuevo Proceso</span> para comenzar la atención.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* LISTA DE PROCESOS ACTIVOS SEC */}
                    {procesosActivos.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest pl-1">Tratamientos En Curso</h4>
                            <div className="grid gap-4">
                                {procesosActivos.map(proc => (
                                    <div key={proc.id} className="group bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110 pointer-events-none"></div>

                                        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className="flex h-2 w-2 relative">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                                    </span>
                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md uppercase tracking-wide">
                                                        Atención Activa
                                                    </span>
                                                </div>
                                                <h4 className="text-xl font-bold text-slate-800 leading-snug mb-2 group-hover:text-indigo-900 transition-colors">
                                                    {proc.motivoIngresoLibre}
                                                </h4>
                                                <div className="flex items-center text-sm font-medium text-slate-500 gap-4">
                                                    <span className="flex items-center gap-1.5">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        {new Date(proc.fechaInicio).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-row md:flex-col gap-2 shrink-0">
                                                <button
                                                    onClick={() => { setSelectedProceso(proc); setView('evoluciones'); }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 flex items-center justify-center gap-2 group/btn"
                                                >
                                                    Abrir Evoluciones
                                                    <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedProceso(proc); setView('formulario'); }}
                                                    className="bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
                                                >
                                                    Detalles y Estado
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HISTÓRICO SEC */}
                    {procesosInactivos.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest pl-1">Histórico Clínico</h4>
                            <div className="grid gap-3">
                                {procesosInactivos.map(proc => (
                                    <div key={proc.id} className="bg-white border text-sm border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-slate-300">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide 
                                                    ${proc.estado === 'ALTA' ? 'bg-sky-50 text-sky-700 border border-sky-100' : ''}
                                                    ${proc.estado === 'PAUSADO' ? 'bg-amber-50 text-amber-700 border border-amber-100' : ''}
                                                    ${proc.estado === 'CERRADO_ADMIN' ? 'bg-slate-100 text-slate-600 border border-slate-200' : ''}
                                                 `}>
                                                    {proc.estado.replace('_', ' ')}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {new Date(proc.fechaInicio).toLocaleDateString()}
                                                    {proc.fechaAlta && ` → ${new Date(proc.fechaAlta).toLocaleDateString()}`}
                                                </span>
                                            </div>
                                            <p className="text-slate-700 font-medium line-clamp-2">{proc.motivoIngresoLibre}</p>
                                        </div>
                                        <div className="flex flex-row gap-2 shrink-0">
                                            <button
                                                onClick={() => { setSelectedProceso(proc); setView('evoluciones'); }}
                                                className="bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-4 py-2 border border-slate-200 rounded-lg shadow-sm transition-all"
                                            >
                                                Evoluciones
                                            </button>
                                            <button
                                                onClick={() => { setSelectedProceso(proc); setView('formulario'); }}
                                                className="bg-white hover:bg-slate-50 text-slate-500 text-xs font-semibold px-4 py-2 border border-slate-200 rounded-lg shadow-sm transition-all"
                                            >
                                                Ver Detalles
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
