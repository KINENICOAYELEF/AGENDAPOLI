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
    "sistemas_involucrados": ["musculoesquelético articular", "neuromuscular", "cardiovascular", "tegumentario", "endocrino"], 
    "estructuras": {
        "principales": [{ "nombre": "Articulación Sacroilíaca", "argumento": "Reproducción fidedigna del dolor principal (>7/10) al aplicar el cluster de provocación ortopédica de Laslett durante P2, cruzando con mecanismo de carga asimétrica reportado en P1." }],
        "secundarias": [{ "nombre": "Ligamentos Sacroilíacos Dorsales", "argumento": "Sensibilidad exquisita circunscrita a la banda ligamentosa detectada en P2, con antecedente de laxitud pélvica post-parto en P1.5." }],
        "asociadas_moduladoras": [
            { "nombre": "Corazón y Vasos Sanguíneos", "argumento": "Hipertensión arterial crónica documentada en P1.5 que condiciona microperfusión y respuesta inflamatoria." },
            { "nombre": "Piel y Fascia (Cicatriz Abdominal)", "argumento": "Cicatriz por cesárea observada en P2 que transfiere estrés tensional hacia la pared lumbopélvica." },
            { "nombre": "Sistema Endocrino (Tiroides)", "argumento": "Hipotiroidismo controlado reportado en P1.5, factor metabólico que puede ralentizar la reparación tisular." }
        ]
    },
    "estructuras_mas_afectan": "Disfunción mecánica sacroilíaca modulada por incompetencia del control motor lumbopélvico, ambiente protrombótico y tensión fascial abdominal." 
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
      { "funcion_disfuncion": "Dolor en región glútea derecha", "severidad": "Moderada", "fundamento": "EVA 6/10 durante examen físico P2", "dominio_sugerido": "Dolor" },
      { "funcion_disfuncion": "Irritabilidad mecánica baja", "severidad": "Leve", "fundamento": "Dolor calma rápidamente (<15 min) tras cese de actividad", "dominio_sugerido": "Dolor" },
      { "funcion_disfuncion": "Baja tolerancia a la carga (Sentadilla)", "severidad": "Severa", "fundamento": "Impotencia funcional tras 3 repeticiones en P2", "dominio_sugerido": "Carga" },
      { "funcion_disfuncion": "Debilidad de Glúteo Medio (Abducción)", "severidad": "Moderada", "fundamento": "Fuerza grado 3/5 contra gravedad en P2", "dominio_sugerido": "Fuerza" },
      { "funcion_disfuncion": "Déficit de balance monopodal derecho", "severidad": "Moderada", "fundamento": "Pérdida de equilibrio antes de 5 segundos en P2", "dominio_sugerido": "Control motor" },
      { "funcion_disfuncion": "Compensación de tronco (Trendelenburg)", "severidad": "Moderada", "fundamento": "Caída de pelvis contralateral durante la marcha en P2", "dominio_sugerido": "Control motor" },
      { "funcion_disfuncion": "Limitación de ROM Rotación Interna de Cadera", "severidad": "Moderada", "fundamento": "Restricción de 15 grados respecto al lado sano en P2", "dominio_sugerido": "Movilidad" },
      { "funcion_disfuncion": "Hipomovilidad articular lumbopélvica", "severidad": "Leve", "fundamento": "Restricción en movimientos accesorios sacros en P2", "dominio_sugerido": "Movilidad" },
      { "funcion_disfuncion": "Fatiga cardiopulmonar precoz", "severidad": "Leve", "fundamento": "Disnea grado 2 en escala de Borg ante esfuerzo mínimo", "dominio_sugerido": "Cardiovascular" },
      { "funcion_disfuncion": "Miedo al movimiento en escaleras", "severidad": "Leve", "fundamento": "Conducta evitativa observada durante evaluación funcional", "dominio_sugerido": "Psicosocial" }
    ] 
  },
  "actividad_y_participacion": {
    "limitaciones_directas": [
      { "texto": "Bajar escaleras sin apoyo", "severidad": "moderada", "detalle": "Dolor punzante que obliga a usar pasamanos." },
      { "texto": "Permanecer sentado > 30 min", "severidad": "moderada", "detalle": "Aparición de rigidez y dolor sordo lumbopélvico." },
      { "texto": "Correr a velocidades > 9 km/h", "severidad": "severa", "detalle": "Impotencia funcional por dolor en cara lateral de cadera." },
      { "texto": "Dormir sobre el lado derecho", "severidad": "leve", "detalle": "Despertar nocturno por compresión de la zona dolorosa." },
      { "texto": "Realizar estocadas profundas", "severidad": "completa", "detalle": "Evitación total por dolor insoportable 9/10." }
    ],
    "restricciones_participacion": [
      { "texto": "Desempeño Laboral Efectivo", "severidad": "moderada", "detalle": "Necesidad de pausas constantes; pérdida de foco por dolor." },
      { "texto": "Entrenamiento de Running (Grupo)", "severidad": "severa", "detalle": "Abandono temporal de la actividad que era su principal hobby." },
      { "texto": "Cuidado de hijos pequeños", "severidad": "moderada", "detalle": "Dificultad para cargarlos o jugar en el suelo con ellos." },
      { "texto": "Vida Sexual activa", "severidad": "leve", "detalle": "Limitación por dolor/miedo en ciertas posiciones de carga." }
    ]
  },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": ["Alta motivación intrínseca", "Buena adherencia a planes previos", "Resiliencia"], 
    "factores_personales_negativos": ["Estrés laboral crónico", "Mala calidad de sueño (interrumpido)", "Miedo a la cirugía"], 
    "facilitadores_ambientales": ["Red de apoyo familiar fuerte", "Acceso a gimnasio cerca de casa", "Seguro médico de cobertura total"], 
    "barreras_ambientales": ["Trabajo 100% sedentario", "Entorno laboral estresante", "Falta de ergonómica en casa"],
    "factores_clinicos_moduladores": ["Diabetes tipo 2 (afecta colágeno)", "Uso de estatinas (mialgias?)", "Cronicidad (> 6 meses)"],
    "observaciones_bps_integradas": "Paciente con perfil atlético pero atrapado en un ciclo de sedentarismo laboral y desregulación metabólica (Diabetes). La lesión biológica (SI) está cronificada por el ambiente pro-inflamatorio y el estrés, aunque su motivación es el motor principal de recuperación."
  },
  "recordatorios_y_coherencia": { 
    "recordatorios_clinicos": ["Vigilar glucemia post-ejercicio", "Evaluar calzado deportivo"], 
    "cosas_a_vigilar_en_treatment": ["Signos de alarma neurológica distal", "Aumento de irritabilidad"], 
    "faltantes_no_criticos": ["Falta test neurodinámico formal"], 
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
            promptVersion: 'v3.6.4',
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
