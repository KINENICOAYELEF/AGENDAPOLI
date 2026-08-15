/**
 * COMPETENCIAS CLÍNICAS Y ETAPA DE ROTACIÓN
 *
 * Un hallazgo suelto —"repitió la misma pauta"— es un hecho, no una
 * evaluación. El docente necesita saber qué habilidad está fallando, si es
 * esperable en ese punto de la rotación, y si está mejorando.
 *
 * Cinco hallazgos distintos pueden ser todos el mismo problema visto por
 * cinco lados. Agruparlos por competencia convierte una lista de incidentes en
 * un perfil evaluable, que además es el insumo directo de la nota de proceso.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { getRotationPeriods } from './rotationPeriods';

export const COMPETENCIES = [
  'RAZONAMIENTO',
  'EXAMEN_FISICO',
  'OBJETIVOS',
  'DOSIFICACION',
  'REEVALUACION',
  'SEGURIDAD',
  'REGISTRO',
] as const;

export type Competency = typeof COMPETENCIES[number];

export const COMPETENCY_LABELS: Record<Competency, string> = {
  RAZONAMIENTO: 'Razonamiento diagnóstico',
  EXAMEN_FISICO: 'Examen físico',
  OBJETIVOS: 'Objetivos y plan',
  DOSIFICACION: 'Dosificación y progresión',
  REEVALUACION: 'Reevaluación',
  SEGURIDAD: 'Seguridad clínica',
  REGISTRO: 'Calidad del registro',
};

export type CompetencyLevel = 'INSUFICIENTE' | 'EN_DESARROLLO' | 'LOGRADO' | 'DESTACADO';

export const LEVEL_LABELS: Record<CompetencyLevel, string> = {
  INSUFICIENTE: 'Insuficiente',
  EN_DESARROLLO: 'En desarrollo',
  LOGRADO: 'Logrado',
  DESTACADO: 'Destacado',
};

export const LEVEL_EMOJI: Record<CompetencyLevel, string> = {
  INSUFICIENTE: '🔴',
  EN_DESARROLLO: '🟠',
  LOGRADO: '🟢',
  DESTACADO: '⭐️',
};

export type CompetencyAssessment = {
  competency: Competency;
  level: CompetencyLevel;
  comment: string;
};

/**
 * En qué punto de su rotación va.
 *
 * Que no dosifique en la semana 2 es esperable; en la semana 7 es grave. Sin
 * este dato el agente juzgaba igual los dos casos, y por eso sus conclusiones
 * se leían como injustas o triviales según el caso.
 *
 * El inicio se deduce de su primer registro clínico del año: es un dato
 * observable, a diferencia del término, que hay que preguntarle al docente.
 */
export type RotationStage = {
  currentWeek: number | null;
  totalWeeks: number | null;
  /** Descripción lista para el prompt, en lenguaje natural. */
  description: string;
};

export async function getRotationStage(year: string, studentId: string): Promise<RotationStage> {
  const unknown: RotationStage = {
    currentWeek: null,
    totalWeeks: null,
    description: 'No se conoce en qué punto de su rotación está.',
  };

  try {
    const db = getAdminDb();
    const periods = await getRotationPeriods();
    const endDate = periods.get(studentId)?.endDate;

    // Primer registro clínico suyo del año: aproxima el inicio de la rotación.
    const [evalsSnap, evolsSnap] = await Promise.all([
      db.collection(`programs/${year}/evaluaciones`).where('audit.createdBy', '==', studentId).get(),
      db.collection(`programs/${year}/evoluciones`).where('audit.createdBy', '==', studentId).get(),
    ]);
    const dates = [...evalsSnap.docs, ...evolsSnap.docs]
      .map((doc: any) => String(doc.data().sessionAt || ''))
      .filter(Boolean)
      .sort();
    if (dates.length === 0) return unknown;

    const startTime = new Date(dates[0]).getTime();
    if (Number.isNaN(startTime)) return unknown;

    const currentWeek = Math.max(1, Math.ceil((Date.now() - startTime) / (7 * 86400000)));
    const endTime = endDate ? new Date(endDate).getTime() : NaN;
    const totalWeeks = Number.isNaN(endTime)
      ? null
      : Math.max(currentWeek, Math.ceil((endTime - startTime) / (7 * 86400000)));

    return {
      currentWeek,
      totalWeeks,
      description: totalWeeks
        ? `Va en la semana ${currentWeek} de ${totalWeeks} de su rotación.`
        : `Lleva ${currentWeek} semana(s) de rotación; no se conoce su fecha de término.`,
    };
  } catch (error) {
    console.warn('No se pudo calcular la etapa de rotación:', error);
    return unknown;
  }
}

/**
 * Instrucción de exigencia según la etapa.
 *
 * No es lo mismo evaluar a alguien que lleva dos semanas que a alguien que
 * está por rendir su examen final.
 */
export function stageExpectation(stage: RotationStage): string {
  if (stage.currentWeek === null) {
    return 'No se conoce su etapa: evita juicios sobre si "ya debería" saber algo, y limítate a describir lo observado.';
  }
  if (stage.currentWeek <= 2) {
    return 'Está empezando. Errores de forma y omisiones son esperables: señálalos como aprendizaje pendiente, no como falla. Solo la seguridad es exigible desde el primer día.';
  }
  if (stage.totalWeeks && stage.currentWeek >= stage.totalWeeks - 2) {
    return 'Está en el tramo final, cerca de su examen. Lo que no domine a esta altura es un problema real: dilo con claridad, porque queda poco tiempo para corregirlo.';
  }
  return 'Está en la mitad de su rotación. Ya debería sostener sola el ciclo evaluar → planificar → ejecutar → reevaluar; lo que falle ahí es lo que hay que trabajar.';
}

/**
 * Perfil por competencia, con historia semanal.
 *
 * Guardar cada corte permite responder algo que hoy no se puede: si el feedback
 * que el docente dio hace tres semanas cambió algo.
 */
export async function saveCompetencyProfile(
  studentId: string,
  assessments: CompetencyAssessment[],
  stage: RotationStage,
) {
  if (assessments.length === 0) return;
  try {
    const db = getAdminDb();
    const week = stage.currentWeek ?? 0;
    await db.collection('student_learning_profiles').doc(studentId).set({
      competencies: Object.fromEntries(assessments.map(item => [item.competency, {
        level: item.level,
        comment: item.comment,
        assessedAt: new Date().toISOString(),
        week,
      }])),
      rotationWeek: stage.currentWeek,
      rotationTotalWeeks: stage.totalWeeks,
      lastUpdatedAt: new Date().toISOString(),
    }, { merge: true });

    // Corte semanal: un documento por semana, para poder ver la trayectoria.
    await db.collection('student_learning_profiles').doc(studentId)
      .collection('competency_history').doc(`semana_${week}`)
      .set({
        week,
        assessedAt: new Date().toISOString(),
        levels: Object.fromEntries(assessments.map(item => [item.competency, item.level])),
      }, { merge: true });
  } catch (error) {
    console.warn('No se pudo guardar el perfil por competencia:', error);
  }
}

/** Trayectoria de una competencia a lo largo de las semanas. */
export async function getCompetencyHistory(studentId: string) {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection('student_learning_profiles').doc(studentId)
      .collection('competency_history').get();
    return snapshot.docs
      .map((doc: any) => doc.data())
      .sort((a: any, b: any) => (a.week || 0) - (b.week || 0));
  } catch {
    return [];
  }
}
