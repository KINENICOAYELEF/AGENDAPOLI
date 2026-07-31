import { KNEE_PRESCRIPTION_TOPICS } from './prescriptionTopics';

export interface KneeTopic {
    id: string;
    nombre: string;
    categoria: 'Gonartrosis' | 'Artroplastia (PTR)' | 'Evaluación y Reevaluación' | 'Dolor Patelofemoral' | 'LCA y retorno al deporte' | 'Menisco y Cartílago' | 'Tendón Patelar';
    contenidoBase: string;
    preguntasEtapa2: string[];
    casoEtapa3: string;
    preguntasEtapa4: string[];
}

export const KNEE_TOPICS: KneeTopic[] = [
    {
        id: "k1.1",
        nombre: "1.1 — Fisiopatología y tejidos involucrados",
        categoria: "Gonartrosis",
        contenidoBase: `
- Gonartrosis = enfermedad articular compleja, no solo "desgaste del cartílago".
- Tejidos: cartílago (sin inervación, no duele directamente; pierde colágeno tipo II y proteoglicanos), hueso subcondral (inervado, se esclerosa, forma osteofitos, es fuente real de dolor), membrana sinovial (sinovitis crónica de bajo grado, produce IL-1 y TNF-α que sensibilizan nociceptores periféricos), cápsula articular, músculos periarticulares (cuádriceps se inhibe por derrame = inhibición artrogénica).
- Daño estructural NO predice el dolor: KL grado 4 puede tener menos dolor que KL grado 2. Explaya por qué con mecanismos de sensibilización.
- Caso integrado en la explicación: Don Pedro, 70 años, KL grado 2, dolor 8/10. El médico dice "tiene poca artrosis para tanto dolor". Úsalo para ilustrar la disociación imagen-clínica y la sensibilización periférica.
`,
        preguntasEtapa2: [
            "¿Qué tejidos generan dolor en gonartrosis y por qué el cartílago no es la fuente directa?",
            "Explica cómo se produce la disociación imagen-clínica en un paciente con artrosis de rodilla.",
            "¿Cuál es el mecanismo de la inhibición artrogénica del cuádriceps ante un derrame articular y qué impacto tiene?"
        ],
        casoEtapa3: `"Doña Rosa, 65 años. KL grado 4 rodilla izquierda con dolor 1/10. KL grado 3 derecha con dolor 7/10 e incapacidad para subir escaleras." Explica con tus palabras por qué ocurre esa diferencia usando los mecanismos fisiopatológicos discutidos. No uses respuestas simplistas de "las imágenes no predicen el dolor" sin explicar el mecanismo subyacente.`,
        preguntasEtapa4: [
            "¿Por qué el cartílago no es la fuente principal de dolor en la gonartrosis?",
            "¿Cómo influyen los mediadores inflamatorios de la sinovitis de bajo grado en el umbral del nociceptor?",
            "¿Qué es la escala Kellgren-Lawrence (KL) y cuál es su principal limitación en la toma de decisiones clínicas?"
        ]
    },
    {
        id: "k1.2",
        nombre: "1.2 — Factores de riesgo y progresión",
        categoria: "Gonartrosis",
        contenidoBase: `
- No modificables: edad (principal), sexo femenino (rol de estrógenos en metabolismo del cartílago), lesiones previas (meniscectomía total aumenta riesgo ~5 veces; LCA genera cambios biomecánicos crónicos), genética.
- Modificables: mayor adiposidad, baja capacidad de fuerza, carga laboral repetitiva, inactividad física y tolerancia reducida a la carga. No se explica el problema como una rodilla que "se seca" o un cartílago que deja de nutrirse: el foco clínico es recuperar capacidad y actividad de forma progresiva.
- El ejercicio no "desgasta": mejora la capacidad de carga del tejido y reduce inflamación sistémica.
- Caso integrado: Doña Carmen, 62 años, IMC 34, 20 años de trabajo con carga, ahora evita moverse "para no desgastarse más". Úsalo para mostrar cómo el sedentarismo es el factor activo más dañino en su caso.
`,
        preguntasEtapa2: [
            "¿Qué diferencia práctica hay entre los factores de riesgo modificables y no modificables en la gonartrosis?",
            "Explica detalladamente la diferencia entre los mecanismos mecánicos e inflamatorios de la obesidad sobre la articulación de la rodilla.",
            "¿Cómo explicas, sin mitos sobre 'nutrir el cartílago', por qué la inactividad puede reducir la capacidad funcional y la tolerancia a la carga?"
        ],
        casoEtapa3: `"Don Rodrigo, 58 años, exfutbolista, IMC 29, meniscectomía parcial medial a los 35 años, trabaja sentado. Su hermano gemelo también tiene gonartrosis." Identifica y clasifica todos sus factores de riesgo. Propón cuáles puedes abordar desde la kinesiología y justifica cómo lo harás.`,
        preguntasEtapa4: [
            "¿Cuánta carga adicional genera cada kilogramo de peso corporal extra en la rodilla por cada paso dado?",
            "¿Por qué una meniscectomía total aumenta exponencialmente más el riesgo de gonartrosis que una parcial?",
            "¿Qué son las adipocinas y por qué explican la correlación entre obesidad y osteoartritis en articulaciones sin carga (como las manos)?"
        ]
    },
    {
        id: "k1.3",
        nombre: "1.3 — Tipos de dolor: nociceptivo, nociplástico y sensibilización",
        categoria: "Gonartrosis",
        contenidoBase: `
- Dolor nociceptivo mecánico: origen en tejidos inervados (hueso subcondral, sinovial, cápsula). Empeora con carga, mejora con reposo, bien localizado.
- Sensibilización periférica: mediadores inflamatorios (IL-1, TNF-α, bradiquinina, prostaglandinas) bajan el umbral de nociceptores articulares. Más dolor con menos estímulo. Reversible. Puente entre inflamación local y dolor crónico.
- Dolor nociplástico / sensibilización central: SNC amplifica el dolor. Señales: dolor difuso o bilateral, alodinia, hiperalgesia, distribución no mecánica, mala respuesta al ejercicio, mal sueño, fatiga, ansiedad. Hasta 30% de gonartrosis crónica. NO mejora bien con cirugía sola.
- Componente neuropático periférico: compresión rama infrapatelar del nervio safeno. Dolor quemante, hormigueo, cara medial de rodilla.
- El tipo de dolor cambia el tratamiento: el abordaje nociplástico requiere educación en neurociencia del dolor (PNE), progresión gradual y trabajo psicosocial además del ejercicio.
- Caso integrado: Don Alberto, 68 años, KL grado 3. Dolor "quemante, en toda la pierna, peor con el estrés, hasta el roce de la ropa duele". Contrasta con dolor nociceptivo puro.
`,
        preguntasEtapa2: [
            "Diferencia los mecanismos y la presentación clínica entre sensibilización periférica y central en la rodilla.",
            "¿Qué características clínicas te harían sospechar de dolor predominantemente nociplástico en una gonartrosis?",
            "¿Por qué la presencia de dolor nociplástico o sensibilización central es un predictor de malos resultados en una artroplastia total de rodilla?"
        ],
        casoEtapa3: `"Doña Silvia, 61 años, KL grado 2. Dolor constante incluso en reposo y de noche, refiere que 'todo le duele', tiene mal sueño y alta ansiedad. El ejercicio le aumenta el dolor y la molestia persiste por más de 24 horas." Identifica el tipo de dolor predominante, explica los mecanismos neurológicos subyacentes y describe cómo adaptarías tu sesión kinesiológica.`,
        preguntasEtapa4: [
            "¿Qué es la alodinia y qué nos revela sobre el estado de procesamiento del sistema nervioso central?",
            "¿Qué mediadores inflamatorios específicos sensibilizan los nociceptores periféricos en la rodilla con artrosis?",
            "¿Qué herramientas clínicas estandarizadas nos permiten detectar sensibilización central en la práctica diaria?"
        ]
    },
    {
        id: "k1.4",
        nombre: "1.4 — Evaluación clínica de la gonartrosis",
        categoria: "Gonartrosis",
        contenidoBase: `
- Anamnesis: localización del dolor (medial más frecuente), comportamiento mecánico vs. inflamatorio (rigidez matinal ≤30 min en gonartrosis; >1 hora sugiere AR u otra sistémica), actividades que agravan, historia de carga y lesiones, tratamientos previos, banderas psicosociales (sueño, miedo al movimiento, estado anímico).
- Inspección: alineación en carga (varo = gonartrosis medial; valgo = lateral), atrofia de cuádriceps (perimetría), marcha antálgica o Trendelenburg.
- Palpación diferencial clave: interlínea medial/lateral (articular o meniscal) vs. 3 cm distal a interlínea medial (bursa anserina, frecuentemente confundida). Peloteo rotuliano = derrame activo = contraindica carga alta ese día. Calor local = sinovitis activa.
- Rango articular: extensión completa más crítica que flexión máxima (sin extensión: marcha ineficiente). End-feel duro = osteofitos (no mejora con movilización). End-feel firme capsular = puede mejorar. Flexión mínima AVD: 90-110°.
- Evaluación funcional: TUG >12 seg = limitación significativa; >20 seg = alto riesgo caídas. 30-sec Chair Stand = fuerza funcional EEII. KOOS/WOMAC: outcome measures validados. Tampa Scale for Kinesiophobia (TSK >37/68 = significativo).
- Hipótesis diferenciales si cambian los hallazgos: rigidez >1h → AR; dolor 3 cm distal → bursa anserina; dolor nocturno intenso de inicio súbito → osteonecrosis; fiebre + calor extremo → artritis séptica (urgencia).
- Caso integrado: Doña Inés, 67 años. Varo bilateral, dolor en interlínea medial Y 3 cm distal, rigidez 20 min, TUG 15 seg.
`,
        preguntasEtapa2: [
            "¿Cómo diferencias en la anamnesis una rigidez de origen mecánico de una de origen inflamatorio/sistémico?",
            "Explica la palpación diferencial entre la interlínea articular medial y la inserción de la pata de ganso, y qué conducta tomas ante un signo de peloteo rotuliano positivo.",
            "¿Por qué recuperar o mantener la extensión completa de rodilla tiene mayor impacto funcional que ganar los últimos grados de flexión profunda?"
        ],
        casoEtapa3: `"Don Héctor, 71 años. Presenta dolor medial en rodilla izquierda, rigidez matinal de 15 minutos, varo clínico leve, atrofia visible de cuádriceps. A la palpación no hay derrame pero sí dolor en interlínea medial y en bursa anserina. Rango articular: déficit de extensión de 5° y flexión máxima de 100°. Test TUG: 13.5 segundos." Sintetiza los hallazgos y clasifícalos para tu plan de intervención.`,
        preguntasEtapa4: [
            "¿Qué es la prueba del peloteo rotuliano y qué líquido mínimo estima su positividad?",
            "¿Cómo distingues un end-feel duro de uno firme capsular y qué te dice esto respecto a la viabilidad de ganar rango pasivo?",
            "¿Cuál es el tiempo de corte del test Timed Up and Go (TUG) que indica alto riesgo de caídas en el adulto mayor?"
        ]
    },
    {
        id: "k1.5",
        nombre: "1.5 — Ejercicio como tratamiento de primera línea",
        categoria: "Gonartrosis",
        contenidoBase: `
- Primera línea según OARSI 2019, NICE 2022, ACR 2021, EULAR 2023. Efecto comparable o superior a AINEs a mediano-largo plazo.
- Mecanismos:
  (1) Funcional: la exposición gradual al movimiento y a la carga mejora la capacidad para las tareas relevantes; no se prescribe ejercicio con la promesa de "reparar" o "alimentar" el cartílago.
  (2) Neuromuscular: cuádriceps más fuerte reduce carga en estructuras pasivas.
  (3) Antiinflamatorio: ejercicio aeróbico reduce mediadores sistémicos inflamatorios (IL-6 en bajas dosis tiene efecto antiinflamatorio).
  (4) Analgésico central: hipoalgesia inducida por ejercicio (HIE), activa sistema opioide endógeno y modulación descendente del dolor.
  (5) Psicosocial: mejora autoeficacia, reduce catastrofismo y kinesiofobia.
- Tipos con evidencia: fortalecimiento (más sólida), aeróbico, acuático (menor carga, útil en irritabilidad alta u obesidad), control neuromuscular.
- Adherencia importa más que el tipo específico.
- Dosificación del dolor: ≤4/10 durante ejercicio, que se resuelva en 24h. Si persiste >24h o aumenta en siguiente sesión → carga excesiva, reducir.
- Caso integrado: Don Manuel, 66 años, evita moverse "por miedo al desgaste". Inicia bicicleta 15 min, progresa a 25 min. Dolor mejora.
`,
        preguntasEtapa2: [
            "Explica al menos tres mecanismos biológicos o neurofisiológicos diferentes por los cuales el ejercicio disminuye el dolor en la artrosis.",
            "¿Cómo aplicas la regla de dolor de las 24 horas para guiar la progresión de cargas entre sesiones?",
            "Si un paciente tiene alta kinesiofobia y dolor moderado, ¿cómo estructurarías sus primeros ejercicios para asegurar adherencia y éxito inicial?"
        ],
        casoEtapa3: `"Doña Patricia, 63 años, KL grado 2, IMC 32, dolor habitual de 5/10, completamente sedentaria y con miedo severo a moverse. Solo ha probado masajes y compresas calientes con alivio pasajero." Diseña el plan de ejercicio terapéutico del primer mes: qué actividad inicias, cómo dosificas la primera semana y cómo abordas su miedo al ejercicio.`,
        preguntasEtapa4: [
            "¿Qué nos dice la evidencia científica actual sobre la supuesta superioridad del ejercicio de fuerza versus el ejercicio aeróbico en gonartrosis?",
            "¿Qué es la hipoalgesia inducida por ejercicio (HIE) y cómo beneficia a pacientes con sensibilización central?",
            "¿Cómo influye la carga cíclica del ejercicio (como la caminata o bicicleta) sobre los condrocitos y la inflamación de bajo grado?"
        ]
    },
    {
        id: "k1.6",
        nombre: "1.6 — Fortalecimiento de cuádriceps: progresión y dosificación",
        categoria: "Gonartrosis",
        contenidoBase: `
- Cuádriceps débil = factor de riesgo de progresión Y de caídas. Déficit de hasta 20-40% vs. sujetos sin gonartrosis de la misma edad.
- Progresión basada en irritabilidad y fase: Isométrico (quad sets, ELP) → isotónico concéntrico baja carga → excéntrico progresivo → heavy slow resistance (HSR, evidencia emergente en gonartrosis).
- Cadena cerrada (CC: sentadilla parcial, prensa) vs. cadena abierta (CA: extensión de rodilla): CC genera mayor activación de cuádriceps con menor cizalla tibiofemoral en rangos intermedios.
- Dosificación: 8-15 rep, 2-4 series, 2-3 veces/semana. Progresar cuando dolor ≤4/10 y se resuelve en 24h. El criterio de progresión es la respuesta clínica, no el tiempo.
- Inhibición artrogénica (IAM): el derrame activo inhibe la activación voluntaria del cuádriceps aunque esté anatómicamente íntegro. Mecanismo reflejo espinal.
- Caso integrado: paciente con irritabilidad alta post-brote que no puede activar el cuádriceps en la primera sesión. ¿Por qué y cómo se aborda?
`,
        preguntasEtapa2: [
            "Explica cómo progresas el tipo de contracción (isométrica, concéntrica, excéntrica) basándote en la irritabilidad clínica de la rodilla.",
            "Compara las demandas biomecánicas (fuerza de cizallamiento y compresión patelofemoral) entre cadena abierta y cadena cerrada en la rodilla.",
            "¿Qué es la inhibición muscular artrogénica (IAM) y qué estrategias clínicas utilizas para sortearla en las primeras etapas?"
        ],
        casoEtapa3: `"Don Luis, 69 años, gonartrosis KL grado 3, irritabilidad moderada, dolor 5/10 en actividad. Primera sesión de fortalecimiento. No logra realizar una elevación de pierna recta (ELP) activa sin compensar flexionando la cadera con el tronco hacia atrás." ¿Cómo evalúas esta compensación y por qué ejercicio decides partir hoy?`,
        preguntasEtapa4: [
            "¿Qué es el entrenamiento Heavy Slow Resistance (HSR) y qué adaptaciones tisulares busca lograr en rodillas con osteoartritis?",
            "¿En qué ángulos de flexión de rodilla la cadena cerrada (sentadilla) ejerce menor fuerza de cizallamiento anterior en la articulación tibiofemoral?",
            "Explica el mecanismo reflejo de la IAM y cómo el frío o la electroestimulación pueden ayudar a su resolución inmediata."
        ]
    },
    {
        id: "k1.7",
        nombre: "1.7 — Educación al paciente y manejo del nocebo",
        categoria: "Gonartrosis",
        contenidoBase: `
- Nocebo: efecto negativo de comunicación amenazante. Mecanismo: activa el eje amígdala-HPA, aumenta amenaza percibida, inhibe vías descendentes inhibitorias del dolor, puede crear o amplificar síntomas reales. Frases frecuentes: "tiene la rodilla destruida", "el cartílago no se recupera", "con esa artrosis no puede ejercitarse".
- PNE (Pain Neuroscience Education): enseña al paciente cómo funciona el dolor. Evidencia: reduce catastrofismo, mejora autoeficacia y adherencia al ejercicio. Reconceptualización: artrosis es manejable, movimiento es medicina, dolor no siempre = daño.
- Autoeficacia: predictor fuerte del resultado funcional. Se construye con metas alcanzables, feedback positivo y experiencias de éxito graduales. Mecanismo: activa vías inhibitorias endógenas del dolor.
- Comunicación anti-nocebo: frases que reducen amenaza: "podemos dosificar el movimiento para recuperar capacidad", "su sistema puede adaptarse de forma gradual".
- Caso integrado: paciente que dice "el médico me dijo que tengo la rodilla para la basura y que no puedo moverme". Primera sesión.
`,
        preguntasEtapa2: [
            "Explica el mecanismo neurobiológico por el cual el efecto nocebo de un diagnóstico de 'hueso contra hueso' puede amplificar físicamente la intensidad del dolor del paciente.",
            "¿Cómo realizarías la reconceptualización clínica de la artrosis de rodilla para un paciente que cree que 'el cartílago se desgasta más al caminar'?",
            "¿Qué estrategias de comunicación clínica utilizas para fomentar la autoeficacia en pacientes que presentan altos niveles de catastrofismo y miedo al movimiento?"
        ],
        casoEtapa3: `"Doña Ana, 66 años, llega a tu consulta convencida de que 'tiene la rodilla destruida' por lo que leyó en su informe radiológico. Sus terapeutas anteriores solo le aplicaban ultrasonido y masajes por temor a dañarla más. Su dolor es 6/10 y tiene kinesiofobia severa." Estructura tu diálogo educativo en esta primera sesión y explica cómo iniciarías la movilización.`,
        preguntasEtapa4: [
            "¿Qué cambios neurobiológicos o fisiológicos se observan en el sistema nervioso cuando disminuye la amenaza percibida mediante la educación en dolor?",
            "Nombra tres ejemplos comunes de lenguaje nocebo en kinesiología y sus alternativas terapéuticas de lenguaje positivo.",
            "¿Por qué la autoeficacia autopercibida predice de mejor manera el alta funcional a largo plazo que la nota de dolor basal?"
        ]
    },
    {
        id: "k1.8",
        nombre: "1.8 — Criterios de derivación y alta clínica",
        categoria: "Gonartrosis",
        contenidoBase: `
- Tratamiento conservador: al menos 3-6 meses antes de evaluar candidatura quirúrgica. El resultado funcional post-PTR es mejor cuando el paciente llega con buena fuerza de cuádriceps y sin banderas psicosociales no manejadas.
- Criterios para derivación a cirugía: dolor severo sin respuesta a ejercicio + farmacología adecuada, limitación funcional severa que impacta calidad de vida, KL 3-4 con síntomas proporcionales, fracaso documentado del conservador.
- Identificación de banderas rojas: artritis séptica, TVP, osteonecrosis subcondral, fracturas de estrés.
- Alta kinesiológica: basada en objetivos funcionales alcanzados (TUG, fuerza, rango, AVD), plan domiciliario entregado. No solo ausencia de dolor.
`,
        preguntasEtapa2: [
            "¿Cuáles son los criterios clínicos objetivos que te indican que el tratamiento conservador ha fracasado y que el paciente es candidato a interconsulta quirúrgica?",
            "Explica cómo identificas en el box una sospecha de Trombosis Venosa Profunda (TVP) o una Artritis Séptica, y cuál es tu protocolo inmediato de acción.",
            "¿Por qué el alta kinesiológica de un paciente con artrosis de rodilla no debe basarse en reportar dolor 0/10?"
        ],
        casoEtapa3: `"Don Carlos, 68 años, KL grado 3, lleva 5 meses de tratamiento kinesiológico con adherencia parcial. Su dolor se mantiene en 6/10, no puede caminar más de 3 cuadras y no logra subir escaleras de forma alternada. Muestra alta kinesiofobia. Te exige que lo derives al traumatólogo para operarse." Justifica si lo derivarías hoy y explica qué variables incorporarías en tu informe.`,
        preguntasEtapa4: [
            "¿Por qué se exige un mínimo de 3 a 6 meses de kinesiología activa antes de calificar a un paciente para cirugía de reemplazo articular?",
            "¿Qué signos clínicos diferencian el dolor por osteonecrosis subcondral espontánea del dolor por gonartrosis mecánica común?",
            "¿Qué criterios objetivos (pruebas físicas) e instrumentados utilizarías para emitir un alta clínica segura para el reintegro al hogar?"
        ]
    },
    {
        id: "k2.1",
        nombre: "2.1 — Indicaciones y tipos de artroplastia",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Indicaciones de PTR: KL 3-4 con fracaso del tratamiento conservador (≥3-6 meses), dolor severo que impacta calidad de vida, limitación funcional severa.
- PTR (total) vs. PTU (unicompartimental): PTU indicada cuando el compromiso es de un solo compartimento (medial), con LCA conservado y sin compromiso patelofemoral significativo. PTU preserva más hueso y tiene recuperación más rápida.
- Implante PTR: componente femoral (metal), tibial (metal + polietileno), patelar (opcional). La alineación es crítica: mala alineación → desgaste acelerado del polietileno → dolor residual → revisión quirúrgica.
- Factores que predicen mejor resultado funcional: buena fuerza de cuádriceps preoperatoria, IMC <40, expectativas realistas, ausencia de banderas psicosociales.
`,
        preguntasEtapa2: [
            "Compara las indicaciones quirúrgicas y el pronóstico de rehabilitación entre una prótesis unicompartimental (PTU) y una prótesis total de rodilla (PTR).",
            "¿Cómo influyen los factores demográficos y comorbilidades (ej: obesidad severa, diabetes) en las tasas de fallo e infección del implante?",
            "¿Por qué la alineación rotacional del componente tibial influye directamente en el desarrollo de dolor anterior de rodilla post-operatorio?"
        ],
        casoEtapa3: `"Doña Marta, 70 años, con gonartrosis KL grado 4 bilateral severa. Tiene programada una PTR derecha en 8 semanas. Presenta fuerza de cuádriceps de 3+/5 bilateral, un IMC de 36 y un alto nivel de ansiedad y miedo." Diseña los objetivos clave de tu preparación preoperatoria y justifica qué le explicarás del postoperatorio.`,
        preguntasEtapa4: [
            "¿Qué estructuras ligamentosas se conservan en una artroplastia unicompartimental (PTU) que usualmente se resecan en una PTR?",
            "¿Cuál es el principal material del componente de fricción de la prótesis de rodilla y qué consecuencias biomecánicas tiene su desgaste a largo plazo?",
            "¿Qué rol clínico juegan las expectativas del paciente en la percepción subjetiva del éxito de su cirugía al cabo del primer año?"
        ]
    },
    {
        id: "k2.2",
        nombre: "2.2 — Tejidos intervenidos e inhibición artrogénica post-PTR",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Tejidos intervenidos: cápsula articular anterior (capsulotomía medial), retináculo medial, sinovial, resección ósea distal del fémur y proximal de la tibia.
- IAM post-PTR: cuádriceps puede perder hasta 60-70% de su activación voluntaria en las primeras 48-72h aunque esté anatómicamente íntegro. Mecanismo: reflejo inhibitorio articular (aferencias del dolor/derrame que inhiben la motoneurona alfa).
- Tejido cicatricial: sin movilización pasiva o activa precoz, la cicatrización capsular puede limitar el rango permanentemente (previene la arthrofibrosis).
- Protocolo ERAS: movilización a las 4-24h post-cirugía para favorecer la cicatrización y evitar adherencias.
`,
        preguntasEtapa2: [
            "Explica de forma detallada el mecanismo reflejo espinal de la Inhibición Artrogénica del Cuádriceps (IAM) inmediatamente después de una PTR.",
            "¿Qué estructuras tisulares blandas son seccionadas durante el abordaje para-patelar medial en una PTR y cómo afecta esto a la kinesiología inicial?",
            "¿Cómo se fundamenta el movimiento precoz dentro de las primeras 24 horas (Protocolo ERAS) desde la perspectiva de la fisiología del tejido cicatricial?"
        ],
        casoEtapa3: `"Paciente en su segundo día post-operatorio de PTR. Presenta de forma evidente una incapacidad completa para contraer voluntariamente el cuádriceps para levantar el talón de la camilla. Tiene edema moderado pero sin dolor extremo." ¿Cómo abordas terapéuticamente esta inhibición refleja en esta sesión?`,
        preguntasEtapa4: [
            "¿Qué es la artrofibrosis post-quirúrgica y cómo altera la remodelación del colágeno capsular en ausencia de movilidad?",
            "¿Qué es el protocolo ERAS (Enhanced Recovery After Surgery) y cuál es su tasa de éxito reportada en estadías hospitalarias?",
            "¿Cómo influye la distensión por presión intraarticular (debido al derrame de sangre/líquido) en el umbral de disparo de la motoneurona alfa?"
        ]
    },
    {
        id: "k2.3",
        nombre: "2.3 — Complicaciones post-PTR relevantes para kinesiología",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- TVP: principal complicación vascular. Signos: edema asimétrico de pantorrilla, calor local, dolor a compresión de gemelos. Sospecha = suspender sesión, derivar de inmediato. Deambulación precoz previene.
- Rigidez articular / arthrofibrosis: falta de rango progresivo en primeras 6-12 semanas. Extensión completa = prioridad. Si persiste en semana 6-8, puede requerir manipulación bajo anestesia.
- Infección periprotésica: dolor severo, calor local intenso, rubor, fiebre, secreción de la herida. Derivación inmediata.
- Dolor residual post-PTR: hasta 20% de los pacientes. Predictores: catastrofismo preoperatorio, sensibilización central previa, expectativas no realistas.
`,
        preguntasEtapa2: [
            "Describe la constelación de signos y síntomas que te harían suspender inmediatamente una sesión por sospecha de Trombosis Venosa Profunda.",
            "¿A partir de qué semana y con qué rango de déficit de extensión consideras que un paciente post-PTR presenta una rigidez patológica que podría requerir manipulación bajo anestesia (MUA)?",
            "Explica cuáles son los predictores psicosociales o neurofisiológicos preoperatorios que aumentan el riesgo de dolor crónico persistente post-PTR."
        ],
        casoEtapa3: `"Semana 3 post-PTR. El paciente presenta un déficit de extensión de 15° y flexión pasiva de 80°. Observas que la cicatriz supura un líquido sero-sanguinolento leve y el paciente reporta tener escalofríos y una temperatura axilar de 37.8°C." Describe paso a paso tu toma de decisiones y comunicación con el equipo de salud.`,
        preguntasEtapa4: [
            "¿Qué porcentaje de pacientes operados de PTR reporta dolor crónico residual persistente sin causa mecánica aparente a los 12 meses?",
            "¿Por qué se prefiere realizar la manipulación bajo anestesia (MUA) en la ventana entre la semana 6 y 12 postoperatoria y no más tarde?",
            "¿Cómo se realiza el diagnóstico diferencial clínico en el box entre un eritema/calor reactivo fisiológico postoperatorio común y una infección periprotésica activa?"
        ]
    },
    {
        id: "k2.4",
        nombre: "2.4 — Evaluación post-PTR por fases (General)",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Fase aguda (0-2 semanas): dolor, edema y temperatura local, cicatrización, rango activo/pasivo temprano (extensión completa prioritaria), activación del cuádriceps, deambulación asistida.
- Fase subaguda (2-6 semanas): progresión de flexión (meta: 90° a las 2 semanas, 110°-120° al mes), fuerza de cuádriceps/isquiotibiales, control dinámico de cadera y rodilla en CC.
- Fase funcional (6-12+ semanas): asimetría de fuerza (LSI goal ≥80%), equilibrio, propiocepción y reentrenamiento de AVD.
- Outcome measures: Oxford Knee Score (OKS, específico), Forgotten Joint Score (FJS-12), KOOS, TUG, 30-sec Chair Stand.
`,
        preguntasEtapa2: [
            "Describe las diferencias en los objetivos de evaluación física entre la fase aguda (semana 1-2) y la fase funcional (semana 8-12) en una PTR.",
            "¿Cómo interpretas funcionalmente un déficit de flexión articular a las 6 semanas respecto a las demandas de actividades básicas como sentarse o bajar escaleras?",
            "Compara la utilidad clínica del KOOS versus el Forgotten Joint Score (FJS-12) en el seguimiento a mediano plazo."
        ],
        casoEtapa3: `"Semana 6 post-PTR. El paciente puede subir escaleras de forma alternada apoyándose en la baranda, pero baja descendiendo un escalón a la vez, apoyando siempre el miembro sano primero. Manifiesta temor de que 'la rodilla falle'." Evalúa los componentes neuromuscular y de confianza funcional de esta limitación y explícaselo.`,
        preguntasEtapa4: [
            "¿Qué rango mínimo de flexión pasiva de rodilla requiere un paciente para sentarse en una silla estándar sin inclinar el tronco hacia adelante?",
            "¿Qué mide el Forgotten Joint Score (FJS-12) y por qué se considera el gold standard para evaluar el éxito de la integración de la prótesis?",
            "¿Qué es el Limb Symmetry Index (LSI) y por qué la simetría de fuerza es más determinante para el alta que el valor absoluto de fuerza?"
        ]
    },
    {
        id: "k2.5",
        nombre: "2.5 — Rehabilitación fase aguda post-PTR (0-2 semanas)",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Objetivos prioritarios: control del dolor/edema, extensión completa (prioridad 1), activación del cuádriceps, verticalización temprana.
- Intervenciones: crioterapia (mecanismo analgésico y vasoconstrictor), elevación, quad sets (isométrico rodilla extendida), ELP asistido, movilización pasiva, reeducación de marcha con andador.
- Extensión terminal: evita flexo permanente. Técnicas: posicionamiento (no cojín bajo fosa poplítea), presión manual leve.
- Criterio de progresión: extensión completa o déficit <5°, activación activa del cuádriceps, marcha segura con asistencia.
`,
        preguntasEtapa2: [
            "¿Por qué es un error colocar una almohada debajo de la rodilla de un paciente recién operado de PTR mientras descansa?",
            "Describe el mecanismo fisiológico por el cual la crioterapia local modula el dolor postoperatorio y qué precauciones debes tomar sobre la piel cicatrizal.",
            "¿Cuáles son los criterios clínicos objetivos que te indican que el paciente ha completado con éxito la fase aguda de rehabilitación?"
        ],
        casoEtapa3: `"Día 4 post-PTR. El paciente presenta un déficit de extensión de 8° pasivos y camina con andador sin lograr el apoyo de talón en extensión terminal. Reporta dolor de 5/10 durante la marcha y presenta edema moderado." Planifica paso a paso tu intervención para abordar el déficit de extensión hoy.`,
        preguntasEtapa4: [
            "Ante un déficit persistente de extensión, ¿qué datos te permiten diferenciar limitación pasiva articular, derrame/inhibición, dolor, adherencia postoperatoria u otra causa antes de elegir una intervención?",
            "Explica el mecanismo analgésico de la crioterapia a través del bloqueo de conducción nerviosa periférica y su efecto en los nociceptores.",
            "¿En qué consiste el principio de verticalización precoz y cuál es su efecto sobre las tasas de complicaciones sistémicas postoperatorias?"
        ]
    },
    {
        id: "k2.6",
        nombre: "2.6 — Rehabilitación fase subaguda post-PTR (semanas 2-6)",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Objetivos: fortalecer cuádriceps/isquiotibiales, flexión funcional (90°-110°), transición a marcha sin asistencia, control excéntrico.
- Ejercicios: isotónicos de cuádriceps, mini-sentadilla (0-45°), prensa de pierna, bicicleta estática (cuando flexión ≥90°), step-ups.
- Dosificación: 8-12 rep, 3 series, 2-3 veces/semana. Progresión cuando dolor ≤4/10 se resuelve en 24h.
- Criterio de progresión: marcha sin asistencia y sin cojera, flexión ≥100°, fuerza de cuádriceps estimada ≥60% del contralateral.
`,
        preguntasEtapa2: [
            "¿Por qué la bicicleta estática requiere un rango de flexión mínimo de 90° para ser introducida de forma segura en la rehabilitación?",
            "Explica la progresión de cargas y la diferencia biomecánica entre una mini-sentadilla a 45° en la fase de apoyo y una prensa de piernas en plano inclinado.",
            "¿Cómo entrenarías el descenso excéntrico de escaleras en esta fase y qué comandos verbales utilizarías?"
        ],
        casoEtapa3: `"Semana 5 post-PTR. El paciente presenta 95° de flexión y extensión completa. Camina de forma independiente sin bastón dentro del box. Su fuerza de cuádriceps es de M3+. Declara que quiere ir caminando solo al almacén de su barrio a unas 3 cuadras." ¿Qué le respondes, bajo qué condiciones y cómo lo fundamentas?`,
        preguntasEtapa4: [
            "¿Cuál es el patrón de reclutamiento excéntrico de los flexores e extensores de rodilla al descender una pendiente inclinada?",
            "¿Cómo eliges entre ejercicios en cadena abierta y cerrada según la tarea, el rango tolerado, la irritabilidad y el objetivo de fuerza, sin tratarlos como ejercicios 'buenos' o 'malos' por definición?",
            "Explica las características histológicas de la cicatriz articular en fase de remodelación temprana a la quinta semana postoperatoria."
        ]
    },
    {
        id: "k2.7",
        nombre: "2.7 — Rehabilitación fase funcional post-PTR (semanas 6-12)",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Objetivos: recuperar fuerza, equilibrio y desempeño en tareas significativas, comparando con la línea basal y el lado contralateral cuando corresponda, no usando un único porcentaje como alta automática.
- Bajo impacto: caminata, bicicleta, natación. Alto impacto: NO recomendadas por riesgo de desgaste acelerado del polietileno.
- El entrenamiento neuromuscular se orienta a confianza, control de tarea, fuerza y exposición progresiva. No se debe asumir una pérdida permanente de "propiocepción" solo por la cirugía.
- Criterios de alta: independencia funcional, simetría de fuerza adecuada, rango funcional completo sin dolor severo, plan domiciliario asimilado.
`,
        preguntasEtapa2: [
            "Explica por qué los deportes de impacto (como correr o tenis singles) están contraindicados permanentemente tras una PTR y cómo educarías al respecto.",
            "¿Cómo eliges y progresas tareas de equilibrio, fuerza y función tras una PTR usando desempeño, síntomas y objetivos de la persona, sin atribuir la limitación a una 'pérdida de propiocepción' no demostrada?",
            "¿Cuáles son las metas exactas que debe cumplir el paciente en fuerza, rango y testeo funcional para recibir un alta kinesiológica definitiva?"
        ],
        casoEtapa3: `"Semana 11 post-PTR. El paciente es independiente en sus actividades. Registra un TUG de 10.5 segundos y un 30-sec Chair Stand de 12 repeticiones. Al preguntarle cómo se siente, te dice: 'La rodilla no me duele, pero la siento extraña, como si fuera de madera y no me perteneciera'. Pide el alta." ¿Es momento de dar el alta funcional? Justifica tu respuesta.`,
        preguntasEtapa4: [
            "¿Qué tipos de mecanorreceptores (Ruffini, Pacini) se ven directamente afectados tras el reemplazo total de la rodilla?",
            "¿Qué es la vida útil promedio de una prótesis total de rodilla contemporánea y cómo se acorta debido a sobrecargas de impacto?",
            "Nombra tres deportes recreativos considerados seguros y de bajo impacto recomendados para un paciente con PTR."
        ]
    },
    {
        id: "k2.8",
        nombre: "2.8 — Rehabilitación preoperatoria (prehab)",
        categoria: "Artroplastia (PTR)",
        contenidoBase: `
- Evidencia: prehab mejora el resultado funcional a corto plazo, reduce días de hospitalización y amortigua la IAM postoperatoria inmediata.
- Componentes: fortalecimiento muscular de cuádriceps/isquiotibiales, acondicionamiento de bajo impacto, educación quirúrgica y manejo de expectativas.
- Fisiología: una mejor reserva de fuerza previa amortigua la pérdida de masa y el reflejo de inhibición (IAM) posterior a la cirugía.
- Ventana ideal: 4-8 semanas preoperatorias.
`,
        preguntasEtapa2: [
            "¿Cuál es el sustento fisiológico y neuromuscular para entrenar la fuerza de cuádriceps antes de que se realice la agresión quirúrgica de la rodilla?",
            "¿Cómo abordas a un paciente en el período preoperatorio que manifiesta un catastrofismo elevado y el convencimiento de que 'la cirugía le impedirá volver a caminar'?",
            "¿Qué nos dice la evidencia científica actual respecto a la efectividad real del prehab sobre la función de la rodilla al cabo de 1 año postoperatorio?"
        ],
        casoEtapa3: `"Don Jorge, 72 años, se someterá a una cirugía de PTR en 7 semanas. Su cuádriceps tiene una fuerza de 3/5, su IMC es de 33 y presenta un catastrofismo moderado. Cree firmemente que al día siguiente de la operación estará totalmente normal y podrá jugar fútbol." Diseña tus intervenciones de prehab prioritarias y planifica su educación.`,
        preguntasEtapa4: [
            "¿Cómo se relaciona la masa muscular previa con el fenómeno de atrofia por desuso acelerada posterior al trauma quirúrgico?",
            "Explica cómo se maneja el dolor anticipatorio y cómo interfiere en la percepción nociceptiva durante los primeros días post-PTR.",
            "¿Qué dice la evidencia sobre qué componente del prehab (el físico o el psicoeducativo) influye más en la reducción de costos hospitalarios?"
        ]
    },
    {
        id: "k2.9",
        nombre: "2.9 — Inspección y cicatriz a los 3 meses (Evaluación Postural)",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- La evaluación postural estática a los 3 meses de la PTR debe seguir un checklist rígido: (1) Inspección del alineamiento en carga en bipedestación (¿distribuye el peso de forma simétrica o hace descarga inconsciente?), (2) Presencia de edema residual, (3) Estado cicatrizal y evaluación de la movilidad patelar.
- Movilidad patelar: Es obligatoria evaluar a los 3 meses. Debe evaluarse el deslizamiento pasivo de la patela en 4 direcciones (superior, inferior, medial y lateral). Si la patela está adherida, bloquea mecánicamente tanto el final de la extensión como el inicio de la flexión.
- Edema residual: Se evalúa mediante palpación y la prueba de fluctuación (signo del témpano o de la ola). A los 3 meses, un edema moderado indica sinovitis por sobrecarga mecánica o falta de tolerancia a la carga.
- Cicatriz: Buscar adherencias fasciales que restrinjan el plano subdérmico. La restricción cicatrizal limita el rango de flexión activa.
`,
        preguntasEtapa2: [
            "¿Cómo evalúas clínicamente la movilidad patelar en sus 4 direcciones y por qué influye directamente en el rango de rodilla?",
            "¿Cómo realizas el diagnóstico diferencial clínico para saber si un edema residual de rodilla a los 3 meses es por sobrecarga de ejercicio o por un proceso inflamatorio/infeccioso?",
            "Si observas que la cicatriz suprapapilar presenta adherencia al plano profundo, ¿qué técnica de terapia manual aplicarías y cómo justificarías su uso?"
        ],
        casoEtapa3: `"Evaluas a una paciente de 12 semanas post-PTR. Al mirarla de pie, notas que apoya el peso predominantemente en la pierna sana y mantiene la rodilla operada en leve flexión (descarga postural). La cicatriz se ve consolidada pero retráctil." Dime paso a paso tu checklist de inspección física en camilla para esta paciente.`,
        preguntasEtapa4: [
            "¿Por qué el deslizamiento superior de la patela es mecánicamente indispensable para lograr la extensión terminal activa de la rodilla?",
            "¿Qué es la fluctuación del líquido articular y cómo altera mecánicamente la propiocepción del cuádriceps mediante receptores capsulares?",
            "¿Cómo afecta una cicatriz adherida en la cara anterior de la rodilla al deslizamiento tisular durante la flexión máxima activa?"
        ]
    },
    {
        id: "k2.10",
        nombre: "2.10 — Rango de Movimiento (Goniometría) y Lag de Extensión",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- A los 3 meses se espera una extensión de 0° y flexión funcional mínima de 110°-120°.
- Goniometría correcta: Paciente en decúbito supino. Fulcro en epicóndilo lateral, brazo fijo apunta a trocánter mayor, brazo móvil apunta a maleolo lateral.
- Diagnóstico Diferencial del Déficit de Extensión (Clave para evitar bloqueos):
  (1) Lag de Extensión (Extensión Activa Deficiente): Ocurre cuando la extensión pasiva es completa (0° con ayuda del terapeuta), pero el paciente no es capaz de lograr o mantener activamente la extensión completa (ej: se queda en -10° activos). Indica inhibición/debilidad extrema del cuádriceps.
  (2) Restricción pasiva de extensión: ocurre cuando extensión pasiva y activa están limitadas de forma similar (ej: -15° pasivos y -15° activos). Obliga a diferenciar derrame, dolor/guardia, restricción articular, adherencias postoperatorias o artrofibrosis; no se etiqueta automáticamente como "acortamiento".
`,
        preguntasEtapa2: [
            "Explica el paso a paso exacto para realizar el diagnóstico diferencial entre un lag de extensión de cuádriceps y una limitación articular pasiva de la rodilla.",
            "¿Qué reparos anatómicos utilizas para alinear correctamente el goniómetro al medir la rodilla?",
            "Si un paciente de 3 meses presenta un lag de extensión de 15°, ¿por qué es incorrecto priorizar estiramientos de isquiotibiales y qué deberías hacer en su lugar?"
        ],
        casoEtapa3: `"Paciente de 12 semanas post-PTR. Al evaluarlo de forma pasiva en camilla, logras alinear la articulación a 0° de extensión sin dolor. Sin embargo, al pedirle que realice un 'quad set' voluntario y levante la pierna recta, la rodilla cae inmediatamente a -10° de flexión." Diagnostica esta limitación y describe un test para confirmar la causa.`,
        preguntasEtapa4: [
            "¿Qué es el lag de extensión (active extension lag) y cuál es su causa fisiológica específica en kinesiología?",
            "Diferencia clínicamente un end-feel firme capsular de uno óseo duro al evaluar la extensión de rodilla.",
            "¿Por qué es funcionalmente más prioritario recuperar el 0° de extensión que progresar la flexión de 100° a 120° en un paciente post-PTR?"
        ]
    },
    {
        id: "k2.11",
        nombre: "2.11 — Observación Dinámica de la Marcha y Compensaciones",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- A los 3 meses, el paciente debe caminar de forma independiente sin ayudas técnicas, con un patrón simétrico.
- Compensaciones patológicas que la alumna debe identificar de inmediato:
  (1) Marcha con rodilla rígida (Stiff-Knee Gait): El paciente no realiza flexión de rodilla durante la fase de oscilación ni extensión terminal en el contacto inicial. Camina "en bloque" para evitar la carga en extensión. Indica debilidad de cuádriceps o miedo a la inestabilidad.
  (2) Lag de extensión en fase de apoyo (Marcha en flexo): La rodilla permanece en leve flexión durante todo el apoyo medio, sobrecargando el cuádriceps y limitando la fase de despegue de dedos.
  (3) Inclinación lateral del tronco (Trendelenburg): El tronco se inclina hacia el lado operado durante el apoyo unilateral. Indica debilidad del Glúteo Medio ipsilateral.
`,
        preguntasEtapa2: [
            "¿Qué debilidades musculares específicas provocan que un paciente mantenga la rodilla flexionada durante la fase de contacto inicial de la marcha?",
            "¿Cómo distingues visualmente una claudicación por dolor de una claudicación por insuficiencia o debilidad del Glúteo Medio (Trendelenburg) durante la marcha?",
            "¿Qué consecuencias biomecánicas a largo plazo tiene para la prótesis de rodilla caminar en flexo permanente?"
        ],
        casoEtapa3: `"Paciente de 12 semanas post-PTR. Al caminar por el pasillo, observas que inclina marcadamente el tronco hacia el lado operado en cada apoyo unilateral y que arrastra levemente la punta del pie durante la fase de oscilación." Identifica las compensaciones y propón qué pruebas en camilla harás para confirmarlas.`,
        preguntasEtapa4: [
            "¿Por qué la debilidad del Glúteo Medio genera un Trendelenburg compensado en la marcha del postoperado de PTR?",
            "¿Qué es la marcha con evitación del cuádriceps (quadriceps avoidance gait) y cómo altera la cinemática de la cadera?",
            "¿Por qué caminar con flexo de rodilla sostenido incrementa el gasto metabólico del paciente?"
        ]
    },
    {
        id: "k2.12",
        nombre: "2.12 — Fuerza y Control Neuromuscular (Evaluación Analítica)",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- Evaluación del Cuádriceps (MMT): Paciente sentado al borde de la camilla. Evaluar fuerza en rango de 90° a 0°. Prestar atención al último rango (15° a 0°), donde se evalúa la fuerza terminal del vasto medial.
- La prueba de Straight Leg Raise (SLR): Un test clave para evaluar la activación neuromuscular. El paciente debe elevar la pierna recta manteniendo la rodilla a 0°. Si al levantarla la rodilla se dobla (rezago de extensión), hay inhibición refleja o debilidad severa del cuádriceps.
- Evaluación de la Cadera (Glúteo Medio y Mayor):
  - Glúteo Medio: Paciente en decúbito lateral. Evaluar abducción de cadera con leve extensión y rotación externa para evitar que actúe el Tensor de la Fascia Lata (TFL).
  - Glúteo Mayor: Decúbito prono. Evaluar extensión de cadera con rodilla flectada a 90° para aislar los isquiotibiales.
- A los 3 meses se busca una fuerza manual mínima de M4 (en escala de Daniels) para iniciar ejercicios dinámicos complejos.
`,
        preguntasEtapa2: [
            "¿Cómo realizas el aislamiento del Glúteo Medio para evaluarlo sin que el Tensor de la Fascia Lata (TFL) compense el movimiento?",
            "Explica paso a paso cómo aplicas el test Straight Leg Raise (SLR) y qué significa que el paciente lo realice con rezago o claudicación de extensión.",
            "¿Por qué el vasto medial es el fascículo del cuádriceps que presenta mayor inhibición neuromuscular refleja posquirúrgica?"
        ],
        casoEtapa3: `"Paciente de 12 semanas post-PTR realiza la prueba SLR. Logra levantar la extremidad unos 15 cm, pero su rodilla se flexiona visiblemente 15° y tiembla ostensiblemente antes de descender." Califica su fuerza según la escala de Daniels y explica qué intervenciones de activación neuromuscular realizarías hoy.`,
        preguntasEtapa4: [
            "¿Cuál es la diferencia fisiológica entre una fuerza grado M3 y grado M4 en la escala de Daniels respecto a la capacidad de tolerar resistencia externa?",
            "¿Cómo contribuye la fuerza del Glúteo Mayor en el control de la hiperextensión de rodilla en el apoyo de la marcha?",
            "¿Qué es la inhibición refleja de la motoneurona alfa y cómo incide en el reclutamiento del cuádriceps a los 3 meses?"
        ]
    },
    {
        id: "k2.13",
        nombre: "2.13 — Pruebas Funcionales y Criterios de Progresión de Carga",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- A los 3 meses, la evaluación analítica debe complementarse con pruebas funcionales basadas en el rendimiento.
- Timed Up and Go (TUG):
  - Procedimiento: Paciente sentado en silla con apoyabrazos. Se levanta, camina 3 metros a paso seguro, gira, regresa y se vuelve a sentar.
  - Interpretación a los 3 meses: Un tiempo < 10 segundos es normal y esperable para esta fase. Tiempos > 12 segundos indican déficit de equilibrio o debilidad funcional, y > 20 segundos representan alto riesgo de caída.
- 30-Second Chair Stand Test (30CST):
  - Procedimiento: Silla sin apoyabrazos apoyada contra la pared. El paciente, con los brazos cruzados sobre el pecho, se levanta y se sienta por completo tantas veces como sea posible en 30 segundos.
  - Interpretación a los 3 meses: Se esperan entre 11 y 14 repeticiones según rango de edad (60-70 años). Evalúa la fuerza funcional excéntrica y concéntrica de los extensores de miembro inferior.
`,
        preguntasEtapa2: [
            "¿Cuáles son las instrucciones verbales exactas y las precauciones de seguridad que debes darle a un paciente antes de realizar el test TUG?",
            "Explica cómo se correlacionan los resultados del 30CST con la capacidad de subir y bajar escaleras de forma independiente y segura.",
            "¿Qué deba cuidar el paciente durante el giro del TUG para no sobrecargar de torque la rodilla recién operada?"
        ],
        casoEtapa3: `"Paciente de 3 meses post-PTR realiza el 30-Second Chair Stand Test. Logra completar 8 repeticiones y en las últimas dos necesita apoyarse sobre sus muslos con las manos. En el TUG registra un tiempo de 13.8 segundos." Analiza clínicamente estos resultados y describe cómo influyen en tu pauta terapéutica.`,
        preguntasEtapa4: [
            "¿Por qué la prueba de sentarse y pararse demanda tanto control excéntrico de los cuádriceps y glúteos?",
            "¿Cómo influye la propiocepción deficiente en la velocidad y el giro del test TUG?",
            "¿Cuál es el valor mínimo de repeticiones en el 30CST que predice independencia en actividades de la vida diaria en adultos mayores?"
        ]
    },
    {
        id: "k2.14",
        nombre: "2.14 — Anamnesis Dirigida y Reevaluación Mínima Viable",
        categoria: "Evaluación y Reevaluación",
        contenidoBase: `
- La entrevista de reevaluación a las 12 semanas (en un examen de 20 minutos) debe durar máximo 3 minutos.
- El objetivo es actualizar el estado clínico dinámico y descartar banderas rojas de seguridad.
- Las 4 preguntas no-negociables:
  (1) Sintomatología y Dolor Actual: EVA/NRS en reposo, marcha y nocturno (descartar dolor nocturno severo que alerte osteonecrosis o aflojamiento).
  (2) Uso y necesidad de ayudas técnicas: Uso de bastón/andador en exteriores vs. interiores.
  (3) Adherencia a la pauta domiciliaria: Frecuencia de los ejercicios en el hogar.
  (4) Presencia de signos de alarma (Cribado de Complicaciones): Fiebre, calor excesivo, dolor súbito en pantorrilla (TVP o infección).
- Si la alumna pregunta por antecedentes irrelevantes (alergias históricas, cirugías infantiles, antecedentes familiares lejanos), el tutor debe detenerla constructivamente: "Ese dato no va a cambiar tu conducta de hoy y estás perdiendo valioso tiempo de camilla. Concéntrate en lo esencial".
`,
        preguntasEtapa2: [
            "¿Cuáles son las 4 variables críticas que debes extraer en una entrevista de reevaluación post-PTR y por qué?",
            "¿Por qué interrogar sobre el dolor de pantorrilla y el dolor nocturno tiene prioridad clínica antes de hacer pruebas de fuerza o de movilidad pasiva en la camilla?",
            "¿Cómo abordarías y reencaminarías a un paciente conversador que empieza a relatar detalles históricos irrelevantes durante tu evaluación de tiempo limitado?"
        ],
        casoEtapa3: `"Inicias tu reevaluación de 20 minutos con Don Pedro, 72 años, 3 meses post-PTR. El paciente es muy conversador y comienza a detallarte lo compleja que fue su hospitalización y cómo le costó llegar hoy." Simula la entrevista inicial. Tienes un máximo de 3 intervenciones para obtener los 4 datos esenciales de reevaluación y cortar la conversación superflua con cortesía profesional.`,
        preguntasEtapa4: [
            "¿Por qué interrogar sobre el dolor de pantorrilla tiene prioridad clínica antes de hacer la prueba de fuerza del cuádriceps?",
            "¿Cómo se justifica pedagógicamente limitar la anamnesis en una sesión de reevaluación funcional comparado con una evaluación de primera vez?",
            "¿Qué información sobre el cuádriceps te entrega saber que el paciente ya no usa bastón en interiores pero sí en la calle?"
        ]
    },
    {
        id: "k3.1",
        nombre: "3.1 — Dolor patelofemoral: hipótesis y descarte",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- El dolor patelofemoral (DPF) es una presentación clínica, no una etiqueta que explique por sí sola la causa. Suele ser dolor retropatelar o peripatelar relacionado con sentarse, escaleras, sentadillas, correr o saltar.
- La entrevista debe precisar inicio, cambio reciente de carga, irritabilidad, derrame, bloqueo, inestabilidad, dolor nocturno, síntomas sistémicos y objetivos de la persona.
- El patrón compatible con DPF gana peso si el dolor se reproduce en tareas con carga de rodilla flexionada y no hay datos que orienten a una lesión aguda intraarticular u otra condición médica.
- Derrame importante tras traumatismo, bloqueo verdadero, incapacidad de extender, fiebre, dolor de pantorrilla, dolor óseo nocturno o deterioro rápido cambian la prioridad: se suspende la hipótesis simple de DPF y se deriva o se amplía la evaluación.
`,
        preguntasEtapa2: [
            "¿Qué datos de entrevista aumentan el peso de la hipótesis de DPF y qué datos la debilitan?",
            "¿Cómo diferencias dolor anterior relacionado con carga de una presentación que exige descartar lesión aguda intraarticular?",
            "Formula una disfunción kinesiológica modificable sin convertir el diagnóstico médico en la explicación completa."
        ],
        casoEtapa3: `"Estudiante de 20 años, dolor anterior de rodilla al bajar escaleras y al correr tras aumentar sus entrenamientos. No refiere traumatismo, derrame ni bloqueo." Construye hipótesis principal, dos diferenciales, datos faltantes y primera decisión de evaluación.`,
        preguntasEtapa4: [
            "¿Qué significa que un hallazgo aumente o disminuya la probabilidad de una hipótesis, en vez de confirmarla por sí solo?",
            "¿Qué banderas cambian tu conducta antes de indicar ejercicios?",
            "¿Por qué 'mal tracking' no debe usarse como diagnóstico suficiente?"
        ]
    },
    {
        id: "k3.2",
        nombre: "3.2 — DPF: entrevista, carga y objetivos funcionales",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- Cuantifica las tareas relevantes: volumen, frecuencia, superficie, calzado si es pertinente, recuperación, sueño, contexto deportivo y qué actividad la persona quiere recuperar.
- Un aumento brusco de volumen o intensidad puede apoyar una hipótesis de tolerancia de carga insuficiente, pero no sustituye la exploración ni demuestra causalidad única.
- Evita centrar la entrevista en hallazgos anatómicos aislados. La conducta se guía por función, respuesta a la carga, examen y prioridades de la persona.
- Define una meta observable: por ejemplo, bajar un piso de escaleras o correr 20 minutos con síntomas tolerables que vuelvan a la línea basal esperada.
`,
        preguntasEtapa2: [
            "¿Qué preguntas permiten transformar 'me duele al correr' en una hipótesis de carga útil para dosificar?",
            "¿Cómo diferencias una asociación temporal de una causa demostrada?",
            "¿Qué resultado funcional elegirías y por qué sería relevante para esta persona?"
        ],
        casoEtapa3: `"Corredora recreativa aumentó de 15 a 35 km semanales en dos semanas. Dolor 4/10 al correr que desaparece al día siguiente; su objetivo es una carrera en ocho semanas." Propón información faltante y una primera modificación de carga sin indicar reposo absoluto.`,
        preguntasEtapa4: [
            "¿Qué datos hacen que una progresión de carga sea demasiado rápida?",
            "¿Por qué la meta funcional debe negociar-se con la persona?",
            "¿Qué diferencia hay entre dolor tolerable durante una tarea y una señal de alarma?"
        ]
    },
    {
        id: "k3.3",
        nombre: "3.3 — DPF: examen físico e interpretación, no test mágicos",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- Observa una tarea significativa (sentadilla, step-down, subida/bajada, carrera si corresponde) y registra síntomas, rango, control, estrategia, fatiga y confianza.
- Fuerza de rodilla y cadera, movilidad cuando sea pertinente y tolerancia a tareas aportan información para el tratamiento; ningún test aislado confirma DPF ni prescribe un ejercicio único.
- Repetir una tarea comparable antes y después de una modificación puede ayudar a explorar una hipótesis, sin convertir una respuesta inmediata en prueba definitiva de causa.
- El examen debe responder: ¿qué limita hoy la función?, ¿qué es modificable?, ¿qué hallazgo exige derivación o cambio de hipótesis?
`,
        preguntasEtapa2: [
            "¿Qué observarías en un step-down y cómo evitarías sobreinterpretar un único movimiento?",
            "¿Cómo relacionas fuerza, tolerancia de tarea y síntomas sin afirmar que una debilidad aislada 'causó' el DPF?",
            "¿Qué hallazgos te obligan a abandonar una explicación kinesiológica simple?"
        ],
        casoEtapa3: `"En step-down, una paciente reproduce dolor 5/10 al quinto descenso; no hay derrame. Tras reducir altura, el dolor baja a 2/10 y mantiene el control." Explica qué aprendiste, qué no aprendiste aún y cómo usarías el dato.`,
        preguntasEtapa4: [
            "¿Por qué un cambio inmediato de dolor no prueba por sí solo una causa biomecánica?",
            "¿Qué diferencia hay entre una medición de desempeño y un diagnóstico?",
            "¿Cómo documentarías una reevaluación útil para tomar decisiones?"
        ]
    },
    {
        id: "k3.4",
        nombre: "3.4 — DPF: ejercicio y dosificación contemporánea",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- El ejercicio de rodilla y/o cadera se selecciona por déficit de capacidad, tolerancia, preferencias y tarea objetivo. No se indica para "corregir" una forma corporal ni para recolocar permanentemente la patela.
- Empieza con una dosis que permita aprendizaje y exposición exitosa; progresa volumen, rango, resistencia, velocidad o especificidad de tarea según respuesta clínica y objetivo.
- La monitorización incluye síntomas durante/después, recuperación al día siguiente, derrame, desempeño y confianza. La respuesta debe interpretarse junto con el contexto, no con un único umbral universal.
- Las ayudas temporales (por ejemplo, taping u ortesis) pueden considerarse como complemento si facilitan actividad; no reemplazan el plan activo ni se presentan como corrección estructural necesaria.
`,
        preguntasEtapa2: [
            "¿Cómo eliges entre fortalecer rodilla, cadera o ambas sin seguir una receta fija?",
            "¿Qué variable progresarías primero en una persona con buena fuerza pero poca tolerancia a bajar escaleras?",
            "¿Cómo explicarías el rol limitado y temporal de un taping sin generar dependencia?"
        ],
        casoEtapa3: `"Paciente con DPF tolera sentadilla a caja sin dolor, pero presenta dolor al bajar escaleras. Su fuerza mejora, pero evita salir a caminar por temor." Diseña una progresión que incluya fuerza, exposición a la tarea y medición de confianza.`,
        preguntasEtapa4: [
            "¿Qué cambios de programa son razonables tras una exacerbación sin banderas rojas?",
            "¿Por qué el reposo completo rara vez es la primera respuesta?",
            "¿Qué indicador funcional te permitiría decidir que la progresión fue útil?"
        ]
    },
    {
        id: "k3.5",
        nombre: "3.5 — DPF: diferenciales y seguridad clínica",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- El dolor anterior no autoriza a asumir DPF. Considera, según historia y exploración, patología tendinosa, dolor por grasa infrapatelar, inestabilidad patelofemoral, lesión osteocondral, enfermedad inflamatoria, dolor referido y presentaciones de mayor urgencia.
- Un mecanismo de torsión con derrame temprano, bloqueo verdadero o sensación de inestabilidad repetida cambia el examen y puede justificar evaluación médica.
- El rol kinesiológico incluye reconocer límites: explicar incertidumbre, documentar hallazgos y derivar oportunamente; no etiquetar ni tranquilizar en exceso.
`,
        preguntasEtapa2: [
            "¿Qué diferencia clínica te haría considerar inestabilidad patelofemoral en lugar de un DPF no traumático?",
            "¿Qué combinación de hallazgos tras una torsión exige reevaluar antes de entrenar?",
            "¿Cómo comunicarías una derivación sin alarmar ni minimizar?"
        ],
        casoEtapa3: `"Adolescente refiere dolor anterior después de giro jugando fútbol, derrame aparecido esa tarde y dos episodios de sensación de salida de la rodilla." Ordena tus hipótesis y explica por qué no iniciarías una rutina genérica de DPF.`,
        preguntasEtapa4: [
            "¿Qué es un bloqueo verdadero y por qué importa?",
            "¿Qué dato de historia tiene más peso que una prueba aislada en una lesión aguda?",
            "¿Qué debe contener una derivación clínica breve y útil?"
        ]
    },
    {
        id: "k3.6",
        nombre: "3.6 — DPF: educación, adherencia y retorno a actividad",
        categoria: "Dolor Patelofemoral",
        contenidoBase: `
- Educar no es asegurar una explicación única: comunica que el dolor es real, que la imagen no siempre define la función y que la capacidad puede recuperarse con un plan graduado.
- Construye una regla de autorregulación acordada: qué síntoma observar, qué cambio transitorio hacer, cuándo retomar progresión y qué señales requieren avisar o derivar.
- El retorno se basa en la tarea objetivo, tolerancia de carga, desempeño suficiente, confianza y ausencia de señales de alarma; no solo en ausencia total de dolor en camilla.
`,
        preguntasEtapa2: [
            "¿Cómo explicarías la incertidumbre clínica sin reducir la confianza de la persona?",
            "¿Qué componentes debe tener una regla de autorregulación escrita para una deportista?",
            "¿Qué diferencia hay entre alta de síntomas y retorno suficiente a una tarea deportiva?"
        ],
        casoEtapa3: `"La corredora ya camina y hace fuerza sin dolor, pero aún evita trotar por miedo. El examen no muestra banderas rojas." Propón un retorno gradual y una forma de medir tanto desempeño como confianza.`,
        preguntasEtapa4: [
            "¿Por qué la adherencia es una variable clínica y no solo un problema de voluntad?",
            "¿Cómo usarías el feedback para fortalecer razonamiento autónomo de la estudiante?",
            "¿Qué información revisarías antes de declarar alta?"
        ]
    },
    {
        id: "k4.1",
        nombre: "4.1 — LCA: mecanismo, entrevista y urgencias",
        categoria: "LCA y retorno al deporte",
        contenidoBase: `
- Tras una lesión sin contacto con desaceleración, giro o aterrizaje, la hipótesis de lesión de LCA puede ganar peso si hubo derrame temprano, sensación de inestabilidad o un "pop". Ningún elemento aislado confirma el diagnóstico.
- La entrevista debe precisar mecanismo, tiempo del derrame, capacidad inmediata de continuar, episodios de bloqueo, inestabilidad, lesiones previas, deporte y objetivo de retorno.
- Considera lesiones asociadas: menisco, cartílago, MCL, lesión osteocondral o compromiso neurovascular según mecanismo y signos. Un bloqueo verdadero, gran derrame, dolor desproporcionado o compromiso neurovascular cambia la urgencia y la derivación.
`,
        preguntasEtapa2: [
            "¿Qué datos del mecanismo y de la evolución aumentan el peso de una lesión de LCA?",
            "¿Qué diferenciales debes mantener abiertos tras un giro con derrame?",
            "¿Qué hallazgo cambia tu decisión de evaluación o derivación inmediata?"
        ],
        casoEtapa3: `"Futbolista cae tras cambio de dirección, nota pop y derrame en pocas horas. Puede caminar, pero refiere que la rodilla 'se le va'." Formula hipótesis, datos faltantes y conducta segura antes de hablar de retorno.`,
        preguntasEtapa4: [
            "¿Por qué el mecanismo orienta pero no confirma una lesión?",
            "¿Qué diferencia hay entre inestabilidad percibida y un diagnóstico estructural confirmado?",
            "¿Qué debe documentarse al derivar?"
        ]
    },
    {
        id: "k4.2",
        nombre: "4.2 — LCA: examen y lectura de hallazgos",
        categoria: "LCA y retorno al deporte",
        contenidoBase: `
- El examen integra derrame, rango activo/pasivo, extensión, tolerancia a carga, marcha, fuerza, pruebas de estabilidad cuando estén indicadas y función. Se interpreta dentro de la fase y de la historia.
- Una prueba de laxitud positiva requiere competencia técnica y contexto; no sustituye el razonamiento sobre lesión asociada, irritabilidad, objetivos ni necesidad de confirmación médica.
- Diferencia la restricción activa de la pasiva: dolor, derrame e inhibición pueden limitar la activación sin demostrar por sí mismos una lesión nueva.
`,
        preguntasEtapa2: [
            "¿Qué secuencia de examen es más segura en una rodilla aguda e irritable?",
            "¿Cómo interpretas una limitación de extensión activa versus pasiva?",
            "¿Qué información añade el derrame a tu hipótesis y a la dosificación?"
        ],
        casoEtapa3: `"A una semana de lesión, la persona tiene derrame leve, extensión pasiva casi completa y no logra extensión activa terminal." Explica hipótesis para la limitación, qué medirías y qué conclusión sería prematura.`,
        preguntasEtapa4: [
            "¿Por qué un test especial no debe enseñarse como veredicto aislado?",
            "¿Qué hallazgos obligan a posponer pruebas funcionales exigentes?",
            "¿Cómo registrarías el cambio de derrame entre sesiones?"
        ]
    },
    {
        id: "k4.3",
        nombre: "4.3 — LCA: prehabilitación y decisiones compartidas",
        categoria: "LCA y retorno al deporte",
        contenidoBase: `
- Antes de una posible reconstrucción, se busca controlar derrame e irritabilidad, recuperar extensión, mejorar marcha, fuerza y confianza según tolerancia. Estos son objetivos funcionales, no una carrera contra un calendario.
- La decisión quirúrgica y el retorno al deporte pertenecen a una conversación interdisciplinaria. La kinesiología aporta desempeño, síntomas, metas, adherencia y preparación; no promete un resultado ni indica cirugía por cuenta propia.
- La educación debe evitar miedo: la lesión requiere una rehabilitación seria y progresiva, pero no convierte a la persona en frágil ni define su identidad deportiva.
`,
        preguntasEtapa2: [
            "¿Por qué extensión, derrame, marcha y fuerza son datos útiles antes de hablar de fases avanzadas?",
            "¿Qué información aportarías al equipo para una decisión compartida?",
            "¿Cómo distinguirías una meta de retorno de un criterio clínico actual?"
        ],
        casoEtapa3: `"Deportista quiere operar 'lo antes posible' y volver en tres meses. Tiene derrame, marcha en flexión y mucha ansiedad." Prioriza tu evaluación, educación y los límites de lo que puedes prometer.`,
        preguntasEtapa4: [
            "¿Por qué el calendario no basta para progresar?",
            "¿Cómo afecta la adherencia a la interpretación de un progreso lento?",
            "¿Qué lenguaje evita tanto el nocebo como la falsa seguridad?"
        ]
    },
    {
        id: "k4.4",
        nombre: "4.4 — LCA: progresión de fuerza, tareas y exposición",
        categoria: "LCA y retorno al deporte",
        contenidoBase: `
- Progresa desde el estado clínico actual hacia tareas relevantes: fuerza, control de movimiento, desaceleración, saltos, cambios de dirección y exposición específica al deporte cuando la fase y la respuesta lo permitan.
- La calidad de movimiento se observa junto con síntomas, derrame, fuerza, rendimiento, fatiga y confianza. No se usa como una estética de "alineación perfecta" ni como único predictor de seguridad.
- Modifica una variable por vez cuando sea posible (volumen, velocidad, complejidad, superficie o incertidumbre de tarea) para interpretar respuesta y construir tolerancia.
`,
        preguntasEtapa2: [
            "¿Qué datos necesitas antes de introducir un cambio de dirección?",
            "¿Cómo progresas una tarea sin usar solo el tiempo postoperatorio?",
            "¿Por qué conviene modificar una variable a la vez?"
        ],
        casoEtapa3: `"Persona con buena sentadilla bilateral desea volver a fútbol. Aún presenta derrame al día siguiente de correr y evita desacelerar." Decide qué no progresarías todavía, qué medirías y qué entrenarías primero.`,
        preguntasEtapa4: [
            "¿Qué diferencia hay entre capacidad física y preparación para una tarea deportiva?",
            "¿Cómo usar la respuesta al día siguiente sin convertirla en una regla rígida?",
            "¿Qué factor psicosocial puede modificar la exposición?"
        ]
    },
    {
        id: "k4.5",
        nombre: "4.5 — LCA: retorno al deporte y reducción de riesgo",
        categoria: "LCA y retorno al deporte",
        contenidoBase: `
- Retornar es un proceso, no un alta binaria. Integra estado de la rodilla, fuerza, pruebas funcionales pertinentes, exposición gradual, confianza, demandas del deporte y decisión compartida con equipo y persona.
- Ningún porcentaje de simetría, hop test o mes del calendario garantiza seguridad por sí solo. Las pruebas se usan como una batería contextualizada, con calidad técnica y comparación con metas relevantes.
- Los programas preventivos basados en ejercicio combinan trabajo neuromuscular, fuerza, salto/aterrizaje y tareas específicas, con buena implementación y adherencia; no prometen eliminar todo riesgo.
`,
        preguntasEtapa2: [
            "¿Por qué un solo test aprobado no autoriza automáticamente el retorno?",
            "¿Qué dimensiones incluirías en una batería de retorno?",
            "¿Cómo explicarías reducción de riesgo sin prometer prevención absoluta?"
        ],
        casoEtapa3: `"Jugadora supera una prueba de salto, pero reporta miedo alto y no ha entrenado con oposición ni fatiga." Decide si el dato basta, qué falta explorar y cómo se lo comunicarías.`,
        preguntasEtapa4: [
            "¿Qué diferencia hay entre retorno a participación, retorno a deporte y retorno a rendimiento?",
            "¿Por qué la exposición específica al deporte es una variable clínica?",
            "¿Cómo usarías una prueba funcional para generar una decisión y no solo una nota?"
        ]
    },
    ...KNEE_PRESCRIPTION_TOPICS
].map(topic => topic.categoria === 'Evaluación y Reevaluación'
    ? { ...topic, categoria: 'Artroplastia (PTR)' }
    : topic) as KneeTopic[];
