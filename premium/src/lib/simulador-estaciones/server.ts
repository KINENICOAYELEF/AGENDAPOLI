import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { jsonrepair } from 'jsonrepair';
import { HIGH_VOLUME_CASCADE, callGeminiCascade } from '@/lib/ai/modelQuotas';
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
export const STATION_LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
] as const;
export const STATION_LIVE_MODEL = STATION_LIVE_MODELS[0];

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
  modelTrace?: PublicStationSession['modelTrace'];
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

async function callStructuredWithFallback<T>(
  params: Parameters<typeof callGeminiCascade>[0],
  parse: (raw: unknown) => T,
): Promise<{ value: T; model: string }> {
  let lastError = '';
  for (const model of HIGH_VOLUME_CASCADE) {
    try {
      const result = await callGeminiCascade(params, [model]);
      return { value: parse(parseJsonObject(result.text)), model: result.modelo };
    } catch (error) {
      lastError = `${model}: ${String((error as Error)?.message || error).slice(0, 300)}`;
      console.warn('[simulador-estaciones] respuesta estructurada inválida; probando respaldo', lastError);
    }
  }
  throw new Error(`Ningún modelo devolvió JSON clínico válido. ${lastError}`);
}

export async function generateStationCase(params: {
  region: string;
  difficulty: string;
  startingNotes: string;
  seed: string;
}): Promise<{ caseData: SimCaseType; model: string }> {
  const result = await callStructuredWithFallback({
    systemInstruction: STATION_SIMULATOR_CASE_PROMPT,
    userPrompt: buildCaseGenerationPrompt(params),
    temperature: 0.75,
    responseMimeType: 'application/json',
    maxOutputTokens: 14000,
  }, (parsed) => {
    const raw = parsed as Record<string, unknown>;
    const candidate = raw.ficha_visible
      ? raw
      : (raw.caso || raw.case || raw.data || raw.resultado || raw.respuesta || raw);
    return SimCaseSchema.parse(candidate);
  });
  return { caseData: result.value, model: result.model };
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
    const generated = await generateStationCase({
      region: params.region,
      difficulty: params.difficulty,
      startingNotes: params.startingNotes,
      seed,
    });
    await ref.update({
      status: 'READY',
      fullCase: generated.caseData,
      visibleCase: generated.caseData.ficha_visible,
      modelTrace: { caseGeneration: generated.model },
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
  const collection = getAdminDb().collection(STATION_SESSION_COLLECTION);
  let snap;
  try {
    snap = await collection
      .where('ownerId', '==', ownerId)
      .orderBy('updatedAt', 'desc')
      .limit(Math.max(1, Math.min(50, maxResults)))
      .get();
  } catch (error) {
    // Mantiene el historial disponible mientras el índice compuesto termina de
    // construirse en un proyecto nuevo. La ruta principal sí devuelve lo último.
    console.warn('[simulador-estaciones] índice de historial no disponible; usando respaldo acotado', error);
    snap = await collection.where('ownerId', '==', ownerId).limit(100).get();
  }

  return snap.docs
    .map((doc: { id: string; data: () => unknown }) => ({ id: doc.id, ...(doc.data() as StoredSession) }))
    .sort((a: StoredSession & { id: string }, b: StoredSession & { id: string }) => b.updatedAt.toMillis() - a.updatedAt.toMillis())
    .slice(0, maxResults)
    .map(toPublicSession);
}

function timestampToIso(value?: Timestamp) {
  return value?.toDate().toISOString();
}

function toPublicVisibleCase(session: StoredSession) {
  const source = session.visibleCase || session.fullCase?.ficha_visible || {};
  const visible = source as Record<string, unknown>;
  // La ficha pública solo identifica a la persona simulada. La evolución,
  // comportamiento, derivación diagnóstica y limitaciones se deben descubrir
  // durante la entrevista, igual que en el examen real.
  return {
    nombre: String(visible.nombre || 'Caso simulado'),
    edad: String(visible.edad || ''),
    sexo: String(visible.sexo || ''),
    ocupacion: String(visible.ocupacion || ''),
    deporte_actividad: String(visible.deporte_actividad || ''),
  };
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
    visibleCase: toPublicVisibleCase(session),
    createdAt: timestampToIso(session.createdAt) || new Date().toISOString(),
    updatedAt: timestampToIso(session.updatedAt) || new Date().toISOString(),
    completedAt: timestampToIso(session.completedAt),
    evaluation: session.evaluation,
    modelTrace: session.modelTrace,
    errorMessage: String((session as StoredSession & { errorMessage?: string }).errorMessage || ''),
  };
}

export function buildStationInstruction(session: StoredSession, station: StationKey) {
  const currentIndex = STATION_KEYS.indexOf(station);
  const priorProgress = Object.fromEntries(
    // Incluye también el avance de la estación actual. Si el handle de Google
    // expira o se cambia al modelo Live de respaldo, la conversación puede
    // reconstruirse desde el checkpoint sin inventar un caso nuevo.
    STATION_KEYS.slice(0, Math.max(0, currentIndex + 1)).map((key) => [key, session.stations[key]]),
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
    const result = await callStructuredWithFallback({
      systemInstruction: 'Evalúas desempeño clínico de estudiantes con rigor, trazabilidad y separación explícita entre evidencia e inferencia. No inventes hechos.',
      userPrompt: buildFinalEvaluationPrompt({
        caseData: session.fullCase,
        stations: session.stations,
        planningDraft: session.planningDraft,
      }),
      temperature: 0.15,
      responseMimeType: 'application/json',
      maxOutputTokens: 16000,
    }, (raw) => StationSimulationEvaluationSchema.parse(raw));

    const parsed = result.value;
    const modelo = result.model;
    const evaluation = verifyEvaluationEvidence(
      normalizeEvaluation(parsed),
      session.stations,
      session.planningDraft,
    );
    const completedAt = Timestamp.now();

    await ref.update({
      evaluation,
      'modelTrace.finalEvaluation': modelo,
      status: 'COMPLETED',
      completedAt,
      updatedAt: completedAt,
    });

    await saveCountableAttempt({
      ...session,
      evaluation,
      modelTrace: { ...(session.modelTrace || {}), finalEvaluation: modelo },
    }, sessionId, completedAt);
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

function normalizeEvidenceText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function evidenceMatchesSource(evidence: string, source: string) {
  const normalizedEvidence = normalizeEvidenceText(evidence);
  const normalizedSource = normalizeEvidenceText(source);
  if (!normalizedEvidence || !normalizedSource) return false;
  if (normalizedSource.includes(normalizedEvidence)) return true;
  const evidenceTokens = [...new Set(normalizedEvidence.split(' ').filter((token) => token.length > 3))];
  if (evidenceTokens.length < 2) return false;
  const sourceTokens = new Set(normalizedSource.split(' '));
  const overlap = evidenceTokens.filter((token) => sourceTokens.has(token)).length / evidenceTokens.length;
  return overlap >= 0.6;
}

export function verifyEvaluationEvidence(
  input: StationSimulationEvaluation,
  stations: Record<StationKey, StationProgress>,
  planningDraft: PlanningDraft,
): StationSimulationEvaluation {
  const stationSources = Object.fromEntries(STATION_KEYS.map((key) => {
    const progress = stations[key];
    const text = [
      progress?.semanticConfirmation?.summary,
      ...(progress?.semanticConfirmation?.studentCorrections || []),
      progress?.semanticSummary,
      ...(progress?.transcript || []).map((turn) => turn.text),
      key === 'PLANIFICACION_ESCRITA' ? JSON.stringify(planningDraft) : '',
    ].filter(Boolean).join('\n');
    return [key, text];
  })) as Record<StationKey, string>;

  const stationScores = { ...input.stationScores };
  for (const key of Object.keys(stationScores) as Array<keyof typeof stationScores>) {
    stationScores[key] = {
      ...stationScores[key],
      evidence: stationScores[key].evidence.map((item) => {
        const verified = evidenceMatchesSource(item.evidence, stationSources[item.station] || '');
        return {
          ...item,
          verified,
          interpretation: verified
            ? item.interpretation
            : `Inferencia docente sin cita textual verificable: ${item.interpretation}`.slice(0, 1800),
        };
      }),
    };
  }
  return { ...input, stationScores };
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
  const voiceStations = STATION_KEYS.filter((key) => key !== 'PLANIFICACION_ESCRITA');
  const voiceEvidenceComplete = voiceStations.every((key) => {
    const station = session.stations[key];
    const studentWords = station.transcript
      .filter((turn) => turn.role === 'STUDENT')
      .reduce((count, turn) => count + turn.text.trim().split(/\s+/).filter(Boolean).length, 0);
    return studentWords >= 5 || station.elapsedSeconds >= 60;
  });
  const planningLength = Object.values(session.planningDraft).join(' ').trim().length;
  const countableForMinimum = voiceEvidenceComplete && (planningLength >= 80 || session.stations.PLANIFICACION_ESCRITA.elapsedSeconds >= 120);
  await attemptRef.set({
    userId: session.ownerId,
    userEmail: session.ownerEmail,
    userName: session.ownerName,
    area: session.region,
    dificultad: session.difficulty,
    practiceMode: 'ESTACIONES_VOZ_60',
    version: 'stations_voice_v2',
    modalidad: 'VOZ',
    pacienteNombre: String((session.visibleCase as { nombre?: string })?.nombre || 'Caso simulado'),
    motivoConsulta: String((session.visibleCase as { motivo_consulta?: string })?.motivo_consulta || ''),
    puntajeGlobal: session.evaluation.totalScore,
    notaChilena: session.evaluation.grade,
    nivel: session.evaluation.outcome,
    puntajeComision: session.evaluation.stationScores.defensa.score,
    notaComision: scoreToChileanGrade(session.evaluation.stationScores.defensa.score),
    scorecard: Object.fromEntries(Object.entries(session.evaluation.stationScores).map(([key, value]) => [
      key,
      {
        ...value,
        // Doble forma temporal para no romper el historial antiguo.
        puntaje: value.score,
        comentario: value.comment,
      },
    ])),
    tiempoSegundos: elapsed,
    countableForMinimum,
    integrityStatus: countableForMinimum ? 'VALID' : 'INSUFFICIENT_EVIDENCE',
    fecha: completedAt,
    resumenTrabajo: session.evaluation.feedbackSummary,
    erroresCriticos: session.evaluation.criticalSafetyErrors,
    aciertosDestacados: session.evaluation.strengths,
    areasMejora: session.evaluation.priorities,
    perlaDocente: session.evaluation.nextPractice,
    notaGlobalIncluyeDefensa: true,
    modelTrace: session.modelTrace,
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
