"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, getDoc, limit, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth, AppUser } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { Cita, Evolucion } from "@/types/clinica";
import { AgendaProView } from "@/components/AgendaProView";
import { AgendaGridView } from "@/components/AgendaGridView";
import { UsersService } from "@/services/users";
import { addDays, format, startOfWeek, subDays } from "date-fns";
import Link from "next/link";
import { 
    Calendar, 
    CheckCircle2, 
    Clock, 
    AlertCircle, 
    MessageSquare, 
    UserCheck, 
    LayoutList, 
    LayoutGrid,
    ChevronRight,
    Sparkles,
    CalendarPlus
} from "lucide-react";

/**
 * Enlace profundo hacia un borrador concreto.
 *
 * Antes el aviso solo llevaba `openFicha` + `action=EVOLUCIONAR`, y esa acción
 * abre SIEMPRE un formulario vacío: el borrador pendiente quedaba atrapado y
 * cada clic generaba un documento nuevo. Enviando `recordId` y `procesoId` el
 * timeline abre exactamente el registro que se está reclamando.
 */
function buildDraftHref(item: { usuariaId?: string; id?: string; procesoId?: string }) {
    if (!item?.usuariaId) return '/app/usuarios';
    const params = new URLSearchParams({ openFicha: item.usuariaId });
    if (item.procesoId) params.set('procesoId', item.procesoId);
    if (item.id) {
        params.set('recordId', item.id);
        params.set('recordType', 'evolucion');
    } else {
        params.set('action', 'EVOLUCIONAR');
    }
    return `/app/usuarios?${params.toString()}`;
}

export default function DashboardPage() {
    const [layoutMode, setLayoutMode] = useState<'LISTA' | 'GRILLA'>('LISTA');
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Data para la grilla
    const [gridCitas, setGridCitas] = useState<(Cita & { internName?: string })[]>([]);
    const [gridLoading, setGridLoading] = useState(false);
    const [gridScope, setGridScope] = useState<string>('TODAS');
    const [gridWeekOffset, setGridWeekOffset] = useState(0);
    const [internosList, setInternosList] = useState<AppUser[]>([]);

    // Alertas y Notificaciones Específicas del Interno
    const [docenteFeedbackList, setDocenteFeedbackList] = useState<any[]>([]);
    const [yesterdayDrafts, setYesterdayDrafts] = useState<any[]>([]);
    const [discardingId, setDiscardingId] = useState<string | null>(null);

    /**
     * Descarta un borrador propio directamente desde el aviso.
     *
     * La consulta que alimenta esta lista ya filtra por `audit.createdBy` igual
     * al usuario en sesión, así que aquí solo aparecen borradores propios.
     */
    const discardDraft = async (item: { id: string; usuariaName?: string }) => {
        if (!globalActiveYear || !item?.id) return;
        if (!window.confirm(
            `¿Descartar el borrador de ${item.usuariaName || 'esta persona'}?\n\n`
            + "Desaparecerá de tus evoluciones pendientes y no podrás recuperarlo.\n"
            + "Úsalo solo si lo abriste por error."
        )) return;

        setDiscardingId(item.id);
        try {
            await deleteDoc(doc(db, "programs", globalActiveYear, "evoluciones", item.id));
            setYesterdayDrafts(prev => prev.filter(draft => draft.id !== item.id));
        } catch (error) {
            console.error("No se pudo descartar el borrador", error);
            alert("No se pudo descartar el borrador. Revisa tu conexión y reintenta.");
        } finally {
            setDiscardingId(null);
        }
    };
    const [unevolvedTodayCitas, setUnevolvedTodayCitas] = useState<Cita[]>([]);
    const [todayCompletedCount, setTodayCompletedCount] = useState<number>(0);
    const [todayTotalCount, setTodayTotalCount] = useState<number>(0);

    useEffect(() => {
        if (user && user.role === 'DOCENTE') {
            UsersService.getInterns().then(setInternosList).catch(console.error);
        }
    }, [user]);

    // Cargar alertas específicas para el interno en sesión
    useEffect(() => {
        // Estas tarjetas se muestran únicamente a internos. Evitar que cada
        // visita docente descargue evoluciones y personas usuarias completas.
        if (!globalActiveYear || !user || user.role !== 'INTERNO') return;

        const fetchInternAlerts = async () => {
            try {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

                // 1. Citas de hoy del interno
                const citasRef = collection(db, "programs", globalActiveYear, "citas");
                const qToday = query(
                    citasRef, 
                    where("date", "==", todayStr)
                );
                const snapToday = await getDocs(qToday);
                const myTodayCitas: Cita[] = [];
                let completedCount = 0;

                snapToday.docs.forEach(d => {
                    const data = { id: d.id, ...d.data() } as Cita;
                    if (data.internoPlanificadoId === user.uid || data.internoAtendioId === user.uid) {
                        myTodayCitas.push(data);
                        if (data.status === 'COMPLETED') completedCount++;
                    }
                });

                setTodayTotalCount(myTodayCitas.length);
                setTodayCompletedCount(completedCount);
                setUnevolvedTodayCitas(myTodayCitas.filter(c => c.status === 'SCHEDULED'));

                // 2. Evoluciones del interno actual. El campo audit.createdBy es
                // el campo normalizado que escriben los formularios actuales;
                // limitar la consulta impide que el dashboard lea todo el año.
                const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");
                const snapEvols = await getDocs(query(
                    evolsRef,
                    where("audit.createdBy", "==", user.uid),
                    limit(100),
                ));
                
                const feedbackItems: any[] = [];
                const yesterdayItems: any[] = [];

                snapEvols.docs.forEach(d => {
                    const data = d.data() as Evolucion;
                    const pid = (data as any).personaUsuariaId || (data as any).usuariaId || '';
                    
                    if (pid) {

                        // Feedback docente real (docenteComment o docenteFeedback)
                        const realFeedback = (data as any).docenteComment || (data as any).docenteFeedback;
                        if (realFeedback && typeof realFeedback === 'string' && realFeedback.trim() !== '') {
                            feedbackItems.push({
                                id: d.id,
                                usuariaId: pid,
                                usuariaName: (data as any).usuariaName || 'Persona usuaria',
                                feedback: realFeedback,
                                date: data.sessionAt || ''
                            });
                        }

                        // Borrador de días anteriores sin cerrar (perteneciente a este interno).
                        // Las fichas antiguas guardaban el estado en `estado`, no en
                        // `status`; si solo miramos `status` esos borradores quedan
                        // invisibles y nunca se firman.
                        const isDraft = data.status === 'DRAFT'
                            || (data as any).estado === 'BORRADOR';
                        const rawSessionAt = data.sessionAt || (data as any).fechaHoraAtencion || '';
                        if (isDraft && rawSessionAt && String(rawSessionAt).split('T')[0] < todayStr) {
                            let formattedDate = rawSessionAt;
                            try {
                                formattedDate = format(new Date(rawSessionAt), 'dd/MM/yyyy');
                            } catch (e) {}

                            yesterdayItems.push({
                                id: d.id,
                                usuariaId: pid,
                                // El proceso es imprescindible: sin él el enlace abre
                                // el primer proceso activo, que puede no ser el del borrador.
                                procesoId: (data as any).procesoId || '',
                                sessionAt: String(rawSessionAt),
                                usuariaName: (data as any).usuariaName || 'Persona usuaria',
                                date: formattedDate
                            });
                        }
                    }
                });

                // Resolver nombres solo para los avisos que realmente se van a
                // mostrar (máximo 10), en vez de cargar toda la colección.
                // La consulta no puede ordenar en servidor sin un índice compuesto
                // nuevo, así que ordenamos aquí antes de recortar: de lo contrario
                // se mostraban los primeros cinco que llegaron, no los más recientes.
                const visibleFeedback = feedbackItems
                    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
                    .slice(0, 5);
                const visibleDrafts = yesterdayItems
                    .sort((a, b) => String(b.sessionAt || '').localeCompare(String(a.sessionAt || '')))
                    .slice(0, 5);
                const visiblePatientIds = Array.from(new Set([
                    ...visibleFeedback.map(item => item.usuariaId),
                    ...visibleDrafts.map(item => item.usuariaId),
                ].filter(Boolean)));
                const patientNames = new Map<string, string>();
                await Promise.all(visiblePatientIds.map(async (patientId) => {
                    const patientSnap = await getDoc(doc(
                        db,
                        "programs",
                        globalActiveYear,
                        "usuarias",
                        patientId,
                    ));
                    if (patientSnap.exists()) {
                        const patient = patientSnap.data();
                        patientNames.set(
                            patientId,
                            patient.identity?.fullName || patient.nombreCompleto || "Persona usuaria",
                        );
                    }
                }));

                const withResolvedNames = (items: any[]) => items.map(item => ({
                    ...item,
                    usuariaName: patientNames.get(item.usuariaId) || item.usuariaName,
                }));
                setDocenteFeedbackList(withResolvedNames(visibleFeedback));
                setYesterdayDrafts(withResolvedNames(visibleDrafts));

            } catch (err) {
                console.error("Error cargando alertas de interno:", err);
            }
        };

        fetchInternAlerts();
    }, [globalActiveYear, user]);

    // Cargar citas para la vista de grilla
    useEffect(() => {
        if (layoutMode !== 'GRILLA' || !globalActiveYear || !user) return;

        const fetchGridData = async () => {
            setGridLoading(true);
            try {
                const citasRef = collection(db, "programs", globalActiveYear, "citas");
                const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
                const rangeStart = addDays(weekStart, gridWeekOffset * 7);
                const rangeEnd = addDays(rangeStart, 4);
                // La grilla visualiza una sola semana laboral: consultarla por
                // rango de fecha evita descargar cada cita histórica o futura.
                const snap = await getDocs(query(
                    citasRef,
                    where("date", ">=", format(rangeStart, "yyyy-MM-dd")),
                    where("date", "<=", format(rangeEnd, "yyyy-MM-dd")),
                ));
                const activeStatuses = ["SCHEDULED", "COMPLETED", "NO_SHOW"];
                let allCitas = snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as Cita & { internName?: string }))
                    .filter(cita => activeStatuses.includes(cita.status));

                const nameMap: Record<string, string> = {};
                const internNameMap: Record<string, string> = {};
                
                internosList.forEach(int => {
                    internNameMap[int.uid] = int.displayName || int.email?.split('@')[0] || '';
                });
                
                if (!internNameMap[user.uid]) {
                    internNameMap[user.uid] = user.displayName || 'Tú';
                }

                const orphanIds = new Set<string>();
                const unpopulatedVars = Array.from(new Set(allCitas.filter(c => !c.usuariaName).map(c => c.usuariaId)));
                if (unpopulatedVars.length > 0) {
                    await Promise.all(unpopulatedVars.map(async (uid) => {
                        try {
                            const snap = await getDoc(doc(db, "programs", globalActiveYear, "usuarias", uid));
                            if (snap.exists()) {
                                const data = snap.data();
                                nameMap[uid] = data.identity?.fullName || data.nombreCompleto || `ID: ${uid.slice(0, 6)}`;
                            } else {
                                orphanIds.add(uid);
                            }
                        } catch { }
                    }));
                }

                allCitas = allCitas.filter(c => !orphanIds.has(c.usuariaId)).map(c => {
                    const result = { ...c };
                    if (!result.usuariaName && nameMap[result.usuariaId]) {
                        result.usuariaName = nameMap[result.usuariaId];
                    }
                    return result;
                });

                if (gridScope === 'TODAS') {
                    setGridCitas(allCitas);
                } else if (gridScope === 'MIS_CITAS') {
                    setGridCitas(allCitas.filter(c =>
                        c.internoPlanificadoId === user.uid || c.internoAtendioId === user.uid
                    ));
                } else {
                    setGridCitas(allCitas.filter(c =>
                        c.internoPlanificadoId === gridScope || c.internoAtendioId === gridScope
                    ));
                }

            } catch (error) {
                console.error("Error cargando grilla:", error);
            } finally {
                setGridLoading(false);
            }
        };

        fetchGridData();
    }, [layoutMode, globalActiveYear, user, gridScope, internosList, gridWeekOffset]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header del Dashboard */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/80 pb-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Agenda & Atenciones</h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium">Gestor de atenciones diarias, asignaciones e historial clínico.</p>
                </div>

                {/* Layout Switcher */}
                <div className="flex items-center gap-2 self-stretch sm:self-auto">
                    <div className="flex bg-slate-200/70 p-1 rounded-xl w-full sm:w-auto">
                        <button
                            onClick={() => setLayoutMode('LISTA')}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${layoutMode === 'LISTA' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutList className="w-4 h-4" />
                            <span>Lista</span>
                        </button>
                        <button
                            onClick={() => setLayoutMode('GRILLA')}
                            className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${layoutMode === 'GRILLA' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span>Grilla</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Tarjetas KPI de Estado Rápido para el Interno */}
            {user?.role === 'INTERNO' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Atenciones de Hoy</span>
                            <span className="text-xl font-black text-slate-900 block leading-tight">{todayTotalCount} Pacientes</span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Completados / Firmados</span>
                            <span className="text-xl font-black text-slate-900 block leading-tight">{todayCompletedCount} Atendidos</span>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${unevolvedTodayCitas.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Pendientes de Hoy</span>
                            <span className="text-xl font-black text-slate-900 block leading-tight">{unevolvedTodayCitas.length} por Evolucionar</span>
                        </div>
                    </div>
                </div>
            )}

            {/* SECCIÓN DINÁMICA: Observaciones / Feedback Docente (Solo se renderiza si EXISTEN) */}
            {docenteFeedbackList.length > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-center gap-2 text-amber-800 font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span>Observaciones y Feedback Docente Pendiente</span>
                    </div>

                    <div className="space-y-2">
                        {docenteFeedbackList.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-xl border border-amber-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-900 block">{item.usuariaName}</span>
                                    <p className="text-xs text-slate-600 italic mt-0.5">&ldquo;{item.feedback}&rdquo;</p>
                                </div>
                                <Link
                                    href={buildDraftHref(item)}
                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition shrink-0 inline-flex items-center gap-1"
                                >
                                    <span>Ver y Corregir</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECCIÓN DINÁMICA: Borradores / Pendientes de Ayer (Solo se renderiza si EXISTEN) */}
            {yesterdayDrafts.length > 0 && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-2xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-rose-600" />
                        <span>Evoluciones Pendientes de Firmar (Días Anteriores)</span>
                    </div>

                    <div className="space-y-2">
                        {yesterdayDrafts.map(item => (
                            <div key={item.id} className="bg-white p-3 rounded-xl border border-rose-200 flex justify-between items-center gap-2">
                                <div>
                                    <span className="text-xs font-bold text-slate-900 block">{item.usuariaName}</span>
                                    <span className="text-[10px] text-rose-600 font-semibold block">Borrador no cerrado del {item.date}</span>
                                    <span className="text-[10px] text-slate-400 font-medium block">Registro {String(item.id).slice(0, 8)}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <Link
                                        href={buildDraftHref(item)}
                                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition"
                                    >
                                        Firmar Evolución
                                    </Link>
                                    {/* Un borrador abierto por error quedaba pendiente para
                                        siempre: la interna no tenía forma de sacarlo sola. */}
                                    <button
                                        type="button"
                                        onClick={() => discardDraft(item)}
                                        disabled={discardingId === item.id}
                                        className="px-2.5 py-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-lg transition disabled:opacity-40"
                                        title="Eliminar este borrador si lo abriste por error"
                                    >
                                        {discardingId === item.id ? '…' : 'Descartar'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Vistas Principales (Lista vs Grilla) */}
            {layoutMode === 'LISTA' ? (
                <AgendaProView />
            ) : (
                <div className="space-y-4">
                    {/* Filtros de la Grilla */}
                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={gridScope}
                            onChange={(e) => setGridScope(e.target.value)}
                            className="bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-100 outline-none shadow-xs w-full sm:w-auto"
                        >
                            <option value="TODAS">📅 Agenda General (Todos)</option>
                            <option value="MIS_CITAS">👤 Solo Mis Citas</option>
                            
                            {user && user.role === 'DOCENTE' && internosList.length > 0 && (
                                <optgroup label="Filtrar por Interno">
                                    {internosList.map(int => (
                                        <option key={int.uid} value={int.uid}>
                                            🎓 {int.displayName || int.email?.split('@')[0]}
                                        </option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                    </div>
                    <AgendaGridView
                        citas={gridCitas}
                        loading={gridLoading}
                        weekOffset={gridWeekOffset}
                        onWeekOffsetChange={setGridWeekOffset}
                    />
                </div>
            )}
        </div>
    );
}
