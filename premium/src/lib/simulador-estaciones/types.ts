import { z } from 'zod';

export const STATION_KEYS = [
  'ANAMNESIS_PROXIMA',
  'ANAMNESIS_REMOTA',
  'EXAMEN_FISICO',
  'INTERVENCIONES',
  'PLANIFICACION_ESCRITA',
  'PRESENTACION_FORMAL',
  'DEFENSA',
] as const;

export type StationKey = (typeof STATION_KEYS)[number];

export type VoiceStationKey = Exclude<StationKey, 'PLANIFICACION_ESCRITA'>;

export const STATION_DEFINITIONS: ReadonlyArray<{
  key: StationKey;
  title: string;
  shortTitle: string;
  durationSeconds: number;
  kind: 'VOICE' | 'WRITTEN';
  description: string;
}> = [
  {
    key: 'ANAMNESIS_PROXIMA',
    title: 'Anamnesis próxima',
    shortTitle: 'Próxima',
    durationSeconds: 5 * 60,
    kind: 'VOICE',
    description: 'Motivo de consulta, historia actual, síntomas, comportamiento y seguridad.',
  },
  {
    key: 'ANAMNESIS_REMOTA',
    title: 'Anamnesis remota y contexto',
    shortTitle: 'Remota',
    durationSeconds: 5 * 60,
    kind: 'VOICE',
    description: 'Antecedentes, tratamientos, medicación y contexto biopsicosocial relevante.',
  },
  {
    key: 'EXAMEN_FISICO',
    title: 'Evaluación física',
    shortTitle: 'Examen',
    durationSeconds: 9 * 60,
    kind: 'VOICE',
    description: 'Selección, secuencia e interpretación de un examen físico completo y seguro.',
  },
  {
    key: 'INTERVENCIONES',
    title: 'Intervenciones en vivo',
    shortTitle: 'Intervención',
    durationSeconds: 6 * 60,
    kind: 'VOICE',
    description: 'Dos intervenciones, una progresión, dosis y fundamento fisiológico.',
  },
  {
    key: 'PLANIFICACION_ESCRITA',
    title: 'Planificación escrita',
    shortTitle: 'Plan escrito',
    durationSeconds: 10 * 60,
    kind: 'WRITTEN',
    description: 'Diagnóstico, objetivos, plan, reevaluación y pronóstico.',
  },
  {
    key: 'PRESENTACION_FORMAL',
    title: 'Presentación formal del caso',
    shortTitle: 'Presentación',
    durationSeconds: 10 * 60,
    kind: 'VOICE',
    description: 'Exposición profesional continua, apoyada en el escrito propio.',
  },
  {
    key: 'DEFENSA',
    title: 'Defensa ante comisión',
    shortTitle: 'Defensa',
    durationSeconds: 15 * 60,
    kind: 'VOICE',
    description: 'Preguntas dirigidas al caso, decisiones propuestas y fundamentos teóricos.',
  },
];

export const TOTAL_EXAM_SECONDS = STATION_DEFINITIONS.reduce(
  (total, station) => total + station.durationSeconds,
  0,
);

export const REGION_OPTIONS = [
  { value: 'HOMBRO', label: 'Hombro' },
  { value: 'CODO_MUNECA_MANO', label: 'Codo, muñeca y mano' },
  { value: 'COLUMNA_CERVICAL', label: 'Columna cervical' },
  { value: 'COLUMNA_LUMBAR', label: 'Columna lumbar' },
  { value: 'CADERA', label: 'Cadera' },
  { value: 'RODILLA', label: 'Rodilla' },
  { value: 'TOBILLO_PIE', label: 'Tobillo y pie' },
] as const;

export const SessionStatusSchema = z.enum([
  'CREATING',
  'READY',
  'IN_PROGRESS',
  'PAUSED',
  'EVALUATING',
  'COMPLETED',
  'ABANDONED',
  'ERROR',
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const PlanningDraftSchema = z.object({
  diagnosticoKinesiologico: z.string().max(4000).default(''),
  problemaPrincipal: z.string().max(2000).default(''),
  objetivoGeneral: z.string().max(2000).default(''),
  objetivosEspecificos: z.string().max(5000).default(''),
  objetivosOperacionales: z.string().max(7000).default(''),
  planTratamiento: z.string().max(7000).default(''),
  reevaluacion: z.string().max(3000).default(''),
  pronostico: z.string().max(3000).default(''),
});
export type PlanningDraft = z.infer<typeof PlanningDraftSchema>;

export const TranscriptTurnSchema = z.object({
  id: z.string().max(100),
  role: z.enum(['STUDENT', 'PATIENT', 'EXAMINER']),
  text: z.string().max(12000),
  atMs: z.number().int().nonnegative(),
  confirmed: z.boolean().optional(),
});
export type TranscriptTurn = z.infer<typeof TranscriptTurnSchema>;

export const StationProgressSchema = z.object({
  station: z.enum(STATION_KEYS),
  remainingSeconds: z.number().int().min(0).max(15 * 60),
  elapsedSeconds: z.number().int().min(0).max(20 * 60),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED']),
  transcript: z.array(TranscriptTurnSchema).max(500).default([]),
  semanticSummary: z.string().max(12000).default(''),
  audioUncertainties: z.array(z.string().max(1000)).max(30).default([]),
  reconnectCount: z.number().int().min(0).max(50).default(0),
});
export type StationProgress = z.infer<typeof StationProgressSchema>;

export const SessionPatchSchema = z.object({
  action: z.enum(['START', 'CHECKPOINT', 'PAUSE', 'COMPLETE_STATION', 'ABANDON']),
  station: z.enum(STATION_KEYS).optional(),
  remainingSeconds: z.number().int().min(0).max(15 * 60).optional(),
  elapsedSeconds: z.number().int().min(0).max(20 * 60).optional(),
  transcript: z.array(TranscriptTurnSchema).max(500).optional(),
  semanticSummary: z.string().max(12000).optional(),
  audioUncertainties: z.array(z.string().max(1000)).max(30).optional(),
  planningDraft: PlanningDraftSchema.optional(),
  reconnectCount: z.number().int().min(0).max(50).optional(),
  resumeHandle: z.string().max(12000).optional(),
});

export const CreateSessionSchema = z.object({
  region: z.enum(REGION_OPTIONS.map((option) => option.value) as [string, ...string[]]),
  difficulty: z.enum(['INTERMEDIO', 'AVANZADO']).default('AVANZADO'),
  startingNotes: z.string().trim().max(600).default(''),
});

export interface PublicStationSession {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  region: string;
  difficulty: string;
  startingNotes: string;
  status: SessionStatus;
  currentStation: StationKey;
  currentStationIndex: number;
  stations: Record<StationKey, StationProgress>;
  planningDraft: PlanningDraft;
  visibleCase: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  evaluation?: StationSimulationEvaluation;
  errorMessage?: string;
}

export const EvidenceItemSchema = z.object({
  station: z.enum(STATION_KEYS),
  evidence: z.string().max(1200),
  interpretation: z.string().max(1800),
});

export const StationScoreSchema = z.object({
  score: z.number().min(0).max(100),
  weightedPoints: z.number().min(0).max(100),
  comment: z.string().max(2400),
  evidence: z.array(EvidenceItemSchema).max(8),
});

export const StationSimulationEvaluationSchema = z.object({
  totalScore: z.number().min(0).max(100),
  grade: z.number().min(1).max(7),
  outcome: z.enum(['APROBADO_DESTACADO', 'APROBADO', 'REPROBADO_RECUPERABLE', 'REPROBADO']),
  stationScores: z.object({
    anamnesisProxima: StationScoreSchema,
    anamnesisRemota: StationScoreSchema,
    examenFisico: StationScoreSchema,
    intervenciones: StationScoreSchema,
    planificacionEscrita: StationScoreSchema,
    presentacionFormal: StationScoreSchema,
    defensa: StationScoreSchema,
    seguridadProfesional: StationScoreSchema,
    coherenciaLongitudinal: StationScoreSchema,
  }),
  criticalSafetyErrors: z.array(z.object({
    station: z.enum(STATION_KEYS),
    error: z.string().max(1200),
    evidence: z.string().max(1200),
  })).max(12),
  audioLimitations: z.array(z.object({
    station: z.enum(STATION_KEYS),
    segment: z.string().max(1000),
    consequence: z.string().max(1000),
  })).max(20),
  strengths: z.array(z.string().max(1500)).min(2).max(8),
  priorities: z.array(z.string().max(1500)).min(2).max(8),
  coherenceAnalysis: z.string().max(5000),
  feedbackSummary: z.string().max(4000),
  detailedFeedback: z.string().max(9000),
  nextPractice: z.string().max(1800),
});
export type StationSimulationEvaluation = z.infer<typeof StationSimulationEvaluationSchema>;

export function createEmptyPlanningDraft(): PlanningDraft {
  return PlanningDraftSchema.parse({});
}

export function createEmptyStations(): Record<StationKey, StationProgress> {
  return Object.fromEntries(
    STATION_DEFINITIONS.map((station) => [
      station.key,
      {
        station: station.key,
        remainingSeconds: station.durationSeconds,
        elapsedSeconds: 0,
        status: 'NOT_STARTED',
        transcript: [],
        semanticSummary: '',
        audioUncertainties: [],
        reconnectCount: 0,
      },
    ]),
  ) as unknown as Record<StationKey, StationProgress>;
}
