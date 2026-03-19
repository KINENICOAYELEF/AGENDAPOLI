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
    "sistemas_involucrados": ["musculoesquelético articular"], 
    "estructuras": {
        "principales": [{ "nombre": "Articulación Sacroilíaca", "argumento": "Reproducción de síntomas en test de Laslett y reporte de dolor profundo en P1." }],
        "secundarias": [{ "nombre": "Ligamentos Sacroilíacos", "argumento": "Sensibilidad exquisita a la palpación profunda en examen físico P2." }],
        "asociadas_moduladoras": [{ "nombre": "Segmentos L4-L5", "argumento": "Antecedente de discopatía en expediente que podría modular el síntoma referido." }]
    },
    "estructuras_mas_afectan": "Disfunción de carga e irritabilidad ligamentosa sacroilíaca con influencia lumbar." 
  },
  "alteraciones_detectadas": { 
    "estructurales": [
      { "estructura_involucrada": "Ligamentos Sacroilíacos", "alteracion_sospecha": "Disfunción mecánica", "certeza": "probable", "fundamento_clinico": "Palpación dolorosa y tests de provocación positivos." }
    ], 
    "functional": [{ "texto": "Limitación en la carga de peso monodal", "severidad": "moderada" }] 
  },
  "actividad_y_participacion": { "limitaciones_directas": [{ "texto": "Caminar tramos largos", "severidad": "moderada" }], "restricciones_participacion": [{ "texto": "Vida laboral", "severidad": "leve" }] },
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
            promptVersion: 'v3.2.2',
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
