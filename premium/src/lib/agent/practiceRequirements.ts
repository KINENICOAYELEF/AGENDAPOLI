/**
 * EXIGENCIAS DE PRÁCTICA DE LA ROTACIÓN
 *
 * El mínimo estaba escrito como "15" a mano en cuatro lugares distintos y no se
 * podía cambiar sin tocar el código.
 *
 * Aquí vive una única definición, configurable, contra la que miden el agente,
 * la ficha del alumno y los avisos.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export type PracticeRequirements = {
  /**
   * Prácticas exigidas en total. La estudiante elige la mezcla.
   *
   * El docente exige una cantidad, no una repartición: obligar a un número
   * exacto de cada modalidad le quitaría a ella la decisión de dónde necesita
   * practicar más.
   */
  total: number;
  /**
   * Mínimos por modalidad, opcionales.
   *
   * Quedan en cero: existen por si más adelante quiere exigir, por ejemplo, un
   * piso de defensas, sin tener que volver a tocar el código.
   */
  minEscrito: number;
  minVoz: number;
  minDefensa: number;
  minEntrenamiento: number;
  updatedAt?: string;
  updatedBy?: string;
};

export const DEFAULT_REQUIREMENTS: PracticeRequirements = {
  total: 15,
  minEscrito: 0,
  minVoz: 0,
  minDefensa: 0,
  minEntrenamiento: 0,
};

const REQUIREMENTS_PATH = 'settings/practice_requirements';

export async function getPracticeRequirements(): Promise<PracticeRequirements> {
  try {
    const db = getAdminDb();
    const snapshot = await db.doc(REQUIREMENTS_PATH).get();
    if (!snapshot.exists) return DEFAULT_REQUIREMENTS;
    const data = snapshot.data() || {};
    return {
      total: Number(data.total ?? DEFAULT_REQUIREMENTS.total),
      minEscrito: Number(data.minEscrito ?? 0),
      minVoz: Number(data.minVoz ?? 0),
      minDefensa: Number(data.minDefensa ?? 0),
      minEntrenamiento: Number(data.minEntrenamiento ?? 0),
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
  total: number;
  required: number;
  done: { escrito: number; voz: number; defensa: number; entrenamiento: number; sinClasificar: number };
  meetsAll: boolean;
  /** Resumen legible de lo que falta, listo para un mensaje. */
  summary: string;
};

/**
 * Cumplimiento frente a las exigencias vigentes.
 *
 * Lo que se exige es una cantidad total; el desglose por modalidad se informa
 * porque le sirve al docente para conversar, no para reclamar.
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

  const total = attempts.length;
  const faltan = Math.max(0, requirements.total - total);

  // Los pisos por modalidad solo se evalúan si el docente los configuró.
  const shortfalls: string[] = [];
  if (requirements.minEscrito > done.escrito) shortfalls.push(`${requirements.minEscrito - done.escrito} escrita(s)`);
  if (requirements.minVoz > done.voz) shortfalls.push(`${requirements.minVoz - done.voz} de voz`);
  if (requirements.minDefensa > done.defensa) shortfalls.push(`${requirements.minDefensa - done.defensa} defensa(s)`);
  if (requirements.minEntrenamiento > done.entrenamiento) shortfalls.push(`${requirements.minEntrenamiento - done.entrenamiento} de entrenamiento`);

  const meetsAll = faltan === 0 && shortfalls.length === 0;
  const desglose = `${done.escrito} escrita(s), ${done.voz} de voz, ${done.defensa} defensa(s)`;

  return {
    studentId,
    total,
    required: requirements.total,
    done,
    meetsAll,
    summary: meetsAll
      ? `Cumple: ${total}/${requirements.total} (${desglose}).`
      : faltan > 0
        ? `Lleva ${total}/${requirements.total}. Le faltan ${faltan}${shortfalls.length ? `, y como mínimo ${shortfalls.join(', ')}` : ''}.`
        : `Lleva ${total}/${requirements.total}, pero le falta como mínimo ${shortfalls.join(', ')}.`,
  };
}
