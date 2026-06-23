"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, where, getDocs, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { UsersService } from "@/services/users";
import { PersonasUsuariasService } from "@/services/personasUsuarias";
import { Proceso, Cita, Evolucion } from "@/types/clinica";
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
}

export function NotificationCenter() {
    const { user } = useAuth();
    const { globalActiveYear } = useYear();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [allInterns, setAllInterns] = useState<AppUser[]>([]);
    const [reassigningPatientId, setReassigningPatientId] = useState<string | null>(null);
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
            // 1. Obtener Internos
            const interns = await UsersService.getInterns();
            setAllInterns(interns);

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

                // --- ALERTA 1: EVOLUCIONES PENDIENTES (> 7 días) ---
                // Obtener evoluciones firmadas (CLOSED) para este proceso
                const procEvos = evoluciones.filter(e => e.procesoId === proc.id && e.status === "CLOSED");
                
                let lastEvoDate: Date;
                if (procEvos.length > 0) {
                    // Ordenar por fecha desc y tomar la última
                    const dates = procEvos.map(e => new Date(e.sessionAt || (e as any).fechaHoraAtencion || proc.fechaInicio));
                    lastEvoDate = new Date(Math.max(...dates.map(d => d.getTime())));
                } else {
                    lastEvoDate = new Date(proc.fechaInicio);
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
                                ? `Paciente "${patient.identity.fullName}" (Asignado a ${assignedInternName || "Sin asignar"}) lleva ${diffDays} días sin evolucionar.`
                                : `El paciente "${patient.identity.fullName}" lleva ${diffDays} días sin evolucionar. De no regularizar esta situación, se bloquearán las funciones para la entrega de tus simulaciones u otras tareas, lo que retrasará y afectará tu desempeño final.`,
                            patientId: patient.id!,
                            patientName: patient.identity.fullName,
                            procesoId: proc.id!,
                            internId: assignedInternId,
                            internName: assignedInternName,
                            daysCount: diffDays,
                            resolved: false
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
                            // Si no tiene lastActiveAt pero fue creado hace más de 14 días
                            const createdDate = new Date((intern.createdAt as any).seconds ? (intern.createdAt as any).seconds * 1000 : intern.createdAt);
                            const createdDiff = Math.abs(today.getTime() - createdDate.getTime());
                            lastActiveDays = Math.floor(createdDiff / (1000 * 60 * 60 * 24));
                            isInactive = lastActiveDays > 14;
                        }

                        if (isInactive) {
                            list.push({
                                id: `inactive_${proc.id}`,
                                type: "INACTIVE_INTERN",
                                message: `Interno ${intern.displayName || intern.email} inactivo hace ${lastActiveDays} días. El paciente "${patient.identity.fullName}" sigue en tratamiento activo.`,
                                patientId: patient.id!,
                                patientName: patient.identity.fullName,
                                procesoId: proc.id!,
                                internId: assignedInternId,
                                internName: intern.displayName || intern.email || undefined,
                                daysCount: lastActiveDays,
                                resolved: false
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
            // Refrescar cada 5 minutos
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
            // 1. Obtener datos paciente
            const patient = await PersonasUsuariasService.getById(globalActiveYear, patientId);
            if (!patient) return;

            // 2. Modificar en paciente
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

            // 3. Propagar a citas futuras
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
            const procesosRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
            const todayStr = new Date().toISOString();
            
            // 1. Obtener proceso
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

    const activeCount = notifications.length;

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Botón Campana */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-xl border transition-all ${
                    activeCount > 0
                        ? "bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                }`}
                title="Notificaciones Clínicas"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {activeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                        {activeCount}
                    </span>
                )}
            </button>

            {/* Dropdown Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-3 w-96 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-2xl shadow-xl z-[1000] overflow-hidden flex flex-col max-h-[500px]">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h4 className="font-bold text-slate-800 text-sm">Alertas y Notificaciones</h4>
                        <button
                            onClick={fetchAlerts}
                            disabled={loading}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold disabled:opacity-50"
                        >
                            Refrescar
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                        {loading && notifications.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400 font-medium animate-pulse">
                                Buscando alertas pendientes...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-12 text-center text-xs text-slate-400 font-semibold italic">
                                🎉 Todo en orden. No hay alertas pendientes.
                            </div>
                        ) : (
                            notifications.map(item => {
                                const isBlocked = allInterns.find(i => i.uid === item.internId)?.bloqueoActivo;
                                return (
                                    <div key={item.id} className="p-3 hover:bg-slate-50/50 rounded-xl transition-all space-y-2">
                                        <div className="flex items-start gap-2.5">
                                            <span className="text-base mt-0.5">
                                                {item.type === "PENDING_EVOLUTION" ? "📝" : "💤"}
                                            </span>
                                            <p className="text-xs text-slate-700 font-medium leading-relaxed flex-1">
                                                {item.message}
                                            </p>
                                        </div>

                                        {/* Botones de acción Docente */}
                                        {user?.role === "DOCENTE" && (
                                            <div className="flex flex-wrap items-center gap-2 pl-6">
                                                {item.type === "PENDING_EVOLUTION" && item.internId && (
                                                    <button
                                                        onClick={() => handleRestrictAccess(item)}
                                                        disabled={isBlocked}
                                                        className={`text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                                                            isBlocked
                                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                                                : "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100"
                                                        }`}
                                                    >
                                                        {isBlocked ? "🔴 Advertido / Restringido" : "⚠️ Advertir Limitación"}
                                                    </button>
                                                )}
                                                {item.type === "INACTIVE_INTERN" && (
                                                    <>
                                                        {reassigningPatientId === item.patientId ? (
                                                            <select
                                                                onChange={(e) => {
                                                                    if (e.target.value) {
                                                                        handleReassign(item.patientId, e.target.value);
                                                                    }
                                                                }}
                                                                defaultValue=""
                                                                className="text-[10px] font-bold bg-white text-slate-700 border border-slate-200 rounded-lg p-1"
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
                                                        ) : (
                                                            <button
                                                                onClick={() => setReassigningPatientId(item.patientId)}
                                                                className="bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                                                            >
                                                                Reasignar Interno
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleFinishProcess(item.procesoId)}
                                                            className="bg-white text-slate-500 border border-slate-200 hover:bg-slate-50 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition"
                                                        >
                                                            Dar de Alta
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Botones de acción Interno */}
                                        {user?.role === "INTERNO" && item.type === "PENDING_EVOLUTION" && (
                                            <div className="pl-6">
                                                <a
                                                    href="/app/usuarios"
                                                    className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition"
                                                    onClick={() => setIsOpen(false)}
                                                >
                                                    ✍️ Ir a Evolucionar Paciente
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
