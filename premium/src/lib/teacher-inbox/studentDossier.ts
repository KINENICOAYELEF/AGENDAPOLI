/**
 * FICHA LONGITUDINAL DEL ALUMNO
 *
 * Reúne en una sola consulta de servidor todo lo que el docente necesitaba
 * reconstruir a mano desde cinco pantallas distintas: actividad clínica,
 * simulaciones, hallazgos del agente, incoherencias detectadas y el feedback
 * que ya se le entregó.
 *
 * Corre con el SDK Admin para que las lecturas ocurran una vez en el servidor
 * y no una vez por navegador abierto.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export type DossierRecord = {
  id: string;
  kind: 'EVALUACION' | 'REEVALUACION' | 'EVOLUCION';
  sessionAt: string;
  patientId: string;
  patientName: string;
  processId: string;
  status: string;
};

export type DossierFinding = {
  id: string;
  createdAt: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: string;
  observation: string;
  coherenceFindings: Array<{ type: string; explanation: string; severity: string }>;
  recordHref: string;
};

export type StudentDossier = {
  studentId: string;
  displayName: string;
  email: string;
  profile: {
    strengths: string[];
    improvementGaps: string[];
    recurringPatterns: Array<{ description: string; occurrences: number; lastSeenAt?: string }>;
    lastUpdatedAt?: string;
  };
  clinicalActivity: {
    totalEvaluations: number;
    totalReassessments: number;
    totalEvolutions: number;
    draftsPending: number;
    distinctPatients: number;
    lastActivityAt?: string;
    recent: DossierRecord[];
  };
  simulations: {
    osceAttempts: number;
    defenseAttempts: number;
    total: number;
    meets15: boolean;
    lastAttemptAt?: string;
  };
  findings: {
    total: number;
    byPriority: Record<'P0' | 'P1' | 'P2' | 'P3', number>;
    /** Cuántas veces se repitió cada tipo de incoherencia. Lo que revela el patrón. */
    coherenceTally: Array<{ type: string; count: number }>;
    pending: DossierFinding[];
    history: DossierFinding[];
  };
  deliveredFeedback: Array<{ id: string; approvedAt: string; messageBody: string }>;
};

const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');

function iso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

function recordDate(data: any): string {
  return iso(data.sessionAt) || iso(data.fechaHoraAtencion) || iso(data.audit?.createdAt) || iso(data.createdAt);
}

function mapFinding(id: string, data: any): DossierFinding {
  const source = data.sourceReferences?.[0];
  const href = source?.recordId
    ? `${APP_BASE}/app/revision-docente/registros/${source.collection === 'evoluciones' ? 'EVOLUCION' : 'EVALUACION'}/${source.recordId}`
    : `${APP_BASE}/app/revision-docente`;
  return {
    id,
    createdAt: iso(data.createdAt),
    priority: data.priority || 'P3',
    status: data.status || 'PENDING_TEACHER',
    observation: String(data.observation || ''),
    coherenceFindings: Array.isArray(data.coherenceFindings) ? data.coherenceFindings : [],
    recordHref: href,
  };
}

export async function buildStudentDossier(studentId: string, year: string): Promise<StudentDossier> {
  const db = getAdminDb();

  const [userSnap, profileSnap, evalsSnap, evolsSnap, findingsSnap, feedbackSnap, osceSnap, defenseSnap] = await Promise.all([
    db.collection('users').doc(studentId).get(),
    db.collection('student_learning_profiles').doc(studentId).get(),
    db.collection(`programs/${year}/evaluaciones`).where('audit.createdBy', '==', studentId).get(),
    db.collection(`programs/${year}/evoluciones`).where('audit.createdBy', '==', studentId).get(),
    db.collection('teacher_agent_reviews').where('studentId', '==', studentId).get(),
    db.collection('student_message_drafts').where('studentId', '==', studentId).get(),
    db.collection('simulador_intentos').where('userId', '==', studentId).get(),
    db.collection('defensas_voz_intentos').where('userId', '==', studentId).get(),
  ]);

  const user = userSnap.data() || {};
  const profile = profileSnap.data() || {};

  // ── Actividad clínica ──────────────────────────────────────────────────────
  const allRecords: Array<{ id: string; data: any; collection: 'evaluaciones' | 'evoluciones' }> = [
    ...evalsSnap.docs.map((doc: any) => ({ id: doc.id, data: doc.data(), collection: 'evaluaciones' as const })),
    ...evolsSnap.docs.map((doc: any) => ({ id: doc.id, data: doc.data(), collection: 'evoluciones' as const })),
  ];

  const patientIds = new Set<string>();
  let totalEvaluations = 0;
  let totalReassessments = 0;
  let draftsPending = 0;

  allRecords.forEach(({ data, collection }) => {
    const patientId = data.usuariaId || data.personaUsuariaId || '';
    if (patientId) patientIds.add(patientId);
    if (data.status === 'DRAFT' || data.estado === 'BORRADOR') draftsPending++;
    if (collection === 'evaluaciones') {
      if (data.type === 'REEVALUATION') totalReassessments++;
      else totalEvaluations++;
    }
  });

  const sorted = allRecords
    .map(item => ({ ...item, at: recordDate(item.data) }))
    .sort((a, b) => b.at.localeCompare(a.at));

  // Solo se resuelven los nombres de las personas que se van a mostrar.
  const recentSlice = sorted.slice(0, 20);
  const namesNeeded = [...new Set(recentSlice.map(item => item.data.usuariaId || item.data.personaUsuariaId).filter(Boolean))];
  const patientNames = new Map<string, string>();
  await Promise.all(namesNeeded.map(async (patientId: string) => {
    try {
      const snap = await db.doc(`programs/${year}/usuarias/${patientId}`).get();
      const data = snap.data();
      if (data) patientNames.set(patientId, data.identity?.fullName || data.nombreCompleto || 'Persona usuaria');
    } catch { /* si falla, se muestra el identificador */ }
  }));

  const recent: DossierRecord[] = recentSlice.map(({ id, data, collection, at }) => {
    const patientId = data.usuariaId || data.personaUsuariaId || '';
    return {
      id,
      kind: collection === 'evoluciones'
        ? 'EVOLUCION'
        : data.type === 'REEVALUATION' ? 'REEVALUACION' : 'EVALUACION',
      sessionAt: at,
      patientId,
      patientName: patientNames.get(patientId) || (patientId ? `Persona (${patientId.slice(0, 6)})` : 'Sin persona'),
      processId: data.procesoId || '',
      status: data.status || data.estado || 'DESCONOCIDO',
    };
  });

  // ── Hallazgos del agente ───────────────────────────────────────────────────
  const findings = findingsSnap.docs
    .map((doc: any) => mapFinding(doc.id, doc.data()))
    .sort((a: DossierFinding, b: DossierFinding) => b.createdAt.localeCompare(a.createdAt));

  const byPriority: Record<'P0' | 'P1' | 'P2' | 'P3', number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const tally = new Map<string, number>();
  findings.forEach((finding: DossierFinding) => {
    byPriority[finding.priority] = (byPriority[finding.priority] || 0) + 1;
    finding.coherenceFindings.forEach(item => {
      tally.set(item.type, (tally.get(item.type) || 0) + 1);
    });
  });

  return {
    studentId,
    displayName: user.displayName || user.email || studentId,
    email: user.email || '',
    profile: {
      strengths: profile.strengths || [],
      improvementGaps: profile.improvementGaps || profile.areasForImprovement || [],
      recurringPatterns: (profile.recurringErrorPatterns || profile.recurringPatterns || []).map((pattern: any) => ({
        description: pattern.description || '',
        occurrences: pattern.occurrences || 0,
        lastSeenAt: iso(pattern.lastSeenAt || pattern.lastSeen),
      })),
      lastUpdatedAt: iso(profile.lastUpdatedAt),
    },
    clinicalActivity: {
      totalEvaluations,
      totalReassessments,
      totalEvolutions: evolsSnap.size,
      draftsPending,
      distinctPatients: patientIds.size,
      lastActivityAt: sorted[0]?.at,
      recent,
    },
    simulations: {
      osceAttempts: osceSnap.size,
      defenseAttempts: defenseSnap.size,
      total: osceSnap.size + defenseSnap.size,
      meets15: osceSnap.size + defenseSnap.size >= 15,
      lastAttemptAt: iso(profile.simulationStats?.lastAttemptAt),
    },
    findings: {
      total: findings.length,
      byPriority,
      coherenceTally: Array.from(tally.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      pending: findings.filter((finding: DossierFinding) => finding.status === 'PENDING_TEACHER').slice(0, 10),
      history: findings.filter((finding: DossierFinding) => finding.status !== 'PENDING_TEACHER').slice(0, 20),
    },
    deliveredFeedback: feedbackSnap.docs
      .map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          approvedAt: iso(data.approvedAt || data.createdAt),
          messageBody: String(data.messageBody || ''),
        };
      })
      .sort((a: any, b: any) => b.approvedAt.localeCompare(a.approvedAt))
      .slice(0, 15),
  };
}
