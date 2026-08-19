import {
  OlderAdultEvaluationData,
  OlderAdultEvaluationResults,
  OlderAdultParticipant,
  ResultLevel,
} from './types';

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const finiteValues = (values: Array<number | null | undefined>) =>
  values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

export function calculateAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDifference = now.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function normalizeRut(value?: string): string {
  return String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

export function normalizeName(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function createEmptyEvaluationData(participant?: Partial<OlderAdultParticipant>): OlderAdultEvaluationData {
  return {
    participantContext: {
      chronicConditions: '',
      chronicConditionsControlled: 'NO_SABE',
      medications: '',
      injuries: '',
      disability: '',
      hospitalizationsLastYear: '',
      assistiveDevices: '',
      surgeries: '',
      physicalActivity: '',
      nutritionalHabits: '',
      goals: [],
      preferredMusic: '',
      consentConfirmed: false,
    },
    readingAbility: participant?.readingAbility || '',
    writingAbility: participant?.writingAbility || '',
    frail: {
      fatigue: false,
      resistanceDifficulty: false,
      ambulationDifficulty: false,
      fiveOrMoreIllnesses: false,
      weightLoss: false,
    },
    falls: {
      fallsLastYear: '',
      fallWithInjury: false,
      feelsUnsteady: false,
      worriesAboutFalling: false,
    },
    cognition: {
      memoryConcern: false,
      orientedInDate: null,
      orientedInPlace: null,
      recalledWords: null,
    },
    upperLimbMobility: {
      shoulderFlexion: 'NO_EVALUADO',
      shoulderAbduction: 'NO_EVALUADO',
      shoulderExternalRotation: 'NO_EVALUADO',
      elbowFlexionExtension: 'NO_EVALUADO',
      forearmPronationSupination: 'NO_EVALUADO',
      wristFlexionExtension: 'NO_EVALUADO',
      notes: '',
    },
    tests: {
      heightCm: null,
      weightKg: null,
      chairHeightCm: 45,
      grip: {
        right: [null, null, null],
        left: [null, null, null],
        dominantHand: '',
        unit: 'KG',
      },
      sppb: {
        balance: {
          feetTogetherSeconds: null,
          semiTandemSeconds: null,
          tandemSeconds: null,
          unable: false,
        },
        gait4m: {
          attempt1Seconds: null,
          attempt2Seconds: null,
          unable: false,
          assistiveDevice: '',
        },
        chair5: {
          seconds: null,
          unableWithoutArms: false,
        },
      },
      tugSeconds: null,
      tugUnable: false,
      tugAssistiveDevice: '',
      sts30Repetitions: null,
      sts30UsedArms: false,
      testModifiedReason: '',
    },
    clinicalObservations: '',
  };
}

function calculateBalanceScore(data: OlderAdultEvaluationData): number {
  const balance = data.tests.sppb.balance;
  if (balance.unable) return 0;
  const together = balance.feetTogetherSeconds || 0;
  const semi = balance.semiTandemSeconds || 0;
  const tandem = balance.tandemSeconds || 0;
  if (together < 10) return 0;
  if (semi < 10) return 1;
  if (tandem < 3) return 2;
  if (tandem < 10) return 3;
  return 4;
}

function calculateGaitScore(bestSeconds: number | null, unable: boolean): number {
  if (unable || bestSeconds == null) return 0;
  if (bestSeconds < 4.82) return 4;
  if (bestSeconds <= 6.2) return 3;
  if (bestSeconds <= 8.7) return 2;
  return 1;
}

function calculateChairScore(seconds: number | null, unable: boolean): number {
  if (unable || seconds == null) return 0;
  if (seconds <= 11.19) return 4;
  if (seconds <= 13.69) return 3;
  if (seconds <= 16.69) return 2;
  return 1;
}

function sppbLabel(total: number): string {
  if (total <= 6) return 'Desempeño físico bajo';
  if (total <= 9) return 'Desempeño físico intermedio';
  return 'Desempeño físico conservado';
}

function sts30LowerReference(age: number | null, sex: OlderAdultParticipant['sex']): number | null {
  if (age == null || age < 60 || age > 94 || sex === 'NO_ESPECIFICA') return null;
  const band = age <= 64 ? 0 : age <= 69 ? 1 : age <= 74 ? 2 : age <= 79 ? 3 : age <= 84 ? 4 : age <= 89 ? 5 : 6;
  const references = sex === 'HOMBRE' ? [14, 12, 12, 11, 10, 8, 7] : [12, 11, 10, 10, 9, 8, 4];
  return references[band];
}

function powerClassification(relativePower: number | null, sex: OlderAdultParticipant['sex']): string {
  if (relativePower == null || sex === 'NO_ESPECIFICA') return 'Sin clasificación';
  const thresholds = sex === 'HOMBRE'
    ? { p10: 2.53, p25: 2.99, p75: 4.17 }
    : { p10: 2.02, p25: 2.4, p75: 3.39 };
  if (relativePower < thresholds.p10) return 'Muy baja';
  if (relativePower < thresholds.p25) return 'Bajo lo esperado';
  if (relativePower < thresholds.p75) return 'Rango esperado';
  return 'Alta';
}

function scale(value: number | null, low: number, high: number, inverse = false): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const raw = ((value - low) / (high - low)) * 100;
  const clamped = Math.max(0, Math.min(100, raw));
  return Math.round(inverse ? 100 - clamped : clamped);
}

export function calculateOlderAdultResults(
  participant: Pick<OlderAdultParticipant, 'age' | 'sex'>,
  data: OlderAdultEvaluationData,
): OlderAdultEvaluationResults {
  const rightValues = finiteValues(data.tests.grip.right);
  const leftValues = finiteValues(data.tests.grip.left);
  const gripRightMax = rightValues.length ? Math.max(...rightValues) : null;
  const gripLeftMax = leftValues.length ? Math.max(...leftValues) : null;
  const gripValues = finiteValues([gripRightMax, gripLeftMax]);
  const gripBest = gripValues.length ? Math.max(...gripValues) : null;
  const gripCutoff = participant.sex === 'HOMBRE' ? 27 : participant.sex === 'MUJER' ? 16 : null;
  const lowGripStrength = gripBest == null || gripCutoff == null ? null : gripBest < gripCutoff;

  const gaitTimes = finiteValues([
    data.tests.sppb.gait4m.attempt1Seconds,
    data.tests.sppb.gait4m.attempt2Seconds,
  ]).filter(value => value > 0);
  const gaitBestSeconds = gaitTimes.length ? Math.min(...gaitTimes) : null;
  const gaitSpeedMps = gaitBestSeconds ? round(4 / gaitBestSeconds) : null;
  const balanceScore = calculateBalanceScore(data);
  const gaitScore = calculateGaitScore(gaitBestSeconds, data.tests.sppb.gait4m.unable);
  const chairScore = calculateChairScore(
    data.tests.sppb.chair5.seconds,
    data.tests.sppb.chair5.unableWithoutArms,
  );
  const sppbTotal = balanceScore + gaitScore + chairScore;

  const frailScore = Object.values(data.frail).filter(Boolean).length;
  const frailtyLabel = frailScore === 0 ? 'ROBUSTO' : frailScore <= 2 ? 'PREFRAGIL' : 'FRAGIL';

  const chairSuggestsLowStrength = data.tests.sppb.chair5.unableWithoutArms
    || (data.tests.sppb.chair5.seconds != null && data.tests.sppb.chair5.seconds > 15);
  const strengthWasMeasured = gripBest != null || data.tests.sppb.chair5.seconds != null || data.tests.sppb.chair5.unableWithoutArms;
  const probableSarcopenia = !strengthWasMeasured
    ? null
    : Boolean(lowGripStrength || chairSuggestsLowStrength);
  const sarcopeniaLabel = probableSarcopenia == null
    ? 'Faltan datos de fuerza'
    : probableSarcopenia
      ? 'Cribado compatible con sarcopenia probable'
      : 'Sin criterio de fuerza reducida';

  const repeatedFalls = data.falls.fallsLastYear === 'DOS_O_MAS';
  const anyFall = data.falls.fallsLastYear === 'UNA' || repeatedFalls;
  const tugSignal = data.tests.tugUnable || (data.tests.tugSeconds != null && data.tests.tugSeconds >= 12);
  const balanceSignal = balanceScore <= 2;
  let fallRiskLevel: ResultLevel = 'CONSERVADO';
  let fallRiskLabel = 'Sin señales actuales de riesgo aumentado';
  if (repeatedFalls || data.falls.fallWithInjury) {
    fallRiskLevel = 'PRIORITARIO';
    fallRiskLabel = 'Revisión prioritaria por antecedentes de caídas';
  } else if (anyFall || data.falls.feelsUnsteady || data.falls.worriesAboutFalling || tugSignal || balanceSignal) {
    fallRiskLevel = 'ALTERADO';
    fallRiskLabel = 'Cribado con riesgo de caída aumentado';
  }

  const cognitiveFlag = data.cognition.memoryConcern
    || data.cognition.orientedInDate === false
    || data.cognition.orientedInPlace === false
    || (data.cognition.recalledWords != null && data.cognition.recalledWords <= 1);
  const cognitiveLabel = cognitiveFlag
    ? 'Señal en cribado cognitivo breve: requiere revisión'
    : 'Sin señal en el cribado registrado';

  const repetitions = data.tests.sts30Repetitions;
  const heightM = data.tests.heightCm != null ? data.tests.heightCm / 100 : null;
  const chairHeightM = data.tests.chairHeightCm != null ? data.tests.chairHeightCm / 100 : null;
  const weight = data.tests.weightKg;
  const validPowerInputs = repetitions != null && repetitions > 0 && heightM != null && chairHeightM != null
    && heightM * 0.5 > chairHeightM && !data.tests.sts30UsedArms;
  const estimatedRelativePower = validPowerInputs
    ? round((0.9 * 9.81 * (heightM! * 0.5 - chairHeightM!)) / ((30 / repetitions!) * 0.5))
    : null;
  const estimatedPowerWatts = estimatedRelativePower != null && weight != null
    ? round(estimatedRelativePower * weight, 1)
    : null;

  const lowerStsReference = sts30LowerReference(participant.age ?? null, participant.sex);
  const sts30Classification = repetitions == null
    ? 'Sin registrar'
    : data.tests.sts30UsedArms
      ? 'Prueba modificada: sin comparación normativa'
      : lowerStsReference == null
        ? 'Resultado registrado sin referencia por edad/sexo'
        : repetitions < lowerStsReference
          ? `Bajo referencia (menos de ${lowerStsReference} repeticiones)`
          : 'Dentro o sobre la referencia';

  const warnings: string[] = [];
  if (data.tests.sts30UsedArms) warnings.push('El STS30 se realizó usando brazos; no se interpreta potencia ni referencia normativa.');
  if (data.tests.testModifiedReason?.trim()) warnings.push(`Protocolo modificado: ${data.tests.testModifiedReason.trim()}`);
  if (!validPowerInputs && repetitions != null && repetitions > 0 && !data.tests.sts30UsedArms) {
    warnings.push('Faltan talla o altura válida de la silla para estimar potencia.');
  }
  if (estimatedRelativePower != null) {
    warnings.push('La potencia es una estimación mediante STS30; no equivale a una medición instrumental.');
  }
  if (probableSarcopenia) {
    warnings.push('Este resultado identifica sarcopenia probable por fuerza reducida; no confirma masa muscular baja.');
  }

  const powerFloor = participant.sex === 'HOMBRE' ? 2.03 : participant.sex === 'MUJER' ? 1.62 : 1.8;
  const powerCeiling = participant.sex === 'HOMBRE' ? 4.17 : participant.sex === 'MUJER' ? 3.39 : 4;
  const gripFloor = gripCutoff ? gripCutoff * 0.5 : 10;
  const gripCeiling = gripCutoff ? gripCutoff * 1.35 : 30;

  return {
    frailScore,
    frailtyLabel,
    gripRightMax,
    gripLeftMax,
    gripBest,
    lowGripStrength,
    probableSarcopenia,
    sarcopeniaLabel,
    balanceScore,
    gaitScore,
    chairScore,
    sppbTotal,
    sppbLabel: sppbLabel(sppbTotal),
    gaitBestSeconds,
    gaitSpeedMps,
    fallRiskLevel,
    fallRiskLabel,
    cognitiveFlag,
    cognitiveLabel,
    sts30Classification,
    estimatedPowerWatts,
    estimatedRelativePower,
    powerClassification: powerClassification(estimatedRelativePower, participant.sex),
    radar: {
      grip: scale(gripBest, gripFloor, gripCeiling),
      lowerLimbPower: scale(estimatedRelativePower, powerFloor, powerCeiling),
      mobility: scale(data.tests.tugSeconds, 8, 20, true),
      gait: scale(gaitSpeedMps, 0.4, 1.2),
      balance: Math.round((balanceScore / 4) * 100),
    },
    warnings,
  };
}

export function evaluationCompleteness(data: OlderAdultEvaluationData): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!data.participantContext.consentConfirmed) missing.push('confirmación de consentimiento');
  if (!data.readingAbility) missing.push('lectura');
  if (!data.writingAbility) missing.push('escritura');
  if (!data.falls.fallsLastYear) missing.push('antecedentes de caídas');
  if (data.cognition.orientedInDate == null || data.cognition.orientedInPlace == null || data.cognition.recalledWords == null) {
    missing.push('cribado cognitivo breve');
  }
  if (finiteValues(data.tests.grip.right).length === 0 || finiteValues(data.tests.grip.left).length === 0) {
    missing.push('prensión de ambas manos');
  }
  if (!data.tests.tugUnable && data.tests.tugSeconds == null) missing.push('TUG');
  if (data.tests.sts30Repetitions == null) missing.push('STS30');
  if (!data.tests.sppb.balance.unable && data.tests.sppb.balance.feetTogetherSeconds == null) missing.push('equilibrio SPPB');
  if (!data.tests.sppb.gait4m.unable && finiteValues([
    data.tests.sppb.gait4m.attempt1Seconds,
    data.tests.sppb.gait4m.attempt2Seconds,
  ]).length === 0) missing.push('marcha de 4 metros');
  if (!data.tests.sppb.chair5.unableWithoutArms && data.tests.sppb.chair5.seconds == null) missing.push('cinco levantadas de silla');
  return { complete: missing.length === 0, missing };
}
