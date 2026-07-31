"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { Cita, Turno, Feriado } from "@/types/clinica";
import { TurnosService } from "@/services/turnos";
import { AgendaService } from "@/services/agenda";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import { Calendar, CalendarCheck2, AlertTriangle, UserCheck, UserPlus } from "lucide-react";

interface AgendaProViewProps {
    baseDate?: Date;
}

export function AgendaProView({ baseDate: incomingBaseDate }: AgendaProViewProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Estabilizamos la fecha base para que no cambie sus milisegundos en cada re-render (lo cual causaba que baseDate.getTime() difiriera infinitamente en el useEffect)
    const [baseDate] = useState(() => incomingBaseDate || new Date());

    const [citas, setCitas] = useState<Cita[]>([]);
    const [holidays, setHolidays] = useState<Feriado[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [viewMode, setViewMode] = useState<'HOY' | 'SEMANA'>('HOY');
    const [filterScope, setFilterScope] = useState<'MIS_CITAS' | 'TODAS'>('MIS_CITAS');
    const [filterStatus, setFilterStatus] = useState<string>('ACTIVAS'); // SCHEDULED o ALL

    // Takeover State
    const [takeoverCitaId, setTakeoverCitaId] = useState<string | null>(null);
    const [takeoverReason, setTakeoverReason] = useState<string>('ausente');
    const [isTakingOver, setIsTakingOver] = useState(false);

    // Cancel/NoShow State
    const [actionCitaId, setActionCitaId] = useState<string | null>(null);
    const [actionType, setActionType] = useState<'NO_SHOW' | 'CANCEL'>('NO_SHOW');
    const [actionReason, setActionReason] = useState<string>('');
    const [isProcessingAction, setIsProcessingAction] = useState(false);

    useEffect(() => {
        if (globalActiveYear && user) {
            fetchAgenda();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, user, viewMode, filterScope, filterStatus, baseDate]);

    const fetchAgenda = async () => {
        if (!globalActiveYear || !user) return;
        setLoading(true);

        try {
            // FASE 2.3.6: Feriados UX
            const hList = await AgendaService.getHolidays(globalActiveYear);
            setHolidays(hList);

            const citasRef = collection(db, "programs", globalActiveYear, "citas");
            let q;
            if (viewMode === 'HOY') {
                const dayStr = format(baseDate, 'yyyy-MM-dd');
                q = query(citasRef, where("date", "==", dayStr));
            } else if (viewMode === 'SEMANA') {
                const start = startOfWeek(baseDate, { weekStartsOn: 1 });
                const end = addDays(start, 6);
                // La vista semanal no debe consultar todas las citas futuras y
                // recortarlas en el navegador: ambas cotas son del mismo campo.
                q = query(
                    citasRef,
                    where("date", ">=", format(start, 'yyyy-MM-dd')),
                    where("date", "<=", format(end, 'yyyy-MM-dd')),
                );
            } else {
                q = query(citasRef);
            }

            const snapshot = await getDocs(q);
            let results = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Cita));

            if (viewMode === 'SEMANA') {
                const start = startOfWeek(baseDate, { weekStartsOn: 1 });
                const end = format(addDays(start, 6), 'yyyy-MM-dd');
                results = results.filter(c => c.date <= end);
            }

            if (filterStatus === 'ACTIVAS') {
                const activeStatuses = ["SCHEDULED", "COMPLETED", "NO_SHOW"];
                results = results.filter(c => activeStatuses.includes(c.status));
            }

            // Local filtering for Scope (to avoid complex Firestore compound indexing issues right now)
            if (filterScope === 'MIS_CITAS') {
                results = results.filter(c =>
                    c.internoPlanificadoId === user.uid ||
                    c.internoAtendioId === user.uid
                );
            }

            // FASE 70: Lazy-load de nombres + detección de citas huérfanas
            const unpopulatedUids = Array.from(new Set(results.filter(c => !c.usuariaName).map(c => c.usuariaId)));
            if (unpopulatedUids.length > 0) {
                try {
                    const nameMap: Record<string, string> = {};
                    const orphanedUids = new Set<string>();
                    
                    await Promise.all(unpopulatedUids.map(async (uid) => {
                        const snap = await getDoc(doc(db, "programs", globalActiveYear, "usuarias", uid));
                        if (snap.exists()) {
                            const data = snap.data();
                            nameMap[uid] = data.identity?.fullName || data.nombreCompleto || `ID: ${uid.slice(0, 6)}`;
                        } else {
                            // La persona fue eliminada → esta cita es huérfana
                            orphanedUids.add(uid);
                        }
                    }));
                    
                    // Auto-limpiar citas huérfanas de la base de datos
                    if (orphanedUids.size > 0) {
                        const orphanedCitas = results.filter(c => orphanedUids.has(c.usuariaId));
                        if (orphanedCitas.length > 0) {
                            try {
                                const { writeBatch } = await import("firebase/firestore");
                                const batch = writeBatch(db);
                                orphanedCitas.forEach(c => {
                                    if (c.id) {
                                        batch.delete(doc(db, "programs", globalActiveYear, "citas", c.id));
                                    }
                                });
                                await batch.commit();
                                console.log(`[AGENDA] Auto-limpieza: ${orphanedCitas.length} citas de personas eliminadas borradas.`);
                            } catch (e) {
                                console.error("[AGENDA] Error limpiando citas huérfanas:", e);
                            }
                        }
                        // Filtrar las huérfanas del resultado visible
                        results = results.filter(c => !orphanedUids.has(c.usuariaId));
                    }

                    results = results.map(c => {
                        if (!c.usuariaName && nameMap[c.usuariaId]) {
                            return { ...c, usuariaName: nameMap[c.usuariaId] };
                        }
                        return c;
                    });
                } catch (e) {
                    console.error("Error al obtener nombres faltantes", e);
                }
            }

            // Sort by Date & Time
            results.sort((a, b) => {
                const da = new Date(`${a.date}T${a.startTime}`);
                const db = new Date(`${b.date}T${b.startTime}`);
                return da.getTime() - db.getTime();
            });

            setCitas(results);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const confirmTakeover = async () => {
        if (!takeoverCitaId || !user || !globalActiveYear) return;
        setIsTakingOver(true);
        try {
            const docRef = doc(db, "programs", globalActiveYear, "citas", takeoverCitaId);
            const targetCita = citas.find(c => c.id === takeoverCitaId);

            const sanitizedUpdate = sanitizeForFirestoreDeep({
                internoAtendioId: user.uid,
                coverage: {
                    replacedInternId: targetCita?.internoPlanificadoId || null,
                    reason: takeoverReason,
                    at: new Date().toISOString()
                },
                updatedAt: new Date().toISOString()
            });

            await updateDoc(docRef, sanitizedUpdate);

            setTakeoverCitaId(null);
            fetchAgenda();
        } catch (error) {
            console.error(error);
            alert("Error al registrar reemplazo");
        } finally {
            setIsTakingOver(false);
        }
    };

    const confirmAction = async () => {
        if (!actionCitaId || !user || !globalActiveYear) return;
        if (!actionReason.trim()) return alert("Debe proveer un motivo.");

        setIsProcessingAction(true);
        try {
            const docRef = doc(db, "programs", globalActiveYear, "citas", actionCitaId);

            const payload: any = {
                status: actionType === 'NO_SHOW' ? 'NO_SHOW' : 'CANCELLED',
                updatedAt: new Date().toISOString()
            };

            if (actionType === 'NO_SHOW') payload.noShowReason = actionReason;
            if (actionType === 'CANCEL') payload.cancelReason = actionReason;

            const sanitizedPayload = sanitizeForFirestoreDeep(payload);
            await updateDoc(docRef, sanitizedPayload);

            setActionCitaId(null);
            setActionReason('');
            fetchAgenda();
        } catch (error) {
            console.error(error);
            alert("Error al procesar la acción.");
        } finally {
            setIsProcessingAction(false);
        }
    };

    const confirmSelfAssign = async (targetCita: Cita) => {
        if (!user || !globalActiveYear) return;
        try {
            // 1. Vincular en la Cita
            const citaRef = doc(db, "programs", globalActiveYear, "citas", targetCita.id);
            await updateDoc(citaRef, sanitizeForFirestoreDeep({
                internoPlanificadoId: user.uid,
                updatedAt: new Date().toISOString()
            }));

            // 2. Vincular en la Persona Usuaria (Asignación Permanente)
            const usuariaRef = doc(db, "programs", globalActiveYear, "usuarias", targetCita.usuariaId);
            await updateDoc(usuariaRef, sanitizeForFirestoreDeep({
                assignedInternId: user.uid,
                assignedInternName: user.displayName || user.email,
                updatedAt: new Date().toISOString()
            }));

            fetchAgenda();
        } catch (error) {
            console.error("Error al auto-asignar paciente:", error);
            alert("No se pudo vincular el paciente.");
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[800px]">
            {/* Header / Toolbars */}
            <div className="bg-slate-50/80 border-b border-slate-200 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-600" />
                        <span>Agenda Extendida</span>
                    </h2>
                    <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto justify-stretch">
                        <button
                            onClick={() => setViewMode('HOY')}
                            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'HOY' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => setViewMode('SEMANA')}
                            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'SEMANA' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Semana
                        </button>
                    </div>
                </div>

                {/* Filtros Secundarios Adaptativos para Móvil (iPhone/Android) */}
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
                    <select
                        value={filterScope}
                        onChange={(e) => setFilterScope(e.target.value as any)}
                        className="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 outline-none w-full sm:w-auto"
                    >
                        <option value="MIS_CITAS">👤 Mis Citas Asignadas</option>
                        <option value="TODAS">🌐 Agenda General (Todos)</option>
                    </select>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 outline-none w-full sm:w-auto"
                    >
                        <option value="ACTIVAS">Programadas y Completadas</option>
                        <option value="ALL">Histórico Completo (Incluir Canceladas)</option>
                    </select>
                </div>
            </div>

            {/* Listado Body */}
            <div className="flex-1 overflow-y-auto bg-slate-50/40 p-4 space-y-3 custom-scrollbar">
                {/* Banner de Feriado (Fase 2.3.6) */}
                {!loading && viewMode === 'HOY' && holidays.some(h => h.date === format(baseDate, 'yyyy-MM-dd')) && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3 shadow-sm mb-4">
                        <AlertTriangle className="w-5 h-5 text-rose-500 mt-0.5 shrink-0" />
                        <div>
                            <h4 className="font-bold text-rose-900 text-xs uppercase tracking-wider">Día Feriado / Bloqueado</h4>
                            <p className="text-xs text-rose-700 mt-0.5">La generación automática ignoró este día. Las citas vistas aquí fueron forzadas o desplazadas manualmente.</p>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12 text-slate-400 font-bold text-xs animate-pulse">Consultando Itinerario de Atenciones...</div>
                ) : citas.length === 0 ? (
                    <div className="text-center py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                            <CalendarCheck2 className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-slate-800 font-bold text-base">Sin citas para este rango</h4>
                            <p className="text-slate-500 text-xs max-w-sm mx-auto">No tienes atenciones programadas para el periodo seleccionado. Ajusta los filtros o revisa la lista de Personas Usuarias.</p>
                        </div>
                    </div>
                ) : (
                    citas.map(cita => {
                        const isScheduled = cita.status === 'SCHEDULED';
                        const isCompleted = cita.status === 'COMPLETED';

                        // Determinar si soy el planificado o quien atendió
                        const iAmPlanned = cita.internoPlanificadoId === user?.uid;
                        const iAmAttending = cita.internoAtendioId === user?.uid;
                        const isMyPatient = iAmPlanned || iAmAttending;

                        return (
                            <div key={cita.id} className={`bg-white border rounded-2xl overflow-hidden shadow-xs transition-all hover:shadow-md ${isScheduled ? 'border-slate-200' : 'border-slate-200 opacity-80'}`}>
                                <div className="flex flex-col sm:flex-row">
                                    {/* Left Slot: Time & Status */}
                                    <div className={`sm:w-32 flex flex-row sm:flex-col items-center justify-between sm:justify-center p-4 border-b sm:border-b-0 sm:border-r border-slate-100 ${isScheduled ? 'bg-indigo-50/40' : 'bg-slate-50'}`}>
                                        <div className="text-center">
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">{format(new Date(cita.date + "T00:00:00"), "d MMM", { locale: es })}</div>
                                            <div className="text-lg font-black text-slate-800">{cita.startTime}</div>
                                            <div className="text-[11px] font-semibold text-slate-400">{cita.endTime}</div>
                                        </div>
                                        {/* Status Badge */}
                                        <div className="mt-0 sm:mt-2">
                                            {isScheduled && <span className="bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Esperando</span>}
                                            {isCompleted && <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Atendido</span>}
                                            {cita.status === 'CANCELLED' && <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">Anulada</span>}
                                        </div>
                                    </div>

                                    {/* Right Slot: Patient & Actions */}
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <h4 className="font-bold text-slate-900 text-base">{cita.usuariaName || `Ficha Clínica (ID: ${cita.usuariaId.slice(0, 6)})`}</h4>
                                                    
                                                    {/* Badges de Asignación sin IDs raros */}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold text-[10px]">
                                                            Atención Kinesiología
                                                        </span>
                                                        {isMyPatient ? (
                                                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-md font-bold text-[10px] flex items-center gap-1">
                                                                <UserCheck className="w-3 h-3" />
                                                                Asignado a ti
                                                            </span>
                                                        ) : (
                                                            <span className="bg-slate-50 text-slate-400 border border-slate-200/60 px-2 py-0.5 rounded-md font-medium text-[10px]">
                                                                Sin Asignación Permanente
                                                            </span>
                                                        )}
                                                    </div>

                                                    {cita.shortReason && (
                                                        <p className="text-xs text-slate-600 mt-2 italic line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                            &ldquo;{cita.shortReason}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Sub-Badges (Ej: Atendido por Reemplazo) */}
                                            {cita.coverage && (
                                                <div className="mt-2 text-[11px] bg-sky-50 text-sky-700 py-1 px-2.5 rounded-lg font-bold inline-flex items-center gap-1 border border-sky-100">
                                                    <span>Cobertura asumida por reemplazo</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Acciones del Interno en la Tarjeta */}
                                        <div className="mt-4 flex gap-2 justify-end items-center flex-wrap pt-3 border-t border-slate-100">
                                            <Link href={`/app/usuarios?openFicha=${cita.usuariaId}`} className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition">
                                                Ver Ficha
                                            </Link>

                                            {!isMyPatient && isScheduled && (
                                                <button
                                                    onClick={() => confirmSelfAssign(cita)}
                                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl hover:bg-indigo-100 transition inline-flex items-center gap-1"
                                                >
                                                    <UserPlus className="w-3.5 h-3.5" />
                                                    <span>Vincular como Mi Paciente</span>
                                                </button>
                                            )}

                                            {isScheduled && (
                                                <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
                                                    <button
                                                        onClick={() => { setActionCitaId(cita.id); setActionType('NO_SHOW'); setActionReason(''); }}
                                                        className="px-2.5 py-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 text-xs font-bold rounded-xl transition"
                                                    >
                                                        No Show
                                                    </button>
                                                    <button
                                                        onClick={() => { setActionCitaId(cita.id); setActionType('CANCEL'); setActionReason(''); }}
                                                        className="px-2.5 py-1.5 text-slate-600 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-xl transition"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <Link
                                                        href={`/app/usuarios?openFicha=${cita.usuariaId}&action=evolucionar`}
                                                        className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition"
                                                    >
                                                        + Evolucionar Cita
                                                    </Link>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Modal de Takeover / Reemplazo */}
            {takeoverCitaId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="bg-indigo-600 px-5 py-4 text-white">
                            <h3 className="font-bold text-lg">Asumir Cobertura</h3>
                            <p className="text-indigo-100 text-xs">Estás por hacerte cargo de una cita que no te estaba planificada directamente.</p>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Motivo de la Suplencia</label>
                                <select
                                    value={takeoverReason}
                                    onChange={e => setTakeoverReason(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-medium"
                                >
                                    <option value="ausente">Interno regular ausente</option>
                                    <option value="cambio_bloque">Cambio de bloque horario</option>
                                    <option value="apoyo">Apoyo a compañeros (mucha carga)</option>
                                    <option value="otro">Otro / Ajuste especial</option>
                                </select>
                            </div>
                            <div className="bg-amber-50 text-amber-800 p-3 rounded-lg text-xs font-medium border border-amber-200">
                                Emitiremos un registro de trazabilidad ("Coverage") en la cita. Luego de esto el botón "Iniciar Tratamiento" quedará destrabado para ti.
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2">
                            <button
                                onClick={() => setTakeoverCitaId(null)}
                                disabled={isTakingOver}
                                className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmTakeover}
                                disabled={isTakingOver}
                                className="w-full sm:w-auto px-4 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition shadow flex items-center justify-center gap-2"
                            >
                                {isTakingOver ? "Cargando..." : "Confirmar Tópico"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Acción Secundaria (No Show / Cancel) */}
            {actionCitaId && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className={`px-5 py-4 text-white ${actionType === 'NO_SHOW' ? 'bg-rose-600' : 'bg-slate-700'}`}>
                            <h3 className="font-bold text-lg">{actionType === 'NO_SHOW' ? 'Diligenciar Inasistencia (No Show)' : 'Anular Cita'}</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Motivo Explicativo</label>
                                <textarea
                                    value={actionReason}
                                    onChange={e => setActionReason(e.target.value)}
                                    placeholder={actionType === 'NO_SHOW' ? "Ej. Paciente avisa tarde, o no llega a la hora." : "Ej. Error de agenda, tope de horarios, etc."}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-100 text-sm font-medium resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-2">
                            <button
                                onClick={() => { setActionCitaId(null); setActionReason(''); }}
                                disabled={isProcessingAction}
                                className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition text-center"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={isProcessingAction}
                                className={`w-full sm:w-auto px-4 py-2 text-sm font-bold text-white rounded-lg transition shadow flex items-center justify-center gap-2 ${actionType === 'NO_SHOW' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                            >
                                {isProcessingAction ? "Guardando..." : "Confirmar Acción"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
