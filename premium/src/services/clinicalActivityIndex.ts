import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

export interface ClinicalActivityItem {
  recordId: string;
  kind: 'EVALUACION' | 'EVOLUCION';
  patientId: string;
  processId: string;
  authorUid: string;
  rotationId?: string;
  assignmentId?: string;
  activityAt: Timestamp;
  createdAt: string;
  updatedAt: string;
  status: string;
  contentHash: string;
  sourceCollection: string;
}

export async function indexClinicalActivity(
  year: string,
  record: {
    recordId: string;
    kind: 'EVALUACION' | 'EVOLUCION';
    patientId: string;
    processId: string;
    authorUid: string;
    rotationId?: string;
    activityAtIso: string;
    status: string;
    summary: string;
  }
): Promise<void> {
  const db = getAdminDb();
  const docId = `${record.kind}_${record.recordId}`;

  const dateObj = new Date(record.activityAtIso);
  const timestamp = Timestamp.fromDate(Number.isNaN(dateObj.getTime()) ? new Date() : dateObj);

  const item: ClinicalActivityItem = {
    recordId: record.recordId,
    kind: record.kind,
    patientId: record.patientId,
    processId: record.processId,
    authorUid: record.authorUid,
    rotationId: record.rotationId || undefined,
    activityAt: timestamp,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: record.status,
    contentHash: Buffer.from(record.summary).toString('base64').slice(0, 16),
    sourceCollection: `programs/${year}/${record.kind === 'EVALUACION' ? 'evaluaciones' : 'evoluciones'}`,
  };

  await db.collection(`programs/${year}/clinical_activity`).doc(docId).set(item, { merge: true });
}

export async function queryClinicalActivityByRange(
  year: string,
  fromIso: string,
  toIso: string,
  limitCount: number = 50
): Promise<ClinicalActivityItem[]> {
  const db = getAdminDb();

  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);

  const fromTs = Timestamp.fromDate(Number.isNaN(fromDate.getTime()) ? new Date(0) : fromDate);
  const toTs = Timestamp.fromDate(Number.isNaN(toDate.getTime()) ? new Date() : toDate);

  const snap = await db
    .collection(`programs/${year}/clinical_activity`)
    .where('activityAt', '>=', fromTs)
    .where('activityAt', '<=', toTs)
    .orderBy('activityAt', 'desc')
    .limit(limitCount)
    .get();

  return snap.docs.map((d: any) => d.data() as ClinicalActivityItem);
}
