/**
 * LO QUE SOLO VE EL DOCENTE
 *
 * La parte más pesada de la nota de proceso no está en la plataforma: la
 * actitud, el trato con la persona atendida, la puntualidad, cómo responde
 * cuando se le corrige. Eso lo observa él en el box y hoy lo retiene de memoria
 * hasta el final de la rotación, donde tiene que reconstruirlo.
 *
 * En vez de pedirle que abra una pantalla a registrarlo —cosa que no va a
 * hacer— se recoge por donde ya conversa: le dice al bot "la Javiera llegó
 * tarde otra vez" y queda archivado a su nombre, con fecha.
 *
 * Cuando llegue el momento de poner la nota, esas observaciones están ahí
 * junto a los datos objetivos, en vez de haberse perdido.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

const COLLECTION = 'teacher_student_notes';

export type TeacherNote = {
  id?: string;
  studentId: string;
  studentName: string;
  note: string;
  /** Positiva, a mejorar, o simplemente un hecho. Lo decide el modelo al leerla. */
  tone: 'POSITIVA' | 'A_MEJORAR' | 'NEUTRA';
  createdAt: string;
  source: 'telegram' | 'web';
};

export async function saveTeacherNote(input: Omit<TeacherNote, 'id' | 'createdAt'>) {
  const db = getAdminDb();
  await db.collection(COLLECTION).add({
    ...input,
    createdAt: new Date().toISOString(),
  });
}

/** Observaciones sobre una estudiante, de la más reciente a la más antigua. */
export async function getTeacherNotes(studentId: string, limit = 40): Promise<TeacherNote[]> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(COLLECTION).where('studentId', '==', studentId).get();
    return snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() } as TeacherNote))
      .sort((a: TeacherNote, b: TeacherNote) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  } catch (error) {
    console.warn('No se pudieron leer las observaciones docentes:', error);
    return [];
  }
}

/**
 * Cuántos días lleva cada estudiante sin una observación.
 *
 * Sirve para avisarle de quién no ha dicho nada en semanas: en una rotación es
 * fácil que la atención se concentre en dos o tres y el resto pase inadvertido
 * hasta que hay que ponerle nota.
 */
export async function daysSinceLastNote(studentIds: string[]): Promise<Map<string, number | null>> {
  const result = new Map<string, number | null>();
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(COLLECTION).get();
    const latest = new Map<string, string>();
    snapshot.docs.forEach((doc: any) => {
      const data = doc.data();
      const current = latest.get(data.studentId) || '';
      if (String(data.createdAt) > current) latest.set(data.studentId, data.createdAt);
    });
    studentIds.forEach(id => {
      const at = latest.get(id);
      result.set(id, at ? Math.floor((Date.now() - new Date(at).getTime()) / 86400000) : null);
    });
  } catch (error) {
    console.warn('No se pudo calcular la antigüedad de las observaciones:', error);
    studentIds.forEach(id => result.set(id, null));
  }
  return result;
}
