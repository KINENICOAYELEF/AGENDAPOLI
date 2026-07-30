import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { resolveClinicalAuthor } from '@/lib/authors/resolveClinicalAuthor';
import { ResolvedAuthor } from '@/types/clinicalAuthor';

export interface InboxQuery {
  year: string;
  from: string; // ISO String (Date start)
  to: string;   // ISO String (Date end)
  limit?: number;
  kind?: 'EVALUACION' | 'EVOLUCION';
  studentId?: string;
}

export interface ReviewRecordItem {
  id: string;
  kind: 'EVALUACION' | 'EVOLUCION';
  patientId: string;
  patientName: string;
  authorUid?: string;
  authorName: string;
  authorDetails?: ResolvedAuthor;
  sessionAt?: string;
  createdAt?: string;
  status?: string;
  summary: string;
  missing: string[];
  alerts: string[];
  priority: 'P0' | 'P1' | 'P2' | 'P3';
}

function safeText(val: unknown): string {
  return typeof val === 'string' ? val.trim() : '';
}

function hasValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'object' && val !== null) return Object.keys(val).length > 0;
  return Boolean(val);
}

export async function fetchServerInbox(query: InboxQuery) {
  const db = getAdminDb();
  const limitCount = query.limit || 50;
  const year = query.year || new Date().getFullYear().toString();

  // Range boundaries
  const fromTime = query.from;
  const toTime = query.to;

  const records: ReviewRecordItem[] = [];

  // Query evaluations
  if (!query.kind || query.kind === 'EVALUACION') {
    let evalsRef = db.collection(`programs/${year}/evaluaciones`)
      .where('createdAt', '>=', fromTime)
      .where('createdAt', '<=', toTime)
      .orderBy('createdAt', 'desc')
      .limit(limitCount);

    if (query.studentId && query.studentId !== 'TODOS') {
      evalsRef = evalsRef.where('audit.createdBy', '==', query.studentId);
    }

    const evalsSnap = await evalsRef.get();
    for (const doc of evalsSnap.docs) {
      const data = doc.data() as any;
      const missing: string[] = [];
      const alerts: string[] = [];

      if (data.status === 'DRAFT') alerts.push('Guardada como borrador');
      if (!hasValue(data.interview)) missing.push('Anamnesis');
      if (!hasValue(data.guidedExam)) missing.push('Examen físico');
      if (!hasValue(data.p4_plan_structured)) missing.push('Plan terapéutico');

      let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
      if (alerts.length > 0) priority = 'P1';
      if (data.autoSynthesis?.trafficLight === 'Rojo') priority = 'P0';

      const authorUid = data.audit?.createdBy || data.autorUid;
      const rawAuthorName = data.clinicianResponsible || data.autorName;
      const authorDetails = await resolveClinicalAuthor(authorUid, rawAuthorName);

      records.push({
        id: doc.id,
        kind: 'EVALUACION',
        patientId: data.usuariaId || 'ID_DESCONOCIDO',
        patientName: data.patientName || `Paciente (${(data.usuariaId || '').slice(0, 6)})`,
        authorUid,
        authorName: authorDetails.displayName,
        authorDetails,
        sessionAt: data.sessionAt,
        createdAt: data.createdAt,
        status: data.status,
        summary: safeText(data.clinicalSynthesis || data.p4_plan_structured?.diagnostico_kinesiologico_narrativo) || 'Evaluación registrada',
        missing,
        alerts,
        priority
      });
    }
  }

  // Query evolutions
  if (!query.kind || query.kind === 'EVOLUCION') {
    let evolsRef = db.collection(`programs/${year}/evoluciones`)
      .where('createdAt', '>=', fromTime)
      .where('createdAt', '<=', toTime)
      .orderBy('createdAt', 'desc')
      .limit(limitCount);

    if (query.studentId && query.studentId !== 'TODOS') {
      evolsRef = evolsRef.where('audit.createdBy', '==', query.studentId);
    }

    const evolsSnap = await evolsRef.get();
    for (const doc of evolsSnap.docs) {
      const data = doc.data() as any;
      const missing: string[] = [];
      const alerts: string[] = [];

      if (data.status === 'DRAFT' || data.estado === 'BORRADOR') alerts.push('Guardada como borrador');
      if (!hasValue(data.sessionGoal || data.objetivoSesion)) missing.push('Objetivo de sesión');
      if (!hasValue(data.interventions)) missing.push('Intervenciones');
      if (!hasValue(data.nextPlan)) missing.push('Plan próxima sesión');

      let priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P3';
      if (alerts.length > 0) priority = 'P2';
      if (data.pain?.contradictionReason) priority = 'P1';

      const authorUid = data.audit?.createdBy || data.autorUid;
      const rawAuthorName = data.clinicianResponsible || data.autorName;
      const authorDetails = await resolveClinicalAuthor(authorUid, rawAuthorName);

      records.push({
        id: doc.id,
        kind: 'EVOLUCION',
        patientId: data.usuariaId || 'ID_DESCONOCIDO',
        patientName: data.patientName || `Paciente (${(data.usuariaId || '').slice(0, 6)})`,
        authorUid,
        authorName: authorDetails.displayName,
        authorDetails,
        sessionAt: data.sessionAt || data.fechaHoraAtencion,
        createdAt: data.createdAt,
        status: data.status || data.estado,
        summary: safeText(data.sessionGoal || data.objetivoSesion) || 'Evolución registrada',
        missing,
        alerts,
        priority
      });
    }
  }

  // Sort by createdAt descending
  records.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return {
    records: records.slice(0, limitCount),
    totalCount: records.length,
    from: fromTime,
    to: toTime
  };
}
