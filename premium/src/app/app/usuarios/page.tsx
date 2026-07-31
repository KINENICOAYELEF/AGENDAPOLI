"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { PersonaUsuariaForm } from "@/components/PersonaUsuariaForm";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import { PersonasUsuariasService } from "@/services/personasUsuarias";

function SearchParamsHandler({ onOpenFicha }: { onOpenFicha: (id: string, params?: Record<string, string>) => void }) {
    const searchParams = useSearchParams();
    const openFicha = searchParams.get('openFicha');
    const action = searchParams.get('action') || undefined;
    const procesoId = searchParams.get('procesoId') || undefined;
    const recordId = searchParams.get('recordId') || undefined;
    const recordType = searchParams.get('recordType') || undefined;
    const returnTo = searchParams.get('returnTo') || undefined;

    useEffect(() => {
        if (openFicha) {
            onOpenFicha(openFicha, {
                action: action || '',
                procesoId: procesoId || '',
                recordId: recordId || '',
                recordType: recordType || '',
                returnTo: returnTo || ''
            });
        }
    }, [openFicha, action, procesoId, recordId, recordType, returnTo, onOpenFicha]);

    return null;
}

export default function UsuariosPage() {
    const { globalActiveYear, loadingYear } = useYear();
    const { user } = useAuth();
    const canDelete = user?.role === 'DOCENTE';

    // Estados Ficha / Formulario
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PersonaUsuaria | null>(null);
    const [initialAction, setInitialAction] = useState<string | undefined>(undefined);
    const [initialRecordParams, setInitialRecordParams] = useState<Record<string, string> | undefined>(undefined);

    // Lista completa (FASE 70: sin paginación para evitar bug de usuarios invisibles)
    const [personasUsuarias, setPersonasUsuarias] = useState<PersonaUsuaria[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Búsqueda en array de memoria
    const [searchTerm, setSearchTerm] = useState("");

    // ----- MOTOR DE CONSULTA — CARGA COMPLETA (FASE 70) -----
    const fetchUsuarios = async () => {
        if (!globalActiveYear) return;

        try {
            setLoadingData(true);

            const response = await PersonasUsuariasService.getPaginated(
                globalActiveYear,
                null
            );

            setPersonasUsuarias(response.data);

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
            fetchUsuarios();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, loadingYear]);

    // Búsqueda local offline de todos los usuarios
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

    const handleDeleteUser = async (userId: string, userName: string) => {
        if (!globalActiveYear || !canDelete) return;
        if (!confirm(`¿Estás seguro de eliminar permanentemente a "${userName}"?\n\nEsta acción NO se puede deshacer.`)) return;
        if (!confirm(`ÚLTIMA CONFIRMACIÓN: Se eliminará "${userName}" y todos sus datos del sistema. ¿Continuar?`)) return;

        try {
            await PersonasUsuariasService.deleteById(globalActiveYear, userId);
            setPersonasUsuarias(prev => prev.filter(u => u.id !== userId));
            alert(`"${userName}" ha sido eliminada del sistema.`);
        } catch (error) {
            console.error("Error eliminando persona usuaria", error);
            alert("Error al eliminar. Verifique permisos de Firestore.");
        }
    };

    const handleOpenFichaFromUrl = useCallback(async (id: string, params?: Record<string, string>) => {
        const action = params?.action;
        setInitialRecordParams(params);
        
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

                    {/* VISTA MOBILE (Tarjetas Clickeables) */}
                    <div className="block md:hidden p-4 space-y-4">
                        {filteredUsers.map((u) => {
                            const isMyPatient = user?.uid && (u.meta?.assignedInternId === user.uid || (u as any).primaryInternUid === user.uid || (u as any).assignedInternId === user.uid);
                            return (
                                <div 
                                    key={u.id} 
                                    onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                    className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all cursor-pointer active:scale-[0.99]"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-base leading-snug">{u.identity?.fullName || (u as any).nombreCompleto}</h3>
                                            <span className="inline-block mt-1 bg-slate-100 text-slate-600 font-mono text-xs px-2.5 py-0.5 rounded-md border border-slate-200">
                                                RUT: {u.identity?.rut || (u as any).rut || 'N/A'}
                                            </span>
                                        </div>
                                        {isMyPatient ? (
                                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-[11px] px-2.5 py-1 rounded-lg shrink-0 flex items-center gap-1">
                                                <span>👤</span> Mi Paciente
                                            </span>
                                        ) : u.meta?.assignedInternName ? (
                                            <span className="bg-slate-100 text-slate-600 text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0 truncate max-w-[120px]">
                                                {u.meta.assignedInternName}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="space-y-1.5 mb-4 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                            <span className="truncate">{u.identity?.telefono || (u as any).telefono || 'No registrado'}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                            className="min-h-[40px] flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                                        >
                                            Abrir Expediente
                                        </button>
                                        <button
                                            onClick={() => { setSelectedUser(u); setInitialAction('EVOLUCIONAR'); setIsFormOpen(true); }}
                                            className="min-h-[40px] flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
                                        >
                                            <span>⚡ + Evolucionar</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* VISTA DESKTOP (Tabla Clickeable Optimizada) */}
                    <div className="hidden md:block overflow-x-auto w-full border-t border-slate-200/80">
                        <table className="w-full text-left text-sm min-w-[850px]">
                            <thead className="bg-slate-50/70 text-slate-500 uppercase text-[11px] font-bold tracking-wider border-b border-slate-200">
                                <tr>
                                    <th className="px-5 py-4 w-2/5">Identidad Paciente</th>
                                    <th className="px-4 py-4 w-1/5">Identificador (RUT)</th>
                                    <th className="px-4 py-4 w-1/5">Contacto</th>
                                    <th className="px-4 py-4 w-1/5">Asignación</th>
                                    <th className="px-5 py-4 text-right shrink-0">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {filteredUsers.map((u) => {
                                    const isMyPatient = user?.uid && (u.meta?.assignedInternId === user.uid || (u as any).primaryInternUid === user.uid || (u as any).assignedInternId === user.uid);
                                    return (
                                        <tr 
                                            key={u.id} 
                                            onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                            className="hover:bg-indigo-50/40 transition-colors cursor-pointer group"
                                        >
                                            <td className="px-5 py-4">
                                                <div className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors leading-snug">{u.identity?.fullName || (u as any).nombreCompleto}</div>
                                                <div className="text-xs text-slate-400 line-clamp-1 mt-0.5">{u.identity?.observacionesAdministrativas || (u as any).notasAdministrativas || 'Sin observaciones base'}</div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <span className="font-mono text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 text-xs">{u.identity?.rut || (u as any).rut || 'N/A'}</span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="text-slate-700 text-xs flex items-center gap-1.5 whitespace-nowrap">
                                                    <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                                    {u.identity?.telefono || (u as any).telefono || 'N/A'}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5 truncate max-w-[160px]">
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                                    {u.identity?.correo || (u as any).email || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                {isMyPatient ? (
                                                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold text-xs px-2.5 py-1 rounded-lg shrink-0 whitespace-nowrap">
                                                        <span>👤</span> Mi Paciente
                                                    </span>
                                                ) : u.meta?.assignedInternName ? (
                                                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg truncate max-w-[140px] inline-block">
                                                        {u.meta.assignedInternName}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs italic text-slate-400">Sin asignar</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => { setSelectedUser(u); setInitialAction('EVOLUCIONAR'); setIsFormOpen(true); }}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 shrink-0"
                                                        title="Evolucionar sesión de este paciente"
                                                    >
                                                        <span>⚡ + Evolucionar</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                                        className="text-slate-700 hover:text-indigo-700 font-semibold text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition border border-slate-200 shrink-0"
                                                    >
                                                        Expediente
                                                    </button>
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u.id!, u.identity?.fullName || (u as any).nombreCompleto || 'Sin nombre')}
                                                            className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-100 shrink-0"
                                                            title={`Eliminar a ${u.identity?.fullName || 'esta persona'}`}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* FOOTER CON CONTEO */}
                <div className="border-t border-slate-200 bg-slate-50 p-4 flex justify-center items-center">
                    {loadingData ? (
                        <span className="text-sm font-medium text-slate-500 animate-pulse flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Cargando directorio clínico...
                        </span>
                    ) : personasUsuarias.length > 0 ? (
                        <span className="text-sm text-slate-400">{filteredUsers.length === personasUsuarias.length ? `${personasUsuarias.length} personas usuarias registradas.` : `Mostrando ${filteredUsers.length} de ${personasUsuarias.length} personas usuarias.`}</span>
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
                                initialRecordParams={initialRecordParams}
                                onClose={() => { setIsFormOpen(false); setInitialAction(undefined); setInitialRecordParams(undefined); }}
                                onSaveSuccess={handleUserSaved}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
