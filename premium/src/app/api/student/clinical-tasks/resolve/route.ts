import { NextResponse } from 'next/server';
import { requireAuthenticated, getAdminDb } from '@/lib/server/firebaseAdmin';

function recordAuthor(record: any) {
  return record?.audit?.closedBy || record?.audit?.createdBy || record?.clinicianResponsible || '';
}

export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticated(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));
    const { year, patientId, processId, recordId, recordType } = body || {};
    if (!year || !patientId || !recordId || !['INITIAL', 'REEVALUATION'].includes(recordType)) {
      return NextResponse.json({ success: false, error: 'Solicitud incompleta.' }, { status: 400 });
    }

    const db = getAdminDb();
    const recordSnap = await db.collection(`programs/${year}/evaluaciones`).doc(recordId).get();
    const record = recordSnap.data();
    if (!recordSnap.exists || record?.status !== 'CLOSED' || record?.type !== recordType || record?.usuariaId !== patientId) {
      return NextResponse.json({ success: false, error: 'El registro cerrado no pudo verificarse.' }, { status: 409 });
    }
    const author = recordAuthor(record);
    const isTeacher = auth.user?.role === 'DOCENTE';
    if (!isTeacher && author !== auth.uid && author !== auth.user?.email) {
      return NextResponse.json({ success: false, error: 'El registro no pertenece al usuario autenticado.' }, { status: 403 });
    }

    const taskSnap = await db.collection('student_clinical_tasks').where('studentId', '==', auth.uid).get();
    const now = new Date().toISOString();
    const allowedKinds = recordType === 'INITIAL'
      ? new Set(['INITIAL_EVALUATION_MISSING', 'INITIAL_EVALUATION_INSUFFICIENT'])
      : new Set(['REEVALUATION_DUE']);
    const matching = taskSnap.docs.filter((task: any) => {
      const data = task.data();
      return data.status === 'ACTIVE'
        && allowedKinds.has(data.kind)
        && data.patientId === patientId
        && (!data.processId || !processId || data.processId === processId);
    });
    await Promise.all(matching.map((task: any) => task.ref.update({
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedByRecordId: recordId,
      resolution: recordType === 'INITIAL' ? 'closed_initial_evaluation_verified' : 'closed_reevaluation_verified',
    })));
    return NextResponse.json({ success: true, resolved: matching.length });
  } catch (error: any) {
    const message = error?.message || 'Internal Error';
    const status = message.startsWith('Unauthorized') ? 401 : message.startsWith('Forbidden') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
