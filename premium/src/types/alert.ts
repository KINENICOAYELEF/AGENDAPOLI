/**
 * Modelo de Alertas Relevantes (Fase 5)
 */

export type AlertStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "SNOOZED"
  | "RESOLVED"
  | "DISMISSED";

export interface ClinicalAlertItem {
  id: string;
  rotationId?: string;
  studentUid: string;
  studentName?: string;
  patientId: string;
  patientName?: string;
  recordId?: string;
  kind?: 'EVALUACION' | 'EVOLUCION';
  reason: string;
  importance: 'P0' | 'P1' | 'P2';
  status: AlertStatus;
  createdAt: string;
  snoozedUntil?: string;
  exactHref?: string;
}
