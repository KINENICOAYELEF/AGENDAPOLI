export const codeToHumanMap: Record<string, string> = {
    // Sleep
    "poor": "Mala / Pobre",
    "ok": "Regular / OK",
    "good": "Buena / Reparadora",

    // Stress / Mood
    "high": "Alto",
    "med": "Medio",
    "low": "Bajo",

    // Activity Levels
    "level_1": "Sedentario",
    "level_2": "Ocasional",
    "level_3": "Amateur / Recreativo",
    "level_4": "Amateur Competitivo",
    "level_5": "Profesional",
    "level_6": "Élite",

    // Occupations & Logistics (from checkboxes or enums)
    "tiempo": "Barrera: Falta de tiempo",
    "transporte": "Barrera: Transporte difícil u horarios",
    "dinero": "Barrera: Factor económico",
    "turnos": "Barrera: Turnos rotativos o extenuantes",
    "distancia": "Barrera: Distancia / Lejanía",
    "apoyo": "Barrera: Falta de red de apoyo",
    "otra": "Otra barrera",
    
    // Matriz de Carga Laboral
    "bajo": "Bajo / Nulo",
    "medio": "Medio / Mixto",
    "alto": "Alto / Prolongado",
    "no": "No / Nada",
    "ocasional": "Ocasional Liviano",
    "frecuente_pesado": "Frecuente Pesado",
    "ms_sup": "MMSS (Teclado/Fábrica)",
    "ms_inf": "MMII",

    // Turnos
    "diurna_fija": "Diurna Fija",
    "turnos_rotativos": "Turnos Rotativos (Día/Noche)",
    "independiente": "Flexible / Freelance",

    // Contexto Domiciliario
    "escaleras": "Barrera entorno: Escaleras",
    "traslado_largo": "Barrera entorno: Traslado largo",
    "rural": "Barrera entorno: Zona rural/lejana",
    "espacio": "Barrera entorno: Poco espacio en casa",
    "sin_implementos": "Barrera entorno: Sin implementos",
    
    // Tabaquismo
    "ex_fumador": "Ex Fumador",
    "fuma_social": "Fuma Ocasional/Social",
    "fuma_diario": "Fuma Diario",
    "1_5": "1 a 5 diarios",
    "6_10": "6 a 10 diarios",
    "mas_10": "Más de 10 diarios",
    "variable": "Variable",

    // Animo y Soporte
    "fluctuating": "Fluctuante",
    "buena": "Buena / Habitual",
    "intermitente": "Intermitente",
    "baja": "Baja / Suele abandonar",

    // General fallback for booleans/raws if needed
    "true": "Sí",
    "false": "No",

    // --- CIF / Clasificación dolor ---
    "no_concluyente": "No concluyente",
    "nociceptivo": "Nociceptivo",
    "neuropático": "Neuropático",
    "nociplástico": "Nociplástico",
    "mixto": "Mixto",

    // Severidades
    "leve": "Leve",
    "moderada": "Moderada",
    "severa": "Severa",
    "completa": "Completa",

    // Resultados retest
    "mejoró": "Mejoró",
    "mejoró parcialmente": "Mejoró parcialmente",
    "sin cambio": "Sin cambio",
    "empeoró": "Empeoró",
    "no comparable": "No comparable",

    // Confianza
    "alta": "Alta",
    "media": "Media",

    // Certeza
    "casi confirmada": "Casi confirmada",
    "probable": "Probable",
    "posible": "Posible",

    // Impacto
    "mucho": "Mucho",
    "poco": "Poco",

    // Irritabilidad / Dolor
    "nunca": "Nunca",
    "a veces": "A veces",
    "frecuente": "Frecuente",
    "siempre": "Siempre",

    // Extensión / Irradiación
    "local": "Local",
    "regional": "Regional",
    "distal": "Distal",
    "referido": "Referido",
    "radicular": "Radicular",

    // Patrón temporal
    "constante (24/7)": "Constante (24/7)",
    "solo al mover": "Solo al mover",

    // Inicio
    "súbito": "Súbito",
    "gradual": "Gradual",

    // Curso
    "mejorando": "Mejorando",
    "estable": "Estable",
    "empeorando": "Empeorando",
    "fluctuante": "Fluctuante",

    // End Feel ROM
    "normal": "Normal",
    "firme": "Firme",
    "duro": "Duro",
    "blando": "Blando",
    "vacío": "Vacío (por dolor)",
    "espasmo": "Espasmo",

    // MRC Grades
    "0 - nulo": "0 — Nulo",
    "1 - vestigio": "1 — Vestigio",
    "2 - pobre": "2 — Pobre",
    "3 - regular": "3 — Regular",
    "4 - bueno": "4 — Bueno",
    "5 - normal": "5 — Normal",

    // Neuro
    "positivo": "Positivo (+)",
    "negativo": "Negativo (−)",
    "dudoso": "Dudoso (?)",
    "no evaluado": "No evaluado",
    "selecciona...": "",

    // Deporte
    "recreativo": "Recreativo",
    "amateur": "Amateur",
    "semipro": "Semi-profesional",
    "pro": "Profesional",
    "competitivo": "Competitivo",
    "elite": "Élite",

    // Triage
    "verde": "Verde ✅",
    "amarillo": "Amarillo ⚠️",
    "rojo": "Rojo 🚩",

    // Objectives
    "activo": "Activo",
    "pausado": "Pausado",
    "logrado": "Logrado",
    "completado": "Completado",

    // Draft/Closed
    "draft": "Borrador",
    "closed": "Cerrada",
    "open": "Abierta",

    // Lateralidad
    "derecho": "Derecho",
    "izquierdo": "Izquierdo",
    "bilateral": "Bilateral",
    "n/a": "No aplica",
};

/**
 * Mapa de claves de campo técnicas → nombres legibles en español.
 * Se usa en StructuredDataRenderer y P2ExamRenderer.
 */
export const fieldLabelMap: Record<string, string> = {
    // P1 Anamnesis
    foco_principal: "Foco Principal",
    queja_prioritaria: "Queja Prioritaria",
    actividad_indice: "Actividad Índice",
    antiguedad_inicio: "Antigüedad / Inicio",
    localizacion_extension: "Localización y Extensión",
    irradiacion_referencia: "Irradiación / Referencia",
    caracter_naturaleza: "Carácter / Naturaleza",
    caracter_naturaleza_descriptores: "Naturaleza del Síntoma",
    intensidad_actual: "Intensidad Actual",
    intensidad_peor_24h: "Peor en 24h",
    intensidad_mejor_24h: "Mejor en 24h",
    en_actividad_indice: "En Actividad Índice",
    atenuantes: "Atenuantes",
    agravantes: "Agravantes",
    historia_mecanismo: "Historia / Mecanismo",
    irritabilidad_global: "Irritabilidad Global",
    facilidad_provocacion: "Facilidad de Provocación",
    momento_aparicion: "Momento de Aparición",
    tiempo_a_calmarse: "Tiempo a Calmarse",
    after_efecto: "Efecto Posterior",
    severidad: "Severidad",
    naturaleza_sugerida: "Naturaleza Sugerida",
    etapa: "Etapa",

    // P1 Experiencia
    motivo_en_palabras: "Motivo (en palabras)",
    objetivo_expectativa_plazo: "Objetivo / Expectativa / Plazo",
    comportamiento_24h: "Comportamiento 24h",
    limitaciones_funcionales: "Limitaciones Funcionales",
    capacidad_percibida: "Capacidad Percibida",
    manejo_previo_y_respuesta: "Manejo Previo y Respuesta",
    seguridad_mencionada_en_relato: "Seguridad Mencionada",
    banderas_amarillas_orientativas: "Banderas Amarillas",
    banderas_rojas: "Banderas Rojas",

    // P1 AI Structured
    motivo_consulta_breve: "Motivo de Consulta",
    objetivo_expectativa_breve: "Objetivo / Expectativa",
    resumen_clinico_breve: "Resumen Clínico",
    alicia_core: "Exploración del Síntoma (ALICIA)",
    sins_core: "Severidad / Irritabilidad (SINS)",
    hipotesis_orientativas: "Hipótesis Orientativas",
    factores_contextuales_clave: "Factores Contextuales Clave",
    factores_contextuales: "Factores Contextuales",

    // P1.5 Contexto Basal
    contexto_ocupacional: "Contexto Ocupacional",
    ocupacion_principal: "Ocupación Principal",
    deporte_actividad_basal: "Deporte / Actividad",
    actividad_deporte_central: "Actividad / Deporte Central",
    nivel_practica_actual: "Nivel de Práctica",
    calidad_sueno: "Calidad de Sueño",
    estres_basal: "Estrés Basal",
    biopsicosocial_habitos: "Hábitos Biopsicosociales",
    antecedentes_msk: "Antecedentes Musculoesqueléticos",
    lesiones_previas: "Lesiones Previas",
    cirugias_previas: "Cirugías Previas",
    barreras_logisticas_adherencia: "Barreras Logísticas",

    // P2 Examen Físico
    observacionInicialConfig: "Observación Inicial",
    romAnaliticoConfig: "ROM Analítico",
    fuerzaCargaConfig: "Fuerza y Carga",
    palpacionConfig: "Palpación",
    neuroVascularConfig: "Neurovascular",
    controlMotorConfig: "Control Motor",
    ortopedicasConfig: "Pruebas Ortopédicas Especiales",
    funcionalesConfig: "Pruebas Funcionales",
    retestConfig: "Retest / Confirmación",
    medidasComplementariasConfig: "Medidas Complementarias",
    posturaChips: "Hallazgos Posturales",
    marchaChips: "Hallazgos de Marcha",
    movLibreChips: "Movimiento Libre",
    postureAlignment: "Alineación Postural",
    gaitBasicGesture: "Gesto de Marcha",
    movimientoObservadoHoy: "Movimiento Observado Hoy",
    romRangeRows: "Rangos de Movimiento",
    musclePerformanceRows: "Rendimiento Muscular",
    neuroRows: "Evaluación Neurológica",
    specialTestsRows: "Pruebas Ortopédicas",
    tareaIndice: "Tarea Índice",
    resultadoPost: "Resultado Post-Test",
    intervencion: "Intervención Aplicada",
    comentario: "Comentario Clínico",
    retestGesture: "Gesto de Retest",

    // P2 Campos de texto
    observation: "Observación",
    analyticRom: "ROM Analítico",
    strengthAndLoad: "Fuerza y Carga",
    palpation: "Palpación",
    neuroVascular: "Neurovascular",
    motorControl: "Control Motor",
    orthopedicTestsText: "Pruebas Ortopédicas",
    functionalTests: "Pruebas Funcionales",
    retest: "Retest",
    complementary: "Complementario",
    posture: "Postura",
    specialTestsText: "Pruebas Especiales",
    functionalTestsText: "Pruebas Funcionales",
    palpationDetails: "Detalles Palpación",
    retestNotes: "Notas Retest",

    // P2 Medidas complementarias
    peso: "Peso",
    talla: "Talla",
    imc: "IMC",
    perimetroEdema: "Perímetro / Edema",
    otraMedida: "Otra Medida",
    pa: "Presión Arterial",
    fc: "Frecuencia Cardíaca",
    satO2: "Saturación O₂",
    fovea: "Fóvea (Edema)",
    signosVitalesActivos: "Signos Vitales",

    // P3 Síntesis CIF
    clasificacion_dolor: "Clasificación del Dolor",
    categoria: "Categoría",
    categoria_seleccionada: "Categoría Seleccionada",
    subtipos: "Subtipos",
    subtipos_seleccionados: "Subtipos Seleccionados",
    subtipo_seleccionado: "Subtipo Seleccionado",
    subtipo_manual: "Subtipo Manual",
    fundamento: "Fundamento",
    fundamento_breve: "Fundamento Breve",
    apoyo: "Evidencia de Apoyo",
    duda_mezcla: "Elementos de Duda",
    conclusion: "Conclusión",
    nivel_confianza: "Nivel de Confianza",

    sistema_y_estructuras: "Sistema y Estructuras",
    sistemas_involucrados: "Sistemas Involucrados",
    sistemas_principales: "Sistemas Principales",
    estructuras_principales: "Estructuras Principales",
    estructuras_secundarias: "Estructuras Secundarias",
    estructuras_mas_afectan: "Estructuras Más Afectadas",
    asociadas_moduladoras: "Asociadas / Moduladoras",

    alteraciones_detectadas: "Alteraciones Detectadas",
    funcionales: "Funcionales",
    estructurales: "Estructurales",
    funcion_disfuncion: "Función / Disfunción",
    alteracion: "Alteración",
    estructura: "Estructura",
    certeza: "Certeza",
    impacto_caso: "Impacto en el Caso",
    dominio_sugerido: "Dominio Sugerido",

    actividad_y_participacion: "Actividad y Participación",
    limitaciones_directas: "Limitaciones Directas",
    restricciones_sociales: "Restricciones Sociales",
    restricciones_participacion: "Restricciones de Participación",
    texto: "Descripción",
    detalle: "Detalle",

    factores_biopsicosociales: "Factores Biopsicosociales",
    factores_personales_positivos: "Factores Personales Positivos",
    factores_personales_negativos: "Factores Personales Negativos",
    facilitadores_ambientales: "Facilitadores Ambientales",
    barreras_ambientales: "Barreras Ambientales",
    factores_clinicos_moduladores: "Factores Clínicos Moduladores",
    observaciones_bps_integradas: "Observaciones BPS Integradas",

    // P4 Plan
    diagnostico_kinesiologico_narrativo: "Diagnóstico Kinesiológico",
    pronostico_biopsicosocial: "Pronóstico Biopsicosocial",
    justificacion_clinica_integral: "Justificación Clínica",
    plan_maestro: "Plan Maestro",
    nombre_fase: "Fase",
    objetivo_fisiologico: "Objetivo Fisiológico",
    intervenciones: "Intervenciones",
    objetivos_smart: "Objetivos SMART",
    plazo: "Plazo",

    // Genéricos
    nombre: "Nombre",
    argumento: "Argumento",
    titulo: "Título",
    explicacion: "Explicación",
    evidencia_textual: "Evidencia Textual",
    valor: "Valor",
    origen: "Origen",
    por_que: "Por Qué",
    paso: "Paso",
    sugerido_desde: "Sugerido Desde",
    objetivo: "Objetivo",
    razon: "Razón",
    prioridad: "Prioridad",
    tipo: "Tipo",
    label: "Etiqueta",
    notes: "Notas",
    side: "Lado",
    movement: "Movimiento",
    action: "Acción",
    test: "Test",
    finding: "Hallazgo",
    painLevel: "Dolor",
    painScale: "Dolor",
    endFeel: "End Feel",
    mrcGrade: "Grado MRC",
};

/**
 * Claves técnicas / internas que NO deben mostrarse en la vista de lectura.
 */
export const hiddenKeys = new Set([
    "mostrar",
    "status",
    "completedModules",
    "autoSynthesis",
    "hipotesis_tracking",
    "bodyChartImages",
    "checklistSuggested",
    "examModality",
    "version",
    "updatedAt",
    "id",
    "jsonExtractError",
    "jsonExtractRawBackup",
    "aiSuggestionStatus",
    "lastSuggestedAt",
    "enabled",
    "inputHash",
    "lastRunAt",
    "errors",
    "lastEndpointCalled",
    "aiCache",
    "aiOutputs",
    "ai",
    "timer",
    "audit",
    "year",
    "procesoId",
    "usuariaId",
    "type",
    "sessionAt",
    "clinicianResponsible",
    "compact_case_package",
    "activeObjectiveSetVersionId",
]);

/**
 * Convierte un código interno a texto humano. Si no lo encuentra, asume que ya
 * está en formato humano y devuelve el mismo texto capitalizado si es posible.
 */
export function humanize(code: string | boolean | null | undefined): string {
    if (code === null || code === undefined || code === "") return "-";
    
    // Boolean directo
    if (typeof code === 'boolean') return code ? "Sí" : "No";

    const strCode = String(code);
    
    // Exact match
    if (codeToHumanMap[strCode]) {
        return codeToHumanMap[strCode];
    }
    
    // Lowercase match
    const lowerCode = strCode.toLowerCase();
    if (codeToHumanMap[lowerCode]) {
        return codeToHumanMap[lowerCode];
    }

    // snake_case → Readable: "no_concluyente" → "No concluyente"
    if (strCode.includes('_') && !strCode.includes(' ')) {
        const readable = strCode.replace(/_/g, ' ');
        // Try map again with readable form
        if (codeToHumanMap[readable.toLowerCase()]) {
            return codeToHumanMap[readable.toLowerCase()];
        }
        return readable.charAt(0).toUpperCase() + readable.slice(1);
    }

    // Return original, maybe capitalized first letter if it doesn't look like a long sentence
    if (strCode.length < 30 && !strCode.includes(" ")) {
        return strCode.charAt(0).toUpperCase() + strCode.slice(1);
    }
    
    return strCode;
}

/**
 * Convierte una clave de campo técnica (camelCase/snake_case) a un label legible.
 */
export function humanizeKey(key: string): string {
    // Primero buscar en el mapa de labels de campo
    if (fieldLabelMap[key]) {
        return fieldLabelMap[key];
    }

    // Limpiar sufijos técnicos
    let cleaned = key
        .replace(/Config$/i, '')
        .replace(/Rows$/i, '')
        .replace(/Text$/i, '')
        .replace(/Chips$/i, '');

    // snake_case → Readable
    if (cleaned.includes('_')) {
        cleaned = cleaned.replace(/_/g, ' ');
    }

    // camelCase → Readable
    cleaned = cleaned.replace(/([A-Z])/g, ' $1').trim();

    // Capitalize first letter
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
