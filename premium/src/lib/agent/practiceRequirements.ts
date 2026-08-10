/**
 * EXIGENCIAS DE PRÁCTICA DE LA ROTACIÓN
 *
 * El mínimo estaba escrito como "15" a mano en cuatro lugares distintos, sumaba
 * todo en un solo número y no se podía cambiar sin tocar el código. El docente
 * exige cosas distintas de cada actividad —el simulador escrito y el OSCE por
 * voz no son intercambiables— y quiere poder incorporar otras funciones.
 *
 * Aquí vive una única definición, configurable, contra la que miden el agente,
 * la ficha del alumno y los avisos.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export type PracticeRequirements = {
  /** Simulador de examen escrito. */
  escrito: number;
  /** OSCE por voz. */
  voz: number;
  /** Defensa de comisión por voz. */
  defensa: number;
  /** Entrenamiento clínico EBM. Queda en 0 mientras no se exija. */
  entrenamiento: number;
  updatedAt?: string;
  updatedBy?: string;
};

/**
 * Valores por defecto.
 *
 * Reparten el 15 histórico entre las dos actividades que el docente declara
 * obligatorias, y dejan las demás sin exigir hasta que él lo decida.
 */
export const DEFAULT_REQUIREMENTS: PracticeRequirements = {
  escrito: 10,
  voz: 5,
  defensa: 0,
  entrenamiento: 0,
};

const REQUIREMENTS_PATH = 'settings/practice_requirements';

export async function getPracticeRequirements(): Promise<PracticeRequirements> {
  try {
    const db = getAdminDb();
    const snapshot = await db.doc(REQUIREMENTS_PATH).get();
    if (!snapshot.exists) return DEFAULT_REQUIREMENTS;
    const data = snapshot.data() || {};
    return {
      escrito: Number(data.escrito ?? DEFAULT_REQUIREMENTS.escrito),
      voz: Number(data.voz ?? DEFAULT_REQUIREMENTS.voz),
      defensa: Number(data.defensa ?? DEFAULT_REQUIREMENTS.defensa),
      entrenamiento: Number(data.entrenamiento ?? DEFAULT_REQUIREMENTS.entrenamiento),
      updatedAt: data.updatedAt,
      updatedBy: data.updatedBy,
    };
  } catch (error) {
    console.warn('No se pudieron leer las exigencias de práctica:', error);
    return DEFAULT_REQUIREMENTS;
  }
}

export type PracticeCompliance = {
  studentId: string;
  done: { escrito: number; voz: number; defensa: number; entrenamiento: number; sinClasificar: number };
  missing: { escrito: number; voz: number; defensa: number; entrenamiento: number };
  meetsAll: boolean;
  /** Resumen legible de lo que falta, listo para un mensaje. */
  summary: string;
};

/**
 * Cumplimiento por estudiante frente a las exigencias vigentes.
 *
 * Los intentos previos a la distinción escrito/voz no tienen modalidad. No se
 * les adivina una: se cuentan aparte, y se descuentan del faltante para no
 * reclamarle a alguien prácticas que sí hizo.
 */
export function computeCompliance(
  studentId: string,
  attempts: Array<{ modalidad?: string; kind: 'SIMULADOR' | 'DEFENSA' | 'ENTRENAMIENTO' }>,
  requirements: PracticeRequirements,
): PracticeCompliance {
  const done = { escrito: 0, voz: 0, defensa: 0, entrenamiento: 0, sinClasificar: 0 };

  attempts.forEach(attempt => {
    if (attempt.kind === 'DEFENSA') done.defensa++;
    else if (attempt.kind === 'ENTRENAMIENTO') done.entrenamiento++;
    else if (attempt.modalidad === 'ESCRITO') done.escrito++;
    else if (attempt.modalidad === 'VOZ') done.voz++;
    else done.sinClasificar++;
  });

  // Los antiguos sin modalidad cubren primero lo escrito, que es la exigencia
  // mayor, y el remanente cubre voz. Es una atribución conservadora: nunca
  // inventa cumplimiento por encima de lo realmente realizado.
  let unclassified = done.sinClasificar;
  const cover = (pending: number) => {
    const used = Math.min(pending, unclassified);
    unclassified -= used;
    return pending - used;
  };

  const missing = {
    escrito: cover(Math.max(0, requirements.escrito - done.escrito)),
    voz: cover(Math.max(0, requirements.voz - done.voz)),
    defensa: Math.max(0, requirements.defensa - done.defensa),
    entrenamiento: Math.max(0, requirements.entrenamiento - done.entrenamiento),
  };

  const parts: string[] = [];
  if (missing.escrito > 0) parts.push(`${missing.escrito} escrita(s)`);
  if (missing.voz > 0) parts.push(`${missing.voz} de voz`);
  if (missing.defensa > 0) parts.push(`${missing.defensa} defensa(s)`);
  if (missing.entrenamiento > 0) parts.push(`${missing.entrenamiento} de entrenamiento`);

  return {
    studentId,
    done,
    missing,
    meetsAll: parts.length === 0,
    summary: parts.length === 0 ? 'Cumple todas las exigencias.' : `Le falta ${parts.join(', ')}.`,
  };
}
