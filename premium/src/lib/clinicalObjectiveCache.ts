export type ClinicalObjectiveCacheEntry = {
  objectives: Array<{ id: string; label: string; status?: string }>;
  versionId: string;
  timestamp: number;
  procesoContext?: unknown;
};

/** Caché compartida únicamente en la sesión del navegador. */
export const clinicalObjectiveCache: Record<string, ClinicalObjectiveCacheEntry> = {};

export function invalidateClinicalObjectiveCache(year: string, processId: string) {
  delete clinicalObjectiveCache[`objSet_${year}_${processId}`];
}
