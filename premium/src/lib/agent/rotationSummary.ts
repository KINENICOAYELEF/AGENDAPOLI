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
  const [studentsSnap, evolsSnap, evalsSnap, findingsSnap, tasksSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'INTERNO').get(),
    db.collection(`programs/${year}/evoluciones`).where('sessionAt', '>=', since).get(),
    db.collection(`programs/${year}/evaluaciones`).where('sessionAt', '>=', since).get(),
    db.collection('teacher_agent_reviews').where('status', '==', 'PENDING_TEACHER').get(),
    db.collection('student_clinical_tasks').where('status', '==', 'ACTIVE').get(),
  ]);

  const lines = new Map<string, StudentRotationLine>();
  studentsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    lines.set(doc.id, {
      studentId: doc.id,
      name: data.displayName || data.email || doc.id,
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
