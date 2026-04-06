// ============================================================
// MÓDULO PFG — TIPOS DE DATOS
// Dolor Patelofemoral en Karatekas Adolescentes
// COMPLETAMENTE INDEPENDIENTE del sistema clínico principal
// ============================================================

// ────────────────────────────────────────────────
// 1) PERFIL DEL DEPORTISTA
// ────────────────────────────────────────────────
export interface PfgDeportista {
  id: string;
  alias: string;
  edad: number;
  sexo: 'Masculino' | 'Femenino' | 'Otro';
  pesoKg: number;
  tallaCm: number;
  piernaDominante: 'Derecha' | 'Izquierda' | 'Ambidiestro';
  rodillaIndice: 'Derecha' | 'Izquierda' | 'Bilateral';
  categoriaKarate: string;
  nivelCompetitivo: 'Recreativo' | 'Competitivo regional' | 'Competitivo nacional' | 'Elite';
  frecuenciaSemanalEntrenamiento: number;
  anosPractica: number;

  diagnosticoOperativo: PfgDiagnosticoOperativo;
  clasificacionClinica: PfgClasificacionClinica;

  createdAt: string;
  updatedAt: string;
  createdByUid: string;
  status: 'ACTIVO' | 'INACTIVO' | 'EXCLUIDO';
}

// ────────────────────────────────────────────────
// 2) DIAGNÓSTICO OPERATIVO
// ────────────────────────────────────────────────
export interface PfgDiagnosticoOperativo {
  dolorRetroPeripatelar: boolean;
  dolorConSentadilla: boolean;
  dolorConOtraCargaFlexion: boolean;
  otraCargaFlexionDetalle: PfgTareaCargaFlexion[];
  otrasCausasPrincipalesDescartadas: boolean;
  compatibleDolorPatelofemoral: boolean;
  causasAlternativas: PfgCausaAlternativa[];
  observacionesClinicas: string;
}

export type PfgTareaCargaFlexion =
  | 'bajar_escaleras'
  | 'subir_escaleras'
  | 'step_down'
  | 'sentado_prolongado'
  | 'correr'
  | 'saltar';

export interface PfgCausaAlternativa {
  nombre: string;
  estado: 'descartada' | 'sospechada' | 'no_evaluada';
}

// ────────────────────────────────────────────────
// 3) CLASIFICACIÓN CLÍNICA
// ────────────────────────────────────────────────
export interface PfgClasificacionClinica {
  sobrecargaSobreuso: boolean;
  deficitRendimientoMuscular: boolean;
  deficitControlMovimiento: boolean;
  deficitMovilidad: boolean;
  comentarioClinico: string;
}

// ────────────────────────────────────────────────
// 4) EVALUACIÓN POR CORTE TEMPORAL
// ────────────────────────────────────────────────
export type PfgSemana = 0 | 5 | 10;

export interface PfgEvaluacion {
  id: string;
  deportistaId: string;
  semana: PfgSemana;
  fecha: string;
  evaluador: string;

  kujala: number | null;
  enaReposo: number | null;

  stepDown: PfgStepDown;

  fuerzaExtensionRodilla: PfgPruebaFuerza;
  fuerzaAbduccionCadera: PfgPruebaFuerza;
  fuerzaRotacionExternaCadera: PfgPruebaFuerza;

  algometria: PfgAlgometria | null;

  validezTest: 'valido' | 'parcialmente_valido' | 'invalido';
  motivoInvalidez?: string;

  observaciones: string;

  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────
// 4.1) STEP-DOWN (Tarea Provocativa Fija)
// ────────────────────────────────────────────────
export interface PfgStepDown {
  peorDolorENA: number | null;
  calidadMovimiento: 'buena' | 'aceptable' | 'deficiente' | null;
  observaciones: string;
}

// ────────────────────────────────────────────────
// 4.2) PRUEBA DE FUERZA ISOMÉTRICA
// ────────────────────────────────────────────────
export interface PfgPruebaFuerza {
  intento1: number | null;
  intento2: number | null;
  intento3: number | null;
  mejorValor: number | null;
  unidad: 'N' | 'kg' | 'lbs';
  torqueNm?: number | null;
  notas: string;
}

// ────────────────────────────────────────────────
// 4.3) ALGOMETRÍA
// ────────────────────────────────────────────────
export interface PfgAlgometria {
  zonaAnatomica: string;
  intento1: number | null;
  intento2: number | null;
  intento3: number | null;
  valorFinal: number | null;
  unidad: 'kPa' | 'kg_cm2';
}
