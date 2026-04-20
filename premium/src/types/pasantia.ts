// ============================================================
// TIPOS – Módulo Pasantía 2º Año Kinesiología
// ============================================================

export interface DatosDupla {
  estudiante1: string;
  estudiante2: string;
  fechaJornada: string; // ISO date string
  centroAtencion?: string;
}

export interface DatosUsuaria {
  nombre: string;
  edad: string;
  ocupacion: string;
  contextoAtencion: string;
  motivoConsulta: string;
}

export interface EvaluacionSimple {
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

export interface CasoClinco {
  datosUsuaria: DatosUsuaria;
  anamnesis: string;
  interpretacionAnamnesis: string;
  evaluaciones: EvaluacionSimple[];
  hallazgo1: string;
  hallazgo2: string;
  hallazgo3: string;
  cif: HallazgosCIF;
  diagnosticoKinesiologico: string;
  autoevaluacion: {
    mayorDificultad: string;
    informacionFaltante: string;
    mejoras: string;
  };
}

export type EstadoEntrega = 'entregado' | 'revisado' | 'requiere_correccion';

export interface EntregaPasantia {
  id?: string;
  dupla: DatosDupla;
  caso1: CasoClinco;
  caso2: CasoClinco;
  estado: EstadoEntrega;
  creadoEn: string; // ISO timestamp
  enviadoEn?: string;
}

// ── Rúbrica ─────────────────────────────────────────────────

export interface PuntajesCriterios {
  c1: number; // Responsabilidad, puntualidad, uniforme (1-5)
  c2: number; // Proactividad, trato empático (1-5)
  c3: number; // Anamnesis (1-5)
  c4: number; // Evaluaciones (1-5)
  c5: number; // Tabla CIF (1-5)
  c6: number; // Diagnóstico kinesiológico (1-5)
}

export interface RevisionIAResultado {
  fortalezas: string;
  errores: string;
  sugerencia: string;
  puntajesSugeridos: { c3: number; c4: number; c5: number; c6: number };
  comentarioRetroalimentacion: string;
}

export interface RevisionDocente {
  puntajes: PuntajesCriterios;
  comentarioDocente: string;
  notaFinal: number;
  puntajeTotal: number;
  porcentaje: number;
  aprobado: boolean;
  revisadoEn: string;
  estadoRevision: EstadoEntrega;
  revisionIA?: RevisionIAResultado;
}

export interface EntregaConRevision extends EntregaPasantia {
  revision?: RevisionDocente;
}

// ── Helpers ─────────────────────────────────────────────────

export function calcularNota(puntajeTotal: number): { nota: number; porcentaje: number; aprobado: boolean } {
  const MAX = 30;
  const UMBRAL = 18; // 60%
  const porcentaje = Math.round((puntajeTotal / MAX) * 100);
  let nota: number;
  if (puntajeTotal < UMBRAL) {
    nota = 1 + (puntajeTotal / UMBRAL) * 3;
  } else {
    nota = 4 + ((puntajeTotal - UMBRAL) / (MAX - UMBRAL)) * 3;
  }
  nota = Math.round(nota * 10) / 10;
  return { nota, porcentaje, aprobado: nota >= 4.0 };
}

export function casoClincoVacio(): CasoClinco {
  return {
    datosUsuaria: { nombre: '', edad: '', ocupacion: '', contextoAtencion: '', motivoConsulta: '' },
    anamnesis: '',
    interpretacionAnamnesis: '',
    evaluaciones: [{ id: crypto.randomUUID(), nombre: '', razon: '', resultado: '', interpretacion: '' }],
    hallazgo1: '',
    hallazgo2: '',
    hallazgo3: '',
    cif: { estructurasCorporales: '', funcionesCorporales: '', actividades: '', participacion: '', factoresPersonales: '', factoresAmbientales: '' },
    diagnosticoKinesiologico: '',
    autoevaluacion: { mayorDificultad: '', informacionFaltante: '', mejoras: '' },
  };
}
