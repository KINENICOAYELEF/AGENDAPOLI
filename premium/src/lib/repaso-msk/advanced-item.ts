import type { ReviewedQuestion } from './types';

/**
 * The first content import contained sound factual anchors but many prompts
 * tested label recall ("¿qué cuadro es?").  New attempts use this clinical
 * reconstruction layer.  The original record is deliberately retained in the
 * source files so that completed historical attempts can still be audited.
 *
 * The layer is applied to every active item, not only to those whose old
 * domain was called "Reconocimiento".  Its job is intentionally narrow:
 * convert an isolated fact into a constrained decision with an uncertainty,
 * a discriminating datum and a safety/functional boundary.  It never invents
 * a diagnosis, a contraindication or a prescription for a particular person.
 */

type Lens = {
  discriminators: string[];
  boundary: string;
  function: string;
};

const LENSES: Array<[RegExp, Lens]> = [
  [/patelofemoral|patelar|patela/i, {
    discriminators: ['la localización precisa y reproducibilidad del síntoma', 'la respuesta durante tareas de compresión patelofemoral y la recuperación posterior', 'la relación entre cambio de carga, dolor focal y tolerancia a la función'],
    boundary: 'No conviertas una tarea dolorosa, una imagen ni una etiqueta previa en diagnóstico definitivo.',
    function: 'bajar escaleras, correr, saltar o frenar',
  }],
  [/menisco|bloqueo/i, {
    discriminators: ['si existe bloqueo fijo de extensión o sólo sensación transitoria', 'la combinación de mecanismo, derrame, función actual y evolución', 'los síntomas mecánicos reproducibles frente a un hallazgo aislado'],
    boundary: 'Un clic, dolor de línea articular o una resonancia no justifican por sí solos una conclusión ni una conducta invasiva.',
    function: 'caminar, girar y recuperar extensión',
  }],
  [/ligamento|lca|lcp|cruzado|colateral/i, {
    discriminators: ['el mecanismo junto con derrame precoz, laxitud comparable y función', 'la estabilidad percibida en la tarea relevante y los hallazgos asociados', 'qué dato modifica la seguridad antes de hablar de retorno'],
    boundary: 'La prueba aislada no sustituye la síntesis del mecanismo, exploración, función y posible derivación.',
    function: 'girar, desacelerar, trabajar o volver al deporte',
  }],
  [/artroplastia|posoperatorio|postoperatorio/i, {
    discriminators: ['la trayectoria entre sesiones, herida, síntomas sistémicos y función', 'la comparación con el estado previo y las restricciones comunicadas por el equipo tratante', 'si el cambio observado es esperable, estancamiento o un motivo de consulta médica'],
    boundary: 'No atribuyas automáticamente a “debilidad normal” un deterioro nuevo o una señal de infección, trombosis o complicación.',
    function: 'transferirse, caminar, subir escalones y recuperar autonomía',
  }],
  [/artrosis|glenohumeral/i, {
    discriminators: ['el patrón de síntomas, actividad significativa, comorbilidad y objetivos de la persona', 'la respuesta a una dosis conocida de actividad y la evolución funcional', 'qué hallazgo cambia una hipótesis mecánica habitual'],
    boundary: 'La radiografía y la edad describen contexto; no cuantifican por sí solas dolor, capacidad ni pronóstico individual.',
    function: 'caminar, vestirse, subir escalones o usar el brazo',
  }],
  [/lateral de cadera|glúteo|gluteo|trocant/i, {
    discriminators: ['la tolerancia a compresión lateral, carga y sueño', 'el comportamiento de síntomas al caminar, subir escalones y acostarse de lado', 'la coexistencia de dolor referido u otra fuente que cambie el plan'],
    boundary: 'Evita convertir una prueba de provocación o la sensibilidad local en una explicación única.',
    function: 'caminar, subir escaleras y dormir de lado',
  }],
  [/inguinal|fai|femoroacetabular|cadera no artrósico/i, {
    discriminators: ['la relación entre dolor, rango, tarea y carga acumulada', 'el mecanismo, síntomas asociados y hallazgos que requieren descartar otra fuente', 'qué dato de función cambia la prioridad de evaluación'],
    boundary: 'Una morfología ósea o un test positivo no bastan para atribuir causalidad ni decidir cirugía.',
    function: 'sentarse, girar, correr o cambiar de dirección',
  }],
  [/manguito|hombro congelado|inestabilidad|acromioclavicular|hombro|hombro/i, {
    discriminators: ['la combinación de patrón de movimiento, fuerza, irritabilidad y función', 'el mecanismo, síntomas neurológicos/vasculares y evolución temporal', 'qué hallazgo cambia la carga, el retest o la necesidad de derivación'],
    boundary: 'Un test especial, una imagen o el arco doloroso aislado no identifican por sí solos una estructura responsable.',
    function: 'elevar el brazo, alcanzar, cargar, vestirse o dormir',
  }],
  [/seguridad|derivación|derivacion/i, {
    discriminators: ['el cambio respecto de la presentación basal y la evolución temporal', 'la presencia de signos sistémicos, neurovasculares o deterioro desproporcionado', 'qué hallazgo supera el umbral para detener la ruta habitual'],
    boundary: 'La ausencia de un único signo no descarta una situación que requiere una red de seguridad explícita.',
    function: 'la actividad que la persona necesita recuperar',
  }],
];

const FALLBACK: Lens = {
  discriminators: ['la concordancia entre historia, examen y actividad significativa', 'la evolución con una carga conocida y el retest comparable', 'el dato que puede cambiar la prioridad de seguridad o función'],
  boundary: 'Una asociación aislada no permite cerrar el razonamiento clínico.',
  function: 'la actividad prioritaria para esa persona',
};

function lensFor(question: ReviewedQuestion) {
  const source = `${question.condition} ${question.stem}`;
  return LENSES.find(([expression]) => expression.test(source))?.[1] ?? FALLBACK;
}

function decisionFor(question: ReviewedQuestion) {
  const source = `${question.domain} ${question.objective}`.toLowerCase();
  if (/seguridad|deriv/.test(source)) return '¿Cuál alternativa establece mejor el umbral para pausar, ampliar la evaluación o derivar, sin alarmar ni normalizar una posible señal importante?';
  if (/dosi|progres|interven/.test(source)) return '¿Cuál alternativa es la decisión inicial más defendible para ajustar la carga, y qué respuesta se debe retestar antes de progresar?';
  if (/objetivo|seguimiento/.test(source)) return '¿Cuál alternativa permite convertir el objetivo funcional en una medida observable que sí puede modificar el plan?';
  if (/educa/.test(source)) return '¿Cuál alternativa comunica incertidumbre y expectativa realista sin reducir la explicación a daño estructural?';
  if (/fundamento/.test(source)) return '¿Cuál inferencia se sostiene con los datos disponibles sin confundir asociación, hallazgo anatómico y causa?';
  if (/evalua|interpret/.test(source)) return '¿Cuál alternativa prioriza el dato que más puede cambiar la hipótesis de trabajo o la decisión posterior?';
  return '¿Cuál alternativa es la más defendible como decisión provisional y qué dato posterior tendría capacidad real de hacerla cambiar?';
}

function domainFor(question: ReviewedQuestion) {
  const source = `${question.domain} ${question.objective}`.toLowerCase();
  if (/seguridad|deriv/.test(source)) return 'Seguridad y decisión clínica';
  if (/dosi|progres|interven/.test(source)) return 'Prescripción y progresión razonada';
  if (/objetivo|seguimiento/.test(source)) return 'Objetivos, medición y retest';
  if (/educa/.test(source)) return 'Educación clínica fundamentada';
  return 'Razonamiento clínico e interpretación';
}

function select<T>(values: T[], key: string) {
  let value = 0;
  for (const char of key) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return values[value % values.length];
}

function optionForDecision(option: string, isCorrect: boolean, discriminator: string, boundary: string) {
  if (isCorrect) return `${option} como hipótesis o decisión provisional, y comprobar ${discriminator} antes de cerrar el caso.`;
  return `${option}, pero sólo si la historia, el examen y el retest aportan datos concordantes; de otro modo, ${boundary.toLowerCase()}`;
}

export function reconstructAsAdvancedItem(question: ReviewedQuestion): ReviewedQuestion {
  const lens = lensFor(question);
  const discriminator = select(lens.discriminators, question.id);
  const stem = [
    question.stem.trim(),
    `El caso contiene información suficiente para orientar una hipótesis, pero no para cerrarla: la tarea significativa es ${lens.function}. Antes de atribuir el problema a una sola estructura, contrasta ${discriminator}.`,
    decisionFor(question),
  ].join('\n\n');
  const explanation = `${question.explanation.trim()} ${lens.boundary} La respuesta correcta representa la mejor decisión con la información actual; no sustituye una evaluación completa ni impide coexistencia de hallazgos.`;
  return {
    ...question,
    stem,
    domain: domainFor(question),
    objective: `Ponderar datos concordantes y discordantes para ${question.objective.charAt(0).toLowerCase()}${question.objective.slice(1)}`,
    options: question.options.map(option => ({
      ...option,
      text: optionForDecision(option.text, option.id === question.correct, discriminator, lens.boundary),
    })),
    explanation,
  };
}
