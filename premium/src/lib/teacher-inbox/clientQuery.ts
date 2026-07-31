"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ResolvedAuthor } from "@/types/clinicalAuthor";

export type ClientInboxKind = "EVALUACION" | "EVOLUCION";

export interface ClientInboxQuery {
  year: string;
  from: string;
  to: string;
  limit?: number;
  kind?: ClientInboxKind;
}

export interface ClientInboxRecord {
  id: string;
  kind: ClientInboxKind;
  patientId: string;
  patientName: string;
  processId?: string;
  authorUid?: string;
  authorName: string;
  authorDetails?: ResolvedAuthor;
  sessionAt?: string;
  createdAt?: string;
  status?: string;
  summary: string;
  missing: string[];
  alerts: string[];
  priority: "P0" | "P1" | "P2" | "P3";
}

type TimestampLike = {
  toDate?: () => Date;
  seconds?: number;
  _seconds?: number;
};

type RawClinicalRecord = {
  id: string;
  kind: ClientInboxKind;
  data: DocumentData;
  occurredAt: string;
  occurredAtMs: number;
};

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object" && value !== null) {
    return Object.keys(value).length > 0;
  }
  return Boolean(value);
}

export function normalizeClinicalDate(value: unknown): string | undefined {
  let date: Date | undefined;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "string" || typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "object" && value !== null) {
    const timestamp = value as TimestampLike;
    if (typeof timestamp.toDate === "function") {
      date = timestamp.toDate();
    } else {
      const seconds = timestamp.seconds ?? timestamp._seconds;
      if (typeof seconds === "number") {
        date = new Date(seconds * 1000);
      }
    }
  }

  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function getRecordDate(data: DocumentData): string | undefined {
  return normalizeClinicalDate(
    data.sessionAt ??
      data.fechaHoraAtencion ??
      data.audit?.createdAt ??
      data.createdAt ??
      data.updatedAt,
  );
}

function getPatientName(data: DocumentData, resolvedName?: string): string {
  return (
    resolvedName ||
    safeText(data.patientName) ||
    safeText(data.usuariaName) ||
    safeText(data.identity_paciente?.fullName) ||
    `Persona (${safeText(data.usuariaId).slice(0, 6) || "sin ID"})`
  );
}

function resolveAuthorFromData(
  authorUid: string | undefined,
  rawName: string | undefined,
  userData?: DocumentData,
): ResolvedAuthor {
  if (userData) {
    return {
      uid: authorUid || null,
      displayName:
        safeText(userData.displayName) ||
        safeText(userData.nombreCompleto) ||
        safeText(userData.email) ||
        "Interno registrado",
      studentCode: safeText(userData.studentCode) || undefined,
      universityCode:
        safeText(userData.universityCode) ||
        safeText(userData.university) ||
        undefined,
      attributionStatus: "VERIFIED",
    };
  }

  if (rawName) {
    return {
      uid: authorUid || null,
      displayName: rawName,
      attributionStatus: "LEGACY_MATCH",
    };
  }

  return {
    uid: authorUid || null,
    displayName: authorUid
      ? `Autor no identificado (${authorUid.slice(0, 8)})`
      : "Autoría no determinada",
    studentCode: authorUid ? undefined : "INT-UNKNOWN",
    attributionStatus: "UNKNOWN",
  };
}

async function loadCollection(
  year: string,
  kind: ClientInboxKind,
): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const collectionName =
    kind === "EVALUACION" ? "evaluaciones" : "evoluciones";
  const snapshot = await getDocs(
    collection(db, "programs", year, collectionName),
  );
  return snapshot.docs;
}

async function loadDocumentMap(
  paths: Array<{ key: string; segments: [string, ...string[]] }>,
): Promise<Map<string, DocumentData>> {
  const unique = new Map(paths.map((item) => [item.key, item.segments]));
  const entries = await Promise.all(
    Array.from(unique.entries()).map(async ([key, segments]) => {
      try {
        const snapshot = await getDoc(
          doc(db, segments[0], ...segments.slice(1)),
        );
        return snapshot.exists()
          ? ([key, snapshot.data()] as const)
          : undefined;
      } catch {
        return undefined;
      }
    }),
  );

  return new Map(entries.filter((entry): entry is readonly [string, DocumentData] => Boolean(entry)));
}

export async function fetchClientInbox(
  query: ClientInboxQuery,
): Promise<{ records: ClientInboxRecord[]; totalCount: number }> {
  const fromMs = new Date(query.from).getTime();
  const toMs = new Date(query.to).getTime();
  const limitCount = query.limit || 50;

  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new Error("Rango de fechas inválido");
  }

  const kinds: ClientInboxKind[] = query.kind
    ? [query.kind]
    : ["EVALUACION", "EVOLUCION"];
  const snapshots = await Promise.all(
    kinds.map(async (kind) => ({
      kind,
      docs: await loadCollection(query.year, kind),
    })),
  );

  const rawRecords: RawClinicalRecord[] = snapshots.flatMap(({ kind, docs }) =>
    docs.flatMap((snapshot) => {
      const data = snapshot.data();
      const occurredAt = getRecordDate(data);
      if (!occurredAt) return [];
      const occurredAtMs = new Date(occurredAt).getTime();
      if (occurredAtMs < fromMs || occurredAtMs > toMs) return [];
      return [{ id: snapshot.id, kind, data, occurredAt, occurredAtMs }];
    }),
  );

  rawRecords.sort((a, b) => b.occurredAtMs - a.occurredAtMs);
  const selectedRecords = rawRecords.slice(0, limitCount);

  const authorPaths: Array<{
    key: string;
    segments: [string, ...string[]];
  }> = [];
  const patientPaths: Array<{
    key: string;
    segments: [string, ...string[]];
  }> = [];

  for (const record of selectedRecords) {
    const authorUid =
      safeText(record.data.audit?.createdBy) ||
      safeText(record.data.autorUid) ||
      safeText(record.data.internoAtendioId);
    const patientId =
      safeText(record.data.usuariaId) ||
      safeText(record.data.personaUsuariaId);

    if (authorUid) {
      authorPaths.push({ key: authorUid, segments: ["users", authorUid] });
    }
    if (patientId) {
      patientPaths.push({
        key: patientId,
        segments: ["programs", query.year, "usuarias", patientId],
      });
    }
  }

  const [authors, patients] = await Promise.all([
    loadDocumentMap(authorPaths),
    loadDocumentMap(patientPaths),
  ]);

  const records = selectedRecords.map<ClientInboxRecord>((record) => {
    const data = record.data;
    const authorUid =
      safeText(data.audit?.createdBy) ||
      safeText(data.autorUid) ||
      safeText(data.internoAtendioId) ||
      undefined;
    const rawAuthorName =
      safeText(data.clinicianResponsible) ||
      safeText(data.autorName) ||
      undefined;
    const authorDetails = resolveAuthorFromData(
      authorUid,
      rawAuthorName,
      authorUid ? authors.get(authorUid) : undefined,
    );
    const patientId =
      safeText(data.usuariaId) ||
      safeText(data.personaUsuariaId) ||
      "ID_DESCONOCIDO";
    const patientData = patients.get(patientId);
    const resolvedPatientName = patientData
      ? safeText(patientData.identity?.fullName) ||
        safeText(patientData.nombreCompleto) ||
        `${safeText(patientData.nombres)} ${safeText(patientData.apellidos)}`.trim()
      : undefined;

    const missing: string[] = [];
    const alerts: string[] = [];
    const isDraft = data.status === "DRAFT" || data.estado === "BORRADOR";

    if (isDraft) alerts.push("Guardada como borrador");

    let priority: ClientInboxRecord["priority"] = "P2";
    let summary = "";

    if (record.kind === "EVALUACION") {
      if (!hasValue(data.interview)) missing.push("Anamnesis");
      if (!hasValue(data.guidedExam)) missing.push("Examen físico");
      if (!hasValue(data.p4_plan_structured)) missing.push("Plan terapéutico");
      if (isDraft) priority = "P1";
      if (data.autoSynthesis?.trafficLight === "Rojo") priority = "P0";
      summary =
        safeText(data.clinicalSynthesis) ||
        safeText(data.p4_plan_structured?.diagnostico_kinesiologico_narrativo) ||
        "Evaluación registrada";
    } else {
      if (!hasValue(data.sessionGoal || data.objetivoSesion)) {
        missing.push("Objetivo de sesión");
      }
      if (!hasValue(data.interventions)) missing.push("Intervenciones");
      if (!hasValue(data.nextPlan)) missing.push("Plan próxima sesión");
      if (data.pain?.contradictionReason) priority = "P1";
      summary =
        safeText(data.sessionGoal) ||
        safeText(data.objetivoSesion) ||
        "Evolución registrada";
    }

    return {
      id: record.id,
      kind: record.kind,
      patientId,
      patientName: getPatientName(data, resolvedPatientName),
      processId:
        safeText(data.procesoId) ||
        safeText(data.processId) ||
        undefined,
      authorUid,
      authorName: authorDetails.displayName,
      authorDetails,
      sessionAt: record.occurredAt,
      createdAt: record.occurredAt,
      status: isDraft ? "DRAFT" : "CLOSED",
      summary,
      missing,
      alerts,
      priority,
    };
  });

  return { records, totalCount: rawRecords.length };
}
