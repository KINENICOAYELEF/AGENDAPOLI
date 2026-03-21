import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { DiagnosisSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const record = rateLimitCache.get(userId);

    if (!record) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (record.count >= MAX_REQUESTS) return false;
    record.count += 1;
    return true;
}

export async function POST(req: Request) {
    try {
        const { payload, userId } = await req.json();

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // El frontend ahora ensambla la estructura compact_case_package completa
        const normalizedPayload = normalizePayload(payload);

        const inputHash = await generateSHA256(`diagnosis:${normalizedPayload}`);

        const expectedJsonExample = `{
  "snapshot_clinico": { 
    "identificacion": { "nombre": "Juan Pérez", "edad": "45 años", "sexo": "Masculino" },
    "contexto_basal": { 
      "ocupacion": "Administrativo (Sedentario)", 
      "deporte_actividad": "Running 3v/sem (Amateur)", 
      "demanda_fisica": "Baja en oficina, Alta en cerro", 
      "ayudas_tecnicas": ""
    },
    "factores_relevantes": { 
      "comorbilidades": ["HTA controlada", "Hipotiroidismo"], 
      "medicamentos": ["Losartán 50mg", "Levotiroxina 50mcg"], 
      "antecedentes_msk": ["Fractura de peroné hace 10 años", "Esguince tobillo recurrente"], 
      "observaciones_seguridad": ["Fatiga cardiovascular moderada al esfuerzo"] 
    },
    "foco_y_lado": "Sacroilíaca y Cadera Derecha", 
    "irritabilidad_sugerida": "Alta",
    "tolerancia_carga": { "nivel": "Baja", "explicacion": "Dolor > 4/10 al trotar > 2km. Escaleras provocan 7/10." },
    "tarea_indice": "Bajar escaleras",
    "alertas_clinicas": ["Dolor nocturno leve"]
  },
  "clasificacion_dolor": { 
    "categoria": "nociceptivo", 
    "subtipos": ["Mecánico", "Isquémico/Inflamatorio"], 
    "subtipo_manual": "", 
    "fundamento": { 
      "apoyo": [
        "Mecanismo de carga dependiente reportado en P1 (agravado por sedestación prolongada y trote).", 
        "Reproducción fidedigna (>7/10) al aplicar cluster de compresión ortopédica directa en P2.",
        "Ausencia de signos radiculares o alteraciones de la sensibilidad periférica en P2.",
        "Relato histórico en P1.5 de episodios autolimitados consistentes con sobrecarga tisular."
      ], 
      "duda_mezcla": [
        "Dolor nocturno leve que interrumpe el sueño inicial reportado en P1 sugiere un componente inflamatorio activo residual.",
        "El componente de hiperalgesia secundaria perilesional observado en P2 indica sensibilización periférica en curso."
      ], 
      "conclusion": "Cuadro dominado por un mecanismo nociceptivo mecánico claro, impulsado por sobrecarga articular y tendinosa. Existe un subtipo inflamatorio/isquémico secundario que explica la irritabilidad sostenida post-ejercicio y el dolor nocturno." 
    }, 
    "nivel_confianza": "Alta" 
  },
  "sistema_y_estructuras": { 
    "sistemas_involucrados": ["musculoesquelético articular", "neuromuscular", "cardiovascular", "tegumentario", "endocrino", "nervioso periférico"], 
    "estructuras": {
        "principales": [
            { "nombre": "Articulación Sacroilíaca Derecha", "argumento": "Reproducción fidedigna del dolor principal (>7/10) al aplicar el cluster de provocación ortopédica de Laslett durante P2, cruzando con mecanismo de carga asimétrica reportado en P1. El patrón de dolor descrito (agravado por escaleras, sedestación prolongada y rotación en cama) es consistente con sobrecarga articular SI unilateral." },
            { "nombre": "Articulación Coxofemoral Derecha", "argumento": "ROM de rotación interna y externa limitado y doloroso (EVA 8/10) medido en P2. La restricción bilateral con predominio derecho, sumada a la demanda deportiva alta (running) reportada en P1, sugiere compromiso capsular o labral reactivo secundario a la disfunción SI." }
        ],
        "secundarias": [
            { "nombre": "Ligamentos Sacroilíacos Dorsales", "argumento": "Sensibilidad exquisita circunscrita a la banda ligamentosa posterior detectada mediante palpación directa en P2, correlacionada con antecedente de laxitud pélvica post-parto documentado en P1.5. El dolor es reproducible con compresión lateral." },
            { "nombre": "Musculatura Glútea (Glúteo Medio y Mayor)", "argumento": "Debilidad manual grado 3/5 bilateral con Trendelenburg positivo en marcha observado en P2. El paciente refiere dificultad para subir escaleras y mantener equilibrio unipodal en P1, lo que correlaciona con insuficiencia de la musculatura estabilizadora pélvica." },
            { "nombre": "Musculatura del Core / Transverso Abdominal", "argumento": "Pérdida de control motor lumbopélvico evidenciada por compensaciones durante puente unilateral en P2, sumada a la cicatriz abdominal post-cesárea que podría comprometer la activación del transverso y oblicuos." }
        ],
        "asociadas_moduladoras": [
            { "nombre": "Corazón y Vasos Sanguíneos", "argumento": "Hipertensión arterial crónica documentada en P1.5 con uso de Losartán 50mg, que condiciona la microperfusión tisular periarticular y limita la respuesta inflamatoria reparativa. A los 45 años con HTA, el umbral cardiovascular al esfuerzo está reducido." },
            { "nombre": "Piel y Fascia (Cicatriz Abdominal Post-Cesárea)", "argumento": "Cicatriz por cesárea visible y palpable en inspección estática de P2, con restricción de deslizamiento fascial percibido a la palpación. Transfiere estrés tensional hacia la pared lumbopélvica anterior, potencialmente limitando la activación del core profundo." },
            { "nombre": "Sistema Endocrino (Tiroides)", "argumento": "Hipotiroidismo controlado con Levotiroxina 50mcg reportado en P1.5. Factor metabólico que puede ralentizar la reparación del colágeno y la síntesis proteica muscular, afectando los tiempos de recuperación tisular esperados." },
            { "nombre": "Nervios Periféricos Lumbosacros", "argumento": "Aunque no hay signos neurológicos francos en P2, la proximidad anatómica del plexo lumbosacro a la articulación SI y la presencia de dolor nocturno leve reportado en P1 justifican su inclusión como estructura moduladora a vigilar." }
        ]
    },
    "estructuras_mas_afectan": "Disfunción mecánica sacroilíaca derecha con compromiso capsular coxofemoral secundario, modulada por incompetencia del control motor lumbopélvico (glúteos + core debilitados), ambiente metabólico adverso (HTA + hipotiroidismo) y restricción fascial abdominal post-quirúrgica." 
  },
  "alteraciones_detectadas": { 
    "estructurales": [
      { 
        "estructura": "Articulación Sacroilíaca Derecha", 
        "alteracion": "Disfunción mecánica por inestabilidad / Cizalla reactiva", 
        "certeza": "Probable", 
        "fundamento": "Reproducción fidedigna del dolor principal (>7/10) al aplicar cluster de Laslett en P2, coincidiendo con mecanismo de carga asimétrica reportado en P1.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Ligamentos Sacroilíacos Dorsales",
        "alteracion": "Irritación tisular reactiva / posible esguince crónico",
        "certeza": "Posible",
        "fundamento": "Sensibilidad exquisita a palpación en P2. Historial de dolor pélvico persistente reportado en P1 apoya daño colagenoso.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Músculo Glúteo Medio",
        "alteracion": "Atrofia selectiva / Hipotrofia por desuso",
        "certeza": "Posible",
        "fundamento": "Palpación en P2 revela menor volumen en lado derecho. Correlaciona con evitación selectiva de apoyo de extremidad inferior reportado en P1.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Sistema Cardiovascular / Arterias",
        "alteracion": "Hipertensión Arterial Sistémica periférica",
        "certeza": "Casi confirmada",
        "fundamento": "Antecedente médico directo en P1.5. Observación de fatiga rápida y disnea leve durante pruebas submáximas en P2.",
        "impacto_caso": "Poco"
      },
      {
        "estructura": "Sistema Endocrino / Tiroides",
        "alteracion": "Hipotiroidismo subclínico / metabólicamente ralentizado",
        "certeza": "Casi confirmada",
        "fundamento": "Reportado en P1.5 con terapia de reemplazo. Explica parcialmente la pobre respuesta regenerativa y cronicidad del tejido.",
        "impacto_caso": "Poco"
      },
      {
        "estructura": "Piel / Fascia Lumbopélvica Anterior",
        "alteracion": "Fibrosis y densificación fascial post-quirúrgica",
        "certeza": "Probable",
        "fundamento": "Cicatriz por cesárea en P1.5, con severa restricción de deslizamiento tisular inferior confirmada a la palpación en P2.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Nervio Ciático / Elementos Neurales Periféricos",
        "alteracion": "Sensibilización neural mecánica leve",
        "certeza": "Posible",
        "fundamento": "Relato ocasional de tensión posterior en P1. Slump test resulta en tirón neural (3/10) antes del dolor articular primario en P2.",
        "impacto_caso": "Medio"
      },
      {
        "estructura": "Sistema Vascular / Endotelio Periférico",
        "alteracion": "Disfunción endotelial microvascular",
        "certeza": "Posible",
        "fundamento": "HTA de larga data en P1.5. Frialdad distal y llenado capilar enlentecido (>3s) tras estrés físico observado rudimentariamente en P2.",
        "impacto_caso": "Poco"
      },
      {
        "estructura": "Hueso Subcondral (Ej. Sacro/Ilíaco)",
        "alteracion": "Posible reacción de estrés óseo temprana",
        "certeza": "Duda",
        "fundamento": "Dolor óseo sordo post-cargas mecánicas extremas (running) en P1. Percusión directa dolorosa profunda no articular en P2.",
        "impacto_caso": "Medio"
      },
      {
        "estructura": "Fascia Plantar / Cadena Miofascial Posterior",
        "alteracion": "Sobrecarga tensil reactiva",
        "certeza": "Probable",
        "fundamento": "Reporte de rigidez matinal en pie derecho al iniciar marcha P1. Palpación tensa y dolorosa en inserción del calcáneo P2.",
        "impacto_caso": "Medio"
      }
    ], 
    "funcionales": [
      { 
        "funcion_disfuncion": "Dolor somático profundo en zona sacroilíaca", 
        "severidad": "Severa",
        "fundamento": "La paciente indica EVA 8/10 en historia P1 al correr, correlacionado en P2 al reproducir 8/10 en test de Thrust.",
        "dominio_sugerido": "Dolor"
      },
      { 
        "funcion_disfuncion": "Irritabilidad mecánica patológica (After-effect >2h)", 
        "severidad": "Severa",
        "fundamento": "Reportado en P1 que tras subir pendientes, la zona palpita todo el día. Limitó la cantidad de pruebas toleradas en P2.",
        "dominio_sugerido": "Dolor"
      },
      {
        "funcion_disfuncion": "Baja tolerancia a la carga axial acumulada",
        "severidad": "Moderada",
        "fundamento": "Incapacidad para mantenerse de pie por >20 mins en P1. Claudicación precoz en marcha en banda en P2.",
        "dominio_sugerido": "Carga"
      },
      {
        "funcion_disfuncion": "Debilidad de abductores de cadera derecha",
        "severidad": "Moderada",
        "fundamento": "Queja de inestabilidad al bajar escalones en P1. Confirmado muscularmente con MMT 3/5 doloroso en P2.",
        "dominio_sugerido": "Fuerza"
      },
      {
        "funcion_disfuncion": "Menor resistencia a la fatiga en cadena posterior",
        "severidad": "Moderada",
        "fundamento": "Sentimiento de pesadez lumbar reportado en P1 a media tarde. Fallo técnico precoz en puente isométrico a los 15s en P2.",
        "dominio_sugerido": "Fuerza"
      },
      {
        "funcion_disfuncion": "Déficit de disociación lumbopélvica",
        "severidad": "Moderada",
        "fundamento": "Movimiento en bloque reportado al intentar agacharse P1. Retroversión forzada compensatoria objetivada en Bird-Dog en P2.",
        "dominio_sugerido": "Control motor"
      },
      {
        "funcion_disfuncion": "Dominancia Isquiosural sobre Glúteo Mayor",
        "severidad": "Moderada",
        "fundamento": "Calambres isquiotibiales frecuentes en P1. Activación isquiotibial temprana palpada durante extensión de cadera en P2.",
        "dominio_sugerido": "Control motor"
      },
      {
        "funcion_disfuncion": "Hipomovilidad capsular coxofemoral posterior",
        "severidad": "Moderada",
        "fundamento": "Imposibilidad para cruzar la pierna sentado en P1. Tope firme y doloroso en rotación interna pasiva (<15°) en P2.",
        "dominio_sugerido": "Movilidad"
      },
      {
        "funcion_disfuncion": "Restricción de movilidad accesoria sacrococcígea",
        "severidad": "Moderada",
        "fundamento": "Dolor sentado duro P1. P2 revela ausencia de juego articular posteroanterior en base sacra.",
        "dominio_sugerido": "Movilidad"
      },
      {
        "funcion_disfuncion": "Perturbación del equilibrio unipodal (Balance)",
        "severidad": "Moderada",
        "fundamento": "Caídas menores relatadas en P1.5. Estrategia de tobillo ineficiente y uso extensivo de brazos en Single Leg Stance en P2.",
        "dominio_sugerido": "Sensorimotor"
      },
      {
        "funcion_disfuncion": "Kinesiofobia hacia la asimetría de carga",
        "severidad": "Leve",
        "fundamento": "Lenguaje temeroso al describir escaleras en P1 ('siento que se me sale el hueso'). Tensión defensiva muscular activa en P2.",
        "dominio_sugerido": "Psicosocial"
      },
      {
        "funcion_disfuncion": "Desacondicionamiento aeróbico leve (HTA relacionada)",
        "severidad": "Leve",
        "fundamento": "Pérdida de actividad cardiovascular por suspender running en P1. Respuesta de FC desproporcionada al esfuerzo ligero en P2.",
        "dominio_sugerido": "Cardiovascular"
      },
      {
        "funcion_disfuncion": "Atrapamiento fascial tegumentario infraumbilical",
        "severidad": "Moderada",
        "fundamento": "Sensación de tirón profundo P1. Retracción evidente del tejido celular subcutáneo en test de pliegue rodado abdominal P2.",
        "dominio_sugerido": "Tegumentario"
      },
      {
        "funcion_disfuncion": "Mecanosensibilidad Neural Periférica (Neuromotor)",
        "severidad": "Leve",
        "fundamento": "Percibe tirones eléctricos difusos al agacharse en P1. Tensión de isquiotibiales en P2 enmascara respuesta positiva leve al Slump Test.",
        "dominio_sugerido": "Neurológico"
      },
      {
        "funcion_disfuncion": "Déficit en Reclutamiento Neuromotor Rápido (RFD - Potencia)",
        "severidad": "Severa",
        "fundamento": "Impotencia para reacelerar en el running relatada en P1. Incapacidad de generar despegue explosivo en test de salto vertical P2.",
        "dominio_sugerido": "Rendimiento"
      },
      {
        "funcion_disfuncion": "Alteración de absorción de impacto (Landing Mechanics)",
        "severidad": "Severa",
        "fundamento": "Referencia de 'golpe' duro al trotar en asfalto P1. Observación de stiff-landing (aterrizaje rígido) sin amortiguación glútea en Drop Jump P2.",
        "dominio_sugerido": "Rendimiento"
      },
      {
        "funcion_disfuncion": "Ineficiencia y aprehensión en Cambios de Dirección (COD)",
        "severidad": "Moderada",
        "fundamento": "Relato de evitación de giros bruscos por miedo en P1. Lentitud extrema y pérdida de estabilidad en pivotes a 45 grados en P2.",
        "dominio_sugerido": "Rendimiento"
      },
      {
        "funcion_disfuncion": "Inhibición Muscular Artrogénica (AMI) del Glúteo Mayor",
        "severidad": "Severa",
        "fundamento": "Incapacidad de 'sentir' el glúteo trabajando al correr P1. Ausencia casi total de activación tónica a la palpación isométrica en camilla P2.",
        "dominio_sugerido": "Neurológico"
      },
      {
        "funcion_disfuncion": "Fatiga Metabólica/Glucolítica Prematura",
        "severidad": "Moderada",
        "fundamento": "Choque energético a los 5 minutos de esfuerzo P1. Caída dramática de fuerza de prensión (Handgrip) post-sprint anaeróbico en P2.",
        "dominio_sugerido": "Metabólico"
      },
      {
        "funcion_disfuncion": "Ineficiencia Ventilatoria Bajo Carga (Core)",
        "severidad": "Leve",
        "fundamento": "Falta de aire reportada al hacer sentadillas P1. Patrón apical obligado y respiración paradójica objetivada al meter presión intraabdominal P2.",
        "dominio_sugerido": "Respiratorio"
      }
    ] 
  },
  "actividad_y_participacion": {
    "limitaciones_directas": [
      { "texto": "Bajar escaleras sin apoyo", "severidad": "moderada", "detalle": "Dolor punzante en SI derecha que obliga a usar pasamanos; la carga excéntrica en escalones agrava la cizalla articular." },
      { "texto": "Permanecer sentado > 30 min", "severidad": "moderada", "detalle": "Aparición de rigidez y dolor sordo lumbopélvico por carga estática prolongada sobre la articulación SI." },
      { "texto": "Correr a velocidades > 9 km/h", "severidad": "severa", "detalle": "Impotencia funcional por dolor en cara lateral de cadera; la carga repetitiva de impacto supera el umbral de tolerancia tisular." },
      { "texto": "Dormir sobre el lado derecho", "severidad": "leve", "detalle": "Despertar nocturno por compresión directa de la zona dolorosa contra el colchón; usa almohada entre piernas como compensación." },
      { "texto": "Realizar estocadas o sentadillas profundas", "severidad": "completa", "detalle": "Evitación total por dolor insoportable 9/10; la flexión profunda de cadera + carga axial reproduce el patrón de dolor principal." }
    ],
    "restricciones_participacion": [
      { "texto": "Desempeño Laboral Efectivo (Oficina)", "severidad": "moderada", "detalle": "Necesidad de pausas constantes no programadas cada 20 min; pérdida de concentración por dolor lumbar en sedestación prolongada. Inferido de ocupación sedentaria en P1 + dolor sentado en P2." },
      { "texto": "Entrenamiento de Running (Grupo)", "severidad": "severa", "detalle": "Abandono temporal de la actividad deportiva principal; aislamiento del grupo social deportivo. Paciente reporta que era su principal herramienta de manejo de estrés." },
      { "texto": "Cuidado de hijos pequeños", "severidad": "moderada", "detalle": "Dificultad para cargarlos, agacharse al suelo o jugar en posiciones bajas. Inferido de rol parental en P1.5 + limitaciones de carga y flexión en P2." },
      { "texto": "Vida Sexual activa", "severidad": "leve", "detalle": "Limitación por dolor en posiciones de carga pélvica y miedo al movimiento. Inferido de kinesiofobia reportada en P1 + dolor en rotación de cadera en P2." },
      { "texto": "Participación Social y Recreativa", "severidad": "moderada", "detalle": "Evitación de salidas que impliquen caminatas largas, estar de pie en eventos o actividades al aire libre. Inferido de baja tolerancia a la carga en P2 + perfil deportivo previo en P1." }
    ]
  },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": [
      "Alta motivación intrínseca para rehabilitarse (reportado en P1)", 
      "Experiencia deportiva previa que facilita adherencia al ejercicio terapéutico", 
      "Buena capacidad de comunicación y comprensión de instrucciones (observado en entrevista)", 
      "Resiliencia demostrada: mantiene actividad laboral a pesar del dolor crónico"
    ], 
    "factores_personales_negativos": [
      "Estrés laboral crónico alto que potencia sensibilización central y reduce umbral de dolor", 
      "Mala calidad de sueño interrumpido por dolor nocturno (reportado en P1, correlaciona con irritabilidad alta)", 
      "Tendencia a kinesiofobia leve: evita actividades deportivas por temor a empeorar (inferido de P1)", 
      "Edad 45 años: inicio de declive hormonal que puede afectar recuperación del colágeno y masa muscular",
      "Sexo femenino + post-parto: laxitud ligamentosa residual pélvica documentada en P1.5"
    ], 
    "facilitadores_ambientales": [
      "Red de apoyo familiar fuerte (pareja activa en cuidado de hijos, reportado en P1.5)", 
      "Acceso a gimnasio cerca de casa (facilita adherencia a programa de ejercicio)", 
      "Seguro médico con cobertura de kinesiología (elimina barrera económica)", 
      "Jornada laboral con flexibilidad horaria parcial (permite asistir a sesiones)"
    ], 
    "barreras_ambientales": [
      "Trabajo 100% sedentario en oficina sin estación de pie (agrava síntomas por sedestación prolongada)", 
      "Entorno laboral con alta exigencia cognitiva y plazos (potencia estrés → dolor)", 
      "Domicilio con escaleras obligatorias sin ascensor (provocación diaria del dolor)", 
      "Falta de mobiliario ergonómico en casa y oficina (sillas sin soporte lumbar)",
      "Distancia al centro de salud > 30 min (puede afectar frecuencia de asistencia)"
    ],
    "factores_clinicos_moduladores": [
      "Hipotiroidismo controlado con Levotiroxina (ralentiza metabolismo del colágeno y velocidad de reparación tisular)", 
      "HTA crónica con Losartán 50mg (condiciona microperfusión, limita intensidad de ejercicio cardiovascular)", 
      "Cronicidad del cuadro > 6 meses (riesgo de sensibilización central y patrones motores compensatorios establecidos)", 
      "Antecedente de laxitud pélvica post-parto (P1.5) que predispone a recurrencia de disfunción SI"
    ],
    "observaciones_bps_integradas": "Paciente de 45 años con perfil atlético (running amateur) atrapada en un ciclo de sedentarismo laboral forzado y desregulación metabólica (hipotiroidismo + HTA). La lesión biológica (disfunción SI crónica) está cronificada por el ambiente pro-inflamatorio sistémico, el estrés laboral sostenido y la laxitud residual post-parto. Sin embargo, su alta motivación intrínseca, experiencia deportiva previa y red de apoyo familiar sólida constituyen un motor potente de recuperación. El pronóstico depende críticamente de la gestión del estrés laboral y la progresión gradual de carga respetando la irritabilidad alta."
  },
  "recordatorios_y_coherencia": { 
    "recordatorios_clinicos": [
      "Vigilar presión arterial durante ejercicio de alta intensidad por HTA", 
      "Monitorear niveles de TSH si recuperación tisular es más lenta de lo esperado",
      "Evaluar calzado deportivo antes de reintegro a running"
    ], 
    "cosas_a_vigilar_en_tratamiento": [
      "Dolor nocturno: si aumenta en frecuencia o intensidad, considerar derivación para descartar patología inflamatoria sistémica", 
      "After-effect post-sesión: no debe superar 2h; si supera, reducir carga 30%",
      "Signos neurológicos: vigilar aparición de parestesias o debilidad distal"
    ], 
    "faltantes_no_criticos": ["Falta test neurodinámico formal (slump/SLR)", "No se documentó evaluación de piso pélvico post-parto"], 
    "incoherencias_detectadas": [] 
  }
} `;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA (COMPACT CASE PACKAGE):
${normalizedPayload}
    `;

        // Sanitizador: rellena campos que el modelo lite a veces omite, SIN relajar el schema
        const sanitizeP3Response = (data: any) => {
            if (data?.sistema_y_estructuras?.estructuras) {
                if (!data.sistema_y_estructuras.estructuras.secundarias) data.sistema_y_estructuras.estructuras.secundarias = [];
                if (!data.sistema_y_estructuras.estructuras.asociadas_moduladoras) data.sistema_y_estructuras.estructuras.asociadas_moduladoras = [];
                if (!data.sistema_y_estructuras.estructuras.principales) data.sistema_y_estructuras.estructuras.principales = [];
            }
            if (data?.actividad_y_participacion) {
                if (!data.actividad_y_participacion.limitaciones_directas) data.actividad_y_participacion.limitaciones_directas = [];
                if (!data.actividad_y_participacion.restricciones_participacion) data.actividad_y_participacion.restricciones_participacion = [];
            }
            if (data?.factores_biopsicosociales) {
                if (!data.factores_biopsicosociales.factores_personales_positivos) data.factores_biopsicosociales.factores_personales_positivos = [];
                if (!data.factores_biopsicosociales.factores_personales_negativos) data.factores_biopsicosociales.factores_personales_negativos = [];
                if (!data.factores_biopsicosociales.facilitadores_ambientales) data.factores_biopsicosociales.facilitadores_ambientales = [];
                if (!data.factores_biopsicosociales.barreras_ambientales) data.factores_biopsicosociales.barreras_ambientales = [];
                if (!data.factores_biopsicosociales.factores_clinicos_moduladores) data.factores_biopsicosociales.factores_clinicos_moduladores = [];
            }
            if (data?.recordatorios_y_coherencia) {
                if (!data.recordatorios_y_coherencia.recordatorios_clinicos) data.recordatorios_y_coherencia.recordatorios_clinicos = [];
                if (!data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento) data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento = [];
                if (!data.recordatorios_y_coherencia.faltantes_no_criticos) data.recordatorios_y_coherencia.faltantes_no_criticos = [];
                if (!data.recordatorios_y_coherencia.incoherencias_detectadas) data.recordatorios_y_coherencia.incoherencias_detectadas = [];
            }
            return data;
        };

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\n\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v3.9.0',
            temperature: 0.2,
            validator: (data) => DiagnosisSchema.parse(sanitizeP3Response(data))
        });

        // The UI (Screen3_Sintesis) currently expects `{ success: true, data: ..., hash, latencyMs }`
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/diagnosis:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
