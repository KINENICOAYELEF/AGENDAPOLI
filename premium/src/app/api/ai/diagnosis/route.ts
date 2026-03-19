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
  "clasificacion_dolor": { "categoria": "nociceptivo", "subtipos": ["Mecánico", "Inflamatorio"], "subtipo_manual": "", "fundamento": { "apoyo": ["Dolor reproducible con test de Laslett", "Agravado por carga mecánica"], "duda_mezcla": ["Dolor nocturno leve podría sugerir componente inflamatorio"], "conclusion": "Predominio nociceptivo mecánico con posible componente inflamatorio secundario." }, "nivel_confianza": "Media" },
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
        "fundamento": "Sensibilidad exquisita a palpación directa en P2 + antecedente de laxitud post-parto en P1.5.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Musculatura Glútea (Glúteo Medio/Mayor)",
        "alteracion": "Atrofia / hipotrofia funcional por desuso antálgico",
        "certeza": "Posible",
        "fundamento": "Debilidad manual grado 3/5 con compensaciones observadas en P2.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Sistema Cardiovascular / Arterias",
        "alteracion": "Hipertensión Arterial Sistémica (HTA)",
        "certeza": "Casi confirmada",
        "fundamento": "Antecedente médico directo en P1.5 con uso crónico de Losartán. Condiciona microperfusión tisular y tolerancia al esfuerzo.",
        "impacto_caso": "Poco"
      },
      {
        "estructura": "Sistema Endocrino / Tiroides",
        "alteracion": "Hipotiroidismo (Antecedente)",
        "certeza": "Casi confirmada",
        "fundamento": "Reportado en P1.5 como diagnóstico médico basal con Levotiroxina. Puede ralentizar la reparación tisular.",
        "impacto_caso": "Poco"
      },
      {
        "estructura": "Piel / Fascia Abdominal",
        "alteracion": "Tejido cicatricial post-cesárea con adherencias",
        "certeza": "Posible",
        "fundamento": "Cicatriz visible y palpable en inspección estática P2. Potencial restricción fascial lumbopélvica.",
        "impacto_caso": "Poco"
      }
    ], 
    "funcionales": [
      { 
        "funcion_disfuncion": "Dolor sacroilíaco bilateral", 
        "severidad": "Severa",
        "fundamento": "EVA 8/10 actual, 6/10 habitual reportado en P1. Dolor reproducible con maniobras de cizalla en P2.",
        "dominio_sugerido": "Dolor"
      },
      { 
        "funcion_disfuncion": "Irritabilidad mecánica alta", 
        "severidad": "Severa",
        "fundamento": "Dolor tarda >2h en calmar tras provocación mínima (subir escaleras) reportado en P1. After-effect prolongado.",
        "dominio_sugerido": "Dolor"
      },
      {
        "funcion_disfuncion": "Baja tolerancia a la carga acumulada",
        "severidad": "Moderada",
        "fundamento": "No tolera >2km de trote ni escaleras sin exacerbación (>4/10). Reportado en P1 y corroborado en P2.",
        "dominio_sugerido": "Carga"
      },
      {
        "funcion_disfuncion": "Debilidad de glúteo medio bilateral",
        "severidad": "Moderada",
        "fundamento": "Manual grado 3/5 con compensaciones en Trendelenburg positivo observado en P2.",
        "dominio_sugerido": "Fuerza"
      },
      {
        "funcion_disfuncion": "Baja resistencia isométrica de cadena posterior",
        "severidad": "Moderada",
        "fundamento": "Fatiga prematura y pérdida de técnica antes de 10 repeticiones en puente unilateral en P2.",
        "dominio_sugerido": "Fuerza"
      },
      {
        "funcion_disfuncion": "Déficit de control motor lumbopélvico",
        "severidad": "Moderada",
        "fundamento": "Compensación con rigidez y pérdida de disociación lumbopélvica durante tareas de control motor en P2.",
        "dominio_sugerido": "Control motor"
      },
      {
        "funcion_disfuncion": "Compensaciones lumbopélvicas en puente unilateral",
        "severidad": "Leve",
        "fundamento": "Rotación pélvica excesiva y reclutamiento dominante de isquiotibiales observado en P2.",
        "dominio_sugerido": "Control motor"
      },
      {
        "funcion_disfuncion": "Limitación de ROM en rotación interna/externa de cadera",
        "severidad": "Moderada",
        "fundamento": "ROM activo/pasivo incompleto y doloroso (EVA 8/10) en P2.",
        "dominio_sugerido": "Movilidad"
      },
      {
        "funcion_disfuncion": "Hipomovilidad sacra / restricción de nutación",
        "severidad": "Moderada",
        "fundamento": "Evaluación de movilidad accesoria en P2 muestra restricción significativa del juego articular.",
        "dominio_sugerido": "Movilidad"
      },
      {
        "funcion_disfuncion": "Mala calidad de sueño",
        "severidad": "Moderada",
        "fundamento": "Reportado en factores personales negativos de P1. Dolor nocturno leve interfiere con el descanso.",
        "dominio_sugerido": "Psicosocial"
      },
      {
        "funcion_disfuncion": "Kinesiofobia / Miedo al movimiento",
        "severidad": "Leve",
        "fundamento": "Evitación de actividades deportivas por temor a empeorar, reportado en P1.",
        "dominio_sugerido": "Psicosocial"
      },
      {
        "funcion_disfuncion": "Regulación metabólica alterada por hipotiroidismo",
        "severidad": "Leve",
        "fundamento": "Antecedente de hipotiroidismo en P1.5. Puede afectar tasa de reparación tisular y niveles de energía.",
        "dominio_sugerido": "Metabólico"
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

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\n\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v3.7.0',
            temperature: 0.2,
            validator: (data) => DiagnosisSchema.parse(data)
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
