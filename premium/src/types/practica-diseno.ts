// ============================================================
// TIPOS – Módulo Práctica Diseño Intervención (UMCE)
// ============================================================

export interface DatosEstudianteDupla {
  estudiante1: string;
  estudiante2?: string;
  fechaJornada: string; // ISO date string
  centroAtencion: string;
}

export interface DatosUsuaria {
  nombre: string;
  edad: string;
  ocupacion: string;
  contextoAtencion: string;
  motivoConsulta: string;
}

export interface EvaluacionDiseno {
  id: string;
  nombre: string;
  razon: string;
  resultado: string;
  interpretacion: string;
}

export interface HallazgosCIF {
  estructurasCorporales: string;
  funcionesCorporales: string;
  actividades: string;
  participacion: string;
  factoresPersonales: string;
  factoresAmbientales: string;
}

export interface ObjetivoEspecificoItem {
  id: string;
  prioridad: number;
  texto: string;
}

export interface ObjetivosCIF {
  problemaPrincipal: string; // Problema kinesiológico principal (impacto biopsicosocial)
  objetivoGeneral: string;    // Meta integradora de control motor y actividad real
  especificos: ObjetivoEspecificoItem[];
}

export interface EstrategiaFittVP {
  id: string;
  nombreEstrategia: string;
  objetivoRelacionado: string; // Objetivo(s) a los que tributa
  frecuencia: string;         // F: Frecuencia (ej. 3 veces por semana)
  intensidad: string;         // I: Intensidad (ej. RPE 4-6 Borg, Talk test, etc.)
  tiempo: string;             // T: Tiempo / Duración (ej. 30 minutos de sesión / 40s de trabajo)
  tipo: string;               // T: Tipo de estímulo (ej. Ejercicio de fuerza, equilibrio, circuito motor)
  volumen: string;            // V: Volumen (ej. 3 series de 10 repeticiones, descanso 60s)
  progresion: string;         // P: Progresión y Criterios de Seguridad (ej. Aumentar reps si RPE ≤ 3, suspender si EVA > 4)
}

export interface PlanIntervencionFittVP {
  estrategias: EstrategiaFittVP[];
}

export type CalificacionPronostico = 'favorable' | 'reservado' | 'desfavorable';

export interface PronosticoIncipiente {
  calificacion: CalificacionPronostico | '';
  fundamentacion: string;
  relacionDiagnosticoEIntervencion: string;
  factorPronostico1: string;
  factorPronostico2: string;
  factorPronostico3: string;
}

export interface CasoDisenoIntervencion {
  datosUsuaria: DatosUsuaria;
  anamnesis: string;
  interpretacionAnamnesis: string;
  evaluaciones: EvaluacionDiseno[];
  hallazgo1: string;
  hallazgo2: string;
  hallazgo3: string;
  cif: HallazgosCIF;
  enunciadoDiagnostico: string; // Clínico o Situacional
  objetivos: ObjetivosCIF;
  planIntervencion: PlanIntervencionFittVP;
  pronostico: PronosticoIncipiente;
}

export type EstadoEntregaDiseno = 'entregado' | 'revisado' | 'requiere_correccion';

export interface ArchivoAdjunto {
  nombre: string;
  url: string;
  tipo?: string;
}

export interface EntregaPracticaDiseno {
  id?: string;
  estudiante: DatosEstudianteDupla;
  caso1: CasoDisenoIntervencion;
  caso2: CasoDisenoIntervencion;
  caso?: CasoDisenoIntervencion; // Retrocompatibilidad
  archivosAdjuntos?: ArchivoAdjunto[];
  estado: EstadoEntregaDiseno;
  creadoEn: string; // ISO timestamp
  enviadoEn?: string;
}

// ── Rúbrica Práctica Diseño Intervención ────────────────────

export interface PuntajesCriteriosDiseno {
  c1: number; // Requerimientos formales (1-5)
  c2: number; // Actitud, trato empático y confidencialidad (1-5)
  c3: number; // Evaluaciones desarrolladas (1-5)
  c4: number; // Objetivos de intervención acordes a CIF (1-5)
  c5: number; // Plan de intervención propuesto (1-3)
  c6: number; // Pronóstico incipiente final (1-5)
}

export interface RevisionIADiseno {
  fortalezas: string;
  errores: string;
  sugerencia: string;
  puntajesSugeridos: { c3: number; c4: number; c5: number; c6: number };
  comentarioRetroalimentacion: string;
}

export interface RevisionDocenteDiseno {
  puntajes: PuntajesCriteriosDiseno;
  comentarioDocente: string;
  notaFinal: number;
  puntajeTotal: number;
  porcentaje: number;
  aprobado: boolean;
  revisadoEn: string;
  estadoRevision: EstadoEntregaDiseno;
  revisionIA?: RevisionIADiseno;
}

export interface EntregaDisenoConRevision extends EntregaPracticaDiseno {
  revision?: RevisionDocenteDiseno;
}

// ── Helpers ─────────────────────────────────────────────────

export function calcularNotaDiseno(puntajeTotal: number): { nota: number; porcentaje: number; aprobado: boolean } {
  const MAX = 28;
  const UMBRAL = 16.8; // 60% de exigencia
  const porcentaje = Math.round((puntajeTotal / MAX) * 100);
  let nota: number;
  if (puntajeTotal < UMBRAL) {
    nota = 1 + (puntajeTotal / UMBRAL) * 3;
  } else {
    nota = 4 + ((puntajeTotal - UMBRAL) / (MAX - UMBRAL)) * 3;
  }
  nota = Math.round(nota * 10) / 10;
  // Limitar rango 1.0 - 7.0
  nota = Math.max(1.0, Math.min(7.0, nota));
  return { nota, porcentaje, aprobado: nota >= 4.0 };
}

export function estrategiaFittVacio(): EstrategiaFittVP {
  return {
    id: typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    nombreEstrategia: '',
    objetivoRelacionado: '',
    frecuencia: '',
    intensidad: '',
    tiempo: '',
    tipo: '',
    volumen: '',
    progresion: '',
  };
}

export function casoDisenoVacio(): CasoDisenoIntervencion {
  return {
    datosUsuaria: { nombre: '', edad: '', ocupacion: '', contextoAtencion: '', motivoConsulta: '' },
    anamnesis: '',
    interpretacionAnamnesis: '',
    evaluaciones: [{ id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '1', nombre: '', razon: '', resultado: '', interpretacion: '' }],
    hallazgo1: '',
    hallazgo2: '',
    hallazgo3: '',
    cif: { estructurasCorporales: '', funcionesCorporales: '', actividades: '', participacion: '', factoresPersonales: '', factoresAmbientales: '' },
    enunciadoDiagnostico: '',
    objetivos: {
      problemaPrincipal: '',
      objetivoGeneral: '',
      especificos: [
        { id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '1', prioridad: 1, texto: '' },
        { id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '2', prioridad: 2, texto: '' },
      ],
    },
    planIntervencion: {
      estrategias: [
        estrategiaFittVacio(),
      ],
    },
    pronostico: {
      calificacion: '',
      fundamentacion: '',
      relacionDiagnosticoEIntervencion: '',
      factorPronostico1: '',
      factorPronostico2: '',
      factorPronostico3: '',
    },
  };
}
