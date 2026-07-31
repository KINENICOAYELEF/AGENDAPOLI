/**
 * Contrato oficial de items para la Bandeja Docente (Fase 2)
 */

export type TeacherInboxItem = {
  recordId: string;
  kind: "EVALUACION" | "EVOLUCION";
  patientId: string;
  patientName?: string;
  processId: string;
  authorUid: string;
  authorName: string;
  authorEmail?: string;
  occurredAt: string;
  status: "DRAFT" | "CLOSED";
  priority: "P0" | "P1" | "P2" | "NORMAL";
  alerts: string[];
  missingFields: string[];
  summary: string;
  exactHref: string;
};

export type TeacherInboxFilter = "HOY" | "AYER" | "7_DIAS" | "ANIO";
