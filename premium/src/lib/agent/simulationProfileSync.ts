/**
 * Integrador de Simulaciones y Defensas Orales al Perfil Longitudinal (PR 11)
 * Cumple con la Sección 18, 11 y PR11 del Plan Maestro.
 * 
 * Consulta las colecciones reales de producción:
 *   - simulador_intentos (OSCE Virtual)
 *   - defensas_voz_intentos (Defensa de Comisión por Voz)
 * 
 * Calcula cumplimiento de 15 prácticas mínimas y concordancia escrito vs oral.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export interface StudentSimulationMetrics {
  studentId: string;
  osceAttemptsCount: number;
  voiceDefenseAttemptsCount: number;
  totalAttemptsCount: number;
  minimum15Completed: boolean;
  oralVsWrittenConcordance?: number;
  lastAttemptAt?: string;
}

function timestampToIso(value: any): string | undefined {
  if (!value) return undefined;
  const date = typeof value.toDate === 'function'
    ? value.toDate()
    : value instanceof Date
      ? value
      : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export async function fetchStudentSimulationMetrics(studentId: string): Promise<StudentSimulationMetrics> {
  const db = getAdminDb();

  const [osceSnap, defenseSnap] = await Promise.all([
    db.collection('simulador_intentos').where('userId', '==', studentId).get(),
    db.collection('defensas_voz_intentos').where('userId', '==', studentId).get(),
  ]);

  const validOsceDocs = osceSnap.docs.filter((doc: any) => doc.data().countableForMinimum !== false);
  const osceCount = validOsceDocs.length;
  const defenseCount = defenseSnap.size;
  const total = osceCount + defenseCount;

  let lastAttemptAt: string | undefined = undefined;
  let totalWrittenScore = 0;
  let writtenCount = 0;
  let totalOralScore = 0;
  let oralCount = 0;

  validOsceDocs.forEach((doc: any) => {
    const data = doc.data();
    const d = timestampToIso(data.fecha || data.fechaInicio || data.fechaCompleto || data.sessionAt || data.createdAt);
    if (d && (!lastAttemptAt || d > lastAttemptAt)) {
      lastAttemptAt = d;
    }
    const score = data.puntajeGlobal ?? data.porcentajeGlobal ?? data.scorePuntaje ?? data.puntajeTotal;
    if (typeof score === 'number') {
      totalWrittenScore += score > 1 ? score / 100 : score;
      writtenCount++;
    }
  });

  defenseSnap.forEach((doc: any) => {
    const data = doc.data();
    const d = timestampToIso(data.fecha || data.createdAt || data.sessionAt || data.fechaInicio);
    if (d && (!lastAttemptAt || d > lastAttemptAt)) {
      lastAttemptAt = d;
    }
    const score = data.notaDefensa ?? data.scoreOral ?? data.averageScore ?? data.puntaje;
    if (typeof score === 'number') {
      totalOralScore += score > 1 ? score / 100 : score;
      oralCount++;
    }
  });

  let concordance: number | undefined = undefined;
  if (writtenCount > 0 && oralCount > 0) {
    const avgWritten = totalWrittenScore / writtenCount;
    const avgOral = totalOralScore / oralCount;
    // Ratio of oral performance relative to written performance (capped at 1.0)
    concordance = Math.min(1.0, Number((1 - Math.abs(avgWritten - avgOral)).toFixed(2)));
  } else if (total > 0) {
    concordance = 1.0;
  }

  return {
    studentId,
    osceAttemptsCount: osceCount,
    voiceDefenseAttemptsCount: defenseCount,
    totalAttemptsCount: total,
    minimum15Completed: total >= 15,
    oralVsWrittenConcordance: concordance,
    lastAttemptAt,
  };
}

/**
 * Actualiza el perfil de estudiante en Firestore incorporando las métricas reales de simulación.
 */
export async function syncSimulationMetricsToProfile(studentId: string): Promise<void> {
  const db = getAdminDb();
  const metrics = await fetchStudentSimulationMetrics(studentId);

  await db.collection('student_learning_profiles').doc(studentId).set(
    {
      simulationStats: {
        attemptsCompleted: metrics.totalAttemptsCount,
        osceCount: metrics.osceAttemptsCount,
        voiceDefenseCount: metrics.voiceDefenseAttemptsCount,
        minCompleted: metrics.minimum15Completed,
        oralVsWrittenConcordance: metrics.oralVsWrittenConcordance,
        lastAttemptAt: metrics.lastAttemptAt || null,
      },
      lastUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
