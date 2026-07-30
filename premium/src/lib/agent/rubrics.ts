export interface EvidenceMap {
  clinicalReasoning: number;
  ebmApplication: number;
  coherence: number;
  dosage: number;
  reassessment: number;
}

export interface RubricConfig {
  universityCode: string;
  name: string;
  ranges: {
    excellent: [number, number];
    good: [number, number];
    needsImprovement: [number, number];
    critical: [number, number];
  };
}

export const RUBRICS: Record<string, RubricConfig> = {
  UCH: {
    universityCode: 'UCH',
    name: 'Universidad de Chile',
    ranges: {
      excellent: [6.0, 7.0],
      good: [5.0, 5.9],
      needsImprovement: [4.0, 4.9],
      critical: [1.0, 3.9],
    }
  },
  UST: {
    universityCode: 'UST',
    name: 'Universidad Santo Tomás',
    ranges: {
      excellent: [6.0, 7.0],
      good: [5.0, 5.9],
      needsImprovement: [4.0, 4.9],
      critical: [1.0, 3.9],
    }
  },
  UNAB: {
    universityCode: 'UNAB',
    name: 'Universidad Nacional Andrés Bello',
    ranges: {
      excellent: [6.0, 7.0],
      good: [5.0, 5.9],
      needsImprovement: [4.0, 4.9],
      critical: [1.0, 3.9],
    }
  },
  UDD: {
    universityCode: 'UDD',
    name: 'Universidad del Desarrollo',
    ranges: {
      excellent: [6.0, 7.0],
      good: [5.0, 5.9],
      needsImprovement: [4.0, 4.9],
      critical: [1.0, 3.9],
    }
  },
  UDP: {
    universityCode: 'UDP',
    name: 'Universidad Diego Portales',
    ranges: {
      excellent: [6.0, 7.0],
      good: [5.0, 5.9],
      needsImprovement: [4.0, 4.9],
      critical: [1.0, 3.9],
    }
  }
};

/**
 * Mapea la evidencia clínica a criterios de evaluación y sugiere rangos de desempeño.
 * Sin asignar notas definitivas automáticas.
 */
export function mapEvidenceToRubric(universityCode: string, evidenceMap: EvidenceMap) {
  const rubric = RUBRICS[universityCode] || RUBRICS['UCH']; // Fallback
  
  // Basic calculation logic: average of evidence values (0 to 100)
  const values = Object.values(evidenceMap);
  const averageScore = values.reduce((sum, val) => sum + val, 0) / values.length;

  let performanceRange = 'No evaluable';
  let suggestedNotes = 'No califica';

  if (averageScore >= 85) {
    performanceRange = 'Excelente';
    suggestedNotes = `Sugerencia de rango: ${rubric.ranges.excellent[0]} - ${rubric.ranges.excellent[1]}`;
  } else if (averageScore >= 70) {
    performanceRange = 'Bueno';
    suggestedNotes = `Sugerencia de rango: ${rubric.ranges.good[0]} - ${rubric.ranges.good[1]}`;
  } else if (averageScore >= 50) {
    performanceRange = 'Necesita Mejora';
    suggestedNotes = `Sugerencia de rango: ${rubric.ranges.needsImprovement[0]} - ${rubric.ranges.needsImprovement[1]}`;
  } else {
    performanceRange = 'Crítico';
    suggestedNotes = `Sugerencia de rango: ${rubric.ranges.critical[0]} - ${rubric.ranges.critical[1]}`;
  }

  return {
    rubricUsed: rubric.name,
    calculatedAverageScore: averageScore,
    performanceRange,
    suggestedNotes,
    evidenceMap
  };
}
