/**
 * Contratos y Tipos del Modelo de Rotaciones Clínicas (PR-04)
 * Cumple con la Sección PR-04 del Plan Maestro.
 */

export interface Rotation {
  id?: string;
  year: string;
  universityCode: string; // ej. UNAB, UCH, UDD, UST
  label: string;          // ej. "Rotación I - Hospital El Carmen"
  startDate: string;      // ISO String
  endDate: string;        // ISO String
  durationWeeks: 8 | 9 | 10 | 12;
  formativeWindow: {
    from: string;
    to: string;
  };
  finalWindow: {
    from: string;
    to: string;
  };
  secondChanceWindow?: {
    from: string;
    to: string;
  };
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  createdAt?: string;
}

export interface RotationMember {
  id?: string;
  rotationId: string;
  studentId: string;
  studentCode?: string;
  universityCode: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN';
}

export interface PatientAssignment {
  id?: string;
  patientId: string;
  processId: string;
  studentId: string;
  rotationId?: string;
  startsAt: string;
  endsAt?: string | null;
  reasonStarted?: string;
  reasonEnded?: string;
  active: boolean;
}
