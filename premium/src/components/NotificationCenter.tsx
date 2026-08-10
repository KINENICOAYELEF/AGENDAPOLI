"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, query, where, getDocs, doc, updateDoc, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { UsersService } from "@/services/users";
import { PersonasUsuariasService } from "@/services/personasUsuarias";
import { Proceso, Evolucion } from "@/types/clinica";
import { AppUser } from "@/context/AuthContext";
import { AgendaService } from "@/services/agenda";
import { ProcesosService } from "@/services/procesos";

interface NotificationItem {
    id: string;
    type: "PENDING_EVOLUTION" | "INACTIVE_INTERN";
    message: string;
    patientId?: string;
    patientName?: string;
    procesoId?: string;
    internId?: string;
    internName?: string;
    daysCount: number;
    resolved: boolean;
    lastEvoText: string;
    assignedPatients?: Array<{ id: string; name: string }>;
}

type NotificationCacheEntry = {
    notifications: NotificationItem[];
    interns: AppUser[];
    users: AppUser[];
    fetchedAt: number;
};

// La campana vive en el layout de toda la aplicación. Mantener este cache solo
// en memoria evita repetir un censo completo al cambiar de pantalla; no guarda
// información clínica en localStorage ni en el dispositivo.
const notificationCache = new Map<string, NotificationCacheEntry>();
const NOTIFICATION_CACHE_TTL_MS = 15 * 60 * 1000;

export function NotificationCenter() {
    const { user } = useAuth();
    const { globalActiveYear } = useYear();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [allInterns, setAllInterns] = useState<AppUser[]>([]);
    const [allUsers, setAllUsers] = useState<AppUser[]>([]);
    const [reassigningPatientId, setReassigningPatientId] = useState<string | null>(null);
    
    // Filtros e Interacción
    const [activeTab, setActiveTab] = useState<"EVOLUTIONS" | "INACTIVE_INTERNS">("EVOLUTIONS");
    const [searchQuery, setSearchQuery] = useState("");
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const fetchInFlightRef = useRef(false);

    // Cerrar al hacer click afuera
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchAlerts = async (force = false) => {
        if (!globalActiveYear || !user) return;
        const cacheKey = `${globalActiveYear}:${user.uid}:${user.role}`;
        const cached = notificationCache.get(cacheKey);
        if (!force && cached && Date.now() - cached.fetchedAt < NOTIFICATION_CACHE_TTL_MS) {
            setNotifications(cached.notifications);
            setAllInterns(cached.interns);
            setAllUsers(cached.users);
            return;
        }
        if (fetchInFlightRef.current) return;
        fetchInFlightRef.current = true;
        setLoading(true);
        try {
            // 1. Obtener Internos y Docentes (para resolver nombres de quien evolucionó)
            const interns = await UsersService.getInterns();
            const docentes = await UsersService.getByRole("DOCENTE");
            const combinedUsers = [...interns, ...docentes];
            
            setAllInterns(interns);
            setAllUsers(combinedUsers);

            // Helper para resolver nombres
            const getAuthorName = (evo: Evolucion) => {
                const authorId = evo.clinicianResponsible || evo.audit?.closedBy || evo.audit?.createdBy || "";
                const found = combinedUsers.find(u => u.uid === authorId || u.email === authorId);
                if (found) return found.displayName || found.email;
                return authorId; // fallback
            };

            // 2. Obtener Pacientes
            const patientResponse = await PersonasUsuariasService.getPaginated(globalActiveYear);
            const patients = patientResponse.data;

            // 3. Obtener Procesos
            const procesosRef = collection(db, "programs", globalActiveYear, "procesos");
            const procesosSnap = await getDocs(procesosRef);
            const procesos = procesosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Proceso));
            const activeProcesosRaw = procesos.filter(p => p.estado === "ACTIVO");

            // 4. La continuidad se lee del resumen denormalizado en cada proceso.
            // Antes se descargaban TODAS las evoluciones del año en cada apertura
            // de la campana solo para calcular "días sin evolucionar": era la
            // consulta más cara de la plataforma y crecía sin techo.
            // Los procesos que aún no tienen el resumen (registros previos a este
            // cambio) se resuelven consultando solo esos, no la colección entera.
            const procesosSinResumen = activeProcesosRaw.filter(p => !p.lastClosedEvolution && p.id);
            const evolucionesLegacy = new Map<string, Evolucion>();
            await Promise.all(procesosSinResumen.slice(0, 25).map(async (proc) => {
                try {
                    const snap = await getDocs(query(
                        collection(db, "programs", globalActiveYear, "evoluciones"),
                        where("procesoId", "==", proc.id),
                        limit(50),
                    ));
                    const closed = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as Evolucion))
                        .filter(e => e.status === "CLOSED" || (e as any).estado === "CERRADA")
                        .sort((a, b) => String(b.sessionAt || '').localeCompare(String(a.sessionAt || '')));
                    if (closed[0]) evolucionesLegacy.set(proc.id!, closed[0]);
                } catch (e) {
                    console.warn("No se pudo resolver continuidad legacy del proceso", proc.id, e);
                }
            }));

            const list: NotificationItem[] = [];
            const today = new Date();
            const activeProcesos = activeProcesosRaw;

            // Última sesión firmada por cada interna, deducida de los resúmenes de
            // proceso. Sustituye el barrido completo de evoluciones que hacía la
            // alerta de inactividad docente.
            const lastSessionByIntern = new Map<string, string>();
            const lastPatientByIntern = new Map<string, string>();
            procesos.forEach(proc => {
                const summary = proc.lastClosedEvolution
                    || (proc.id && evolucionesLegacy.has(proc.id)
                        ? {
                            sessionAt: evolucionesLegacy.get(proc.id)!.sessionAt || '',
                            authorUid: evolucionesLegacy.get(proc.id)!.audit?.createdBy
                                || evolucionesLegacy.get(proc.id)!.clinicianResponsible || '',
                        }
                        : null);
                if (!summary?.authorUid || !summary.sessionAt) return;
                const previous = lastSessionByIntern.get(summary.authorUid);
                if (!previous || summary.sessionAt > previous) {
                    lastSessionByIntern.set(summary.authorUid, summary.sessionAt);
                    if (proc.personaUsuariaId) lastPatientByIntern.set(summary.authorUid, proc.personaUsuariaId);
                }
            });

            // --- ALERTA 1: EVOLUCIONES PENDIENTES (> 7 días) ---
            // Iteramos sobre los procesos clínicos de los pacientes
            activeProcesos.forEach(proc => {
                const patient = patients.find(pat => pat.id === proc.personaUsuariaId);
                if (!patient) return;

                const assignedInternId = patient.meta?.assignedInternId || proc.primaryInternId || proc.attendancePlan?.primaryInternId;
                const assignedInternName = patient.meta?.assignedInternName || proc.createdByName;

                // Resumen denormalizado del proceso, o el rescate legacy para los
                // procesos que todavía no lo tienen escrito.
                const legacyEvo = evolucionesLegacy.get(proc.id!);
                const lastClosed = proc.lastClosedEvolution
                    || (legacyEvo ? {
                        sessionAt: legacyEvo.sessionAt || (legacyEvo as any).fechaHoraAtencion || proc.fechaInicio,
                        authorUid: legacyEvo.clinicianResponsible || legacyEvo.audit?.closedBy || legacyEvo.audit?.createdBy || '',
                        authorName: '',
                    } : null);

                let lastEvoDate: Date;
                let lastEvoText = "";

                if (lastClosed?.sessionAt) {
                    lastEvoDate = new Date(lastClosed.sessionAt);
                    const resolved = combinedUsers.find(u => u.uid === lastClosed.authorUid || u.email === lastClosed.authorUid);
                    const authorName = lastClosed.authorName || resolved?.displayName || resolved?.email || lastClosed.authorUid || 'autor no identificado';
                    const daysSinceLastEvo = Math.floor(Math.abs(today.getTime() - lastEvoDate.getTime()) / (1000 * 60 * 60 * 24));
                    lastEvoText = `Última evolución hace ${daysSinceLastEvo} días por ${authorName}`;
                } else {
                    lastEvoDate = new Date(proc.fechaInicio);
                    lastEvoText = "Sin evoluciones registradas en este periodo";
                }

                const diffTime = Math.abs(today.getTime() - lastEvoDate.getTime());
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= 7) {
                    const isForCurrentUser = user.role === "DOCENTE" || assignedInternId === user.uid;
                    if (isForCurrentUser) {
                        list.push({
                            id: `evo_${proc.id}`,
                            type: "PENDING_EVOLUTION",
                            message: user.role === "DOCENTE"
                                ? `Paciente sin evolucionar hace ${diffDays} días.`
                                : `El paciente lleva ${diffDays} días sin evolucionar. De no regularizar esta situación, se bloquearán las funciones para la entrega de tus simulaciones u otras tareas, lo que retrasará y afectará tu desempeño final.`,
                            patientId: patient.id!,
                            patientName: patient.identity.fullName,
                            procesoId: proc.id!,
                            internId: assignedInternId,
                            internName: assignedInternName,
                            daysCount: diffDays,
                            resolved: false,
                            lastEvoText
                        });
                    }
                }
            });

            // --- ALERTA 2: INTERNOS INACTIVOS (SOLO DOCENTES) ---
            // Monitorear directamente la actividad académica y de uso de la plataforma de los internos
            if (user.role === "DOCENTE") {
                interns.forEach(intern => {
                    let daysSinceLastActive = 999;
                    let lastActiveText = "Nunca ingresó";

                    // 1. Días desde último ingreso/actividad en plataforma
                    if (intern.lastActiveAt) {
                        const lastActiveDate = new Date(intern.lastActiveAt);
                        daysSinceLastActive = Math.floor(Math.abs(today.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24));
                        lastActiveText = `${daysSinceLastActive} días`;
                    } else if (intern.createdAt) {
                        const createdDate = new Date((intern.createdAt as any).seconds ? (intern.createdAt as any).seconds * 1000 : intern.createdAt);
                        daysSinceLastActive = Math.floor(Math.abs(today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                        lastActiveText = `Creado hace ${daysSinceLastActive} días (sin ingresos)`;
                    }

                    // 2. Días desde su última evolución clínica cerrada.
                    // Sale del resumen que cada proceso guarda al firmarse, sin
                    // releer la colección de evoluciones.
                    const lastSessionIso = lastSessionByIntern.get(intern.uid);

                    let daysSinceLastEvo = 999;
                    let lastEvoText = "Sin evoluciones registradas";

                    if (lastSessionIso) {
                        const lastEvoDate = new Date(lastSessionIso);
                        daysSinceLastEvo = Math.floor(Math.abs(today.getTime() - lastEvoDate.getTime()) / (1000 * 60 * 60 * 24));
                        
                        const patientId = lastPatientByIntern.get(intern.uid);
                        const pat = patients.find(p => p.id === patientId);
                        lastEvoText = `Última evolución: hace ${daysSinceLastEvo} días (${pat?.identity?.fullName || "persona no identificada"})`;
                    }

                    // 3. Determinar inactividad: > 14 días sin ingresar O > 14 días sin evolucionar
                    const isInactiveActiveAt = daysSinceLastActive > 14;
                    // Si no hay ningún resumen para esta interna, puede ser que sus
                    // procesos aún no lo tengan escrito (registros anteriores a la
                    // denormalización), no que esté inactiva. No la acusamos por
                    // falta de dato: si además entró hace poco, se omite la alerta.
                    const hasSessionEvidence = Boolean(lastSessionIso);
                    const isInactiveEvolutions = hasSessionEvidence
                        ? daysSinceLastEvo > 14
                        : daysSinceLastActive > 14;

                    if (isInactiveActiveAt || isInactiveEvolutions) {
                        // Obtener pacientes activos que este interno tiene asignados
                        const assignedPatients = patients.filter(pat => {
                            const isAssigned = pat.meta?.assignedInternId === intern.uid;
                            const hasActiveProc = activeProcesos.some(p => p.personaUsuariaId === pat.id);
                            return isAssigned && hasActiveProc;
                        }).map(p => ({
                            id: p.id!,
                            name: p.identity.fullName
                        }));

                        let message = "";
                        if (isInactiveActiveAt && isInactiveEvolutions) {
                            message = `Inactivo: sin ingresos en ${lastActiveText} y sin registrar evoluciones en los últimos ${daysSinceLastEvo === 999 ? "14+" : daysSinceLastEvo} días.`;
                        } else if (isInactiveActiveAt) {
                            message = `Inactivo: sin ingresos a la plataforma en los últimos ${lastActiveText}.`;
                        } else {
                            message = `Inactivo: sin registrar evoluciones clínicas en los últimos ${daysSinceLastEvo} días.`;
                        }

                        list.push({
                            id: `inactive_${intern.uid}`,
                            type: "INACTIVE_INTERN",
                            message,
                            daysCount: Math.min(daysSinceLastActive, daysSinceLastEvo), // Usado para ordenar
                            internId: intern.uid,
                            internName: intern.displayName || intern.email || undefined,
                            resolved: false,
                            lastEvoText,
                            assignedPatients
                        });
                    }
                });
            }

            // Ordenar por gravedad o relevancia
            list.sort((a, b) => b.daysCount - a.daysCount);
            setNotifications(list);
            notificationCache.set(cacheKey, {
                notifications: list,
                interns,
                users: combinedUsers,
                fetchedAt: Date.now(),
            });

        } catch (e) {
            console.error("Error cargando alertas de notificación:", e);
        } finally {
            fetchInFlightRef.current = false;
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!globalActiveYear || !user) return;
        const cached = notificationCache.get(`${globalActiveYear}:${user.uid}:${user.role}`);
        if (cached) {
            setNotifications(cached.notifications);
            setAllInterns(cached.interns);
            setAllUsers(cached.users);
        } else {
            setNotifications([]);
            setAllInterns([]);
            setAllUsers([]);
        }
    }, [globalActiveYear, user?.uid, user?.role]);

    // El censo pesado se ejecuta solo cuando la persona abre la campana. Las
    // alertas automáticas siguen a cargo del agente programado y Telegram.
    useEffect(() => {
        if (isOpen && globalActiveYear && user) void fetchAlerts(false);
        // fetchAlerts usa deliberadamente el usuario/año actuales.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, globalActiveYear, user?.uid, user?.role]);

    // Acción: Advertir/Bloquear acceso al interno
    const handleRestrictAccess = async (item: NotificationItem) => {
        if (!item.internId) return;
        const confirmBlock = window.confirm(`¿Estás seguro de restringir el acceso temporal al interno "${item.internName}" hasta que regularice su situación clínica?`);
        if (!confirmBlock) return;

        try {
            const userRef = doc(db, "users", item.internId);
            await updateDoc(userRef, {
                bloqueoActivo: true,
                bloqueadoAt: new Date().toISOString()
            });
            alert(`Acceso restringido temporalmente para el interno ${item.internName}.`);
            fetchAlerts(true);
        } catch (e) {
            console.error(e);
            alert("Error al intentar restringir el acceso.");
        }
    };

    // Acción: Reasignar paciente a otro alumno
    const handleReassign = async (patientId: string, newInternId: string) => {
        if (!globalActiveYear) return;
        const intern = allInterns.find(i => i.uid === newInternId);
        if (!intern) return;

        try {
            setLoading(true);
            const patient = await PersonasUsuariasService.getById(globalActiveYear, patientId);
            if (!patient) return;

            const updatedPatient = {
                ...patient,
                meta: {
                    ...patient.meta,
                    assignedInternId: intern.uid,
                    assignedInternName: intern.displayName || intern.email || undefined,
                    assignmentStartedAt: patient.meta?.assignedInternId === intern.uid
                        ? patient.meta?.assignmentStartedAt
                        : new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            };
            await PersonasUsuariasService.save(globalActiveYear, updatedPatient);
            await AgendaService.updateFutureCitasIntern(globalActiveYear, patientId, intern.uid);

            alert(`Paciente reasignado exitosamente a ${intern.displayName || intern.email}.`);
            setReassigningPatientId(null);
            fetchAlerts(true);
        } catch (e) {
            console.error(e);
            alert("Error al reasignar el paciente.");
        } finally {
            setLoading(false);
        }
    };

    // Contadores reales para los tabs
    const countEvolutions = notifications.filter(n => n.type === "PENDING_EVOLUTION").length;
    const countInactive = notifications.filter(n => n.type === "INACTIVE_INTERN").length;
    const totalActiveCount = notifications.length;

    // Filtrado en memoria por Tab y por Búsqueda
    const filteredList = notifications.filter(item => {
        // Filtro por pestaña
        const matchTab = activeTab === "EVOLUTIONS" 
            ? item.type === "PENDING_EVOLUTION" 
            : item.type === "INACTIVE_INTERN";
            
        // Filtro por buscador
        const queryClean = searchQuery.toLowerCase().trim();
        if (queryClean === "") return matchTab;

        const matchSearch = 
            (item.patientName && item.patientName.toLowerCase().includes(queryClean)) ||
            (item.internName && item.internName.toLowerCase().includes(queryClean)) ||
            item.message.toLowerCase().includes(queryClean) ||
            item.lastEvoText.toLowerCase().includes(queryClean);

        return matchTab && matchSearch;
    });

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botón Campana */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl border transition-all duration-200 ${
                    totalActiveCount > 0
                        ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 hover:scale-105 shadow-sm"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                title="Notificaciones Clínicas"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {totalActiveCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-md animate-bounce">
                        {totalActiveCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-[440px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1000] overflow-hidden flex flex-col max-h-[580px] transition-all duration-300">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">Centro de Notificaciones</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Control de evolución y permanencia</p>
                        </div>
                        <button
                            onClick={() => void fetchAlerts(true)}
                            disabled={loading}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold disabled:opacity-50 flex items-center gap-1 transition"
                        >
                            {loading ? (
                                <span className="animate-spin inline-block w-3 h-3 border-2 border-indigo-600 border-t-transparent rounded-full" />
                            ) : "🔄"} Refrescar
                        </button>
                    </div>

                    {user?.role === "DOCENTE" && (
                        <>
                            {/* Pestañas (Filtros por Tipo de Alerta) */}
                            <div className="flex border-b border-slate-100 bg-slate-50/20 p-1.5 gap-1.5">
                                <button
                                    onClick={() => { setActiveTab("EVOLUTIONS"); setReassigningPatientId(null); }}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                        activeTab === "EVOLUTIONS"
                                            ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                                            : "text-slate-500 hover:bg-slate-100/70"
                                    }`}
                                >
                                    📝 Evoluciones
                                    {countEvolutions > 0 && (
                                        <span className="bg-rose-100 text-rose-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                            {countEvolutions}
                                        </span>
                                    )}
                                </button>
                                <button
                                    onClick={() => { setActiveTab("INACTIVE_INTERNS"); setReassigningPatientId(null); }}
                                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                                        activeTab === "INACTIVE_INTERNS"
                                            ? "bg-white text-indigo-600 shadow-sm border border-slate-100"
                                            : "text-slate-500 hover:bg-slate-100/70"
                                    }`}
                                >
                                    💤 Internos Inactivos
                                    {countInactive > 0 && (
                                        <span className="bg-slate-200 text-slate-700 text-[10px] font-black px-1.5 py-0.5 rounded-full">
                                            {countInactive}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Buscador Rápido */}
                            {totalActiveCount > 0 && (
                                <div className="p-2 border-b border-slate-100 bg-white">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Buscar por paciente o interno..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full text-xs bg-slate-50 hover:bg-slate-100/60 focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl py-1.5 pl-8 pr-3 transition duration-150 outline-none text-slate-700 font-medium"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                                        {searchQuery && (
                                            <button 
                                                onClick={() => setSearchQuery("")}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Cuerpo - Listado de Tarjetas */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/30 max-h-[380px]">
                        {loading && filteredList.length === 0 ? (
                            <div className="py-16 text-center text-xs text-slate-400 font-medium animate-pulse">
                                Sincronizando datos con Firebase...
                            </div>
                        ) : filteredList.length === 0 ? (
                            <div className="py-16 text-center text-xs text-slate-400 font-semibold italic flex flex-col items-center gap-2">
                                <span>🎉 Todo al día. Sin alertas en esta categoría.</span>
                                {searchQuery && <span className="text-[10px] text-slate-400 font-normal">Prueba borrando tu búsqueda.</span>}
                            </div>
                        ) : (
                            filteredList.map(item => {
                                const isBlocked = allInterns.find(i => i.uid === item.internId)?.bloqueoActivo;
                                const isCritical = item.daysCount >= 10;
                                
                                // Determinar estilos de tarjeta por semáforo de gravedad
                                let cardBgClass = "";
                                let badgeText = "";
                                let badgeColorClass = "";
                                
                                if (item.type === "PENDING_EVOLUTION") {
                                    if (isCritical) {
                                        cardBgClass = "bg-red-50/50 border-red-100 hover:bg-red-50/80 hover:border-red-200";
                                        badgeText = "Crítico";
                                        badgeColorClass = "bg-red-100 text-red-700 border-red-200";
                                    } else {
                                        cardBgClass = "bg-amber-50/40 border-amber-100 hover:bg-amber-50/70 hover:border-amber-200";
                                        badgeText = "Alerta";
                                        badgeColorClass = "bg-amber-100 text-amber-700 border-amber-200";
                                    }
                                } else {
                                    // Alertas de Internos Inactivos
                                    cardBgClass = "bg-slate-50/70 border-slate-200 hover:bg-slate-50/95 hover:border-slate-300";
                                    badgeText = "Interno Inactivo";
                                    badgeColorClass = "bg-slate-200 text-slate-700 border-slate-300";
                                }

                                return (
                                    <div 
                                        key={item.id} 
                                        className={`p-3.5 border rounded-xl transition-all duration-200 shadow-sm flex flex-col gap-2.5 ${cardBgClass}`}
                                    >
                                        <div className="flex justify-between items-start gap-2">
                                            {/* Badge de Estado y Días */}
                                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColorClass}`}>
                                                {badgeText}
                                            </span>
                                            
                                            {item.type === "PENDING_EVOLUTION" && item.patientId && (
                                                <Link 
                                                    href={`/app/usuarios?openFicha=${item.patientId}`} 
                                                    onClick={() => setIsOpen(false)}
                                                    className="text-[11px] font-extrabold text-indigo-600 hover:underline hover:text-indigo-800 transition flex items-center gap-0.5"
                                                    title="Ver Expediente Clínico"
                                                >
                                                    Ver Ficha 📂
                                                </Link>
                                            )}
                                        </div>

                                        {/* Información y Mensaje para Alertas de Evolución */}
                                        {item.type === "PENDING_EVOLUTION" && (
                                            <>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-800 leading-normal font-semibold">
                                                        Paciente: <span className="font-extrabold text-slate-950">{item.patientName}</span>
                                                    </p>
                                                    
                                                    {item.internName && (
                                                        <p className="text-[11px] text-slate-600 font-medium">
                                                            Interno a cargo: <span className="font-bold text-slate-800">{item.internName}</span>
                                                        </p>
                                                    )}

                                                    <p className="text-[11px] text-slate-500 italic font-medium leading-normal pl-2 border-l border-slate-300">
                                                        {item.message}
                                                    </p>
                                                </div>

                                                <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 bg-white/40 p-1.5 rounded-lg border border-slate-100/50">
                                                    <span>📊</span> {item.lastEvoText}
                                                </div>
                                            </>
                                        )}

                                        {/* Información y Mensaje para Alertas de Interno Inactivo */}
                                        {item.type === "INACTIVE_INTERN" && (
                                            <div className="space-y-2">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-slate-800 leading-normal font-extrabold">
                                                        👤 Interno: <span className="text-slate-950 font-black">{item.internName}</span>
                                                    </p>
                                                    <p className="text-[11px] text-rose-600 font-bold leading-normal bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                                                        ⚠️ {item.message}
                                                    </p>
                                                </div>

                                                <div className="text-[10px] text-slate-500 font-semibold bg-white/60 p-2 rounded-lg border border-slate-100 flex flex-col gap-1">
                                                    <span className="text-slate-400">Trazabilidad de desempeño:</span>
                                                    <span className="flex items-center gap-1 text-slate-700">📊 {item.lastEvoText}</span>
                                                </div>

                                                {/* Listado de Pacientes Asignados para Reasignación Directa */}
                                                {item.assignedPatients && item.assignedPatients.length > 0 ? (
                                                    <div className="mt-2 space-y-1.5">
                                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-wider">
                                                            Pacientes asignados actualmente ({item.assignedPatients.length}):
                                                        </p>
                                                        <div className="space-y-1.5 pl-1">
                                                            {item.assignedPatients.map(pat => (
                                                                <div key={pat.id} className="flex items-center justify-between gap-2 bg-white/50 border border-slate-100 p-2 rounded-lg text-[11px] text-slate-700 font-medium">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-900">{pat.name}</span>
                                                                        <Link
                                                                            href={`/app/usuarios?openFicha=${pat.id}`}
                                                                            onClick={() => setIsOpen(false)}
                                                                            className="text-[9px] text-indigo-600 hover:underline font-extrabold w-fit"
                                                                        >
                                                                            Ver Ficha 📂
                                                                        </Link>
                                                                    </div>

                                                                    {/* Selector de Reasignación */}
                                                                    {reassigningPatientId === pat.id ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <select
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) {
                                                                                        handleReassign(pat.id, e.target.value);
                                                                                    }
                                                                                }}
                                                                                defaultValue=""
                                                                                className="text-[9px] font-black bg-white text-slate-700 border border-indigo-200 rounded p-1"
                                                                            >
                                                                                <option value="" disabled>Reasignar a...</option>
                                                                                {allInterns
                                                                                    .filter(i => i.uid !== item.internId)
                                                                                    .map(i => (
                                                                                        <option key={i.uid} value={i.uid}>
                                                                                            {i.displayName || i.email}
                                                                                        </option>
                                                                                    ))}
                                                                            </select>
                                                                            <button 
                                                                                onClick={() => setReassigningPatientId(null)}
                                                                                className="text-[9px] text-slate-400 hover:text-slate-600 font-bold px-1"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setReassigningPatientId(pat.id)}
                                                                            className="bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-[9px] font-extrabold text-indigo-600 px-2 py-1 rounded transition"
                                                                        >
                                                                            Reasignar 🔄
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-slate-400 italic font-medium">
                                                        Sin pacientes activos asignados actualmente.
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        {/* Botones de acción Docente */}
                                        {user?.role === "DOCENTE" && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100/60">
                                                {item.type === "PENDING_EVOLUTION" && item.internId && (
                                                    <>
                                                        <button
                                                            onClick={() => handleRestrictAccess(item)}
                                                            disabled={isBlocked}
                                                            className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                                isBlocked
                                                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                                    : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 active:scale-95"
                                                            }`}
                                                        >
                                                            {isBlocked ? "🔴 Restringido temporalmente" : "⚠️ Advertir Limitación"}
                                                        </button>

                                                        {reassigningPatientId === item.patientId ? (
                                                            <div className="flex items-center gap-1.5">
                                                                <select
                                                                    onChange={(e) => {
                                                                        if (e.target.value) {
                                                                            handleReassign(item.patientId!, e.target.value);
                                                                        }
                                                                    }}
                                                                    defaultValue=""
                                                                    className="text-[10px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg p-1.5 focus:border-indigo-400"
                                                                >
                                                                    <option value="" disabled>Seleccionar Interno...</option>
                                                                    {allInterns
                                                                        .filter(i => i.uid !== item.internId)
                                                                        .map(i => (
                                                                            <option key={i.uid} value={i.uid}>
                                                                                {i.displayName || i.email}
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                                <button 
                                                                    onClick={() => setReassigningPatientId(null)}
                                                                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold px-1"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setReassigningPatientId(item.patientId!)}
                                                                className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[10px] font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
                                                            >
                                                                Reasignar Paciente
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                
                                                {item.type === "INACTIVE_INTERN" && item.internId && (
                                                    <button
                                                        onClick={() => handleRestrictAccess(item)}
                                                        disabled={isBlocked}
                                                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                                            isBlocked
                                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                                : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100 active:scale-95"
                                                        }`}
                                                    >
                                                        {isBlocked ? "🔴 Restringido temporalmente" : "⚠️ Advertir Limitación"}
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Botones de acción Interno */}
                                        {user?.role === "INTERNO" && item.type === "PENDING_EVOLUTION" && (
                                            <div className="pt-1 flex justify-end">
                                                <Link
                                                    href={`/app/usuarios?openFicha=${item.patientId}`}
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-lg hover:bg-indigo-100 transition active:scale-95"
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    ✍️ Registrar Evolución Pendiente
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
