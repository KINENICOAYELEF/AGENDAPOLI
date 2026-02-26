"use client";

import { useState, useEffect } from "react";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { useYear } from "@/context/YearContext";
import { PersonaUsuariaForm } from "@/components/PersonaUsuariaForm";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import { PersonasUsuariasService } from "@/services/personasUsuarias";

export default function UsuariosPage() {
    const { globalActiveYear, loadingYear } = useYear();

    // Estados Ficha / Formulario
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<PersonaUsuaria | null>(null);

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
        const str = `${u.nombreCompleto} ${u.rut} ${u.telefono}`.toLowerCase();
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

    if (loadingYear) {
        return <div className="p-8 text-slate-500">Sincronizando reloj clínico...</div>;
    }

    if (!globalActiveYear) {
        return <div className="p-8 text-red-500">Error: No se encontró un periodo activo al que conectarse. Contacte al docente.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Directorio Clínico</h1>
                    <p className="text-slate-500 mt-1">
                        Universo <span className="font-semibold text-slate-700 bg-slate-100 px-2 rounded">{globalActiveYear}</span> — Archivo y control de pacientes (Personas Usuarias).
                    </p>
                </div>
                <button
                    onClick={() => { setSelectedUser(null); setIsFormOpen(true); }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition"
                >
                    + Crear Nuevo Ingreso
                </button>
            </div>

            {/* TABLA MASTER / DASHBOARD */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">

                {/* TOOLBAR */}
                <div className="border-b border-slate-200 p-4 bg-slate-50 flex items-center gap-4">
                    <div className="relative flex-1 max-w-md">
                        <svg className="absolute left-3 top-3 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input
                            type="text"
                            placeholder="Buscar localmente por Nombre, RUT o Teléfono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                        />
                    </div>
                    {searchTerm.length > 0 && (
                        <span className="text-xs text-amber-600 font-medium px-2 py-1 bg-amber-50 rounded border border-amber-200">
                            Filtro offline activado (Sólo resultados del lote actúal)
                        </span>
                    )}
                </div>

                {/* TABLA CONTENIDO */}
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                            <tr>
                                <th className="px-6 py-4 border-b border-slate-200">Paciente</th>
                                <th className="px-6 py-4 border-b border-slate-200">Identificador (RUT)</th>
                                <th className="px-6 py-4 border-b border-slate-200">Contacto</th>
                                <th className="px-6 py-4 border-b border-slate-200 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 && !loadingData && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                        No se encontraron personas usuarias registradas en este espacio temporal.
                                    </td>
                                </tr>
                            )}

                            {filteredUsers.map((u) => (
                                <tr key={u.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{u.nombreCompleto}</div>
                                        <div className="text-xs text-slate-500 truncate max-w-[200px]">{u.notasAdministrativas || 'Sin observaciones'}</div>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-600">{u.rut}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-slate-700">{u.telefono || 'No registrado'}</div>
                                        <div className="text-xs text-slate-400">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => { setSelectedUser(u); setIsFormOpen(true); }}
                                            className="text-indigo-600 hover:text-indigo-900 font-medium text-sm bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded transition"
                                        >
                                            Ver Ficha Clínica
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)}></div>

                    {/* Panel principal Modal */}
                    <div className="relative bg-white shadow-2xl rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                        {/* Header Modal */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    {selectedUser ? "Expediente Clínico" : "Nuevo Ingreso"}
                                </h2>
                                {selectedUser && (
                                    <p className="text-xs text-slate-500 font-mono mt-1">ID: {selectedUser.id}</p>
                                )}
                            </div>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600 p-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        {/* Contenido Modal Scrollable */}
                        <div className="overflow-y-auto p-6 flex-1 bg-white">
                            <PersonaUsuariaForm
                                initialData={selectedUser}
                                onClose={() => setIsFormOpen(false)}
                                onSaveSuccess={handleUserSaved}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
