/**
 * FECHAS DE TÉRMINO POR ESTUDIANTE, PREGUNTADAS POR EL BOT
 *
 * Cargar una rotación completa en un formulario es tedioso y por eso no se
 * hace: el dato termina existiendo solo en la cabeza del docente. En vez de
 * pedirle que lo transcriba, el bot le pregunta por una estudiante a la vez y
 * guarda lo que responde.
 *
 * Es el único dato que la plataforma no puede deducir de la actividad: cuándo
 * alguien TERMINA es una decisión, no un hecho observable.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

const PERIODS_COLLECTION = 'student_rotation_periods';
const PENDING_QUESTION_DOC = 'teacher_notifications/pending_rotation_question';

export type StudentRotationPeriod = {
  studentId: string;
  endDate: string;
  source: 'telegram' | 'admin';
  answeredAt: string;
};

export async function getRotationPeriods(): Promise<Map<string, StudentRotationPeriod>> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(PERIODS_COLLECTION).get();
    return new Map(snapshot.docs.map((doc: any) => [doc.id, doc.data() as StudentRotationPeriod]));
  } catch (error) {
    console.warn('No se pudieron leer las fechas de término:', error);
    return new Map();
  }
}

export async function saveRotationPeriod(studentId: string, endDate: string, source: 'telegram' | 'admin' = 'telegram') {
  const db = getAdminDb();
  await db.collection(PERIODS_COLLECTION).doc(studentId).set({
    studentId,
    endDate,
    source,
    answeredAt: new Date().toISOString(),
  });
}

/**
 * La pregunta que quedó abierta en el chat.
 *
 * Se guarda para que la respuesta suelta del docente —"el 22 de agosto"— se
 * pueda interpretar como la respuesta a esa pregunta, y no como una consulta
 * nueva al asistente.
 */
export async function getPendingQuestion(): Promise<{ studentId: string; studentName: string; askedAt: string } | null> {
  try {
    const db = getAdminDb();
    const snapshot = await db.doc(PENDING_QUESTION_DOC).get();
    const data = snapshot.data();
    if (!data?.studentId) return null;
    // Una pregunta de hace días ya no se responde: se vuelve a preguntar.
    const askedAt = new Date(data.askedAt || 0).getTime();
    if (Date.now() - askedAt > 48 * 3600 * 1000) return null;
    return { studentId: data.studentId, studentName: data.studentName || data.studentId, askedAt: data.askedAt };
  } catch {
    return null;
  }
}

export async function setPendingQuestion(studentId: string, studentName: string) {
  const db = getAdminDb();
  await db.doc(PENDING_QUESTION_DOC).set({
    studentId,
    studentName,
    askedAt: new Date().toISOString(),
  });
}

export async function clearPendingQuestion() {
  const db = getAdminDb();
  await db.doc(PENDING_QUESTION_DOC).set({ studentId: null, clearedAt: new Date().toISOString() });
}

/**
 * A quién falta preguntarle.
 *
 * Solo estudiantes en rotación, y solo una por vez: preguntar por seis de
 * golpe convierte el aviso en un formulario, que es justo lo que se evita.
 */
export function findStudentMissingEndDate(
  roster: Array<{ id: string; name: string; status: string }>,
  periods: Map<string, StudentRotationPeriod>,
): { id: string; name: string } | null {
  const candidate = roster.find(entry => entry.status === 'ACTIVA' && !periods.has(entry.id));
  return candidate ? { id: candidate.id, name: candidate.name } : null;
}
