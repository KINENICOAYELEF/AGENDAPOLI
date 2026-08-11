/**
 * ANÁLISIS DE UNA ESTUDIANTE POR VEZ, CON AVISO PROPIO
 *
 * Dos problemas resueltos aquí.
 *
 * El primero es de tiempo: el censo analizaba a todas dentro de una sola
 * petición y la plataforma la cortaba, así que solo alcanzaban tres de siete.
 * Partido en unidades, quien orquesta puede repetir la llamada sin límite.
 *
 * El segundo es de forma: un resumen agregado de siete personas se lee como un
 * informe burocrático. Un aviso por persona, cuando pasa algo suyo y con un
 * botón para resolverlo, se lee como un supervisor avisando.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { TeacherAgentReviewSchema } from './contracts/review';
import { analyzeStudentLongitudinal } from './longitudinalAnalysis';
import { calibrationInstruction, getTeacherCalibration } from './teacherCalibration';
import { buildActiveRoster, rosterInRotation } from './activeRoster';
import { deidentifyText } from './deidentify';
import { getAllowedTelegramChatId, sendTelegramMessage } from '@/lib/server/telegram';
import { featureFlags } from './config';
import { priorityEmoji, priorityLabel } from './priorityLabels';

/** Cada cuánto se vuelve a analizar a la misma persona. */
const REANALYSIS_INTERVAL_HOURS = 20;
/** Ventana de actividad clínica que se analiza. */
const ACTIVITY_WINDOW_DAYS = 14;

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://agendapoli.vercel.app').replace(/\/$/, '');

export type AnalyzeNextResult = {
  analyzed: string | null;
  remaining: number;
  findingCreated: boolean;
  engine?: string | null;
  note?: string;
};

/**
 * Analiza a la siguiente estudiante pendiente y avisa si encontró algo.
 *
 * Prioriza a quien lleva más tiempo sin analizarse, para que el turno rote y
 * nadie quede sistemáticamente al final de la fila.
 */
export async function analyzeNextStudent(year: string): Promise<AnalyzeNextResult> {
  const db = getAdminDb();
  const roster = rosterInRotation(await buildActiveRoster(year));
  if (roster.length === 0) return { analyzed: null, remaining: 0, findingCreated: false };

  // Quién fue analizada y cuándo.
  const profilesSnap = await db.collection('student_learning_profiles').get();
  const lastAnalyzed = new Map<string, number>();
  profilesSnap.docs.forEach((doc: any) => {
    const at = new Date(doc.data().lastAnalyzedAt || 0).getTime();
    if (Number.isFinite(at)) lastAnalyzed.set(doc.id, at);
  });

  const staleCutoff = Date.now() - REANALYSIS_INTERVAL_HOURS * 3600 * 1000;
  const pending = roster
    .filter(entry => (lastAnalyzed.get(entry.id) || 0) < staleCutoff)
    .sort((a, b) => (lastAnalyzed.get(a.id) || 0) - (lastAnalyzed.get(b.id) || 0));

  if (pending.length === 0) return { analyzed: null, remaining: 0, findingCreated: false };

  const student = pending[0];

  // Su actividad clínica reciente.
  const sinceIso = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86400000).toISOString();
  const [evalsSnap, evolsSnap] = await Promise.all([
    db.collection(`programs/${year}/evaluaciones`).where('sessionAt', '>=', sinceIso).get(),
    db.collection(`programs/${year}/evoluciones`).where('sessionAt', '>=', sinceIso).get(),
  ]);
  const own = (doc: any, collection: 'evaluaciones' | 'evoluciones') => {
    const data = doc.data();
    const author = data.audit?.createdBy || data.autorUid || data.clinicianResponsible;
    return author === student.id ? { id: doc.id, collection, ...data } : null;
  };
  const records = [
    ...evalsSnap.docs.map((doc: any) => own(doc, 'evaluaciones')),
    ...evolsSnap.docs.map((doc: any) => own(doc, 'evoluciones')),
  ].filter(Boolean) as any[];

  // Marcar el turno como usado aunque no haya nada que analizar: de lo
  // contrario esta persona bloquearía la fila en cada llamada.
  const markAnalyzed = () => db.collection('student_learning_profiles').doc(student.id).set(
    { studentId: student.id, displayName: student.name, lastAnalyzedAt: new Date().toISOString() },
    { merge: true },
  );

  if (records.length === 0) {
    await markAnalyzed();
    return { analyzed: student.name, remaining: pending.length - 1, findingCreated: false, note: 'sin actividad reciente' };
  }

  // Desempeño oral: contrasta lo escrito con lo que sostiene al ser preguntada.
  let oralEvidence: any[] = [];
  try {
    const [osceSnap, defenseSnap] = await Promise.all([
      db.collection('simulador_intentos').where('userId', '==', student.id).limit(10).get(),
      db.collection('defensas_voz_intentos').where('userId', '==', student.id).limit(10).get(),
    ]);
    oralEvidence = [...osceSnap.docs, ...defenseSnap.docs]
      .map((doc: any) => {
        const data = doc.data();
        return {
          kind: data.notaDefensa !== undefined ? 'DEFENSA_ORAL' : 'OSCE',
          at: data.fechaInicio || data.createdAt || '',
          score: data.porcentajeGlobal ?? data.notaChilena ?? data.notaDefensa ?? null,
          feedback: String(data.perlaDocente || data.feedbackGlobal || '').slice(0, 500),
        };
      })
      .filter((item: any) => item.score !== null || item.feedback)
      .slice(0, 6);
  } catch { /* el análisis clínico sigue siendo válido sin esto */ }

  const calibration = calibrationInstruction(await getTeacherCalibration());
  const { analysis, engine, note } = await analyzeStudentLongitudinal(
    student.id, records, 'constructive', calibration, oralEvidence,
  );

  await markAnalyzed();

  if (!analysis) {
    return { analyzed: student.name, remaining: pending.length - 1, findingCreated: false, engine, note };
  }

  // Guardar el hallazgo con su evidencia real.
  const sourceReferences = analysis.evidence.flatMap((evidence) => {
    const source = records.find((record: any) => record.id === evidence.recordId);
    if (!source) return [];
    return [{
      year,
      collection: source.collection as 'evaluaciones' | 'evoluciones',
      recordId: source.id,
      fieldPath: evidence.section,
      contentHash: `${source.id}_${evidence.section}`.slice(0, 64),
      redactedExcerpt: deidentifyText(evidence.excerpt).slice(0, 200),
    }];
  });
  if (sourceReferences.length === 0) {
    return { analyzed: student.name, remaining: pending.length - 1, findingCreated: false, engine, note: 'sin evidencia verificable' };
  }

  const hasSafetyRisk = analysis.coherenceFindings?.some(
    finding => finding.type === 'RIESGO_SEGURIDAD' || finding.severity === 'ALTA',
  );
  const priority = hasSafetyRisk && analysis.priority !== 'P0'
    ? (analysis.coherenceFindings.some(f => f.type === 'RIESGO_SEGURIDAD') ? 'P0' : 'P1')
    : analysis.priority;

  const reviewId = `analysis_${year}_${student.id}_${new Date().toISOString().slice(0, 10)}`;
  const payload = TeacherAgentReviewSchema.parse({
    year,
    studentId: student.id,
    sourceReferences,
    observation: analysis.observation,
    pedagogicalInference: `${analysis.pedagogicalInference}\n\nPregunta para hacerle: ${analysis.socraticQuestion}`,
    draftFeedback: analysis.draftFeedback,
    coherenceFindings: analysis.coherenceFindings,
    confidence: analysis.confidence,
    priority,
    status: 'PENDING_TEACHER',
    createdAt: new Date().toISOString(),
  });

  await db.collection('teacher_agent_reviews').doc(reviewId).set(payload, { merge: true });
  await db.collection('student_learning_profiles').doc(student.id).set({
    strengths: analysis.strengths,
    improvementGaps: analysis.improvementGaps,
    lastUpdatedAt: new Date().toISOString(),
  }, { merge: true });

  await sendStudentAlert(db, { reviewId, studentName: student.name, priority, analysis });

  return { analyzed: student.name, remaining: pending.length - 1, findingCreated: true, engine, note };
}

/**
 * Aviso dedicado a UNA estudiante, con la acción a un toque.
 *
 * Sustituye al bloque de casos dentro del resumen: allí el docente leía siete
 * situaciones seguidas y no resolvía ninguna. Aquí cada mensaje trata de una
 * persona y termina en una decisión.
 */
async function sendStudentAlert(
  db: ReturnType<typeof getAdminDb>,
  input: { reviewId: string; studentName: string; priority: string; analysis: any },
) {
  if (!featureFlags.telegramTeacherEnabled) return;
  const chatId = getAllowedTelegramChatId();
  if (!chatId) return;

  // Token corto: los botones de Telegram admiten 64 bytes de datos.
  let token = '';
  try {
    const ref = await db.collection('telegram_actions').add({
      reviewId: input.reviewId,
      createdAt: new Date().toISOString(),
    });
    token = ref.id;
  } catch { /* sin token, el mensaje sale igual pero sin botones de decisión */ }

  const coherence = Array.isArray(input.analysis.coherenceFindings)
    ? input.analysis.coherenceFindings.slice(0, 3)
        .map((finding: any) => `   ${finding.severity === 'ALTA' ? '🚩' : '•'} ${finding.explanation}`)
        .join('\n')
    : '';

  const text = `${priorityEmoji(input.priority)} *${input.studentName}* · ${priorityLabel(input.priority)}\n\n`
    + `${input.analysis.observation}\n`
    + (coherence ? `\n${coherence}\n` : '')
    + `\n_Le diría esto:_\n${input.analysis.draftFeedback}`;

  const keyboard = token
    ? {
        inline_keyboard: [
          [
            { text: '✅ Enviarle esto', callback_data: `send:${token}` },
            { text: '🗑 Descartar', callback_data: `dismiss:${token}` },
          ],
          [{ text: '📄 Ver su ficha', url: `${APP_BASE_URL}/app/revision-docente` }],
        ],
      }
    : undefined;

  await sendTelegramMessage(chatId, text, keyboard);
}
