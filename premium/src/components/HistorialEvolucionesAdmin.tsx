"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { Evolucion } from "@/types/clinica";
import { PersonasUsuariasService } from "@/services/personasUsuarias";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import Link from "next/link";

interface InternUser {
    id: string;
    displayName?: string;
    email?: string;
    role?: string;
}

export function HistorialEvolucionesAdmin() {
    const { user } = useAuth();
    const { globalActiveYear } = useYear();

    const [evoluciones, setEvoluciones] = useState<Evolucion[]>([]);
    const [internos, setInternos] = useState<InternUser[]>([]);
    const [pacientesMap, setPacientesMap] = useState<Record<string, PersonaUsuaria>>({});
    const [loading, setLoading] = useState<boolean>(true);

    // Filtros
    const [selectedInternoId, setSelectedInternoId] = useState<string>("ALL");
    const [selectedStatus, setSelectedStatus] = useState<"ALL" | "CLOSED" | "DRAFT">("ALL");
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [timeRange, setTimeRange] = useState<"ALL" | "7DAYS" | "30DAYS">("ALL");
    const [sortDirection, setSortDirection] = useState<"DESC" | "ASC">("DESC");
    // Limit de visualización incremental para rendimiento (Paginación suave)
    const [displayLimit, setDisplayLimit] = useState<number>(25);

    // Modal de Vista Detallada de Evolución
    const [detailModalEvol, setDetailModalEvol] = useState<Evolucion | null>(null);

    useEffect(() => {
        if (!globalActiveYear || user?.role !== "DOCENTE") return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // 1. Cargar todas las evoluciones del año activo
                const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");
                const evolsSnap = await getDocs(evolsRef);
                const loadedEvols: Evolucion[] = evolsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Evolucion));

                setEvoluciones(loadedEvols);

                // 2. Cargar todos los usuarios (para mapear UIDs a nombres de Internos)
                const usersRef = collection(db, "users");
                const usersSnap = await getDocs(usersRef);
                const loadedUsers: InternUser[] = usersSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as InternUser));

                setInternos(loadedUsers);

                // 3. Cargar diccionario de Personas Usuarias (Pacientes)
                const pacientesList = await PersonasUsuariasService.getPaginated(globalActiveYear);
                const map: Record<string, PersonaUsuaria> = {};
                pacientesList.data.forEach(p => {
                    if (p.id) map[p.id] = p;
                });
                setPacientesMap(map);

            } catch (err) {
                console.error("Error al cargar historial de evoluciones para admin:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [globalActiveYear, user?.role]);

    // Mapeo auxiliar de usuarios para búsqueda rápida por ID o nombre
    const userDict = useMemo(() => {
        const dict: Record<string, InternUser> = {};
        internos.forEach(u => {
            dict[u.id] = u;
        });
        return dict;
    }, [internos]);

    // Lista de internos únicos que han registrado evoluciones
    const internosConEvoluciones = useMemo(() => {
        const mapCount: Record<string, { user: InternUser, count: number }> = {};

        evoluciones.forEach(ev => {
            // Se busca por audit.createdBy o clinicianResponsible o internoAtendioId
            const authorUid = ev.audit?.createdBy || ev.clinicianResponsible;
            const foundUser = userDict[authorUid] || internos.find(i => i.displayName === ev.clinicianResponsible || i.email === ev.clinicianResponsible);
            
            const key = foundUser?.id || ev.clinicianResponsible || "Desconocido";
            if (!mapCount[key]) {
                mapCount[key] = {
                    user: foundUser || { id: key, displayName: ev.clinicianResponsible || "Autor Desconocido" },
                    count: 0
                };
            }
            mapCount[key].count += 1;
        });

        return Object.values(mapCount);
    }, [evoluciones, internos, userDict]);

    // Filtrado y Ordenamiento Dinámico
    const filteredEvoluciones = useMemo(() => {
        return evoluciones.filter(ev => {
            // Filtro por Estado (CLOSED vs DRAFT)
            if (selectedStatus !== "ALL" && ev.status !== selectedStatus) return false;

            // Filtro por Interno seleccionado
            if (selectedInternoId !== "ALL") {
                const authorUid = ev.audit?.createdBy;
                const authorName = ev.clinicianResponsible;
                const isMatch = authorUid === selectedInternoId || 
                                authorName === selectedInternoId || 
                                (userDict[selectedInternoId] && (authorName === userDict[selectedInternoId].displayName || authorName === userDict[selectedInternoId].email));
                if (!isMatch) return false;
            }

            // Filtro por Rango de Fechas
            if (timeRange !== "ALL") {
                const dateVal = new Date(ev.sessionAt || ev.audit?.createdAt || (ev as any).createdAt || 0).getTime();
                const now = Date.now();
                const daysLimit = timeRange === "7DAYS" ? 7 : 30;
                if (now - dateVal > daysLimit * 24 * 60 * 60 * 1000) return false;
            }

            // Filtro por Búsqueda de Texto (Paciente, RUT, Diagnóstico, Próximo Plan)
            if (searchQuery.trim() !== "") {
                const queryLower = searchQuery.toLowerCase().trim();
                const paciente = pacientesMap[ev.usuariaId];
                const pacienteNombre = (paciente?.identity?.fullName || `${(paciente as any)?.nombres || ''} ${(paciente as any)?.apellidos || ''}`).toLowerCase();
                const pacienteRut = (paciente?.identity?.rut || (paciente as any)?.rut || "").toLowerCase();
                const autor = (ev.clinicianResponsible || "").toLowerCase();
                const objetivo = (ev.sessionGoal || "").toLowerCase();
                const plan = (ev.nextPlan || "").toLowerCase();
                const handoff = (ev.handoffText || "").toLowerCase();

                const matchesText = pacienteNombre.includes(queryLower) ||
                                    pacienteRut.includes(queryLower) ||
                                    autor.includes(queryLower) ||
                                    objetivo.includes(queryLower) ||
                                    plan.includes(queryLower) ||
                                    handoff.includes(queryLower);

                if (!matchesText) return false;
            }

            return true;
        }).sort((a, b) => {
            const timeA = new Date(a.sessionAt || a.audit?.createdAt || (a as any).createdAt || 0).getTime();
            const timeB = new Date(b.sessionAt || b.audit?.createdAt || (b as any).createdAt || 0).getTime();
            return sortDirection === "DESC" ? timeB - timeA : timeA - timeB;
        });
    }, [evoluciones, selectedStatus, selectedInternoId, timeRange, searchQuery, sortDirection, pacientesMap, userDict]);

    // Estadísticas Métricas
    const stats = useMemo(() => {
        const total = evoluciones.length;
        const closed = evoluciones.filter(e => e.status === "CLOSED").length;
        const drafts = evoluciones.filter(e => e.status === "DRAFT").length;
        const now = Date.now();
        const last7DaysCount = evoluciones.filter(e => {
            const t = new Date(e.sessionAt || e.audit?.createdAt || 0).getTime();
            return (now - t) <= 7 * 24 * 60 * 60 * 1000;
        }).length;

        return { total, closed, drafts, last7DaysCount };
    }, [evoluciones]);

    const formatRelativeTime = (isoString?: string) => {
        if (!isoString) return "Sin fecha";
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;

        const diffMinutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
        if (diffMinutes < 1) return "Hace un momento";
        if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `Hace ${diffHours} h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return "Ayer";
        if (diffDays < 7) return `Hace ${diffDays} días`;

        return date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    if (user?.role !== "DOCENTE") return null;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-8">
            {/* Header del Panel */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-5 border-b border-slate-800 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight">Historial Auditado de Evoluciones Clínicas</h2>
                            <p className="text-slate-400 text-xs">Supervisión docente de evoluciones por interno en el universo <span className="text-indigo-300 font-bold">{globalActiveYear}</span></p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSortDirection(prev => prev === "DESC" ? "ASC" : "DESC")}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition border border-slate-700 flex items-center gap-1.5"
                        title="Cambiar orden de clasificación"
                    >
                        <span>{sortDirection === "DESC" ? "Más Reciente Primero ↓" : "Más Antiguo Primero ↑"}</span>
                    </button>
                </div>
            </div>

            {/* Tarjetas Métricas Rápidas */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 border-b border-slate-100 bg-slate-50/50">
                <div className="p-4 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Evoluciones</span>
                    <p className="text-2xl font-black text-slate-800 mt-1">{stats.total}</p>
                </div>
                <div className="p-4 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Firmadas (CLOSED)</span>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{stats.closed}</p>
                </div>
                <div className="p-4 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Borradores (DRAFT)</span>
                    <p className="text-2xl font-black text-amber-700 mt-1">{stats.drafts}</p>
                </div>
                <div className="p-4 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Últimos 7 Días</span>
                    <p className="text-2xl font-black text-indigo-700 mt-1">{stats.last7DaysCount}</p>
                </div>
            </div>

            {/* Barra de Filtros */}
            <div className="p-5 bg-white border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Selector por Interno */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Filtrar por Interno:</label>
                    <select
                        value={selectedInternoId}
                        onChange={(e) => setSelectedInternoId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                    >
                        <option value="ALL">👥 Todos los Internos ({internosConEvoluciones.length})</option>
                        {internosConEvoluciones.map(item => (
                            <option key={item.user.id} value={item.user.id}>
                                👤 {item.user.displayName || item.user.email || item.user.id} ({item.count} evols)
                            </option>
                        ))}
                    </select>
                </div>

                {/* Selector por Estado */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Estado de Firma:</label>
                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                    >
                        <option value="ALL">📌 Todos los Estados</option>
                        <option value="CLOSED">✅ Solo Firmadas (CLOSED)</option>
                        <option value="DRAFT">📝 Solo Borradores (DRAFT)</option>
                    </select>
                </div>

                {/* Selector de Rango Temporal */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Rango de Tiempo:</label>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                    >
                        <option value="ALL">📅 Todo el Historial</option>
                        <option value="7DAYS">⚡ Últimos 7 Días</option>
                        <option value="30DAYS">📆 Últimos 30 Días</option>
                    </select>
                </div>

                {/* Búsqueda por Texto Libre */}
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wider">Buscar por Paciente/Texto:</label>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Nombre paciente, RUT, objetivo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:bg-white transition outline-none"
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Listado de Evoluciones */}
            <div className="p-6">
                {loading ? (
                    <div className="py-12 text-center text-slate-500 space-y-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p className="text-sm font-medium">Cargando trazabilidad de evoluciones del universo {globalActiveYear}...</p>
                    </div>
                ) : filteredEvoluciones.length === 0 ? (
                    <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                        <p className="text-base font-bold text-slate-700">No se encontraron evoluciones con los filtros aplicados</p>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">Intenta cambiando los filtros de interno, estado o ajustando el texto de búsqueda.</p>
                        <button
                            onClick={() => { setSelectedInternoId("ALL"); setSelectedStatus("ALL"); setTimeRange("ALL"); setSearchQuery(""); }}
                            className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition"
                        >
                            Limpiar Filtros
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-500 px-1">
                            <span>Mostrando {Math.min(displayLimit, filteredEvoluciones.length)} de {filteredEvoluciones.length} evoluciones</span>
                            <span>Ordenado de {sortDirection === "DESC" ? "más reciente a más antiguo" : "más antiguo a más reciente"}</span>
                        </div>

                        {/* Ventana de desplazamiento interno con altura fija para evitar desbordar la página */}
                        <div className="max-h-[580px] overflow-y-auto pr-2 space-y-4 border border-slate-100 p-2 rounded-2xl bg-slate-50/40">
                            {filteredEvoluciones.slice(0, displayLimit).map((ev) => {
                                const paciente = pacientesMap[ev.usuariaId];
                                const pacienteNombre = paciente?.identity?.fullName || `${(paciente as any)?.nombres || ''} ${(paciente as any)?.apellidos || ''}`.trim() || "Usuaria Desconocida";
                                const pacienteRut = paciente?.identity?.rut || (paciente as any)?.rut || "Sin RUT";
                                const isClosed = ev.status === "CLOSED";
                                const isoDate = ev.sessionAt || ev.audit?.createdAt || (ev as any).createdAt || "";
                                const displayDate = isoDate ? new Date(isoDate).toLocaleDateString("es-CL", {
                                    weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                                }) : "Fecha no especificada";

                                return (
                                    <div
                                        key={ev.id}
                                        className={`rounded-2xl border transition-all hover:shadow-md ${
                                            isClosed 
                                                ? "bg-white border-slate-200 hover:border-indigo-300" 
                                                : "bg-amber-50/30 border-amber-200 hover:border-amber-400"
                                        }`}
                                    >
                                        <div className="p-5 space-y-3">
                                            {/* Fila Superior: Fecha, Estado e Interno */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`px-2.5 py-1 text-[11px] font-black rounded-lg uppercase tracking-wider ${
                                                        isClosed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                                                    }`}>
                                                        {isClosed ? "✓ Firmada" : "📝 Borrador"}
                                                    </span>

                                                    {ev.sessionNumber && (
                                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-md border border-slate-200">
                                                            Sesión #{ev.sessionNumber}
                                                        </span>
                                                    )}

                                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                                                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        {displayDate}
                                                    </span>

                                                    <span className="text-[11px] font-semibold text-slate-400">
                                                        ({formatRelativeTime(isoDate)})
                                                    </span>
                                                </div>

                                                {/* Autor / Interno */}
                                                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 self-start sm:self-auto">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                                                        {(ev.clinicianResponsible || "I")[0].toUpperCase()}
                                                    </div>
                                                    <div className="text-xs">
                                                        <span className="font-bold text-slate-800 block leading-tight">{ev.clinicianResponsible || "Interno no asignado"}</span>
                                                        <span className="text-[10px] text-slate-400 block leading-tight">Interno de Kinesiología</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fila Central: Paciente y Detalles del Tratamiento */}
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                {/* Columna Paciente */}
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Persona Usuaria / Paciente</span>
                                                    <p className="text-sm font-bold text-slate-900 leading-tight">{pacienteNombre}</p>
                                                    <p className="text-xs text-slate-500 font-mono">RUT: {pacienteRut}</p>
                                                    
                                                    {ev.procesoId && (
                                                        <Link
                                                            href={`/app/usuarios?openFicha=${ev.usuariaId}&procesoId=${ev.procesoId}`}
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 mt-1 hover:underline"
                                                        >
                                                            <span>Ver Expediente Completo</span>
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </Link>
                                                    )}
                                                </div>

                                                {/* Columna Objetivo y Dolor */}
                                                <div className="space-y-1 md:col-span-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Objetivo de la Sesión</span>
                                                        {ev.pain && (
                                                            <div className="flex items-center gap-1 text-xs font-bold">
                                                                <span className="text-slate-500">EVA:</span>
                                                                <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[11px]">{ev.pain.evaStart}</span>
                                                                <span className="text-slate-400">→</span>
                                                                <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[11px]">{ev.pain.evaEnd}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{ev.sessionGoal || "Sin objetivo registrado"}</p>
                                                    
                                                    {ev.nextPlan && (
                                                        <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs">
                                                            <span className="font-bold text-slate-600">Próximo Plan: </span>
                                                            <span className="text-slate-700 italic">{ev.nextPlan}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Fila Inferior: Botón de Vista Previa Extendida */}
                                            <div className="pt-2 flex justify-end">
                                                <button
                                                    onClick={() => setDetailModalEvol(ev)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                                                >
                                                    <span>Auditar Detalles Clínicos Completo</span>
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {displayLimit < filteredEvoluciones.length && (
                                <div className="pt-3 pb-2 text-center">
                                    <button
                                        onClick={() => setDisplayLimit(prev => prev + 25)}
                                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-2"
                                    >
                                        <span>Cargar más evoluciones ({filteredEvoluciones.length - displayLimit} restantes)</span>
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL DE VISTA DETALLADA COMPLETA DE EVOLUCIÓN */}
            {detailModalEvol && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 max-h-[90vh] flex flex-col">
                        {/* Header Modal */}
                        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                            <div>
                                <h3 className="font-black text-lg">Detalles de Evolución Clínica</h3>
                                <p className="text-xs text-slate-400">Firmado por: {detailModalEvol.clinicianResponsible || "Interno"}</p>
                            </div>
                            <button
                                onClick={() => setDetailModalEvol(null)}
                                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body Modal */}
                        <div className="p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
                            {/* General */}
                            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div>
                                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Fecha de Atención</span>
                                    <p className="font-bold text-slate-900 text-sm">{detailModalEvol.sessionAt || detailModalEvol.audit?.createdAt || "N/A"}</p>
                                </div>
                                <div>
                                    <span className="font-bold text-slate-400 uppercase tracking-wider block text-[10px]">Estado</span>
                                    <p className="font-bold text-emerald-600 text-sm">{detailModalEvol.status}</p>
                                </div>
                            </div>

                            {/* Objetivo de Sesión */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Objetivo de la Sesión</h4>
                                <p className="p-3 bg-slate-50 rounded-xl border border-slate-100 font-medium leading-relaxed">{detailModalEvol.sessionGoal || "Sin registro"}</p>
                            </div>

                            {/* Próximo Plan */}
                            <div>
                                <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Próxima Sesión y Plan de Carga</h4>
                                <p className="p-3 bg-indigo-50/50 text-indigo-950 rounded-xl border border-indigo-100 font-medium leading-relaxed">{detailModalEvol.nextPlan || "Sin registro"}</p>
                            </div>

                            {/* Handoff Text / Notas Docentes */}
                            {detailModalEvol.handoffText && (
                                <div>
                                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">Punto de Entrega / Observación Docente (Handoff)</h4>
                                    <p className="p-3 bg-amber-50 text-amber-900 rounded-xl border border-amber-200 font-medium leading-relaxed">{detailModalEvol.handoffText}</p>
                                </div>
                            )}

                            {/* Vital Signs / Readiness si están disponibles */}
                            {detailModalEvol.readiness && (
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                                    <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Wellness & Readiness Inicial</h4>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block font-bold">Sueño</span>
                                            <span className="font-bold text-slate-800">{detailModalEvol.readiness.sleepQuality || "N/A"}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block font-bold">Estrés</span>
                                            <span className="font-bold text-slate-800">{detailModalEvol.readiness.stressLevel || "N/A"}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block font-bold">Energía</span>
                                            <span className="font-bold text-slate-800">{detailModalEvol.readiness.energy || "N/A"}</span>
                                        </div>
                                        <div className="bg-white p-2 rounded-xl border border-slate-200">
                                            <span className="text-[10px] text-slate-400 block font-bold">Tarea Hogar</span>
                                            <span className="font-bold text-slate-800">{detailModalEvol.readiness.homeTasksCompleted || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Modal */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex justify-between items-center">
                            <Link
                                href={`/app/usuarios?openFicha=${detailModalEvol.usuariaId}&procesoId=${detailModalEvol.procesoId}`}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition text-xs flex items-center gap-2"
                                onClick={() => setDetailModalEvol(null)}
                            >
                                <span>Abrir Expediente y Editar</span>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </Link>

                            <button
                                onClick={() => setDetailModalEvol(null)}
                                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition text-xs"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
