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
      {
        "funcion_disfuncion": "Regulación metabólica alterada por hipotiroidismo",
        "severidad": "Leve",
        "fundamento": "Antecedente de hipotiroidismo en P1.5. Puede afectar tasa de reparación tisular y niveles de energía.",
        "dominio_sugerido": "Metabólico"
      }
    ] 
  },
  "actividad_y_participacion": {
            // F1: Limitaciones de Actividad (Tareas motoras de P1 y P1.5)
            // CAPTURA TODO: Dormir, Caminar, Sentarse, Escaleras, Deporte, Yoga, Sexo, etc.
            "limitaciones_actividad": [
                { "actividad": "Estar sentado > 20 min", "severidad": "Moderada", "detalle": "Provoca dolor lumbar irradiado; requiere cambios de postura frecuentes." },
                { "actividad": "Caminar en terreno irregular", "severidad": "Leve", "detalle": "Inestabilidad percibida y fatiga rápida en tríceps sural." },
                { "actividad": "Sentadilla profunda (Gimnasio)", "severidad": "Severa", "detalle": "Dolor punzante en cara anterior de rodilla al inicio del ascenso." },
                { "actividad": "Dormir decúbito lateral izquierdo", "severidad": "Leve", "detalle": "Despierta por dolor sordo; usa almohada entre piernas como compensación." },
                { "actividad": "Subir escaleras (> 2 pisos)", "severidad": "Moderada", "detalle": "Requiere apoyo constante en pasamanos por falta de fuerza excéntrica." },
                { "actividad": "Mantener equilibrio monopodal", "severidad": "Moderada", "detalle": "Oscilaciones marcadas; miedo a la caída reportado en P1.5." },
                { "actividad": "Cargar objetos > 5kg", "severidad": "Completa", "detalle": "Evitación total por miedo a reagravación del síntoma lumbar." },
                { "actividad": "Hacer running (Tolerancia)", "severidad": "Moderada", "detalle": "Solo tolera 10 min antes de aparición de impotencia funcional." },
                { "actividad": "Manejar automóvil", "severidad": "Leve", "detalle": "Molestia al presionar embrague en trayectos largos." },
                { "actividad": "Agacharse a recoger objetos", "severidad": "Moderada", "detalle": "Realiza compensación con flexión de cadera marcada para evitar tronco." }
            ],
            // F2: Restricciones de Participación (Roles en P1.5 y Contexto P2)
            // INFIERE: Si duele sentado, afecta TRABAJO. Si duele correr, afecta DEPORTE.
            "restricciones_participacion": [
                { "rol_contexto": "Desempeño Laboral (Oficina)", "severidad": "Moderada", "detalle": "Productividad disminuida por dolor al estar sentado; requiere pausas no programadas cada 15 min." },
                { "rol_contexto": "Práctica Deportiva (Crossfit/Fútbol)", "severidad": "Severa", "detalle": "Incapacidad de participar en entrenamientos grupales; aislamiento del grupo social deportivo." },
                { "rol_contexto": "Vida Doméstica (Aseo/Cunas)", "severidad": "Moderada", "detalle": "Dificultad para levantar a su hijo o realizar limpieza profunda del hogar." },
                { "rol_contexto": "Traslado en transporte público", "severidad": "Leve", "detalle": "Inseguridad al viajar de pie; preferencia por horarios de baja afluencia." },
                { "rol_contexto": "Recreación / Vida Social", "severidad": "Moderada", "detalle": "Evita salidas que impliquen caminatas largas u organizar eventos de pie." },
                { "rol_contexto": "Vida Sexual", "severidad": "Leve", "detalle": "Limitación en ciertas posiciones por dolor/miedo al movimiento (Kinesiofobia)." },
                { "rol_contexto": "Autocuidado (Vestido/Calzado)", "severidad": "Moderada", "detalle": "Requiere ayuda o silla para ponerse calcetines/zapatos." },
                { "rol_contexto": "Rol Familiar (Cuidado dependiente)", "severidad": "Leve", "detalle": "Menor paciencia/energía por dolor crónico mantenido." }
            ]
        },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": ["Motivación alta para rehabilitación (G1)", "Experiencia deportiva previa (G1)", "Autoeficacia percibida alta (G1)"], 
    "factores_personales_negativos": ["Mala calidad de sueño (G2)", "Tendencia leve a evitación por miedo (G2)", "Hipotiroidismo de base (G2)", "Nivel de estrés laboral elevado (G2)"], 
    "facilitadores_ambientales": ["Acceso a gimnasio de alta calidad (G3)", "Red de apoyo familiar sólida y colaboradora (G3)", "Lugar de trabajo permite pausas ergonómicas (G3)"], 
    "barreras_ambientales": ["Trabajo sedentario prolongado (>8h) (G4)", "Escaleras obligatorias en domicilio sin ascensor (G4)", "Tiempo limitado por cuidado de hijos (G4)"],
    "factores_clinicos_moduladores": ["Uso de levotiroxina crónica (G5)", "Antecedente de 3 fallos en kinesiología previa (G5)", "Fumador social (G5)"],
    "observaciones_bps_integradas": "Paciente con perfil atlético y motivado (G1), pero con barreras ambientales críticas como el sedentarismo laboral (G4) y factores metabólicos (G2/G5) que podrían ralentizar la velocidad de reparación tisular."
  },
  "recordatorios_y_coherencia": { "recordatorios_clinicos": ["Monitorear presión arterial durante ejercicio por HTA"], "cosas_a_vigilar_en_tratamiento": ["Dolor nocturno: si aumenta, derivar", "After-effect post-sesión: no debe superar 2h"], "faltantes_no_criticos": ["Falta evaluación formal de balance unipodal"], "incoherencias_detectadas": [] }
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
            promptVersion: 'v3.6.2',
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
