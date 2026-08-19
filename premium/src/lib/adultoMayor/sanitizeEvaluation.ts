import { createEmptyEvaluationData } from './calculations';
import {
  LiteracyAnswer, MobilityFinding, OlderAdultEvaluationData, OlderAdultParticipant, TernaryAnswer,
} from './types';

const asText = (value: unknown, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const asBoolean = (value: unknown) => value === true;
const asNumber = (value: unknown, min: number, max: number): number | null => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};
const asEnum = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? value as T : fallback;

const literacyValues = ['SI', 'CON_DIFICULTAD', 'NO'] as const;
const mobilityValues = ['SIN_LIMITACION', 'LIMITADO', 'DOLOROSO', 'NO_EVALUADO'] as const;
const controlledValues = ['SI', 'NO', 'NO_SABE'] as const;

export function sanitizeOlderAdultEvaluation(input: any, participant: OlderAdultParticipant): OlderAdultEvaluationData {
  if (JSON.stringify(input || {}).length > 90_000) throw new Error('La evaluación excede el tamaño permitido.');
  const empty = createEmptyEvaluationData(participant);
  const gripArray = (values: unknown) => {
    const list = Array.isArray(values) ? values : [];
    return [0, 1, 2].map(index => asNumber(list[index], 0, 100));
  };
  const mobility = (value: unknown) => asEnum<MobilityFinding>(value, mobilityValues, 'NO_EVALUADO');
  const goals = Array.isArray(input?.participantContext?.goals)
    ? input.participantContext.goals.map((value: unknown) => asText(value, 80)).filter(Boolean).slice(0, 8)
    : [];

  return {
    participantContext: {
      chronicConditions: asText(input?.participantContext?.chronicConditions, 2000),
      chronicConditionsControlled: asEnum<TernaryAnswer>(input?.participantContext?.chronicConditionsControlled, controlledValues, 'NO_SABE'),
      medications: asText(input?.participantContext?.medications, 1500),
      injuries: asText(input?.participantContext?.injuries, 1000),
      disability: asText(input?.participantContext?.disability, 1000),
      hospitalizationsLastYear: asText(input?.participantContext?.hospitalizationsLastYear, 1000),
      assistiveDevices: asText(input?.participantContext?.assistiveDevices, 500),
      surgeries: asText(input?.participantContext?.surgeries, 1000),
      physicalActivity: asText(input?.participantContext?.physicalActivity, 1000),
      nutritionalHabits: asText(input?.participantContext?.nutritionalHabits, 1000),
      goals,
      preferredMusic: asText(input?.participantContext?.preferredMusic, 300),
      consentConfirmed: asBoolean(input?.participantContext?.consentConfirmed),
    },
    readingAbility: asEnum<LiteracyAnswer | ''>(input?.readingAbility, [...literacyValues, ''], empty.readingAbility),
    writingAbility: asEnum<LiteracyAnswer | ''>(input?.writingAbility, [...literacyValues, ''], empty.writingAbility),
    frail: {
      fatigue: asBoolean(input?.frail?.fatigue),
      resistanceDifficulty: asBoolean(input?.frail?.resistanceDifficulty),
      ambulationDifficulty: asBoolean(input?.frail?.ambulationDifficulty),
      fiveOrMoreIllnesses: asBoolean(input?.frail?.fiveOrMoreIllnesses),
      weightLoss: asBoolean(input?.frail?.weightLoss),
    },
    falls: {
      fallsLastYear: asEnum(input?.falls?.fallsLastYear, ['NINGUNA', 'UNA', 'DOS_O_MAS', ''] as const, ''),
      fallWithInjury: asBoolean(input?.falls?.fallWithInjury),
      feelsUnsteady: asBoolean(input?.falls?.feelsUnsteady),
      worriesAboutFalling: asBoolean(input?.falls?.worriesAboutFalling),
    },
    cognition: {
      memoryConcern: asBoolean(input?.cognition?.memoryConcern),
      orientedInDate: typeof input?.cognition?.orientedInDate === 'boolean' ? input.cognition.orientedInDate : null,
      orientedInPlace: typeof input?.cognition?.orientedInPlace === 'boolean' ? input.cognition.orientedInPlace : null,
      recalledWords: asNumber(input?.cognition?.recalledWords, 0, 3),
    },
    upperLimbMobility: {
      shoulderFlexion: mobility(input?.upperLimbMobility?.shoulderFlexion),
      shoulderAbduction: mobility(input?.upperLimbMobility?.shoulderAbduction),
      shoulderExternalRotation: mobility(input?.upperLimbMobility?.shoulderExternalRotation),
      elbowFlexionExtension: mobility(input?.upperLimbMobility?.elbowFlexionExtension),
      forearmPronationSupination: mobility(input?.upperLimbMobility?.forearmPronationSupination),
      wristFlexionExtension: mobility(input?.upperLimbMobility?.wristFlexionExtension),
      notes: asText(input?.upperLimbMobility?.notes, 1500),
    },
    tests: {
      heightCm: asNumber(input?.tests?.heightCm, 100, 230),
      weightKg: asNumber(input?.tests?.weightKg, 25, 250),
      chairHeightCm: asNumber(input?.tests?.chairHeightCm, 30, 65),
      grip: {
        right: gripArray(input?.tests?.grip?.right),
        left: gripArray(input?.tests?.grip?.left),
        dominantHand: asEnum(input?.tests?.grip?.dominantHand, ['DERECHA', 'IZQUIERDA', 'AMBIDIESTRA', ''] as const, ''),
        unit: 'KG',
      },
      sppb: {
        balance: {
          feetTogetherSeconds: asNumber(input?.tests?.sppb?.balance?.feetTogetherSeconds, 0, 10),
          semiTandemSeconds: asNumber(input?.tests?.sppb?.balance?.semiTandemSeconds, 0, 10),
          tandemSeconds: asNumber(input?.tests?.sppb?.balance?.tandemSeconds, 0, 10),
          unable: asBoolean(input?.tests?.sppb?.balance?.unable),
        },
        gait4m: {
          attempt1Seconds: asNumber(input?.tests?.sppb?.gait4m?.attempt1Seconds, 0.1, 120),
          attempt2Seconds: asNumber(input?.tests?.sppb?.gait4m?.attempt2Seconds, 0.1, 120),
          unable: asBoolean(input?.tests?.sppb?.gait4m?.unable),
          assistiveDevice: asText(input?.tests?.sppb?.gait4m?.assistiveDevice, 120),
        },
        chair5: {
          seconds: asNumber(input?.tests?.sppb?.chair5?.seconds, 0.1, 180),
          unableWithoutArms: asBoolean(input?.tests?.sppb?.chair5?.unableWithoutArms),
        },
      },
      tugSeconds: asNumber(input?.tests?.tugSeconds, 0.1, 180),
      tugUnable: asBoolean(input?.tests?.tugUnable),
      tugAssistiveDevice: asText(input?.tests?.tugAssistiveDevice, 120),
      sts30Repetitions: asNumber(input?.tests?.sts30Repetitions, 0, 80),
      sts30UsedArms: asBoolean(input?.tests?.sts30UsedArms),
      testModifiedReason: asText(input?.tests?.testModifiedReason, 500),
    },
    clinicalObservations: asText(input?.clinicalObservations, 3000),
  };
}
