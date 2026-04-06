// ============================================================
// KUJALA AKPS — CONFIGURACIÓN DEL INSTRUMENTO
// Fuente de verdad única. NO modificar preguntas ni puntajes.
// ============================================================

export interface KujalaOption {
  value: string;
  label: string;
  score: number;
}

export interface KujalaItem {
  id: string;
  text: string;
  options: KujalaOption[];
}

export interface KujalaInstrument {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  minScore: number;
  maxScore: number;
  higherIsBetter: boolean;
  scoring: { method: 'sum'; allowPartial: false };
  items: KujalaItem[];
}

export const KUJALA_AKPS_ES: KujalaInstrument = {
  id: "kujala_akps_es",
  title: "Escala de Kujala (AKPS) - Español",
  shortLabel: "Kujala",
  description: "Cuestionario autoadministrado para dolor patelofemoral. Puntaje total 0-100. Mayor puntaje = mejor función y menos síntomas.",
  minScore: 0,
  maxScore: 100,
  higherIsBetter: true,
  scoring: {
    method: "sum",
    allowPartial: false,
  },
  items: [
    {
      id: "q1",
      text: "¿Tiene usted cojera al caminar?",
      options: [
        { value: "A", label: "No", score: 5 },
        { value: "B", label: "Leve o periódica", score: 3 },
        { value: "C", label: "Constante", score: 0 },
      ],
    },
    {
      id: "q2",
      text: "¿Puede soportar el peso del cuerpo al estar en pie?",
      options: [
        { value: "A", label: "Sí, sin dolor", score: 5 },
        { value: "B", label: "Sí, con dolor", score: 3 },
        { value: "C", label: "No, es imposible", score: 0 },
      ],
    },
    {
      id: "q3",
      text: "Podría caminar:",
      options: [
        { value: "A", label: "Una distancia ilimitada", score: 5 },
        { value: "B", label: "Más de 2 km", score: 3 },
        { value: "C", label: "Entre 1–2 km", score: 2 },
        { value: "D", label: "Usted no puede caminar", score: 0 },
      ],
    },
    {
      id: "q4",
      text: "¿Podría subir y bajar escaleras?",
      options: [
        { value: "A", label: "Sin dificultad", score: 10 },
        { value: "B", label: "Dolor leve al bajar las escaleras", score: 8 },
        { value: "C", label: "Dolor leve al subir las escaleras", score: 8 },
        { value: "D", label: "Dolor tanto al subir como al bajar", score: 5 },
        { value: "E", label: "No puede", score: 0 },
      ],
    },
    {
      id: "q5",
      text: "Al ponerse en cuclillas:",
      options: [
        { value: "A", label: "No tiene problemas", score: 5 },
        { value: "B", label: "Al realizar cuclillas repetidas veces es doloroso", score: 4 },
        { value: "C", label: "Tiene dolor cada vez que se pone en cuclillas", score: 3 },
        { value: "D", label: "Puede hacerlo si se apoya", score: 2 },
        { value: "E", label: "No puede hacerlas", score: 0 },
      ],
    },
    {
      id: "q6",
      text: "Podría correr:",
      options: [
        { value: "A", label: "Sin ninguna dificultad", score: 10 },
        { value: "B", label: "Siente dolor después de correr más de 2 km", score: 8 },
        { value: "C", label: "Siente dolor leve desde el principio", score: 6 },
        { value: "D", label: "Siente dolor severo", score: 3 },
        { value: "E", label: "No puede correr", score: 0 },
      ],
    },
    {
      id: "q7",
      text: "¿Podría saltar?",
      options: [
        { value: "A", label: "Sin dificultad", score: 10 },
        { value: "B", label: "Con ligera dificultad", score: 7 },
        { value: "C", label: "Con dolor constante", score: 2 },
        { value: "D", label: "No puede", score: 0 },
      ],
    },
    {
      id: "q8",
      text: "¿Puede permanecer sentado con las rodillas dobladas?",
      options: [
        { value: "A", label: "Sin dificultad", score: 10 },
        { value: "B", label: "Siente dolor al sentarse sólo después de hacer ejercicio", score: 8 },
        { value: "C", label: "Siente dolor constante", score: 6 },
        { value: "D", label: "Siente un dolor que le obliga a extender las rodillas", score: 4 },
        { value: "E", label: "No puede", score: 0 },
      ],
    },
    {
      id: "q9",
      text: "¿Siente dolor en la rodilla?",
      options: [
        { value: "A", label: "No", score: 10 },
        { value: "B", label: "Sí, leve y ocasional", score: 8 },
        { value: "C", label: "Sí, el dolor interfiere con el sueño", score: 6 },
        { value: "D", label: "Sí, en ocasiones severo", score: 3 },
        { value: "E", label: "Sí, constante y severo", score: 0 },
      ],
    },
    {
      id: "q10",
      text: "¿Tiene hinchazón en la rodilla?",
      options: [
        { value: "A", label: "No", score: 10 },
        { value: "B", label: "Sólo después de un esfuerzo intenso", score: 8 },
        { value: "C", label: "Sólo después de las actividades cotidianas", score: 6 },
        { value: "D", label: "Todas las noches", score: 4 },
        { value: "E", label: "Constantemente", score: 0 },
      ],
    },
    {
      id: "q11",
      text: "¿Su rótula se mueve anormalmente o es dolorosa? (Subluxaciones rotulianas)",
      options: [
        { value: "A", label: "Nunca", score: 10 },
        { value: "B", label: "De vez en cuando en las actividades deportivas", score: 6 },
        { value: "C", label: "De vez en cuando en las actividades diarias", score: 4 },
        { value: "D", label: "He tenido al menos una luxación documentada", score: 2 },
        { value: "E", label: "He tenido más de 2 luxaciones", score: 0 },
      ],
    },
    {
      id: "q12",
      text: "¿Ha perdido masa muscular (atrofia) del muslo?",
      options: [
        { value: "A", label: "No", score: 5 },
        { value: "B", label: "Un poco", score: 3 },
        { value: "C", label: "Mucha", score: 0 },
      ],
    },
    {
      id: "q13",
      text: "¿Tiene dificultad para doblar la rodilla afectada?",
      options: [
        { value: "A", label: "Ninguna", score: 5 },
        { value: "B", label: "Un poco", score: 3 },
        { value: "C", label: "Mucha", score: 0 },
      ],
    },
  ],
};
