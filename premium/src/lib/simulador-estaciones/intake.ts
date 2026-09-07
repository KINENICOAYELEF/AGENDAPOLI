import { REGION_OPTIONS } from './types';

/** Proyección pública explícita: nunca deriva diagnósticos del caso secreto. */
export function projectStationIntake(region: string, identity: Record<string, unknown>, knownDiagnosis = '') {
  const area = REGION_OPTIONS.find((option) => option.value === region)?.label.toLowerCase() || 'la región musculoesquelética';
  return {
    nombre: String(identity.nombre || 'Caso simulado'),
    edad: String(identity.edad || ''),
    sexo: String(identity.sexo || ''),
    ocupacion: String(identity.ocupacion || ''),
    deporte_actividad: String(identity.deporte_actividad || ''),
    resumen_ingreso: `Consulta por molestias o dificultad funcional en ${area}.`,
    diagnostico_aportado: knownDiagnosis.trim(),
  };
}
