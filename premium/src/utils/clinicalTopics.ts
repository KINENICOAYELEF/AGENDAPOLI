export interface ClinicalTopic {
    id: string;
    nombre: string;
    focoPrincipal: string;
    categoria: 
        | 'Anatomía Funcional'
        | 'Semiología'
        | 'Biomecánica'
        | 'Diagnóstico Diferencial'
        | 'Neurofisiología'
        | 'Bases del Tratamiento'
        | 'Dosificación y Reparación';
}

export const CLINICAL_TOPICS: ClinicalTopic[] = [
    // ─── ÁREA 1: ANATOMÍA FUNCIONAL Y ARTROCINEMÁTICA (32 TEMAS) ───
    {
        id: "a1",
        nombre: "A1. Relación longitud-tensión",
        focoPrincipal: "Entrena que el estudiante explique por qué un músculo no genera la misma fuerza en todo el rango articular. Debe aplicarlo a un ejercicio clínico y justificar cómo cambiaría la posición para facilitar o aumentar la demanda.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a2",
        nombre: "A2. Insuficiencia activa",
        focoPrincipal: "Entrena que el estudiante identifique cuándo un músculo biarticular pierde fuerza por estar demasiado acortado. Debe aplicarlo a un caso funcional y explicar cómo modificaría el ejercicio.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a3",
        nombre: "A3. Insuficiencia pasiva",
        focoPrincipal: "Entrena que el estudiante explique cuándo un músculo limita el movimiento por tensión pasiva excesiva. Debe diferenciarlo de rigidez articular o dolor protector.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a4",
        nombre: "A4. Brazo de momento",
        focoPrincipal: "Entrena que el estudiante explique por qué cambia la dificultad de un ejercicio según el ángulo articular. Debe conectar distancia de la carga, eje articular y torque.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a5",
        nombre: "A5. Torque articular",
        focoPrincipal: "Entrena que el estudiante diferencie peso externo de demanda real sobre una articulación. Debe explicar por qué dos ejercicios con el mismo peso pueden cargar distinto.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a6",
        nombre: "A6. Cadena abierta versus cadena cerrada",
        focoPrincipal: "Entrena que el estudiante diferencie función muscular en cadena abierta y cerrada. Debe explicar cómo cambia la demanda clínica y cuándo elegir cada una.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a7",
        nombre: "A7. Agonista, antagonista, sinergista, estabilizador y neutralizador",
        focoPrincipal: "Entrena que el estudiante no solo nombre músculos, sino que explique roles funcionales durante una tarea. Debe aplicarlo a un gesto clínico o deportivo.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a8",
        nombre: "A8. Co-contracción muscular",
        focoPrincipal: "Entrena que el estudiante explique cómo la co-contracción mejora estabilidad articular, pero también puede aumentar compresión o gasto energético. Debe aplicarlo a una articulación sintomática.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a9",
        nombre: "A9. Estabilizadores locales versus globales",
        focoPrincipal: "Entrena que el estudiante diferencie músculos de control segmentario y músculos productores de movimiento. Debe explicar cómo esto afecta la evaluación y la prescripción.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a10",
        nombre: "A10. Osteocinemática versus artrocinemática",
        focoPrincipal: "Entrena que el estudiante diferencie movimiento visible del segmento y movimiento accesorio articular. Debe aplicarlo a una restricción de rango.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a11",
        nombre: "A11. Regla cóncavo-convexa",
        focoPrincipal: "Entrena que el estudiante explique cómo se relacionan rodamiento y deslizamiento según la superficie articular. Debe aplicarlo a una movilización o restricción articular.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a12",
        nombre: "A12. Rodamiento, deslizamiento y giro",
        focoPrincipal: "Entrena que el estudiante explique los componentes artrocinemáticos de una articulación en movimiento. Debe relacionarlo con dolor, rigidez o limitación funcional.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a13",
        nombre: "A13. Patrón capsular versus no capsular",
        focoPrincipal: "Entrena que el estudiante diferencie una limitación compatible con compromiso capsular de una limitación por dolor, músculo, bloqueo o tejido específico.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a14",
        nombre: "A14. Manguito rotador",
        focoPrincipal: "Entrena que el estudiante explique la función real del manguito rotador más allá de rotar el hombro. Debe incluir centrado humeral, compresión articular y control durante elevación.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a15",
        nombre: "A15. Escápula y ritmo escapulohumeral",
        focoPrincipal: "Entrena que el estudiante explique el rol de serrato anterior, trapecio superior, medio e inferior durante elevación del brazo. Debe conectar escápula con dolor de hombro.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a16",
        nombre: "A16. Cervical: flexores profundos y extensores",
        focoPrincipal: "Entrena que el estudiante explique el rol de los flexores profundos, extensores y control segmentario cervical. Debe aplicarlo a dolor cervical o cefalea.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a17",
        nombre: "A17. Columna torácica",
        focoPrincipal: "Entrena que el estudiante explique la relación entre extensión torácica, rotación, respiración, cuello y hombro. Debe justificar por qué evaluarla en síntomas de hombro o cervical.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a18",
        nombre: "A18. Lumbar: multífidos, transverso y erectores",
        focoPrincipal: "Entrena que el estudiante diferencie control local, rigidez protectora y producción de movimiento lumbar. Debe aplicarlo a dolor lumbar funcional.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a19",
        nombre: "A19. Cadera: glúteo medio, menor y rotadores",
        focoPrincipal: "Entrena que el estudiante explique el rol de la musculatura lateral y profunda de cadera en apoyo monopodal. Debe relacionarlo con pelvis, fémur y rodilla.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a20",
        nombre: "A20. Cadera: glúteo mayor, psoas, recto femoral e isquiosurales",
        focoPrincipal: "Entrena que el estudiante explique cómo estos músculos participan en marcha, carrera, extensión de cadera, control pélvico y aceleración.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a21",
        nombre: "A21. Rodilla: cuádriceps, isquiosurales y gastrocnemio",
        focoPrincipal: "Entrena que el estudiante explique el control tibiofemoral desde músculos anteriores, posteriores y biarticulares. Debe aplicarlo a sentadilla, marcha o aterrizaje.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a22",
        nombre: "A22. Patelofemoral",
        focoPrincipal: "Entrena que el estudiante explique vectores del cuádriceps, tracking patelar y carga patelofemoral. Debe conectar rango de flexión con demanda articular.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a23",
        nombre: "A23. Tobillo-pie",
        focoPrincipal: "Entrena que el estudiante explique el rol del tríceps sural, tibial posterior, peroneos e intrínsecos del pie en apoyo, propulsión y estabilidad.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a24",
        nombre: "A24. Codo, muñeca, mano y pulgar",
        focoPrincipal: "Entrena que el estudiante explique agarre, pinza, rol de flexores/extensores y función del pulgar. Debe aplicarlo a dolor por carga o uso repetitivo.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a25",
        nombre: "A25. Neuroanatomía MSK básica",
        focoPrincipal: "Entrena que el estudiante reconozca dermatomas, miotomas, reflejos y nervios periféricos como base del screening neurológico.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a26",
        nombre: "A26. Dermatoma, miotoma, nervio periférico y raíz nerviosa",
        focoPrincipal: "Entrena que el estudiante diferencie territorio cutáneo, acción muscular, nervio periférico y raíz. Debe usarlo para razonar síntomas irradiados.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a27",
        nombre: "A27. Inervación articular y mecanorreceptores",
        focoPrincipal: "Entrena que el estudiante explique los tipos de mecanorreceptores articulares (I, II, III y IV), su rol en propiocepción y cómo participan en la modulación del dolor. Debe aplicarlo a una articulación sintomática o inestable.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a28",
        nombre: "A28. Propiocepción y sensación de posición articular",
        focoPrincipal: "Entrena que el estudiante diferencie aferencia propioceptiva y control motor. Debe explicar cómo la lesión articular afecta esta aferencia y cómo se entrena en rehabilitación de inestabilidad.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a29",
        nombre: "A29. Cadena cinética en gesto deportivo",
        focoPrincipal: "Entrena que el estudiante explique la integración de segmentos desde pie hasta mano en un gesto real. Debe identificar dónde puede originarse una falla y cómo eso afecta el segmento sintomático.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a30",
        nombre: "A30. Columna lumbar y pelvis: ritmo lumbopélvico",
        focoPrincipal: "Entrena que el estudiante explique el ritmo lumbopélvico, anteversión y retroversión pélvica durante carga axial. Debe aplicarlo a dolor lumbar en un gesto funcional.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a31",
        nombre: "A31. Articulación sacroilíaca",
        focoPrincipal: "Entrena que el estudiante explique la función de la ASI, cómo se carga, qué pruebas se usan para provocar dolor y cómo diferenciar este origen del dolor lumbar bajo o de cadera.",
        categoria: "Anatomía Funcional"
    },
    {
        id: "a32",
        nombre: "A32. Nervio periférico: movilización neural",
        focoPrincipal: "Entrena que el estudiante diferencie técnicas de tensión y deslizamiento neural. Debe aplicarlo clínicamente y explicar cuándo cada una es más apropiada.",
        categoria: "Anatomía Funcional"
    },

    // ─── ÁREA 2: SEMIOLOGÍA Y SIGNIFICADO TISULAR (21 TEMAS) ───
    {
        id: "s1",
        nombre: "S1. Dolor mecánico, inflamatorio y sistémico",
        focoPrincipal: "Entrena que el estudiante diferencie patrones de dolor según comportamiento clínico. Debe reconocer cuándo el dolor no parece mecánico.",
        categoria: "Semiología"
    },
    {
        id: "s2",
        nombre: "S2. Calidad del dolor",
        focoPrincipal: "Entrena que el estudiante interprete dolor punzante, quemante, eléctrico, profundo o difuso sin sobrediagnosticar. Debe usarlo como pista, no como diagnóstico único.",
        categoria: "Semiología"
    },
    {
        id: "s3",
        nombre: "S3. Dolor contráctil, articular, neural y referido",
        focoPrincipal: "Entrena que el estudiante diferencie dolor según tejido probable. Debe justificar cómo lo buscaría con activo, pasivo, resistido y pruebas neurodinámicas.",
        categoria: "Semiología"
    },
    {
        id: "s4",
        nombre: "S4. Diferenciación estructural del dolor",
        focoPrincipal: "Entrena que el estudiante use historia clínica y examen físico para orientar el tejido probable. Debe evitar decir 'es muscular' sin evidencia.",
        categoria: "Semiología"
    },
    {
        id: "s5",
        nombre: "S5. Edema, calor, rubor, hematoma y derrame",
        focoPrincipal: "Entrena que el estudiante explique qué significan estos signos y cómo modifican evaluación, carga y necesidad de derivación.",
        categoria: "Semiología"
    },
    {
        id: "s6",
        nombre: "S6. Rigidez matinal y rigidez post reposo",
        focoPrincipal: "Entrena que el estudiante diferencie rigidez inflamatoria, mecánica y degenerativa. Debe aplicarlo a la toma de decisiones.",
        categoria: "Semiología"
    },
    {
        id: "s7",
        nombre: "S7. Crepitación, chasquido, bloqueo y resalte",
        focoPrincipal: "Entrena que el estudiante diferencie ruidos benignos de síntomas mecánicos clínicamente relevantes. Debe explicar qué dato cambiaría su conducta.",
        categoria: "Semiología"
    },
    {
        id: "s8",
        nombre: "S8. Irradiación, parestesias y adormecimiento",
        focoPrincipal: "Entrena que el estudiante diferencie dolor referido, neurogénico y síntomas sensitivos. Debe explicar qué evaluaría primero.",
        categoria: "Semiología"
    },
    {
        id: "s9",
        nombre: "S9. Irritabilidad alta, media y baja",
        focoPrincipal: "Entrena que el estudiante clasifique irritabilidad según intensidad, facilidad de provocación y tiempo de recuperación. Debe ajustar evaluación y dosis.",
        categoria: "Semiología"
    },
    {
        id: "s10",
        nombre: "S10. Dolor durante, después y 24 horas post carga",
        focoPrincipal: "Entrena que el estudiante interprete respuesta al ejercicio. Debe decidir si progresar, mantener o bajar carga según síntomas posteriores.",
        categoria: "Semiología"
    },
    {
        id: "s11",
        nombre: "S11. Dolor que mejora al calentarse",
        focoPrincipal: "Entrena que el estudiante interprete el fenómeno de dolor inicial que disminuye con movimiento. Debe relacionarlo con tendón, rigidez o modulación del dolor.",
        categoria: "Semiología"
    },
    {
        id: "s12",
        nombre: "S12. Dolor aceptable versus alarma",
        focoPrincipal: "Entrena que el estudiante diferencie dolor tolerable en rehabilitación de dolor que indica irritabilidad excesiva o posible daño.",
        categoria: "Semiología"
    },
    {
        id: "s13",
        nombre: "S13. Rigidez, acortamiento, espasmo y limitación capsular",
        focoPrincipal: "Entrena que el estudiante no use 'acortado' para todo. Debe diferenciar causas posibles de limitación de movimiento.",
        categoria: "Semiología"
    },
    {
        id: "s14",
        nombre: "S14. End-feel normal versus patológico",
        focoPrincipal: "Entrena que el estudiante interprete sensación final de movimiento pasivo. Debe relacionarlo con tejido y restricción.",
        categoria: "Semiología"
    },
    {
        id: "s15",
        nombre: "S15. Inhibición muscular por dolor o derrame",
        focoPrincipal: "Entrena que el estudiante explique por qué un músculo puede 'fallar' sin estar lesionado. Debe aplicarlo a cuádriceps, hombro u otra zona.",
        categoria: "Semiología"
    },
    {
        id: "s16",
        nombre: "S16. Inestabilidad real, inseguridad y aprehensión",
        focoPrincipal: "Entrena que el estudiante diferencie laxitud objetiva, sensación subjetiva de inseguridad y miedo al movimiento.",
        categoria: "Semiología"
    },
    {
        id: "s17",
        nombre: "S17. Debilidad por dolor, desuso o lesión neurológica",
        focoPrincipal: "Entrena que el estudiante diferencie causas de debilidad. Debe explicar cómo lo evaluaría sin asumir que todo es falta de fuerza.",
        categoria: "Semiología"
    },
    {
        id: "s18",
        nombre: "S18. Síntomas mecánicos verdaderos versus ruidos benignos",
        focoPrincipal: "Entrena que el estudiante diferencie bloqueo, catching o trabas funcionales de crepitaciones no preocupantes.",
        categoria: "Semiología"
    },
    {
        id: "s19",
        nombre: "S19. Dolor nocturno, en reposo o progresivo",
        focoPrincipal: "Entrena que el estudiante reconozca patrones potencialmente no mecánicos. Debe decidir cuándo ampliar evaluación o derivar.",
        categoria: "Semiología"
    },
    {
        id: "s20",
        nombre: "S20. Red flags MSK",
        focoPrincipal: "Entrena que el estudiante identifique señales de fractura, infección, cáncer, compromiso neurológico severo o vascular. Debe priorizar seguridad clínica.",
        categoria: "Semiología"
    },
    {
        id: "s21",
        nombre: "S21. Discrepancia entre síntomas y hallazgos",
        focoPrincipal: "Entrena que el estudiante interprete el fenómeno de mucho dolor con poco daño objetivable, y poco dolor con mucho daño estructural. Debe relacionarlo con sensibilización, contexto y nocicepción sin invalidar al usuario.",
        categoria: "Semiología"
    },

    // ─── ÁREA 3: BIOMECÁNICA DEL MECANISMO LESIONAL (20 TEMAS) ───
    {
        id: "b1",
        nombre: "B1. Tensión, compresión y cizalla",
        focoPrincipal: "Entrena que el estudiante explique cómo fallan distintos tejidos según la fuerza aplicada. Debe aplicarlo al mecanismo lesional del caso.",
        categoria: "Biomecánica"
    },
    {
        id: "b2",
        nombre: "B2. Compresión, tensión, torsión y cizalla",
        focoPrincipal: "Entrena que el estudiante diferencie fuerzas mecánicas básicas. Debe conectar cada fuerza con tejidos probablemente afectados.",
        categoria: "Biomecánica"
    },
    {
        id: "b3",
        nombre: "B3. Capacidad del tejido versus demanda de la tarea",
        focoPrincipal: "Entrena que el estudiante explique lesión o dolor como desbalance entre capacidad y demanda. Debe aplicarlo a progresión de carga.",
        categoria: "Biomecánica"
    },
    {
        id: "b4",
        nombre: "B4. Carga externa versus carga interna",
        focoPrincipal: "Entrena que el estudiante diferencie lo que se ve desde fuera y lo que realmente soporta el tejido. Debe aplicarlo a un ejercicio o gesto deportivo.",
        categoria: "Biomecánica"
    },
    {
        id: "b5",
        nombre: "B5. Fuerza de reacción del suelo y momento articular",
        focoPrincipal: "Entrena que el estudiante explique cómo el suelo, el centro de masa y la posición articular modifican la carga.",
        categoria: "Biomecánica"
    },
    {
        id: "b6",
        nombre: "B6. Carga aguda excesiva versus carga acumulada",
        focoPrincipal: "Entrena que el estudiante diferencie lesión por evento único de sobrecarga progresiva. Debe usar historia de entrenamiento o actividad.",
        categoria: "Biomecánica"
    },
    {
        id: "b7",
        nombre: "B7. Trauma, sobreuso y persistencia de síntomas",
        focoPrincipal: "Entrena que el estudiante diferencie mecanismo traumático, carga repetida y dolor persistente no explicado solo por daño.",
        categoria: "Biomecánica"
    },
    {
        id: "b8",
        nombre: "B8. Velocidad, rango, fatiga y técnica",
        focoPrincipal: "Entrena que el estudiante explique cómo estas variables cambian carga y riesgo. Debe aplicarlo a una modificación de ejercicio.",
        categoria: "Biomecánica"
    },
    {
        id: "b9",
        nombre: "B9. Tronco y centro de masa",
        focoPrincipal: "Entrena que el estudiante explique cómo la posición del tronco y centro de masa cambia demanda en cadera, rodilla o tobillo.",
        categoria: "Biomecánica"
    },
    {
        id: "b10",
        nombre: "B10. Control proximal versus distal",
        focoPrincipal: "Entrena que el estudiante explique cuándo un problem distal puede depender de control proximal y cuándo no debe sobreinterpretarlo.",
        categoria: "Biomecánica"
    },
    {
        id: "b11",
        nombre: "B11. Aterrizaje",
        focoPrincipal: "Entrena que el estudiante analice absorción de carga, rigidez, flexión de cadera/rodilla/tobillo y distribución de fuerzas.",
        categoria: "Biomecánica"
    },
    {
        id: "b12",
        nombre: "B12. Cambio de dirección",
        focoPrincipal: "Entrena que el estudiante analice frenado, rotación, control frontal y reaceleración. Debe conectar biomecánica con lesión.",
        categoria: "Biomecánica"
    },
    {
        id: "b13",
        nombre: "B13. Desaceleración excéntrica",
        focoPrincipal: "Entrena que el estudiante explique por qué muchas lesiones ocurren durante frenado, aterrizaje o control excéntrico.",
        categoria: "Biomecánica"
    },
    {
        id: "b14",
        nombre: "B14. Esguince lateral de tobillo",
        focoPrincipal: "Entrena que el estudiante analice inversión, supinación, ligamentos laterales y diferenciales importantes.",
        categoria: "Biomecánica"
    },
    {
        id: "b15",
        nombre: "B15. LCA y valgo dinámico",
        focoPrincipal: "Entrena que el estudiante explique fuerzas de valgo, rotación, traslación tibial y mecanismo sin contacto.",
        categoria: "Biomecánica"
    },
    {
        id: "b16",
        nombre: "B16. Dolor patelofemoral",
        focoPrincipal: "Entrena que el estudiante explique cómo escalera, sentadilla y carrera modifican carga patelofemoral.",
        categoria: "Biomecánica"
    },
    {
        id: "b17",
        nombre: "B17. Sobrecarga tendinosa",
        focoPrincipal: "Entrena que el estudiante explique cómo la carga repetida, compresión y tracción afectan tendones como Aquiles, patelar o manguito rotador.",
        categoria: "Biomecánica"
    },
    {
        id: "b18",
        nombre: "B18. Lesión muscular",
        focoPrincipal: "Entrena que el estudiante explique sprint, cambio de dirección y desaceleración como contextos de alta demanda excéntrica.",
        categoria: "Biomecánica"
    },
    {
        id: "b19",
        nombre: "B19. Dolor lumbar",
        focoPrincipal: "Entrena que el estudiante analice flexión, extensión, carga axial, cizalla y tolerancia individual de tejidos.",
        categoria: "Biomecánica"
    },
    {
        id: "b20",
        nombre: "B20. Hombro overhead",
        focoPrincipal: "Entrena que el estudiante explique fase de armado, aceleración, desaceleración, manguito rotador y escápula.",
        categoria: "Biomecánica"
    },

    // ─── ÁREA 4: DIAGNÓSTICO DIFERENCIAL Y PRUEBAS CLÍNICAS (35 TEMAS) ───
    {
        id: "d1",
        nombre: "D1. Tejido contráctil versus tejido inerte",
        focoPrincipal: "Entrena que el estudiante use activo, pasivo y resistido para diferenciar músculo-tendón de cápsula, ligamento, articulación u otro tejido.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d2",
        nombre: "D2. Dolor con movimiento activo, pasivo y resistido",
        focoPrincipal: "Entrena que el estudiante interprete combinaciones de dolor o limitación. Debe generar hipótesis, no diagnóstico cerrado.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d3",
        nombre: "D3. Rango activo versus rango pasivo",
        focoPrincipal: "Entrena que el estudiante explique qué significa que el activo esté limitado y el pasivo esté conservado, o viceversa.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d4",
        nombre: "D4. Lesión muscular, tendinosa, articular y neural",
        focoPrincipal: "Entrena que el estudiante diferencie patrones clínicos básicos de estos tejidos desde historia y examen físico.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d5",
        nombre: "D5. Screening neurológico básico",
        focoPrincipal: "Entrena que el estudiante explique fuerza, sensibilidad y reflejos como mínimo ante síntomas neurológicos.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d6",
        nombre: "D6. Dermatoma, miotoma, nervio periférico y raíz",
        focoPrincipal: "Entrena que el estudiante use neuroanatomía clínica para diferenciar radiculopatía de atrapamiento periférico.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d7",
        nombre: "D7. Dolor radicular versus dolor referido",
        focoPrincipal: "Entrena que el estudiante explique diferencias de distribución, calidad, síntomas neurológicos y comportamiento clínico.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d8",
        nombre: "D8. Centralización y periferización",
        focoPrincipal: "Entrena que el estudiante explique qué significa que los síntomas se acerquen o alejen de la columna durante movimientos repetidos.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d9",
        nombre: "D9. Atrapamiento periférico versus radiculopatía",
        focoPrincipal: "Entrena que el estudiante compare distribución sensitiva, miotomas, reflejos y pruebas provocativas.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d10",
        nombre: "D10. Prueba para descartar versus confirmar",
        focoPrincipal: "Entrena que el estudiante explique cuándo una prueba sensible ayuda a descartar y cuándo una específica ayuda a confirmar.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d11",
        nombre: "D11. Sensibilidad, especificidad, SpIn y SnOut",
        focoPrincipal: "Entrena que el estudiante entienda utilidad clínica sin inventar números. Debe explicar el concepto aplicado a un test.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d12",
        nombre: "D12. Clusters clínicos",
        focoPrincipal: "Entrena que el estudiante explique por qué una sola prueba no basta. Debe construir un grupo de hallazgos coherentes.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d13",
        nombre: "D13. Hipótesis principal y alternativas",
        focoPrincipal: "Entrena que el estudiante plantee una hipótesis principal y al menos dos alternativas razonables. Debe justificar cada una.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d14",
        nombre: "D14. Jerarquización de hipótesis",
        focoPrincipal: "Entrena que el estudiante ordene hipótesis según historia, mecanismo, síntomas y examen físico.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d15",
        nombre: "D15. Derivación clínica",
        focoPrincipal: "Entrena que el estudiante reconozca cuándo derivar por fractura, infección, tumor, compromiso neurológico progresivo o vascular.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d16",
        nombre: "D16. Cervical",
        focoPrincipal: "Entrena que el estudiante diferencie radiculopatía cervical, dolor facetario, dolor muscular y hombro referido.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d17",
        nombre: "D17. Hombro",
        focoPrincipal: "Entrena que el estudiante diferencie manguito rotador, dolor subacromial, acromioclavicular y origen cervical.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d18",
        nombre: "D18. Codo",
        focoPrincipal: "Entrena que el estudiante diferencie epicondilalgia lateral, túnel radial y dolor referido cervical.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d19",
        nombre: "D19. Muñeca, mano y pulgar",
        focoPrincipal: "Entrena que el estudiante diferencie De Quervain, CMC, túnel carpiano, flexores y dolor por sobreuso.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d20",
        nombre: "D20. Lumbar",
        focoPrincipal: "Entrena que el estudiante diferencie dolor radicular, dolor referido, sacroilíaco y cadera.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d21",
        nombre: "D21. Cadera lateral",
        focoPrincipal: "Entrena que el estudiante diferencie tendinopatía glútea, dolor trocantérico, origen lumbar y dolor referido.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d22",
        nombre: "D22. Ingle y cadera anterior",
        focoPrincipal: "Entrena que el estudiante diferencie aductores, iliopsoas, pinzamiento femoroacetabular y labrum.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d23",
        nombre: "D23. Rodilla anterior",
        focoPrincipal: "Entrena que el estudiante diferencie patelofemoral, tendón patelar, Hoffa y plica.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d24",
        nombre: "D24. Rodilla medial y lateral",
        focoPrincipal: "Entrena que el estudiante diferencie menisco, ligamentos, artrosis y tendones periarticulares.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d25",
        nombre: "D25. Tobillo",
        focoPrincipal: "Entrena que el estudiante diferencie esguince lateral, sindesmosis, fractura oculta y tendinopatías.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d26",
        nombre: "D26. Pie y talón",
        focoPrincipal: "Entrena que el estudiante diferencie fascia plantar, túnel tarsal, estrés óseo y Aquiles.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d27",
        nombre: "D27. Atrapamientos periféricos",
        focoPrincipal: "Entrena que el estudiante diferencie mediano, cubital, radial, peroneo y tibial según síntomas y función.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d28",
        nombre: "D28. Pruebas de provocación cervical",
        focoPrincipal: "Entrena que el estudiante explique Spurling, distracción cervical y ULNT. Debe conocer la utilidad clínica de cada una, cuándo usarlas y cuáles son sus limitaciones sin inventar valores exactos.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d29",
        nombre: "D29. Pruebas de hombro",
        focoPrincipal: "Entrena que el estudiante explique Neer, Hawkins-Kennedy, Jobe, apprehension y O'Brien. Debe construir un cluster clínico y evitar interpretar una sola prueba de forma aislada.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d30",
        nombre: "D30. Pruebas de rodilla",
        focoPrincipal: "Entrena que el estudiante explique Lachman, cajón anterior, McMurray, Thessaly y pruebas de varo/valgo. Debe indicar cuándo aplicar cada una y qué estructura evalúa.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d31",
        nombre: "D31. Pruebas de cadera",
        focoPrincipal: "Entrena que el estudiante explique FADDIR, FABER, Thomas y Trendelenburg. Debe diferenciar tejidos implicados y aplicarlo a un caso con dolor de cadera o lumbar bajo.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d32",
        nombre: "D32. Pruebas de tobillo",
        focoPrincipal: "Entrena que el estudiante explique cajón anterior de tobillo, inclinación del talo y squeeze test para sindesmosis. Debe integrarlas con historia y mecanismo lesional.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d33",
        nombre: "D33. Pruebas de columna lumbar",
        focoPrincipal: "Entrena que el estudiante explique SLR, Slump, extensión en cuadrante y Kemp. Debe explicar qué estructura compromete cada una y cómo interpretar resultado positivo.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d34",
        nombre: "D34. Evaluación de fuerza muscular manual",
        focoPrincipal: "Entrena que el estudiante use el grading muscular con criterio. Debe conocer sus limitaciones y explicar cuándo complementar con dinamometría o prueba funcional.",
        categoria: "Diagnóstico Diferencial"
    },
    {
        id: "d35",
        nombre: "D35. Evaluación funcional básica",
        focoPrincipal: "Entrena que el estudiante explique SEBT, salto unipodal, step-down y cuclilla monopodal. Debe conocer qué evalúa cada prueba y qué criterios orientan normalidad o déficit clínico.",
        categoria: "Diagnóstico Diferencial"
    },

    // ─── ÁREA 5: NEUROFISIOLOGÍA DEL DOLOR (19 TEMAS) ───
    {
        id: "n1",
        nombre: "N1. Nocicepción versus dolor",
        focoPrincipal: "Entrena que el estudiante explique que nocicepción no es igual a dolor. Debe aplicarlo a un paciente con síntomas persistentes.",
        categoria: "Neurofisiología"
    },
    {
        id: "n2",
        nombre: "N2. Dolor como output cerebral",
        focoPrincipal: "Entrena que el estudiante explique dolor como experiencia protectora influida por contexto, amenaza y sistema nervioso.",
        categoria: "Neurofisiología"
    },
    {
        id: "n3",
        nombre: "N3. Dolor nociceptivo, neuropático y nociplástico",
        focoPrincipal: "Entrena que el estudiante clasifique el dolor del caso y justifique por qué no todos los dolores indican daño tisular local.",
        categoria: "Neurofisiología"
    },
    {
        id: "n4",
        nombre: "N4. Sensibilización periférica y central",
        focoPrincipal: "Entrena que el estudiante diferencie aumento de sensibilidad local de cambios más amplios del sistema nervioso.",
        categoria: "Neurofisiología"
    },
    {
        id: "n5",
        nombre: "N5. Hiperalgesia y alodinia",
        focoPrincipal: "Entrena que el estudiante explique diferencia entre respuesta exagerada a estímulo doloroso y dolor ante estímulo no doloroso.",
        categoria: "Neurofisiología"
    },
    {
        id: "n6",
        nombre: "N6. Miedo, evitación, amenaza y autoeficacia",
        focoPrincipal: "Entrena que el estudiante explique cómo factores psicológicos y conductuales modifican dolor, función y adherencia.",
        categoria: "Neurofisiología"
    },
    {
        id: "n7",
        nombre: "N7. Expectativa y amenaza",
        focoPrincipal: "Entrena que el estudiante explique cómo las expectativas del paciente pueden amplificar o disminuir la experiencia dolorosa.",
        categoria: "Neurofisiología"
    },
    {
        id: "n8",
        nombre: "N8. Modulación descendente",
        focoPrincipal: "Entrena que el estudiante explique vías inhibitorias y facilitadoras de dolor de forma clínica, no solo teórica.",
        categoria: "Neurofisiología"
    },
    {
        id: "n9",
        nombre: "N9. Dolor persistente posterior a cicatrización",
        focoPrincipal: "Entrena que el estudiante explique por qué puede persistir dolor aunque el tejido haya reparado parcialmente o completamente.",
        categoria: "Neurofisiología"
    },
    {
        id: "n10",
        nombre: "N10. Dolor proporcional versus desproporcionado",
        focoPrincipal: "Entrena que el estudiante diferencie dolor coherente con el estado tisular de dolor desproporcionado o generalizado.",
        categoria: "Neurofisiología"
    },
    {
        id: "n11",
        nombre: "N11. Placebo, nocebo y comunicación",
        focoPrincipal: "Entrena que el estudiante identifique frases clínicas que aumentan amenaza y proponga alternativas anti-nocebo.",
        categoria: "Neurofisiología"
    },
    {
        id: "n12",
        nombre: "N12. Explicar dolor sin generar nocebo",
        focoPrincipal: "Entrena que el estudiante explique dolor de forma educativa, simple y tranquilizadora sin negar la experiencia del usuario.",
        categoria: "Neurofisiología"
    },
    {
        id: "n13",
        nombre: "N13. Hipoalgesia inducida por ejercicio",
        focoPrincipal: "Entrena que el estudiante explique por qué el ejercicio puede disminuir dolor por mecanismos periféricos y centrales.",
        categoria: "Neurofisiología"
    },
    {
        id: "n14",
        nombre: "N14. Banderas amarillas",
        focoPrincipal: "Entrena que el estudiante identifique miedo, catastrofismo, evitación, baja autoeficacia y creencias amenazantes.",
        categoria: "Neurofisiología"
    },
    {
        id: "n15",
        nombre: "N15. Sueño, estrés, carga y sensibilidad",
        focoPrincipal: "Entrena que el estudiante explique cómo sueño, estrés y carga acumulada modifican dolor y tolerancia al ejercicio.",
        categoria: "Neurofisiología"
    },
    {
        id: "n16",
        nombre: "N16. Kinesofobia y Tampa Scale",
        focoPrincipal: "Entrena que el estudiante explique qué mide la Tampa Scale for Kinesiophobia, cómo interpretar el resultado y qué haría con un usuario con puntaje alto. Debe evitar reforzar el miedo con el propio lenguaje.",
        categoria: "Neurofisiología"
    },
    {
        id: "n17",
        nombre: "N17. Catastrofismo",
        focoPrincipal: "Entrena que el estudiante identifique el catastrofismo en el discurso clínico del usuario y explique cómo abordarlo sin psicologizar en exceso ni minimizar el dolor.",
        categoria: "Neurofisiología"
    },
    {
        id: "n18",
        nombre: "N18. Banderas azules y negras",
        focoPrincipal: "Entrena que el estudiante diferencie banderas azules (contexto laboral y social) de banderas negras (factores sistémicos y económicos). Debe saber cuándo mencionarlas al equipo de salud.",
        categoria: "Neurofisiología"
    },
    {
        id: "n19",
        nombre: "N19. Comunicación de resultados de imágenes",
        focoPrincipal: "Entrena que el estudiante explique hallazgos radiológicos frecuentes del envejecimiento sin generar nocebo. Debe diferenciar hallazgo incidental de patología clínicamente relevante.",
        categoria: "Neurofisiología"
    },

    // ─── ÁREA 6: BASES TEÓRICAS DEL TRATAMIENTO (17 TEMAS) ───
    {
        id: "t1",
        nombre: "T1. Mecanoterapia y mecanotransducción",
        focoPrincipal: "Entrena que el estudiante explique por qué el ejercicio puede modificar tejido y capacidad, no solo 'fortalecer'.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t2",
        nombre: "T2. Principio de especificidad",
        focoPrincipal: "Entrena que el estudiante explique por qué el ejercicio debe parecerse progresivamente al objetivo funcional o deportivo.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t3",
        nombre: "T3. Sobrecarga progresiva",
        focoPrincipal: "Entrena que el estudiante explique cómo aumentar demanda sin exceder tolerancia del tejido o sistema.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t4",
        nombre: "T4. Tolerancia individual a la carga",
        focoPrincipal: "Entrena que el estudiante explique por qué dos pacientes con la misma patología toleran dosis diferentes.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t5",
        nombre: "T5. Analgesia, adaptación tisular y mejora de capacidad",
        focoPrincipal: "Entrena que el estudiante diferencie alivio de dolor, adaptación estructural y mejora funcional.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t6",
        nombre: "T6. Elegir movilidad, fuerza, control motor, potencia o exposición gradual",
        focoPrincipal: "Entrena que el estudiante seleccione el objetivo terapéutico según la limitación principal del caso.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t7",
        nombre: "T7. Isométricos, isotónicos, excéntricos y heavy slow resistance",
        focoPrincipal: "Entrena que el estudiante explique diferencias, usos clínicos y errores comunes en la elección del tipo de contracción.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t8",
        nombre: "T8. Movilidad, control motor, fuerza, potencia y capacidad funcional",
        focoPrincipal: "Entrena que el estudiante ordene prioridades terapéuticas según fase, irritabilidad y objetivo funcional.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t9",
        nombre: "T9. Adaptación del tendón a la carga",
        focoPrincipal: "Entrena que el estudiante explique cómo el tendón responde a carga progresiva y por qué no basta con reposo.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t10",
        nombre: "T10. Hipertrofia y ganancia de fuerza",
        focoPrincipal: "Entrena que el estudiante explique diferencias básicas entre adaptación neural, hipertrofia y mejora de rendimiento.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t11",
        nombre: "T11. Control motor y aprendizaje motor",
        focoPrincipal: "Entrena que el estudiante explique cómo se aprende o reaprende un patrón de movimiento y cómo dar feedback.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t12",
        nombre: "T12. Ejercicio correctivo, de capacidad y de reintegro",
        focoPrincipal: "Entrena que el estudiante diferencie un ejercicio para modificar control, aumentar tolerancia o preparar retorno a actividad.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t13",
        nombre: "T13. Terapia manual: Maitland y Mulligan",
        focoPrincipal: "Entrena que el estudiante explique efectos biomecánicos y neurofisiológicos esperados, sin vender la terapia manual como solución única.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t14",
        nombre: "T14. Efectos reales de la terapia manual",
        focoPrincipal: "Entrena que el estudiante explique analgesia, modulación, confianza y movimiento, diferenciándolo de cambios estructurales permanentes.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t15",
        nombre: "T15. Intervención pasiva y dependencia",
        focoPrincipal: "Entrena que el estudiante identifique cuándo una intervención pasiva ayuda y cuándo puede reforzar dependencia o baja autoeficacia.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t16",
        nombre: "T16. Hielo, calor y TENS",
        focoPrincipal: "Entrena que el estudiante explique indicaciones, límites y fisiología básica de agentes físicos, sin priorizarlos sobre ejercicio y educación.",
        categoria: "Bases del Tratamiento"
    },
    {
        id: "t17",
        nombre: "T17. Educación clínica y adherencia",
        focoPrincipal: "Entrena que el estudiante explique cómo educar sin nocebo, mejorar adherencia y dejar un plan domiciliario simple.",
        categoria: "Bases del Tratamiento"
    },

    // ─── ÁREA 7: DOSIFICACIÓN, PRONÓSTICO Y REPARACIÓN (19 TEMAS) ───
    {
        id: "p1",
        nombre: "P1. FITT-VP",
        focoPrincipal: "Entrena que el estudiante use frecuencia, intensidad, tiempo, tipo, volumen y progresión para prescribir ejercicio de forma completa.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p2",
        nombre: "P2. Intensidad, volumen, frecuencia y densidad",
        focoPrincipal: "Entrena que el estudiante diferencie variables de carga y explique cómo modificaría una sin cambiar todas.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p3",
        nombre: "P3. RPE, RIR y escala de dolor",
        focoPrincipal: "Entrena que el estudiante use esfuerzo percibido, repeticiones en reserva y dolor para ajustar una sesión real.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p4",
        nombre: "P4. Dolor permitido durante y después del ejercicio",
        focoPrincipal: "Entrena que el estudiante defina límites razonables de dolor y explique qué haría según respuesta 24 horas post carga.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p5",
        nombre: "P5. Progresar, mantener o regresar carga",
        focoPrincipal: "Entrena que el estudiante decida una progresión según síntomas, rendimiento, irritabilidad y recuperación.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p6",
        nombre: "P6. Progresión por volumen, intensidad, velocidad, rango y complejidad",
        focoPrincipal: "Entrena que el estudiante explique que progresar no es solo 'subir peso'. Debe elegir una variable según el caso.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p7",
        nombre: "P7. Avanzar de isométrico a dinámico",
        focoPrincipal: "Entrena que el estudiante defina criterios mínimos para pasar de contracciones isométricas a movimiento dinámico.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p8",
        nombre: "P8. Avanzar de fuerza a potencia",
        focoPrincipal: "Entrena que el estudiante defina criterios mínimos para introducir velocidad, saltos o acciones explosivas.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p9",
        nombre: "P9. Avanzar de ejercicio controlado a gesto deportivo",
        focoPrincipal: "Entrena que el estudiante explique cuándo pasar de ejercicios aislados a tareas funcionales o deportivas.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p10",
        nombre: "P10. Irritabilidad, tolerancia y carga acumulada",
        focoPrincipal: "Entrena que el estudiante ajuste progresión considerando no solo dolor actual, sino respuesta acumulada de la semana.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p11",
        nombre: "P11. Fases de reparación",
        focoPrincipal: "Entrena que el estudiante explique fases inflamatoria, proliferativa y remodelación, y cómo modifican la carga.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p12",
        nombre: "P12. Reparación tisular versus recuperación funcional",
        focoPrincipal: "Entrena que el estudiante explique por qué un tejido puede haber cicatrizado pero el paciente aún no estar listo funcionalmente.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p13",
        nombre: "P13. Colágeno, tendón, músculo y ligamento",
        focoPrincipal: "Entrena que el estudiante explique diferencias básicas de reparación y adaptación entre tejidos.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p14",
        nombre: "P14. Tiempos biológicos generales",
        focoPrincipal: "Entrena que el estudiante maneje tiempos generales de músculo, tendón, ligamento y hueso sin prometer fechas exactas.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p15",
        nombre: "P15. Retorno a correr o deporte",
        focoPrincipal: "Entrena que el estudiante proponga criterios mínimos de fuerza, tolerancia, salto, cambio de dirección y exposición progresiva.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p16",
        nombre: "P16. Alta clínica",
        focoPrincipal: "Entrena que el estudiante explique alta basada en objetivos, criterios funcionales, riesgo de recaída y plan de seguimiento.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p17",
        nombre: "P17. Alta precoz",
        focoPrincipal: "Entrena que el estudiante explique por qué ausencia de dolor no significa recuperación completa de capacidad.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p18",
        nombre: "P18. Carga aguda-crónica",
        focoPrincipal: "Entrena que el estudiante explique de forma simple cómo cambios bruscos de carga aumentan riesgo de síntomas o recaída.",
        categoria: "Dosificación y Reparación"
    },
    {
        id: "p19",
        nombre: "P19. Pronóstico favorable, reservado y desfavorable",
        focoPrincipal: "Entrena que el estudiante justifique pronóstico según irritabilidad, afectación, contexto, sueño, carga y evolución clínica.",
        categoria: "Dosificación y Reparación"
    }
];
