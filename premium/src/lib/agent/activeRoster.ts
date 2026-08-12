/**
 * QUIÉNES ESTÁN REALMENTE EN LA ROTACIÓN
 *
 * Hasta ahora el agente tomaba a TODA cuenta con rol INTERNO —24 personas,
 * incluidas rotaciones pasadas y cuentas de prueba— y las trataba a todas como
 * si estuvieran trabajando hoy. De ahí salía el ruido: internas "inactivas" que
 * en realidad egresaron en marzo, y patrones de curso contados sobre gente que
 * ya no está.
 *
 * La pantalla de Rotaciones Clínicas no sirve como fuente de verdad porque
 * guarda fechas y universidad pero no la lista de estudiantes. Así que la
 * pertenencia se deduce de la evidencia, que es lo que de verdad hay.
 *
 * El criterio replica cómo termina una rotación en la práctica: alguien deja de
 * atender, vuelve unos días a cerrar lo que quedó pendiente, y después
 * desaparece. Por eso hay un estado intermedio en vez de un corte seco.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

/** Trabajando ahora. */
const ACTIVE_WINDOW_DAYS = 14;
/** Terminó, pero todavía puede volver a cerrar pendientes. */
const GRACE_WINDOW_DAYS = 21;

export type StudentStatus = 'ACTIVA' | 'CERRANDO' | 'INACTIVA';

export type RosterEntry = {
  id: string;
  name: string;
  email: string;
  status: StudentStatus;
  lastClinicalActivityAt: string;
  lastLoginAt: string;
  daysSinceClinicalActivity: number | null;
  recentRecords: number;
  assignedPatients: number;
};

function iso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

function daysSince(value: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.floor((Date.now() - time) / 86400000);
}

/**
 * Estado de cada estudiante según su evidencia real.
 *
 * `ACTIVA`   → registró algo clínico en los últimos 14 días.
 * `CERRANDO` → su última actividad está entre 14 y 21 días, o no registró nada
 *              pero todavía tiene personas asignadas y entró hace poco.
 * `INACTIVA` → nada de lo anterior. Queda fuera del censo y de los resúmenes.
 */
export async function buildActiveRoster(year: string): Promise<RosterEntry[]> {
  const db = getAdminDb();
  const graceCutoffIso = new Date(Date.now() - GRACE_WINDOW_DAYS * 86400000).toISOString();

  const [studentsSnap, evolsSnap, evalsSnap, patientsSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'INTERNO').get(),
    db.collection(`programs/${year}/evoluciones`).where('sessionAt', '>=', graceCutoffIso).get(),
    db.collection(`programs/${year}/evaluaciones`).where('sessionAt', '>=', graceCutoffIso).get(),
    db.collection(`programs/${year}/usuarias`).get(),
  ]);

  const lastActivity = new Map<string, string>();
  const recordCount = new Map<string, number>();
  const register = (doc: any) => {
    const data = doc.data();
    // Tres campos según la antigüedad del registro: mirar solo uno hacía
    // aparecer como inactiva a quien sí estaba trabajando.
    const author = data.audit?.createdBy || data.autorUid || data.clinicianResponsible;
    if (!author) return;
    const at = iso(data.sessionAt) || iso(data.audit?.createdAt);
    if (at > (lastActivity.get(author) || '')) lastActivity.set(author, at);
    recordCount.set(author, (recordCount.get(author) || 0) + 1);
  };
  evolsSnap.docs.forEach(register);
  evalsSnap.docs.forEach(register);

  const assignedCount = new Map<string, number>();
  patientsSnap.docs.forEach((doc: any) => {
    const internId = doc.data().meta?.assignedInternId;
    if (internId) assignedCount.set(internId, (assignedCount.get(internId) || 0) + 1);
  });

  return studentsSnap.docs.map((doc: any) => {
    const data = doc.data();
    const clinicalAt = lastActivity.get(doc.id) || '';
    const loginAt = iso(data.lastActiveAt);
    const daysClinical = daysSince(clinicalAt);
    const daysLogin = daysSince(loginAt);
    const assigned = assignedCount.get(doc.id) || 0;

    let status: StudentStatus = 'INACTIVA';
    if (daysClinical !== null && daysClinical <= ACTIVE_WINDOW_DAYS) {
      status = 'ACTIVA';
    } else if (daysClinical !== null && daysClinical <= GRACE_WINDOW_DAYS) {
      // Terminó de atender pero sigue dentro del período de cierre.
      status = 'CERRANDO';
    } else if (assigned > 0 && daysLogin !== null && daysLogin <= ACTIVE_WINDOW_DAYS) {
      // Tiene personas a cargo y sigue entrando: puede ser que recién comience
      // su rotación y todavía no haya registrado nada. No la damos por fuera.
      status = 'CERRANDO';
    }

    return {
      id: doc.id,
      name: data.displayName || data.email || doc.id,
      email: data.email || '',
      status,
      lastClinicalActivityAt: clinicalAt,
      lastLoginAt: loginAt,
      daysSinceClinicalActivity: daysClinical,
      recentRecords: recordCount.get(doc.id) || 0,
      assignedPatients: assigned,
    };
  });
}

/** Solo quienes cuentan para el censo, los resúmenes y los patrones de curso. */
export function rosterInRotation(roster: RosterEntry[]): RosterEntry[] {
  return roster.filter(entry => entry.status !== 'INACTIVA');
}
