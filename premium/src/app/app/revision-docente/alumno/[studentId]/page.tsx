"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ClipboardList,
  FileText,
  GraduationCap,
  MessageSquare,
  Repeat,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import type { StudentDossier } from "@/lib/teacher-inbox/studentDossier";
import { priorityLabel } from "@/lib/agent/priorityLabels";

const COMPETENCY_LABELS: Record<string, string> = {
  RAZONAMIENTO: "Razonamiento diagnóstico",
  EXAMEN_FISICO: "Examen físico",
  OBJETIVOS: "Objetivos y plan",
  DOSIFICACION: "Dosificación y progresión",
  REEVALUACION: "Reevaluación",
  SEGURIDAD: "Seguridad clínica",
  REGISTRO: "Calidad del registro",
};

const LEVEL_LABELS: Record<string, string> = {
  INSUFICIENTE: "Insuficiente",
  EN_DESARROLLO: "En desarrollo",
  LOGRADO: "Logrado",
  DESTACADO: "Destacado",
};

const LEVEL_EMOJI: Record<string, string> = {
  INSUFICIENTE: "🔴",
  EN_DESARROLLO: "🟠",
  LOGRADO: "🟢",
  DESTACADO: "⭐️",
};

const LEVEL_STYLE: Record<string, string> = {
  INSUFICIENTE: "border-l-rose-400 bg-rose-50/50",
  EN_DESARROLLO: "border-l-amber-400 bg-amber-50/50",
  LOGRADO: "border-l-emerald-400 bg-emerald-50/50",
  DESTACADO: "border-l-indigo-400 bg-indigo-50/50",
};

/** De lo que falla a lo logrado: el docente lee primero lo que hay que atender. */
const LEVEL_ORDER = ["INSUFICIENTE", "EN_DESARROLLO", "LOGRADO", "DESTACADO"];

/** Los mismos nombres legibles que usa la bandeja, para no hablar dos idiomas. */
const COHERENCE_LABELS: Record<string, string> = {
  INTERVENCION_NO_CORRESPONDE: "Intervención sin relación con el diagnóstico",
  OBJETIVO_ABANDONADO: "Objetivo declarado y no trabajado",
  DOSIFICACION_INADECUADA: "Dosificación sin fundamento",
  PLAN_ESTANCADO: "Plan sin cambios pese a falta de progreso",
  RIESGO_SEGURIDAD: "Se avanza pese a señales de alarma",
  SIN_REEVALUACION: "Sesiones acumuladas sin volver a medir",
};

function formatDate(value?: string) {
  if (!value) return "Sin registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Sin registro"
    : date.toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(value?: string) {
  if (!value) return null;
  const date = new Date(value).getTime();
  if (Number.isNaN(date)) return null;
  return Math.floor((Date.now() - date) / (1000 * 60 * 60 * 24));
}

export default function FichaAlumnoPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { globalActiveYear } = useYear();
  const studentId = String(params?.studentId || "");

  const [dossier, setDossier] = useState<StudentDossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!studentId || !globalActiveYear) return;
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("No se encontró una sesión docente válida.");
      const response = await fetch(
        `/api/teacher/student-dossier?studentId=${encodeURIComponent(studentId)}&year=${globalActiveYear}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error?.message || payload.error || "No se pudo cargar la ficha.");
      }
      setDossier(payload.data || payload);
    } catch (err: any) {
      console.error("Error cargando la ficha del alumno:", err);
      setError(err?.message || "No se pudo cargar la ficha de la estudiante.");
    } finally {
      setLoading(false);
    }
  }, [studentId, globalActiveYear]);

  useEffect(() => { load(); }, [load]);

  if (user?.role !== "DOCENTE") {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        Esta ficha está disponible solo para el equipo docente.
      </div>
    );
  }

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-600">Reuniendo el historial de la estudiante…</div>;
  }

  if (error || !dossier) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
        <p className="font-semibold">{error || "No hay datos para esta estudiante."}</p>
        <button onClick={load} className="rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-bold text-rose-800 hover:bg-rose-100">
          Reintentar
        </button>
      </div>
    );
  }

  const inactiveDays = daysSince(dossier.clinicalActivity.lastActivityAt);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <button onClick={() => router.push("/app/revision-docente")} className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-800">
        <ChevronLeft className="h-4 w-4" /> Volver a la bandeja
      </button>

      {/* Encabezado */}
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">{dossier.displayName}</h1>
            <p className="text-sm text-slate-500">{dossier.email}</p>
          </div>
          {inactiveDays !== null && inactiveDays > 14 && (
            <span className="inline-flex items-center gap-1.5 self-start rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800">
              <AlertTriangle className="h-3.5 w-3.5" /> Sin actividad clínica hace {inactiveDays} días
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label="Evaluaciones" value={dossier.clinicalActivity.totalEvaluations} icon={<ClipboardList className="h-4 w-4" />} />
          <Metric label="Reevaluaciones" value={dossier.clinicalActivity.totalReassessments} icon={<Repeat className="h-4 w-4" />} />
          <Metric label="Evoluciones" value={dossier.clinicalActivity.totalEvolutions} icon={<Activity className="h-4 w-4" />} />
          <Metric label="Personas atendidas" value={dossier.clinicalActivity.distinctPatients} icon={<FileText className="h-4 w-4" />} />
          <Metric
            label="Borradores sin firmar"
            value={dossier.clinicalActivity.draftsPending}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={dossier.clinicalActivity.draftsPending > 0 ? "rose" : "slate"}
          />
        </div>
      </header>

      {/* Perfil por competencia: el insumo directo de la nota de proceso */}
      {dossier.competencies.current.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-indigo-700">
            <GraduationCap className="h-4 w-4" /> Competencias clínicas
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {dossier.competencies.rotationWeek
              ? `Evaluadas según su etapa: semana ${dossier.competencies.rotationWeek}${dossier.competencies.rotationTotalWeeks ? ` de ${dossier.competencies.rotationTotalWeeks}` : ''}.`
              : 'Lo exigible depende de la etapa; su fecha de término aún no está registrada.'}
          </p>

          <ul className="mt-4 space-y-2">
            {[...dossier.competencies.current]
              .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
              .map(item => (
                <li key={item.competency} className={`rounded-xl border-l-4 p-3 ${LEVEL_STYLE[item.level] || "border-l-slate-300 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-slate-800">
                      {COMPETENCY_LABELS[item.competency] || item.competency}
                    </span>
                    <span className="shrink-0 text-xs font-black">
                      {LEVEL_EMOJI[item.level]} {LEVEL_LABELS[item.level] || item.level}
                    </span>
                  </div>
                  {item.comment && <p className="mt-1 text-xs text-slate-600">{item.comment}</p>}
                </li>
              ))}
          </ul>

          {dossier.competencies.history.length > 1 && (
            // La trayectoria responde algo que el estado actual no: si el
            // feedback que le diste hace semanas cambió algo.
            <div className="mt-5">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Cómo ha evolucionado</h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="pb-1 pr-2 font-bold">Competencia</th>
                      {dossier.competencies.history.map(entry => (
                        <th key={entry.week} className="pb-1 px-1 font-bold">S{entry.week}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dossier.competencies.current.map(item => (
                      <tr key={item.competency}>
                        <td className="py-1.5 pr-2 text-slate-700">{COMPETENCY_LABELS[item.competency] || item.competency}</td>
                        {dossier.competencies.history.map(entry => (
                          <td key={entry.week} className="py-1.5 px-1 text-center">
                            {LEVEL_EMOJI[entry.levels?.[item.competency]] || '·'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Patrones: lo que se repite es lo que hay que enseñar */}
      {dossier.findings.coherenceTally.length > 0 && (
        <section className="rounded-2xl border border-rose-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-rose-800">
            <AlertTriangle className="h-4 w-4" /> Errores que se repiten
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cuántas veces el agente detectó cada tipo de incoherencia entre lo que ella concluyó y lo que ejecutó.
          </p>
          <ul className="mt-4 space-y-2">
            {dossier.findings.coherenceTally.map(item => (
              <li key={item.type} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <span className="text-sm font-semibold text-slate-800">{COHERENCE_LABELS[item.type] || item.type}</span>
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-black text-white">{item.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Perfil longitudinal */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-indigo-700">
            <GraduationCap className="h-4 w-4" /> Perfil de aprendizaje
          </h2>
          <p className="mt-1 text-xs text-slate-500">Actualizado {formatDate(dossier.profile.lastUpdatedAt)}</p>

          <h3 className="mt-4 text-xs font-black uppercase tracking-wide text-emerald-700">Fortalezas</h3>
          {dossier.profile.strengths.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {dossier.profile.strengths.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Todavía sin registro.</p>
          )}

          <h3 className="mt-4 text-xs font-black uppercase tracking-wide text-amber-700">Brechas a trabajar</h3>
          {dossier.profile.improvementGaps.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {dossier.profile.improvementGaps.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-400">Todavía sin registro.</p>
          )}
        </section>

        {/* Simulaciones */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-violet-700">
            <GraduationCap className="h-4 w-4" /> Simulaciones y defensas
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Escritas" value={dossier.simulations.escrito} />
            <Metric label="Por voz" value={dossier.simulations.voz} />
            <Metric label="Defensas" value={dossier.simulations.defenseAttempts} />
            <Metric label="Total" value={dossier.simulations.total} tone={dossier.simulations.meetsAll ? "emerald" : "amber"} />
          </div>
          {dossier.simulations.sinClasificar > 0 && (
            // Los intentos previos a distinguir escrito de voz no se pueden
            // clasificar hacia atrás; se declara en vez de adivinar.
            <p className="mt-2 text-[11px] text-slate-500">
              {dossier.simulations.sinClasificar} práctica(s) antigua(s) sin modalidad registrada, contadas al total.
            </p>
          )}
          <p className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${dossier.simulations.meetsAll ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            {dossier.simulations.summary}
          </p>
          <p className="mt-2 text-xs text-slate-500">Última práctica: {formatDate(dossier.simulations.lastAttemptAt)}</p>
        </section>
      </div>

      {/* Registros clínicos recientes */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
          <FileText className="h-4 w-4" /> Registros clínicos recientes
        </h2>
        {dossier.clinicalActivity.recent.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Sin registros en el año activo.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 pr-3 font-bold">Fecha</th>
                  <th className="pb-2 pr-3 font-bold">Tipo</th>
                  <th className="pb-2 pr-3 font-bold">Persona</th>
                  <th className="pb-2 pr-3 font-bold">Estado</th>
                  <th className="pb-2 font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dossier.clinicalActivity.recent.map(record => (
                  <tr key={record.id}>
                    <td className="py-2.5 pr-3 text-slate-600">{formatDate(record.sessionAt)}</td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">{record.kind}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{record.patientName}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                        record.status === "CLOSED" || record.status === "CERRADA"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {record.status === "CLOSED" || record.status === "CERRADA" ? "FIRMADO" : "BORRADOR"}
                      </span>
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/app/revision-docente/registros/${record.kind === "EVOLUCION" ? "EVOLUCION" : "EVALUACION"}/${record.id}`}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Lo que el docente observó: materia prima de la nota de proceso */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-indigo-700">
          <MessageSquare className="h-4 w-4" /> Lo que tú observaste
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Lo que le fuiste dictando al bot. Es la parte de la nota de proceso que no está en ningún registro.
        </p>
        {dossier.teacherNotes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            Todavía no has anotado nada de esta estudiante. Puedes decírselo al bot por Telegram:
            &ldquo;la Javiera llegó tarde otra vez&rdquo;.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {dossier.teacherNotes.map((item, index) => (
              <li
                key={item.id || index}
                className={`rounded-xl border-l-4 p-3 text-sm ${
                  item.tone === "POSITIVA" ? "border-l-emerald-400 bg-emerald-50/50 text-emerald-950"
                    : item.tone === "A_MEJORAR" ? "border-l-amber-400 bg-amber-50/50 text-amber-950"
                    : "border-l-slate-300 bg-slate-50 text-slate-800"
                }`}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide opacity-60">{formatDate(item.createdAt)}</p>
                <p className="mt-0.5">{item.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Feedback ya entregado */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-emerald-700">
          <MessageSquare className="h-4 w-4" /> Feedback que ya aprobaste
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Para no repetirte y para ver si lo que le pediste antes cambió algo.
        </p>
        {dossier.deliveredFeedback.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">Todavía no has aprobado feedback para esta estudiante.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {dossier.deliveredFeedback.map(item => (
              <li key={item.id} className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">{formatDate(item.approvedAt)}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{item.messageBody}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historial de hallazgos */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
          <AlertTriangle className="h-4 w-4" /> Hallazgos del agente ({dossier.findings.total})
        </h2>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-rose-800">🔴 Seguridad: {dossier.findings.byPriority.P0}</span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">🟠 Por revisar: {dossier.findings.byPriority.P1}</span>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">🔵 Menores: {dossier.findings.byPriority.P2}</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">⚪️ Informativos: {dossier.findings.byPriority.P3}</span>
        </div>

        {dossier.findings.pending.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-rose-700">Esperando tu decisión</h3>
            <ul className="mt-2 space-y-2">
              {dossier.findings.pending.map(finding => (
                <li key={finding.id} className="rounded-xl border border-rose-100 bg-rose-50/40 p-3 text-sm text-slate-800">
                  <span className="mr-2 text-[10px] font-black text-rose-700">{priorityLabel(finding.priority)}</span>
                  {finding.observation}
                </li>
              ))}
            </ul>
          </>
        )}

        {dossier.findings.history.length > 0 && (
          <>
            <h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">Ya resueltos</h3>
            <ul className="mt-2 space-y-1.5">
              {dossier.findings.history.map(finding => (
                <li key={finding.id} className="text-sm text-slate-500">
                  <span className="mr-2 text-[10px] font-black">{priorityLabel(finding.priority)}</span>
                  {formatDate(finding.createdAt)} — {finding.observation.slice(0, 140)}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, icon, tone = "slate" }: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  tone?: "slate" | "rose" | "amber" | "emerald";
}) {
  const classes =
    tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-900"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900"
    : tone === "emerald" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-xl border p-3 ${classes}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide opacity-70">{icon} {label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
