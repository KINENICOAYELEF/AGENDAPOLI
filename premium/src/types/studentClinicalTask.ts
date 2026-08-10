export type StudentClinicalTaskKind =
  | 'INITIAL_EVALUATION_MISSING'
  | 'INITIAL_EVALUATION_INSUFFICIENT'
  | 'REEVALUATION_DUE'
  /**
   * Retroalimentación aprobada por el docente.
   *
   * A diferencia de las otras, no exige completar un registro: se cierra
   * cuando la estudiante la lee. Faltaba, y por eso el feedback redactado por
   * la IA no tenía ninguna vía para llegarle dentro de la plataforma.
   */
  | 'TEACHER_FEEDBACK';

export type StudentClinicalTaskStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

export interface StudentClinicalTask {
  id?: string;
  year: string;
  studentId: string;
  /** Opcional: un feedback longitudinal abarca varios procesos, no una persona. */
  patientId?: string;
  processId?: string;
  reviewId: string;
  kind: StudentClinicalTaskKind;
  status: StudentClinicalTaskStatus;
  title: string;
  message: string;
  actionLabel: string;
  actionHref: string;
  createdAt: string;
  createdBy: string;
  resolvedAt?: string;
  resolvedByRecordId?: string;
  resolution?: string;
}
