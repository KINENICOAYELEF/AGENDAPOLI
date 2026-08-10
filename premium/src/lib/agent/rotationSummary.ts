/**
 * RESUMEN DIARIO DE LA ROTACIÓN
 *
 * Responde de una sola mirada las preguntas que el docente se hace todos los
 * días: quién trabajó, quién está atrasada, qué quedó sin firmar y a quién hay
 * que mirar primero.
 *
 * Reemplaza los comandos de Telegram que devolvían frases genéricas ("desde la
 * bandeja puedes revisar...") sin ningún dato real.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { buildActiveRoster, rosterInRotation } from './activeRoster';
import { computeCompliance, getPracticeRequirements } from './practiceRequirements';

export type StudentRotationLine = {
  studentId: string;
  name: string;
  evolutions: number;
  evaluations: number;
  drafts: number;
  lastActivityAt: string;
  daysSinceActivity: number | null;
  pendingFindings: number;
  p0Findings: number;
};

/** Un aviso de completitud que la estudiante todavía no ha resuelto. */
export type PendingCompletenessItem = {
  studentName: string;
  title: string;
  message: string;
  ageDays: number;
};

export type RotationSummary = {
  year: string;
  windowDays: number;
  generatedAt: string;
  activeStudents: number;
  silentStudents: number;
  totalEvolutions: number;
  totalDrafts: number;
  lines: StudentRotationLine[];
  /** Evaluaciones incompletas ya avisadas y aún sin resolver. */
  pendingCompleteness: PendingCompletenessItem[];
};

function iso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

function recordAt(data: any): string {
  return iso(data.sessionAt) || iso(data.fechaHoraAtencion) || iso(data.audit?.createdAt) || iso(data.createdAt);
}

export async function buildRotationSummary(year: string, windowDays = 7): Promise<RotationSummary> {
  const db = getAdminDb();
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Las consultas se acotan por fecha en el servidor: el resumen no debe costar
  // una lectura de la colección completa cada vez que se pide.
  const [roster, evolsSnap, evalsSnap, findingsSnap, tasksSnap] = await Promise.all([
    // Solo quienes están en la rotación: un resumen que lista como "sin
    // actividad" a gente que egresó en marzo es ruido que se deja de leer.
    buildActiveRoster(year),
    db.collection(`programs/${year}/evoluciones`).where('sessionAt', '>=', since).get(),
    db.collection(`programs/${year}/evaluaciones`).where('sessionAt', '>=', since).get(),
    db.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER').get(),
    db.collection('student_clinical_tasks').where('status', '==', 'ACTIVE').get(),
  ]);

  const lines = new Map<string, StudentRotationLine>();
  rosterInRotation(roster).forEach((entry) => {
    lines.set(entry.id, {
      studentId: entry.id,
      name: entry.status === 'CERRANDO' ? `${entry.name} (cerrando)` : entry.name,
      evolutions: 0,
      evaluations: 0,
      drafts: 0,
      lastActivityAt: '',
      daysSinceActivity: null,
      pendingFindings: 0,
      p0Findings: 0,
    });
  });

  const attribute = (data: any, kind: 'evolution' | 'evaluation') => {
    const author = data.audit?.createdBy || data.autorUid || data.clinicianResponsible;
    const line = author ? lines.get(author) : undefined;
    if (!line) return;
    if (kind === 'evolution') line.evolutions++; else line.evaluations++;
    if (data.status === 'DRAFT' || data.estado === 'BORRADOR') line.drafts++;
    const at = recordAt(data);
    if (at > line.lastActivityAt) line.lastActivityAt = at;
  };

  evolsSnap.docs.forEach((doc: any) => attribute(doc.data(), 'evolution'));
  evalsSnap.docs.forEach((doc: any) => attribute(doc.data(), 'evaluation'));

  findingsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    const line = lines.get(data.studentId);
    if (!line) return;
    line.pendingFindings++;
    if (data.priority === 'P0') line.p0Findings++;
  });

  const result = Array.from(lines.values()).map(line => ({
    ...line,
    daysSinceActivity: line.lastActivityAt
      ? Math.floor((Date.now() - new Date(line.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
      : null,
  }));

  // Orden por urgencia: primero quien tiene riesgos, después quien no aparece.
  result.sort((a, b) => {
    if (b.p0Findings !== a.p0Findings) return b.p0Findings - a.p0Findings;
    const activityA = a.evolutions + a.evaluations;
    const activityB = b.evolutions + b.evaluations;
    if (activityA !== activityB) return activityA - activityB;
    return b.pendingFindings - a.pendingFindings;
  });

  // Avisos que la estudiante ya recibió y todavía no resuelve. Lo que lleva
  // más días arriba: es donde el docente tiene que intervenir personalmente.
  const pendingCompleteness: PendingCompletenessItem[] = tasksSnap.docs
    .map((doc: any) => doc.data())
    .filter((task: any) => task.year === year)
    .map((task: any) => ({
      studentName: lines.get(task.studentId)?.name || task.studentId || 'Estudiante',
      title: task.title || 'Registro pendiente',
      message: String(task.message || '').slice(0, 160),
      ageDays: Math.floor((Date.now() - new Date(task.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a: PendingCompletenessItem, b: PendingCompletenessItem) => b.ageDays - a.ageDays);

  return {
    year,
    windowDays,
    generatedAt: new Date().toISOString(),
    pendingCompleteness,
    activeStudents: result.filter(line => line.evolutions + line.evaluations > 0).length,
    silentStudents: result.filter(line => line.evolutions + line.evaluations === 0).length,
    totalEvolutions: result.reduce((total, line) => total + line.evolutions, 0),
    totalDrafts: result.reduce((total, line) => total + line.drafts, 0),
    lines: result,
  };
}

/**
 * Vigilancia de los puntos que el agente nunca miró: agenda, cumplimiento de
 * simulaciones, exámenes de rotación y personas abandonadas.
 *
 * Todos estos datos existían y nadie los auditaba, así que el docente tenía que
 * acordarse de revisarlos por su cuenta.
 */
export type WatchAlert = {
  kind: 'CITA_SIN_EVOLUCIONAR' | 'SIMULACIONES_INSUFICIENTES' | 'EXAMEN_PROXIMO' | 'PERSONA_ABANDONADA';
  severity: 'ALTA' | 'MEDIA';
  message: string;
};

export async function buildWatchAlerts(year: string): Promise<WatchAlert[]> {
  const db = getAdminDb();
  const alerts: WatchAlert[] = [];
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const weekAgo = new Date(Date.now() - 7 * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });

  // 1. Citas ya pasadas que siguen sin evolucionar.
  try {
    const citasSnap = await db.collection(`programs/${year}/citas`)
      .where('date', '>=', weekAgo)
      .where('date', '<', today)
      .get();
    const unevolved = citasSnap.docs.filter((doc: any) => doc.data().status === 'SCHEDULED');
    if (unevolved.length > 0) {
      alerts.push({
        kind: 'CITA_SIN_EVOLUCIONAR',
        severity: unevolved.length >= 5 ? 'ALTA' : 'MEDIA',
        message: `${unevolved.length} cita(s) de los últimos 7 días siguen sin evolucionar ni marcarse como inasistencia.`,
      });
    }
  } catch (error) {
    console.warn('No se pudo revisar la agenda para alertas:', error);
  }

  // 2. Cumplimiento de simulaciones. El cálculo existía pero nadie lo ejecutaba.
  try {
    const [roster, osceSnap, defenseSnap] = await Promise.all([
      buildActiveRoster(year),
      db.collection('simulador_intentos').get(),
      db.collection('defensas_voz_intentos').get(),
    ]);
    // Las exigencias son configurables por tipo: el simulador escrito y el OSCE
    // por voz no son intercambiables, y un total único los mezclaba.
    const requirements = await getPracticeRequirements();
    const attemptsByStudent = new Map<string, Array<{ modalidad?: string; kind: 'SIMULADOR' | 'DEFENSA' | 'ENTRENAMIENTO' }>>();
    const push = (userId: string, attempt: { modalidad?: string; kind: 'SIMULADOR' | 'DEFENSA' | 'ENTRENAMIENTO' }) => {
      if (!userId) return;
      const current = attemptsByStudent.get(userId) || [];
      current.push(attempt);
      attemptsByStudent.set(userId, current);
    };
    osceSnap.docs.forEach((doc: any) => push(doc.data().userId, { modalidad: doc.data().modalidad, kind: 'SIMULADOR' }));
    defenseSnap.docs.forEach((doc: any) => push(doc.data().userId, { kind: 'DEFENSA' }));

    // No tiene sentido reclamar prácticas a quien ya terminó su rotación.
    const behind = rosterInRotation(roster)
      .map((entry) => ({
        name: entry.name,
        compliance: computeCompliance(entry.id, attemptsByStudent.get(entry.id) || [], requirements),
      }))
      .filter((item) => !item.compliance.meetsAll);

    if (behind.length > 0) {
      alerts.push({
        kind: 'SIMULACIONES_INSUFICIENTES',
        severity: 'MEDIA',
        message: `${behind.length} estudiante(s) bajo las exigencias de práctica:\n`
          + behind.slice(0, 6).map((item) => `   · ${item.name}: ${item.compliance.summary}`).join('\n'),
      });
    }
  } catch (error) {
    console.warn('No se pudo revisar el cumplimiento de simulaciones:', error);
  }

  // 3. Exámenes de rotación que se acercan.
  try {
    const rotationsSnap = await db.collection(`programs/${year}/rotations`).get();
    rotationsSnap.docs.forEach((doc: any) => {
      const data = doc.data();
      const endValue = data.endDate || data.fechaTermino;
      if (!endValue) return;
      const endTime = new Date(iso(endValue)).getTime();
      if (Number.isNaN(endTime)) return;
      const remaining = Math.ceil((endTime - Date.now()) / 86400000);
      if (remaining >= 0 && remaining <= 21) {
        alerts.push({
          kind: 'EXAMEN_PROXIMO',
          severity: remaining <= 7 ? 'ALTA' : 'MEDIA',
          message: `La rotación "${data.name || data.nombre || 'sin nombre'}" termina en ${remaining} día(s): conviene fijar el examen final.`,
        });
      }
    });
  } catch (error) {
    console.warn('No se pudo revisar las rotaciones:', error);
  }

  // 4. Personas activas que dejaron de recibir sesiones.
  try {
    const processesSnap = await db.collection(`programs/${year}/procesos`).where('estado', '==', 'ACTIVO').get();
    const abandoned = processesSnap.docs.filter((doc: any) => {
      const data = doc.data();
      const last = data.lastClosedEvolution?.sessionAt || data.fechaInicio;
      if (!last) return false;
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      return days >= 21;
    });
    if (abandoned.length > 0) {
      alerts.push({
        kind: 'PERSONA_ABANDONADA',
        severity: 'ALTA',
        message: `${abandoned.length} persona(s) con proceso activo llevan 21 días o más sin sesión registrada.`,
      });
    }
  } catch (error) {
    console.warn('No se pudo revisar la continuidad de procesos:', error);
  }

  return alerts;
}

/**
 * Errores que comparten varias estudiantes.
 *
 * El agente analiza a cada una por separado y nunca notaba que media rotación
 * comete el mismo error. Es información distinta: si una no dosifica, es
 * feedback individual; si lo hacen cuatro, es una clase que hay que dar.
 */
export type CoursePattern = {
  type: string;
  studentCount: number;
  studentNames: string[];
  example: string;
};

const COURSE_PATTERN_MIN_STUDENTS = 3;

export async function buildCoursePatterns(year: string): Promise<CoursePattern[]> {
  const db = getAdminDb();

  const [findingsSnap, roster] = await Promise.all([
    db.collection('teacher_agent_reviews').where('year', '==', year).get(),
    buildActiveRoster(year),
  ]);

  // El umbral de "3 o más estudiantes" solo tiene sentido sobre quienes están
  // en la rotación: contar egresadas distorsionaba el patrón.
  const names = new Map<string, string>();
  rosterInRotation(roster).forEach((entry) => names.set(entry.id, entry.name));

  // Se cuentan ESTUDIANTES distintas, no hallazgos: una sola persona con el
  // mismo error diez veces no constituye un patrón de curso.
  const byType = new Map<string, { students: Set<string>; example: string }>();
  findingsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (!Array.isArray(data.coherenceFindings) || !data.studentId) return;
    if (!names.has(data.studentId)) return;
    data.coherenceFindings.forEach((finding: any) => {
      if (!finding?.type) return;
      const current = byType.get(finding.type) || { students: new Set<string>(), example: '' };
      current.students.add(data.studentId);
      if (!current.example && finding.explanation) current.example = String(finding.explanation).slice(0, 200);
      byType.set(finding.type, current);
    });
  });

  return [...byType.entries()]
    .filter(([, value]) => value.students.size >= COURSE_PATTERN_MIN_STUDENTS)
    .map(([type, value]) => ({
      type,
      studentCount: value.students.size,
      studentNames: [...value.students].map(id => names.get(id) || id),
      example: value.example,
    }))
    .sort((a, b) => b.studentCount - a.studentCount);
}

/** Formato listo para Telegram, con lo urgente arriba. */
export function formatRotationSummary(summary: RotationSummary, appBaseUrl: string): string {
  const working = summary.lines.filter(line => line.evolutions + line.evaluations > 0);
  const silent = summary.lines.filter(line => line.evolutions + line.evaluations === 0);

  const workingBlock = working.length
    ? working.map(line => {
        const flags = [
          line.p0Findings > 0 ? `🔴 ${line.p0Findings} P0` : '',
          line.drafts > 0 ? `📝 ${line.drafts} sin firmar` : '',
          line.pendingFindings > 0 ? `📥 ${line.pendingFindings} por revisar` : '',
        ].filter(Boolean).join(' · ');
        return `• *${line.name}* — ${line.evolutions} evolución(es), ${line.evaluations} evaluación(es)${flags ? `\n   ${flags}` : ''}`;
      }).join('\n')
    : '_Nadie registró actividad clínica en el período._';

  const silentBlock = silent.length
    ? `\n\n🔇 *Sin actividad en ${summary.windowDays} días* (${silent.length})\n${silent.slice(0, 10).map(line => `• ${line.name}`).join('\n')}`
    : '';

  // Bloque explícito de evaluaciones incompletas: la estudiante ya fue avisada
  // automáticamente, aquí aparece lo que sigue sin resolverse.
  const stuck = (summary.pendingCompleteness || []).filter(item => item.ageDays >= 2);
  const completenessBlock = stuck.length
    ? `\n\n📋 *Evaluaciones incompletas ya avisadas* (${stuck.length})\n`
      + stuck.slice(0, 8).map(item =>
          `• *${item.studentName}* — ${item.title.toLowerCase()} · hace ${item.ageDays} día(s)\n   _${item.message}_`,
        ).join('\n')
      + (stuck.length > 8 ? `\n_…y ${stuck.length - 8} más._` : '')
    : '';

  return `📊 *Resumen de la rotación — últimos ${summary.windowDays} días*\n\n`
    + `Activas: *${summary.activeStudents}* · Sin actividad: *${summary.silentStudents}*\n`
    + `Evoluciones registradas: *${summary.totalEvolutions}* · Borradores sin firmar: *${summary.totalDrafts}*\n\n`
    + `${workingBlock}${silentBlock}${completenessBlock}\n\n`
    + `[Abrir bandeja docente](${appBaseUrl}/app/revision-docente)`;
}
