"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { collection, doc, documentId, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import type { TeacherAgentReview } from "@/lib/agent/contracts/review";
import type { StudentLearningProfile } from "@/types/agentDataFoundation";
import type { StudentClinicalTaskKind } from "@/types/studentClinicalTask";

type ReviewWithId = TeacherAgentReview & { id: string; isStale?: boolean };
type ProfileDisplay = StudentLearningProfile & { displayName?: string };
const RECENT_REVIEW_WINDOW_MS = 48 * 60 * 60 * 1000;
const PERSISTENT_ACTION_CATEGORIES = new Set([
  'REEVALUATION_DUE',
  'INITIAL_EVALUATION_MISSING',
  'INITIAL_EVALUATION_INSUFFICIENT',
]);

/** Nombres legibles de las incoherencias que detecta el agente. */
const COHERENCE_LABELS: Record<string, string> = {
  INTERVENCION_NO_CORRESPONDE: 'Intervención sin relación con el diagnóstico',
  OBJETIVO_ABANDONADO: 'Objetivo declarado y no trabajado',
  DOSIFICACION_INADECUADA: 'Dosificación sin fundamento',
  PLAN_ESTANCADO: 'Plan sin cambios pese a falta de progreso',
  RIESGO_SEGURIDAD: 'Se avanza pese a señales de alarma',
  SIN_REEVALUACION: 'Sesiones acumuladas sin volver a medir',
};

function chunks<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

const priorityStyle = {
  P0: "bg-rose-100 text-rose-800 border-rose-200",
  P1: "bg-amber-100 text-amber-800 border-amber-200",
  P2: "bg-blue-100 text-blue-800 border-blue-200",
  P3: "bg-slate-100 text-slate-700 border-slate-200",
} as const;

function recordKind(collectionName: string) {
  return collectionName === "evoluciones" ? "EVOLUCION" : "EVALUACION";
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no registrada"
    : date.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" });
}

function explainAgentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.includes("Missing FIREBASE_ADMIN credentials")) {
    return "El censo automático aún requiere la credencial privada Firebase Admin en Vercel. La atención clínica y las fichas no se han modificado.";
  }
  if (message.includes("AGENT_CENSUS_DISABLED")) {
    return "El censo está instalado pero deshabilitado por seguridad hasta completar su configuración privada.";
  }
  return message || "No se pudo iniciar el censo.";
}

/** Hallazgos privados: esta vista jamás envía mensajes ni modifica fichas clínicas. */
export function BandejaDocenteInteligente() {
  const router = useRouter();
  const [reviews, setReviews] = useState<ReviewWithId[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileDisplay>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Correcciones del docente sobre el texto propuesto, por hallazgo.
  const [editedFeedback, setEditedFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const reviewSnap = await getDocs(query(
        collection(db, "teacher_agent_reviews"),
        where("status", "==", "PENDING_TEACHER"),
        limit(100),
      ));

      // Un hallazgo pendiente NO se oculta por antigüedad. La ventana de 48h
      // descartaba en el navegador todo lo que el censo había creado en días
      // anteriores, y por eso la bandeja mostraba 0 aunque Firestore tuviera
      // hallazgos sin revisar. Ahora solo se marcan visualmente como antiguos.
      const cutoff = Date.now() - RECENT_REVIEW_WINDOW_MS;
      const visibleReviews = reviewSnap.docs
        .map((snapshot) => {
          const review = {
            id: snapshot.id,
            ...(snapshot.data() as TeacherAgentReview),
          };
          const created = new Date(review.createdAt).getTime();
          const isRecent = Number.isFinite(created) && created >= cutoff;
          return {
            ...review,
            isStale: !isRecent && !PERSISTENT_ACTION_CATEGORIES.has(review.category || ''),
          };
        })
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      setReviews(visibleReviews);

      // Antes se leían 100 perfiles aunque solo hubiera pocos hallazgos
      // recientes. Solo pedimos los estudiantes visibles, en grupos válidos
      // para Firestore; la bandeja sigue mostrando nombres legibles.
      const studentIds = [...new Set(visibleReviews.map(review => review.studentId).filter(Boolean))];
      const profileSnaps = await Promise.all(
        chunks(studentIds, 30).map(ids => getDocs(query(
          collection(db, "student_learning_profiles"),
          where(documentId(), "in", ids),
        ))),
      );
      setProfiles(
        Object.fromEntries(
          profileSnaps.flatMap(profileSnap => profileSnap.docs.map((snapshot) => [
              snapshot.id,
              snapshot.data() as ProfileDisplay,
            ])),
        ),
      );
    } catch (error) {
      console.error("No se pudo cargar la bandeja del agente:", error);
      setNotice("No se pudieron cargar los hallazgos privados. Reintenta en unos segundos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: reviews.length,
      p0: reviews.filter((review) => review.priority === "P0").length,
      p1: reviews.filter((review) => review.priority === "P1").length,
    }),
    [reviews],
  );

  const runCensus = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("No se encontró sesión docente válida.");
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ triggeredBy: "manual" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "No se pudo iniciar el censo.");

      // El censo corre sincrónico en el servidor: recargar aquí evita que la
      // bandeja se quede diciendo "iniciado" con la lista vieja en pantalla.
      const summary = result.result || result.data || {};
      const created = summary.reviewsCreated ?? summary.created;
      const processed = summary.recordsProcessed ?? summary.processed;
      await load();
      setNotice(
        typeof created === 'number'
          ? `Censo terminado: ${created} hallazgo(s) nuevo(s) sobre ${processed ?? '?'} registro(s) revisado(s). Nada se envía a estudiantes.`
          : "Censo ejecutado. La bandeja se actualizó; no se envía nada a estudiantes.",
      );
    } catch (error) {
      setNotice(explainAgentError(error));
    } finally {
      setRunning(false);
    }
  };

  const updateStatus = async (review: ReviewWithId, status: "DISMISSED" | "ACCEPTED_PRIVATE" | "SHARED") => {
    setWorkingId(review.id);
    try {
      await updateDoc(doc(db, "teacher_agent_reviews", review.id), {
        status,
        reviewedAt: new Date().toISOString(),
      });

      // El agente aprende de esto: si un tipo de hallazgo se descarta siempre,
      // deja de proponerlo. Su fallo nunca debe bloquear la decisión docente.
      void fetch("/api/teacher/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          reviewId: review.id,
          kind: status === "DISMISSED" ? "DISMISSED" : status === "SHARED" ? "SHARED" : "APPROVED",
          category: review.category,
          coherenceTypes: (review.coherenceFindings || []).map(finding => finding.type),
          priority: review.priority,
          via: "web",
        }),
      }).catch(() => { /* la decisión ya quedó guardada */ });
      setReviews((current) => current.filter((item) => item.id !== review.id));
    } catch (error) {
      console.error("No se pudo actualizar el hallazgo:", error);
      setNotice("No se pudo guardar tu decisión. Reintenta.");
    } finally {
      setWorkingId(null);
    }
  };

  const publishStudentTask = async (review: ReviewWithId) => {
    if (!review.patientId || !review.category || !PERSISTENT_ACTION_CATEGORIES.has(review.category)) {
      setNotice("Este hallazgo no tiene suficiente información para crear una tarea al estudiante.");
      return;
    }
    setWorkingId(review.id);
    try {
      const kind = review.category as StudentClinicalTaskKind;
      const isReevaluation = kind === 'REEVALUATION_DUE';
      const isMissing = kind === 'INITIAL_EVALUATION_MISSING';
      const title = isReevaluation
        ? 'Reevaluación clínica pendiente'
        : isMissing ? 'Evaluación inicial pendiente' : 'Completa la evaluación inicial';
      // Si el docente ya revisó y ajustó un feedback para este hallazgo, ese es
      // el texto que corresponde mostrarle a la estudiante: es el que él aprobó.
      // El texto genérico queda solo cuando no hay nada redactado.
      const approvedFeedback = editedFeedback[review.id] ?? review.draftFeedback;
      const message = approvedFeedback?.trim()
        ? approvedFeedback.trim()
        : isReevaluation
          ? 'Tu docente revisó la continuidad de este proceso y solicita una reevaluación focalizada. Registra entrevista, examen físico comparable, interpretación, objetivos y ajuste del plan.'
          : isMissing
            ? 'Este proceso ya tiene evoluciones, pero no cuenta con una evaluación inicial cerrada. Completa la línea basal antes de continuar registrando sesiones.'
            : 'La evaluación inicial existente no entrega una línea basal suficiente. Completa entrevista, examen físico, integración clínica, objetivos y plan; luego ciérrala.';
      const actionParams = new URLSearchParams({
        openFicha: review.patientId,
        action: isReevaluation ? 'REEVALUAR' : 'EVALUACION_INICIAL',
      });
      if (review.processId) actionParams.set('procesoId', review.processId);
      if (isReevaluation) actionParams.set('step', '1');
      await setDoc(doc(db, 'student_clinical_tasks', `review_${review.id}`), {
        year: review.year,
        studentId: review.studentId,
        patientId: review.patientId,
        processId: review.processId || null,
        reviewId: review.id,
        kind,
        status: 'ACTIVE',
        title,
        message,
        actionLabel: isReevaluation ? 'Ir a reevaluar' : 'Abrir expediente',
        actionHref: `/app/usuarios?${actionParams.toString()}`,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'teacher',
      }, { merge: true });
      await updateStatus(review, 'SHARED');
      setNotice("Tarea publicada en la página del estudiante. Permanecerá visible hasta que cierre el registro solicitado.");
    } catch (error) {
      console.error("No se pudo publicar la tarea clínica:", error);
      setNotice("No se pudo publicar la tarea al estudiante. Reintenta.");
    } finally {
      setWorkingId(null);
    }
  };

  /**
   * Texto del feedback listo para revisar.
   *
   * Se prefiere el redactado por la IA. El armado por concatenación queda solo
   * como respaldo para hallazgos antiguos: se leía como un formulario, no como
   * un docente hablándole a su estudiante.
   */
  const feedbackText = (review: ReviewWithId) => {
    if (review.draftFeedback?.trim()) return review.draftFeedback.trim();
    const source = review.sourceReferences[0];
    const student = profiles[review.studentId]?.displayName || "Estudiante";
    return [
      `Hola ${student},`,
      "",
      review.observation,
      review.pedagogicalInference ? `Para tu razonamiento clínico: ${review.pedagogicalInference}` : "",
      source?.redactedExcerpt ? `Revisa específicamente este fragmento de tu registro: “${source.redactedExcerpt}”.` : "",
    ].filter(Boolean).join("\n");
  };

  /**
   * Envía el feedback aprobado a la página de la estudiante.
   *
   * Faltaba esta vía: se podía aprobar el texto y copiarlo al portapapeles,
   * pero no había forma de que le llegara dentro de la plataforma salvo
   * pegarlo en otro canal.
   */
  const sendFeedbackToStudent = async (review: ReviewWithId) => {
    setWorkingId(review.id);
    try {
      const messageBody = editedFeedback[review.id] ?? feedbackText(review);
      if (!messageBody.trim()) {
        setNotice("No hay texto que enviar.");
        return;
      }

      await setDoc(doc(db, 'student_clinical_tasks', `feedback_${review.id}`), {
        year: review.year,
        studentId: review.studentId,
        patientId: review.patientId || null,
        processId: review.processId || null,
        reviewId: review.id,
        kind: 'TEACHER_FEEDBACK',
        status: 'ACTIVE',
        title: 'Retroalimentación de tu docente',
        message: messageBody,
        actionLabel: 'Entendido',
        actionHref: '/app/dashboard',
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || 'teacher',
      }, { merge: true });

      await updateStatus(review, 'SHARED');
      setNotice("Enviado. Le aparecerá en su página al entrar.");
    } catch (error) {
      console.error("No se pudo enviar el feedback:", error);
      setNotice("No se pudo enviar. Reintenta.");
    } finally {
      setWorkingId(null);
    }
  };

  const createFeedbackDraft = async (review: ReviewWithId) => {
    setWorkingId(review.id);
    try {
      const proposed = feedbackText(review);
      const messageBody = editedFeedback[review.id] ?? proposed;
      const wasEdited = messageBody.trim() !== proposed.trim();

      void fetch("/api/teacher/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` },
        body: JSON.stringify({
          reviewId: review.id,
          kind: wasEdited ? "EDITED" : "APPROVED",
          category: review.category,
          coherenceTypes: (review.coherenceFindings || []).map(finding => finding.type),
          priority: review.priority,
          originalLength: proposed.length,
          finalLength: messageBody.length,
          via: "web",
        }),
      }).catch(() => { /* la aprobación ya quedó guardada */ });

      // El borrador se guardaba con un ID automático en una colección que
      // ninguna pantalla leía: el docente apretaba el botón, veía "creado" y el
      // texto desaparecía. Ahora se guarda con el ID del hallazgo, queda
      // aprobado explícitamente y se puede recuperar y copiar.
      await setDoc(doc(db, "student_message_drafts", review.id), {
        studentId: review.studentId,
        reviewId: review.id,
        year: review.year,
        messageBody,
        priority: review.priority,
        status: "APPROVED_BY_TEACHER",
        approvedBy: auth.currentUser?.uid || 'teacher',
        approvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      }, { merge: true });

      try {
        await navigator.clipboard.writeText(messageBody);
        setNotice("Feedback aprobado y copiado al portapapeles. Ya puedes pegarlo donde prefieras; no se envió nada automáticamente.");
      } catch {
        setNotice("Feedback aprobado y guardado. No se envió nada al estudiante.");
      }

      await updateStatus(review, "ACCEPTED_PRIVATE");
    } catch (error) {
      console.error("No se pudo aprobar el feedback:", error);
      setNotice("No se pudo guardar el feedback. Reintenta.");
    } finally {
      setWorkingId(null);
    }
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-600">Cargando hallazgos privados del agente…</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black"><Sparkles className="h-5 w-5 text-amber-300" /> Hallazgos & Feedback IA</h2>
            <p className="mt-1 max-w-2xl text-xs text-indigo-100">Muestra hallazgos de las últimas 48 horas y recordatorios de reevaluación activos. El histórico rutinario se conserva sin saturar tu revisión diaria.</p>
          </div>
          <button onClick={runCensus} disabled={running} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-slate-600">
            <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
            {running ? "Iniciando censo…" : "Revisar ahora"}
          </button>
        </div>
      </section>

      {notice && <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">{notice}</div>}

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Pendientes" value={counts.total} />
        <Metric label="P0 seguridad" value={counts.p0} tone="rose" />
        <Metric label="P1 atención" value={counts.p1} tone="amber" />
      </div>

      {reviews.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h3 className="mt-3 font-bold text-slate-900">No hay hallazgos pendientes</h3>
          <p className="mt-1 text-sm text-slate-500">Puede significar que ya revisaste todo o que aún no se ha ejecutado un censo habilitado.</p>
        </section>
      ) : reviews.map((review) => {
        const source = review.sourceReferences[0];
        const student = profiles[review.studentId]?.displayName || "Estudiante sin nombre registrado";
        const viewerHref = source
          ? `/app/revision-docente/registros/${recordKind(source.collection)}/${source.recordId}`
          : null;
        return (
          <article key={review.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${priorityStyle[review.priority]}`}>{review.priority}</span>
                {review.category === 'REEVALUATION_DUE' && <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-800">REEVALUACIÓN PENDIENTE</span>}
                {review.category === 'INITIAL_EVALUATION_MISSING' && <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black text-rose-800">SIN EVALUACIÓN INICIAL</span>}
                {review.category === 'INITIAL_EVALUATION_INSUFFICIENT' && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-800">LÍNEA BASAL INSUFICIENTE</span>}
                {review.isStale && <span className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">ARRASTRADO</span>}
                <strong className="text-sm text-slate-900">{student}</strong>
                <span className="text-xs text-slate-500">{formatDate(review.createdAt)}</span>
              </div>
              <span className="text-xs font-mono text-slate-500">Confianza IA: {Math.round(review.confidence * 100)}%</span>
            </header>
            <div className="space-y-4 p-5">
              {source?.redactedExcerpt && <blockquote className="rounded-r-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm italic text-amber-950">“{source.redactedExcerpt}”</blockquote>}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-indigo-700">Hallazgo</h3>
                <p className="mt-1 text-sm text-slate-800">{review.observation}</p>
                {review.pedagogicalInference && <p className="mt-2 text-sm text-slate-600"><strong>Sentido pedagógico:</strong> {review.pedagogicalInference}</p>}
              </div>

              {/* Incoherencias entre lo que la estudiante concluyó y lo que ejecutó. */}
              {review.coherenceFindings && review.coherenceFindings.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <h3 className="text-xs font-black uppercase tracking-wide text-rose-800">Coherencia clínica</h3>
                  <ul className="mt-2 space-y-2">
                    {review.coherenceFindings.map((finding, index) => (
                      <li key={index} className="text-sm text-rose-950">
                        <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] font-black ${
                          finding.severity === 'ALTA' ? 'bg-rose-200 text-rose-900'
                            : finding.severity === 'MEDIA' ? 'bg-amber-200 text-amber-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {COHERENCE_LABELS[finding.type] || finding.type}
                        </span>
                        {finding.explanation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Feedback redactado por la IA, editable antes de aprobar. */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wide text-emerald-700">
                  Feedback propuesto {review.draftFeedback ? '(redactado por la IA)' : '(armado automáticamente)'}
                </h3>
                <textarea
                  value={editedFeedback[review.id] ?? feedbackText(review)}
                  onChange={(event) => setEditedFeedback(current => ({ ...current, [review.id]: event.target.value }))}
                  rows={6}
                  className="mt-2 w-full rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 text-sm text-slate-800 outline-none focus:border-emerald-400"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Puedes corregirlo antes de aprobar. Nada llega a la estudiante hasta que tú lo decidas.
                </p>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {viewerHref && <button onClick={() => router.push(viewerHref)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"><FileText className="h-3.5 w-3.5" /> Ver registro exacto</button>}
                <button onClick={() => router.push(`/app/revision-docente/alumno/${review.studentId}`)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><Sparkles className="h-3.5 w-3.5" /> Ver ficha del alumno</button>
                <button onClick={() => updateStatus(review, "DISMISSED")} disabled={workingId === review.id} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"><XCircle className="h-3.5 w-3.5" /> Descartar</button>
                <button onClick={() => createFeedbackDraft(review)} disabled={workingId === review.id} title="Guarda el texto y lo copia; no se lo envía" className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><CheckCircle2 className="h-3.5 w-3.5" /> Aprobar y copiar</button>
                <button onClick={() => sendFeedbackToStudent(review)} disabled={workingId === review.id} title="Le aparece en su página al entrar" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-slate-400"><CheckCircle2 className="h-3.5 w-3.5" /> Enviarle este feedback</button>
                {PERSISTENT_ACTION_CATEGORIES.has(review.category || '') && <button onClick={() => publishStudentTask(review)} disabled={workingId === review.id} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-xs font-bold text-white hover:bg-violet-600 disabled:bg-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> Avisar en su página</button>}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: number; tone?: "slate" | "rose" | "amber" }) {
  const classes = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-900" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-800";
  return <div className={`rounded-xl border p-3 ${classes}`}><p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}
