/**
 * Bucle de Aprendizaje y Calibración Docente (PR 12)
 * Cumple con la Sección 16, 12 y PR12 del Plan Maestro.
 * 
 * Registra decisiones docentes en Firestore (ACCEPTED, EDITED, REJECTED_*)
 * y calcula el perfil de preferencia del profesor para ajustar las observaciones.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { TeacherDecisionContractSchema, TeacherDecisionContract } from './contracts/teacherDecision';

export interface TeacherCalibrationProfile {
  teacherId: string;
  totalDecisionsCount: number;
  acceptanceRate: number; // 0.0 a 1.0
  editRate: number;       // 0.0 a 1.0
  rejectionRate: number;  // 0.0 a 1.0
  preferredTone: 'direct' | 'constructive' | 'detailed';
  lastCalibratedAt: string;
}

/**
 * Registra la decisión explícita de un docente sobre una observación o borrador.
 */
export async function recordTeacherDecision(payload: Omit<TeacherDecisionContract, 'createdAt'>): Promise<string> {
  const db = getAdminDb();
  const year = payload.year || new Date().getFullYear().toString();

  const decisionData: TeacherDecisionContract = {
    ...payload,
    year,
    createdAt: new Date().toISOString(),
  };

  // Validar con contrato estricto Zod
  const validated = TeacherDecisionContractSchema.parse(decisionData);

  const ref = await db.collection('teacher_decisions').add(validated);

  // Actualizar estado de la revisión correspondiente
  let newStatus: string = 'PENDING_TEACHER';
  if (validated.action === 'ACCEPTED') newStatus = 'ACCEPTED_PRIVATE';
  else if (validated.action === 'EDITED') newStatus = 'ACCEPTED_PRIVATE';
  else if (validated.action.startsWith('REJECTED')) newStatus = 'DISMISSED';
  else if (validated.action === 'SNOOZED') newStatus = 'SNOOZED';

  await db.collection('teacher_agent_reviews').doc(validated.reviewId).set(
    {
      status: newStatus,
      reviewedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return ref.id;
}

/**
 * Consulta y calcula el perfil de calibración del docente en los últimos 30 días.
 */
export async function getTeacherCalibrationProfile(teacherId: string): Promise<TeacherCalibrationProfile> {
  const db = getAdminDb();
  const snap = await db
    .collection('teacher_decisions')
    .where('teacherId', '==', teacherId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  if (snap.empty) {
    return {
      teacherId,
      totalDecisionsCount: 0,
      acceptanceRate: 1.0,
      editRate: 0.0,
      rejectionRate: 0.0,
      preferredTone: 'constructive',
      lastCalibratedAt: new Date().toISOString(),
    };
  }

  const decisions = snap.docs.map((d: any) => d.data() as TeacherDecisionContract);
  const total = decisions.length;
  let accepted = 0;
  let edited = 0;
  let rejected = 0;

  for (const d of decisions) {
    if (d.action === 'ACCEPTED') accepted++;
    else if (d.action === 'EDITED') edited++;
    else if (d.action.startsWith('REJECTED')) rejected++;
  }

  return {
    teacherId,
    totalDecisionsCount: total,
    acceptanceRate: accepted / total,
    editRate: edited / total,
    rejectionRate: rejected / total,
    preferredTone: edited / total > 0.3 ? 'direct' : 'constructive',
    lastCalibratedAt: new Date().toISOString(),
  };
}
