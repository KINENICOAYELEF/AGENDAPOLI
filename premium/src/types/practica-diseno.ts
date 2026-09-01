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
  dimensionCIF: string; // "Funciones y Estructuras" | "Actividades" | "Participación"
  texto: string;
}

export interface ObjetivosCIF {
  problemaPrincipal: string; // Problema kinesiológico principal a resolver
  objetivoGeneral: string;
  especificos: ObjetivoEspecificoItem[];
}

export interface DetalleDosificacionFITT {
  tecnicaModalidad: string;
  objetivoRelacionado: string;
  frecuencia: string;    // Ej: 3 veces por semana / 2 veces al día
  intensidad: string;    // Ej: RPE 4-6 Borg / 60% 1RM / Rango protegido
  volumenTiempo: string; // Ej: 3 series x 10 reps, 60s descanso / 20 min continuos
  tipoEjercicio: string; // Ej: Isométrico, concéntrico, tarea global, circuito
  progresionSeguridad: string; // Ej: Aumentar 1 serie al completar con RPE < 5, detener si EVA > 4
}

export interface EstrategiasCIF {
  estructurasFunciones: DetalleDosificacionFITT;
  actividades: DetalleDosificacionFITT;
  participacion: DetalleDosificacionFITT;
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
  planIntervencion: EstrategiasCIF;
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
  caso: CasoDisenoIntervencion;
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

export function dosificacionVacia(): DetalleDosificacionFITT {
  return {
    tecnicaModalidad: '',
    objetivoRelacionado: '',
    frecuencia: '',
    intensidad: '',
    volumenTiempo: '',
    tipoEjercicio: '',
    progresionSeguridad: '',
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
        { id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '1', prioridad: 1, dimensionCIF: 'Funciones y Estructuras', texto: '' },
        { id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '2', prioridad: 2, dimensionCIF: 'Actividades', texto: '' },
        { id: typeof crypto !== 'undefined' ? crypto.randomUUID() : '3', prioridad: 3, dimensionCIF: 'Participación', texto: '' },
      ],
    },
    planIntervencion: {
      estructurasFunciones: dosificacionVacia(),
      actividades: dosificacionVacia(),
      participacion: dosificacionVacia(),
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
