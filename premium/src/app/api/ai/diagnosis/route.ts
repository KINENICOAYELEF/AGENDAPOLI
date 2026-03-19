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
      "ocupacion": "Administrativo o Estudiante (Sedentario)", 
      "deporte_actividad": "Running 3v/sem (Amateur)", 
      "demanda_fisica": "Baja en oficina, Alta en cerro", 
      "ayudas_tecnicas": ""
    },
    "factores_relevantes": { 
      "comorbilidades": ["HTA controlada"], 
      "medicamentos": ["Losartán 50mg"], 
      "antecedentes_msk": ["Fractura de peroné hace 10 años"], 
      "observaciones_seguridad": ["Fatiga cardiovascular moderada al esfuerzo"] 
    },
    "foco_y_lado": "Rodilla Derecha", 
    "irritabilidad_sugerida": "Media",
    "tolerancia_carga": { "nivel": "Baja", "explicacion": "Dolor > 4/10 al trotar > 2km." },
    "tarea_indice": "Bajar escaleras",
    "alertas_clinicas": ["Dolor nocturno leve"]
  },
  "clasificacion_dolor": { "categoria": "nociceptivo|neuropático|nociplástico|mixto|no_concluyente", "subtipos": ["Mecánico", "Inflamatorio"], "subtipo_manual": "", "fundamento": { "apoyo": [], "duda_mezcla": [], "conclusion": "" }, "nivel_confianza": "Alta|Media|Baja" },
  "sistema_y_estructuras": { 
    "sistemas_involucrados": ["musculoesquelético articular", "neuromuscular", "cardiovascular", "tegumentario"], 
    "estructuras": {
        "principales": [{ "nombre": "Articulación Sacroilíaca", "argumento": "Existe una reproducción fidedigna del dolor principal (>7/10) al aplicar el cluster de provocación ortopédica de Laslett durante la examinación física de P2. Esto cruza perfectamente con la anamnesis en P1, donde el paciente describe un dolor profundo glúteo de carácter mecánico y tirante, originado inicialmente al levantar carga pesada asimétrica." }],
        "secundarias": [{ "nombre": "Ligamentos Sacroilíacos Dorsales", "argumento": "A la palpación directa en la consulta (P2) se detectó sensibilidad exquisita circunscrita a la banda ligamentosa. Además, en la historia clínica P1.5 existe el antecedente de laxitud pélvica post-parto que mantiene un ambiente de inestabilidad basal, lo cual cuadra con la respuesta biológica reactiva actual ante los tests de cizalla." }],
        "asociadas_moduladoras": [
            { "nombre": "Corazón y Vasos Sanguíneos", "argumento": "El paciente documenta hipertensión arterial crónica en sus antecedentes clínicos base, lo que exige registrar una afección sistémica que impacta negativamente sobre la microperfusión, la respuesta inflamatoria y la sensibilidad central ante el dolor persistente sacroilíaco expresado en P1, actuando como limitante de reparación histológica autónoma." },
            { "nombre": "Piel y Fascia (Cicatriz Abdominal)", "argumento": "En la historia y examen físico (P2) se reporta y observa una cicatriz por cesárea en la cavidad abdominal baja, tejido que transfiere estrés tensional hacia la pared lumbopélvica alterando el juego articular de la pelvis durante la marcha y provocando sobrecarga secundaria hacia posterior, modulando el cuadro base." }
        ]
    },
    "estructuras_mas_afectan": "Disfunción mecánica y cizalla de la articulación sacroilíaca severamente modulada por incompetencia del control motor lumbopélvico, ambiente protrombótico subyacente y tensión fascial abdominal." 
  },
  "alteraciones_detectadas": { 
    "estructurales": [
      { 
        "estructura": "Articulación Sacroilíaca Derecha", 
        "alteracion": "Disfunción mecánica por inestabilidad / Cizalla reactiva", 
        "certeza": "Probable", 
        "fundamento": "Reproducción fidedigna del dolor principal (>7/10) al aplicar el cluster de provocación ortopédica de Laslett durante P2, coincidiendo con el mecanismo de carga asimétrica reportado en P1.",
        "impacto_caso": "Mucho"
      },
      {
        "estructura": "Sistema Cardiovascular / Arterias",
        "alteracion": "Hipertensión Arterial Sistémica (HTA)",
        "certeza": "Casi confirmada",
        "fundamento": "Antecedente médico directo en P1.5 (Anamnesis Remota) con uso de Losartán, lo que condiciona la microperfusión tisular y la respuesta inflamatoria persistente.",
        "impacto_caso": "Poco"
      }
    ], 
    "funcionales": [
      { 
        "funcion_disfuncion": "Limitación severa en transferencia de carga monodal", 
        "severidad": "Severa",
        "fundamento": "Incapacidad de realizar apoyo unipodal sin dolor exacerbado observada en P2.",
        "dominio_sugerido": "Carga"
      },
      {
        "funcion_disfuncion": "Déficit de control motor lumbopélvico",
        "severidad": "Moderada",
        "fundamento": "Compensación con rigidez costal durante tarea índice de flexión frontal en P2.",
        "dominio_sugerido": "Control motor"
      }
    ] 
  },
  "actividad_y_participacion": { "limitaciones_directas": [{ "texto": "Subir y bajar escaleras pesadas", "severidad": "alta" }], "restricciones_participacion": [{ "texto": "Running amateur", "severidad": "moderada" }] },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": [], 
    "factores_personales_negativos": [], 
    "facilitadores_ambientales": [], 
    "barreras_ambientales": [] 
  },
  "recordatorios_y_coherencia": { "recordatorios_clinicos": [], "cosas_a_vigilar_en_tratamiento": [], "faltantes_no_criticos": [], "incoherencias_detectadas": [] }
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
            promptVersion: 'v3.3.3',
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
