import { HIP_PRESCRIPTION_TOPICS } from './prescriptionTopics';

export interface HipTopic {
    id: string;
    nombre: string;
    categoria: 'Coxartrosis' | 'Artroplastia (PTC)' | 'Evaluación Post-Artroplastia' | 'FAI y Labrum' | 'Displasia e Inestabilidad' | 'Dolor Lateral de Cadera' | 'Dolor Inguinal y Extraarticular' | 'Geriatría y Fractura de Cadera' | 'Cadera Pediátrica y Deportiva' | 'Neuropatías Periféricas' | 'Criterios Avanzados de RTP';
    contenidoBase: string;
    preguntasEtapa2: string[];
    casoEtapa3: string;
    preguntasEtapa4: string[];
}

export const HIP_TOPICS: HipTopic[] = [
    // ────────────── CATEGORÍA 1: COXARTROSIS ──────────────
    {
        id: "c1.1",
        nombre: "1.1 — Fisiopatología articular, tejidos involucrados y fuentes reales del dolor",
        categoria: "Coxartrosis",
        contenidoBase: `
- Coxartrosis = proceso de remodelación articular complejo que involucra hueso subcondral, membrana sinovial, labrum y cápsula, no solo "desgaste de cartílago".
- El cartílago carece de inervación nociceptiva; las fuentes reales del dolor son el hueso subcondral inervado (microfracturas, edema óseo, osteofitos), la membrana sinovial (sinovitis crónica de bajo grado con liberación de IL-1β y TNF-α) y el labrum/cápsula articular.
- Discordancia clínicoradiográfica: la severidad observada en radiografías (clasificación Tonnis o Kellgren-Lawrence) no se correlaciona linealmente con la intensidad del dolor ni con la capacidad funcional.
- Sensibilización periférica y muscular: la inflamación sinovial reduce el umbral de disparo nociceptivo; el dolor genera inhibición muscular refleja en glúteo medio y mayor.
- Caso integrado: Don Roberto, 68 años, Tonnis grado 3 en cadera derecha con dolor 8/10, pero Tonnis grado 3 en izquierda con dolor 1/10. Úsalo para explicar la disociación imagen-clínica y la sensibilización tisular.
`,
        preguntasEtapa2: [
            "¿Por qué el cartílago articular no es la fuente directa del dolor en la coxartrosis y qué estructuras inervadas generan la nocicepción?",
            "Explica el fenómeno de la disociación clínico-radiográfica en un paciente con artrosis de cadera.",
            "¿De qué manera la sinovitis de bajo grado altera el umbral de los nociceptores periarticulares?",
            "¿Cuál es el efecto de la inhibición muscular refleja sobre los estabilizadores abductores de cadera ante un proceso inflamatorio intraarticular?"
        ],
        casoEtapa3: `"Doña Teresa, 66 años, consulta por dolor profundo en la ingle derecha de 6 meses de evolución. Trae una radiografía que muestra Tonnis Grado 1 (mínimo pinzamiento), pero su dolor es de 7/10 al caminar 2 cuadras y tiene kinesiofobia severa." Explica a la paciente por qué siente dolor intenso pese a una radiografía con poco cambio estructural, sin usar lenguaje nocebo.`,
        preguntasEtapa4: [
            "¿Qué mediadores inflamatorios específicos sensibilizan los nociceptores de la cápsula y membrana sinovial en la coxartrosis?",
            "¿Qué hallazgos histológicos caracterizan al hueso subcondral sintomático en la osteoartritis de cadera?",
            "¿Por qué la clasificación de Tonnis no debe utilizarse como criterio único para decidir una intervención quirúrgica?"
        ]
    },
    {
        id: "c1.2",
        nombre: "1.2 — Factores de riesgo, morfología y progresión",
        categoria: "Coxartrosis",
        contenidoBase: `
- Factores no modificables: edad, sexo, genética, lesiones de la infancia (Legg-Calvé-Perthes, displasia del desarrollo, deslizamiento epifisario femoral) y variaciones anatómicas de cobertura (ángulo Wiberg / alfa).
- Factores modificables relevantes para salud y función: exposición a cargas no dosificadas, obesidad (mecanismos mecánicos y metabólicos), baja capacidad muscular y baja actividad física. No explican por sí solos el dolor ni determinan el pronóstico individual.
- El intercambio de líquido sinovial y la carga cíclica son fisiología articular básica. En clínica, la indicación de actividad y ejercicio se fundamenta principalmente en función, tolerancia, salud general y evidencia de beneficio; no se promete "nutrir" ni regenerar cartílago.
- Caso integrado: Don Gonzalo, 58 años, ex-agricultor con antecedente de displasia leve no tratada, IMC 31. Presenta dolor rígido matinal.
`,
        preguntasEtapa2: [
            "Diferencia los mecanismos mecánicos e inflamatorios/metabólicos por los cuales la obesidad incrementa el riesgo de progresión de la coxartrosis.",
            "¿Cómo explicarías que el movimiento dosificado puede mejorar función y confianza sin prometer regenerar cartílago ni atribuir el dolor solo a la imagen?",
            "¿Cómo influyen las secuelas de afecciones infantiles (como displasia o Perthes) en la distribución de tensiones sobre el acetábulo?",
            "¿Qué rol juega la debilidad del glúteo medio como factor de riesgo funcional en la progresión de la artrosis de cadera?"
        ],
        casoEtapa3: `"Don Mario, 62 años, trabaja de chofer de camión 10 horas al día, IMC 33, sedentario. Refiere que evita caminar 'para no gastar la articulación que le queda'." Fundamenta por qué una caminata dosificada puede ser razonable para su función y salud, cómo monitorizarías la respuesta y qué no le prometerías.`,
        preguntasEtapa4: [
            "¿Qué son las adipoquinas (ej. leptina, adiponectina) y cuál es su impacto catabólico directo sobre los condrocitos?",
            "¿Cuántas veces el peso corporal se multiplica en la articulación coxofemoral durante la fase de apoyo monopodal de la marcha?",
            "¿Qué relación existe entre la fuerza de los rotadores profundos de cadera y la contención de la cabeza femoral en la cavidad acetabular?"
        ]
    },
    {
        id: "c1.3",
        nombre: "1.3 — Dolor nociceptivo, sensibilización periférica y componente nociplástico",
        categoria: "Coxartrosis",
        contenidoBase: `
- Dolor nociceptivo mecánico: localizado en ingle/región trocantérica/glútea, empeora con la carga sostenida y rotaciones pasivas, mejora con el reposo inicial.
- Sensibilización periférica: primado nociceptivo inflamatorio donde estímulos mecánicos normales en la articulación provocan respuestas dolorosas aumentadas.
- Componente nociplástico / sensibilización central: alteración del procesamiento del dolor en el SNC. Manifestaciones: dolor difuso que sobrepasa el dermatoma, alodinia táctil, somnolencia no reparadora, catastrofismo y mala respuesta a analgésicos convencionales.
- Componente referido: patología de cadera referida a rodilla anterior mediante el nervio obturador y femoral.
- Caso integrado: Doña Carmen, 64 años, coxartrosis moderada. Refiere que "le duele hasta el roce de la sabana en el muslo, no duerme bien y siente ardor en toda la pierna".
`,
        preguntasEtapa2: [
            "¿Cómo diferencias en la consulta un dolor nociceptivo mecánico de cadera de un patrón de dolor predominantemente nociplástico?",
            "Explica la anatomía del dolor referido de la articulación de la cadera hacia la cara anterior de la rodilla.",
            "¿Qué signos clínicos y cuestionarios utilizas para detectar sensibilización central en un paciente con dolor crónico de cadera?",
            "¿Por qué un paciente con dolor nociplástico predominante no suele obtener un alivio satisfactorio con intervenciones puramente estructurales?"
        ],
        casoEtapa3: `"Paciente de 67 años con coxartrosis Tonnis 2. Reporta dolor constante de ardor 8/10 en toda la extremidad inferior derecha que empeora con el estrés y el insomnio. Presenta alodinia a la palpación suave en el muslo." Identifica la categoría de dolor predominante y propone la estrategia terapéutica inicial.`,
        preguntasEtapa4: [
            "¿Qué es la alodinia mecánica y qué cambio a nivel de astas posteriores de la médula espinal representa?",
            "¿Qué cuestionario estandarizado (ej: CSI - Central Sensitization Inventory) se recomienda para medir la carga nociplástica?",
            "¿Qué rol cumple la Educación en Neurociencia del Dolor (PNE) en la desensibilización del sistema nervioso en osteoartritis de cadera?"
        ]
    },
    {
        id: "c1.4",
        nombre: "1.4 — Evaluación clínica de la coxartrosis",
        categoria: "Coxartrosis",
        contenidoBase: `
- Anamnesis: dolor inguinal ("signo de la C"), rigidez matinal ≤30 minutos, limitación en calzarse, cortar uñas, subir a vehículos o atar cordones.
- Patrón capsular clásico de la cadera: mayor pérdida de Rotación Interna (RI), seguida de Flexión y Abducción.
- Examen físico: prueba de FADIR (Flexión, Aducción, Rotación Interna) y FABER (Flexión, Abducción, Rotación Externa), discrepancia aparente o real de longitud de extremidades.
- Diagnóstico diferencial: dolor inguinal (intraarticular) vs dolor trocantérico lateral (GTPS / tendinopatía glutéala) vs radiculopatía lumbar L3-L4 (dolor que no cambia con rotaciones pasivas de cadera).
- Evaluación funcional: TUG (Timed Up and Go), 30-second Chair Stand Test, OHS (Oxford Hip Score) y HOOS.
`,
        preguntasEtapa2: [
            "¿Cuál es el patrón capsular clásico de restricción de la articulación coxofemoral y en qué orden se afectan los rangos articulares?",
            "¿Cómo diferencias clínicamente un dolor inguinal de origen intraarticular de cadera versus un dolor referido de la columna lumbar L3-L4?",
            "Explica la maniobra del 'Signo de la C' y su validez clínica en la localización del dolor intraarticular.",
            "¿Qué hallazgos a la palpación y movilización te permiten descartar un Síndrome Doloroso del Trocánter Mayor (GTPS)?"
        ],
        casoEtapa3: `"Don Eduardo, 65 años. Presenta dolor en muslo anterior y rodilla derecha. La evaluación de columna lumbar es indolora y la maniobra de Slump es negativa. En cadera presenta RI de 10° (contra 35° en izquierda) y flexión activa de 90° con dolor inguinal al final del rango." Sintetiza el razonamiento clínico e hipótesis diagnóstica.`,
        preguntasEtapa4: [
            "¿Cuál es la duración típica de la rigidez matinal que diferencia a la coxartrosis de la artritis reumatoide?",
            "¿Cómo se realiza la medición de la discrepancia real de longitud de extremidades inferiores (desde EIAS a maléolo medial)?",
            "¿Qué puntaje de corte en el Oxford Hip Score (OHS) sugiere severidad funcional significativa?"
        ]
    },
    {
        id: "c1.5",
        nombre: "1.5 — Ejercicio como tratamiento de primera línea",
        categoria: "Coxartrosis",
        contenidoBase: `
- Recomendaciones de Guías Internacionales (OARSI 2019, NICE 2022, ACR 2021): el ejercicio terapéutico supervisado es la intervención conservadora no farmacológica de primera línea con mayor nivel de evidencia (Grado A).
- Mecanismos de acción: estimula la secreción de lubricina y proteoglicanos en el líquido sinovial, promueve la hipoalgesia inducida por ejercicio (HIE), reduce adipoquinas sistémicas y restaura el control de carga del glúteo medio y mayor.
- Tipos de ejercicio recomendados: fortalecimiento muscular progresivo (abductores, extensores, rotadores profundos), ejercicio aeróbico de bajo impacto (caminata, bicicleta, natación/hidroterapia) y movilidad articular dosificada.
- Regla de modificación de carga y dolor: dolor durante o post-ejercicio ≤4/10 en escala numérica, con retorno a la línea de base en menos de 24 horas. Si el dolor persiste >24 horas o aumenta la rigidez matinal, la carga fue excesiva.
`,
        preguntasEtapa2: [
            "¿Cuáles son los 3 mecanismos neurobiológicos y biomecánicos por los cuales el ejercicio terapéutico disminuye el dolor en la coxartrosis?",
            "Explica cómo utilizas la regla de dolor de las 24 horas para ajustar el volumen e intensidad del entrenamiento en la cadera.",
            "¿En qué casos clínicos está indicada la hidroterapia/ejercicio en agua sobre el ejercicio en tierra en las primeras etapas de rehabilitación de cadera?",
            "¿Qué nos dice la evidencia actual sobre el efecto del ejercicio de fuerza respecto al uso continuo de AINEs a mediano y largo plazo?"
        ],
        casoEtapa3: `"Doña Luisa, 61 años, coxartrosis moderada. Inició ejercicios de sentadilla y estocadas por su cuenta pero abandonó al 3er día porque el dolor subió a 7/10 y le duró 2 días completos." Adapta la dosificación, explica qué falló en su enfoque y diseña la progresión para la primera semana.`,
        preguntasEtapa4: [
            "¿Qué es la Hipoalgesia Inducida por Ejercicio (HIE) y qué vías neuroquímicas endógenas activa?",
            "¿Por qué la adherencia al programa de ejercicio es un predictor más fuerte de éxito funcional a largo plazo que la modalidad específica de ejercicio elegida?",
            "¿Cómo afecta el ejercicio aeróbico de baja intensidad a los mediadores inflamatorios sistémicos como la IL-6 y TNF-α?"
        ]
    },
    {
        id: "c1.6",
        nombre: "1.6 — Fortalecimiento específico y recuperación funcional",
        categoria: "Coxartrosis",
        contenidoBase: `
- Musculatura clave a entrenar según la tarea: glúteo medio y mayor, cuádriceps, isquiosurales y otros grupos que limiten la función. La contribución de los rotadores profundos puede describirse como control de movimiento, pero no debe asumirse que un supuesto "descentrado" sea la causa del dolor.
- Progresión por fases e irritabilidad:
  1. Fase de Baja Carga / Alta Irritabilidad: Isométricos en posición neutra (abducción en decúbito supino/lateral sin aducción compresiva).
  2. Fase de Carga Moderada: Cadena cerrada bi-podal (Sit-to-Stand con banda, puente glúteo).
  3. Fase Funcional / Alta Carga: Ejercicios unipodales (Step-ups, peso muerto unipodal, estocadas cortas controladas).
- Entrenamiento funcional de transferencias: reeducación del patrón de pararse de la silla (Sit-to-Stand) reduciendo el impulso del tronco y promoviendo el empuje del talón.
`,
        preguntasEtapa2: [
            "¿Por qué el fortalecimiento del glúteo medio en posición neutra es prioritario antes de progresar a ejercicios con rangos extremos de aducción?",
            "Explica la secuencia de progresión de cargas musculares desde contracciones isométricas analgésicas hasta ejercicios dinámicos unipodales en la cadera.",
            "¿Cómo reeducas el patrón de Sit-to-Stand (pararse de la silla) para reducir la fuerza de reacción articular de la cadera en pacientes con artrosis moderada?",
            "¿Cómo integrarías fuerza, control de tarea y tolerancia a la carga al decidir qué musculatura entrenar, sin atribuir el dolor a un único mecanismo biomecánico?"
        ],
        casoEtapa3: `"Don Pedro, 69 años, coxartrosis derecha. Al realizar una abducción en decúbito lateral presenta un 'clunk' doloroso 6/10 y compensa flexionando la cadera y rotando el tronco hacia atrás." Diagnostica la compensación y propón 2 alternativas para fortalecer el abductor en una posición más segura hoy.`,
        preguntasEtapa4: [
            "¿Qué diferencia existe en la magnitud de la Fuerza de Reacción Articular (JRF) entre la elevación de pierna recta en supino (SLR) y la caminata en terreno plano?",
            "¿Por qué el puente glúteo con banda elástica sobre las rodillas favorece la coactivación del glúteo mayor y medio sin provocar cizalla articular?",
            "¿Cuáles son los parámetros de repeticiones, series y frecuencia semanal recomendados por ACSM para hipertrofia/fuerza en adultos mayores con osteoartritis?"
        ]
    },
    {
        id: "c1.7",
        nombre: "1.7 — Educación, ayudas técnicas y manejo del nocebo",
        categoria: "Coxartrosis",
        contenidoBase: `
- Uso de bastón / bastón canadiense: DEBE utilizarse en la mano CONTRALATERAL a la cadera dolorosa.
  - Mecanismo biomecánico: al apoyar el bastón en el lado contralateral, el latísimo del lomo y los flexores del brazo generan un momento que reduce la fuerza de contracción requerida por el glúteo medio afectado, reduciendo la Fuerza de Reacción Articular (JRF) hasta en un 50%.
- Adaptación de la vida diaria: elevar la altura de sillas/inodoros para evitar flexión >90° en fases de alta irritabilidad, evitar cruzar las piernas (aducción extrema) y distribuir cargas en compras.
- Desmitificación del lenguaje nocebo: evitar términos infundidores de miedo como "hueso contra hueso", "cadera gastada" o "chatarra articular". Reemplazar por "articulación con capacidad de adaptación", "síntomas que podemos monitorizar" y "movimiento y ejercicio dosificados para recuperar función".
`,
        preguntasEtapa2: [
            "Explica biomecánicamente por qué el bastón debe usarse en la mano CONTRALATERAL a la cadera lesionada y cuánta carga articular alivia.",
            "¿Cómo explicarías el concepto de nocebo a un paciente que llega asustado porque su informe dice 'severo desgaste articular'?",
            "¿Qué adaptaciones ergonómicas simples en el hogar sugieres para un paciente en fase de alta irritabilidad dolorosa de cadera?",
            "¿Qué impacto tiene el catastrofismo y el miedo al movimiento (kinesiofobia) sobre la respuesta al tratamiento con ejercicio?"
        ],
        casoEtapa3: `"Paciente de 65 años llega usando el bastón en el mismo lado de la cadera dolorosa porque dice que 'así apoya el lado enfermo'. Camina con una claudicación severa." Explícale Didácticamente y demuestra biomecánicamente por qué debe cambiar el bastón a la mano opuesta.`,
        preguntasEtapa4: [
            "¿En qué porcentaje se reduce la contracción del glúteo medio ipsilateral cuando se apoya un bastón en la mano contralateral con un 15% del peso corporal?",
            "Nombra 3 frases de uso común en la consulta que constituyen lenguaje nocebo y propón sus 3 alternativas de lenguaje terapéutico positivo.",
            "¿Cómo se mide la altura correcta de un bastón respecto al trocánter mayor o pliegue de la muñeca?"
        ]
    },
    {
        id: "c1.8",
        nombre: "1.8 — Fracaso conservador, derivación quirúrgica y alta",
        categoria: "Coxartrosis",
        contenidoBase: `
- Criterio de tratamiento conservador adecuado: se requiere una prueba mínima de 3 a 6 meses de kinesiología activa supervisada, educación y manejo de carga antes de considerar la cirugía de reemplazo articular.
- Criterios de derivación a traumatología para evaluación de Artroplastia Total de Cadera (PTC):
  1. Dolor severo e intratable que no responde a 3-6 meses de ejercicio supervisado y farmacología.
  2. Alteración funcional severa que impide las AVD básicas y destruye la calidad de vida.
  3. Evidencia radiográfica (Tonnis 2-3) congruente con la clínica sintomática.
- Identificación de Banderas Rojas de derivación urgente: necrosis avascular severa (dolor constante nocturno de inicio súbito), sospecha de artritis séptica (calor, fiebre, imposibilidad de apoyo), fractura no desplazada de cuello femoral.
- Criterios para el Alta Kinesiológica: independencia funcional en AVD, simetría de marcha sin claudicación antálgica, fuerza de abductores funcional, TUG <10s y plan domiciliario de autogestión incorporado.
`,
        preguntasEtapa2: [
            "¿Cuáles son los criterios clínicos y temporales objetivos para declarar que un tratamiento conservador de coxartrosis ha fracasado?",
            "¿Qué signos y síntomas te harían sospechar de una Necrosis Avascular de la cabeza femoral (AVN) o Artritis Séptica para una derivación médica urgente?",
            "¿Por qué el alta kinesiológica en coxartrosis no debe depender de que el paciente reporte 0/10 de dolor?",
            "¿Qué información clave debe contener el informe de derivación kinesiológica hacia el cirujano traumatólogo?"
        ],
        casoEtapa3: `"Don José, 67 años, lleva 4 semanas de kinesiología. Asistió a 3 sesiones, no realizó los ejercicios en casa y acude hoy exigiendo que lo derives inmediatamente a cirugía porque 'la kinesiología no le sirvió'." Argumenta clínicamente tu conducta y explica si cumple o no los criterios de derivación quirúrgica.`,
        preguntasEtapa4: [
            "¿Qué porcentaje de pacientes con artrosis severa de cadera logra evitar o posponer la cirugía mediante programas de ejercicio de 12 semanas (ej: GLA:D)?",
            "¿Qué hallazgo en la resonancia magnética caracteriza a la Osteonecrosis Avascular en sus fases tempranas?",
            "¿Cuáles son los 3 tests funcionales validados que deberías registrar para justificar el alta kinesiológica?"
        ]
    },

    // ────────────── CATEGORÍA 2: ARTROPLASTIA TOTAL DE CADERA (PTC) ──────────────
    {
        id: "c2.1",
        nombre: "2.1 — Indicaciones, tipos de prótesis, fijación y superficies de contacto",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Artroplastia Total de Cadera (PTC): reemplazo del acetábulo (copa acetabular + inserto) y del fémur (vástago + cabeza femoral). Hemiartroplastia: reemplazo solo de cabeza/cuello femoral (común en fracturas en ancianos).
- Tipos de fijación:
  - Cementada (Polimetilmetacrilato - PMMA): fijación mecánica inmediata. Indicada en hueso osteoporótico / ancianos. Carga completa permitida de inmediato.
  - No cementada (poro-integración ósea): el hueso crece dentro de la superficie porosa del implante. Indicada en pacientes más jóvenes con buena calidad ósea. Requiere protección de carga progresiva inicial según protocolo del cirujano.
- Pares de fricción (superficies de contacto): Metal-Polietileno (estándar), Cerámica-Polietileno, Cerámica-Cerámica (menor tasa de desgaste, ideal para jóvenes).
- Caso integrado: Doña Elena, 72 años con osteoporosis severa (fijación cementada) vs Don Carlos, 52 años activo (fijación no cementada cerámica-cerámica).
`,
        preguntasEtapa2: [
            "Compara los mecanismos de fijación cementada vs no cementada y su impacto en la progresión de la carga de peso postoperatoria.",
            "Diferencia las indicaciones quirúrgicas entre una Hemiartroplastia de cadera y una Artroplastia Total de Cadera (PTC).",
            "¿Cuáles son las ventajas y desventajas biomecánicas de los pares de fricción Cerámica-Cerámica vs Metal-Polietileno?",
            "¿Qué es la osteolisis por partículas de desgaste del polietileno y cómo afecta la supervivencia del implante a largo plazo?"
        ],
        casoEtapa3: `"Paciente de 55 años sometido a PTC derecha no cementada con par cerámica-cerámica hace 5 días. El paciente pregunta por qué su vecino de habitación de 78 años con prótesis cementada ya camina sin bastón y él aún debe usar dos muletas con carga parcial." Explícale didácticamente la razón fisiológica.`,
        preguntasEtapa4: [
            "¿Cuál es el tiempo promedio estimado de osteointegración primaria en los implantes de vástago femoral no cementados?",
            "¿Qué riesgo biomecánico específico presenta el par de fricción Metal-Metal (metalosis) que llevó a su desuso?",
            "¿Qué determina la elección del tamaño de la cabeza femoral (ej: 28mm vs 32mm vs 36mm) respecto a la estabilidad y al rango de movimiento sin pinzamiento?"
        ]
    },
    {
        id: "c2.2",
        nombre: "2.2 — Abordajes quirúrgicos y tejidos intervenidos",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Abordaje Posterolateral (más frecuente históricamente):
  - Tejidos seccionados: fascias, tensor de la fascia lata (parcial), sección de rotadores cortos externos (piriforme, gemelos, obturador interno) y capsulotomía posterior.
  - Implicancia: mayor riesgo de luxación posterior. Preserva el glúteo medio y menor.
- Abordaje Directo Anterior (ADA - Direct Anterior Approach):
  - Plano intermuscular e internervioso: pasa entre el Tensor de la Fascia Lata (TFL) y el Sartorio / Recto Femoral. No secciona músculos.
  - Implicancia: menor dolor inicial, recuperación rápida de marcha, menor riesgo de luxación, pero técnicamente exigente y riesgo de neuropatía del nervio cutáneo femoral lateral.
- Abordaje Lateral Directo (Hardinge):
  - Incisión a través del tercio anterior del glúteo medio y vasto lateral.
  - Implicancia: riesgo de debilidad/cojera de glúteo medio por denervación o cicatriz.
`,
        preguntasEtapa2: [
            "Compara el abordaje Posterolateral y el Abordaje Directo Anterior (ADA) en términos de músculos seccionados y estabilidad postoperatoria.",
            "¿Por qué el abordaje Lateral Directo (Hardinge) presenta mayor incidencia de claudicación prolongada por Trendelenburg que el posterolateral?",
            "¿Qué plano internervioso e intermuscular utiliza el abordaje anterior directo para evitar seccionar masa muscular?",
            "¿Qué neuropatía sensitiva periférica es una complicación conocida del abordaje directo anterior de cadera?"
        ],
        casoEtapa3: `"Evalúas a dos pacientes en su 2da semana post-PTC. El Paciente A (abordaje posterolateral) tiene glúteo medio M4 pero miedo a luxarse al sentarse. El Paciente B (abordaje directo anterior) camina muy bien pero refiere adormecimiento y ardor en la cara anterolateral del muslo." Justifica los hallazgos según los tejidos de cada abordaje.`,
        preguntasEtapa4: [
            "¿Qué rotadores cortos externos se reinsertan o suturan habitualmente tras un abordaje posterolateral de cadera?",
            "¿Por qué el abordaje directo anterior permite acelerar la marcha sin bastón durante las primeras 2 semanas postoperatorias?",
            "¿Qué nervio inerva al Tensor de la Fascia Lata y cuál inerva al Sartorio en el intervalo quirúrgico anterior?"
        ]
    },
    {
        id: "c2.3",
        nombre: "2.3 — Biomecánica de luxación y precauciones postoperatorias",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Mecanismo de luxación según el abordaje quirúrgico:
  - Abordaje Posterolateral: RIESGO DE LUXACIÓN POSTERIOR. Movimientos prohibidos/precaución: Flexión de cadera >90° + Aducción (cruzar piernas) + Rotación Interna. (Ej: sentarse en sillas bajas, atarse los cordones cruzando la pierna, girar sobre la pierna fija hacia adentro).
  - Abordaje Directo Anterior: RIESGO DE LUXACIÓN ANTERIOR. Movimientos prohibidos/precaución: Extensión extrema + Rotación Externa + Aducción. (Ej: paso largo hacia atrás con RE).
- Evidencia actual sobre restricciones estrictas: las guías modernas cuestionan el uso rutinario de restricciones rígidas iguales para todos por más de 6 semanas, promoviendo precauciones basadas en el abordaje, estabilidad intraoperatoria comprobada por el cirujano y tono muscular del paciente.
- Uso del cojín abductor: previene la aducción involuntaria durante el sueño en decúbito supino en las primeras semanas post-abordaje posterior.
`,
        preguntasEtapa2: [
            "¿Cuáles son las 3 posiciones combinadas de movimiento que desencadenan una luxación POSTERIOR en una PTC posterolateral?",
            "¿Cuáles son las posiciones de riesgo para una luxación ANTERIOR tras un abordaje directo anterior de cadera?",
            "¿Qué nos dice la evidencia científica contemporánea sobre la eficacia de imponer restricciones rígidas de movimiento a todos los pacientes post-PTC?",
            "¿Cómo instruyes a un paciente con abordaje posterolateral para realizar la transferencia de levantarse de la cama o del inodoro de forma segura?"
        ],
        casoEtapa3: `"Paciente de 3 semanas post-PTC posterolateral derecha. Te cuenta que anoche se le cayó el control remoto al suelo estando sentado en un sillón bajo y se agachó de frente a recogerlo entre las piernas provocando un chasquido agudo." Evalúa el riesgo biomecánico de luxación y tu conducta inmediata.`,
        preguntasEtapa4: [
            "¿Qué diámetro de cabeza femoral protésica otorga mayor 'Jump Distance' (distancia de salto) reduciendo el riesgo de luxación?",
            "¿Qué rol cumple el ángulo de anteversión acetabular quirúrgico (15°-20°) e inclinación (40°-45°) en la prevención del impaction protésico?",
            "¿Por qué girar el cuerpo hacia el lado operado manteniendo el pie fijo en el suelo es una maniobra de riesgo en abordaje posterior?"
        ]
    },
    {
        id: "c2.4",
        nombre: "2.4 — Complicaciones relevantes para Kinesiología",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Trombosis Venosa Profunda (TVP) y Embolismo Pulmonar (EP): complicación vascular grave. Signos de TVP: dolor en pantorrilla, edema asimétrico (>3 cm de diferencia de diámetro), calor y eritema. Criterios de Wells.
- Infección Periprotésica (IPJ): precoz (<3 meses) o tardía. Signos: fiebre, eritema persistente, dolor constante en reposo, dehisencia o secreción purulenta de la herida quirúrgica.
- Luxación Protésica: acortamiento repentino de la extremidad con rotación interna fija (luxación posterior) o rotación externa (luxación anterior) y dolor severo e incapacidad total de apoyo.
- Dismetría de Extremidades (LLD - Leg Length Discrepancy):
  - Real / Estructural: por colocación del vástago/centro articular.
  - Aparente / Funcional: puede relacionarse con postura, basculación pélvica, protección por dolor, rango disponible o patrón de marcha. Debe reevaluarse tras la recuperación inicial antes de considerar un realce; no se atribuye automáticamente a una "contractura".
`,
        preguntasEtapa2: [
            "Describe la prueba de Wells para TVP y los signos físicos que exigen la suspensión inmediata de la sesión kinesiológica post-PTC.",
            "Diferencia las características clínicas de una dismetría de extremidades REAL/estructural versus una APARENTE/funcional post-PTC.",
            "¿Qué signos físicos diferencian una infección periprotésica superficial de una infección articular profunda postoperatoria?",
            "¿Por qué NO se debe prescribir un realce en el calzado de forma prematura durante las primeras 6 semanas post-PTC si el paciente siente la pierna 'más larga'?"
        ],
        casoEtapa3: `"Semana 2 post-PTC. El paciente acude refiriendo que siente su pierna operada '2 cm más larga' al ponerse de pie, camina apoyando solo en punta de pie. Al evaluar en camilla, las espinas ilíacas anterosupresoras están niveladas y la dismetría ósea medida es de solo 3 mm." Diagnostica el tipo de dismetría y explica tu plan.`,
        preguntasEtapa4: [
            "¿Qué porcentaje de dismetría aparente post-PTC se resuelve espontáneamente antes de los 3 meses mediante reeducación pélvica?",
            "¿Qué es la osificación heterotópica post-PTC y cómo impacta en el rango articular de flexión?",
            "¿Cuáles son los signos y síntomas de alarma respiratorios que indican sospecha de Embolia Pulmonar (EP) en el box?"
        ]
    },
    {
        id: "c2.5",
        nombre: "2.5 — Evaluación postoperatoria por fases",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Fase Aguda Hospitalaria (Días 0-3): control de dolor/edema, prevención de TVP (ejercicios circulatorios de tobillo/bomba muscular), transferencias básicas (cama a silla), bipedestación y marcha con andador/bastones canadiense.
- Fase Subaguda Domiciliaria/Ambulatoria (Semanas 1-6): independencia en transferencias, retiro progresivo de bastones a marcha independiente, ganancia de rango funcional (flexión a 90°, extensión a 0°), fortalecimiento de abductores y extensores de cadera, reeducación del patrón de marcha.
- Fase Funcional y Retorno Activo (orientativamente desde semana 6): progresión de carga unipodal, marcha y escaleras según desempeño, síntomas, objetivos y restricciones del cirujano. El LSI y otros tests aportan información, pero no son un alta automática.
- Outcome Measures: HOOS (Hip disability and Osteoarthritis Outcome Score), Forgotten Joint Score (FJS-12), TUG, 30s Chair Stand Test.
`,
        preguntasEtapa2: [
            "Detalla los hitos de evaluación física que dividen la Fase Aguda (sem 1-2) de la Fase Subaguda (sem 2-6) en una PTC.",
            "¿Qué criterios funcionales objetivos deben cumplirse para autorizar la transición de marcha con 2 bastones a 1 bastón y luego a marcha independiente?",
            "Compara el valor clínico del HOOS versus el Forgotten Joint Score (FJS-12) en la evaluación de resultados a los 6 meses.",
            "¿Cómo evalúas el control de la cadera en el plano frontal durante la subida y bajada de escaleras en la semana 6?"
        ],
        casoEtapa3: `"Semana 4 post-PTC. La paciente camina en el box con un solo bastón en la mano ipsilateral a la cirugía y presenta una cojera severa con basculación de tronco. Al quitarle el bastón, el Trendelenburg es severo." Evalúa qué falló en la progresión y reestructura el plan de marcha.`,
        preguntasEtapa4: [
            "¿Qué es el Forgotten Joint Score (FJS-12) y por qué mide el nivel máximo de éxito quirúrgico post-PTC?",
            "¿Cuál es el valor normativo del 30-Second Chair Stand Test para un adulto de 65 años operado de PTC al 3er mes?",
            "¿Por qué se evalúa el control dinámico del tronco durante la marcha como un indicador indirecto de fuerza del glúteo medio?"
        ]
    },
    {
        id: "c2.6",
        nombre: "2.6 — Rehabilitación aguda: primeras dos semanas",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Objetivos prioritarios: manejo de inflamación/edema, prevención de rigidez, activación neuromuscular temprana del glúteo mayor y medio, independencia en marcha asistida con andador o 2 bastones canadiense.
- Intervenciones: ejercicios circulatorios (bomba de tobillo), isométricos de glúteo y cuádriceps en supino, deslizamiento de talón (heel slides) hasta 90° de flexión, abducción deslizante en supino.
- Reeducación de transferencias: acostarse y levantarse de la cama liderando con la pierna sana al subir y la pierna operada al bajar ("La sana va al cielo, la enferma al infierno").
- Precauciones: mantener educación de rangos seguros según abordaje, evitar rotaciones bruscas del pie con la rodilla extendida en cama.
`,
        preguntasEtapa2: [
            "Describe la secuencia de intervención kinesiológica recomendada durante las primeras 48 horas post-PTC en el entorno hospitalario.",
            " Explica la regla nemotécnica de transferencias para subir y bajar escaleras/camas ('La sana sube, la lesionada baja') desde el punto de vista del control de carga.",
            "¿Qué ejercicios isométricos e isotónicos en cama están indicados y cuáles contraindicados durante la semana 1?",
            "¿Cómo manejas el edema de la extremidad inferior post-quirúrgica mediante posicionamiento y drenaje activo?"
        ],
        casoEtapa3: `"Día 3 post-PTC posterolateral. El paciente siente pánico de mover la pierna en la cama y se niega a sentarse en el borde porque cree que 'se le va a salir la prótesis'." Estructura tu abordaje educativo y la primera transferencia del día.`,
        preguntasEtapa4: [
            "¿Qué impacto tiene la caminata precoz dentro de las primeras 12 horas (protocolo ERAS) sobre la incidencia de atelectasia pulmonar y TVP?",
            "¿Por qué se desaconseja realizar la elevación de pierna recta en supino (SLR) activa durante la primera semana si hay dolor severo o abordaje anterior?",
            "¿Cómo se diferencia un edema fisiológico reactivo post-quirúrgico de un linfoedema persistente?"
        ]
    },
    {
        id: "c2.7",
        nombre: "2.7 — Rehabilitación subaguda: semanas 2 a 6",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Objetivos: retirar ayudas técnicas de marcha gradualmente, normalizar el patrón de marcha (fase de apoyo sin Trendelenburg), ganar rango articular (flexión 100°-110°, extensión completa de 0°), fortalecer musculatura estabilizadora en cadena cerrada.
- Ejercicios recomendados:
  - Mini-sentadillas asistidas (0-60° flexión de cadera).
  - Puente de glúteos bi-podal progresando a apoyo asimétrico.
  - Abducción en bipedestación apoyado en barra / camilla.
  - Bicicleta estática con sillín alto (evita flexión de cadera >90° en abordaje posterior).
  - Step-ups frontales y laterales de baja altura (5-10 cm).
- Criterios para retirar el segundo bastón: marcha con 1 bastón sin cojera antálgica ni oscilación de tronco, fuerza de abductores M4 en camilla.
`,
        preguntasEtapa2: [
            "¿Cuáles son los ejercicios en cadena cerrada recomendados entre las semanas 2 y 6 post-PTC y cómo evitas la compensación pélvica?",
            " Explica las condiciones de ajuste del sillín de la bicicleta estática para no vulnerar la precaución de flexión de cadera >90°.",
            "¿Cómo realizas la reeducación del apoyo monopodal de la marcha para eliminar el Trendelenburg a la 4ta semana?",
            "¿Qué progresión de ejercicios utilizas para fortalecer el glúteo mayor sin generar hiperextensión lumbar compensatoria?"
        ],
        casoEtapa3: `"Semana 4 post-PTC. El paciente camina en paralelo sin bastón pero arrastra el pie operado en la fase de oscilación por falta de flexión activa de cadera y balancea la pelvis lateralmente." Diagnostica la deficiencia de la marcha y propone 2 ejercicios para corregirla.`,
        preguntasEtapa4: [
            "¿Por qué los step-ups laterales de baja altura estimulan mejor el control frontal de la pelvis que la abducción en decúbito lateral?",
            "¿Qué combinación de estabilidad, dolor, calidad de marcha, seguridad y función usarías para decidir el retiro progresivo del bastón?",
            "¿Cómo afecta la restricción de movilidad del flexor de cadera (Iliopsoas) al patrón de extensión en la fase de despegue de la marcha?"
        ]
    },
    {
        id: "c2.8",
        nombre: "2.8 — Rehabilitación funcional: desde semana 6",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Objetivos: mejorar fuerza, desempeño y confianza en tareas relevantes; comparar con línea basal y lado contralateral cuando sea apropiado, sin convertir un LSI aislado en criterio de alta.
- Ejercicios avanzados: peso muerto rumano unipodal asistido, estocadas cortas, prensa de piernas, trabajo en plano inestable (Bosu/Tabla de balance), reentrenamiento de agilidad y caminata a ritmo rápido.
- Actividades de menor impacto que suelen preferirse: caminata, natación una vez cicatrizada la herida y autorizado por el equipo, bicicleta, golf y deportes de raqueta de menor demanda. La elección debe respetar abordaje, estabilidad, evolución y recomendación del cirujano.
- Las actividades de alto impacto o contacto requieren una conversación individualizada sobre exposición, riesgos, metas y recomendación quirúrgica; no se resuelven con una prohibición idéntica para todas las personas.
`,
        preguntasEtapa2: [
            "¿Qué variables del abordaje, indicaciones quirúrgicas, rango tolerado y síntomas revisarías antes de indicar una patada de pecho u otro gesto de rotación?",
            "Describe una batería de ejercicios de equilibrio, fuerza y tareas unipodales para la fase funcional y cómo progresarías según respuesta.",
            "¿Cómo conversarías sobre actividades de menor y mayor impacto tras una PTC sin usar reglas universales, incorporando la indicación del cirujano?",
            "¿Cuáles son los criterios funcionales para autorizar la conducción de automóviles (pierna derecha operada vs izquierda operada)?"
        ],
        casoEtapa3: `"Semana 10 post-PTC. Paciente de 58 años muy activo pide autorización para volver a trotar 5 km diarios en asfalto y jugar tenis singles." Fundamenta una conversación de decisión compartida: estado funcional, exposición progresiva, posibles riesgos, indicación del cirujano y alternativas mientras se completa la recuperación.`,
        preguntasEtapa4: [
            "¿Cómo se relaciona la tasa de desgaste del polietileno por millón de ciclos con el tipo de actividad de alto impacto?",
            "¿Cuál es el tiempo promedio de reacción de frenado en conducción de automóvil que se normaliza a las 6 semanas post-PTC derecha?",
            "¿Qué pruebas dinámicas unipodales de equilibrio (ej: Y-Balance Test) se recomiendan antes del alta funcional?"
        ]
    },
    {
        id: "c2.9",
        nombre: "2.9 — Prehabilitación y preparación para artroplastia",
        categoria: "Artroplastia (PTC)",
        contenidoBase: `
- Prehabilitación (Prehab): programa de ejercicio terapéutico y educación realizado entre 4 y 8 semanas PREVIAS a la cirugía de PTC.
- Evidencia (EBM): el Prehab reduce la estadía hospitalaria (hasta en 1-2 días), acelera la recuperación de la marcha post-quirúrgica, reduce la necesidad de rehabilitación en centros cerrados y disminuye la ansiedad preoperatoria.
- Componentes del Prehab:
  1. Fortalecimiento muscular de cuádriceps, glúteos y core.
  2. Entrenamiento preoperatorio de marcha con muletas/andador (aprender a usar las ayudas antes de tener la cirugía).
  3. Educación sobre expectativas reales, control del dolor post-op y adecuación ergonómica del hogar.
- Evaluación de riesgos pre-quirúrgicos: tabaquismo (aumenta infección/falla de cicatrización), obesidad morbida (IMC >40), catastrofismo y mala red de apoyo familiar.
`,
        preguntasEtapa2: [
            "¿Cuáles son los beneficios clínicos probados por la evidencia (EBM) de implementar un programa de Prehabilitación de 4-6 semanas previo a una PTC?",
            "¿Por qué es fundamental enseñar el uso de muletas/andador al paciente ANTES de la cirugía en lugar de hacerlo en el postoperatorio inmediato?",
            "¿Qué adaptaciones ergonómicas del hogar se deben planificar y revisar durante la fase preoperatoria?",
            "¿Cómo influye el nivel de fuerza muscular del glúteo medio previo a la cirugía en la velocidad de recuperación de la marcha a las 6 semanas?"
        ],
        casoEtapa3: `"Don Heraldo, 68 años, se operará de PTC en 6 semanas. Es sedentario, tiene IMC 34, nunca ha usado muletas y cree que al 2do día tras la operación ya estará caminando sin dolor ni asistencia." Diseña el plan de 3 pilares de su Prehab.`,
        preguntasEtapa4: [
            "¿Qué impacto tiene la cesación del tabaquismo 4 semanas antes de la cirugía sobre la tasa de complicaciones de la herida quirúrgica?",
            "¿Qué dice la literatura científica sobre la disminución del dolor anticipatorio mediante la educación preoperatoria PNE?",
            "¿Qué test funcional simple (ej: Chair Stand Test de 30s) aplicado en la Prehab es mejor predictor de alta hospitalaria precoz?"
        ]
    },

    // ────────────── CATEGORÍA 3: EVALUACIÓN ESPECÍFICA POST-ARTROPLASTIA ──────────────
    {
        id: "c3.1",
        nombre: "3.1 — Inspección, cicatriz, edema y longitud de extremidades",
        categoria: "Evaluación Post-Artroplastia",
        contenidoBase: `
- Checklist de Inspección Física Post-PTC (Meses 1 a 3):
  1. Estado de la herida quirúrgica / cicatriz: evaluar consolidación, presencia de dehisencia, queloide, adherencia a planos profundos o signos de inflamación/infección (eritema, calor, secreción).
  2. Edema de extremidad inferior: medir perimetría en tobillo, pantorrilla y muslo (distinguir edema blando gravitacional fisiológico de edema duro asimétrico con dolor en pantorrilla = TVP).
  3. Evaluación Postural y Dismetría de Extremidades (LLD):
     - Dismetría Real (Anatómica): medición desde Espina Ilíaca Anterosuperior (EIAS) a Maléolo Medial.
     - Dismetría Aparente (Funcional): medición desde Ombligo a Maléolo Medial. Frecuentemente causada por basculación pélvica, rigidez de aductores o hipertonía defensiva del cuadrado lumbar contralateral.
- Evaluación de oblicuidad pélvica: palpación simultánea de crestas ilíacas y EIAS en bipedestación.
`,
        preguntasEtapa2: [
            "Describe el paso a paso exacto de la palpación y goniometría para diferenciar una dismetría de extremidades REAL de una APARENTE.",
            "¿Cómo evalúas la movilidad de la cicatriz quirúrgica respecto a planos subdérmicos y fasciales y por qué influye en el rango de flexión?",
            "¿Qué características perimétricas y palpatorias te hacen descartar un linfedema o TVP frente a un edema postoperatorio fisiológico?",
            "¿Qué papel cumple la tensión defensiva del músculo cuadrado lumbar contralateral en la sensación subjetiva de 'pierna larga'?"
        ],
        casoEtapa3: `"Paciente de 6 semanas post-PTC posterolateral. Refiere que la cicatriz le 'tira' al sentarse y siente la pierna operada más larga. Al medir: EIAS a maléolo = 88 cm en ambas piernas. Ombligo a maléolo = 93 cm en operada vs 91 cm en sana." Diagnostica el problema y propone 2 intervenciones.`,
        preguntasEtapa4: [
            "¿Por qué se debe evitar realizar masajes de fricción profunda transversa (Cyriax) sobre la cicatriz antes de las 4-6 semanas postoperatorias?",
            "¿Qué diferencia milimétrica en la dismetría real de extremidades es considerada dentro del margen de error o tolerancia fisiológica tolerable?",
            "¿Cómo afecta la rigidez en aducción de la cadera operada al ángulo de basculación de la pelvis durante la postura bípeda?"
        ]
    },
    {
        id: "c3.2",
        nombre: "3.2 — Rango de movimiento activo, pasivo y restricciones articulares",
        categoria: "Evaluación Post-Artroplastia",
        contenidoBase: `
- Evaluación Goniométrica Estandarizada de Cadera Post-PTC:
  - Flexión pasiva/activa (meta a los 3 meses: ≥110°-120°). Fulcro sobre Trocánter Mayor, brazo fijo alineado con la línea media del tronco, brazo móvil alineado con fémur hacia epicóndilo lateral.
  - Extensión pasiva/activa (meta: 0° a 10° de extensión pura sin anteversión pélvica). Evaluada en decúbito prono o test de Thomas modificado.
  - Abducción (meta: 35°-45°) y Adducción (evaluada con precaución según fase).
  - Rotaciones pasivas en posición neutra y a 90° de flexión (respetando restricciones quirúrgicas del abordaje).
- Diagnóstico Diferencial de la Restricción de Rango:
  - End-feel Capsular/Ligamentoso Firme (ganable mediante terapia manual y movimiento activo).
  - End-feel Duro Óseo/Protésico (bloqueo mecánico por impaction o protuberancia ósea/heterotópica: NO forzar).
  - Bloqueo por Protección Muscular / Guarding Neuromuscular por Dolor o Miedo (requiere PNE, exposición gradual al movimiento y modulación neurofisiológica).
`,
        preguntasEtapa2: [
            " Explica la técnica goniométrica correcta para medir la extensión pura de cadera evitando el engaño de la anteversión pélvica o hiperlordosis lumbar.",
            "Diferencia el diagnóstico y conducta clínica entre un end-feel firme capsular versus un end-feel duro en la flexión de cadera post-PTC.",
            "¿Cómo utilizas el Test de Thomas para diferenciar una restricción en flexión del Iliopsoas versus una restricción de longitud del Recto Femoral?",
            "¿Por qué es más prioritario lograr los 0° de extensión completa de cadera para la marcha que ganar los últimos 15° de flexión profunda?"
        ],
        casoEtapa3: `"Paciente de 8 semanas post-PTC. Al evaluar extensión pasiva en prono, la cadera se queda a -10° de extensión. Al forzar suavemente siente un tope duro indoloro y la pelvis se eleva inmediatamente de la camilla." Diagnostica el tipo de restricción y determina si es adecuado forzar el rango.`,
        preguntasEtapa4: [
            "¿Qué grado de flexión de cadera en camilla es el mínimo requerido para que un paciente logre subir escaleras sin girar el tronco?",
            "¿Qué es la oscilación pélvica anterior compensatoria y qué músculos sufren atrofia secundaria cuando persiste un déficit de extensión de cadera?",
            "¿Cómo se distingue clínicamente una rigidez o restricción del Tensor de la Fascia Lata (Test de Ober) de una restricción de la cápsula anterior?"
        ]
    },
    {
        id: "c3.3",
        nombre: "3.3 — Marcha y compensaciones postartroplastia",
        categoria: "Evaluación Post-Artroplastia",
        contenidoBase: `
- Evaluación Dinámica de la Marcha en Post-PTC (Checklist de observación):
  1. Claudicación de Trendelenburg (No Compensado): la pelvis cae hacia el lado contralateral durante la fase de apoyo monopodal de la pierna operada. Causa: insuficiencia o debilidad del Glúteo Medio ipsilateral.
  2. marcha de Duchenne / Trendelenburg Compensado: el tronco se inclina lateralmente SOBRE la cadera operada durante el apoyo para mover el centro de gravedad sobre la articulación y reducir el momento de fuerza requerido por el glúteo medio debilitado.
  3. Marcha en Flexo / Marcha Antálgica de Cadera: reducción o ausencia de extensión de cadera en la fase de despegue (terminal stance), con paso corto contralateral y falta de propulsión.
  4. Circunducción de Cadera / Marcha en Segador: la pierna se abre hacia afuera en abducción durante la fase de oscilación. Causa: falta de flexión activa de cadera/rodilla o dismetría real donde la pierna operada es más larga.
- Uso incorrecto del bastón: llevar el bastón en el mismo lado operado o no sincronizar el avance del bastón con la pierna operada.
`,
        preguntasEtapa2: [
            "Diferencia visualmente durante la marcha una claudicación de Trendelenburg NO compensada de un Trendelenburg COMPENSADO (Duchenne).",
            "¿Por qué la marcha en circunducción (segador) puede ser consecuencia de una dismetría real o de una inhibición de flexores de cadera?",
            "¿Qué déficit muscular específico provoca la ausencia de extensión de cadera en la fase de despegue de talón durante la marcha?",
            "¿Cómo reeducas la marcha en un paciente que mantiene el uso del bastón en la mano equivocada por costumbre?"
        ],
        casoEtapa3: `"Paciente de 8 semanas post-PTC derecha. Camina sin bastón pero cada vez que apoya la pierna derecha inclina marcadamente los hombros hacia la derecha. Dice que 'no le duele pero no puede evitar inclinarse'." Identifica el patrón de marcha y diseña el ejercicio de corrección.`,
        preguntasEtapa4: [
            "¿Cuánta carga adicional sufre la columna lumbar en flexión/inclinación lateral sostenida durante la marcha con Trendelenburg compensado?",
            "¿Qué es la marcha con evitación del glúteo mayor (gluteus maximus lurch) y cómo se observa en el plano sagital?",
            "¿Cuáles son los parámetros espaciotemporales de la marcha (velocidad, cadencia, longitud de paso) que se deben medir pre y post-alta?"
        ]
    },
    {
        id: "c3.4",
        nombre: "3.4 — Fuerza y control neuromuscular",
        categoria: "Evaluación Post-Artroplastia",
        contenidoBase: `
- Evaluación Analítica de Fuerza Muscular (Escala de Daniels MMT + Dinamometría digital si aplica):
  - Glúteo Medio / Menor: evaluado en decúbito lateral con cadera en ligera extensión y posición neutra de rotación.
  - Glúteo Mayor: evaluado en decúbito prono con rodilla flectada a 90° (aísla glúteo mayor reduciendo acción de isquiotibiales).
  - Iliopsoas / Flexores de cadera: evaluado sentado en el borde de camilla (elevación de muslo).
  - Rotadores Profundos de Cadera: evaluado en sedestación (rotación interna y externa resistida).
- Pruebas Funcionales Neuromusculares:
  - Test de Apoyo Unipodal (Single Leg Stance Test): mantener equilibrio sobre pierna operada durante 30 segundos sin inclinación de tronco ni caída pélvica.
  - Test 30-Second Chair Stand: número de repeticiones completas de ponerse de pie y sentarse en 30 segundos.
  - Test TUG (Timed Up and Go): tiempo para levantarse de silla, caminar 3 metros, girar y volver a sentarse (normativo post-PTC <10 segundos).
  - Limb Symmetry Index (LSI): porcentaje de simetría de fuerza/desempeño = (Puntaje Operado / Puntaje Sano) x 100. Es un dato complementario: se interpreta con la línea basal, desempeño funcional, síntomas y objetivos, no como meta universal de alta.
`,
        preguntasEtapa2: [
            " Describe cómo aislás la evaluación de fuerza MMT del Glúteo Mayor desactivando la acción dominante de los isquiotibiales en camilla.",
            " Explica la metodología de cálculo e interpretación del Limb Symmetry Index (LSI) para fuerza abductora post-PTC.",
            "¿Qué observaciones biomecánicas realizas durante la ejecución del 30-Second Chair Stand Test a las 8 semanas postoperatorias?",
            "¿Cómo se correlaciona un desempeño deficiente en el Single Leg Stance Test con el riesgo de caídas en el adulto mayor operado de prótesis de cadera?"
        ],
        casoEtapa3: `"Paciente de 10 semanas post-PTC. En camilla alcanza M4 en abductores. Sin embargo, en el Single Leg Stance test sobre la pierna operada pierde el equilibrio a los 4 segundos y la pelvis cae bruscamente." Explica la disociación entre fuerza analítica MMT y control neuromuscular en carga.`,
        preguntasEtapa4: [
            "¿Qué es la inhibición muscular artrogénica (IAM) residual del glúteo medio a los 3 meses y cómo se diferencia de una denervación motora?",
            "¿Cuál es la diferencia de puntaje normativo en el TUG test entre un adulto sano de 70 años y uno con PTC exitosa a los 6 meses?",
            "¿Por qué la dinamometría manual isométrica (HHD) es más sensible que la escala de Daniels para detectar asimetrías de fuerza finas post-PTC?"
        ]
    },

    // ────────────── CATEGORÍA 4: FAI SINTOMÁTICO, LABRUM Y DAÑO CONDRAL ──────────────
    {
        id: "c4.1",
        nombre: "4.1 — Morfología Cam y Pincer",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Pinzamiento Femoroacetabular (FAI - Femoroacetabular Impingement): alteración morfométrica donde existe un contacto prematuro entre la cabeza/cuello femoral y el reborde acetabular durante los movimientos de cadera.
- Deformidad Tipo CAM (Leva): pérdida de la esfericidad de la cabeza femoral o asimetría en la unión cabeza-cuello femoral (prominencia ósea / "pistol-grip deformity"). Medida radiográfica: Ángulo Alfa >55°. Genera cizallamiento y desprendimiento del cartílago acetabular anterosuperior. Más frecuente en hombres jóvenes / deportistas de impacto.
- Deformidad Tipo PINCER (Tenaza): sobrecobertura focal o generalizada del acetábulo sobre la cabeza femoral (ej: retroversión acetabular, profundización acetabular / coxoprofunda). Medida radiográfica: Ángulo de Cobertura Lateral de Wiberg >40° o signo del cruzamiento (crossover sign). Genera compresión y aplastamiento del labrum. Más frecuente en mujeres de mediana edad.
- Deformidad Mixta (CAM + PINCER): presente en más del 70-80% de los casos sintomáticos de FAI.
- PREVALENCIA ASINTOMÁTICA CRÍTICA: hasta un 30-50% de la población deportista asintomática presenta morfología Cam o Pincer en radiografías/resonancia SIN tener dolor ni limitación. La imagen por sí sola NO es enfermedad.
`,
        preguntasEtapa2: [
            "Diferencia la patomecánica de daño tisular articular entre una morfología CAM y una morfología PINCER en la cadera.",
            "¿Qué es el Ángulo Alfa radiográfico y qué valor cuantitativo indica presencia de morfología Cam?",
            " Explica por qué la presencia aislada de una deformidad Cam en una radiografía NO equivale a diagnóstico de síndrome de FAI sintomático.",
            "¿Qué es el 'Signo del Cruzamiento' (Crossover Sign) en una radiografía AP de pelvis y qué alteración acetabular representa?"
        ],
        casoEtapa3: `"Deportista de 20 años acude asustado porque en una radiografía tomada por un golpe leve le encontraron 'Ángulo Alfa de 62° compatible con deformidad Cam'. Él no tiene ningún dolor, entrena fútbol normal y tiene rangos completos." Explícale Didácticamente la diferencia entre morfología y síndrome de FAI.`,
        preguntasEtapa4: [
            "¿Qué es la deformidad en 'empuñadura de pistola' (pistol-grip deformity) en el fémur proximal?",
            "¿Por qué la deformidad Cam destruye prioritariamente el cartílago articular en la zona de transición condrolabral anterosuperior?",
            "¿Qué es el Ángulo de Cobertura Lateral de Wiberg (LCEA) y cuáles son sus valores normales (25°-39°), de displasia (<20°) y de Pincer (>40°)?"
        ]
    },
    {
        id: "c4.2",
        nombre: "4.2 — Fisiopatología y diagnóstico del FAI sintomático",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Consenso de Warwick (2016) sobre Síndrome de FAI: su diagnóstico se apoya en la integración de síntomas, signos clínicos e imagen cuando corresponda; ninguna dimensión aislada confirma el diagnóstico.
  1. Síntomas del paciente (dolor inguinal/cadera relacionado con el movimiento o la postura).
  2. Signos físicos positivos a la exploración (restringido rango en flexión/RI + pruebas provocativas dolorosas).
  3. Hallazgos en imágenes compatibles (Radiografía AP pelvis / Falso perfil / Resonancia).
- Presentación Clínica Típica: dolor en ingle de inicio insidioso, agravado por posiciones de flexión + rotación interna combinadas (ej: sentarse en sillas bajas, conducir largas distancias, pivoteo en deportes como fútbol, básquetbol, artes marciales). Dolor referido en la forma de "Signo de la C" (mano sobre la cara lateral e inguinal de la cadera).
- Chasquidos o ruidos articulares (clicking / catching): sugiere fisura o desgarro del labrum acetabular asociado.
- Diagnóstico Diferencial: tendinopatía de aductores, pubalgia, iliopsoas, hernia inguinal, hernia discal lumbar L4-S1, sports hernia / athletic pubalgia.
`,
        preguntasEtapa2: [
            "¿Cuáles son los 3 elementos diagnósticos indispensables según el Consenso de Warwick (2016) para diagnosticar el Síndrome de FAI?",
            "Describa la presentación clínica típica del dolor por FAI y qué actividades de la vida diaria o deportiva lo exacerban.",
            "¿Cómo diferencias en la consulta el dolor por FAI de un dolor tendinoso de aductores o de iliopsoas?",
            "¿Qué representa el reporte de 'bloqueo mecánico o atrapamiento' (catching/locking) por parte del paciente?"
        ],
        casoEtapa3: `"Fútbolista de 23 años consulta por dolor inguinal profundo 6/10 tras entrenamientos que le impide patear de empeine y sentarse en el auto. En la imagen presenta Cam leve. El traumatólogo le dijo que 'si no se opera ahora tendrá artrosis en 2 años'." Evalúa la validez de esa afirmación y fundamenta la primera línea de manejo.`,
        preguntasEtapa4: [
            "¿Qué dice la evidencia científica sobre si la presencia de FAI conduce de forma inevitable a la coxartrosis en todos los pacientes?",
            "¿En qué consiste el 'Signo de la C' (C-Sign) en la palpación/localización del dolor por el paciente?",
            "¿Qué estudios de imagen específicos (ej. Proyección de Dunn a 45° o 90°) son superiores a la radiografía AP estándar para visualizar la girosidad Cam del cuello femoral?"
        ]
    },
    {
        id: "c4.3",
        nombre: "4.3 — Labrum, sello articular y lesiones condrales",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Biomecánica del Labrum Acetabular: fibrocartílago anular que profundiza el acetábulo, incrementa la estabilidad articular pasiva y actúa como un SELLO HIDRÁULICO que sella el líquido sinovial dentro de la cavidad.
- Función del Sello Hidráulico: mantiene una alta presión intraarticular que distribuye uniformemente las cargas sobre el cartílago y reduce la fricción ósea hasta en un 90%.
- Consecuencias del Desgarro Labral:
  - Pérdida del sello hidráulico $\rightarrow$ fuga de líquido sinovial $\rightarrow$ incremento de la presión directa sobre el cartílago acetabular $\rightarrow$ aceleración del desgaste condral (delaminación).
  - Microinestabilidad femoral pasiva.
- Tipos de roturas labrales: anterosuperiores (más comunes por FAI), desprendimiento de la unión condrolabral (wave sign / delaminación), roturas degenerativas.
- Prevalencia incidental: hallazgos de roturas labrales en Resonancia Magnética en sujetos ASINTOMÁTICOS alcanzan hasta un 38-54%. La presencia de un desgarro en la imagen SIN clínica no es indicación quirúrgica.
`,
        preguntasEtapa2: [
            "Explica la función del 'sello hidráulico' del labrum acetabular y las consecuencias biomecánicas de su pérdida tras una rotura.",
            "¿Por qué las lesiones labrales se ubican predominantemente en la región anterosuperior del acetábulo?",
            "¿Qué es la delaminación condral (efecto alfombra / wave sign) en la zona de transición condrolabral?",
            "¿Por qué un hallazgo de rotura labral en una Artro-RM debe interpretarse con cautela si el paciente no tiene clínica concordante?"
        ],
        casoEtapa3: `"Bailarina de 22 años consulta por chasquidos indolores en la cadera al realizar abducción extrema. Trae una Resonancia que muestra 'rotura parcial de labrum anterosuperior'. Ella no tiene dolor ni limitación." Diseña la educación clínica respecto al hallazgo en la imagen.`,
        preguntasEtapa4: [
            "¿Qué tipo de colágeno predomina en la estructura histológica del labrum acetabular (tipo I) versus el cartílago hialino articular (tipo II)?",
            "¿Qué es el signo de la ola ('wave sign') observado durante la artroscopia de cadera?",
            "¿Cómo se diferencia clínicamente un chasquido intraarticular por rotura labral de un chasquido extraarticular del tendón del psoas (coxa saltans interna)?"
        ]
    },
    {
        id: "c4.4",
        nombre: "4.4 — Evaluación clínica e imagenológica",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Pruebas Clínicas Provocativas Específicas de Cadera:
  1. FADIR Test (Flexión 90°, Aducción, Rotación Interna): provoca contacto entre cuello femoral y reborde acetabular anterosuperior. Alta Sensibilidad (90-99%), pero Baja Especificidad. (Excelente para DESCARTAR si es negativo; si es positivo no confirma FAI por sí solo).
  2. FABER Test / Patrick Test (Flexión, Abducción, Rotación Externa): mide dolor/distancia rodilla-camilla. Dolor anterior = sacroilíaca o cadera intraarticular; dolor posterior = sacroilíaca.
  3. Log Roll Test (Rotación pasiva interna/externa de extremidad extendida en supino): evalúa irritabilidad capsular intraarticular sin comprimir bordes óseos.
  4. Test de Thomas / Modified Thomas Test: explora la posición y tolerancia a extensión de cadera/rodilla; no diagnostica por sí solo "acortamiento" ni identifica la fuente del dolor.
- Estudio de Imagen:
  - Radiografía de Pelvis AP + Proyección de Dunn 45°/90°: para medir Ángulo Alfa (Cam), Ángulo Wiberg (Pincer/Displasia) y retroversión.
  - Artro-Resonancia Magnética (Artro-RM con gadolinio intraarticular): estudio que puede aportar información sobre labrum y cartílago cuando la pregunta clínica y la derivación médica lo justifican; sus hallazgos se interpretan junto a la clínica, no como diagnóstico aislado.
`,
        preguntasEtapa2: [
            "Describe la maniobra de FADIR test, su sensibilidad/especificidad clínica y la forma correcta de interpretar un resultado positivo.",
            " Explica la prueba del Log Roll (rodamiento de muslo en supino) y qué información otorga sobre la cápsula articular versus estructuras extraarticulares.",
            "¿Cómo utilizas la prueba de FABER para diferenciar clínicamente un dolor intraarticular de cadera de una disfunción de la articulación sacroilíaca?",
            "¿Por qué la proyección radiográfica de Dunn a 45° es superior a la radiografía anteroposterior estándar para detectar la deformidad Cam?"
        ],
        casoEtapa3: `"Paciente de 26 años. FADIR test es positivo reproduciendo dolor inguinal 5/10. Log Roll es negativo. Rango de RI es de 25° simétrico sin dolor. No practica deportes de pivoteo." Analiza la validez diagnóstica de FADIR en este contexto.`,
        preguntasEtapa4: [
            "¿Qué valor de Especificidad tiene la prueba FADIR aislada para diagnóstico de FAI (aprox 20-30%) y por qué genera falsos positivos en personas sanas?",
            "¿Qué es la prueba de aprehensión anterior de cadera y en qué posición de movimiento se ejecuta?",
            "¿Qué hallazgo en la Artro-RM confirma una extravasación de contraste a través de la unión condrolabral?"
        ]
    },
    {
        id: "c4.5",
        nombre: "4.5 — Tratamiento conservador",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Evidencia (Ensayos Clínicos Personalised Hip Therapy - PHT vs Artroscopia, ej: Estudio UK FashIoN 2018 / FORTH 2022): el tratamiento conservador basado en kinesiología supervisada de alta calidad demuestra mejoras significativas en dolor y función comparables a la cirugía a mediano plazo en un gran porcentaje de pacientes.
- Pilares del Tratamiento Kinesiológico del FAI:
  1. Modificación del patrón de carga y educación ergonómica: evitar temporalmente posiciones de pinzamiento (flexión profunda >90° + aducción + RI), adaptar altura de asientos, modificar técnica de sentadilla.
  2. Control Neuromuscular Lumbopélvico y Estabilizadores profundos: fortalecer glúteo mayor, abductores y rotadores profundos (obturadores/gemelos) para centrar dinámicamente la cabeza femoral y evitar la traslación anterior.
  3. Modulación de carga de flexores y abductores superficiales (Iliopsoas y TFL): reducir la irritabilidad inicial y mejorar la tolerancia al movimiento.
  4. Exposición Progresiva a la carga y rango: reintroducción gradual de la flexión profunda y rotación interna bajo control de dolor (≤3/10).
`,
        preguntasEtapa2: [
            "¿Cuáles son los 3 pilares del tratamiento conservador kinesiológico en el Síndrome de FAI según los ensayos clínicos contemporáneos (ej: UK FashIoN)?",
            " Explica por qué el fortalecimiento de los rotadores profundos de cadera (obturadores, gemelos) ayuda a reducir el choque biomecánico en FAI.",
            "¿Cómo adaptas ergonómicamente las actividades laborales y de entrenamiento de un deportista con FAI sintomático en la fase reactiva?",
            "¿Qué estrategia de ejercicio utilizas para optimizar la coactivación del Glúteo Medio y reducir la irritabilidad sintomática del TFL en FAI?"
        ],
        casoEtapa3: `"Crossfitter de 27 años con FAI Cam sintomático. Su dolor inguinal 6/10 ocurre al hacer sentadillas profundas (deep squat). Se niega a dejar de entrenar." Diseña las modificaciones inmediatas de su sentadilla (rango, stance, carga) y su plan neuromuscular de 4 semanas.`,
        preguntasEtapa4: [
            "¿Qué demostró el ensayo clínico controlado FashIoN (2018) respecto a la comparación entre terapia física personalizada y artroscopia a los 12 meses?",
            "¿Por qué ensanchar el ancho de los pies (stance) y rotar levemente los pies hacia afuera en la sentadilla reduce el choque en morfologías Cam?",
            "¿Qué parámetros de control del dolor en escala EVA (≤3/10) se autorizan durante la exposición progresiva a rangos provocativos?"
        ]
    },
    {
        id: "c4.6",
        nombre: "4.6 — Artroscopia de cadera y rehabilitación",
        categoria: "FAI y Labrum",
        contenidoBase: `
- Procedimientos artroscópicos comunes: Osteocondroplastia femoral (resurtido de prominencia Cam), Acetabuloplastia (recorte de borde Pincer), Reparación/Reinserción labral con anclas (evitando la labrectomía / resección pura siempre que sea posible para preservar el sello hidráulico) y Plicatura / Sutura capsular.
- Fases de Rehabilitación Post-Artroscopia de Cadera:
  - Fase 1: Protección de la Reparación y Cicatrización Capsular (Semanas 0 a 3-4): uso de muletas con carga parcial (20-30% peso corporal), prevención de adherencias capsulares (movilización pasiva precoz en CPM o bicicleta sin resistencia), restricción estricta de extensión extrema y RE pasiva si hubo sutura capsular.
  - Fase 2: Ganancia de Rango Completo e Independencia de Marcha (Semanas 4 a 8): retiro de muletas, activación progresiva de glúteos en cadena cerrada, control lumbopélvico.
  - Fase 3: Fuerza Avanzada y Control Neuromuscular (Semanas 8 a 12): estocadas, peso muerto, agilidad.
  - Fase 4: Retorno Deportivo / Criterios de progresión (orientativamente semanas 12 a 24+): exposición gradual a tareas del deporte, fuerza y pruebas funcionales relevantes, síntomas, confianza y autorización del equipo tratante. El LSI es una pieza de la decisión, no un umbral único.
`,
        preguntasEtapa2: [
            "¿Por qué se prefiere la REPARACIÓN / REINSERCIÓN del labrum acetabular mediante anclas sobre la labrectomía (resección)?",
            " Describe las precauciones de movimiento y carga de peso durante las primeras 3 semanas post-artroscopia con reparación labral y sutura capsular.",
            "¿Cómo previenes la formación de adherencias capsulares tempranas entre el labrum reparado y la cápsula sin vulnerar la reparación?",
            "¿Qué conjunto de datos —tolerancia a carga, fuerza, pruebas funcionales relevantes, confianza, demanda del deporte y autorización médica— integrarías para progresar al deporte de pivoteo?"
        ],
        casoEtapa3: `"Semana 2 post-artroscopia de cadera (reparación labral + osteocondroplastia Cam). El paciente acude sin muletas porque 'ya no siente dolor' y estuvo haciendo extensiones activas de cadera pesadas en su casa." Evalúa el riesgo sobre la cápsula/labrum y re-establece las precauciones.`,
        preguntasEtapa4: [
            "¿Qué es la plicatura capsular artroscópica y en qué tipo de pacientes (ej. microinestabilidad / laxitud) está indicada?",
            "¿Cuál es el riesgo de desarrollar osificación heterotópica post-artroscopia de cadera y qué profilaxis farmacológica se utiliza (ej: Naproxeno)?",
            "¿Qué pruebas funcionales son pertinentes para ese deporte y por qué una prueba o un porcentaje aislado no basta para decidir un retorno competitivo?"
        ]
    },

    // ────────────── CATEGORÍA 5: DISPLASIA E INESTABILIDAD DE CADERA ──────────────
    {
        id: "c5.1",
        nombre: "5.1 — Displasia acetabular y distribución de carga",
        categoria: "Displasia e Inestabilidad",
        contenidoBase: `
- Displasia Acetabular del Adulto: alteración estructural donde el acetáculo es poco profundo o inclinado, dejando la cabeza femoral sin una cobertura ósea adecuada (especialmente anterosuperior o lateral).
- Criterio Radiográfico: Ángulo de Cobertura Lateral de Wiberg (LCEA) <20° indica displasia definitiva (20°-25° = displasia límite o borderline dysplasia).
- Patomecánica de Daño Tisular:
  - Al haber menor área de contacto óseo $\rightarrow$ la Fuerza de Reacción Articular (JRF) se concentra en una superficie reducida del cartílago anterosuperior $\rightarrow$ sobrecarga extrema sobre el labrum acetabular (que intenta hipertrofiarse para actuar como 'tope' de contención).
  - Riesgo acelerado de rotura labral degenerativa y artrosis precoz.
- Más frecuente en mujeres jóvenes con hipermovilidad articular.
`,
        preguntasEtapa2: [
            "Explica la patomecánica de distribución de cargas sobre el labrum y cartílago en una cadera con displasia acetabular (LCEA <20°).",
            "¿Por qué en la displasia de cadera el labrum acetabular sufre una hipertrofia compensatoria antes de romperse?",
            "Diferencia el comportamiento biomecánico de una cadera con FAI Cam versus una cadera con Displasia Acetabular.",
            "¿Qué hallazgos radiográficos caracterizan a la displasia límite o borderline (LCEA 20°-25°)?"
        ],
        casoEtapa3: `"Paciente mujer de 24 años con dolor inguinal profundo. Su radiografía muestra LCEA de 17° (Displasia severa) y labrum hipertrófico desgarado. Su traumatólogo quiere hacerle una artroscopia para recortar el labrum sobrante." Evalúa el riesgo biomecánico de resecar el labrum en esta paciente.`,
        preguntasEtapa4: [
            "¿Por qué la labrectomía (recorte del labrum) en una cadera displásica conduce catastróficamente a la subluxación femoral y artrosis veloz?",
            "¿Qué es el índice acetabular de profundidad e inclinación anterior?",
            "¿Cómo influye la anteversión femoral acompañada en el pronóstico funcional de la displasia?"
        ]
    },
    {
        id: "c5.2",
        nombre: "5.2 — Microinestabilidad, cápsula e hipermovilidad",
        categoria: "Displasia e Inestabilidad",
        contenidoBase: `
- Microinestabilidad de Cadera: laxitud o desplazamiento sintomático excesivo de la cabeza femoral dentro del acetábulo durante el movimiento funcional, sin llegar a la luxación traumática franca.
- Causas: Atrición / laxitud capsular traumática o por microtrauma repetitivo (ej: bailarinas, gimnastas, practicantes de yoga con rotaciones/extensiones extremas), displasia acetabular subyacente o Síndrome de Hipermovilidad Articular (ej: Ehlers-Danlos / Beighton Score ≥5/9).
- Síntomas: sensación de 'cadera suelta', 'que se va de lugar', chasquidos repetitivos sin dolor agudo al inicio, fatigabilidad del glúteo medio y dolor inguinal/glúteo difuso tras estar de pie.
- Rol del Control Muscular Dinámico: al fallar los estabilizadores pasivos (hueso y cápsula), la estabilidad depende 100% de los estabilizadores dinámicos (glúteos, rotadores profundos, iliopsoas, musculatura abdominal/core).
`,
        preguntasEtapa2: [
            "¿Qué es la microinestabilidad de cadera y qué diferencia existe entre una inestabilidad traumática versus una por atrición capsular?",
            "Explica cómo se utiliza la Escala de Beighton para evaluar la hipermovilidad sistémica y su impacto en la cadera.",
            "¿Por qué en una persona con sospecha de microinestabilidad conviene evitar al inicio estiramientos agresivos o de fin de rango que reproduzcan síntomas, y cómo decidirías la dosis de movilidad?",
            "¿Cómo plantearías fuerza, control de tarea y exposición progresiva en una persona con laxitud capsular, sin atribuir el dolor a un único supuesto de 'centrado' femoral?"
        ],
        casoEtapa3: `"Bailarina de 19 años con Beighton Score 7/9. Consulta por dolor inguinal y sensación de que la cadera 'se desencaja' al hacer extensiones. Su profesor le pide que estire más la cadera abriendo de piernas." Explica por qué no indicarías de entrada mayor amplitud sin evaluación, qué datos buscarías y cómo priorizarías fuerza, control y exposición gradual.`,
        preguntasEtapa4: [
            "¿Qué prueba clínica específica (ej. Abduction-Hyperextension-External Rotation Test / AHRE test) evalúa la inestabilidad anterior de cadera?",
            "¿Por qué el músculo Iliopsoas incrementa su actividad electromiográfica de coactivación en pacientes con microinestabilidad anterior como mecanismo protector?",
            "¿Qué es la plicatura capsular y qué efecto tiene sobre el volumen de la cavidad articular?"
        ]
    },
    {
        id: "c5.3",
        nombre: "5.3 — Evaluación y diferenciación respecto de FAI",
        categoria: "Displasia e Inestabilidad",
        contenidoBase: `
- Cuadro Comparativo Diagnóstico: FAI Sintomático vs Displasia / Microinestabilidad:
  - FAI: choque/pinzamiento por exceso de hueso o cobertura. Rango restringido (RI <15° dolorosa). FADIR marcadamente positivo por compresión.
  - Displasia/Inestabilidad: falta de cobertura o laxitud capsular. Rangos excesivos / hipermovilidad (RI >40°, extensión aumentada). FADIR puede ser positivo por pellizcamiento labral por subluxación, pero las PRUEBAS DE APREHENSIÓN Y EXTENSIÓN SON LAS PATOGNOMÓNICAS.
- Pruebas Específicas de Inestabilidad:
  1. Pruebas de Aprehensión Anterior de Cadera (Hip Anterior Apprehension Test): cadera en extensión + RE pasiva $\rightarrow$ paciente siente temor o aprensión de que la cadera se desencaje.
  2. Pruebas de Recoil / Prono Instability Test (HEER Test - Hyperextension External Rotation Test).
  3. Trochanteric Sheet Test / Relocation Test de Cadera.
`,
        preguntasEtapa2: [
            "Cómo diferencias clínicamente en el box a un paciente con FAI de uno con Displasia/Microinestabilidad en base a la evaluación del Rango de Movimiento (ROM)?",
            "Describe la prueba de Aprehensión Anterior de Cadera y qué respuesta del paciente confirma la positividad del test.",
            "¿Por qué la prueba de FADIR puede dar falsa positividad en una cadera con displasia y cómo evitas el error diagnóstico?",
            "¿Qué importancia tiene la evaluación del control lumbopélvico en bipedestación para diferenciar una basculación de origen inestable?"
        ],
        casoEtapa3: `"Paciente de 21 años consulta por dolor inguinal. Trae una orden de Kinesiología que dice 'Tratar FAI'. Al evaluar: Flexión 130°, RI 45°, Beighton 6/9. El FADIR genera molestia pero la extensión con RE pasiva le genera pánico de que 'se le salga la cadera'." Corrije la hipótesis diagnóstica.`,
        preguntasEtapa4: [
            "¿Por qué tratar a un paciente displásico inestable con el protocolo rígido de FAI (evitar flexión sin entrenar estabilidad extrema) fracasa funcionalmente?",
            "¿Qué hallazgo en la resonancia magnética (ej. ligamento redondo hipertrófico o extravasado) sugiere inestabilidad crónica?",
            "¿Qué relación existe entre la anteversión femoral (ángulo >20°) y la marcha en in-toeing (pies hacia adentro) como compensación de estabilidad?"
        ]
    },
    {
        id: "c5.4",
        nombre: "5.4 — Tratamiento conservador, osteotomía periacetabular y rehabilitación",
        categoria: "Displasia e Inestabilidad",
        contenidoBase: `
- Tratamiento Conservador kinesiológico en Displasia / Microinestabilidad:
  - Pilar 1: Estabilización Dinámica de alta exigencia (reforzar Glúteo Medio, Mayor, Obturadores, Cuadrado Femoral y Abdominales profundos para actuar como 'cápsula muscular artificial').
  - Pilar 2: PROHIBICIÓN ABSOLUTA de estiramientos pasivos de cadera en rangos finales.
  - Pilar 3: entrenamiento de control postural y de tareas en bipedestación, evitando depender de posiciones de fin de rango que provoquen síntomas.
- Osteotomía Periacetabular (PAO - Periacetabular Osteotomy de Ganz):
  - Cirugía preservadora mayor en displasia moderada/severa sin artrosis avanzada. Consiste en realizar cortes óseos alrededor del acetábulo para reorientarlo y aumentar la cobertura sobre la cabeza femoral.
  - Rehabilitación Post-PAO: protección estricta de carga de peso (carga parcial 20-30% con 2 muletas por 6-8 semanas hasta consolidación ósea), consolidación de la osteotomía, ganancia gradual de rango y fortalecimiento agresivo posterior.
`,
        preguntasEtapa2: [
            "¿Cuáles son los pilares del tratamiento kinesiológico conservador en la microinestabilidad y cómo dosificarías movilidad sin agravar síntomas?",
            "¿En qué consiste la Osteotomía Periacetabular (PAO) de Ganz y cuáles son sus indicaciones quirúrgicas?",
            " Explica la progresión de carga de peso y precauciones biomecánicas durante las primeras 8 semanas post-PAO.",
            "¿Cómo planteas fuerza, control de tarea y exposición progresiva en una persona con displasia, sin atribuir el dolor a un único supuesto de 'centrado' femoral?"
        ],
        casoEtapa3: `"Paciente de 25 años sometida a Osteotomía Periacetabular (PAO) izquierda hace 4 semanas. Acude a la consulta apoyando todo el peso sin muletas porque se siente fuerte. Trae dolor en la zona de las osteotomías." Evalúa la conducta de la paciente y explica el riesgo de no consolidación.`,
        preguntasEtapa4: [
            "¿Qué tiempo promedio tarda la consolidación ósea de los cortes osteotómicos en una PAO antes de autorizar la marcha con carga completa?",
            "¿Qué neuropatía motora/sensitiva (ej. nervio femoral o cutáneo femoral lateral) debe evaluarse tras una PAO?",
            "¿Qué criterios clínicos indican que una cadera displásica ha evolucionado a coxartrosis y ya no es candidata a PAO sino a artroplastia (PTC)?"
        ]
    },

    // ────────────── CATEGORÍA 6: DOLOR LATERAL DE CADERA ──────────────
    {
        id: "c6.1",
        nombre: "6.1 — Tendinopatía glútea: fisiopatología y compresión",
        categoria: "Dolor Lateral de Cadera",
        contenidoBase: `
- Síndrome Doloroso del Trocánter Mayor (GTPS - Greater Trochanteric Pain Syndrome): término inclusivo que abarca la tendinopatía del Glúteo Medio y Menor, con o sin bursitis trocantérica secundaria.
- Patomecánica Principat de la Tendinopatía Glutéala:
  - NO es un proceso puramente inflamatorio ('tendinitis'), sino una degradación por sobrecarga de la entesis tendinosa.
  - Mecanismo Combinado de Daño: Carga Tensil (tracción muscular) + **CARGA COMPRESIVA** del tendón contra la faceta lateral del trocánter mayor.
  - La compresión aumenta dramáticamente en rangos de ADUCCIÓN de cadera (ej: cruzar las piernas al sentarse, dormir en decúbito lateral sobre el lado sano sin cojín entre las rodillas dejando caer la pierna superior en aducción, caminar con marcha en valgo/pelvis caída).
- Más frecuente en mujeres >50 años (factores hormonales post-menopáusicos y mayor ancho pélvico / ángulo Q pélvico).
`,
        preguntasEtapa2: [
            "Explica la diferencia entre la carga tensil y la carga COMPRESIVA sobre el tendón del glúteo medio en la entesis trocantérica.",
            "¿Cuáles son las posturas de la vida diaria que incrementan la compresión del tendón glutéalo y cómo las modificas?",
            "¿Por qué las mujeres post-menopáusicas presentan una prevalencia significativamente mayor de tendinopatía glutéala?",
            "¿Por qué los estiramientos pasivos de la banda iliotibial / aducción empeoran los síntomas de una tendinopatía glutéala reactiva?"
        ],
        casoEtapa3: `"Doña Silvia, 58 años, consulta por dolor lateral severo 7/10 en el trocánter derecho. Refiere que el dolor despierta por la noche al dormir sobre el lado izquierdo y que su kinesiólogo anterior le daba estiramientos cruzando la pierna derecha por detrás de la izquierda." Corrije el manejo ergonómico y de ejercicio.`,
        preguntasEtapa4: [
            "¿Cómo altera la caída de estrógenos en la menopausia la síntesis de colágeno tipo I y el contenido de glucosaminoglicanos en los tendones?",
            "¿Qué zona anatómica específica de la entesis del glúteo medio (faceta superoposterior) sufre la mayor compresión contra el trocánter?",
            "¿Qué diferencia la respuesta biológica de una tendinopatía reactiva de una tendinopatía desestructurada (degenerativa) según el modelo de Cook & Purdam?"
        ]
    },
    {
        id: "c6.2",
        nombre: "6.2 — Evaluación clínica y diagnóstico diferencial del GTPS",
        categoria: "Dolor Lateral de Cadera",
        contenidoBase: `
- Evaluación Clínica Específica de GTPS / Tendinopatía Glutéala (Batería diagnóstica de alta precisión):
  1. Palpación directa sobre la faceta anterolateral y superoposterior del trocánter mayor: reproductora del dolor (Alta Sensibilidad).
  2. Single Leg Stance Test (Apoyo Unipodal durante 30 segundos): induce contracción del glúteo medio + compresión. Positivo si reproduce dolor trocantérico antes de los 30s.
  3. Prueba de FADDER / FADDER con resistencia (Flexión, ADducción, Rotación Externa o Interna resistida): posiciona el tendón en compresión y exige contracción tensil.
  4. Resisted Hip Abduction Test en decúbito lateral o supino.
- Diagnóstico Diferencial Obligatorio:
  - Coxartrosis intraarticular (dolor inguinal en C, patrón capsular restricted vs dolor puramente lateral en GTPS).
  - Radiculopatía Lumbar L4-L5 (dolor que proviene de columna, parestesias, Lasegue/SLR positivo).
  - Coxa Saltans externa (resalte de la banda iliotibial sobre el trocánter).
`,
        preguntasEtapa2: [
            " Describe las 3 pruebas clínicas de mayor especificidad/sensibilidad para diagnosticar una Tendinopatía Glutéala en el box.",
            " Explica cómo realizas el diagnóstico diferencial clínico entre un GTPS lateral y una radiculopatía lumbar L5.",
            "¿Cómo utilizas la prueba de apoyo unipodal (Single Leg Stance 30s) como test provocativo de carga?",
            "¿Qué hallazgos en la palpación te permiten diferenciar una tendinopatía glutéala pura de una bursitis trocantérica aislada?"
        ],
        casoEtapa3: `"Paciente de 54 años con dolor lateral en cadera izquierda. En camilla: Palpación trocantérica positiva 6/10. Single Leg Stance a los 10 segundos reproduce el dolor trocantérico. Rango de cadera pasivo es completo e indoloro. Refiere dolor lumbar leve ocasional." Sintetiza el diagnóstico.`,
        preguntasEtapa4: [
            "¿Cuál es el valor predictivo positivo (VPP) del test de Single Leg Stance de 30 segundos sostenido cuando se combina con la palpación trocantérica?",
            "¿Qué es la bolsa trocantérica profunda y en qué porcentaje se encuentra inflamada de forma secundaria en los hallazgos de ecografía?",
            "¿Cómo descarta la prueba de elevación de pierna recta (SLR / Lasegue) la participación del dermatoma L5 en el dolor lateral?"
        ]
    },
    {
        id: "c6.3",
        nombre: "6.3 — Ejercicio y manejo de carga",
        categoria: "Dolor Lateral de Cadera",
        contenidoBase: `
- Protocolo de Manejo de Carga Basado en Evidencia (Estudios LEAP Trial - Ganderton & Mellor 2018): el ejercicio de carga progresiva + educación para evitar la compresión demuestra una efectividad significativamente superior a las inyecciones de corticoides y a la onda de choque a largo plazo.
- Pilares del Tratamiento:
  1. Educación Anti-Compresión (Inmediata):
     - PROHIBIDO cruzar las piernas al sentarse.
     - Dormir en decúbito lateral con 1 o 2 cojines gruesos entre las rodillas y tobillos para mantener la cadera superior en posición neutra.
     - Evitar pararse cargando todo el peso en una sola cadera descolgada ('hip hanging').
  2. Progresión de Ejercicios por Fases:
     - Fase Reactiva / Alta Irritabilidad: ISOMÉTRICOS EN POSICIÓN NEUTRA (ej: abducción isométrica en supino o decúbito lateral con almohada entre las piernas, o empuje lateral contra la pared en bipedestación). 45 segundos x 5 series, 2-3 veces/día (efecto analgésico).
     - Fase Subaguda: Fortalecimiento de Carga Progresiva Heavy Slow Resistance (HSR) en posición neutra (abducción en decúbito lateral con almohada, puente bi-podal con banda, step-ups de baja altura).
     - Fase Funcional: Ejercicios unipodales y retorno a la caminata/carrera rápida evitando la caída pélvica.
`,
        preguntasEtapa2: [
            "¿Cuáles son los 3 componentes del tratamiento educativo anti-compresión del ensayo clínico LEAP (2018) para tendinopatía glutéala?",
            "Explica la dosificación exacta (tiempo de sostén, series, frecuencia) de los ejercicios isométricos analgésicos en posición neutra.",
            "¿Por qué los ejercicios de abducción en decúbito lateral DEBEN realizarse con una almohada entre las rodillas en las fases iniciales?",
            "¿Qué nos dice la evidencia científica sobre la infiltración de corticoides versus el ejercicio de carga en la tendinopatía glutéala a 12 meses?"
        ],
        casoEtapa3: `"Paciente de 52 años con tendinopatía glutéala reactiva muy dolorosa (EVA 7/10). No soporta el ejercicio dinámico. Diseña su plan de las primeras 48 horas incluyendo ejercicios isométricos analgésicos y pautas ergonómicas de sueño."`,
        preguntasEtapa4: [
            "¿Qué demostró el ensayo clínico LEAP (Mellor et al. 2018 BMJ) respecto a la tasa de éxito del grupo de Educación + Ejercicio (77%) vs Corticoides (58%) vs Esperar y ver (29%) a las 52 semanas?",
            "¿Cómo actúa la inhibición por carga isométrica sobre la actividad nociceptiva de la entesis en la tendinopatía reactiva?",
            "¿Cuándo se autoriza progresar de ejercicios isométricos en posición neutra a ejercicios isotónicos HSR?"
        ]
    },
    {
        id: "c6.4",
        nombre: "6.4 — Desgarros glúteos parciales y completos",
        categoria: "Dolor Lateral de Cadera",
        contenidoBase: `
- Roturas o Desgarros del Tendón del Glúteo Medio y Menor ('Rotura del Manguito Rotador de la Cadera'):
  - Etiología: degradación tendinosa crónica de larga evolución (tendinosis no tratada) o traumatismo agudo en rotación/abducción.
  - Presentación Clínica: dolor trocantérico severo constante + DEBILIDAD MARCADA E INCAPACIDAD PARA ABDUCIR LA CADERA contra gravedad (MMT ≤2-3) + claudicación de Trendelenburg severa e incompensable.
- Diagnóstico por Imagen: Resonancia Magnética o Ecografía de alta resolución.
- Manejo Kinesiológico y Quirúrgico:
  - Desgarros Parciales (<50% del espesor): Tratamiento conservador intensivo de manejo de carga, fortalecimiento del glúteo menor, tensor de la fascia lata y glúteo mayor compensatorio.
  - Desgarros completos o avulsiones pueden requerir valoración traumatológica. La indicación quirúrgica depende de síntomas, función, retracción, calidad tendinosa, demanda y decisión especializada; un porcentaje aislado no decide por sí solo.
  - Rehabilitación Post-Reparación Glutéala: uso de muletas con carga parcial por 6 semanas, restricción estricta de aducción activa/pasiva y abducción activa contra gravedad durante 6-8 semanas para proteger las suturas.
`,
        preguntasEtapa2: [
            "¿Qué hallazgos en la evaluación de fuerza (MMT) y marcha te hacen sospechar de una rotura completa del tendón del glúteo medio versus una tendinopatía reactiva?",
            "Diferencia el manejo kinesiológico entre un desgarro parcial glutéalo (<50%) y un desgarro completo avulsivo.",
            "¿Cuáles son las precauciones de movimiento y contracción muscular en las primeras 6 semanas post-reparación quirúrgica del glúteo medio?",
            "¿Qué rol compensatorio asume el Glúteo Mayor (fibras superiores) y el Tensor de la Fascia Lata ante una rotura del Glúteo Medio?"
        ],
        casoEtapa3: `"Paciente de 66 años acude a las 3 semanas de ser operada de reparación abierta del tendón del glúteo medio derecho con anclas. El kinesiólogo anterior le estaba haciendo realizar abducción activa en decúbito lateral contra gravedad pesada." Evalúa la conducta y ajusta las precauciones.`,
        preguntasEtapa4: [
            "¿Por qué se denomina al desgarro del glúteo medio el 'manguito rotador de la cadera' (rotator cuff of the hip)?",
            "¿Qué porcentaje de retracción tendinosa en la RM se considera un criterio de irreparabilidad quirúrgica primaria?",
            "¿Cómo se progresa el entrenamiento de fuerza de abducción en supino con deslizamiento en la semana 7 post-quirúrgica?"
        ]
    },
    {
        id: "c6.5",
        nombre: "6.5 — Resalte externo y participación bursal",
        categoria: "Dolor Lateral de Cadera",
        contenidoBase: `
- Coxa Saltans Externa (Resalte Lateral de Cadera):
  - Mecanismo Biomecánico: deslizamiento o salto palpable/audible del borde anterior de la Banda Iliotibial (BIT) o del borde anterior del Glúteo Mayor sobre la prominencia de la faceta lateral del Trocánter Mayor durante la flexión y extensión de cadera.
- Resalte Asintomático vs Síndrome Doloroso:
  - Resalte Asintomático: muy común en adolescentes, bailarinas y deportistas. NO REQUIERE TRATAMIENTO NI INTERVENCIÓN. Es una variante biomecánica indolora. EDUCAR Y TRANQUILIZAR.
  - Resalte Sintomático / Doloroso: cuando el resalte repetitivo genera fricción e irritación secundaria de la bursa trocantérica profunda o de la entesis tendinosa, provocando dolor agudo e inflamación.
- Manejo Kinesiológico del Resalte Sintomático:
  - Modificación de actividades de fricción repetitiva.
  - Control neuromuscular de la rotación de cadera (evitar la marcha en rotación interna excesiva que aumenta el resalte).
  - Fortalecimiento de glúteo mayor y medio para mejorar el vector de tracción de la fascial lata.
  - El estiramiento pasivo agresivo de la BIT NO resuelve el resalte y puede aumentar la compresión.
`,
        preguntasEtapa2: [
            "Diferencia clínicamente la Coxa Saltans Externa (Resalte Lateral) de la Coxa Saltans Interna (Resalte de Psoas).",
            "¿Por qué un resalte o chasquido lateral de cadera que es totalmente INDOLORO no debe ser considerado una patología ni requiere tratamiento?",
            " Explica la prueba dinámica en bipedestación o decúbito lateral para reproducir el resalte de la banda iliotibial sobre el trocánter.",
            "¿Qué estrategias de control neuromuscular de la marcha reducen el roce de la banda iliotibial sobre el trocánter mayor?"
        ],
        casoEtapa3: `"Joven deportista de 17 años acude asustada porque siente un 'salto audible' en la cara lateral de la cadera derecha cada vez que camina o sube escaleras. No siente ningún dolor (0/10) ni molestia física pero su entrenador le dijo que 'se le va a romper la cadera'." Diseña tu abordaje didáctico y educativo.`,
        preguntasEtapa4: [
            "¿Qué estructura anatómica secciona la técnica quirúrgica de plastia en Z (Z-plasty) cuando se opera un resalte externo recalcitrante doloroso?",
            "¿Por qué la banda iliotibial no es una estructura fácilmente 'estirable' mediante terapia manual debido a su módulo de elasticidad histológico?",
            "¿Cómo influye la debilidad del Glúteo Mayor en el aumento de tensión del Tensor de la Fascia Lata y su banda iliotibial asociada?"
        ]
    },

    // ────────────── CATEGORÍA 7: DOLOR INGUINAL, ANTERIOR Y POSTERIOR EXTRAARTICULAR ──────────────
    {
        id: "c7.1",
        nombre: "7.1 — Dolor relacionado con aductores",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Dolor Inguinal Relacionado con Aductores (Consenso de Doha 2015 sobre dolor inguinal en deportistas): la causa más frecuente de dolor inguinal en deportes de cambios de dirección, patadas y pivoteo (fútbol, rugby).
- Anatomía Afectada: inserción/entesis del tendón del Aductor Largo (Adductor Longus) en la sínfisis del pubis y pectíneo.
- Criterios Diagnósticos del Consenso de Doha para Dolor de Aductores:
  1. Dolor a la palpación directa sobre los tendones aductores / inserción en el pubis.
  2. Dolor reproducido con la prueba de aducción resistida (Adductor Squeeze Test en 0°, 45° o 90° de flexión de rodilla/cadera).
- Tratamiento Basado en Evidencia (Protocolo de Holmich / Protocolo de Copenhagen Hip and Groin Outcome Score):
  - El ejercicio de fuerza progresiva de aductores (ejercicio Copenhagen Adduction) demuestra tasas de retorno al deporte superiores al 80-90% comparado con el reposo o la kinesiología pasiva.
  - Progresión: Isométricos de aducción $\rightarrow$ Copenhagen adduction asistido $\rightarrow$ Copenhagen completo $\rightarrow$ HSR $\rightarrow$ Ejercicios de cambios de dirección y golpeo de balón.
`,
        preguntasEtapa2: [
            "Cuáles son los 2 criterios clínicos diagnósticos obligatorios según el Consenso de Doha (2015) para clasificar el dolor inguinal relacionado con aductores?",
            "Describe el Adductor Squeeze Test (Prueba de compresión de aductores) en sus diferentes ángulos y qué información otorga.",
            " Explica la ejecución y progresión del Ejercicio de Aducción de Copenhagen (Copenhagen Adduction Exercise) y su nivel de evidencia.",
            "¿Por qué el reposo deportivo absoluto fracasa en la resolución a largo plazo de la tendinopatía de aductores?"
        ],
        casoEtapa3: `"Futbolista de 22 años con dolor inguinal derecho de 4 semanas. Palpación del aductor largo positiva 6/10. Squeeze test a 45° reproduce dolor exacto 7/10. Maniobras intraarticulares de cadera son negativas." Diseña la progresión de ejercicios de aducción de las semanas 1 a 4.`,
        preguntasEtapa4: [
            "¿Qué demostró el estudio clásico de Holmich et al. respecto al ejercicio activo vs terapia física pasiva en pubalgia/aductores?",
            "¿Cómo se mide la fuerza isométrica de aductores mediante esfigmomanómetro o dinamómetro en el Squeeze Test?",
            "¿Qué relación anatómica existe entre el aponeurosis del aductor largo y la inserción del recto abdominal en la sínfisis púbica (complejo placa aductor-recto)?"
        ]
    },
    {
        id: "c7.2",
        nombre: "7.2 — Iliopsoas y resalte interno",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Dolor Inguinal Relacionado con el Iliopsoas (Consenso de Doha 2015):
  - Criterios Diagnósticos: Dolor a la palpación profunda del psoas en la fosa ilíaca o bajo el ligamento inguinal + Dolor reproducido con la flexión activa resistida de cadera o con el estiramiento en extensión (Test de Thomas).
- Coxa Saltans Interna (Resalte Interno de Cadera):
  - Mecanismo: chasquido o salto audible/palpable del tendón del Iliopsoas al deslizarse sobre la eminencia iliopectínea del hueso pélvico o sobre la cabeza femoral al pasar de flexión/abducción/RE a extensión/aducción/RI.
  - Resalte Interno Asintomático: muy común en bailarinas y gimnastas; no requiere intervención si no hay dolor.
  - Bursitis del Iliopsoas Sintomática: la fricción repetitiva distiende la bursa iliopectínea (la bursa más grande del cuerpo, en comunicación con la articulación en un 15% de las personas), generando dolor inguinal anterior profundo.
- Tratamiento Kinesiológico EBM: gestión de carga progresiva de flexores de cadera (ejercicios isométricos iniciales e isotónicos de Iliopsoas), fortalecimiento de extensores de cadera (Glúteo Mayor) para optimizar el control neuromuscular dinámico y modificación ergonómica de rangos de flexión extrema repetitiva.
`,
        preguntasEtapa2: [
            "Cuáles son los criterios del Consenso de Doha para clasificar el dolor relacionado con el Iliopsoas?",
            " Explica el mecanismo biomecánico del resalte interno de cadera (Coxa Saltans Interna) y sobre qué estructuras salta el tendón del psoas.",
            "¿Cómo realizas el diagnóstico diferencial entre un resalte interno del psoas y un chasquido intraarticular por rotura labral?",
            "¿Por qué la hiperactividad compensatoria del Iliopsoas suele asociarse a una inhibición artrogénica del Glúteo Mayor (arthrogenic muscle inhibition)?"
        ],
        casoEtapa3: `"Bailarina de 20 años presenta chasquido doloroso 5/10 en la cara anterior de la ingle al bajar la pierna desde un passe o grand battement. La palpación en la fosa ilíaca es muy sensible." Diagnostica la estructura afectada y propón 2 ejercicios de reeducación neuromuscular.`,
        preguntasEtapa4: [
            "¿En qué porcentaje de personas la bursa iliopectínea comunica directamente con la cavidad articular coxofemoral?",
            "¿Qué prueba clínica dinámica (movimiento de flexión-abducción-RE a extensión-aducción-RI) reproduce el resalte del psoas en el box?",
            "¿Cómo influye la anteversión pélvica excesiva en la tensión de reposo del músculo Iliopsoas?"
        ]
    },
    {
        id: "c7.3",
        nombre: "7.3 — Dolor relacionado con pubis y canal inguinal",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Dolor Relacionado con el Pubis (Osteitis Púbica / Pubalgia según Doha 2015):
  - Criterios Diagnósticos: Dolor a la palpación directa sobre la sínfisis del pubis y ramas púbicas adyacentes. Sin dolor relevante a la aducción resistida aislada.
  - Etiología: sobrecarga por cizallamiento vertical y rotacional de la sínfisis púbica durante la marcha rápida, cambios de dirección y patadas.
- Dolor Inguinal Relacionado con el Canal Inguinal ('Sports Hernia' / Hernia del Deportista / Athletic Pubalgia):
  - Criterios Diagnósticos: Dolor en la región del canal inguinal Y dolor reproducido al realizar la maniobra de Valsalva, tos o abdominales resistidos (sit-ups), sin evidencia de hernia abdominal palpable/clínica.
  - Patomecánica: debilidad o micro-desgarro de la pared posterior del canal inguinal (fascia transversalis, tendón conjunto del oblicuo interno y transverso) debida a las fuerzas de tracción asimétricas entre los abdominales y los aductores.
- Coexistencia de entidades de Doha: es sumamente común que un deportista presente 2 o más entidades en simultáneo (ej: Aductores + Pubis + Canal Inguinal).
`,
        preguntasEtapa2: [
            "Cómo diferencias la entidad 'Dolor Relacionado con el Pubis' de la entidad 'Dolor Relacionado con el Canal Inguinal' según el Consenso de Doha?",
            " Explica la patomecánica de cizallamiento de la sínfisis púbica provocada por las fuerzas de tracción asimétricas entre el recto abdominal y el aductor largo.",
            "¿Qué es la 'Sports Hernia' o hernia del deportista y por qué no presenta un saco herniario palpable a la inspección tradicional?",
            "¿Por qué la maniobra de Valsalva (toser, pujar) exacerba el dolor en la entidad del canal inguinal?"
        ],
        casoEtapa3: `"Rugbista de 25 años consulta por dolor en el bajo vientre e ingle izquierda. No tiene dolor a la palpación del tendón aductor pero sí en la rama púbica izquierda y refiere ardor al hacer abdominales o toser fuerte." Clasifica las entidades de Doha presentes y diseña la estrategia de estabilización de pared abdominal/pelvis.`,
        preguntasEtapa4: [
            "¿Qué hallazgo característico muestra la Resonancia Magnética en la sínfisis púbica (edema óseo en 'cierre de cremallera' / aponeurosis) en la Osteitis Púbica?",
            "¿Qué es el complejo placa aductor-recto (ARC - Adductor-Rectus Complex) y cuál es su relevancia quirúrgica/kinesiológica?",
            "¿Cuáles son las 4 entidades primarias definidas por el Consenso de Doha para clasificar el dolor inguinal en el deporte?"
        ]
    },
    {
        id: "c7.4",
        nombre: "7.4 — Tendinopatía proximal de isquiosurales",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Tendinopatía Proximal de Isquiosurales (PHT - Proximal Hamstring Tendinopathy):
  - Patomecánica: degradación por sobrecarga de la inserción común de los isquiosurales (Semimembranoso, Semitendinoso, Bíceps Femoral) en la Tuberosidad Isquiática.
  - Mecanismo de Daño: Carga Tensil + **CARGA COMPRESIVA** del tendón contra la tuberosidad isquiática en rangos de FLEXIÓN DE CADERA (ej: sentarse en superficies duras, estiramientos de isquiosurales, carrera de velocidad / sprint con zancada larga, ciclismo).
- Presentación Clínica Típica: dolor sordo e incisivo "profundo en el glúteo" / bajo el pliegue glúteo, agravado al estar sentado en sillas duras o autos (pain on sitting) y al correr a alta velocidad.
- Pruebas Provocativas Específicas:
  1. Palpación directa sobre la tuberosidad isquiática (reproductora del dolor).
  2. Purdam / PHT Extension Test o Modified PHT Test (flexión pasiva de cadera con rodilla extendida en compresión).
  3. Single Leg Bent-Knee Bridge Test & Single Leg Straight-Knee Bridge Test.
- Tratamiento Kinesiológico Basado en Evidencia (Protocolo de Joy Silbernagel / Tom Goom):
  - PROHIBIDO los estiramientos pasivos de isquiosurales en flexión de cadera en fase reactiva.
  - Evitar la sedestación prolongada en superficies duras (usar cojín de dona o reclinarse).
  - Isométricos en flexión de cadera neutra (0°-30°) $\rightarrow$ HSR isotónico sin flexión profunda $\rightarrow$ HSR con flexión de cadera $\rightarrow$ Carga pliométrica y sprint.
`,
        preguntasEtapa2: [
            "Explica el concepto de compresión tendinosa en la Tendinopatía Proximal de Isquiosurales al aumentar la flexión de cadera.",
            "¿Por qué la queja clínica de 'dolor al estar sentado en sillas duras' (pain on sitting) es patognomónica de esta tendinopatía?",
            "¿Por qué un estiramiento intenso de isquiosurales puede ser mal tolerado en una fase reactiva y cómo usarías síntomas y respuesta posterior para decidir si modificarlo o evitarlo transitoriamente?",
            "Describe la progresión de ejercicios de carga desde isométricos en rango neutro hasta el retorno al sprint de velocidad."
        ],
        casoEtapa3: `"Maratonista de 34 años consulta por dolor en el pliegue glúteo inferior derecho que le impide sentarse a trabajar en su oficina y aumenta al dar la zancada larga corriendo. Llevaba 3 semanas haciendo estiramientos pasivos profundos de isquiosurales sin mejora." Ajusta el manejo de carga y elimina el factor compresivo.`,
        preguntasEtapa4: [
            "¿Qué rama del nervio ciático pasa inmediatamente lateral a la inserción proximal de los isquiosurales y puede dar síntomas neuropáticos concomitantes?",
            "¿Qué diferencia la respuesta biomecánica del tendón del Semimembranoso versus el Bíceps Femoral en la tuberosidad isquiática?",
            "¿Cuáles son los criterios de carga para progresar de ejercicios isotónicos lentos (HSR) a ejercicios de almacenamiento y liberación de energía (pliometría/sprint)?"
        ]
    },
    {
        id: "c7.5",
        nombre: "7.5 — Dolor glúteo profundo y conflicto isquiofemoral",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Síndrome del Dolor Glúteo Profundo (DGPS - Deep Gluteal Space Syndrome): término moderno que reemplaza al clásico "Síndrome del Piriforme". Abarca la compresión no discogénica del Nervio Ciático en el espacio subglúteo.
- Estructuras Causantes de Atrapamiento en el Espacio Glúteo Profundo:
  - Músculo Piriforme (bandas fibrosas o hipertrofia).
  - Complejo Gemelos-Obturador Interno.
  - Músculo Cuadrado Femoral y Conflicto Isquiofemoral (IFI - Ischiofemoral Impingement).
  - Bridas fibrosas vasculares o espacio isquiático estrecho.
- Conflicto Isquiofemoral (IFI): estrechamiento del espacio entre la tuberosidad isquiática y el trocánter menor, generando atrapamiento del músculo Cuadrado Femoral y del nervio ciático durante la combinación de extensión de cadera + aducción + rotación externa.
- Presentación Clínica: dolor glúteo profundo retrotrocantérico, parestesias o adormecimiento hacia el muslo posterior/pierna (falso ciático), agravado por la sedestación prolongada.
- Pruebas Específicas: Freiberg Test, Pace Test, FAIR Test (Flexión, Aducción, Rotación Interna), IFI Long Stride Walking Test (dolor en extensión de cadera al dar paso largo).
`,
        preguntasEtapa2: [
            "Diferencia el concepto moderno de 'Síndrome del Dolor Glúteo Profundo (DGPS)' respecto al concepto clásico del 'Síndrome del Piriforme'.",
            " Explica la patomecánica del Conflicto Isquiofemoral (IFI) y qué estructuras musculares y nerviosas se ven atrapadas.",
            "¿Cómo realizas el diagnóstico diferencial clínico entre una Radiculopatía Lumbar L5-S1 por hernia discal versus un Atrapamiento del Ciático en el Espacio Glúteo Profundo?",
            "Describe el test de FAIR y el IFI Long Stride Walking Test para reproducir los síntomas."
        ],
        casoEtapa3: `"Paciente de 42 años con dolor glúteo profundo y hormigueo por detrás del muslo al estar sentado. RMN lumbar es normal. En la marcha, al dar el paso largo en extensión con la pierna afectada reproduce la parestesia exacta." Diagnostica entre DGPS vs IFI y plantea la conducta kinesiológica.`,
        preguntasEtapa4: [
            "¿Qué distancia milimétrica en la RMN del espacio isquiofemoral (<15 mm) y del espacio del cuadrado femoral (<10 mm) confirma el diagnóstico de IFI?",
            "¿Por qué la maniobra de Slump en camilla puede ser positiva en el DGPS a pesar de que la columna lumbar esté completamente sana?",
            "¿Qué técnicas de neurodinamia (deslizamiento / neural sliding) se recomiendan para liberar la interfaz del nervio ciático en el espacio subglúteo?"
        ]
    },
    {
        id: "c7.6",
        nombre: "7.6 — Lesiones musculares agudas alrededor de la cadera",
        categoria: "Dolor Inguinal y Extraarticular",
        contenidoBase: `
- Lesiones Musculares Agudas periarticulares (Desgarros / Distensiones): muy frecuentes en deportes de aceleración, sprint, desaceleración brusca y pateo.
- Músculos más frecuentemente lesionados alrededor de la cadera:
  1. Aductor Largo: mecanismo de abducción brusca o cambio de dirección.
  2. Recto Anterior del Cuádriceps (cabeza directa o refleja en la EIAA): mecanismo de pateo violento o extensión de cadera con flexión de rodilla.
  3. Iliopsoas: aceleración o flexión explosiva.
  4. Isquiosurales (Bíceps Femoral cabeza larga): durante la fase final de oscilación del sprint (corta longitud muscular bajo alta tensión excéntrica).
- Clasificación Contemporánea de Lesiones Musculares (Consenso de Munich 2013 / Clasificación BAMIC - British Association of Sport and Exercise Medicine):
  - Clasificación por ubicación anatómica: Miofascial (Tipo A), Miotendinosa (Tipo B), Intratendinosa (Tipo C - peor pronóstico y mayor tiempo de retorno).
- Criterios de Rehabilitación y Retorno Deportivo (RTP - Return to Play):
  - Fase 1 (Aguda): CRIO / compresión local, isométricos tempranos indoloro (≤2/10).
  - Fase 2 (Regenerativa): fortalecimiento isotónico HSR progresivo, control neuromuscular de pelvis.
  - Fase 3 (Funcional): ejercicios excéntricos de alta velocidad, carrera de aceleración/desaceleración.
  - Criterios de RTP: progresión sin aumento clínicamente relevante de síntomas, capacidad de realizar tareas específicas, fuerza y pruebas funcionales pertinentes, preparación psicológica y exposición gradual. La simetría ayuda a interpretar el caso, pero no sustituye esta integración.
`,
        preguntasEtapa2: [
            " Explica la clasificación de lesiones musculares BAMIC (Miofascial vs Miotendinosa vs Intratendinosa) y su impacto en el tiempo de retorno al deporte.",
            "¿Cuál es el mecanismo biomecánico exacto de la lesión del Recto Anterior del Cuádriceps durante el gesto de patada de fútbol?",
            "¿Cuáles son los 4 criterios clínicos y funcionales obligatorios que debe cumplir un deportista para autorizar el alta y retorno competitivo (RTP) tras un desgarro muscular de aductor o isquiosural?",
            " Explica la importancia de la dosificación de ejercicios excéntricos de alta velocidad en las etapas finales de la rehabilitación muscular."
        ],
        casoEtapa3: `"Futbolista de 21 años sufrió un desgarro miotendinoso del recto anterior derecho hace 3 semanas. No siente dolor al caminar (0/10) y pide entrar a jugar el partido del fin de semana. En la evaluación: dolor 4/10 al patear balón y LSI de fuerza de 70%." Argumenta si le das el alta y cuál is tu plan de las próximas 2 semanas.`,
        preguntasEtapa4: [
            "¿Por qué las lesiones de la unión intratendinosa (BAMIC Tipo C) requieren casi el doble de tiempo de recuperación que las lesiones miofasciales periféricas?",
            "¿Qué es la prueba de Nordics (Nordic Hamstring Exercise) y qué evidencia existe sobre su uso en la prevención de re-lesiones?",
            "¿Cómo se diferencia clínicamente en las primeras 48 horas una contusión muscular simple (charquicán/bocadillo) de un desgarro muscular por distracción?"
        ]
    },

    // ────────────── CATEGORÍA 8: GERIATRÍA Y FRACTURA DE CADERA ──────────────
    {
        id: "c8.1",
        nombre: "8.1 — Manejo kinesiológico integral de la fractura de cadera en adulto mayor",
        categoria: "Geriatría y Fractura de Cadera",
        contenidoBase: `
- Fracturas de Cadera en Adulto Mayor: urgencia traumatológica y geriátrica mayor.
- Clasificación Quirúrgica y Biomecánica:
  1. Intracapsulares (Cuello Femoral): alto riesgo de osteonecrosis de la cabeza femoral por interrupción de la arteria circunfleja femoral medial. Tratamiento: Hemiartroplastia o PTC en pacientes independientes, osteosíntesis con tornillos canulados en jóvenes.
  2. Extracapsulares (Intertrocantéricas y Subtrocantéricas): buena vascularización, conservan cabeza femoral. Tratamiento: Clavo Cefalomedular (PFNA) o placa DHS (Dynamic Hip Screw).
- Directrices EBM de Rehabilitación Inmediata (NICE / AAOS 2024):
  - Movilización y bipedestación con carga según tolerancia en las primeras 24-48 horas postoperatorias (salvo contraindicación quirúrgica explícita).
  - Manejo y prevención activa del Delírium postquirúrgico (orientación espacio-temporal, movilización precoz, manejo del dolor sin dosis excesivas de opióides).
  - Entrenamiento de transferencias (cama-silla, silla-bipedestación) y reeducación de la marcha con andador/bastones.
  - Plan de prevención de caídas post-alta: evaluación del entorno domiciliario, fortalecimiento de cuádriceps/glúteos y reentrenamiento del equilibrio dinámico.
`,
        preguntasEtapa2: [
            "Diferencia el comportamiento vascular y quirúrgico entre una fractura intracapsular del cuello femoral y una fractura extracapsular intertrocantérica.",
            "¿Cuáles son las justificaciones biológicas y funcionales de la bipedestación con carga precoz antes de las 48 horas postquirúrgicas en el adulto mayor?",
            "¿Qué rol cumple el kinesiólogo en la prevención y manejo del delírium hiperactivo o hipoactivo en las primeras 72 horas hospitalarias?",
            " Explica los componentes clave de una pauta de prevención secundaria de caídas al momento del alta hospitalaria."
        ],
        casoEtapa3: `"Don Osvaldo, 84 años, operado de osteosíntesis por clavo cefalomedular PFNA por fractura intertrocantérica derecha hace 36 horas. Presenta desorientación moderada y rechaza ponerse de pie por miedo a romper la cadera." Diseña tu abordaje kinesiológico inicial para lograr la primera transferencia y carga indolora.`,
        preguntasEtapa4: [
            "¿Por qué la hemiartroplastia es de elección sobre la osteosíntesis en pacientes ancianos con fractura desplazada de cuello femoral?",
            "¿Qué tests funcionales estandarizados (ej: TUG, SPPB) recomiendan las guías clínicas para evaluar el riesgo de re-caída al mes del alta?",
            "¿Cómo se dosifica el ejercicio terapéutico progresivo en un adulto mayor con sarcopenia y osteopenia severa post-fractura de cadera?"
        ]
    },

    // ────────────── CATEGORÍA 9: CADERA PEDIÁTRICA Y DEPORTIVA ──────────────
    {
        id: "c8.2",
        nombre: "8.2 — Cadera pediátrica y adolescente: Perthes, Epifisiolisis y Avulsiones Apofisarias",
        categoria: "Cadera Pediátrica y Deportiva",
        contenidoBase: `
- Patología Pediátrica y Juvenil de Cadera: requiriere diagnóstico precoz para evitar deformidades estructurales irreversibles.
- Enfermedad de Legg-Calvé-Perthes: necrosis avascular idiopática de la epífisis femoral en niños (frecuente entre 4 y 8 años). Presentación: cojera insidiosa e indolora o dolor leve en ingle/rodilla con limitación de abducción y rotación interna.
- Epifisiolisis Femoral Proximal (SCFE - Slipped Capital Femoral Epiphysis): desplazamiento del cuello femoral respecto a la epífisis en adolescentes (10-15 años, sobrepeso o brote de crecimiento). Urgencia ortopédica (riesgo de condrólisis y avascularidad). Signo clínico clásico: rotación externa obligada durante la flexión pasiva de cadera (Signo de Drehmann positivo).
- Avulsiones Apofisarias en Deportistas Jóvenes: tracción brusca de cartílago de crecimiento no fusionado en inserciones musculares:
  1. Espina Ilíaca Anteroinferior (EIAA): tracción del Recto Anterior.
  2. Espina Ilíaca Anterosuperior (EIAS): tracción del Tensor de la Fascia Lata / Sartorio.
  3. Tuberosidad Isquiática: tracción de Isquiosurales.
`,
        preguntasEtapa2: [
            "¿Cómo diferencia clínicamente la presentación típica de la Enfermedad de Legg-Calvé-Perthes de la Epifisiolisis Femoral Proximal (SCFE)?",
            " Explica el Signo de Drehmann y su significado biomecánico en la evaluación de un adolescente con sospecha de SCFE.",
            "¿Cuáles son las localizaciones anatómicas más frecuentes de avulsión apofisaria por tracción muscular en atletas adolescentes y qué músculos las provocan?",
            "¿Por qué una epifisiolisis femoral proximal requiere reposo absoluto de carga y derivación quirúrgica urgente a traumatología infantil?"
        ],
        casoEtapa3: `"Mateo, 13 años, futbolista en brote de crecimiento (IMC percentil 92), consulta por dolor en ingle y cojera de 2 semanas. Al evaluar la flexión pasiva de cadera derecha, la pierna se va automáticamente a rotación externa e inclinación lateral (Signo de Drehmann +)." Argumenta cuál es tu conducta inmediata como kinesiólogo.`,
        preguntasEtapa4: [
            "¿Qué secuelas morfológicas a largo plazo (ej. deformidad en empuñadura de pistola / Cam FAI) genera una epifisiolisis no diagnosticada a tiempo?",
            "¿Cuál es el protocolo de manejo conservador y progresión de carga tras una avulsión de la EIAA en un velocista de 15 años?",
            "¿Por qué el dolor anterior de rodilla en niños o adolescentes debe hacer considerar y, si la presentación lo sugiere, examinar también la cadera?"
        ]
    },

    // ────────────── CATEGORÍA 10: NEUROPATÍAS PERIFÉRICAS ──────────────
    {
        id: "c8.3",
        nombre: "8.3 — Neuropatías periféricas y atrapamientos nerviosos periarticulares",
        categoria: "Neuropatías Periféricas",
        contenidoBase: `
- Neuropatías Periféricas de Cadera y Pelvis: cuadros a menudo subdiagnósticados o confundidos con radiculopatías lumbares o tendinopatías.
- Meralgia Parestésica (Neuropatía del Nervio Cutáneo Femoral Lateral - LCFN):
  - Compresión del LCFN al pasar bajo el ligamento inguinal (cerca de la EIAS).
  - Clínica: disestesias, ardor, adormecimiento y alodinia estricta en la cara anterolateral del muslo (patrón en "bolsillo de pantalón"). Sin déficit motor.
  - Factores favorecedores: ropa ajustada, cinturones pesados, obesidad, embarazo o postura prolongada en bipedestación.
- Atrapamiento del Nervio Ciático Próximo / Síndrome del Espacio Glúteo Profundo (Deep Gluteal Syndrome - DGS):
  - Compresión no discogénica del nervio ciático en el espacio subglúteo (por bandas fibrosas, músculo piriforme, gemelos/obturador interno o vasos aberrantes).
  - Clínica: dolor en glúteo profundo que se irradia por cara posterior del muslo, exacerbado por la sedestación prolongada (>30 min), y maniobras de provocación en flexión, aducción y rotación interna de cadera (FADIR modificada / FAIR test).
`,
        preguntasEtapa2: [
            "Diferencia la Meralgia Parestésica de una radiculopatía lumbar L3-L4 en cuanto a territorio sensitivo y hallazgos motores.",
            " Explica la anatomía del Espacio Glúteo Profundo (Deep Gluteal Space) y las estructuras que pueden atrapar al nervio ciático a este nivel.",
            "¿Cuáles son las maniobras de neurodinamia y provocación clínica específicas para desencadenar el dolor en el Síndrome del Espacio Glúteo Profundo?",
            "¿Qué intervenciones conservadoras EBM (educación, desensibilización, neurodinamia, modificación de carga) se aplican en la Meralgia Parestésica?"
        ],
        casoEtapa3: `"Paciente de 42 años, conductor de camión, consulta por dolor ardoroso y sensación de "quemadura" en la cara anterolateral del muslo derecho de 3 meses. Refiere que empeora al usar cinturón de seguridad ajustado. La evaluación motora y los reflejos rotulianos son 100% normales." Formula tu hipótesis diagnóstica y tu plan kinesiológico de desensibilización.`,
        preguntasEtapa4: [
            "¿Por qué la prueba de la postura en sedestación sobre un objeto duro (Wallet sign / signo de la billetera) es orientadora del síndrome del piriforme/espacio glúteo?",
            "¿Qué diferencias existen entre el neurodeslizamiento (slider) y la tensión neural (tensioner) en la rehabilitación del nervio ciático o cutáneo femoral lateral?",
            "¿Cuándo se considera fallido el tratamiento conservador y se indica una liberación artroscópica del nervio ciático en el espacio subglúteo?"
        ]
    },

    // ────────────── CATEGORÍA 11: CRITERIOS AVANZADOS DE RTP ──────────────
    {
        id: "c8.4",
        nombre: "8.4 — Criterios avanzados EBM de Return to Play (RTP) y evaluación objetiva de carga",
        categoria: "Criterios Avanzados de RTP",
        contenidoBase: `
- Retorno al Deporte y la Competición (RTP - Return to Play) en Cadera EBM 2026:
  - Abandono definitivo de criterios arbitrarios basados únicamente en "tiempo transcurrido" (ej: "esperar 4 meses") o "ausencia de dolor en reposo".
  - Transición por fases estandarizadas: Return to Activity -> Return to Sport -> Return to Performance.
- Batería de Evaluación Objetiva Multidimensional:
  1. Dinamometría Isométrica de Mano (Hand-Held Dynamometry - HHD):
     - Medición objetiva del torque abductor, aductor y flexor de cadera en N·m/kg.
     - Simetría: el LSI aporta comparación con la extremidad contralateral, pero debe interpretarse con la línea basal, la función, los síntomas, las demandas deportivas y el tiempo de exposición.
     - Ratio Aductor/Abductor: debe ser de al menos 80-100% para prevenir pubalgias y re-lesiones aductores.
  2. Cuestionarios Validados PROMs (Patient-Reported Outcome Measures):
     - iHOT-33 (International Hip Outcome Tool) o HOOS (Hip disability and Osteoarthritis Outcome Score) >85-90 puntos.
     - Escala Hip-RSI (Hip Return to Sport after Injury): evaluación del componente psicológico, aprensión y confianza neurocognitiva.
  3. Pruebas Funcionales y Biomecánicas de Alta Velocidad:
     - Single Leg Hop Test, Triple Hop Test y Side Hop Test con análisis cualitativo del control del valgo dinámico.
     - Pruebas de desaceleración brusca y cambios de dirección (ej: Y-Balance Test, T-Test) monitoreadas sin mecanismos de compensación pélvica.
`,
        preguntasEtapa2: [
            "Explica qué aporta la dinamometría frente a la escala manual de Daniels y cómo evitarías usar un LSI aislado para decidir RTP.",
            "¿Cómo integrarías iHOT-33, Hip-RSI, fuerza, pruebas funcionales, tolerancia a la exposición y demanda deportiva al decidir retorno competitivo?",
            " Explica la batería de saltos unilaterales (Hop Tests) aplicados a la articulación de la cadera y qué aspectos cualitativos deben observarse además de la distancia alcanzada.",
            "¿De qué manera el ratio de fuerza aductor/abductor influye en el riesgo de recidiva de dolor inguinal en deportistas de cambio de dirección?"
        ],
        casoEtapa3: `"Jugadora de hockey de 24 años, 5 meses post-operada de artroscopia de cadera por FAI Cam. No presenta dolor (0/10) al trotar y exige alta para la final del torneo. En la dinamometría HHD: LSI abductor es de 78%, Hip-RSI es de 62/100 (alta aprensión a caer) y muestra valgo dinámico compensatorio en el Single Leg Hop." Fundamenta clínicamente tu decisión sobre el alta competitiva.`,
        preguntasEtapa4: [
            "¿Qué es la brecha entre el 'Return to Sport' (RTS) y el 'Return to Performance' (RTP) y cómo se gestiona en la fase final de rehabilitación?",
            "¿Qué métricas de carga externa (ej: GPS, acelerometría) y carga interna (RPE acumulada) ayudan a monitorear la progresión de volumen e intensidad pre-competencia?",
            "¿Cómo influyen los déficits de control motor pélvico en el plano frontal y transversal durante la caída de un salto en el estrés de cizallamiento labral?"
        ]
    },
    ...HIP_PRESCRIPTION_TOPICS
];
