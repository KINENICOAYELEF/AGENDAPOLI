/**
 * Sistema Flexible y Administrable de Rúbricas Universitarias (PR 10)
 * Cumple con la Sección 10, 19 y PR10 del Plan Maestro.
 * 
 * Permite al docente ingresar, editar y seleccionar de manera manual
 * las rúbricas y criterios de cualquier universidad en Firestore.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';

export interface RubricCriterion {
  id: string;
  name: string;
  weight: number; // Porcentaje (0 a 100)
  description?: string;
}

export interface UniversityRubricDefinition {
  universityCode: string;
  universityName: string;
  passingScore: number; // Por defecto 4.0
  criteria: RubricCriterion[];
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Guarda o actualiza una rúbrica ingresada manualmente por el docente.
 */
export async function saveUniversityRubric(definition: UniversityRubricDefinition): Promise<void> {
  const db = getAdminDb();
  await db.collection('rubric_definitions').doc(definition.universityCode).set({
    ...definition,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Obtiene la rúbrica definida por el docente para una universidad específica.
 * Si no existe, devuelve una plantilla base genérica para ser editada manualmente.
 */
export async function getUniversityRubric(universityCode: string): Promise<UniversityRubricDefinition> {
  const db = getAdminDb();
  const doc = await db.collection('rubric_definitions').doc(universityCode).get();

  if (doc.exists) {
    return doc.data() as UniversityRubricDefinition;
  }

  // Plantilla base vacía/editable si la universidad no ha sido creada
  return {
    universityCode: universityCode.toUpperCase(),
    universityName: `Universidad ${universityCode.toUpperCase()}`,
    passingScore: 4.0,
    criteria: [
      { id: 'c1', name: 'Anamnesis y Evaluación Clínica', weight: 30 },
      { id: 'c2', name: 'Razonamiento y Diagnóstico Kinesiológico', weight: 40 },
      { id: 'c3', name: 'Plan e Intervención Terapéutica EBM', weight: 30 },
    ],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Evalúa evidencia registrada contra la rúbrica configurada manualmente.
 * Entrega una sugerencia de rango sin imponer jamás una nota definitiva automática.
 */
export function evaluateEvidenceWithRubric(
  rubric: UniversityRubricDefinition,
  evidenceScores: Record<string, number>
) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const criterion of rubric.criteria) {
    const score = evidenceScores[criterion.id] ?? 0;
    weightedSum += (score * criterion.weight);
    totalWeight += criterion.weight;
  }

  const averagePercent = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let suggestedRange = 'Insuficiente (1.0 - 3.9)';
  if (averagePercent >= 85) {
    suggestedRange = 'Destacado / Sobresaliente (6.0 - 7.0)';
  } else if (averagePercent >= 70) {
    suggestedRange = 'Competente / Bueno (5.0 - 5.9)';
  } else if (averagePercent >= 60) {
    suggestedRange = 'Básico / Aprobado (4.0 - 4.9)';
  }

  return {
    universityCode: rubric.universityCode,
    universityName: rubric.universityName,
    averagePercent,
    suggestedRange,
    disclaimer: 'Sugerencia de rango orientativa para el docente. La calificación final es decisión exclusiva del profesor.',
  };
}
