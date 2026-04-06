// ============================================================
// PFG — CÁLCULOS Y LÓGICA DE VISUALIZACIÓN
// ============================================================

import { PfgEvaluacion, PfgDeportista, PfgSugerenciaClasificacion } from '@/types/pfg';
import { PFG_RADAR_REFS } from '@/lib/pfg/metrics-config';

export function cambioAbsoluto(anterior: number | null, actual: number | null): number | null {
  if (anterior === null || actual === null) return null;
  return actual - anterior;
}

export function cambioPorcentual(anterior: number | null, actual: number | null): number | null {
  if (anterior === null || actual === null || anterior === 0) return null;
  return ((actual - anterior) / anterior) * 100;
}

export function direccionCambio(
  cambio: number | null,
  higherIsBetter: boolean
): 'mejora' | 'empeora' | 'estable' | 'sin_dato' {
  if (cambio === null) return 'sin_dato';
  if (Math.abs(cambio) < 0.5) return 'estable';
  if (higherIsBetter) return cambio > 0 ? 'mejora' : 'empeora';
  return cambio < 0 ? 'mejora' : 'empeora';
}

export function normalizarParaRadar(
  valor: number | null,
  min: number,
  max: number,
  invertir: boolean
): number {
  if (valor === null) return 0;
  const clamped = Math.max(min, Math.min(max, valor));
  const normalized = ((clamped - min) / (max - min)) * 100;
  return Math.round(invertir ? 100 - normalized : normalized);
}

export function calcularMejorValor(
  i1: number | null,
  i2: number | null,
  i3: number | null
): number | null {
  const vals = [i1, i2, i3].filter((v): v is number => v !== null);
  return vals.length > 0 ? Math.max(...vals) : null;
}

export function extraerValorMetrica(eval_: PfgEvaluacion, metricKey: string): number | null {
  switch (metricKey) {
    case 'kujala':
      return eval_.kujala;
    case 'enaReposo':
      return eval_.enaReposo;
    case 'enaStepDown':
      return eval_.stepDown.peorDolorENA;
    case 'fuerzaExtRodilla':
      return eval_.fuerzaExtensionRodilla.mejorValor;
    case 'fuerzaAbdCadera':
      return eval_.fuerzaAbduccionCadera.mejorValor;
    case 'fuerzaReCadera':
      return eval_.fuerzaRotacionExternaCadera.mejorValor;
    case 'algometria':
      return eval_.algometria?.valorFinal ?? null;
    default:
      return null;
  }
}

export function calidadMovimientoANumero(cal: 'buena' | 'aceptable' | 'deficiente' | null): number {
  if (cal === 'buena') return 100;
  if (cal === 'aceptable') return 60;
  if (cal === 'deficiente') return 20;
  return 0;
}

// ── ESTADO GENERAL DEL DEPORTISTA ────────────────────────────
export type EstadoGeneral = 'mejorando' | 'estable' | 'revisar_carga';

export function calcularEstadoGeneral(evaluaciones: PfgEvaluacion[]): EstadoGeneral {
  if (evaluaciones.length < 2) return 'estable';
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const primera = sorted[0];
  const ultima = sorted[sorted.length - 1];

  let positivos = 0;
  let negativos = 0;

  const dk = cambioAbsoluto(primera.kujala, ultima.kujala);
  if (dk !== null && dk >= 10) positivos++;
  if (dk !== null && dk < -5) negativos++;

  const dd = cambioAbsoluto(primera.enaReposo, ultima.enaReposo);
  if (dd !== null && dd <= -2) positivos++;
  if (dd !== null && dd > 2) negativos++;

  const dsd = cambioAbsoluto(primera.stepDown.peorDolorENA, ultima.stepDown.peorDolorENA);
  if (dsd !== null && dsd <= -2) positivos++;
  if (dsd !== null && dsd > 2) negativos++;

  const df = cambioAbsoluto(primera.fuerzaExtensionRodilla.mejorValor, ultima.fuerzaExtensionRodilla.mejorValor);
  if (df !== null && df > 0) positivos++;

  const dfc = cambioAbsoluto(primera.fuerzaAbduccionCadera.mejorValor, ultima.fuerzaAbduccionCadera.mejorValor);
  if (dfc !== null && dfc > 0) positivos++;

  if (negativos >= 2) return 'revisar_carga';
  if (positivos >= 2) return 'mejorando';
  return 'estable';
}

export function mensajeProgreso(evaluaciones: PfgEvaluacion[]): {
  mensaje: string;
  tipo: 'positivo' | 'neutro' | 'atencion';
} {
  if (evaluaciones.length === 0) return { mensaje: 'Sin evaluaciones', tipo: 'neutro' };
  if (evaluaciones.length === 1) return { mensaje: 'Evaluación inicial registrada', tipo: 'neutro' };

  const estado = calcularEstadoGeneral(evaluaciones);
  switch (estado) {
    case 'mejorando':
      return { mensaje: 'Mejorando', tipo: 'positivo' };
    case 'revisar_carga':
      return { mensaje: 'Revisar carga y síntomas', tipo: 'atencion' };
    default:
      return { mensaje: 'Estable', tipo: 'neutro' };
  }
}

// ── MOTOR DE SUGERENCIAS DE CLASIFICACIÓN ────────────────────

export function generarSugerenciasClasificacion(
  deportista: PfgDeportista,
  evaluaciones: PfgEvaluacion[]
): PfgSugerenciaClasificacion {
  const s0 = evaluaciones.find((e) => e.semana === 0) || null;

  // 1) Sobrecarga/sobreuso: historia de aumento de carga
  const historiaCarga = (deportista.historiaCargaReciente || '').trim().toLowerCase();
  const palabrasClave = ['aumento', 'subió', 'más', 'incremento', 'carga', 'volumen', 'frecuencia', 'intensidad', 'torneo', 'competencia', 'doble jornada'];
  const hitsCarga = palabrasClave.filter((p) => historiaCarga.includes(p)).length;
  const sobrecarga = {
    sugerida: hitsCarga >= 2 || historiaCarga.length > 20,
    confianza: (hitsCarga >= 3 ? 'fuerte' : hitsCarga >= 1 ? 'debil' : 'ninguna') as 'fuerte' | 'debil' | 'ninguna',
    motivo: hitsCarga > 0
      ? `Historia menciona: ${palabrasClave.filter((p) => historiaCarga.includes(p)).join(', ')}`
      : 'Sin historia de aumento de carga registrada',
  };

  // 2) Déficit rendimiento muscular: debilidad en S0
  let deficitMuscular: { sugerida: boolean; confianza: 'fuerte' | 'debil' | 'ninguna'; motivo: string } = { sugerida: false, confianza: 'ninguna', motivo: 'Sin datos S0' };
  if (s0) {
    const fRod = s0.fuerzaExtensionRodilla.mejorValor;
    const fAbd = s0.fuerzaAbduccionCadera.mejorValor;
    const fRe = s0.fuerzaRotacionExternaCadera.mejorValor;
    // Valores bajos relativos (umbrales orientativos para adolescentes)
    const rodillaBaja = fRod !== null && fRod < 200;
    const caderaBaja = (fAbd !== null && fAbd < 120) || (fRe !== null && fRe < 100);
    if (rodillaBaja || caderaBaja) {
      const motivos: string[] = [];
      if (rodillaBaja) motivos.push(`Ext. rodilla baja en S0: ${fRod}N`);
      if (fAbd !== null && fAbd < 120) motivos.push(`Abd. cadera baja en S0: ${fAbd}N`);
      if (fRe !== null && fRe < 100) motivos.push(`RE cadera baja en S0: ${fRe}N`);
      deficitMuscular = {
        sugerida: true,
        confianza: rodillaBaja && caderaBaja ? 'fuerte' : 'debil',
        motivo: motivos.join('; '),
      };
    } else {
      deficitMuscular = { sugerida: false, confianza: 'ninguna', motivo: 'Fuerzas S0 dentro de rango aceptable' };
    }
  }

  // 3) Déficit control movimiento: step-down calidad deficiente
  let deficitControl: { sugerida: boolean; confianza: 'fuerte' | 'debil' | 'ninguna'; motivo: string } = { sugerida: false, confianza: 'ninguna', motivo: 'Sin datos S0' };
  if (s0) {
    const cal = s0.stepDown.calidadMovimiento;
    if (cal === 'deficiente') {
      deficitControl = {
        sugerida: true,
        confianza: 'fuerte',
        motivo: 'Step-down calidad deficiente en S0',
      };
    } else if (cal === 'aceptable') {
      deficitControl = {
        sugerida: true,
        confianza: 'debil',
        motivo: 'Step-down calidad aceptable en S0 — posible alteración sutil',
      };
    } else {
      deficitControl = { sugerida: false, confianza: 'ninguna', motivo: 'Step-down con buena calidad en S0' };
    }
  }

  // 4) Déficit movilidad: SIEMPRE sugerencia débil o manual
  const deficitMovilidad = {
    sugerida: false,
    confianza: 'debil' as const,
    motivo: 'Evaluar manualmente — no hay datos objetivos suficientes para auto-calcular',
  };

  return {
    sobrecargaSobreuso: sobrecarga,
    deficitRendimientoMuscular: deficitMuscular,
    deficitControlMovimiento: deficitControl,
    deficitMovilidad: deficitMovilidad,
  };
}

// ── RADAR DATA ───────────────────────────────────────────────

export function buildRadarData(evaluaciones: PfgEvaluacion[]) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const R = PFG_RADAR_REFS; // Valores configurables en metrics-config.ts

  const axes = [
    { metric: 'Función', key: 'kujala', min: 0, max: R.refKujala, inv: false },
    { metric: 'Dolor reposo', key: 'enaReposo', min: 0, max: R.refEnaReposo, inv: true },
    { metric: 'Dolor carga', key: 'enaStepDown', min: 0, max: R.refEnaStepDown, inv: true },
    { metric: 'F. Rodilla', key: 'fuerzaExtRodilla', min: 0, max: R.refFuerzaRodilla, inv: false },
    { metric: 'F. Cadera', key: 'fuerzaCaderaAvg', min: 0, max: R.refFuerzaCadera, inv: false },
    { metric: 'Control', key: 'tolerancia', min: 0, max: R.refControl, inv: false },
  ];

  return axes.map((ax) => {
    const row: Record<string, string | number> = { metric: ax.metric };

    sorted.forEach((ev) => {
      const label = `S${ev.semana}`;
      let val: number | null;

      if (ax.key === 'fuerzaCaderaAvg') {
        const abd = ev.fuerzaAbduccionCadera.mejorValor;
        const re = ev.fuerzaRotacionExternaCadera.mejorValor;
        val = abd !== null && re !== null ? (abd + re) / 2 : abd ?? re;
      } else if (ax.key === 'tolerancia') {
        val = calidadMovimientoANumero(ev.stepDown.calidadMovimiento);
      } else {
        val = extraerValorMetrica(ev, ax.key);
      }

      row[label] = normalizarParaRadar(val, ax.min, ax.max, ax.inv);
    });

    return row;
  });
}

// ── ALERTAS ──────────────────────────────────────────────────

export interface PfgAlerta {
  tipo: 'warning' | 'error' | 'info';
  mensaje: string;
}

export function generarAlertas(
  evaluaciones: PfgEvaluacion[],
  compatiblePfp: boolean
): PfgAlerta[] {
  const alertas: PfgAlerta[] = [];
  const semanasPresentes = new Set(evaluaciones.map((e) => e.semana));

  ([0, 5, 10] as const).forEach((s) => {
    if (!semanasPresentes.has(s)) {
      alertas.push({ tipo: 'warning', mensaje: `Semana ${s} sin evaluar` });
    }
  });

  evaluaciones.forEach((ev) => {
    if (ev.validezTest === 'invalido') {
      alertas.push({
        tipo: 'error',
        mensaje: `Evaluación S${ev.semana} marcada como inválida${ev.motivoInvalidez ? ': ' + ev.motivoInvalidez : ''}`,
      });
    }
    // Per-test validity alerts
    const tests = [
      { name: 'Ext. Rodilla', t: ev.fuerzaExtensionRodilla },
      { name: 'Abd. Cadera', t: ev.fuerzaAbduccionCadera },
      { name: 'RE Cadera', t: ev.fuerzaRotacionExternaCadera },
    ];
    tests.forEach(({ name, t }) => {
      if (t.validezPrueba === 'invalido') {
        alertas.push({ tipo: 'error', mensaje: `Prueba ${name} inválida en S${ev.semana}` });
      }
      if (t.mejorValor === null) {
        alertas.push({ tipo: 'warning', mensaje: `${name} sin dato en S${ev.semana}` });
      }
    });
    if (ev.kujala === null) {
      alertas.push({ tipo: 'warning', mensaje: `Kujala no registrado en S${ev.semana}` });
    }
    if ((ev.semana === 0 || ev.semana === 10) && ev.algometria === null) {
      alertas.push({ tipo: 'warning', mensaje: `Algometría no registrada en S${ev.semana}` });
    }
  });

  if (!compatiblePfp) {
    alertas.push({ tipo: 'info', mensaje: 'No cumple criterios de compatibilidad PFP' });
  }

  return alertas;
}
