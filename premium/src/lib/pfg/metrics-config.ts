// ============================================================
// PFG — CONFIGURACIÓN CENTRAL DE MÉTRICAS
// Toda la parametrización del módulo vive aquí.
// Los componentes leen de esta config, NO hardcodean valores.
// ============================================================

export interface PfgMetricDef {
  key: string;
  label: string;
  labelCorto: string;
  unit: string;
  range: [number, number];
  higherIsBetter: boolean;
  mcid?: number;
  description: string;
  colorNivo: string;
  onlySemanas?: number[];
}

export const PFG_METRICS: Record<string, PfgMetricDef> = {
  kujala: {
    key: 'kujala',
    label: 'Kujala (Función)',
    labelCorto: 'Función',
    unit: 'puntos',
    range: [0, 100],
    higherIsBetter: true,
    mcid: 10,
    description: 'Escala de Kujala para función de rodilla anterior',
    colorNivo: '#10b981',
  },
  enaReposo: {
    key: 'enaReposo',
    label: 'Dolor en Reposo',
    labelCorto: 'Reposo',
    unit: 'ENA 0-10',
    range: [0, 10],
    higherIsBetter: false,
    mcid: 2,
    description: 'Escala Numérica Análoga en reposo',
    colorNivo: '#ef4444',
  },
  enaStepDown: {
    key: 'enaStepDown',
    label: 'Dolor Step-Down',
    labelCorto: 'Step-Down',
    unit: 'ENA 0-10',
    range: [0, 10],
    higherIsBetter: false,
    mcid: 2,
    description: 'Peor dolor en step-down 20cm, 5 reps',
    colorNivo: '#f97316',
  },
  fuerzaExtRodilla: {
    key: 'fuerzaExtRodilla',
    label: 'Fuerza Ext. Rodilla',
    labelCorto: 'F. Rodilla',
    unit: 'N',
    range: [0, 600],
    higherIsBetter: true,
    description: 'Isometría máx extensión rodilla (sedente 90°/90°)',
    colorNivo: '#6366f1',
  },
  fuerzaAbdCadera: {
    key: 'fuerzaAbdCadera',
    label: 'Fuerza Abd. Cadera',
    labelCorto: 'F. Abd. Cadera',
    unit: 'N',
    range: [0, 400],
    higherIsBetter: true,
    description: 'Isometría máx abducción cadera (supino)',
    colorNivo: '#8b5cf6',
  },
  fuerzaReCadera: {
    key: 'fuerzaReCadera',
    label: 'Fuerza RE Cadera',
    labelCorto: 'F. RE Cadera',
    unit: 'N',
    range: [0, 400],
    higherIsBetter: true,
    description: 'Isometría máx rotación externa cadera (prono 90° rodilla)',
    colorNivo: '#a855f7',
  },
  algometria: {
    key: 'algometria',
    label: 'Algometría (PPT)',
    labelCorto: 'PPT',
    unit: 'kPa',
    range: [0, 1200],
    higherIsBetter: true,
    onlySemanas: [0, 10],
    description: 'Umbral de dolor a presión local',
    colorNivo: '#14b8a6',
  },
};

export const PFG_METRIC_KEYS = Object.keys(PFG_METRICS);

export const PFG_CAUSAS_ALTERNATIVAS_PREDEFINIDAS: string[] = [
  'Tendinopatía patelar predominante',
  'Inestabilidad patelar / luxación / subluxación',
  'Osgood-Schlatter',
  'Sinding-Larsen-Johansson',
  'Lesión meniscal relevante',
  'Lesión ligamentaria relevante',
  'Patología tibiofemoral predominante',
  'Dolor referido desde cadera',
  'Dolor referido desde columna',
  'Otra causa relevante',
];

export const PFG_TAREAS_CARGA_FLEXION = [
  { key: 'bajar_escaleras' as const, label: 'Bajar escaleras' },
  { key: 'subir_escaleras' as const, label: 'Subir escaleras' },
  { key: 'step_down' as const, label: 'Step-down' },
  { key: 'sentado_prolongado' as const, label: 'Sentado prolongadamente' },
  { key: 'correr' as const, label: 'Correr' },
  { key: 'saltar' as const, label: 'Saltar' },
];

export const PFG_DOMINIOS_CLASIFICACION = [
  {
    key: 'sobrecargaSobreuso' as const,
    label: 'Sobrecarga / Sobreuso',
    color: '#f97316',
    bgTw: 'bg-orange-100',
    textTw: 'text-orange-700',
    borderTw: 'border-orange-300',
    icon: '🔥',
    definicion:
      'Historia de aumento de carga, volumen, frecuencia, intensidad o exposición. El cuadro se explica principalmente por sobrecarga relativa del tejido. No necesariamente predomina un gran déficit mecánico medible.',
  },
  {
    key: 'deficitRendimientoMuscular' as const,
    label: 'Déficit de Rendimiento Muscular',
    color: '#ef4444',
    bgTw: 'bg-red-100',
    textTw: 'text-red-700',
    borderTw: 'border-red-300',
    icon: '💪',
    definicion:
      'Predominan déficits de fuerza isométrica de cuádriceps y/o musculatura proximal de cadera. Debe apoyarse en las evaluaciones de fuerza.',
  },
  {
    key: 'deficitControlMovimiento' as const,
    label: 'Déficit de Control del Movimiento',
    color: '#8b5cf6',
    bgTw: 'bg-violet-100',
    textTw: 'text-violet-700',
    borderTw: 'border-violet-300',
    icon: '🎯',
    definicion:
      'Predominan alteraciones observables del movimiento en tareas funcionales (step-down, sentadilla, tarea unilateral). NO implica automáticamente que "valgo dinámico = causa".',
  },
  {
    key: 'deficitMovilidad' as const,
    label: 'Déficit de Movilidad',
    color: '#3b82f6',
    bgTw: 'bg-blue-100',
    textTw: 'text-blue-700',
    borderTw: 'border-blue-300',
    icon: '🔗',
    definicion:
      'Predominan restricciones o factores de movilidad/tejidos asociados que podrían contribuir al cuadro.',
  },
];

// Posiciones detalladas para pruebas de fuerza (se muestran en el formulario)
export const PFG_POSICIONES_FUERZA = {
  extensionRodilla: {
    label: 'Extensión de Rodilla',
    posicion: 'Sedente al borde de camilla, cadera 90°, rodilla 90°',
    protocolo: '2 ensayos de práctica → 3 intentos máximos de 5 segundos → guardar mejor valor',
  },
  abduccionCadera: {
    label: 'Abducción de Cadera',
    posicion: 'Supino',
    protocolo: '2 ensayos de práctica → 3 intentos máximos de 5 segundos → guardar mejor valor',
  },
  rotacionExternaCadera: {
    label: 'Rotación Externa de Cadera',
    posicion: 'Prono con rodilla a 90°',
    protocolo: '2 ensayos de práctica → 3 intentos máximos de 5 segundos → guardar mejor valor',
  },
};

// ── VALORES DE REFERENCIA PARA RADAR (estilo FIFA) ─────────────
// Estos valores representan el "100%" en cada eje del radar.
// AJÚSTALOS según tu dispositivo, posición y población.
//
// Contexto clínico (HHD isometría, adolescentes karatekas 14-18 años):
// - Ext. Rodilla (sedente 90/90): rango típico HHD 150-400N según dispositivo.
//   Con dinamómetro manual: ~200-300N. Con dispositivo fijo: puede ser mayor.
// - Abd. Cadera (supino): rango típico ~100-250N.
// - RE Cadera (prono 90° rodilla): rango típico ~80-180N.
// - Promedio cadera para radar: usa media entre abd y RE.
//
// SI USAS KILOS en vez de Newtons → divide estos valores por 9.81
// Ej: 300N ≈ 30.6 kg → si mides en kg, pon refFuerzaRodilla = 30
export const PFG_RADAR_REFS = {
  // 100% en el radar = valor de corte para "excelente" en tu población
  refKujala: 100,           // máximo teórico
  refEnaReposo: 10,         // invertido: 0 dolor = 100%
  refEnaStepDown: 10,       // invertido: 0 dolor = 100%
  refFuerzaRodilla: 300,    // N — ajustar según dispositivo
  refFuerzaCadera: 200,     // N — promedio abd+RE, ajustar según dispositivo
  refControl: 100,          // calidad movimiento: buena=100, aceptable=60, deficiente=20
};

