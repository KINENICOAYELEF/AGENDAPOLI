import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología musculoesquelética y deportiva, con foco en:
- razonamiento clínico MSK
- clasificación del dolor
- irritabilidad
- descarte de red flags
- generación de hipótesis orientativas
- orientación de examen físico
- utilidad docente para internos
- lenguaje clínico riguroso pero sin sobrediagnóstico

NO DEBES BAJO NINGUNA CIRCUNSTANCIA:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir excesivamente largo, texto relleno o párrafos barrocos
- Inventar hipótesis sin fundamento
- Repetir de forma redundante todo lo que dijo la persona usuaria
- Pedir más de 5 preguntas faltantes
- Incluir salida narrativa adicional fuera del JSON solicitado

TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VÁLIDO QUE CUMPLA CON LA ESTRUCTURA EXACTA. Piensa primero en descartar cuadros graves y luego en acercarte a confirmar tus hipótesis. Debe orientar el examen físico por módulos, no en bloque general. Debe ser especialmente bueno razonando irritabilidad, naturaleza del dolor y qué examen físico aporta realmente.
`;

// FUNCIÓN DE SANITIZACIÓN ROBUSTA (FASE 13)
function sanitizeClinicalTextForBlockedRetry(text: string): string {
    if (!text) return "";
    let sanitized = text;

    // 1. Manejo analgésico físico previo
    sanitized = sanitized.replace(/\b(tens|t\.e\.n\.s|ultrasonido|magnetoterapia|laser|láser|corrientes|electroterapia|electroanalgesia|fisioterapia|kinesiolog[ií]a previa|masaje|punci[oó]n|ondas de choque)\b/gi, "manejo analgésico físico previo");

    // 2. Analgésico de uso común 
    sanitized = sanitized.replace(/\b(paracetamol|ibuprofeno|ketorolaco|ketoprofeno|diclofenaco|naproxeno|meloxicam|celecoxib|etoricoxib|aspirina|viadil|tapsin|antiinflamatorio|antiinflamatorios)\b/gi, "antiinflamatorio o analgésico previo");

    // 3. Tratamiento farmacológico previo genérico
    sanitized = sanitized.replace(/\b(medicamento|medicamentos|medicaci[oó]n|pastillas|pastilla|remedios?|f[aá]rmacos?|relajante muscular|ciclobenzaprina|tramadol|pregabalina|gabapentina|corticoides?)\b/gi, "tratamiento farmacológico previo");

    // 4. Procedimientos previos
    sanitized = sanitized.replace(/\b(infiltraci[oó]n|filiaci[oó]n|cirug[ií]a|operaci[oó]n|inyecci[oó]n|bloqueo facetario)\b/gi, "procedimiento quirúrgico/mínimamente invasivo previo");

    return sanitized;
}

// BANNED WORDS LIST: Validación pre-retry
const BANNED_RETRY_WORDS = [
    "tens", "paracetamol", "ketoprofeno", "ibuprofeno", "diclofenaco", 
    "medicamento", "medicación", "fármaco", "pastilla", "tramadol"
];

export async function POST(req: Request) {
    let useSanitizedGlobal = false;
    try {
        const body = await req.json();
        const { payload, useSanitized } = body;
        useSanitizedGlobal = !!useSanitized;

        if (!payload) {
            return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
        }

        let normalizedPayload = normalizePayload(payload);
        let wasSanitized = false;
        let sanitizationFailed = false;

        // SANITIZACIÓN CLÍNICA ESTRICTA (FASE 13)
        if (useSanitized) {
            wasSanitized = true;
            const originalPayload = normalizedPayload;
            normalizedPayload = sanitizeClinicalTextForBlockedRetry(normalizedPayload);
            
            // Truncar para evitar filtro por tamaño de contexto agresivo
            if (normalizedPayload.length > 3000) {
                normalizedPayload = normalizedPayload.substring(0, 3000) + "... [texto truncado en modo seguro]";
            }

            // Validación estricta pre-intento
            const lowerSanitized = normalizedPayload.toLowerCase();
            const containsBanned = BANNED_RETRY_WORDS.some(word => lowerSanitized.includes(word.toLowerCase()));

            if (containsBanned) {
                console.warn("[p1-synthesis] SANITIZATION_FAILED_PREVENTED_RETRY: El payload aún contiene palabras prohibidas.", { originalPayload, normalizedPayload });
                sanitizationFailed = true;

                // Forzamos salida de error con telemetría rica sin llamar a la IA
                return NextResponse.json({
                    success: false,
                    isBlocked: true,
                    blockedReason: "sanitization_failed_prevented_retry",
                    telemetry: {
                        modelUsed: null,
                        fallbackUsed: false,
                        attemptsCount: 0,
                        blockedReason: "sanitization_failed_prevented_retry",
                        sanitizedRetryUsed: true,
                        localFallbackUsed: false, // El componente React pondrá esto en true al recibir este error
                        inputHash: "prevented",
                        estimatedTokensInput: 0,
                        estimatedTokensOutput: 0
                    }
                });
            }
        }

        const inputHash = await generateSHA256(`p1-synthesis:${useSanitized ? 'sanitized' : 'raw'}:${normalizedPayload}`);

        const userPrompt = `
Genera la síntesis de P1 estructurada en json según las reglas. Responde de forma clínica, precisa y compacta.
DATOS CLÍNICOS ESTRUCTURADOS (ANAMNESIS Y MOTIVO DE CONSULTA):
${normalizedPayload}
        `;

        const result = await executeAIAction({
            screen: 'P1',
            action: 'P1_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0',
            temperature: 0.1, // Baja variabilidad
            validator: (data) => P1SynthesisSchema.parse(data)
        });

        // Añadir metadata a la telemetría de exito
        if (result.telemetry) {
            result.telemetry = {
                ...result.telemetry,
                sanitizedRetryUsed: wasSanitized,
                localFallbackUsed: false,
                attemptsCount: result.telemetry.fallbackUsed ? 2 : 1
            };
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            telemetry: result.telemetry || { sanitizedRetryUsed: wasSanitized, localFallbackUsed: false }
        });

    } catch (error: any) {
        console.error("Error en /api/ai/p1-synthesis:", error);

        // Catch explicitly OUTPUT_BLOCKED so we don't crash
        if (error.message?.includes('OUTPUT_BLOCKED') || error.message?.includes('SAFETY')) {
            return NextResponse.json({
                success: false,
                isBlocked: true,
                blockedReason: error.message,
                telemetry: {
                    modelUsed: null,
                    fallbackUsed: false,
                    attemptsCount: 1, // o 2 si trackearamos más profundo, pero el wrapper lo lanza cuando falla un modelo en la cadena
                    blockedReason: error.message,
                    sanitizedRetryUsed: useSanitizedGlobal,
                    localFallbackUsed: false,
                    inputHash: "blocked",
                    estimatedTokensInput: 0,
                    estimatedTokensOutput: 0
                }
            });
        }

        return NextResponse.json(
            { error: 'Error generating P1 synthesis', details: error.message },
            { status: 500 }
        );
    }
}
