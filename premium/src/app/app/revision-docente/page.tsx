"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth, AppUser } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { Evaluacion, Evolucion } from "@/types/clinica";

type RecordKind = "EVALUACION" | "EVOLUCION";
type Filter = "TODOS" | "PENDIENTES" | "BORRADORES" | "ALERTAS";

interface ReviewRecord {
    id: string;
    kind: RecordKind;
    patientId: string;
    patientName: string;
    authorUid?: string;
    authorName: string;
    sessionAt?: string;
    status?: string;
    summary: string;
    missing: string[];
    alerts: string[];
    raw: Evaluacion | Evolucion;
}

const safeText = (value: unknown) => typeof value === "string" ? value.trim() : "";

const hasValue = (value: unknown) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object" && value !== null) return Object.keys(value).length > 0;
    return Boolean(value);
};

function getEvaluationReview(raw: Evaluacion, patientName: string): ReviewRecord {
    const record = raw as any;
    const missing: string[] = [];
    const alerts: string[] = [];
    const isInitial = raw.type === "INITIAL";

    if (raw.status === "DRAFT") alerts.push("Evaluación guardada como borrador");
    if (isInitial) {
        if (!hasValue(record.interview)) missing.push("Entrevista/anamnesis");
        if (!hasValue(record.guidedExam)) missing.push("Examen físico");
        if (!hasValue(record.autoSynthesis) && !hasValue(record.p3_case_organizer)) missing.push("Síntesis clínica");
        if (!hasValue(record.p4_plan_structured) && !hasValue(record.geminiDiagnostic)) missing.push("Diagnóstico, objetivos o plan");

        const safety = record.interview?.v4?.seguridad;
        const clinicalAlerts = record.autoSynthesis?.snapshot_clinico?.alertas_clinicas || record.autoSynthesis?.recordatorios_y_coherencia?.incoherencias_detectadas;
        if (record.autoSynthesis?.trafficLight === "Rojo" || safety?.overrideUrgenciaMedica) alerts.push("Alerta clínica que requiere supervisión");
        if (Array.isArray(clinicalAlerts) && clinicalAlerts.length > 0) alerts.push("La ficha contiene alertas o incoherencias registradas");
    } else {
        if (!hasValue(record.reevaluation?.progressSummary)) missing.push("Resumen de progreso");
        if (!hasValue(record.reevaluation?.retest)) missing.push("Re-test o medida de seguimiento");
        if (!hasValue(record.reevaluation?.planModifications)) missing.push("Ajuste del plan");
    }

    const summary = isInitial
        ? safeText(record.p4_plan_structured?.diagnostico_kinesiologico_narrativo) || safeText(record.geminiDiagnostic?.narrativeDiagnosis) || safeText(record.clinicalSynthesis) || "Sin resumen clínico disponible."
        : safeText(record.reevaluation?.progressSummary) || "Sin resumen de progreso disponible.";

    return {
        id: raw.id || crypto.randomUUID(),
        kind: "EVALUACION",
        patientId: raw.usuariaId,
        patientName,
        authorUid: raw.audit?.createdBy,
        authorName: raw.clinicianResponsible || "Profesional no identificado",
        sessionAt: raw.sessionAt,
        status: raw.status,
        summary,
        missing,
        alerts,
        raw,
    };
}

function getEvolutionReview(raw: Evolucion, patientName: string): ReviewRecord {
    const record = raw as any;
    const missing: string[] = [];
    const alerts: string[] = [];
    const interventions = record.interventions;

    if (raw.status === "DRAFT" || record.estado === "BORRADOR") alerts.push("Evolución guardada como borrador");
    if (!hasValue(raw.sessionGoal || record.objetivoSesion)) missing.push("Objetivo de sesión");
    if (!hasValue(interventions) || (Array.isArray(interventions) && interventions.length === 0)) missing.push("Intervenciones registradas");
    if (!hasValue(raw.nextPlan || record.planProximaSesionLegacy)) missing.push("Plan para la próxima sesión");
    if (!hasValue(raw.pain || record.dolorInicio !== undefined || record.dolorSalida !== undefined)) missing.push("Registro de dolor");
    if (!hasValue(raw.objectiveWork) && !hasValue(raw.selectedObjectiveIds)) missing.push("Vinculación con objetivos del proceso");
    if (raw.pain?.contradictionReason) alerts.push("Dolor aumentó: revisar la justificación clínica");
    if (raw.sessionStatus && raw.sessionStatus !== "Realizada") alerts.push(`Sesión: ${raw.sessionStatus}`);

    return {
        id: raw.id || crypto.randomUUID(),
        kind: "EVOLUCION",
        patientId: raw.usuariaId,
        patientName,
        authorUid: raw.audit?.createdBy || record.autorUid,
        authorName: raw.clinicianResponsible || record.autorName || "Profesional no identificado",
        sessionAt: raw.sessionAt || record.fechaHoraAtencion,
        status: raw.status || record.estado,
        summary: safeText(raw.sessionGoal || record.objetivoSesion) || "Sin objetivo de sesión disponible.",
        missing,
        alerts,
        raw,
    };
}

function formatDate(value?: string) {
    if (!value) return "Fecha no registrada";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Fecha no registrada" : date.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

export default function RevisionDocentePage() {
    const { user } = useAuth();
    const { globalActiveYear } = useYear();
    const router = useRouter();
    const [records, setRecords] = useState<ReviewRecord[]>([]);
    const [interns, setInterns] = useState<AppUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<Filter>("PENDIENTES");
    const [kind, setKind] = useState<"TODOS" | RecordKind>("TODOS");
    const [internId, setInternId] = useState("TODOS");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<ReviewRecord | null>(null);

    const loadInbox = useCallback(async () => {
        if (!globalActiveYear || user?.role !== "DOCENTE") return;
        setLoading(true);
        setError(null);
        try {
            const base = ["programs", globalActiveYear] as const;
            const [evaluationsSnap, evolutionsSnap, patientsSnap, usersSnap] = await Promise.all([
                getDocs(collection(db, ...base, "evaluaciones")),
                getDocs(collection(db, ...base, "evoluciones")),
                getDocs(collection(db, ...base, "usuarias")),
                getDocs(collection(db, "users")),
            ]);

            const patientNames = new Map<string, string>();
            patientsSnap.docs.forEach(snapshot => {
                const data = snapshot.data() as any;
                patientNames.set(snapshot.id, data.identity?.fullName || data.nombreCompleto || `Persona ${snapshot.id.slice(0, 6)}`);
            });

            const fetchedInterns = usersSnap.docs
                .map(snapshot => ({ uid: snapshot.id, ...snapshot.data() } as AppUser))
                .filter(person => person.role === "INTERNO")
                .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
            setInterns(fetchedInterns);

            const reviews = [
                ...evaluationsSnap.docs.map(snapshot => getEvaluationReview({ id: snapshot.id, ...snapshot.data() } as Evaluacion, patientNames.get(snapshot.data().usuariaId) || "Persona usuaria no encontrada")),
                ...evolutionsSnap.docs.map(snapshot => getEvolutionReview({ id: snapshot.id, ...snapshot.data() } as Evolucion, patientNames.get(snapshot.data().usuariaId) || "Persona usuaria no encontrada")),
            ].sort((a, b) => new Date(b.sessionAt || 0).getTime() - new Date(a.sessionAt || 0).getTime());

            setRecords(reviews);
            setSelected(current => current ? reviews.find(item => item.id === current.id) || null : null);
        } catch (loadError) {
            console.error("Error cargando bandeja docente:", loadError);
            setError("No pudimos cargar la bandeja. Reintenta; no se modificó ningún registro.");
        } finally {
            setLoading(false);
        }
    }, [globalActiveYear, user?.role]);

    useEffect(() => { loadInbox(); }, [loadInbox]);

    const visibleRecords = useMemo(() => records.filter(record => {
        const matchesKind = kind === "TODOS" || record.kind === kind;
        const matchesIntern = internId === "TODOS" || record.authorUid === internId;
        const text = `${record.patientName} ${record.authorName} ${record.summary}`.toLowerCase();
        const matchesSearch = text.includes(search.trim().toLowerCase());
        const isDraft = record.status === "DRAFT" || record.status === "BORRADOR";
        const isPending = isDraft || record.missing.length > 0 || record.alerts.length > 0;
        const matchesFilter = filter === "TODOS" || (filter === "BORRADORES" && isDraft) || (filter === "ALERTAS" && record.alerts.length > 0) || (filter === "PENDIENTES" && isPending);
        return matchesKind && matchesIntern && matchesSearch && matchesFilter;
    }), [records, kind, internId, search, filter]);

    const counts = useMemo(() => ({
        all: records.length,
        pending: records.filter(record => record.status === "DRAFT" || record.status === "BORRADOR" || record.missing.length > 0 || record.alerts.length > 0).length,
        drafts: records.filter(record => record.status === "DRAFT" || record.status === "BORRADOR").length,
        alerts: records.filter(record => record.alerts.length > 0).length,
    }), [records]);

    if (user?.role !== "DOCENTE") {
        return <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-6 text-amber-900">Esta bandeja está disponible solo para el equipo docente.</div>;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-8">
            <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2"><span className="w-2 h-2 rounded-full bg-indigo-500" /> Supervisión clínica</div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">Bandeja docente</h1>
                    <p className="mt-2 text-slate-600 max-w-2xl">Vista de revisión para evaluaciones y evoluciones del año {globalActiveYear}. Esta primera versión es solo lectura: no cambia fichas, no envía feedback y no usa IA todavía.</p>
                </div>
                <button onClick={loadInbox} disabled={loading} className="inline-flex justify-center items-center gap-2 rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60">
                    {loading ? "Actualizando…" : "↻ Actualizar bandeja"}
                </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    ["TODOS", "Registros", counts.all, "bg-slate-50 border-slate-200 text-slate-800"],
                    ["PENDIENTES", "A revisar", counts.pending, "bg-amber-50 border-amber-200 text-amber-900"],
                    ["BORRADORES", "Borradores", counts.drafts, "bg-violet-50 border-violet-200 text-violet-900"],
                    ["ALERTAS", "Alertas", counts.alerts, "bg-rose-50 border-rose-200 text-rose-900"],
                ].map(([value, label, count, style]) => (
                    <button key={String(value)} onClick={() => setFilter(value as Filter)} className={`text-left rounded-2xl border p-4 transition ${style} ${filter === value ? "ring-2 ring-indigo-500 ring-offset-2" : "hover:shadow-sm"}`}>
                        <div className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</div>
                        <div className="mt-1 text-2xl font-black">{count}</div>
                    </button>
                ))}
            </div>

            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar persona o profesional…" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                <select value={kind} onChange={event => setKind(event.target.value as "TODOS" | RecordKind)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white">
                    <option value="TODOS">Evaluaciones y evoluciones</option><option value="EVALUACION">Solo evaluaciones</option><option value="EVOLUCION">Solo evoluciones</option>
                </select>
                <select value={internId} onChange={event => setInternId(event.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white">
                    <option value="TODOS">Todos los profesionales</option>
                    {interns.map(intern => <option key={intern.uid} value={intern.uid}>{intern.displayName || intern.email || "Interno sin nombre"}</option>)}
                </select>
                <div className="text-sm text-slate-500 self-center text-right"><strong className="text-slate-800">{visibleRecords.length}</strong> resultados</div>
            </div>

            {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">{error}</div>}

            <div className="grid xl:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">
                <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? <div className="p-12 text-center text-slate-500 animate-pulse">Cargando registros clínicos…</div> : visibleRecords.length === 0 ? <div className="p-12 text-center text-slate-500">No hay registros con estos filtros.</div> : (
                        <div className="divide-y divide-slate-100">
                            {visibleRecords.map(record => {
                                const isSelected = selected?.id === record.id;
                                return <button key={`${record.kind}-${record.id}`} onClick={() => setSelected(record)} className={`w-full text-left p-5 transition ${isSelected ? "bg-indigo-50/70" : "hover:bg-slate-50"}`}>
                                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                        <div className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${record.kind === "EVALUACION" ? "bg-indigo-100 text-indigo-800" : "bg-emerald-100 text-emerald-800"}`}>{record.kind === "EVALUACION" ? "Evaluación" : "Evolución"}</div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline"><h2 className="font-bold text-slate-900">{record.patientName}</h2><span className="text-xs text-slate-500">{formatDate(record.sessionAt)}</span></div>
                                            <p className="mt-1 text-sm text-slate-600 line-clamp-2">{record.summary}</p>
                                            <p className="mt-2 text-xs font-medium text-slate-500">Registrado por: {record.authorName}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 shrink-0">
                                            {record.status === "DRAFT" && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-800">Borrador</span>}
                                            {record.alerts.length > 0 && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold text-rose-800">{record.alerts.length} alerta{record.alerts.length > 1 ? "s" : ""}</span>}
                                            {record.missing.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-800">{record.missing.length} faltante{record.missing.length > 1 ? "s" : ""}</span>}
                                        </div>
                                    </div>
                                </button>;
                            })}
                        </div>
                    )}
                </section>

                <aside className="xl:sticky xl:top-4 rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                    {!selected ? <div className="py-10 text-center text-sm text-slate-500">Selecciona un registro para ver su resumen de supervisión.</div> : <>
                        <div className="flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-widest font-black text-indigo-600">Detalle de revisión</div><h2 className="mt-1 text-xl font-black text-slate-900">{selected.patientName}</h2></div><button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700" aria-label="Cerrar detalle">✕</button></div>
                        <p className="mt-2 text-xs text-slate-500">{selected.kind === "EVALUACION" ? "Evaluación" : "Evolución"} · {formatDate(selected.sessionAt)}</p>
                        <div className="mt-5 rounded-xl bg-slate-50 border border-slate-100 p-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Contenido registrado</h3><p className="mt-2 text-sm leading-relaxed text-slate-700">{selected.summary}</p></div>
                        <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Puntos a revisar</h3>{selected.missing.length === 0 ? <p className="mt-2 text-sm text-emerald-700">No hay faltantes estructurales detectados.</p> : <ul className="mt-2 space-y-2">{selected.missing.map(item => <li key={item} className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-sm text-amber-900">{item}</li>)}</ul>}</div>
                        {selected.alerts.length > 0 && <div className="mt-4"><h3 className="text-xs font-bold uppercase tracking-wide text-rose-600">Atención docente</h3><ul className="mt-2 space-y-2">{selected.alerts.map(item => <li key={item} className="rounded-lg bg-rose-50 border border-rose-100 px-3 py-2 text-sm text-rose-900">{item}</li>)}</ul></div>}
                        <button onClick={() => router.push(`/app/usuarios?openFicha=${encodeURIComponent(selected.patientId)}`)} className="mt-6 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700">Abrir ficha clínica original</button>
                        <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">Los comentarios, el estado “revisado” y el feedback se incorporarán después de validar esta bandeja con tu flujo real.</p>
                    </>}
                </aside>
            </div>
        </div>
    );
}
