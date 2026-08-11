/**
 * CIERRE DE ROTACIÓN
 *
 * El momento más frágil del internado: alguien termina y deja cosas sueltas
 * —borradores sin firmar, personas que nadie va a heredar, prácticas sin
 * completar—. Hoy eso el docente lo lleva de memoria, y lo que se le pasa
 * queda huérfano.
 *
 * Depende de que la rotación tenga estudiantes asociados: la pantalla de
 * Rotaciones guardaba fechas pero no a quién correspondían, así que era
 * imposible saber a quién le quedaban días.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { computeCompliance, getPracticeRequirements } from './practiceRequirements';

/** Con cuántos días de anticipación empieza a avisar. */
const CLOSING_WINDOW_DAYS = 10;

export type ClosingStudent = {
  studentId: string;
  name: string;
  rotationLabel: string;
  endDate: string;
  daysLeft: number;
  draftsPending: number;
  /** Personas asignadas que quedarán sin responsable. */
  patientsToHandOver: Array<{ id: string; name: string; lastSessionAt: string }>;
  practiceSummary: string;
  practiceMeets: boolean;
};

function iso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

/**
 * Quiénes están por terminar y qué dejan pendiente.
 *
 * Devuelve vacío si ninguna rotación tiene estudiantes asociados: es preferible
 * no avisar nada a inventar un cierre que no se sabe cuándo ocurre.
 */
export async function buildClosingReport(year: string): Promise<ClosingStudent[]> {
  const db = getAdminDb();

  const rotationsSnap = await db.collection(`programs/${year}/rotations`).get();
  const closing: Array<{ studentId: string; label: string; endDate: string; daysLeft: number }> = [];

  rotationsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const endValue = iso(data.endDate || data.fechaTermino);
    const studentIds: string[] = Array.isArray(data.studentIds) ? data.studentIds : [];
    if (!endValue || studentIds.length === 0) return;

    const endTime = new Date(endValue).getTime();
    if (Number.isNaN(endTime)) return;
    const daysLeft = Math.ceil((endTime - Date.now()) / 86400000);
    // Solo la ventana de cierre: ni las que recién empiezan ni las ya cerradas.
    if (daysLeft < 0 || daysLeft > CLOSING_WINDOW_DAYS) return;

    studentIds.forEach(studentId => {
      closing.push({ studentId, label: data.label || data.name || 'Rotación', endDate: endValue, daysLeft });
    });
  });

  if (closing.length === 0) return [];

  const studentIds = [...new Set(closing.map(item => item.studentId))];
  const [usersSnap, patientsSnap, evolsSnap, osceSnap, defenseSnap, requirements] = await Promise.all([
    db.collection('users').where('role', '==', 'INTERNO').get(),
    db.collection(`programs/${year}/usuarias`).get(),
    db.collection(`programs/${year}/evoluciones`).get(),
    db.collection('simulador_intentos').get(),
    db.collection('defensas_voz_intentos').get(),
    getPracticeRequirements(),
  ]);

  const names = new Map<string, string>();
  usersSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    names.set(doc.id, data.displayName || data.email || doc.id);
  });

  const draftsByStudent = new Map<string, number>();
  const lastSessionByPatient = new Map<string, string>();
  evolsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const author = data.audit?.createdBy || data.clinicianResponsible;
    if (author && (data.status === 'DRAFT' || data.estado === 'BORRADOR')) {
      draftsByStudent.set(author, (draftsByStudent.get(author) || 0) + 1);
    }
    const patientId = data.usuariaId;
    const at = iso(data.sessionAt);
    if (patientId && at > (lastSessionByPatient.get(patientId) || '')) {
      lastSessionByPatient.set(patientId, at);
    }
  });

  const attemptsByStudent = new Map<string, Array<{ modalidad?: string; kind: 'SIMULADOR' | 'DEFENSA' }>>();
  const pushAttempt = (userId: string, attempt: { modalidad?: string; kind: 'SIMULADOR' | 'DEFENSA' }) => {
    if (!userId || !studentIds.includes(userId)) return;
    const current = attemptsByStudent.get(userId) || [];
    current.push(attempt);
    attemptsByStudent.set(userId, current);
  };
  osceSnap.docs.forEach((doc: any) => pushAttempt(doc.data().userId, { modalidad: doc.data().modalidad, kind: 'SIMULADOR' }));
  defenseSnap.docs.forEach((doc: any) => pushAttempt(doc.data().userId, { kind: 'DEFENSA' }));

  const patients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  return closing.map(item => {
    const assigned = patients.filter((patient: any) => patient.meta?.assignedInternId === item.studentId);
    const compliance = computeCompliance(
      item.studentId,
      attemptsByStudent.get(item.studentId) || [],
      requirements,
    );

    return {
      studentId: item.studentId,
      name: names.get(item.studentId) || item.studentId,
      rotationLabel: item.label,
      endDate: item.endDate,
      daysLeft: item.daysLeft,
      draftsPending: draftsByStudent.get(item.studentId) || 0,
      patientsToHandOver: assigned.map((patient: any) => ({
        id: patient.id,
        name: patient.identity?.fullName || 'Sin nombre',
        lastSessionAt: lastSessionByPatient.get(patient.id) || 'sin sesiones',
      })),
      practiceSummary: compliance.summary,
      practiceMeets: compliance.meetsAll,
    };
  }).sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Mensaje de Telegram: lo urgente primero y con nombres concretos. */
export function formatClosingReport(report: ClosingStudent[]): string {
  if (report.length === 0) return '';

  const blocks = report.map(student => {
    const pendings: string[] = [];
    if (student.draftsPending > 0) pendings.push(`📝 ${student.draftsPending} borrador(es) sin firmar`);
    if (!student.practiceMeets) pendings.push(`🎓 ${student.practiceSummary}`);
    if (student.patientsToHandOver.length > 0) {
      pendings.push(`👥 ${student.patientsToHandOver.length} persona(s) que quedarán sin responsable:\n      `
        + student.patientsToHandOver.slice(0, 6).map(patient => patient.name).join(', '));
    }

    const heading = student.daysLeft === 0
      ? `🔴 *${student.name}* termina HOY`
      : `⏳ *${student.name}* termina en ${student.daysLeft} día(s)`;

    return `${heading} (${student.rotationLabel})\n`
      + (pendings.length > 0 ? pendings.map(line => `   ${line}`).join('\n') : '   ✅ Sin pendientes.');
  });

  return `🚪 *Cierre de rotación*\n\n${blocks.join('\n\n')}\n\n`
    + `_Las personas sin responsable hay que reasignarlas desde el Panel Admin antes de que se vayan._`;
}
