"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { useYear } from "@/context/YearContext";
import { PersonaUsuariaForm } from "@/components/PersonaUsuariaForm";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import { PersonasUsuariasService } from "@/services/personasUsuarias";

function SearchParamsHandler({ onOpenFicha }: { onOpenFicha: (id: string, action?: string) => void }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const openFicha = searchParams.get('openFicha');
    const action = searchParams.get('action');

    useEffect(() => {
        if (openFicha) {
            onOpenFicha(openFicha, action || undefined);
            // Replace url to clean up the query param without full refresh
            router.replace('/app/usuarios');
        }
    }, [openFicha, action, onOpenFicha, router]);

    return null;
}

export default function UsuariosPage() {
    const { globalActiveYear, loadingYear } = useYear();

    // Estados Ficha / Formulario
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PersonaUsuaria | null>(null);
    const [initialAction, setInitialAction] = useState<string | undefined>(undefined);

    // Lista y Paginación
    const [personasUsuarias, setPersonasUsuarias] = useState<PersonaUsuaria[]>([]);
    const [loadingData, setLoadingData] = useState(false);
    const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
    const [hasMore, setHasMore] = useState(true);

    // Búsqueda en array de memoria
    const [searchTerm, setSearchTerm] = useState("");

    // PAGE SIZE SEGURO PARA FIRESTORE (Ahorra reads locales)
    const PAGE_LIMIT = 20;

    // ----- MOTOR DE CONSULTA PROTEGIDO VÍA DATA ACCESS -----
    const fetchUsuariosBatch = async (reset: boolean = false) => {
        if (!globalActiveYear) return;

        try {
            setLoadingData(true);

            const response = await PersonasUsuariasService.getPaginated(
                globalActiveYear,
                reset ? null : lastDoc
            );

            setLastDoc(response.lastDoc);
            setHasMore(response.hasMore);

            if (reset) {
                setPersonasUsuarias(response.data);
            } else {
                setPersonasUsuarias(prev => [...prev, ...response.data]);
            }

        } catch (error) {
            console.error("Error Obteniendo Personas Usuarias", error);
            alert("Ocurrió un error cargando el listado. Puede ser problema de red o falta de índice en Firebase.");
        } finally {
            setLoadingData(false);
        }
    };

    // ----- EFECTO INICIAL (Trigger) -----
    // Solo dispara en el mount inicial y/o cuando cambian radicalmente de Year.
    // Ignora si está tecleando (SearchTerm)
    useEffect(() => {
        if (!loadingYear && globalActiveYear) {
            setPersonasUsuarias([]);
            setLastDoc(null);
            setHasMore(true);
            fetchUsuariosBatch(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, loadingYear]);

    // ----- BÚSQUEDA LOCAL OFFLINE -----
    // Usamos el listado ya descargado guardado en estado, previniendo GASTAR FIREBASE.
    // Para búsquedas absolutas pesadas habría que conectarse (algolia, meilisearch).
    const filteredUsers = personasUsuarias.filter(u => {
        const anyU = u as any;
        const nom = u.identity?.fullName || anyU.nombreCompleto || "";
        const iden = u.identity?.rut || anyU.rut || "";
        const tel = u.identity?.telefono || anyU.telefono || "";
        const str = `${nom} ${iden} ${tel}`.toLowerCase();
        return str.includes(searchTerm.toLowerCase());
    });

    const handleUserSaved = (savedUser: PersonaUsuaria, isNew: boolean) => {
        setIsFormOpen(false);
        if (isNew) {
            // Lo insertamos artificialmente al principio del arreglo en memoria para evitar resfrescar la base de datos
            setPersonasUsuarias(prev => [savedUser, ...prev]);
        } else {
            // Actualizamos en memoria
            setPersonasUsuarias(prev => prev.map(u => u.id === savedUser.id ? savedUser : u));
        }
    };

    const handleOpenFichaFromUrl = useCallback(async (id: string, action?: string) => {
        if (!globalActiveYear) return;
        
        // Try memory first
        setLoadingData(true);
        try {
            const userInMem = personasUsuarias.find(u => u.id === id);
            if (userInMem) {
                setSelectedUser(userInMem);
                setInitialAction(action);
                setIsFormOpen(true);
                return;
            }

            // Force dynamic load
            const fetched = await PersonasUsuariasService.getById(globalActiveYear, id);
            if (fetched) {
                // Insert silently into memory so it renders in the table when closing the modal
                setPersonasUsuarias(prev => {
                    if (!prev.find(u => u.id === fetched.id)) {
                        return [fetched, ...prev];
                    }
                    return prev;
                });
                setSelectedUser(fetched);
                setInitialAction(action);
                setIsFormOpen(true);
            }
        } catch (e) {
            console.error("Excepción auto-abriendo ficha", e);
        } finally {
            setLoadingData(false);
        }
    }, [globalActiveYear, personasUsuarias]);

    if (loadingYear) {
        return <div className="p-8 text-slate-500">Sincronizando reloj clínico...</div>;
    }

    if (!globalActiveYear) {
        return <div className="p-8 text-red-500">Error: No se encontró un periodo activo al que conectarse. Contacte al docente.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-2">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Directorio Clínico</h1>
                    <p className="text-slate-500 mt-2 text-sm sm:text-base leading-relaxed">
                        Universo <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{globalActiveYear}</span> — Archivo y control de pacientes (Personas Usuarias).
                    </p>
                </div>
                <button
                    onClick={() => { setSelectedUser(null); setIsFormOpen(true); }}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-sm transition hover:shadow-md min-h-[44px] flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Añadir Nuevo Ingreso
                </button>
            </div>

            <Suspense fallback={null}>
                <SearchParamsHandler onOpenFicha={handleOpenFichaFromUrl} />
            </Suspense>

            {/* MASTER CONTAINER / DASHBOARD */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">

                {/* TOOLBAR */}
                <div className="border-b border-slate-100 p-4 sm:p-5 bg-white flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <svg className="absolute left-3.5 top-3 h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar por Nombre, RUT o Teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100 focus:bg-white rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm transition-all"
                        />
                    </div>
                </div>

                {/* AREA DE CONTENIDO */}
                <div className="flex-1 bg-slate-50/50">

                    {/* ESTADO VACÍO (Ambos Viewports) */}
                    {filteredUsers.length === 0 && !loadingData && (
                        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                            <div className="bg-slate-100 p-4 rounded-full mb-4">
                                <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-1">Directorio vacío</h3>
                            <p className="text-slate-500 max-w-sm">No se encontraron personas usuarias registradas en este espacio temporal.</p>
                        </div>
                    )}

                    {/* VISTA MÓVIL (Tarjetas) */}
                    <div className="block md:hidden p-4 space-y-4">
                        {filteredUsers.map((u) => (
                            <div key={u.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-slate-900 text-lg leading-tight">{u.identity?.fullName || (u as any).nombreCompleto}</h3>
                                        <span className="inline-block mt-1 bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-1 rounded-md border border-slate-200">
                                            RUT: {u.identity?.rut || (u as any).rut || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                        <span className="truncate">{u.identity?.telefono || (u as any).telefono || 'No registrado'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded-lg">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        <span className="truncate">Asignado: {u.meta?.assignedInternName || 'Sin asignar'}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                    className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium rounded-xl transition"
                                >
                                    Abrir Expediente
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* VISTA DESKTOP (Tabla Optimizada) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-white text-slate-500 uppercase text-xs font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-5">Identidad Paciente</th>
                                    <th className="px-6 py-5">Identificador (RUT)</th>
                                    <th className="px-6 py-5">Contacto</th>
                                    <th className="px-6 py-5">Asignación</th>
                                    <th className="px-6 py-5 text-right w-32">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900">{u.identity?.fullName || (u as any).nombreCompleto}</div>
                                            <div className="text-xs text-slate-500 truncate max-w-[200px] mt-0.5">{u.identity?.observacionesAdministrativas || (u as any).notasAdministrativas || 'Sin observaciones base'}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200">{u.identity?.rut || (u as any).rut || 'N/A'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-700 flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                                {u.identity?.telefono || (u as any).telefono || 'N/A'}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                                {u.identity?.correo || (u as any).email || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${u.meta?.assignedInternId ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                                                <span className={`text-xs font-bold ${u.meta?.assignedInternId ? 'text-indigo-700' : 'text-slate-400 italic'}`}>
                                                    {u.meta?.assignedInternName || 'Sin asignar'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                                className="text-indigo-600 hover:text-indigo-800 font-medium text-sm bg-indigo-50/50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-100 shadow-sm"
                                            >
                                                Abrir Expediente
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* PAGINATION FOOTER */}
                <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-center items-center">
                    {loadingData ? (
                        <span className="text-sm font-medium text-slate-500 animate-pulse flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Descargando más legajos clínicos...
                        </span>
                    ) : hasMore && searchTerm.length === 0 ? (
                        <button
                            onClick={() => fetchUsuariosBatch(false)}
                            className="text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 px-6 py-2 rounded-full shadow-sm transition"
                        >
                            Cargar siguientes {PAGE_LIMIT} registros ↓
                        </button>
                    ) : (searchTerm.length === 0 && personasUsuarias.length > 0) ? (
                        <span className="text-sm text-slate-400">Has llegado al final del archivo ({personasUsuarias.length} personas usuarias en total).</span>
                    ) : null}
                </div>
            </div>

            {/* OVERLAY: FORMULARIO Y FICHA DE PERSONA USUARIA */}
            {/* Construiremos un modal flotante o una vista lateral para aislar el CRUD del dashboard maestro */}
            {isFormOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-6">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsFormOpen(false)}></div>

                    {/* Panel principal Modal (Bottom Sheet en móvil, Modal centrado en Desktop) */}
                    <div className="relative bg-white shadow-2xl w-full h-[95vh] sm:h-auto sm:max-h-[90vh] rounded-t-3xl sm:rounded-2xl max-w-4xl flex flex-col overflow-hidden animate-slide-up sm:animate-zoom-in">

                        {/* Drag Handle (Sólo móvil) */}
                        <div className="w-full flex justify-center py-3 pb-1 sm:hidden">
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
                        </div>

                        {/* Header Modal */}
                        <div className="px-5 sm:px-6 py-4 flex justify-between items-center bg-white border-b border-slate-100">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">
                                    {selectedUser ? "Expediente Clínico" : "Nuevo Ingreso"}
                                </h2>
                                {selectedUser && (
                                    <p className="text-xs text-slate-400 font-mono mt-0.5">ID: {selectedUser.id}</p>
                                )}
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Contenido Modal Scrollable */}
                        <div className="overflow-y-auto p-5 sm:p-6 flex-1 bg-slate-50/30">
                            <PersonaUsuariaForm
                                initialData={selectedUser}
                                initialAction={initialAction}
                                onClose={() => { setIsFormOpen(false); setInitialAction(undefined); }}
                                onSaveSuccess={handleUserSaved}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
