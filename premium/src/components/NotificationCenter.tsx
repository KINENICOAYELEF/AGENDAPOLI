"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
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
    patientId: string;
    patientName: string;
    procesoId: string;
    internId?: string;
    internName?: string;
    daysCount: number;
    resolved: boolean;
    lastEvoText: string;
}

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

    const fetchAlerts = async () => {
        if (!globalActiveYear || !user) return;
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

            // 4. Obtener todas las Evoluciones
            const evosRef = collection(db, "programs", globalActiveYear, "evoluciones");
            const evosSnap = await getDocs(evosRef);
            const evoluciones = evosSnap.docs.map(d => ({ id: d.id, ...d.data() } as Evolucion));

            const list: NotificationItem[] = [];
            const today = new Date();

            // Filtrar procesos activos
            const activeProcesos = procesos.filter(p => p.estado === "ACTIVO");

            activeProcesos.forEach(proc => {
                const patient = patients.find(pat => pat.id === proc.personaUsuariaId);
                if (!patient) return;

                const assignedInternId = patient.meta?.assignedInternId || proc.primaryInternId || proc.attendancePlan?.primaryInternId;
                const assignedInternName = patient.meta?.assignedInternName || proc.createdByName;

                // Obtener evoluciones firmadas (CLOSED) para este proceso
                const procEvos = evoluciones.filter(e => e.procesoId === proc.id && e.status === "CLOSED");
                
                // Calcular última evolución e información de autor
                let lastEvoDate: Date;
                let lastEvoText = "";
                
                if (procEvos.length > 0) {
                    const sortedEvos = [...procEvos].sort((a, b) => {
                        const dateA = new Date(a.sessionAt || (a as any).fechaHoraAtencion || proc.fechaInicio);
                        const dateB = new Date(b.sessionAt || (b as any).fechaHoraAtencion || proc.fechaInicio);
                        return dateB.getTime() - dateA.getTime();
                    });
                    const lastEvo = sortedEvos[0];
                    lastEvoDate = new Date(lastEvo.sessionAt || (lastEvo as any).fechaHoraAtencion || proc.fechaInicio);
                    const authorName = getAuthorName(lastEvo);
                    const daysSinceLastEvo = Math.floor(Math.abs(today.getTime() - lastEvoDate.getTime()) / (1000 * 60 * 60 * 24));
                    lastEvoText = `Última evolución hace ${daysSinceLastEvo} días por ${authorName}`;
                } else {
                    lastEvoDate = new Date(proc.fechaInicio);
                    lastEvoText = "Sin evoluciones registradas en este periodo";
                }

                // --- ALERTA 1: EVOLUCIONES PENDIENTES (> 7 días) ---
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

                // --- ALERTA 2: INTERNO INACTIVO (> 14 días) - SOLO DOCENTES ---
                if (user.role === "DOCENTE" && assignedInternId) {
                    const intern = interns.find(i => i.uid === assignedInternId);
                    if (intern) {
                        let isInactive = false;
                        let lastActiveDays = 0;

                        if (intern.lastActiveAt) {
                            const lastActive = new Date(intern.lastActiveAt);
                            const inactiveDiff = Math.abs(today.getTime() - lastActive.getTime());
                            lastActiveDays = Math.floor(inactiveDiff / (1000 * 60 * 60 * 24));
                            isInactive = lastActiveDays > 14;
                        } else if (intern.createdAt) {
                            const createdDate = new Date((intern.createdAt as any).seconds ? (intern.createdAt as any).seconds * 1000 : intern.createdAt);
                            const createdDiff = Math.abs(today.getTime() - createdDate.getTime());
                            lastActiveDays = Math.floor(createdDiff / (1000 * 60 * 60 * 24));
                            isInactive = lastActiveDays > 14;
                        }

                        if (isInactive) {
                            list.push({
                                id: `inactive_${proc.id}`,
                                type: "INACTIVE_INTERN",
                                message: `Interno inactivo hace ${lastActiveDays} días con tratamiento activo.`,
                                patientId: patient.id!,
                                patientName: patient.identity.fullName,
                                procesoId: proc.id!,
                                internId: assignedInternId,
                                internName: intern.displayName || intern.email || undefined,
                                daysCount: lastActiveDays,
                                resolved: false,
                                lastEvoText
                            });
                        }
                    }
                }
            });

            // Ordenar por gravedad (más días transcurridos primero)
            list.sort((a, b) => b.daysCount - a.daysCount);
            setNotifications(list);

        } catch (e) {
            console.error("Error cargando alertas de notificación:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (globalActiveYear && user) {
            fetchAlerts();
            const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [globalActiveYear, user]);

    // Acción: Advertir/Bloquear acceso al interno
    const handleRestrictAccess = async (item: NotificationItem) => {
        if (!item.internId) return;
        const confirmBlock = window.confirm(`¿Estás seguro de restringir el acceso temporal al interno "${item.internName}" hasta que regularice la evolución de "${item.patientName}"?`);
        if (!confirmBlock) return;

        try {
            const userRef = doc(db, "users", item.internId);
            await updateDoc(userRef, {
                bloqueoActivo: true,
                bloqueoPacienteId: item.patientId,
                bloqueoPacienteName: item.patientName,
                bloqueoProcesoId: item.procesoId,
                bloqueadoAt: new Date().toISOString()
            });
            alert(`Acceso restringido temporalmente para el interno ${item.internName}.`);
            fetchAlerts();
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
                    updatedAt: new Date().toISOString()
                }
            };
            await PersonasUsuariasService.save(globalActiveYear, updatedPatient);
            await AgendaService.updateFutureCitasIntern(globalActiveYear, patientId, intern.uid);

            alert(`Paciente reasignado exitosamente a ${intern.displayName || intern.email}.`);
            setReassigningPatientId(null);
            fetchAlerts();
        } catch (e) {
            console.error(e);
            alert("Error al reasignar el paciente.");
        } finally {
            setLoading(false);
        }
    };

    // Acción: Finalizar Proceso del paciente
    const handleFinishProcess = async (procesoId: string) => {
        if (!globalActiveYear) return;
        const confirmFinish = window.confirm("¿Estás seguro de dar de alta el proceso de este paciente? Esto cancelará sus citas futuras.");
        if (!confirmFinish) return;

        try {
            setLoading(true);
            const todayStr = new Date().toISOString();
            const procSnap = await getDocs(query(collection(db, "programs", globalActiveYear, "procesos"), where("id", "==", procesoId)));
            if (procSnap.empty) return;
            const procData = procSnap.docs[0].data() as Proceso;

            const updatedProceso = {
                ...procData,
                estado: "ALTA" as const,
                fechaAlta: todayStr,
                updatedAt: todayStr
            };

            await ProcesosService.save(globalActiveYear, updatedProceso);
            await AgendaService.cancelFutureSchedule(globalActiveYear, procesoId);

            alert("El proceso del paciente ha sido finalizado y sus citas futuras fueron canceladas.");
            fetchAlerts();
        } catch (e) {
            console.error(e);
            alert("Error al finalizar el proceso.");
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
            
        // Filtro por buscador (nombre paciente, nombre interno, mensaje o última evo)
        const queryClean = searchQuery.toLowerCase().trim();
        if (queryClean === "") return matchTab;

        const matchSearch = 
            item.patientName.toLowerCase().includes(queryClean) ||
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
                <div className="absolute right-0 mt-3 w-[420px] max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1000] overflow-hidden flex flex-col max-h-[580px] transition-all duration-300">
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <div>
                            <h4 className="font-extrabold text-slate-800 text-sm">Centro de Notificaciones</h4>
                            <p className="text-[10px] text-slate-400 font-medium">Control de evolución y permanencia</p>
                        </div>
                        <button
                            onClick={fetchAlerts}
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
                                    cardBgClass = "bg-slate-50/70 border-slate-200 hover:bg-slate-50/90 hover:border-slate-300";
                                    badgeText = "Inactivo";
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
                                                {badgeText} • {item.daysCount} días
                                            </span>
                                            
                                            {/* Link a la ficha clínica del paciente */}
                                            <a 
                                                href={`/app/usuarios?openFicha=${item.patientId}`} 
                                                onClick={() => setIsOpen(false)}
                                                className="text-[11px] font-extrabold text-indigo-600 hover:underline hover:text-indigo-800 transition flex items-center gap-0.5"
                                                title="Ver Expediente Clínico"
                                            >
                                                Ver Ficha 📂
                                            </a>
                                        </div>

                                        {/* Información y Mensaje */}
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

                                        {/* Detalle de Última Evolución */}
                                        <div className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 bg-white/40 p-1.5 rounded-lg border border-slate-100/50">
                                            <span>📊</span> {item.lastEvoText}
                                        </div>

                                        {/* Botones de acción Docente */}
                                        {user?.role === "DOCENTE" && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-slate-100/60">
                                                {item.type === "PENDING_EVOLUTION" && item.internId && (
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
                                                
                                                {/* Selector de Reasignación Rápida */}
                                                {reassigningPatientId === item.patientId ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <select
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    handleReassign(item.patientId, e.target.value);
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
                                                        onClick={() => setReassigningPatientId(item.patientId)}
                                                        className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[10px] font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
                                                    >
                                                        Reasignar Paciente
                                                    </button>
                                                )}
                                                
                                                {item.type === "INACTIVE_INTERN" && (
                                                    <button
                                                        onClick={() => handleFinishProcess(item.procesoId)}
                                                        className="bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 text-[10px] font-bold px-3 py-1.5 rounded-lg transition active:scale-95"
                                                    >
                                                        Dar de Alta
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Botones de acción Interno */}
                                        {user?.role === "INTERNO" && item.type === "PENDING_EVOLUTION" && (
                                            <div className="pt-1 flex justify-end">
                                                <a
                                                    href={`/app/usuarios?openFicha=${item.patientId}`}
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-extrabold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-lg hover:bg-indigo-100 transition active:scale-95"
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    ✍️ Registrar Evolución Pendiente
                                                </a>
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
