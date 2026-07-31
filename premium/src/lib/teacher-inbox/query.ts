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

function normalizeRecordDate(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (value && typeof value.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return undefined;
}

function isInsideRange(value: unknown, fromIso: string, toIso: string): boolean {
  const normalized = normalizeRecordDate(value);
  if (!normalized) return false;
  const instant = new Date(normalized).getTime();
  return !Number.isNaN(instant) && instant >= new Date(fromIso).getTime() && instant <= new Date(toIso).getTime();
}

async function loadRecentRecords(
  db: ReturnType<typeof getAdminDb>,
  year: string,
  collectionName: 'evaluaciones' | 'evoluciones',
  fromIso: string,
  toIso: string,
  limitCount: number,
  studentId?: string,
) {
  // Los formularios actuales usan sessionAt; fechaHoraAtencion conserva las
  // fichas antiguas. Cada consulta es acotada por fecha antes de llegar al
  // servidor, en vez de leer una colección completa y filtrarla después.
  const dateFields = ['sessionAt', 'fechaHoraAtencion'];
  const snapshots = await Promise.all(dateFields.map(async (field) => {
    let ref: any = db.collection(`programs/${year}/${collectionName}`)
      .where(field, '>=', fromIso)
      .where(field, '<=', toIso)
      .limit(limitCount);
    if (studentId && studentId !== 'TODOS') {
      ref = ref.where('audit.createdBy', '==', studentId);
    }
    try {
      return await ref.get();
    } catch (error) {
      // Si un campo legado tiene tipos incompatibles, el campo normalizado
      // sigue entregando resultados sin disparar una lectura masiva.
      console.warn(`No se pudo consultar ${collectionName}.${field}:`, error);
      return { docs: [] };
    }
  }));

  const unique = new Map<string, any>();
  snapshots.flatMap(snapshot => snapshot.docs).forEach((snapshot: any) => {
    unique.set(snapshot.id, snapshot);
  });
  return Array.from(unique.values());
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
    const evalDocs = await loadRecentRecords(
      db, year, 'evaluaciones', fromTime, toTime, limitCount, query.studentId,
    );
    for (const doc of evalDocs) {
      const data = doc.data() as any;
      const recordDate = data.sessionAt || data.fechaHoraAtencion || data.audit?.createdAt || data.createdAt;
      
      if (isInsideRange(recordDate, fromTime, toTime)) {
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

        const exactHref = `/app/revision-docente/registros/${doc.data().kind || 'EVALUACION'}/${doc.id}`;

        records.push({
          id: doc.id,
          kind: 'EVALUACION',
          patientId: data.usuariaId || 'ID_DESCONOCIDO',
          patientName: data.patientName || `Paciente (${(data.usuariaId || '').slice(0, 6)})`,
          processId: data.procesoId || 'SIN_PROCESO',
          authorUid: authorUid || 'UID_DESCONOCIDO',
          authorName: authorDetails.displayName,
          authorDetails,
          sessionAt: normalizeRecordDate(data.sessionAt || recordDate),
          createdAt: normalizeRecordDate(recordDate),
          status: data.status === 'DRAFT' ? 'DRAFT' : 'CLOSED',
          summary: safeText(data.clinicalSynthesis || data.p4_plan_structured?.diagnostico_kinesiologico_narrativo) || 'Evaluación registrada',
          missing,
          alerts,
          priority: priority === 'P3' ? 'P2' : priority,
          exactHref: `/app/revision-docente/registros/EVALUACION/${doc.id}`
        } as any);
      }
    }
  }

  // Query evolutions
  if (!query.kind || query.kind === 'EVOLUCION') {
    const evolDocs = await loadRecentRecords(
      db, year, 'evoluciones', fromTime, toTime, limitCount, query.studentId,
    );
    for (const doc of evolDocs) {
      const data = doc.data() as any;
      const recordDate = data.sessionAt || data.fechaHoraAtencion || data.audit?.createdAt || data.createdAt;

      if (isInsideRange(recordDate, fromTime, toTime)) {
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
          processId: data.procesoId || 'SIN_PROCESO',
          authorUid: authorUid || 'UID_DESCONOCIDO',
          authorName: authorDetails.displayName,
          authorDetails,
          sessionAt: normalizeRecordDate(recordDate),
          createdAt: normalizeRecordDate(recordDate),
          status: data.status === 'DRAFT' || data.estado === 'BORRADOR' ? 'DRAFT' : 'CLOSED',
          summary: safeText(data.sessionGoal || data.objetivoSesion) || 'Evolución registrada',
          missing,
          alerts,
          priority: priority === 'P3' ? 'P2' : priority,
          exactHref: `/app/revision-docente/registros/EVOLUCION/${doc.id}`
        } as any);
      }
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
