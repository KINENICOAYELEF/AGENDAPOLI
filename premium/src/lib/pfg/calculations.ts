// ============================================================
// PFG — CÁLCULOS Y LÓGICA DE VISUALIZACIÓN
// ============================================================

import { PfgEvaluacion } from '@/types/pfg';

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

export function mensajeProgreso(evaluaciones: PfgEvaluacion[]): {
  mensaje: string;
  tipo: 'positivo' | 'neutro' | 'atencion';
} {
  if (evaluaciones.length === 0) return { mensaje: 'Sin evaluaciones', tipo: 'neutro' };
  if (evaluaciones.length === 1) return { mensaje: 'Evaluación inicial registrada', tipo: 'neutro' };

  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);
  const primera = sorted[0];
  const ultima = sorted[sorted.length - 1];

  const cambioKujala = cambioAbsoluto(primera.kujala, ultima.kujala);
  const cambioDolor = cambioAbsoluto(primera.enaReposo, ultima.enaReposo);
  const cambioFuerzaRod = cambioAbsoluto(
    primera.fuerzaExtensionRodilla.mejorValor,
    ultima.fuerzaExtensionRodilla.mejorValor
  );

  const señalesPositivas: string[] = [];
  const señalesNegativas: string[] = [];

  if (cambioKujala !== null && cambioKujala >= 10) señalesPositivas.push('mejorando función');
  else if (cambioKujala !== null && cambioKujala > 0) señalesPositivas.push('función en progreso');
  if (cambioDolor !== null && cambioDolor <= -2) señalesPositivas.push('menos dolor');
  else if (cambioDolor !== null && cambioDolor < 0) señalesPositivas.push('dolor en descenso');
  if (cambioFuerzaRod !== null && cambioFuerzaRod > 0) señalesPositivas.push('fuerza en progreso');

  if (cambioKujala !== null && cambioKujala < -5) señalesNegativas.push('función descendió');
  if (cambioDolor !== null && cambioDolor > 2) señalesNegativas.push('dolor aumentó');

  if (señalesNegativas.length > 0) {
    return { mensaje: 'Revisar carga y síntomas', tipo: 'atencion' };
  }
  if (señalesPositivas.length >= 2) {
    return { mensaje: 'Mejorando', tipo: 'positivo' };
  }
  if (señalesPositivas.length === 1) {
    const msg = señalesPositivas[0];
    return { mensaje: msg.charAt(0).toUpperCase() + msg.slice(1), tipo: 'positivo' };
  }
  return { mensaje: 'Estable', tipo: 'neutro' };
}

// Construir datos para radar chart de Nivo
export function buildRadarData(evaluaciones: PfgEvaluacion[]) {
  const sorted = [...evaluaciones].sort((a, b) => a.semana - b.semana);

  const axes = [
    { metric: 'Función', key: 'kujala', min: 0, max: 100, inv: false },
    { metric: 'Dolor reposo', key: 'enaReposo', min: 0, max: 10, inv: true },
    { metric: 'Dolor step-down', key: 'enaStepDown', min: 0, max: 10, inv: true },
    { metric: 'F. Rodilla', key: 'fuerzaExtRodilla', min: 0, max: 600, inv: false },
    { metric: 'F. Cadera', key: 'fuerzaCaderaAvg', min: 0, max: 400, inv: false },
    { metric: 'Tolerancia', key: 'tolerancia', min: 0, max: 100, inv: false },
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

// Generar alertas
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

  // Semanas faltantes
  ([0, 5, 10] as const).forEach((s) => {
    if (!semanasPresentes.has(s)) {
      alertas.push({ tipo: 'warning', mensaje: `Semana ${s} sin evaluar` });
    }
  });

  // Datos por evaluación
  evaluaciones.forEach((ev) => {
    if (ev.validezTest === 'invalido') {
      alertas.push({
        tipo: 'error',
        mensaje: `Evaluación S${ev.semana} marcada como inválida${ev.motivoInvalidez ? ': ' + ev.motivoInvalidez : ''}`,
      });
    }
    if (ev.kujala === null) {
      alertas.push({ tipo: 'warning', mensaje: `Kujala no registrado en S${ev.semana}` });
    }
    if (ev.fuerzaExtensionRodilla.mejorValor === null) {
      alertas.push({ tipo: 'warning', mensaje: `Fuerza Ext. Rodilla sin dato en S${ev.semana}` });
    }
    if (ev.fuerzaAbduccionCadera.mejorValor === null) {
      alertas.push({ tipo: 'warning', mensaje: `Fuerza Abd. Cadera sin dato en S${ev.semana}` });
    }
    if (ev.fuerzaRotacionExternaCadera.mejorValor === null) {
      alertas.push({ tipo: 'warning', mensaje: `Fuerza RE Cadera sin dato en S${ev.semana}` });
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
