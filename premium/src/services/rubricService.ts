import { getAdminDb } from '@/lib/server/firebaseAdmin';

export interface RubricDefinition {
  universityCode: string;
  version: string;
  effectiveFrom: string;
  effectiveTo?: string;
  dimensions: {
    id: string;
    label: string;
    weightPercentage: number;
    descriptors: {
      level: 'INSUFICIENTE' | 'REGULAR' | 'BUENO' | 'EXCELENTE';
      description: string;
    }[];
  }[];
  minimumRequirements: string[];
  secondChancePolicy?: string;
  createdAt: string;
}

export async function saveUniversityRubric(rubric: RubricDefinition): Promise<void> {
  const db = getAdminDb();
  await db
    .collection('rubric_definitions')
    .doc(`${rubric.universityCode}_${rubric.version}`)
    .set({
      ...rubric,
      createdAt: new Date().toISOString(),
    }, { merge: true });
}

export async function getActiveRubric(universityCode: string): Promise<RubricDefinition | null> {
  const db = getAdminDb();
  const snap = await db
    .collection('rubric_definitions')
    .where('universityCode', '==', universityCode)
    .orderBy('version', 'desc')
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0].data() as RubricDefinition;
}
