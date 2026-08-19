export type OlderAdultSex = 'MUJER' | 'HOMBRE' | 'NO_ESPECIFICA';
export type EvaluationStatus = 'DRAFT' | 'SUBMITTED';
export type AttendanceStatus = 'PRESENTE' | 'AUSENTE';
export type TernaryAnswer = 'SI' | 'NO' | 'NO_SABE';
export type LiteracyAnswer = 'SI' | 'CON_DIFICULTAD' | 'NO';
export type MobilityFinding = 'SIN_LIMITACION' | 'LIMITADO' | 'DOLOROSO' | 'NO_EVALUADO';

export interface OlderAdultParticipant {
  id: string;
  fullName: string;
  rut?: string;
  birthDate?: string;
  age?: number | null;
  sex: OlderAdultSex;
  nationality?: string;
  phone?: string;
  emergencyContact?: string;
  educationLevel?: string;
  occupation?: string;
  address?: string;
  commune?: string;
  supportNetwork?: string;
  readingAbility?: LiteracyAnswer;
  writingAbility?: LiteracyAnswer;
  linkedClinicalUserId?: string;
  createdAt: string;
  createdByType: 'STAFF' | 'EXTERNAL_EVALUATOR';
  createdById: string;
  active: boolean;
  testRecord?: boolean;
  archivedAt?: string | null;
  archivedByUid?: string | null;
}

export interface ExternalEvaluator {
  id: string;
  fullName: string;
  email: string;
  university?: string;
  tokenHash: string;
  active: boolean;
  createdAt: string;
  lastAccessAt: string;
  testRecord?: boolean;
}

export interface FrailScreen {
  fatigue: boolean;
  resistanceDifficulty: boolean;
  ambulationDifficulty: boolean;
  fiveOrMoreIllnesses: boolean;
  weightLoss: boolean;
}

export interface FallsScreen {
  fallsLastYear: 'NINGUNA' | 'UNA' | 'DOS_O_MAS' | '';
  fallWithInjury: boolean;
  feelsUnsteady: boolean;
  worriesAboutFalling: boolean;
}

export interface CognitiveScreen {
  memoryConcern: boolean;
  orientedInDate: boolean | null;
  orientedInPlace: boolean | null;
  recalledWords: number | null;
}

export interface UpperLimbMobility {
  shoulderFlexion: MobilityFinding;
  shoulderAbduction: MobilityFinding;
  shoulderExternalRotation: MobilityFinding;
  elbowFlexionExtension: MobilityFinding;
  forearmPronationSupination: MobilityFinding;
  wristFlexionExtension: MobilityFinding;
  notes: string;
}

export interface GripAssessment {
  right: Array<number | null>;
  left: Array<number | null>;
  dominantHand: 'DERECHA' | 'IZQUIERDA' | 'AMBIDIESTRA' | '';
  unit: 'KG';
}

export interface SppbAssessment {
  balance: {
    feetTogetherSeconds: number | null;
    semiTandemSeconds: number | null;
    tandemSeconds: number | null;
    unable: boolean;
  };
  gait4m: {
    attempt1Seconds: number | null;
    attempt2Seconds: number | null;
    unable: boolean;
    assistiveDevice?: string;
  };
  chair5: {
    seconds: number | null;
    unableWithoutArms: boolean;
  };
}

export interface FunctionalTests {
  heightCm: number | null;
  weightKg: number | null;
  chairHeightCm: number | null;
  grip: GripAssessment;
  sppb: SppbAssessment;
  tugSeconds: number | null;
  tugUnable: boolean;
  tugAssistiveDevice?: string;
  sts30Repetitions: number | null;
  sts30UsedArms: boolean;
  testModifiedReason?: string;
}

export interface OlderAdultEvaluationData {
  participantContext: {
    chronicConditions: string;
    chronicConditionsControlled: TernaryAnswer;
    medications: string;
    injuries: string;
    disability: string;
    hospitalizationsLastYear: string;
    assistiveDevices: string;
    surgeries: string;
    physicalActivity: string;
    nutritionalHabits: string;
    goals: string[];
    preferredMusic: string;
    consentConfirmed: boolean;
  };
  readingAbility: LiteracyAnswer | '';
  writingAbility: LiteracyAnswer | '';
  frail: FrailScreen;
  falls: FallsScreen;
  cognition: CognitiveScreen;
  upperLimbMobility: UpperLimbMobility;
  tests: FunctionalTests;
  clinicalObservations: string;
}

export type ResultLevel = 'SIN_CLASIFICAR' | 'CONSERVADO' | 'INTERMEDIO' | 'ALTERADO' | 'PRIORITARIO';

export interface OlderAdultEvaluationResults {
  frailScore: number;
  frailtyLabel: 'ROBUSTO' | 'PREFRAGIL' | 'FRAGIL';
  gripRightMax: number | null;
  gripLeftMax: number | null;
  gripBest: number | null;
  lowGripStrength: boolean | null;
  probableSarcopenia: boolean | null;
  sarcopeniaLabel: string;
  balanceScore: number;
  gaitScore: number;
  chairScore: number;
  sppbTotal: number;
  sppbLabel: string;
  gaitBestSeconds: number | null;
  gaitSpeedMps: number | null;
  fallRiskLevel: ResultLevel;
  fallRiskLabel: string;
  cognitiveFlag: boolean;
  cognitiveLabel: string;
  sts30Classification: string;
  estimatedPowerWatts: number | null;
  estimatedRelativePower: number | null;
  powerClassification: string;
  radar: {
    grip: number;
    lowerLimbPower: number;
    mobility: number;
    gait: number;
    balance: number;
  };
  warnings: string[];
}

export interface OlderAdultEvaluation {
  id: string;
  participantId: string;
  evaluatorId: string;
  evaluatorName: string;
  participantSnapshot: Pick<OlderAdultParticipant, 'fullName' | 'birthDate' | 'age' | 'sex' | 'commune'>;
  status: EvaluationStatus;
  step: number;
  data: OlderAdultEvaluationData;
  results: OlderAdultEvaluationResults;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

export interface WorkshopAttendance {
  id: string;
  date: string;
  participantId: string;
  participantName: string;
  status: AttendanceStatus;
  registeredByUid: string;
  registeredByName: string;
  updatedAt: string;
}

export interface WorkshopEvolution {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  summary: string;
  activities: string;
  dosage: string;
  adaptations: string;
  groupResponse: string;
  incidents: string;
  nextPlan: string;
  transcription?: string;
  attendanceCount: number;
  createdByUid: string;
  createdByName: string;
  createdAt: string;
  testRecord?: boolean;
}

export interface PublicPortalPayload {
  evaluator: Omit<ExternalEvaluator, 'tokenHash'>;
  participants: Array<Pick<OlderAdultParticipant, 'id' | 'fullName' | 'age' | 'sex' | 'commune'>>;
  evaluations: OlderAdultEvaluation[];
  recoveryUrl: string;
}
