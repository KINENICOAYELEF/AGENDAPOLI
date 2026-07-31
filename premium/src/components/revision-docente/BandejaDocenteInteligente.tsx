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
import { collection, doc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { auth } from "@/lib/firebase";
import type { TeacherAgentReview } from "@/lib/agent/contracts/review";
import type { StudentLearningProfile } from "@/types/agentDataFoundation";

type ReviewWithId = TeacherAgentReview & { id: string };
type ProfileDisplay = StudentLearningProfile & { displayName?: string };

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

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [reviewSnap, profileSnap] = await Promise.all([
        getDocs(query(
          collection(db, "teacher_agent_reviews"),
          where("status", "==", "PENDING_TEACHER"),
          limit(100),
        )),
        getDocs(query(collection(db, "student_learning_profiles"), limit(100))),
      ]);

      setReviews(reviewSnap.docs
        .map((snapshot) => ({
          id: snapshot.id,
          ...(snapshot.data() as TeacherAgentReview),
        }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setProfiles(
        Object.fromEntries(
          profileSnap.docs.map((snapshot) => [
            snapshot.id,
            snapshot.data() as ProfileDisplay,
          ]),
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
      setNotice("Censo iniciado. Los hallazgos aparecerán aquí al finalizar; no se envía nada a estudiantes.");
    } catch (error) {
      setNotice(explainAgentError(error));
    } finally {
      setRunning(false);
    }
  };

  const updateStatus = async (review: ReviewWithId, status: "DISMISSED" | "ACCEPTED_PRIVATE") => {
    setWorkingId(review.id);
    try {
      await updateDoc(doc(db, "teacher_agent_reviews", review.id), {
        status,
        reviewedAt: new Date().toISOString(),
      });
      setReviews((current) => current.filter((item) => item.id !== review.id));
    } catch (error) {
      console.error("No se pudo actualizar el hallazgo:", error);
      setNotice("No se pudo guardar tu decisión. Reintenta.");
    } finally {
      setWorkingId(null);
    }
  };

  const createFeedbackDraft = async (review: ReviewWithId) => {
    setWorkingId(review.id);
    try {
      const source = review.sourceReferences[0];
      const student = profiles[review.studentId]?.displayName || "Estudiante";
      const messageBody = [
        `Hola ${student},`,
        "",
        review.observation,
        review.pedagogicalInference ? `Para tu razonamiento clínico: ${review.pedagogicalInference}` : "",
        source?.redactedExcerpt ? `Revisa específicamente este fragmento de tu registro: “${source.redactedExcerpt}”.` : "",
        "",
        "Este es un borrador docente: revísalo y decide si corresponde enviarlo por tu canal habitual.",
      ].filter(Boolean).join("\n");

      await setDoc(doc(collection(db, "student_message_drafts")), {
        studentId: review.studentId,
        reviewId: review.id,
        messageBody,
        status: "DRAFT_PENDING_APPROVAL",
        createdAt: new Date().toISOString(),
      });
      await updateStatus(review, "ACCEPTED_PRIVATE");
      setNotice("Borrador privado creado. No se envió ningún mensaje al estudiante.");
    } catch (error) {
      console.error("No se pudo crear el borrador:", error);
      setNotice("No se pudo crear el borrador. Reintenta.");
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
            <p className="mt-1 max-w-2xl text-xs text-indigo-100">Censo privado para priorizar tu revisión. No modifica fichas y nunca envía feedback sin tu intervención.</p>
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
              <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                {viewerHref && <button onClick={() => router.push(viewerHref)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100"><FileText className="h-3.5 w-3.5" /> Ver registro exacto</button>}
                <button onClick={() => updateStatus(review, "DISMISSED")} disabled={workingId === review.id} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"><XCircle className="h-3.5 w-3.5" /> Descartar</button>
                <button onClick={() => createFeedbackDraft(review)} disabled={workingId === review.id} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:bg-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> Crear borrador privado</button>
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
