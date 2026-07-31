"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  Clock,
  ExternalLink,
  FileText,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { db } from "@/lib/firebase";
import { buildClinicalRecordLink } from "@/lib/navigation/clinicalRecordLink";
import { hiddenKeys, humanize, humanizeKey } from "@/utils/humanizer";

type RecordKind = "EVALUACION" | "EVOLUCION";
type DataRecord = Record<string, unknown>;

const PRIVATE_OR_TECHNICAL_KEYS = new Set([
  "id",
  "audit",
  "createdAt",
  "updatedAt",
  "createdBy",
  "autorUid",
  "usuariaId",
  "personaUsuariaId",
  "procesoId",
  "processId",
  "sessionAt",
  "fechaHoraAtencion",
  "clinicianResponsible",
]);

function asRecord(value: unknown): DataRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as DataRecord)
    : undefined;
}

function textValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function valueAt(record: DataRecord | undefined, key: string): unknown {
  return record?.[key];
}

function dateFromValue(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const timestamp = asRecord(value);
  const toDate = timestamp?.toDate;
  if (typeof toDate === "function") {
    const date = toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : undefined;
  }

  const seconds = timestamp?.seconds ?? timestamp?._seconds;
  if (typeof seconds === "number") return new Date(seconds * 1000);
  return undefined;
}

function formatClinicalDate(value: unknown): string {
  const date = dateFromValue(value);
  return date
    ? date.toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })
    : "Fecha no registrada";
}

function hasContent(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function ClinicalValue({ value, depth = 0 }: { value: unknown; depth?: number }): ReactNode {
  if (!hasContent(value)) return <span className="text-slate-400">Sin registro</span>;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return <span className="whitespace-pre-wrap break-words">{humanize(typeof value === "boolean" ? value : String(value))}</span>;
  }

  if (Array.isArray(value)) {
    const primitiveItems = value.every(
      (item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean",
    );
    if (primitiveItems) {
      return (
        <ul className="list-disc space-y-1 pl-4">
          {value.map((item, index) => <li key={index}>{humanize(String(item))}</li>)}
        </ul>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={index} className="rounded-lg border border-slate-100 bg-white/70 p-3">
            <ClinicalValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  const objectValue = asRecord(value);
  if (!objectValue) return <span className="text-slate-400">Sin formato legible</span>;

  const entries = Object.entries(objectValue).filter(([key, item]) => (
    !hiddenKeys.has(key) && !PRIVATE_OR_TECHNICAL_KEYS.has(key) && hasContent(item)
  ));
  if (entries.length === 0) return <span className="text-slate-400">Sin datos clínicos registrados</span>;

  return (
    <dl className={depth === 0 ? "space-y-3" : "space-y-2"}>
      {entries.map(([key, item]) => (
        <div key={key} className="grid gap-1 sm:grid-cols-[minmax(10rem,13rem)_1fr] sm:gap-3">
          <dt className="text-[10px] font-black uppercase tracking-wider text-slate-500">
            {humanizeKey(key)}
          </dt>
          <dd className="min-w-0 text-xs leading-relaxed text-slate-800">
            <ClinicalValue value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ClinicalSection({ title, value }: { title: string; value: unknown }) {
  if (!hasContent(value)) return null;
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
      <h2 className="mb-3 text-sm font-bold text-slate-900">{title}</h2>
      <div className="text-xs leading-relaxed text-slate-700">
        <ClinicalValue value={value} />
      </div>
    </section>
  );
}

export default function VisorRegistroSoloLecturaPage() {
  const { user } = useAuth();
  const { globalActiveYear } = useYear();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const rawKind = (params.kind as string)?.toUpperCase();
  const kind: RecordKind | undefined = rawKind === "EVALUACION" || rawKind === "EVOLUCION"
    ? rawKind
    : undefined;
  const recordId = params.recordId as string;
  const returnTo = searchParams.get("returnTo") || "revision-docente";

  const [recordData, setRecordData] = useState<DataRecord | null>(null);
  const [patientName, setPatientName] = useState<string>();
  const [authorName, setAuthorName] = useState<string>();
  const [authorCode, setAuthorCode] = useState<string>();
  const [authorUniversity, setAuthorUniversity] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!globalActiveYear || !recordId || !kind) return;
    let active = true;

    const fetchRecord = async () => {
      setLoading(true);
      setError(null);
      try {
        const collectionName = kind === "EVALUACION" ? "evaluaciones" : "evoluciones";
        const snapshot = await getDoc(doc(db, "programs", globalActiveYear, collectionName, recordId));
        if (!snapshot.exists()) {
          if (active) setError("El registro clínico no fue encontrado en este año de trabajo.");
          return;
        }

        const data: DataRecord = { id: snapshot.id, ...snapshot.data() };
        const audit = asRecord(data.audit);
        const patientId = textValue(data.usuariaId, data.personaUsuariaId);
        const authorUid = textValue(audit?.createdBy, data.autorUid, data.internoAtendioId);
        const patientSnapshot = patientId
          ? await getDoc(doc(db, "programs", globalActiveYear, "usuarias", patientId))
          : undefined;
        const authorSnapshot = authorUid ? await getDoc(doc(db, "users", authorUid)) : undefined;
        const patientData = patientSnapshot?.exists() ? asRecord(patientSnapshot.data()) : undefined;
        const authorData = authorSnapshot?.exists() ? asRecord(authorSnapshot.data()) : undefined;
        const identity = asRecord(patientData?.identity);
        const patientSnapshotInRecord = asRecord(data.identity_paciente);

        if (!active) return;
        setRecordData(data);
        setPatientName(textValue(
          data.patientName,
          data.usuariaName,
          patientSnapshotInRecord?.fullName,
          identity?.fullName,
          patientData?.nombreCompleto,
        ));
        setAuthorName(textValue(
          authorData?.displayName,
          authorData?.nombreCompleto,
          authorData?.email,
          data.clinicianResponsible,
          data.autorName,
        ));
        setAuthorCode(textValue(authorData?.studentCode));
        setAuthorUniversity(textValue(authorData?.universityCode, authorData?.university));
      } catch (caughtError: unknown) {
        console.error("Error cargando registro en visor de solo lectura:", caughtError);
        if (active) setError("Ocurrió un error al conectar con la base de datos.");
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchRecord();
    return () => { active = false; };
  }, [globalActiveYear, kind, recordId]);

  const contentSections = useMemo(() => {
    if (!recordData || !kind) return [];
    if (kind === "EVALUACION") {
      return [
        ["Anamnesis y entrevista", recordData.interview],
        ["Examen físico", recordData.guidedExam],
        ["Razonamiento clínico", recordData.p3_case_organizer ?? recordData.autoSynthesis],
        ["Diagnóstico y plan terapéutico", recordData.p4_plan_structured],
        ["Síntesis clínica", recordData.clinicalSynthesis],
      ] as const;
    }
    return [
      ["Objetivo de la sesión", recordData.sessionGoal ?? recordData.objetivoSesion],
      ["Estado, síntomas y dolor", {
        estadoSesion: recordData.sessionStatus,
        dolor: recordData.pain,
        readiness: recordData.readiness,
        signosVitales: recordData.vitalSigns,
      }],
      ["Intervenciones realizadas", recordData.interventions],
      ["Ejercicios y educación", {
        ejercicios: recordData.exerciseRx ?? recordData.exercises,
        educacion: recordData.educationNotes,
      }],
      ["Proyección clínica", {
        planProximaSesion: recordData.nextPlan ?? recordData.planProximaSesion,
        objetivosTrabajados: recordData.selectedObjectivesSnapshot ?? recordData.objectiveWork,
        entregaAlEquipo: recordData.handoffText,
      }],
      ["Notas adicionales", recordData.notesLegacy],
    ] as const;
  }, [kind, recordData]);

  if (user?.role !== "DOCENTE") {
    return (
      <div className="mx-auto my-12 max-w-md space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-sm">
        <ShieldCheck className="mx-auto h-10 w-10 text-amber-600" />
        <h1 className="font-bold">Acceso exclusivo docente</h1>
        <p className="text-xs text-slate-600">Este visor de supervisión clínica requiere permisos de docente.</p>
      </div>
    );
  }

  const audit = asRecord(recordData?.audit);
  const patientId = textValue(recordData?.usuariaId, recordData?.personaUsuariaId);
  const processId = textValue(recordData?.procesoId, recordData?.processId);
  const authorUid = textValue(audit?.createdBy, recordData?.autorUid, recordData?.internoAtendioId);
  const sessionDate = recordData?.sessionAt ?? recordData?.fechaHoraAtencion ?? audit?.createdAt;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <button
          onClick={() => router.push(`/app/${returnTo}`)}
          className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 transition-colors hover:text-indigo-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a la Bandeja Docente
        </button>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Visor de Supervisión · Solo lectura
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-64 flex-col items-center justify-center space-y-3 animate-pulse">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-500">Cargando registro clínico…</p>
        </div>
      ) : error || !recordData || !kind ? (
        <div className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900">
          <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
          <h1 className="font-bold">{error || "El registro solicitado no es válido."}</h1>
        </div>
      ) : (
        <article className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-indigo-100 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-800">
                  {kind === "EVALUACION" ? "Evaluación" : "Evolución"}
                </span>
                <span className={`rounded-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${recordData.status === "DRAFT" || recordData.estado === "BORRADOR" ? "bg-violet-100 text-violet-800" : "bg-emerald-100 text-emerald-800"}`}>
                  {recordData.status === "DRAFT" || recordData.estado === "BORRADOR" ? "Borrador" : "Cerrado"}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {patientName || "Persona usuaria sin nombre registrado"}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {processId ? "Registro vinculado a un proceso clínico activo." : "Registro sin proceso clínico vinculado."}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-right">
              <div className="mb-0.5 flex items-center justify-end gap-1.5 text-xs font-bold text-slate-500">
                <Clock className="h-3.5 w-3.5" /> Fecha de atención
              </div>
              <span className="text-xs font-bold text-slate-800">{formatClinicalDate(sessionDate)}</span>
            </div>
          </header>

          <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"><UserCheck className="h-5 w-5" /></div>
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Registrado por</p>
                <h2 className="text-sm font-bold text-slate-900">{authorName || "Autoría no determinada"}</h2>
                {(authorCode || authorUniversity) && (
                  <p className="mt-0.5 text-[11px] text-slate-600">{[authorCode, authorUniversity].filter(Boolean).join(" · ")}</p>
                )}
              </div>
            </div>
            {patientId && (
              <button
                onClick={() => router.push(buildClinicalRecordLink({
                  patientId,
                  processId,
                  recordId,
                  recordType: kind,
                  mode: "readonly",
                  returnTo: "revision-docente",
                }))}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Abrir expediente completo <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </section>

          <details className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
            <summary className="cursor-pointer font-bold text-slate-700">Trazabilidad técnica</summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
              <div><dt className="text-slate-400">Código de registro</dt><dd className="font-mono break-all">{recordId}</dd></div>
              {processId && <div><dt className="text-slate-400">Código de proceso</dt><dd className="font-mono break-all">{processId}</dd></div>}
              {authorUid && <div><dt className="text-slate-400">Código de autor</dt><dd className="font-mono break-all">{authorUid}</dd></div>}
            </dl>
          </details>

          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              <ClipboardList className="h-4 w-4" /> Contenido clínico registrado
            </h2>
            <div className="grid gap-4">
              {contentSections.map(([title, value]) => <ClinicalSection key={title} title={title} value={value} />)}
            </div>
          </section>

          <footer className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs text-emerald-900">
            <div className="flex gap-2"><ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" /><p>Esta vista no permite editar, firmar ni cambiar el registro clínico. Cualquier modificación debe hacerse fuera del modo supervisión.</p></div>
          </footer>
        </article>
      )}
    </div>
  );
}
