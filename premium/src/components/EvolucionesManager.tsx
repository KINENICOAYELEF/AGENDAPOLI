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
            <div className="bg-white rounded p-4 border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
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
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">

            {/* Toolbar Evoluciones */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition mb-1 flex items-center gap-1">
                        <span>← Volver a Ficha Administrativa</span>
                    </button>
                    <h3 className="text-lg font-bold text-slate-800">Historial de Evoluciones</h3>
                    <p className="text-xs text-slate-500">Paciente: <span className="font-semibold">{usuariaName}</span></p>
                </div>
                <button
                    onClick={handleNewEvolucion}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm flex items-center gap-2"
                >
                    + Registrar Sesión Diaria
                </button>
            </div>

            {/* Error Index Missing (Típico primera ejecución) */}
            {indexError && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
                    <h4 className="font-bold border-b border-red-200 pb-1 mb-2">Se requiere accionar Infraestructura Firebase</h4>
                    <p className="text-sm mb-2">Para poder leer y ordenar evoluciones sin que colapse la base de datos, Google Firestore requiere que autoricemos un "Composite Index". Por favor, haga clic en el siguiente enlace de seguridad para crearlo (tardará unos minutos en generarse en los servidores):</p>
                    <a href={indexError.split("Here's a link to create it: ")[1]} target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-medium hover:underline break-all text-xs">
                        👉 Enlace de Creación de Índice Firestore 👈
                    </a>
                </div>
            )}

            {/* Listado Grilla */}
            {!indexError && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {evoluciones.length === 0 && !loadingData && (
                        <div className="p-8 text-center text-slate-400 font-medium">
                            Esta persona usuaria no posee evoluciones clínicas registradas históricamente para el año activo.
                        </div>
                    )}

                    <div className="divide-y divide-slate-100">
                        {evoluciones.map(evo => (
                            <div key={evo.id} onClick={() => handleEditEvolucion(evo)} className="p-4 hover:bg-slate-50 transition cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${evo.estado === 'CERRADA' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                            {evo.estado}
                                        </span>
                                        <span className="text-sm font-semibold text-slate-800">
                                            {new Date(evo.fechaHoraAtencion).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                                        </span>
                                        {evo._migratedFromLegacy && (
                                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200" title="Volcado Histórico">Migración</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600 font-medium line-clamp-1 group-hover:text-indigo-700 transition">OP: {evo.objetivoSesion || 'Sin Objetivo (En blanco)'}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">Autor(a): {evo.autorName}</p>
                                </div>
                                <div className="flex sm:flex-col items-center sm:items-end gap-2 text-xs">
                                    <div className="flex gap-2">
                                        <div className="bg-slate-100 px-2 py-1 rounded">EVA In: <span className="font-bold text-slate-700">{evo.dolorInicio === "" ? "-" : evo.dolorInicio}</span></div>
                                        <div className="bg-slate-100 px-2 py-1 rounded">EVA Out: <span className="font-bold text-slate-700">{evo.dolorSalida === "" ? "-" : evo.dolorSalida}</span></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Pagination Button */}
                    <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-center">
                        {loadingData ? (
                            <span className="text-xs font-medium text-slate-500 animate-pulse">Consultando historial en lotes reducidos...</span>
                        ) : hasMore ? (
                            <button
                                onClick={() => fetchEvolucionesBatch(false)}
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-full transition"
                            >
                                Descargar anteriores {PAGE_LIMIT}... ↓
                            </button>
                        ) : (evoluciones.length > 0) ? (
                            <span className="text-xs text-slate-400">Fin del registro evolutivo ({evoluciones.length}).</span>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
