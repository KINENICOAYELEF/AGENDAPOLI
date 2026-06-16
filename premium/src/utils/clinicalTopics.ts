export interface ClinicalTopic {
    id: string;
    nombre: string;
    focoPrincipal: string;
    categoria: 'Hombro' | 'CodoMano' | 'Columna' | 'Cadera' | 'Rodilla' | 'TobilloPie' | 'Muscular' | 'NervioPeriferico';
}

export const CLINICAL_TOPICS: ClinicalTopic[] = [
    // --- HOMBRO ---
    {
        id: "h1",
        nombre: "Dolor Subacromial (Manguito Rotador - Tendinopatía Reactiva)",
        focoPrincipal: "Exigir diferenciación aguda/reactiva, control del dolor y modificación de carga (isométricos).",
        categoria: "Hombro"
    },
    {
        id: "h2",
        nombre: "Dolor Subacromial (Tendinopatía Degenerativa / Desgarro Parcial)",
        focoPrincipal: "Exigir fortalecimiento progresivo (isotónicos concéntricos/excéntricos), clusters de Manguito Rotador.",
        categoria: "Hombro"
    },
    {
        id: "h3",
        nombre: "Inestabilidad Anterior de Hombro (Traumática)",
        focoPrincipal: "Evaluar test de aprensión/reubicación, tiempos de cicatrización capsular y control motor escapulotorácico.",
        categoria: "Hombro"
    },
    {
        id: "h4",
        nombre: "Hombro Congelado (Capsulitis Adhesiva)",
        focoPrincipal: "Evaluar reconocimiento clínico primario, fases (congelamiento vs rigidez), y priorizar analgesia y educación.",
        categoria: "Hombro"
    },
    {
        id: "h5",
        nombre: "Lesión SLAP",
        focoPrincipal: "Evaluar test ortopédicos combinados (O'Brien, Crank), y justificar estabilización dinámica vs reposo relativo.",
        categoria: "Hombro"
    },

    // --- CODO Y MANO ---
    {
        id: "cm1",
        nombre: "Epicondilalgia Lateral (Codo de Tenista)",
        focoPrincipal: "Evaluar dosificación FITT-VP para extensor radial corto del carpo, diferenciando de compresión del nervio interóseo posterior.",
        categoria: "CodoMano"
    },
    {
        id: "cm2",
        nombre: "Epicondilalgia Medial (Codo de Golfista)",
        focoPrincipal: "Descartar afectación del nervio cubital (diagnóstico diferencial) y dosificar carga en flexores/pronadores.",
        categoria: "CodoMano"
    },
    {
        id: "cm3",
        nombre: "Tenosinovitis de De Quervain",
        focoPrincipal: "Exigir test de Finkelstein (SpIn/SnOut), y control motor del Aductor Largo y Extensor Corto del pulgar.",
        categoria: "CodoMano"
    },

    // --- COLUMNA (CERVICAL, TORÁCICA, LUMBAR, PELVIS) ---
    {
        id: "col1",
        nombre: "Dolor Cervical Irradiado (Radiculopatía C5-C6)",
        focoPrincipal: "Exigir Cluster de Wainner completo y abordaje neurodinámico (movilización vs deslizamiento).",
        categoria: "Columna"
    },
    {
        id: "col2",
        nombre: "Cefalea Cervicogénica",
        focoPrincipal: "Exigir test de flexión-rotación cervical y abordaje de Terapia Manual (Maitland/Mulligan) en cervicales altas.",
        categoria: "Columna"
    },
    {
        id: "col3",
        nombre: "Dolor Lumbar Inespecífico Crónico (Nociplástico Dominante)",
        focoPrincipal: "Exigir educación en Neurociencia del Dolor, exclusión de daño estructural grave y exposición gradual al movimiento.",
        categoria: "Columna"
    },
    {
        id: "col4",
        nombre: "Radiculopatía Lumbar (L4-L5 / L5-S1)",
        focoPrincipal: "Evaluar evaluación de miotomas/dermatomas estrictos, test de elevación pierna recta (SLR) y fenómeno de centralización.",
        categoria: "Columna"
    },
    {
        id: "col5",
        nombre: "Inestabilidad Clínica Lumbar y Control Motor",
        focoPrincipal: "Evaluar reconocimiento clínico de la bisagra inestable, y justificar FITT-VP para estabilizadores profundos (TrA, multífidos).",
        categoria: "Columna"
    },
    {
        id: "col6",
        nombre: "Disfunción de Articulación Sacroilíaca",
        focoPrincipal: "Exigir el Cluster de Laslett (al menos 3 de 5 positivos) y diferenciación con dolor referido de la columna lumbar inferior.",
        categoria: "Columna"
    },
    {
        id: "col7",
        nombre: "Estenosis Foraminal Lumbar (Claudicación Neurogénica)",
        focoPrincipal: "Exigir diferenciación con claudicación vascular, posición de alivio (flexión) y prescripción aeróbica tolerada.",
        categoria: "Columna"
    },

    // --- CADERA ---
    {
        id: "cad1",
        nombre: "Dolor Articular de Cadera (Artrosis Temprana)",
        focoPrincipal: "Evaluar rotación interna limitada, test FABER/FADIR, y dosificación para movilidad y fuerza capsular.",
        categoria: "Cadera"
    },
    {
        id: "cad2",
        nombre: "Tendinopatía Glútea (Síndrome de Dolor Trocantérico Mayor)",
        focoPrincipal: "Exigir comprensión de la carga compresiva (evitar aducción) y dosificación de glúteo medio/menor.",
        categoria: "Cadera"
    },
    {
        id: "cad3",
        nombre: "Pinzamiento Fémoro-Acetabular (FAI)",
        focoPrincipal: "Justificar evaluación radiológica vs clínica, evitar posiciones de atrapamiento agudo (flexión máxima + rotación).",
        categoria: "Cadera"
    },

    // --- RODILLA ---
    {
        id: "rod1",
        nombre: "Dolor Patelofemoral",
        focoPrincipal: "Rechazar concepto de 'síndrome' inespecífico. Exigir sobrecarga local patelar y control motor de cadera (glúteos).",
        categoria: "Rodilla"
    },
    {
        id: "rod2",
        nombre: "Tendinopatía Rotuliana (Degenerativa)",
        focoPrincipal: "Evaluar HSR (Heavy Slow Resistance), ejercicios isoinerciales, dolor focal en el polo inferior en carga.",
        categoria: "Rodilla"
    },
    {
        id: "rod3",
        nombre: "Artrosis de Rodilla (OA)",
        focoPrincipal: "Priorizar fortalecimiento de cuádriceps, capacidad aeróbica y manejo del miedo-evitación, según guías OARSI.",
        categoria: "Rodilla"
    },
    {
        id: "rod4",
        nombre: "Lesión Meniscal Degenerativa",
        focoPrincipal: "Descartar bloqueo articular mecánico agudo (bandera roja quirúrgica), promover carga progresiva y propiocepción.",
        categoria: "Rodilla"
    },
    {
        id: "rod5",
        nombre: "Síndrome de Fricción de la Banda Iliotibial",
        focoPrincipal: "Asociar a sobrecarga por estrés tensil distal, control motor de cadera en plano frontal/transversal.",
        categoria: "Rodilla"
    },

    // --- TOBILLO Y PIE ---
    {
        id: "tob1",
        nombre: "Esguince de Tobillo Agudo (Ligamento Talofibular Anterior)",
        focoPrincipal: "Exigir aplicación estricta de Criterios de Ottawa y modelo POLICE (evitar RICE pasivo absoluto).",
        categoria: "TobilloPie"
    },
    {
        id: "tob2",
        nombre: "Inestabilidad Crónica de Tobillo",
        focoPrincipal: "Exigir evaluación con CAIT o Cumberland, priorizar control sensoriomotor y tiempo de reacción muscular (fuerza reactiva).",
        categoria: "TobilloPie"
    },
    {
        id: "tob3",
        nombre: "Tendinopatía Aquiliana (Porción Media)",
        focoPrincipal: "Evaluar protocolo Alfredson vs HSR, dosificando repeticiones lentas y pesadas, diferenciando de bursitis retrocalcánea.",
        categoria: "TobilloPie"
    },
    {
        id: "tob4",
        nombre: "Fascitis/Fasciopatía Plantar",
        focoPrincipal: "Evaluar carga tensil en flexión dorsal con dedos en extensión (Windlass), fortalecer fascia con cargas isométricas progresivas.",
        categoria: "TobilloPie"
    },
    {
        id: "tob5",
        nombre: "Síndrome de Estrés Tibial Medial",
        focoPrincipal: "Identificar factores de carga por volumen de trote y evaluar control excéntrico de flexores plantares y tibial posterior.",
        categoria: "TobilloPie"
    },

    // --- LESIONES MUSCULARES ---
    {
        id: "mus1",
        nombre: "Desgarro de Isquiotibiales (Bíceps Femoral)",
        focoPrincipal: "Razonamiento en cicatrización aguda vs excéntricos en elongación tardía (ej: Nordic, peso muerto rumano).",
        categoria: "Muscular"
    },
    {
        id: "mus2",
        nombre: "Desgarro de Gemelo Interno (Tennis Leg)",
        focoPrincipal: "Descartar TVP (Trombosis Venosa Profunda - Bandera Roja), dosificación para tríceps sural con rodilla extendida.",
        categoria: "Muscular"
    },
    {
        id: "mus3",
        nombre: "Desgarro de Recto Femoral",
        focoPrincipal: "Evaluar mecanismo de lesión (chute/sprint), cicatrización del tendón central y excéntricos de cuádriceps en flexión de cadera.",
        categoria: "Muscular"
    },
    {
        id: "mus4",
        nombre: "Desgarro de Aductores (Ingle de Deportista)",
        focoPrincipal: "Razonamiento diferencial con pubalgia o patología intraarticular de cadera. Fortalecimiento en cadenas cruzadas (Copenhague).",
        categoria: "Muscular"
    },
    {
        id: "mus5",
        nombre: "Desgarro de Pectoral Mayor (Mecanismo Excéntrico)",
        focoPrincipal: "Reconocer defecto anatómico post-agudo, diferenciar lesión de unión miotendinosa, y pautar progresión isocinética/isométrica.",
        categoria: "Muscular"
    },

    // --- NERVIOS PERIFÉRICOS (ATRAPAMIENTOS) ---
    {
        id: "ner1",
        nombre: "Síndrome del Túnel Carpiano",
        focoPrincipal: "Exigir test de Phalen/Tinel, evaluación de fuerza de eminencia tenar y neurodinámica del nervio mediano.",
        categoria: "NervioPeriferico"
    },
    {
        id: "ner2",
        nombre: "Síndrome del Túnel Cubital",
        focoPrincipal: "Exigir evaluación en flexión prolongada de codo, síntomas en 4to y 5to dedo, neurodinámica del nervio ulnar.",
        categoria: "NervioPeriferico"
    },
    {
        id: "ner3",
        nombre: "Síndrome Piriforme (Atrapamiento Glúteo Profundo)",
        focoPrincipal: "Diferenciar radicalmente de una radiculopatía lumbar, evaluar dolor a la palpación profunda y tensión en rotación interna.",
        categoria: "NervioPeriferico"
    },
    {
        id: "ner4",
        nombre: "Atrapamiento del Nervio Ciático Poplíteo Externo (Peroneo Común)",
        focoPrincipal: "Identificar factor de riesgo (Ej: esguince de tobillo severo, cruce de piernas prolongado), evaluar marcha en steppage y dorsiflexión.",
        categoria: "NervioPeriferico"
    },
    {
        id: "ner5",
        nombre: "Síndrome del Desfiladero Torácico (Thoracic Outlet Syndrome)",
        focoPrincipal: "Exigir test de Roos o Adson, diferenciación clara entre vascular vs neurogénico verdadero, control motor escapular.",
        categoria: "NervioPeriferico"
    }
];
