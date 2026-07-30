export interface ClinicalRecordLinkParams {
  patientId: string;
  processId?: string;
  recordType?: 'EVALUACION' | 'EVOLUCION';
  recordId?: string;
  fieldPath?: string;
  mode?: 'readonly' | 'edit';
  returnTo?: string;
}

export function buildClinicalRecordLink(params: ClinicalRecordLinkParams): string {
  const searchParams = new URLSearchParams();

  searchParams.set('openFicha', params.patientId);

  if (params.processId) {
    searchParams.set('procesoId', params.processId);
  }
  if (params.recordType) {
    searchParams.set('recordType', params.recordType);
  }
  if (params.recordId) {
    searchParams.set('recordId', params.recordId);
  }
  if (params.fieldPath) {
    searchParams.set('fieldPath', params.fieldPath);
  }
  if (params.mode) {
    searchParams.set('mode', params.mode);
  }
  if (params.returnTo) {
    searchParams.set('returnTo', params.returnTo);
  }

  return `/app/usuarios?${searchParams.toString()}`;
}
