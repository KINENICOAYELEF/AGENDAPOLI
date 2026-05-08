import { ArticleCategory } from "@/types/evidence";

export interface CategoryFormConfig {
    label: string;
    icon: string;
    color: string; // tailwind bg color
    // Field 1: Context field (replaces "Patología")
    contextLabel: string;
    contextPlaceholder: string;
    contextHelp: string;
    // Field 2: Main finding
    findingLabel: string;
    findingPlaceholder: string;
    findingHelp: string;
    // Field 3: Methodology / Design
    methodLabel: string;
    methodPlaceholder: string;
    // Perla prompt
    perlaPrompt: string;
    perlaPlaceholder: string;
    // Limitations prompt
    limitPrompt: string;
    limitPlaceholder: string;
}

export const CATEGORY_CONFIGS: Record<ArticleCategory, CategoryFormConfig> = {
    'Clínica': {
        label: 'Clínica (Evaluación / Tratamiento)',
        icon: '🏥',
        color: 'emerald',
        contextLabel: 'Patología o Condición (CIF)',
        contextPlaceholder: 'Ej: Tendinopatía Rotuliana, Esguince Lateral de Tobillo...',
        contextHelp: 'La condición clínica principal que aborda el artículo.',
        findingLabel: '¿Qué intervención o método evaluaron?',
        findingPlaceholder: 'Ej: Compararon ejercicio isométrico vs isotónico en dolor anterior de rodilla...',
        findingHelp: 'Describe brevemente la intervención o herramienta de evaluación.',
        methodLabel: 'Resultado Principal',
        methodPlaceholder: 'Ej: Los isométricos redujeron el dolor agudo un 40% más que el control...',
        perlaPrompt: '¿Cómo aplicarías este tratamiento o evaluación con tus usuarios/pacientes en la práctica real?',
        perlaPlaceholder: 'Con un deportista con dolor rotuliano agudo yo usaría isométricos de 45s x 5 series pre-entrenamiento porque este estudio demuestra que...',
        limitPrompt: '¿En qué casos NO usarías esto o qué debilidad tiene el estudio?',
        limitPlaceholder: 'El estudio fue en sedentarios, la muestra fue pequeña (n=20), no evaluaron a largo plazo...'
    },
    'Biomecánica': {
        label: 'Biomecánica',
        icon: '⚙️',
        color: 'blue',
        contextLabel: 'Movimiento o Articulación Estudiada',
        contextPlaceholder: 'Ej: Sentadilla profunda, Marcha, Lanzamiento sobre hombro...',
        contextHelp: 'El gesto motor, articulación o cadena cinética que analiza el estudio.',
        findingLabel: '¿Qué variables biomecánicas midieron?',
        findingPlaceholder: 'Ej: Ángulos articulares de rodilla, momentos de fuerza en cadera, activación EMG de VMO...',
        findingHelp: 'Las mediciones o análisis principales del estudio.',
        methodLabel: 'Hallazgo Principal',
        methodPlaceholder: 'Ej: El valgo dinámico aumentó un 30% con fatiga del glúteo medio...',
        perlaPrompt: '¿Cómo cambia esto tu forma de evaluar, corregir o prescribir movimiento?',
        perlaPlaceholder: 'Ahora al evaluar la sentadilla voy a fijarme en... y al prescribir ejercicios de rodilla voy a modificar...',
        limitPrompt: '¿Qué limitaciones metodológicas o de transferencia tiene el estudio?',
        limitPlaceholder: 'Usaron un modelo 2D que no captura rotaciones, la muestra fue solo de hombres...'
    },
    'Fisiología': {
        label: 'Fisiología / Fisiopatología',
        icon: '🧬',
        color: 'violet',
        contextLabel: 'Sistema o Proceso Fisiológico',
        contextPlaceholder: 'Ej: Ciclo de Krebs, Hipertrofia muscular, Respuesta inflamatoria aguda...',
        contextHelp: 'El sistema, vía metabólica o proceso fisiológico que aborda el artículo.',
        findingLabel: '¿Qué mecanismo o fenómeno explica el artículo?',
        findingPlaceholder: 'Ej: La señalización mTOR se potencia con carga mecánica + aminoácidos esenciales dentro de las 2h post...',
        findingHelp: 'El mecanismo clave o la explicación fisiológica central.',
        methodLabel: 'Datos o Evidencia Clave',
        methodPlaceholder: 'Ej: En el grupo con suplementación, la síntesis proteica aumentó un 25% respecto al control...',
        perlaPrompt: '¿Cómo conectas esta fisiología con tu práctica clínica o de entrenamiento?',
        perlaPlaceholder: 'Entendiendo que la inflamación aguda es necesaria para la reparación, yo ahora evitaría... y en cambio haría...',
        limitPrompt: '¿Qué aspectos del estudio limitan la aplicación directa en humanos o en tu contexto?',
        limitPlaceholder: 'El estudio fue in vitro / en ratones, las dosis usadas no son realistas en humanos...'
    },
    'Entrenamiento': {
        label: 'Entrenamiento / Prescripción de Ejercicio',
        icon: '🏋️',
        color: 'orange',
        contextLabel: 'Tipo de Entrenamiento o Cualidad Física',
        contextPlaceholder: 'Ej: Fuerza máxima, Pliometría, HIIT, Flexibilidad, Potencia...',
        contextHelp: 'La cualidad física o método de entrenamiento principal.',
        findingLabel: '¿Qué protocolo o método evaluaron?',
        findingPlaceholder: 'Ej: 3x/semana de sentadilla búlgara al 80% 1RM, 4 series x 6 reps, por 8 semanas...',
        findingHelp: 'Describe las variables de carga: series, repeticiones, intensidad, frecuencia, duración.',
        methodLabel: 'Resultado Principal (mejoras, adaptaciones)',
        methodPlaceholder: 'Ej: El grupo experimental mejoró un 15% su salto vertical y un 8% la velocidad en 20m...',
        perlaPrompt: '¿Cómo programarías este método con tus usuarios? ¿A quién se lo aplicarías y cómo?',
        perlaPlaceholder: 'A un karateca en fase de preparación general le prescribiría 3x/sem este protocolo porque...',
        limitPrompt: '¿Qué limitaciones tiene el protocolo o el estudio para tu contexto?',
        limitPlaceholder: 'Solo fue probado en deportistas de elite, la progresión no está clara, no midieron lesiones...'
    },
    'Anatomía': {
        label: 'Anatomía / Morfología',
        icon: '🦴',
        color: 'pink',
        contextLabel: 'Estructura o Región Anatómica',
        contextPlaceholder: 'Ej: Ligamento cruzado anterior, Manguito rotador, Fascia plantar...',
        contextHelp: 'La estructura anatómica o región del cuerpo estudiada.',
        findingLabel: '¿Qué aspecto anatómico describe o descubre el artículo?',
        findingPlaceholder: 'Ej: La inserción del tendón del bíceps femoral tiene variantes anatómicas en el 30% de la población...',
        findingHelp: 'El hallazgo morfológico, variante o relación estructural clave.',
        methodLabel: 'Relevancia Clínica del Hallazgo',
        methodPlaceholder: 'Ej: Estas variantes podrían explicar por qué algunos pacientes no responden al protocolo estándar...',
        perlaPrompt: '¿Cómo cambia este conocimiento anatómico tu razonamiento clínico o tu forma de evaluar?',
        perlaPlaceholder: 'Ahora al palpar la zona, voy a considerar que... y al interpretar una ecografía tendré en cuenta...',
        limitPrompt: '¿Qué limitaciones tiene el estudio anatómico?',
        limitPlaceholder: 'Fue en cadáveres, la muestra fue de población asiática, no evaluaron correlación con síntomas...'
    },
    'Otro': {
        label: 'Otro (Epidemiología, Salud Pública, etc.)',
        icon: '📊',
        color: 'slate',
        contextLabel: 'Tema o Área Principal',
        contextPlaceholder: 'Ej: Prevalencia de lesiones en fútbol juvenil, Adherencia al ejercicio...',
        contextHelp: 'El tema central que aborda el artículo.',
        findingLabel: '¿Qué pregunta responde el artículo?',
        findingPlaceholder: 'Ej: ¿Cuáles son los factores de riesgo más importantes para lesión de LCA en mujeres?...',
        findingHelp: 'La pregunta de investigación o el objetivo principal.',
        methodLabel: 'Resultado o Conclusión Principal',
        methodPlaceholder: 'Ej: Los 3 factores más predictivos fueron: valgo dinámico, debilidad de glúteo medio y antecedente previo...',
        perlaPrompt: '¿Cómo aplicarías esta información en tu práctica profesional?',
        perlaPlaceholder: 'Con esta información yo implementaría un screening de... y modificaría mi plan de prevención...',
        limitPrompt: '¿Qué limitaciones o sesgos tiene el estudio?',
        limitPlaceholder: 'Fue un estudio transversal, no se puede inferir causalidad, la muestra fue de solo una liga...'
    }
};
