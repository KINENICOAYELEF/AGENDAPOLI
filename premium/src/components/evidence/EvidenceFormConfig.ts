import { ArticleCategory } from "@/types/evidence";

export interface PerlaConfig {
    id: string; icon: string; label: string; prompt: string; placeholder: string; required: boolean;
}

export interface CategoryFormConfig {
    label: string; icon: string; color: string;
    contextLabel: string; contextPlaceholder: string; contextHelp: string;
    studyDesigns: string[];
    findingLabel: string; findingPlaceholder: string; findingHelp: string;
    methodLabel: string; methodPlaceholder: string;
    summaryPrompt: string; summaryPlaceholder: string;
    perlas: PerlaConfig[];
    limitPrompt: string; limitPlaceholder: string;
    hasDoseFields?: boolean;
}

const COMMON_DESIGNS = [
    "Revisión Sistemática / Meta-análisis", "Ensayo Clínico Aleatorizado (RCT)",
    "Estudio de Cohorte", "Estudio de Casos y Controles", "Estudio Transversal",
    "Serie de Casos / Reporte de Caso", "Revisión Narrativa", "Estudio Cualitativo",
    "Guía de Práctica Clínica", "Estudio de Validez Diagnóstica", "Otro / No aplica"
];

export const CATEGORY_CONFIGS: Record<ArticleCategory, CategoryFormConfig> = {
    'Clínica': {
        label: 'Clínica (Evaluación / Tratamiento)', icon: '🏥', color: 'emerald',
        contextLabel: 'Patología o Condición (CIF)',
        contextPlaceholder: 'Ej: Tendinopatía Rotuliana, Esguince Lateral de Tobillo...',
        contextHelp: 'La condición clínica principal que aborda el artículo.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué intervención o método evaluaron?',
        findingPlaceholder: 'Ej: Compararon ejercicio isométrico vs isotónico en dolor anterior de rodilla durante 12 semanas...',
        findingHelp: 'Describe la intervención, herramienta de evaluación o protocolo clínico.',
        methodLabel: 'Resultado / Conclusión Principal',
        methodPlaceholder: 'Ej: Los isométricos redujeron el dolor agudo un 40% más que el control a las 4 semanas...',
        summaryPrompt: 'Resume el artículo en tus propias palabras (qué hicieron, qué encontraron, qué concluyen)',
        summaryPlaceholder: 'Este estudio investigó... en una muestra de... pacientes con... Los resultados mostraron que... Los autores concluyen que...',
        perlas: [
            { id: 'perla_evaluacion', icon: '🔍', label: 'Aplicación en EVALUACIÓN', prompt: '¿Cómo cambia este artículo tu forma de evaluar a un paciente con esta condición?', placeholder: 'Ahora al evaluar esta condición voy a incluir... porque el artículo demuestra que esta prueba tiene una sensibilidad de...', required: true },
            { id: 'perla_tratamiento', icon: '💊', label: 'Aplicación en TRATAMIENTO', prompt: '¿Qué harías diferente en tu plan de intervención después de leer esto?', placeholder: 'Incluiría ejercicios isométricos en la fase aguda a una dosis de... porque este estudio evidenció que...', required: true },
            { id: 'perla_paciente', icon: '🗣️', label: 'Educación al PACIENTE', prompt: '¿Qué le explicarías al paciente/usuario basándote en esta evidencia?', placeholder: 'Le explicaría que el dolor no significa daño porque... y que el ejercicio progresivo es seguro porque...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones tiene el estudio?',
        limitPlaceholder: 'El estudio fue en sedentarios (n=20), no evaluaron a largo plazo, no incluyeron deportistas...'
    },

    'Biomecánica': {
        label: 'Biomecánica', icon: '⚙️', color: 'blue',
        contextLabel: 'Movimiento o Articulación Estudiada',
        contextPlaceholder: 'Ej: Sentadilla profunda, Marcha, Lanzamiento sobre hombro...',
        contextHelp: 'El gesto motor, articulación o cadena cinética que analiza el estudio.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué variables biomecánicas midieron y cómo?',
        findingPlaceholder: 'Ej: Midieron ángulos articulares de rodilla con análisis 3D, momentos de fuerza en cadera, activación EMG de VMO y VL...',
        findingHelp: 'Las mediciones, instrumentos y análisis principales del estudio.',
        methodLabel: 'Hallazgo / Resultado Principal',
        methodPlaceholder: 'Ej: El valgo dinámico aumentó un 30% con fatiga del glúteo medio...',
        summaryPrompt: 'Resume en tus palabras: ¿qué midieron, cómo lo midieron, y qué encontraron?',
        summaryPlaceholder: 'Los autores analizaron... en una muestra de... usando... Los principales hallazgos fueron...',
        perlas: [
            { id: 'perla_evaluacion', icon: '🔍', label: 'Implicancia para EVALUACIÓN del movimiento', prompt: '¿Qué observarías diferente en tu evaluación del movimiento después de leer esto?', placeholder: 'Ahora al evaluar la sentadilla voy a fijarme en el control del valgo dinámico en los últimos 30° porque...', required: true },
            { id: 'perla_correccion', icon: '🎯', label: 'Implicancia para CORRECCIÓN / EJERCICIO', prompt: '¿Cómo modificarías la prescripción de ejercicio o la corrección del gesto?', placeholder: 'Modificaría la técnica limitando la flexión a... e incluiría fortalecimiento de... porque...', required: true },
            { id: 'perla_prevencion', icon: '🛡️', label: 'Implicancia para PREVENCIÓN', prompt: '¿Cómo usarías esta información para prevenir lesiones?', placeholder: 'Incluiría un screening de control neuromuscular en... porque los datos indican que...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones metodológicas o de transferencia tiene el estudio?',
        limitPlaceholder: 'Usaron modelo 2D, la muestra fue solo hombres adultos, condiciones de lab no replican deporte real...'
    },

    'Fisiología': {
        label: 'Fisiología / Fisiopatología', icon: '🧬', color: 'violet',
        contextLabel: 'Sistema o Proceso Fisiológico',
        contextPlaceholder: 'Ej: Hipertrofia muscular, Respuesta inflamatoria, Ciclo estiramiento-acortamiento...',
        contextHelp: 'El sistema, vía metabólica o proceso fisiológico que aborda el artículo.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué mecanismo o fenómeno explica/investiga el artículo?',
        findingPlaceholder: 'Ej: La señalización mTOR se potencia con carga mecánica + aminoácidos dentro de las 2h post ejercicio...',
        findingHelp: 'El mecanismo clave o la explicación fisiológica central.',
        methodLabel: 'Datos / Evidencia Clave',
        methodPlaceholder: 'Ej: La síntesis proteica aumentó un 25% vs control; el pico fue a las 3h post ejercicio...',
        summaryPrompt: 'Explica en tus palabras el mecanismo fisiológico que aborda el artículo',
        summaryPlaceholder: 'El artículo explica el proceso de... que funciona mediante... Los investigadores demostraron que...',
        perlas: [
            { id: 'perla_rehabilitacion', icon: '🏥', label: 'Conexión con REHABILITACIÓN', prompt: '¿Cómo conectas esta fisiología con tu toma de decisiones en rehabilitación?', placeholder: 'Entendiendo que la inflamación aguda es necesaria, yo ahora evitaría el hielo en las primeras 48h porque...', required: true },
            { id: 'perla_entrenamiento', icon: '🏋️', label: 'Conexión con ENTRENAMIENTO', prompt: '¿Cómo usarías esta información para prescribir o modificar el entrenamiento?', placeholder: 'Sabiendo que la ventana anabólica se extiende por 24h, yo programaría... y aconsejaría...', required: true },
            { id: 'perla_educacion', icon: '📚', label: 'Explicación para el PACIENTE / DEPORTISTA', prompt: '¿Cómo le explicarías este concepto de forma simple a tu paciente?', placeholder: 'Le diría que su músculo se repara mejor cuando... por eso es importante que...', required: false },
        ],
        limitPrompt: '¿Qué aspectos limitan la aplicación directa?',
        limitPlaceholder: 'Estudio in vitro / en ratones, dosis no realistas en humanos, muestra muy homogénea...'
    },

    'Neurociencia del Dolor': {
        label: 'Neurociencia del Dolor', icon: '🧠', color: 'rose',
        contextLabel: 'Tipo o Mecanismo de Dolor',
        contextPlaceholder: 'Ej: Dolor nociplástico, Sensibilización central, Catastrofismo, PNE...',
        contextHelp: 'El tipo de dolor, mecanismo neurofisiológico o concepto de neurociencia abordado.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué concepto, mecanismo o intervención sobre dolor aborda el artículo?',
        findingPlaceholder: 'Ej: La educación en neurociencia del dolor (PNE) reduce el catastrofismo y mejora la función en pacientes con dolor crónico lumbar...',
        findingHelp: 'El mecanismo de dolor, la intervención educativa o el concepto neurocientífico central.',
        methodLabel: 'Resultado / Evidencia Principal',
        methodPlaceholder: 'Ej: El grupo PNE redujo catastrofismo (PCS) un 35% vs control, y mejoró la kinesiofobia (TSK) en 8 puntos...',
        summaryPrompt: 'Explica en tus palabras el concepto de dolor o mecanismo que aborda el artículo',
        summaryPlaceholder: 'El artículo explica que el dolor... funciona mediante... Los autores demuestran que... Esto es importante porque...',
        perlas: [
            { id: 'perla_explicacion', icon: '🗣️', label: 'Cómo EXPLICAS el dolor al paciente', prompt: '¿Cómo cambiarías tu forma de explicar el dolor al paciente después de leer esto?', placeholder: 'Le explicaría que el dolor no siempre significa daño tisular porque... y que su sistema nervioso puede generar dolor por... Le daría el ejemplo de...', required: true },
            { id: 'perla_evaluacion', icon: '🔍', label: 'Cómo cambia tu EVALUACIÓN del dolor', prompt: '¿Qué preguntas, escalas o pruebas agregarías a tu evaluación del dolor?', placeholder: 'Agregaría preguntas sobre calidad del sueño, estrés y catastrofismo porque... Usaría la escala... para identificar si el dolor es...', required: true },
            { id: 'perla_tratamiento', icon: '💊', label: 'Cómo cambia tu ABORDAJE terapéutico', prompt: '¿Cómo modificarías tu tratamiento sabiendo esto sobre el dolor?', placeholder: 'En vez de solo tratar el tejido, incluiría educación sobre... y exposición gradual al movimiento porque... También consideraría...', required: true },
            { id: 'perla_clasificacion', icon: '📊', label: 'Clasificación del TIPO de dolor', prompt: '¿Cómo te ayuda este artículo a distinguir entre tipos de dolor (nociceptivo, neuropático, nociplástico)?', placeholder: 'Ahora puedo identificar mejor si un dolor es nociplástico porque... a diferencia de uno nociceptivo que presenta... Los signos clave son...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones tiene el estudio o el concepto presentado?',
        limitPlaceholder: 'Los cuestionarios son auto-reportados, la educación fue en grupo (no individualizada), la muestra no incluyó dolor agudo, el seguimiento fue corto...'
    },

    'Entrenamiento': {
        label: 'Entrenamiento / Prescripción de Ejercicio', icon: '🏋️', color: 'orange',
        contextLabel: 'Tipo de Entrenamiento o Cualidad Física',
        contextPlaceholder: 'Ej: Fuerza máxima, Pliometría, HIIT, Flexibilidad, Potencia...',
        contextHelp: 'La cualidad física o método de entrenamiento principal.',
        studyDesigns: COMMON_DESIGNS,
        hasDoseFields: true,
        findingLabel: '¿Qué protocolo o método evaluaron?',
        findingPlaceholder: 'Ej: Sentadilla búlgara al 80% 1RM, 4x6 reps, 3x/sem, 8 semanas...',
        findingHelp: 'Describe el protocolo general. Detalla la dosis en los campos de abajo.',
        methodLabel: 'Resultado Principal (mejoras, adaptaciones)',
        methodPlaceholder: 'Ej: Mejoró un 15% salto vertical (CMJ) y 8% velocidad en 20m sprint...',
        summaryPrompt: 'Resume el estudio: ¿qué entrenaron, cómo, cuánto tiempo, y qué mejoras obtuvieron?',
        summaryPlaceholder: 'El estudio evaluó un programa de... en una muestra de... durante... semanas. Los resultados principales fueron...',
        perlas: [
            { id: 'perla_programacion', icon: '📋', label: 'Aplicación en PROGRAMACIÓN', prompt: '¿Cómo programarías este método? ¿En qué fase del entrenamiento lo incluirías?', placeholder: 'En un mesociclo de preparación incluiría este protocolo 2x/sem los días de fuerza porque...', required: true },
            { id: 'perla_adaptacion', icon: '🔄', label: 'ADAPTACIÓN a tu contexto', prompt: '¿Cómo lo adaptarías para tus deportistas/pacientes del polideportivo?', placeholder: 'Para un karateca adaptaría la intensidad a... porque su perfil requiere... y modificaría el volumen...', required: true },
            { id: 'perla_progresion', icon: '📈', label: 'PROGRESIÓN y monitoreo', prompt: '¿Cómo progresarías la carga y qué indicadores usarías para monitorear?', placeholder: 'Progresaría la carga un 5% semanal usando RPE como guía, monitorizaría con test de CMJ...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones tiene el protocolo o estudio para tu contexto?',
        limitPlaceholder: 'Solo probado en deportistas elite masculinos, progresión no clara, no midieron lesiones ni efectos adversos...'
    },

    'Prevención / RTS': {
        label: 'Prevención de Lesiones / Return to Sport', icon: '🛡️', color: 'cyan',
        contextLabel: 'Lesión o Condición a Prevenir / Deporte',
        contextPlaceholder: 'Ej: Lesión de LCA en fútbol femenino, Re-lesión de isquiotibiales, Tendinopatía aquílea en corredores...',
        contextHelp: 'La lesión objetivo, el programa preventivo o los criterios de Return to Sport.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué programa, protocolo o criterios evaluaron?',
        findingPlaceholder: 'Ej: FIFA 11+ aplicado 3x/sem durante temporada completa, criterios RTS basados en LSI >90% en hop tests + fuerza isocinética...',
        findingHelp: 'El programa de prevención, los criterios de RTS o los factores de riesgo identificados.',
        methodLabel: 'Resultado Principal (reducción riesgo, tasas de re-lesión)',
        methodPlaceholder: 'Ej: El programa redujo lesiones de LCA un 50% (RR=0.5, IC 0.3-0.8); los atletas con LSI<85% tuvieron 4x más riesgo de re-lesión...',
        summaryPrompt: 'Resume en tus palabras: ¿qué previenen, cómo, y cuánto reduce el riesgo?',
        summaryPlaceholder: 'El estudio evaluó un programa de prevención de... en deportistas de... Los resultados principales mostraron una reducción de...',
        perlas: [
            { id: 'perla_screening', icon: '🔍', label: 'SCREENING que implementarías', prompt: '¿Qué evaluaciones o tests de screening implementarías basándote en este artículo?', placeholder: 'Implementaría un screening pre-temporada que incluya... y repetiría cada... semanas porque el artículo muestra que...', required: true },
            { id: 'perla_programa', icon: '📋', label: 'PROGRAMA preventivo que diseñarías', prompt: '¿Cómo diseñarías un programa de prevención basándote en esta evidencia?', placeholder: 'Diseñaría un programa que incluya: calentamiento neuromuscular con... fortalecimiento de... y pliometría de... a una frecuencia de...', required: true },
            { id: 'perla_rts', icon: '🏃', label: 'Criterios de RETURN TO SPORT', prompt: '¿Qué criterios de regreso al deporte usarías basándote en este artículo?', placeholder: 'Exigiría: LSI >90% en hop tests, fuerza isocinética simétrica, completar progresión de... sin dolor, y evaluación psicológica con...', required: true },
            { id: 'perla_comunicacion', icon: '🗣️', label: 'Comunicación con CUERPO TÉCNICO', prompt: '¿Cómo comunicarías esta información al entrenador o cuerpo técnico?', placeholder: 'Le explicaría al entrenador que implementar... reduce el riesgo en un...% y que necesitamos... minutos de cada entrenamiento para...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones tiene el programa o los criterios propuestos?',
        limitPlaceholder: 'Los criterios RTS no incluyen componente psicológico, el programa fue en elite (no amateur), la adherencia fue controlada en estudio pero en la realidad...'
    },

    'Anatomía': {
        label: 'Anatomía / Morfología', icon: '🦴', color: 'pink',
        contextLabel: 'Estructura o Región Anatómica',
        contextPlaceholder: 'Ej: Ligamento cruzado anterior, Manguito rotador, Fascia plantar...',
        contextHelp: 'La estructura anatómica o región del cuerpo estudiada.',
        studyDesigns: COMMON_DESIGNS,
        findingLabel: '¿Qué aspecto anatómico describe o descubre el artículo?',
        findingPlaceholder: 'Ej: El tendón del bíceps femoral tiene variantes de inserción en el 30% de la población...',
        findingHelp: 'El hallazgo morfológico, variante o relación estructural clave.',
        methodLabel: 'Relevancia Clínica del Hallazgo',
        methodPlaceholder: 'Ej: Estas variantes podrían explicar por qué algunos pacientes no responden al protocolo estándar...',
        summaryPrompt: 'Describe en tus palabras la estructura anatómica y el hallazgo del artículo',
        summaryPlaceholder: 'El artículo estudia la anatomía de... mediante... Los autores encontraron que...',
        perlas: [
            { id: 'perla_evaluacion', icon: '🔍', label: 'Implicancia para la EVALUACIÓN', prompt: '¿Cómo cambia tu palpación, inspección o evaluación clínica?', placeholder: 'Al palpar la zona voy a considerar que la inserción puede variar y buscaré dolor en... además de...', required: true },
            { id: 'perla_tratamiento', icon: '💊', label: 'Implicancia para el TRATAMIENTO', prompt: '¿Cómo modifica esto tu abordaje terapéutico o prescripción de ejercicio?', placeholder: 'Si considero esta variante anatómica, modificaría el ángulo de... y evitaría... porque...', required: true },
            { id: 'perla_imagen', icon: '📷', label: 'Correlación con IMAGEN o DIAGNÓSTICO', prompt: '¿Cómo interpretas mejor las imágenes o hallazgos diagnósticos?', placeholder: 'Al ver una ecografía o RM de esta zona ahora buscaría... porque el artículo muestra que...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones tiene el estudio anatómico?',
        limitPlaceholder: 'Fue en cadáveres embalsamados, muestra de una sola población étnica, no evaluaron correlación con síntomas clínicos...'
    },

    'Otro': {
        label: 'Otro (Epidemiología, Salud Pública, etc.)', icon: '📊', color: 'slate',
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
        summaryPlaceholder: 'Este artículo investigó... en una población de... Los principales hallazgos fueron...',
        perlas: [
            { id: 'perla_practica', icon: '💡', label: 'Aplicación PRÁCTICA', prompt: '¿Cómo aplicarías esta información en tu práctica profesional diaria?', placeholder: 'Con esta información yo implementaría un screening de... y modificaría mi plan de prevención para incluir...', required: true },
            { id: 'perla_poblacion', icon: '👥', label: 'Aplicación a tu POBLACIÓN', prompt: '¿Cómo se aplica esto a los usuarios/deportistas con los que trabajas?', placeholder: 'En mi contexto del Polideportivo, esto significa que debería... porque la población que atiendo...', required: true },
            { id: 'perla_sistema', icon: '⚙️', label: 'Cambio en tu SISTEMA de trabajo', prompt: '¿Qué cambiarías en tu forma de organizar o sistematizar tu trabajo?', placeholder: 'Incorporaría un registro de... y crearía un protocolo de... porque los datos sugieren que...', required: false },
        ],
        limitPrompt: '¿Qué limitaciones o sesgos tiene el estudio?',
        limitPlaceholder: 'Estudio transversal (no causalidad), muestra de solo una liga/región, posible sesgo de selección...'
    }
};

// ─── AUTO-TAG GENERATOR ───
// Genera tags automáticamente sin que el estudiante sepa que es "IA"
export function generateAutoTags(article: { category: string; cif: string; population: string; finding: string; methodology: string; summary: string }, studyDesign?: string): string[] {
    const tags = new Set<string>();
    
    // Category tag
    tags.add(article.category);
    
    // CIF / Context
    if (article.cif) {
        tags.add(article.cif.trim());
        // Extract sub-terms
        article.cif.split(/[,/\-–()]/).map(t => t.trim()).filter(t => t.length > 2).forEach(t => tags.add(t));
    }
    
    // Population
    if (article.population) {
        tags.add(article.population.trim());
        article.population.split(/[,/\-–()]/).map(t => t.trim()).filter(t => t.length > 2).forEach(t => tags.add(t));
    }
    
    // Study design
    if (studyDesign && studyDesign !== 'Otro / No aplica') tags.add(studyDesign);
    
    // Extract key terms from finding and methodology (simple keyword extraction)
    const keyTerms = `${article.finding} ${article.methodology} ${article.summary}`.toLowerCase();
    const MSK_KEYWORDS = [
        'isométrico','isotónico','excéntrico','concéntrico','pliometría','HIIT','fuerza','potencia','resistencia',
        'flexibilidad','movilidad','estabilidad','control motor','propiocepción','equilibrio',
        'dolor','nociceptivo','neuropático','nociplástico','sensibilización central','catastrofismo','kinesiofobia',
        'tendinopatía','esguince','fractura','ruptura','inestabilidad','impingement','artrosis',
        'LCA','LCP','menisco','manguito rotador','aquíleo','plantar','lumbar','cervical',
        'rodilla','tobillo','hombro','cadera','codo','muñeca','columna',
        'EMG','isocinético','ecografía','resonancia','plataforma de fuerza',
        'RTS','return to sport','prevención','screening','hop test','LSI',
        'RPE','1RM','VO2','CMJ','sprint','agilidad',
        'adolescentes','adulto mayor','deportista','sedentario','mujer','hombre',
        'fútbol','karate','running','natación','voleibol','basquetbol','tenis',
    ];
    MSK_KEYWORDS.forEach(kw => { if (keyTerms.includes(kw.toLowerCase())) tags.add(kw); });
    
    return Array.from(tags).filter(t => t.length > 1).slice(0, 20);
}
