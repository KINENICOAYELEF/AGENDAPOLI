import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { Evolucion } from "@/types/clinica";
import { EvolucionForm } from "@/components/EvolucionForm";

interface EvolucionesManagerProps {
    usuariaId: string;
    usuariaName: string;
    onBack: () => void;
}

export function EvolucionesManager({ usuariaId, usuariaName, onBack }: EvolucionesManagerProps) {
    const { globalActiveYear } = useYear();

    // Vistas: 'lista', 'formulario'
    const [view, setView] = useState<'lista' | 'formulario'>('lista');
    const [selectedEvolucion, setSelectedEvolucion] = useState<Evolucion | null>(null);

    // Listado Firebase
    const [evoluciones, setEvoluciones] = useState<Evolucion[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [indexError, setIndexError] = useState<string | null>(null);

    const PAGE_LIMIT = 10; // Estricto para ficha hija

    const fetchEvolucionesBatch = async (reset: boolean = false) => {
        if (!globalActiveYear || !usuariaId) return;

        try {
            setLoadingData(true);
            setIndexError(null);

            const evolucionesRef = collection(db, "programs", globalActiveYear, "evoluciones");

            // Requiere composite index en Firebase: usuariaId (Asc/Desc) + fechaHoraAtencion (Desc)
            let q = query(
                evolucionesRef,
                where("usuariaId", "==", usuariaId),
                orderBy("fechaHoraAtencion", "desc"),
                limit(PAGE_LIMIT)
            );

            if (!reset && lastDoc) {
                q = query(
                    evolucionesRef,
                    where("usuariaId", "==", usuariaId),
                    orderBy("fechaHoraAtencion", "desc"),
                    startAfter(lastDoc),
                    limit(PAGE_LIMIT)
                );
            }

            const querySnapshot = await getDocs(q);

            const fetchedList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Evolucion[];

            if (querySnapshot.docs.length < PAGE_LIMIT) {
                setHasMore(false);
            } else {
                setLastDoc(querySnapshot.docs[querySnapshot.docs.length - 1]);
                setHasMore(true);
            }

            if (reset) {
                setEvoluciones(fetchedList);
            } else {
                setEvoluciones(prev => [...prev, ...fetchedList]);
            }

        } catch (error: any) {
            console.error("Error Obteniendo Evoluciones de Persona Usuaria", error);
            // Firebase tira un link directo en el error.message si es FAILED_PRECONDITION (Falta Index)
            if (error.message && error.message.includes("indexes?create_composite")) {
                setIndexError(error.message);
            } else {
                alert("Ocurrió un error cargando las evoluciones. Revise consola.");
            }
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        setEvoluciones([]);
        setLastDoc(null);
        setHasMore(true);
        fetchEvolucionesBatch(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, usuariaId]);

    const handleNewEvolucion = () => {
        setSelectedEvolucion(null);
        setView('formulario');
    };

    const handleEditEvolucion = (evo: Evolucion) => {
        setSelectedEvolucion(evo);
        setView('formulario');
    };

    const handleFormSaved = (savedConfig: Evolucion, isNew: boolean) => {
        // En lugar de golpear Firebase, hacemos un update optimista local
        if (isNew) {
            setEvoluciones(prev => [savedConfig, ...prev]
                // Re-ordenar por fecha manual post-inserción local
                .sort((a, b) => new Date(b.fechaHoraAtencion).getTime() - new Date(a.fechaHoraAtencion).getTime())
            );
        } else {
            setEvoluciones(prev => prev.map(e => e.id === savedConfig.id ? savedConfig : e));
        }
        setView('lista');
    };

    if (view === 'formulario') {
        return (
            <div className="md:bg-white md:rounded-2xl md:p-6 md:border md:border-slate-200 md:shadow-sm animate-in fade-in slide-in-from-right-4">
                <EvolucionForm
                    usuariaId={usuariaId}
                    initialData={selectedEvolucion}
                    onClose={() => setView('lista')}
                    onSaveSuccess={handleFormSaved}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {/* Header / Nav */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-transparent border-b border-slate-100 pb-4">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-400 hover:text-indigo-600 transition mb-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Volver a Procesos Clínicos
                    </button>
                    <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">Historial de Evoluciones</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">{usuariaName}</p>
                </div>
                <button
                    onClick={() => { setSelectedEvolucion(null); setView('formulario'); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm transition-all text-sm flex items-center gap-2 hover:shadow-indigo-200 hover:-translate-y-0.5"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Registrar Sesión Diaria
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
                        Para poder leer y ordenar evoluciones de forma eficiente, el sistema requiere que generemos un "Composite Index". Por favor, haga clic en el siguiente enlace de seguridad (Demorará unos minutos en los servidores de Google):
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

            {/* Loading o Lista */}
            {loadingData ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-4 animate-pulse">
                    <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/3"></div>
                </div>
            ) : evoluciones.length === 0 && !indexError ? (
                <div className="bg-slate-50 border border-slate-200/60 border-dashed rounded-3xl p-12 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">Sin registros de evolución clínica</h4>
                    <p className="text-slate-500 max-w-sm">Esta persona usuaria no posee evoluciones clínicas bajo este proceso en el periodo activo.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {evoluciones.map(evo => (
                        <div key={evo.id} className="bg-white border text-sm border-slate-200/80 rounded-2xl overflow-hidden hover:shadow-md hover:border-indigo-300 transition-all">
                            {/* Cabecera Evo */}
                            <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                                <span className="font-medium text-slate-700 flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    {new Date(evo.fechaHoraAtencion).toLocaleString([], { dateStyle: 'long', timeStyle: 'short' })}
                                </span>
                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wide 
                                    ${evo.estado === 'CERRADA' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-700'}
                                `}>
                                    {evo.estado}
                                </span>
                            </div>

                            {/* Cuerpo Evo */}
                            <div className="p-5 flex flex-col sm:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Subjetivo inicial (SOAP)</h5>
                                        <p className="text-slate-800 leading-relaxed font-medium">{evo.objetivoSesion || "No especificado"}</p>
                                    </div>
                                    <div className="flex gap-6 mt-2">
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <span className="text-xs text-slate-400 font-semibold block mb-0.5">EVA. Inic</span>
                                            <span className="font-bold text-slate-700 text-base">{evo.dolorInicio || "-"} / 10</span>
                                        </div>
                                        <div className="bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                                            <span className="text-xs text-slate-400 font-semibold block mb-0.5">EVA. Final</span>
                                            <span className="font-bold text-slate-700 text-base">{evo.dolorSalida || "-"} / 10</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6 flex flex-col justify-center gap-3">
                                    <button
                                        onClick={() => { setSelectedEvolucion(evo); setView('formulario'); }}
                                        className="bg-white hover:bg-slate-50 text-slate-600 text-sm font-semibold px-5 py-2.5 border border-slate-200 rounded-xl shadow-sm hover:shadow transition-all whitespace-nowrap"
                                    >
                                        Ver Ficha Completa
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {hasMore && (
                        <div className="pt-4 pb-8 flex justify-center">
                            <button
                                onClick={() => fetchEvolucionesBatch(false)}
                                disabled={loadingData}
                                className="bg-white hover:bg-indigo-50 text-indigo-600 text-sm font-bold px-6 py-3 border border-indigo-200 rounded-xl shadow-sm hover:shadow-indigo-100 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loadingData && <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                                Cargar Sesiones Anteriores
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
