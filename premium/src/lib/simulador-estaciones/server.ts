import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { jsonrepair } from 'jsonrepair';
import { callGeminiCascade } from '@/lib/ai/modelQuotas';
import { SimCaseSchema, type SimCaseType } from '@/lib/ai/simuladorSchemas';
import { getAdminDb } from '@/lib/server/firebaseAdmin';
import {
  StationSimulationEvaluationSchema,
  STATION_DEFINITIONS,
  STATION_KEYS,
  type PlanningDraft,
  type PublicStationSession,
  type StationKey,
  type StationProgress,
  type StationSimulationEvaluation,
  createEmptyPlanningDraft,
  createEmptyStations,
} from './types';
import {
  STATION_SIMULATOR_CASE_PROMPT,
  buildCaseGenerationPrompt,
  buildFinalEvaluationPrompt,
  buildLiveStationPrompt,
} from './prompts';

export const STATION_SESSION_COLLECTION = 'voice_station_sessions';
export const STATION_LIVE_MODEL = 'gemini-3.1-flash-live-preview';

type StoredSession = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  region: string;
  difficulty: string;
  startingNotes: string;
  seed: string;
  status: string;
  currentStation: StationKey;
  currentStationIndex: number;
  stations: Record<StationKey, StationProgress>;
  planningDraft: PlanningDraft;
  visibleCase: Record<string, unknown>;
  fullCase: SimCaseType;
  liveResumeHandles?: Partial<Record<StationKey, string>>;
  evaluation?: StationSimulationEvaluation;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
};

function parseJsonObject(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La IA no devolvió un objeto JSON.');
  return JSON.parse(jsonrepair(match[0]));
}

export async function generateStationCase(params: {
  region: string;
  difficulty: string;
  startingNotes: string;
  seed: string;
}): Promise<SimCaseType> {
  const { text } = await callGeminiCascade({
    systemInstruction: STATION_SIMULATOR_CASE_PROMPT,
    userPrompt: buildCaseGenerationPrompt(params),
    temperature: 0.75,
    responseMimeType: 'application/json',
    maxOutputTokens: 14000,
  });
  const raw = parseJsonObject(text) as Record<string, unknown>;
  const candidate = raw.ficha_visible
    ? raw
    : (raw.caso || raw.case || raw.data || raw.resultado || raw.respuesta || raw);
  return SimCaseSchema.parse(candidate);
}

export async function createStationSession(params: {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  region: string;
  difficulty: string;
  startingNotes: string;
}) {
  const db = getAdminDb();
  const ref = db.collection(STATION_SESSION_COLLECTION).doc();
  const seed = `${params.region}-${Date.now()}-${crypto.randomUUID()}`;
  const now = Timestamp.now();

  await ref.set({
    ...params,
    seed,
    status: 'CREATING',
    currentStation: STATION_KEYS[0],
    currentStationIndex: 0,
    stations: createEmptyStations(),
    planningDraft: createEmptyPlanningDraft(),
    visibleCase: {},
    createdAt: now,
    updatedAt: now,
  });

  try {
    const fullCase = await generateStationCase({
      region: params.region,
      difficulty: params.difficulty,
      startingNotes: params.startingNotes,
      seed,
    });
    await ref.update({
      status: 'READY',
      fullCase,
      visibleCase: fullCase.ficha_visible,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    await ref.update({
      status: 'ERROR',
      errorMessage: String((error as Error)?.message || error).slice(0, 1000),
      updatedAt: Timestamp.now(),
    });
    throw error;
  }

  return getStationSessionForOwner(ref.id, params.ownerId);
}

export async function getStoredStationSession(sessionId: string): Promise<StoredSession & { id: string }> {
  const snap = await getAdminDb().collection(STATION_SESSION_COLLECTION).doc(sessionId).get();
  if (!snap.exists) throw new Error('NOT_FOUND: Sesión no encontrada');
  return { id: snap.id, ...(snap.data() as StoredSession) };
}

export async function getStationSessionForOwner(sessionId: string, ownerId: string) {
  const session = await getStoredStationSession(sessionId);
  if (session.ownerId !== ownerId) throw new Error('FORBIDDEN: Esta sesión pertenece a otra cuenta');
  return toPublicSession(session);
}

export async function getLatestStationSessions(ownerId: string, maxResults = 8) {
  const snap = await getAdminDb()
    .collection(STATION_SESSION_COLLECTION)
    .where('ownerId', '==', ownerId)
    .limit(30)
    .get();

  return snap.docs
    .map((doc: { id: string; data: () => unknown }) => ({ id: doc.id, ...(doc.data() as StoredSession) }))
    .sort((a: StoredSession & { id: string }, b: StoredSession & { id: string }) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
    .slice(0, maxResults)
    .map(toPublicSession);
}

function timestampToIso(value?: Timestamp) {
  return value?.toDate().toISOString();
}

export function toPublicSession(session: StoredSession & { id: string }): PublicStationSession {
  return {
    id: session.id,
    ownerId: session.ownerId,
    ownerName: session.ownerName,
    ownerEmail: session.ownerEmail,
    region: session.region,
    difficulty: session.difficulty,
    startingNotes: session.startingNotes,
    status: session.status as PublicStationSession['status'],
    currentStation: session.currentStation,
    currentStationIndex: session.currentStationIndex,
    stations: session.stations,
    planningDraft: session.planningDraft || createEmptyPlanningDraft(),
    visibleCase: session.visibleCase || {},
    createdAt: timestampToIso(session.createdAt) || new Date().toISOString(),
    updatedAt: timestampToIso(session.updatedAt) || new Date().toISOString(),
    completedAt: timestampToIso(session.completedAt),
    evaluation: session.evaluation,
    errorMessage: String((session as StoredSession & { errorMessage?: string }).errorMessage || ''),
  };
}

export function buildStationInstruction(session: StoredSession, station: StationKey) {
  const currentIndex = STATION_KEYS.indexOf(station);
  const priorProgress = Object.fromEntries(
    STATION_KEYS.slice(0, Math.max(0, currentIndex)).map((key) => [key, session.stations[key]]),
  );
  return buildLiveStationPrompt({
    station,
    caseData: session.fullCase,
    priorProgress,
    planningDraft: session.planningDraft,
  });
}

export async function evaluateStationSession(sessionId: string, ownerId: string) {
  const session = await getStoredStationSession(sessionId);
  if (session.ownerId !== ownerId) throw new Error('FORBIDDEN: Esta sesión pertenece a otra cuenta');
  if (session.evaluation && session.status === 'COMPLETED') return toPublicSession(session);

  const incomplete = STATION_KEYS.filter((key) => session.stations[key]?.status !== 'COMPLETED');
  if (incomplete.length > 0) {
    throw new Error(`INCOMPLETE: Faltan estaciones por completar: ${incomplete.join(', ')}`);
  }

  const ref = getAdminDb().collection(STATION_SESSION_COLLECTION).doc(sessionId);
  await ref.update({ status: 'EVALUATING', updatedAt: Timestamp.now() });

  try {
    const { text } = await callGeminiCascade({
      systemInstruction: 'Evalúas desempeño clínico de estudiantes con rigor, trazabilidad y separación explícita entre evidencia e inferencia. No inventes hechos.',
      userPrompt: buildFinalEvaluationPrompt({
        caseData: session.fullCase,
        stations: session.stations,
        planningDraft: session.planningDraft,
      }),
      temperature: 0.15,
      responseMimeType: 'application/json',
      maxOutputTokens: 16000,
    });

    const parsed = StationSimulationEvaluationSchema.parse(parseJsonObject(text));
    const evaluation = normalizeEvaluation(parsed);
    const completedAt = Timestamp.now();

    await ref.update({
      evaluation,
      status: 'COMPLETED',
      completedAt,
      updatedAt: completedAt,
    });

    await saveCountableAttempt({ ...session, evaluation }, sessionId, completedAt);
    return getStationSessionForOwner(sessionId, ownerId);
  } catch (error) {
    await ref.update({
      status: 'IN_PROGRESS',
      evaluationError: String((error as Error)?.message || error).slice(0, 1000),
      updatedAt: Timestamp.now(),
    });
    throw error;
  }
}

const SCORE_WEIGHTS: Record<keyof StationSimulationEvaluation['stationScores'], number> = {
  anamnesisProxima: 8,
  anamnesisRemota: 7,
  examenFisico: 14,
  intervenciones: 14,
  planificacionEscrita: 18,
  presentacionFormal: 10,
  defensa: 15,
  seguridadProfesional: 4,
  coherenciaLongitudinal: 10,
};

function normalizeEvaluation(input: StationSimulationEvaluation): StationSimulationEvaluation {
  let total = 0;
  const stationScores = { ...input.stationScores };
  for (const key of Object.keys(SCORE_WEIGHTS) as Array<keyof typeof SCORE_WEIGHTS>) {
    const score = Math.max(0, Math.min(100, Number(stationScores[key].score) || 0));
    const weightedPoints = (score * SCORE_WEIGHTS[key]) / 100;
    stationScores[key] = { ...stationScores[key], score, weightedPoints: round1(weightedPoints) };
    total += weightedPoints;
  }
  total = round1(total);
  const grade = scoreToChileanGrade(total);
  const outcome = total >= 85
    ? 'APROBADO_DESTACADO'
    : total >= 70
      ? 'APROBADO'
      : total >= 55
        ? 'REPROBADO_RECUPERABLE'
        : 'REPROBADO';
  return { ...input, stationScores, totalScore: total, grade, outcome };
}

export function scoreToChileanGrade(score: number) {
  const bounded = Math.max(0, Math.min(100, score));
  const grade = bounded < 70
    ? 1 + (3 * bounded) / 70
    : 4 + (3 * (bounded - 70)) / 30;
  return round1(Math.max(1, Math.min(7, grade)));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

async function saveCountableAttempt(session: StoredSession & { evaluation: StationSimulationEvaluation }, sessionId: string, completedAt: Timestamp) {
  const attemptRef = getAdminDb().collection('simulador_intentos').doc(`stations_${sessionId}`);
  const existing = await attemptRef.get();
  if (existing.exists) return;

  const elapsed = Object.values(session.stations).reduce((sum, station) => sum + (station.elapsedSeconds || 0), 0);
  await attemptRef.set({
    userId: session.ownerId,
    userEmail: session.ownerEmail,
    userName: session.ownerName,
    area: session.region,
    dificultad: session.difficulty,
    practiceMode: 'ESTACIONES_VOZ_60',
    version: 'stations_voice_v1',
    modalidad: 'VOZ',
    pacienteNombre: String((session.visibleCase as { nombre?: string })?.nombre || 'Caso simulado'),
    motivoConsulta: String((session.visibleCase as { motivo_consulta?: string })?.motivo_consulta || ''),
    puntajeGlobal: session.evaluation.totalScore,
    notaChilena: session.evaluation.grade,
    nivel: session.evaluation.outcome,
    puntajeComision: session.evaluation.stationScores.defensa.score,
    notaComision: scoreToChileanGrade(session.evaluation.stationScores.defensa.score),
    scorecard: session.evaluation.stationScores,
    tiempoSegundos: elapsed,
    fecha: completedAt,
    resumenTrabajo: session.evaluation.feedbackSummary,
    erroresCriticos: session.evaluation.criticalSafetyErrors,
    aciertosDestacados: session.evaluation.strengths,
    areasMejora: session.evaluation.priorities,
    perlaDocente: session.evaluation.nextPractice,
    fullSessionData: {
      stationSessionId: sessionId,
      planningDraft: session.planningDraft,
      stations: session.stations,
      evaluation: session.evaluation,
    },
    createdBy: 'station-simulator-server',
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function stationDefinition(key: StationKey) {
  return STATION_DEFINITIONS.find((item) => item.key === key)!;
}
