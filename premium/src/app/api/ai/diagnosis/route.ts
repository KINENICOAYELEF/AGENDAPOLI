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
  "snapshot_clinico": { "foco_principal": "", "lado": "", "irritabilidad_sugerida": "", "tolerancia_carga": { "nivel": "", "explicacion": "" }, "tarea_indice": "", "alertas_clinicas": [] },
  "clasificacion_dolor": { "opciones_categoria": [], "categoria_seleccionada": "", "opciones_subtipo_apellido": [], "subtipos_seleccionados": [], "subtipo_manual": "", "fundamento_breve": "", "nivel_confianza": "Alta|Media|Baja" },
  "sistema_y_estructuras": { "sistemas_principales": [], "estructuras_principales": [], "estructuras_secundarias": [], "descripcion_libre": "" },
  "alteraciones_detectadas": { "estructurales": [{ "texto": "", "certeza": "casi_confirmada|probable|posible|no_concluyente", "fundamento_breve": "" }], "functional": [{ "texto": "", "severidad": "leve|moderada|severa" }] },
  "actividad_y_participacion": { "limitaciones_directas": [{ "texto": "", "severidad": "leve|moderada|severa" }], "restricciones_participacion": [{ "texto": "", "severidad": "leve|moderada|severa" }] },
  "factores_biopsicosociales": { "factores_personales_positivos": [], "factores_personales_negativos": [], "facilitadores_ambientales": [], "barreras_ambientales": [], "antecedentes_msk_relevantes": [] },
  "recordatorios_y_coherencia": { "recordatorios_clinicos": [], "cosas_a_vigilar_en_tratamiento": [], "faltantes_no_criticos": [], "incoherencias_detectadas": [] }
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA (COMPACT CASE PACKAGE):
${normalizedPayload}
    `;

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\\n\\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v2.1',
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
