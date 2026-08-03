export type StudentClinicalTaskKind =
  | 'INITIAL_EVALUATION_MISSING'
  | 'INITIAL_EVALUATION_INSUFFICIENT'
  | 'REEVALUATION_DUE';

export type StudentClinicalTaskStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

export interface StudentClinicalTask {
  id?: string;
  year: string;
  studentId: string;
  patientId: string;
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
