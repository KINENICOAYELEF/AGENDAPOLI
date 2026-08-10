/**
 * CALIBRACIÓN DEL AGENTE SEGÚN LAS DECISIONES DEL DOCENTE
 *
 * El agente no aprendía nada: si el docente descartaba cinco veces el mismo
 * tipo de hallazgo, se lo seguía proponiendo la sexta. Sin esto, en un par de
 * semanas el agente se vuelve ruido y se deja de mirar.
 *
 * Cada aprobación, edición o descarte queda registrada en `teacher_decisions`
 * —colección que estaba declarada en las reglas pero que nadie escribía— y de
 * ahí sale el criterio para dejar de levantar lo que se rechaza siempre.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export type TeacherDecisionKind = 'APPROVED' | 'EDITED' | 'DISMISSED' | 'SHARED';

/** A partir de cuántos descartes seguidos se deja de proponer un tipo. */
const DISMISS_THRESHOLD = 4;
/** Proporción mínima de descarte para considerarlo un rechazo sistemático. */
const DISMISS_RATIO = 0.8;

export type TeacherCalibration = {
  /** Tipos de incoherencia que el docente rechaza sistemáticamente. */
  suppressedCoherenceTypes: string[];
  /** Categorías de hallazgo que rechaza sistemáticamente. */
  suppressedCategories: string[];
  /** Cuánto suele acortar o alargar el feedback propuesto. */
  editsTowardShorter: boolean | null;
  totalDecisions: number;
};

/**
 * Registra una decisión docente.
 *
 * Nunca debe hacer fallar la acción que la originó: si esto no se puede
 * guardar, el docente igual aprobó o descartó su hallazgo.
 */
export async function recordTeacherDecision(input: {
  reviewId: string;
  kind: TeacherDecisionKind;
  category?: string;
  coherenceTypes?: string[];
  priority?: string;
  originalLength?: number;
  finalLength?: number;
  via?: 'web' | 'telegram';
}) {
  try {
    const db = getAdminDb();
    await db.collection('teacher_decisions').doc(`${input.reviewId}_${Date.now()}`).set({
      ...input,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('No se pudo registrar la decisión docente:', error);
  }
}

/**
 * Qué ha aprendido el agente sobre el criterio del docente.
 *
 * Solo se suprime lo que se rechaza de forma consistente: un descarte aislado
 * no silencia nada, porque puede haber sido por contexto y no por criterio.
 */
export async function getTeacherCalibration(): Promise<TeacherCalibration> {
  const empty: TeacherCalibration = {
    suppressedCoherenceTypes: [],
    suppressedCategories: [],
    editsTowardShorter: null,
    totalDecisions: 0,
  };

  try {
    const db = getAdminDb();
    const snapshot = await db.collection('teacher_decisions').get();
    const decisions = snapshot.docs.map((doc: any) => doc.data());
    if (decisions.length === 0) return empty;

    const tally = (key: 'coherence' | 'category') => {
      const seen = new Map<string, { dismissed: number; total: number }>();
      decisions.forEach((decision: any) => {
        const values: string[] = key === 'coherence'
          ? (decision.coherenceTypes || [])
          : (decision.category ? [decision.category] : []);
        values.forEach(value => {
          const current = seen.get(value) || { dismissed: 0, total: 0 };
          current.total++;
          if (decision.kind === 'DISMISSED') current.dismissed++;
          seen.set(value, current);
        });
      });
      return [...seen.entries()]
        .filter(([, counts]) => counts.dismissed >= DISMISS_THRESHOLD
          && counts.dismissed / counts.total >= DISMISS_RATIO)
        .map(([value]) => value);
    };

    // Si el docente sistemáticamente acorta lo propuesto, conviene proponerlo
    // más breve desde el principio.
    const edits = decisions.filter((decision: any) =>
      decision.kind === 'EDITED'
      && typeof decision.originalLength === 'number'
      && typeof decision.finalLength === 'number');
    const shorter = edits.filter((decision: any) => decision.finalLength < decision.originalLength).length;

    return {
      suppressedCoherenceTypes: tally('coherence'),
      suppressedCategories: tally('category'),
      editsTowardShorter: edits.length >= 3 ? shorter / edits.length >= 0.7 : null,
      totalDecisions: decisions.length,
    };
  } catch (error) {
    console.warn('No se pudo calcular la calibración docente:', error);
    return empty;
  }
}

/** Instrucción para el prompt del análisis, derivada del criterio observado. */
export function calibrationInstruction(calibration: TeacherCalibration): string {
  if (calibration.totalDecisions === 0) return '';

  const parts: string[] = [];
  if (calibration.suppressedCoherenceTypes.length > 0) {
    parts.push(
      `El docente ha descartado sistemáticamente los hallazgos de tipo `
      + `${calibration.suppressedCoherenceTypes.join(', ')}. NO los reportes salvo que`
      + ` comprometan la seguridad de la persona atendida.`,
    );
  }
  if (calibration.editsTowardShorter === true) {
    parts.push('El docente acorta el feedback que le propones: escríbelo más breve, máximo 100 palabras.');
  } else if (calibration.editsTowardShorter === false) {
    parts.push('El docente amplía el feedback que le propones: desarrolla algo más el razonamiento.');
  }

  return parts.length > 0 ? `\n\nCRITERIO APRENDIDO DEL DOCENTE:\n${parts.join('\n')}` : '';
}
