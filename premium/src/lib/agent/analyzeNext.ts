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
import {
  COMPETENCY_LABELS, LEVEL_EMOJI, getRotationStage, saveCompetencyProfile, stageExpectation,
  type Competency, type CompetencyLevel,
} from './competencies';

/** De lo más preocupante a lo mejor logrado: el docente lee primero lo que falla. */
const LEVEL_ORDER: CompetencyLevel[] = ['INSUFICIENTE', 'EN_DESARROLLO', 'LOGRADO', 'DESTACADO'];

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

  // Un hallazgo abierto por estudiante, no uno por día.
  //
  // Sin este tope, no revisar durante una semana producía siete avisos de la
  // misma persona diciendo casi lo mismo, y la bandeja se volvía impasable —que
  // es exactamente cómo se llegó a sesenta pendientes.
  //
  // Mientras el docente no decida, no se vuelve a analizar a esa persona: el
  // aviso que ya tiene sigue siendo válido. Al resolverlo, entra de nuevo a la
  // fila con datos frescos.
  const openSnap = await db.collection('teacher_agent_reviews')
    .where('status', '==', 'PENDING_TEACHER')
    .get();
  const withOpenFinding = new Set(
    openSnap.docs
      .filter((doc: any) => doc.id.startsWith('analysis_'))
      .map((doc: any) => doc.data().studentId),
  );

  const analyzable = pending.filter(entry => !withOpenFinding.has(entry.id));
  if (analyzable.length === 0) {
    return {
      analyzed: null,
      remaining: 0,
      findingCreated: false,
      note: `${pending.length} estudiante(s) esperan tu decisión sobre su aviso anterior.`,
    };
  }

  const student = analyzable[0];

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
    return { analyzed: student.name, remaining: analyzable.length - 1, findingCreated: false, note: 'sin actividad reciente' };
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

  // En qué semana va: lo exigible en la semana 2 no es lo exigible en la 7, y
  // sin este dato el agente juzgaba igual los dos casos.
  const stage = await getRotationStage(year, student.id);
  const stageContext = `${stage.description}\n${stageExpectation(stage)}`;

  const { analysis, engine, note } = await analyzeStudentLongitudinal(
    student.id, records, 'constructive', calibration, oralEvidence, stageContext,
  );

  await markAnalyzed();

  if (!analysis) {
    return { analyzed: student.name, remaining: analyzable.length - 1, findingCreated: false, engine, note };
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
    return { analyzed: student.name, remaining: analyzable.length - 1, findingCreated: false, engine, note: 'sin evidencia verificable' };
  }

  // Los nombres de las personas atendidas se resuelven DESPUÉS del análisis.
  //
  // La evidencia se desidentifica antes de enviarla al modelo, así que él solo
  // puede decir "la usuaria de cadera". Para el docente eso es inservible: no
  // puede ir a corregir un caso que no logra identificar. Como él es el
  // supervisor tratante, sí corresponde que vea el nombre; lo que no
  // corresponde es enviárselo al modelo.
  const citedPatientIds = [...new Set(
    analysis.evidence
      .map(evidence => records.find((record: any) => record.id === evidence.recordId))
      .filter(Boolean)
      .map((record: any) => record.usuariaId || record.personaUsuariaId)
      .filter(Boolean),
  )];
  const patientNames: Array<{ id: string; name: string }> = [];
  await Promise.all(citedPatientIds.map(async (patientId: any) => {
    try {
      const snap = await db.doc(`programs/${year}/usuarias/${patientId}`).get();
      const data = snap.data();
      patientNames.push({
        id: patientId,
        name: data?.identity?.fullName || data?.nombreCompleto || `Persona ${String(patientId).slice(0, 6)}`,
      });
    } catch {
      patientNames.push({ id: patientId, name: `Persona ${String(patientId).slice(0, 6)}` });
    }
  }));

  const hasSafetyRisk = analysis.coherenceFindings?.some(
    finding => finding.type === 'RIESGO_SEGURIDAD' || finding.severity === 'ALTA',
  );
  const priority = hasSafetyRisk && analysis.priority !== 'P0'
    ? (analysis.coherenceFindings.some(f => f.type === 'RIESGO_SEGURIDAD') ? 'P0' : 'P1')
    : analysis.priority;

  // Identidad estable por estudiante: al resolver el anterior, el siguiente
  // análisis reemplaza el documento en vez de acumular uno nuevo cada día.
  const reviewId = `analysis_${year}_${student.id}`;
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
    patientNames: patientNames.map(patient => patient.name),
    createdAt: new Date().toISOString(),
  });

  await db.collection('teacher_agent_reviews').doc(reviewId).set(payload, { merge: true });
  await db.collection('student_learning_profiles').doc(student.id).set({
    strengths: analysis.strengths,
    improvementGaps: analysis.improvementGaps,
    lastUpdatedAt: new Date().toISOString(),
  }, { merge: true });

  // El perfil por competencia y su corte semanal: es lo que convierte los
  // hallazgos sueltos en algo evaluable, y el insumo de la nota de proceso.
  await saveCompetencyProfile(student.id, analysis.competencies || [], stage);

  await sendStudentAlert(db, { reviewId, studentName: student.name, priority, analysis, patientNames, stage });

  return { analyzed: student.name, remaining: analyzable.length - 1, findingCreated: true, engine, note };
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
  input: {
    reviewId: string;
    studentName: string;
    priority: string;
    analysis: any;
    /** Personas citadas en el análisis, para que el docente sepa a quién ir a ver. */
    patientNames: Array<{ id: string; name: string }>;
    stage: { currentWeek: number | null; totalWeeks: number | null };
  },
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

  // Sin esta línea el aviso es inaccionable: el docente lee "la usuaria de
  // cadera" y no sabe a cuál de sus pacientes ir.
  const people = input.patientNames.length
    ? `\n👤 _Sobre:_ ${input.patientNames.map(patient => patient.name).join(', ')}`
    : '';

  // Perfil por competencia: es lo que permite pasar de "hizo esto mal" a
  // "esta habilidad no la tiene todavía".
  const competencies = Array.isArray(input.analysis.competencies) && input.analysis.competencies.length > 0
    ? `\n\n${input.analysis.competencies
        .slice()
        .sort((a: any, b: any) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))
        .map((item: any) => `${LEVEL_EMOJI[item.level as CompetencyLevel]} ${COMPETENCY_LABELS[item.competency as Competency]}`)
        .join('\n')}`
    : '';

  const week = input.stage.currentWeek
    ? ` · semana ${input.stage.currentWeek}${input.stage.totalWeeks ? ` de ${input.stage.totalWeeks}` : ''}`
    : '';

  const text = `${priorityEmoji(input.priority)} *${input.studentName}*${week}${people}\n\n`
    + `${input.analysis.observation}\n`
    + (coherence ? `\n${coherence}\n` : '')
    + competencies
    + `\n\n_Le diría esto:_\n${input.analysis.draftFeedback}`;

  const keyboard = token
    ? {
        inline_keyboard: [
          [
            { text: '✅ Enviarle esto', callback_data: `send:${token}` },
            { text: '🗑 Descartar', callback_data: `dismiss:${token}` },
          ],
          ...input.patientNames.slice(0, 2).map(patient => ([{
            text: `📄 Abrir ${patient.name.split(' ')[0]}`,
            url: `${APP_BASE_URL}/app/usuarios?openFicha=${patient.id}`,
          }])),
          [{ text: '🎓 Ver ficha de la interna', url: `${APP_BASE_URL}/app/revision-docente` }],
        ],
      }
    : undefined;

  await sendTelegramMessage(chatId, text, keyboard);
}
