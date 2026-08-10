import { NextResponse } from 'next/server';
import { requireAuthenticated, getAdminDb } from '@/lib/server/firebaseAdmin';

/**
 * La estudiante marca como leída una retroalimentación de su docente.
 *
 * Las demás tareas se cierran solas cuando ella completa el registro que se le
 * pidió. Un feedback no tiene un registro asociado que verificar, así que sin
 * esta vía quedaría fijo en su pantalla para siempre.
 *
 * Solo alcanza a tareas de tipo TEACHER_FEEDBACK y solo a las suyas: no puede
 * cerrar de este modo una evaluación pendiente que no ha hecho.
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuthenticated(req.headers.get('authorization'));
    const body = await req.json().catch(() => ({}));
    const taskId = String(body?.taskId || '');

    if (!taskId) {
      return NextResponse.json({ success: false, error: 'Falta la tarea.' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('student_clinical_tasks').doc(taskId);
    const snapshot = await ref.get();
    const task = snapshot.data();

    if (!snapshot.exists) {
      return NextResponse.json({ success: false, error: 'La tarea no existe.' }, { status: 404 });
    }
    if (task?.studentId !== auth.uid) {
      return NextResponse.json({ success: false, error: 'Esta tarea no es tuya.' }, { status: 403 });
    }
    if (task?.kind !== 'TEACHER_FEEDBACK') {
      return NextResponse.json(
        { success: false, error: 'Esta tarea se cierra completando el registro solicitado, no marcándola como leída.' },
        { status: 409 },
      );
    }

    await ref.update({
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
      resolution: 'acknowledged_by_student',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error interno' },
      { status: 500 },
    );
  }
}
