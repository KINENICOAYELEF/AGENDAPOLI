// Temario esencial de práctica profesional Kinesiología MSK y Deportiva
// Basado en evidencia contemporánea y razonamiento clínico avanzado.

export interface ClinicalTopic {
    id: string;
    area: string;
    nombre: string;
    focoPrincipal: string; // Qué debe evaluar la IA en este tema
}

export const CLINICAL_TOPICS: ClinicalTopic[] = [
    // ─── COLUMNA CERVICAL Y TORÁCICA ───
    { id: 'cervical_radiculopatia', area: 'Columna Cervical', nombre: 'Radiculopatía Cervical (C5-C7)', focoPrincipal: 'Diagnóstico diferencial con síndrome de desfiladero torácico, evaluación de dermatomas/miotomas, y neurodinámica del miembro superior.' },
    { id: 'cervical_whiplash', area: 'Columna Cervical', nombre: 'Trastorno Asociado al Latigazo Cervical (WAD)', focoPrincipal: 'Manejo de banderas amarillas, evaluación de control motor cervical profundo, y dosificación en etapa aguda vs crónica.' },
    { id: 'cervical_cefalea', area: 'Columna Cervical', nombre: 'Cefalea Cervicogénica', focoPrincipal: 'Test de flexión-rotación cervical, diagnóstico diferencial con migrañas/cefaleas tensionales, y terapia manual.' },
    
    // ─── COLUMNA LUMBAR Y PELVIS ───
    { id: 'lumbar_inespecifico_cronico', area: 'Columna Lumbar', nombre: 'Dolor Lumbar Inespecífico Crónico', focoPrincipal: 'Educación en neurociencia del dolor, identificación de factores psicosociales (STarT Back), y exposición gradual.' },
    { id: 'lumbar_radicular', area: 'Columna Lumbar', nombre: 'Síndrome Radicular Lumbar (L4-S1)', focoPrincipal: 'Slump test vs SLR, diferenciación con dolor referido somático, e indicación de centralización de síntomas.' },
    { id: 'lumbar_espondilolistesis', area: 'Columna Lumbar', nombre: 'Espondilolistesis Lumbar Sintomática', focoPrincipal: 'Evaluación de control motor lumbopélvico, sesgo de flexión vs extensión, y criterios de derivación.' },
    { id: 'pelvis_sacroiliaca', area: 'Cadera / Pelvis', nombre: 'Disfunción de la Articulación Sacroilíaca', focoPrincipal: 'Cluster de Laslett, descarte de dolor lumbar discogénico, y manejo con control motor.' },
    
    // ─── HOMBRO ───
    { id: 'hombro_manguito_rotador', area: 'Hombro', nombre: 'Tendinopatía / Síndrome Subacromial del Manguito Rotador', focoPrincipal: 'Evaluación de discinesia escapular, test de modificación de síntomas, y ejercicios de carga excéntrica/isométrica.' },
    { id: 'hombro_inestabilidad', area: 'Hombro', nombre: 'Inestabilidad Anterior de Hombro (Post-luxación)', focoPrincipal: 'Evaluación de aprensión/reubicación, tiempos de reparación capsular, y readaptación propioceptiva.' },
    { id: 'hombro_congelado', area: 'Hombro', nombre: 'Capsulitis Adhesiva (Hombro Congelado)', focoPrincipal: 'Fases clínicas (congelamiento vs rigidez), manejo del dolor vs ganancia de ROM, y descarte de banderas rojas (tumores apicales).' },
    { id: 'hombro_slap', area: 'Hombro', nombre: 'Lesión SLAP en Deportista de Lanzamiento', focoPrincipal: 'Biomecánica de la fase de aceleración/desaceleración, déficit de rotación interna (GIRD), y progresión de retorno al lanzamiento.' },

    // ─── CODO Y MANO ───
    { id: 'codo_epicondilalgia', area: 'Codo', nombre: 'Epicondilalgia Lateral (Codo de Tenista)', focoPrincipal: 'Carga tendinosa (tendinopatía reactiva vs degenerativa), test de prensión indolora, y diferenciación con atrapamiento radial.' },
    { id: 'mano_tunel_carpiano', area: 'Muñeca / Mano', nombre: 'Síndrome del Túnel Carpiano', focoPrincipal: 'Diagnóstico diferencial de atrapamientos múltiples (Double Crush), tests provocativos (Phalen/Tinel), y neurodinámica del mediano.' },
    { id: 'mano_de_quervain', area: 'Muñeca / Mano', nombre: 'Tenosinovitis de De Quervain', focoPrincipal: 'Manejo de carga en pulgar, test de Finkelstein, y dosificación de ejercicios de tendón.' },

    // ─── CADERA ───
    { id: 'cadera_artrosis', area: 'Cadera / Pelvis', nombre: 'Artrosis de Cadera (Leve a Moderada)', focoPrincipal: 'Criterios clínicos de artrosis (dolor inguinal, restricción ROM), ejercicio terapéutico vs reemplazo articular, y manejo de peso.' },
    { id: 'cadera_pinzamiento', area: 'Cadera / Pelvis', nombre: 'Pinzamiento Fémoro-Acetabular (FAI)', focoPrincipal: 'Test de FADIR/FABER, modificación de la actividad deportiva, y manejo de la fuerza de abductores profundos.' },
    { id: 'cadera_gtps', area: 'Cadera / Pelvis', nombre: 'Síndrome Doloroso del Trocánter Mayor (GTPS)', focoPrincipal: 'Compresión vs tensión del tendón glúteo, posturas a evitar (adducción), y carga progresiva isométrica.' },

    // ─── RODILLA ───
    { id: 'rodilla_patelofemoral', area: 'Rodilla', nombre: 'Síndrome de Dolor Patelofemoral (SDPF)', focoPrincipal: 'Biomecánica de cadena cinética (cadera vs pie), valgo dinámico, y modificación de los niveles de estrés articular.' },
    { id: 'rodilla_lca_postqx', area: 'Rodilla', nombre: 'Post-operatorio LCA (Fase Retorno al Deporte)', focoPrincipal: 'Criterios de alta cuantitativos (LSI > 90%, Hop Tests), miedo a la re-lesión (Kinesiophobia), y calidad de movimiento.' },
    { id: 'rodilla_tendinopatia_rotuliana', area: 'Rodilla', nombre: 'Tendinopatía Rotuliana (Rodilla de Saltador)', focoPrincipal: 'Isométricos para analgesia (Efecto Rio), ejercicios HSR (Heavy Slow Resistance), y manejo de almacenamiento de energía.' },
    { id: 'rodilla_artrosis', area: 'Rodilla', nombre: 'Artrosis de Rodilla', focoPrincipal: 'Criterios clínicos, prescripción de ejercicio aeróbico y de fuerza cuadricipital (GLAD), y manejo del dolor nociplástico asociado.' },
    { id: 'rodilla_menisco', area: 'Rodilla', nombre: 'Lesión Meniscal Degenerativa vs Aguda', focoPrincipal: 'Test de Thessaly, decisión quirúrgica vs conservadora en mayores de 40, y carga progresiva.' },

    // ─── TOBILLO Y PIE ───
    { id: 'tobillo_esguince_agudo', area: 'Tobillo / Pie', nombre: 'Esguince Lateral de Tobillo (Agudo)', focoPrincipal: 'Reglas de Ottawa para descarte de fractura, protección y carga óptima (POLICE), y prevención de inestabilidad crónica.' },
    { id: 'tobillo_inestabilidad_cronica', area: 'Tobillo / Pie', nombre: 'Inestabilidad Crónica de Tobillo', focoPrincipal: 'Déficit propioceptivo, fuerza de eversos, y control postural dinámico (Star Excursion Balance Test).' },
    { id: 'pie_fascitis', area: 'Tobillo / Pie', nombre: 'Fascitis Plantar (Fasciopatía)', focoPrincipal: 'Diagnóstico diferencial anatómico, efecto Windlass, ejercicios de carga alta (Rathleff), y manejo de la rigidez matinal.' },
    { id: 'tobillo_tendinopatia_aquiliana', area: 'Tobillo / Pie', nombre: 'Tendinopatía Aquiliana (Porción media vs Insercional)', focoPrincipal: 'Diferenciación en tratamiento de insercional (evitar dorsiflexión máxima) vs porción media, protocolo de Alfredson modificado.' },

    // ─── LESIONES MUSCULARES Y DEPORTIVAS GENERALES ───
    { id: 'muscular_isquiotibial', area: 'Pierna / Muslo', nombre: 'Desgarro Isquiotibial en Sprinter', focoPrincipal: 'Mecanismo de lesión (fase de oscilación terminal), ejercicios de alargamiento excéntrico (Nordic/Askling), y criterios de retorno.' },
    { id: 'muscular_desgarro_gemelo', area: 'Pierna / Muslo', nombre: 'Lesión del Tríceps Sural (Tennis Leg)', focoPrincipal: 'Diferenciación gastrocnemio vs sóleo, tiempos biológicos de cicatrización, y carga progresiva en flexión plantar.' },
    { id: 'deporte_sobreentrenamiento', area: 'Sistémico', nombre: 'Síndrome de Sobreentrenamiento (RED-S)', focoPrincipal: 'Banderas rojas metabólicas/psicológicas, manejo multidisciplinario, e interrogatorio de carga vs recuperación.' },
    
    // ─── DOLOR COMPLEJO ───
    { id: 'dolor_nociplastico', area: 'Sistémico', nombre: 'Dolor Nociplástico Dominante (Fibromialgia / Sensibilización)', focoPrincipal: 'Criterios de clasificación del dolor, educación terapéutica del dolor, ejercicios aeróbicos graduales, y modulación autonómica.' }
];
