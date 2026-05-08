import { ArticleCategory } from "@/types/evidence";

export interface PerlaConfig {
    id: string;       // key for storing in DB
    icon: string;
    label: string;
    prompt: string;
    placeholder: string;
    required: boolean;
}

export interface CategoryFormConfig {
    label: string;
    icon: string;
    color: string;
    // Context field (replaces "Patología" — adapts per category)
    contextLabel: string;
    contextPlaceholder: string;
    contextHelp: string;
    // Study design options relevant to this category
    studyDesigns: string[];
    // Finding / main variable
    findingLabel: string;
    findingPlaceholder: string;
    findingHelp: string;
    // Methodology / Result
    methodLabel: string;
    methodPlaceholder: string;
    // Student summary prompt
    summaryPrompt: string;
    summaryPlaceholder: string;
    // MULTIPLE PERLAS (3-4 per category)
    perlas: PerlaConfig[];
    // Limitations
    limitPrompt: string;
    limitPlaceholder: string;
}

const COMMON_DESIGNS = [
    "Revisión Sistemática / Meta-análisis",
    "Ensayo Clínico Aleatorizado (RCT)",
    "Estudio de Cohorte",
    "Estudio de Casos y Controles",
    "Estudio Transversal",
    "Serie de Casos / Reporte de Caso",
    "Revisión Narrativa",
    "Estudio Cualitativo",
    "Guía de Práctica Clínica",
    "Otro / No aplica"
];

export const CATEGORY_CONFIGS: Record<ArticleCategory, CategoryFormConfig> = {
    'Clínica': {
        label: 'Clínica (Evaluación / Tratamiento)',
        icon: '🏥',
        color: 'emerald',
        contextLabel: 'Patología o Condición (CIF)',
        contextPlaceholder: 'Ej: Tendinopatía Rotuliana, Esguince Lateral de Tobillo...',
        contextHelp: 'La condición clínica principal que aborda el artículo.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué intervención o método evaluaron?',
        findingPlaceholder: 'Ej: Compararon ejercicio isométrico vs isotónico en dolor anterior de rodilla durante 12 semanas...',
        findingHelp: 'Describe brevemente la intervención, herramienta de evaluación o protocolo clínico.',
        methodLabel: 'Resultado / Conclusión Principal',
        methodPlaceholder: 'Ej: Los isométricos redujeron el dolor agudo un 40% más que el control a las 4 semanas...',
        summaryPrompt: 'Resume el artículo en tus propias palabras (qué hicieron, qué encontraron, qué concluyen)',
        summaryPlaceholder: 'Este estudio investigó... en una muestra de... pacientes con... Los resultados mostraron que... Los autores concluyen que...',
        perlas: [
            {
                id: 'perla_evaluacion',
                icon: '🔍',
                label: 'Aplicación en EVALUACIÓN',
                prompt: '¿Cómo cambia este artículo tu forma de evaluar a un paciente con esta condición?',
                placeholder: 'Ahora al evaluar esta condición voy a incluir... porque el artículo demuestra que esta prueba tiene una sensibilidad de...',
                required: true
            },
            {
                id: 'perla_tratamiento',
                icon: '💊',
                label: 'Aplicación en TRATAMIENTO',
                prompt: '¿Qué harías diferente en tu plan de intervención después de leer esto?',
                placeholder: 'Incluiría ejercicios isométricos en la fase aguda a una dosis de... porque este estudio evidenció que...',
                required: true
            },
            {
                id: 'perla_paciente',
                icon: '🗣️',
                label: 'Educación al PACIENTE',
                prompt: '¿Qué le explicarías al paciente/usuario basándote en esta evidencia?',
                placeholder: 'Le explicaría que el dolor no significa daño porque... y que el ejercicio progresivo es seguro porque este estudio mostró que...',
                required: false
            }
        ],
        limitPrompt: '¿Qué limitaciones tiene el estudio y en qué casos NO aplicarías esto?',
        limitPlaceholder: 'El estudio fue en sedentarios (n=20), no evaluaron a largo plazo, no incluyeron deportistas, la adherencia fue baja...'
    },

    'Biomecánica': {
        label: 'Biomecánica',
        icon: '⚙️',
        color: 'blue',
        contextLabel: 'Movimiento o Articulación Estudiada',
        contextPlaceholder: 'Ej: Sentadilla profunda, Marcha, Lanzamiento sobre hombro...',
        contextHelp: 'El gesto motor, articulación o cadena cinética que analiza el estudio.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué variables biomecánicas midieron y cómo?',
        findingPlaceholder: 'Ej: Midieron ángulos articulares de rodilla con análisis 3D, momentos de fuerza en cadera con plataforma de fuerza, activación EMG de VMO y VL...',
        findingHelp: 'Las mediciones, instrumentos y análisis principales del estudio.',
        methodLabel: 'Hallazgo / Resultado Principal',
        methodPlaceholder: 'Ej: El valgo dinámico aumentó un 30% con fatiga del glúteo medio; la co-contracción isquio/cuádriceps se redujo un 15%...',
        summaryPrompt: 'Resume en tus palabras: ¿qué midieron, cómo lo midieron, y qué encontraron?',
        summaryPlaceholder: 'Los autores analizaron... en una muestra de... usando... Los principales hallazgos fueron...',
        perlas: [
            {
                id: 'perla_evaluacion',
                icon: '🔍',
                label: 'Implicancia para EVALUACIÓN del movimiento',
                prompt: '¿Qué observarías diferente en tu evaluación del movimiento después de leer esto?',
                placeholder: 'Ahora al evaluar la sentadilla voy a fijarme en el control del valgo dinámico en los últimos 30° porque...',
                required: true
            },
            {
                id: 'perla_correccion',
                icon: '🎯',
                label: 'Implicancia para CORRECCIÓN / EJERCICIO',
                prompt: '¿Cómo modificarías la prescripción de ejercicio o la corrección del gesto basándote en esto?',
                placeholder: 'Modificaría la técnica de sentadilla limitando la flexión a... e incluiría fortalecimiento de... porque este estudio demostró...',
                required: true
            },
            {
                id: 'perla_prevencion',
                icon: '🛡️',
                label: 'Implicancia para PREVENCIÓN',
                prompt: '¿Cómo usarías esta información para prevenir lesiones?',
                placeholder: 'Incluiría un screening de control neuromuscular en... porque los datos indican que cuando hay déficit de... el riesgo de... aumenta...',
                required: false
            }
        ],
        limitPrompt: '¿Qué limitaciones metodológicas o de transferencia tiene el estudio?',
        limitPlaceholder: 'Usaron un modelo 2D (no captura rotaciones), la muestra fue solo de hombres adultos, las condiciones de lab no replican el deporte real...'
    },

    'Fisiología': {
        label: 'Fisiología / Fisiopatología',
        icon: '🧬',
        color: 'violet',
        contextLabel: 'Sistema o Proceso Fisiológico',
        contextPlaceholder: 'Ej: Hipertrofia muscular, Respuesta inflamatoria aguda, Ciclo estiramiento-acortamiento...',
        contextHelp: 'El sistema, vía metabólica o proceso fisiológico que aborda el artículo.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué mecanismo o fenómeno explica/investiga el artículo?',
        findingPlaceholder: 'Ej: La señalización mTOR se potencia con carga mecánica + aminoácidos esenciales dentro de las 2h post ejercicio...',
        findingHelp: 'El mecanismo clave o la explicación fisiológica central.',
        methodLabel: 'Datos / Evidencia Clave',
        methodPlaceholder: 'Ej: En el grupo con suplementación, la síntesis proteica aumentó un 25% vs control; el pico fue a las 3h post ejercicio...',
        summaryPrompt: 'Explica en tus palabras el mecanismo fisiológico que aborda el artículo',
        summaryPlaceholder: 'El artículo explica el proceso de... que funciona mediante... Los investigadores demostraron que... lo cual significa que...',
        perlas: [
            {
                id: 'perla_rehabilitacion',
                icon: '🏥',
                label: 'Conexión con REHABILITACIÓN',
                prompt: '¿Cómo conectas esta fisiología con tu toma de decisiones en rehabilitación?',
                placeholder: 'Entendiendo que la inflamación aguda es necesaria para la reparación, yo ahora evitaría el hielo en las primeras 48h porque...',
                required: true
            },
            {
                id: 'perla_entrenamiento',
                icon: '🏋️',
                label: 'Conexión con ENTRENAMIENTO',
                prompt: '¿Cómo usarías esta información para prescribir o modificar el entrenamiento?',
                placeholder: 'Sabiendo que la ventana anabólica se extiende por 24h, yo programaría... y aconsejaría la nutrición de...',
                required: true
            },
            {
                id: 'perla_educacion',
                icon: '📚',
                label: 'Explicación para el PACIENTE / DEPORTISTA',
                prompt: '¿Cómo le explicarías este concepto fisiológico a tu paciente o deportista de forma simple?',
                placeholder: 'Le diría que su músculo se repara mejor cuando... por eso es importante que... y no se preocupe si siente...',
                required: false
            }
        ],
        limitPrompt: '¿Qué aspectos del estudio limitan la aplicación directa?',
        limitPlaceholder: 'El estudio fue in vitro / en ratones, las dosis no son realistas en humanos, no controlaron la dieta, la muestra fue muy homogénea...'
    },

    'Entrenamiento': {
        label: 'Entrenamiento / Prescripción de Ejercicio',
        icon: '🏋️',
        color: 'orange',
        contextLabel: 'Tipo de Entrenamiento o Cualidad Física',
        contextPlaceholder: 'Ej: Fuerza máxima, Pliometría, HIIT, Flexibilidad, Potencia...',
        contextHelp: 'La cualidad física o método de entrenamiento principal.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué protocolo o método evaluaron? (Detalla dosis)',
        findingPlaceholder: 'Ej: 3x/semana de sentadilla búlgara al 80% 1RM, 4 series x 6 reps, descanso 3min, por 8 semanas, en deportistas sub-20...',
        findingHelp: 'Describe con precisión: series, repeticiones, intensidad, frecuencia, duración, tipo de ejercicio.',
        methodLabel: 'Resultado Principal (mejoras, adaptaciones, datos)',
        methodPlaceholder: 'Ej: El grupo experimental mejoró un 15% su salto vertical (CMJ) y un 8% la velocidad en 20m sprint; el grupo control no mejoró significativamente...',
        summaryPrompt: 'Resume el estudio: ¿qué entrenaron, cómo, cuánto tiempo, y qué mejoras obtuvieron?',
        summaryPlaceholder: 'El estudio evaluó un programa de... en una muestra de... durante... semanas. El protocolo consistía en... Los resultados principales fueron...',
        perlas: [
            {
                id: 'perla_programacion',
                icon: '📋',
                label: 'Aplicación en PROGRAMACIÓN',
                prompt: '¿Cómo programarías este método? ¿En qué fase del entrenamiento lo incluirías?',
                placeholder: 'En un mesociclo de preparación general incluiría este protocolo 2x/sem los días de fuerza porque... y lo progreSaría de...',
                required: true
            },
            {
                id: 'perla_adaptacion',
                icon: '🔄',
                label: 'ADAPTACIÓN a tu contexto',
                prompt: '¿Cómo lo adaptarías para tu tipo de usuarios (deportistas del poli, pacientes, etc.)?',
                placeholder: 'Para un karateca adaptaría la intensidad a... porque su perfil requiere... y modificaría el volumen porque...',
                required: true
            },
            {
                id: 'perla_progresion',
                icon: '📈',
                label: 'PROGRESIÓN y monitoreo',
                prompt: '¿Cómo progresarías la carga y qué indicadores usarías para monitorear?',
                placeholder: 'ProgreSaría la carga un 5% semanal usando RPE como guía, monitorizaría con test de CMJ semanal porque...',
                required: false
            }
        ],
        limitPrompt: '¿Qué limitaciones tiene el protocolo o el estudio para tu contexto?',
        limitPlaceholder: 'Solo fue probado en deportistas de elite masculinos, la progresión no está clara, no midieron lesiones ni efectos adversos, no controlaron el resto del entrenamiento...'
    },

    'Anatomía': {
        label: 'Anatomía / Morfología',
        icon: '🦴',
        color: 'pink',
        contextLabel: 'Estructura o Región Anatómica',
        contextPlaceholder: 'Ej: Ligamento cruzado anterior, Manguito rotador, Fascia plantar...',
        contextHelp: 'La estructura anatómica o región del cuerpo estudiada.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué aspecto anatómico describe o descubre el artículo?',
        findingPlaceholder: 'Ej: La inserción del tendón del bíceps femoral tiene variantes anatómicas en el 30% de la población; el ligamento anterolateral existe como estructura independiente...',
        findingHelp: 'El hallazgo morfológico, variante o relación estructural clave.',
        methodLabel: 'Relevancia Clínica del Hallazgo',
        methodPlaceholder: 'Ej: Estas variantes podrían explicar por qué algunos pacientes no responden al protocolo estándar de rehab de isquiotibiales...',
        summaryPrompt: 'Describe en tus palabras la estructura anatómica y el hallazgo del artículo',
        summaryPlaceholder: 'El artículo estudia la anatomía de... mediante... Los autores encontraron que... Esta estructura se relaciona con...',
        perlas: [
            {
                id: 'perla_evaluacion',
                icon: '🔍',
                label: 'Implicancia para la EVALUACIÓN',
                prompt: '¿Cómo cambia tu palpación, inspección o evaluación clínica sabiendo esto?',
                placeholder: 'Ahora al palpar la zona, voy a considerar que la inserción puede variar y por eso buscaré dolor en... además de...',
                required: true
            },
            {
                id: 'perla_tratamiento',
                icon: '💊',
                label: 'Implicancia para el TRATAMIENTO',
                prompt: '¿Cómo modifica esto tu abordaje terapéutico o tu prescripción de ejercicio?',
                placeholder: 'Si considero esta variante anatómica, modificaría el ángulo de... y evitaría... porque la estructura podría estar comprometida en...',
                required: true
            },
            {
                id: 'perla_imagen',
                icon: '📷',
                label: 'Correlación con IMAGEN o DIAGNÓSTICO',
                prompt: '¿Cómo interpretas mejor las imágenes o hallazgos diagnósticos con esta información?',
                placeholder: 'Al ver una ecografía o RM de esta zona, ahora buscaría... porque el artículo muestra que...',
                required: false
            }
        ],
        limitPrompt: '¿Qué limitaciones tiene el estudio anatómico?',
        limitPlaceholder: 'Fue en cadáveres embalsamados, la muestra fue de una sola población étnica, no evaluaron correlación con síntomas clínicos, no usaron imagen en vivo...'
    },

    'Otro': {
        label: 'Otro (Epidemiología, Salud Pública, etc.)',
        icon: '📊',
        color: 'slate',
        contextLabel: 'Tema o Área Principal',
        contextPlaceholder: 'Ej: Prevalencia de lesiones en fútbol juvenil, Adherencia al ejercicio...',
        contextHelp: 'El tema central que aborda el artículo.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué pregunta responde el artículo?',
        findingPlaceholder: 'Ej: ¿Cuáles son los factores de riesgo más importantes para lesión de LCA en mujeres deportistas?...',
        findingHelp: 'La pregunta de investigación o el objetivo principal.',
        methodLabel: 'Resultado / Conclusión Principal',
        methodPlaceholder: 'Ej: Los 3 factores más predictivos fueron: valgo dinámico, debilidad de glúteo medio y antecedente de lesión previa...',
        summaryPrompt: 'Resume el artículo en tus propias palabras',
        summaryPlaceholder: 'Este artículo investigó... en una población de... Los principales hallazgos fueron... La conclusión principal es...',
        perlas: [
            {
                id: 'perla_practica',
                icon: '💡',
                label: 'Aplicación PRÁCTICA',
                prompt: '¿Cómo aplicarías esta información en tu práctica profesional diaria?',
                placeholder: 'Con esta información yo implementaría un screening de... y modificaría mi plan de prevención para incluir...',
                required: true
            },
            {
                id: 'perla_poblacion',
                icon: '👥',
                label: 'Aplicación a tu POBLACIÓN',
                prompt: '¿Cómo se aplica esto a los usuarios/deportistas con los que trabajas?',
                placeholder: 'En mi contexto del Polideportivo, esto significa que debería... porque la población que atiendo tiene características similares a...',
                required: true
            },
            {
                id: 'perla_sistema',
                icon: '⚙️',
                label: 'Cambio en tu SISTEMA de trabajo',
                prompt: '¿Qué cambiarías en tu forma de organizar o sistematizar tu trabajo?',
                placeholder: 'Incorporaría un registro de... y crearía un protocolo de... porque los datos sugieren que...',
                required: false
            }
        ],
        limitPrompt: '¿Qué limitaciones o sesgos tiene el estudio?',
        limitPlaceholder: 'Fue un estudio transversal (no causalidad), la muestra fue de solo una liga/región, posible sesgo de selección, no controlaron factores como...'
    }
};
