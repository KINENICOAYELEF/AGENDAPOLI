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

// FUNCIÓN DE SANITIZACIÓN ROBUSTA (FASE 14) - Siempre Activa
function sanitizeInterviewPayloadForGemini(text: string): string {
    if (!text) return "";
    let sanitized = text;

    sanitized = sanitized.replace(/\b(tens|t\.e\.n\.s|ultrasonido|magnetoterapia|laser|láser|corrientes|electroterapia|electroanalgesia|fisioterapia|kinesiolog[ií]a previa|masaje|punci[oó]n|ondas de choque|electroestimulaci[oó]n)\b/gi, "manejo físico analgésico previo");
    sanitized = sanitized.replace(/\b(paracetamol|aspirina|viadil|tapsin)\b/gi, "analgésico de uso común");
    sanitized = sanitized.replace(/\b(ibuprofeno|ketorolaco|ketoprofeno|diclofenaco|naproxeno|meloxicam|celecoxib|etoricoxib|antiinflamatorio|antiinflamatorios)\b/gi, "antiinflamatorio previo");
    sanitized = sanitized.replace(/\b(medicamento|medicamentos|medicaci[oó]n|pastillas|pastilla|remedios?|f[aá]rmacos?)\b/gi, "tratamiento farmacológico previo");
    sanitized = sanitized.replace(/\b(tramadol)\b/gi, "analgésico previo");
    sanitized = sanitized.replace(/\b(relajante muscular|ciclobenzaprina|pregabalina|gabapentina|corticoides?)\b/gi, "medicación previa");
    sanitized = sanitized.replace(/\b(infiltraci[oó]n|filiaci[oó]n|cirug[ií]a|operaci[oó]n|inyecci[oó]n|bloqueo facetario)\b/gi, "procedimiento previo");

    return sanitized;
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { payload } = body;

        if (!payload || !payload.interviewV4) {
            return NextResponse.json({ error: 'Missing payload or interviewV4 data' }, { status: 400 });
        }

        const v4 = payload.interviewV4;
        
        // 1. CONSTRUIR PAYLOAD COMPACTO (FASE 14)
        const p1_ai_input_compact = {
            motivo_consulta: v4.motivoDeConsulta || "",
            relato_libre: v4.experienciaPersona?.relatoLibre || "",
            dolor_actual: v4.mapaCorporal?.detalles || [],
            comportamiento_24h: {
                manana: v4.comportamiento24h?.manana || "",
                dia: v4.comportamiento24h?.dia || "",
                noche: v4.comportamiento24h?.noche || ""
            },
            agravantes: v4.comportamiento24h?.agravantes || [],
            alivios: v4.comportamiento24h?.aliviadores || [],
            mecanismo_inicio: v4.historiaCondicion?.tipoInicio || "",
            irradiacion_si_existe: v4.historiaCondicion?.sintomasRadiculares || "",
            limitaciones_funcionales_referidas: [v4.resumenLimitaciones, v4.resumenRestricciones].filter(Boolean).join(" | "),
            banderas_rojas_marcadas: v4.seguridad?.detalleBanderas || "",
            factores_contextuales_basicos: {
                bps: v4.bps,
                laboral: v4.contextoLaboral?.barrerasDetalles || []
            }
        };

        // SANITIZACIÓN CLÍNICA ESTRICTA E INVISIBLE (FASE 14)
        const stringifiedPayload = JSON.stringify(p1_ai_input_compact);
        let normalizedPayload = sanitizeInterviewPayloadForGemini(stringifiedPayload);
        
        // Truncar preventivamente para no saturar tokens
        if (normalizedPayload.length > 4000) {
            normalizedPayload = normalizedPayload.substring(0, 4000) + "... [texto truncado]";
        }

        const inputHash = await generateSHA256(`p1-synthesis:auto:${normalizedPayload}`);

        const userPrompt = `
Genera la síntesis de P1 estructurada en json según las reglas. Responde de forma clínica, precisa y compacta.
DATOS CLÍNICOS ESTRUCTURADOS:
${normalizedPayload}
        `;

        try {
            // INTENTO 1
            const result = await executeAIAction({
                screen: 'P1',
                action: 'P1_SYNTHESIS',
                systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
                userPrompt,
                inputHash,
                promptVersion: 'v1.1',
                temperature: 0.1,
                validator: (data) => {
                    const parsed = P1SynthesisSchema.safeParse(data);
                    if (parsed.success) return parsed.data;
                    console.warn("[P1 Schema Intento 1] Resilient fallback parsing triggered:", parsed.error.issues);
                    return {
                        resumen_clinico_editable: data.resumen_clinico_editable || "",
                        resumen_persona_usuaria: data.resumen_persona_usuaria || { lo_que_entendi: "", lo_que_te_preocupa: "", lo_que_haremos_ahora: "" },
                        alicia: data.alicia || {},
                        sins: data.sins || {},
                        foco_principal: data.foco_principal || {},
                        hipotesis_orientativas: Array.isArray(data.hipotesis_orientativas) ? data.hipotesis_orientativas : [],
                        preguntas_faltantes: Array.isArray(data.preguntas_faltantes) ? data.preguntas_faltantes : [],
                        recomendaciones_p2_por_modulo: data.recomendaciones_p2_por_modulo || {},
                        factores_contextuales_clave: data.factores_contextuales_clave || { banderas_rojas: [], banderas_amarillas: [], facilitadores: [], barreras: [] }
                    };
                }
            });

            return NextResponse.json({
                success: true,
                data: result.data,
                telemetry: { ...result.telemetry, retryUsed: false }
            });

        } catch (error1: any) {
            console.warn("P1_SYNTHESIS Intento 1 fallido, ejecutando retry silencioso...", error1.message);

            // INTENTO 2 (SILENCIOSO Y AÚN MÁS COMPACTO)
            const ultraCompactPayload = {
                relato: v4.experienciaPersona?.relatoLibre || "",
                motivo: v4.motivoDeConsulta || "",
                dolor: v4.mapaCorporal?.detalles || []
            };
            
            let retryPayload = sanitizeInterviewPayloadForGemini(JSON.stringify(ultraCompactPayload));
            if (retryPayload.length > 2000) {
                retryPayload = retryPayload.substring(0, 2000) + "...";
            }

            const retryPrompt = `
Genera síntesis clínica P1 en JSON estricto. Usa strings vacíos si falta info. Sé extremadamente breve.
DATOS:
${retryPayload}
            `;

            try {
                const retryResult = await executeAIAction({
                    screen: 'P1',
                    action: 'P1_SYNTHESIS',
                    systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
                    userPrompt: retryPrompt,
                    inputHash: inputHash + "-retry",
                    promptVersion: 'v1.1-retry',
                    temperature: 0.1,
                    validator: (data) => {
                        const parsed = P1SynthesisSchema.safeParse(data);
                        if (parsed.success) return parsed.data;
                        console.warn("[P1 Schema Intento 2] Resilient fallback parsing triggered:", parsed.error.issues);
                        return {
                            resumen_clinico_editable: data.resumen_clinico_editable || "",
                            resumen_persona_usuaria: data.resumen_persona_usuaria || { lo_que_entendi: "", lo_que_te_preocupa: "", lo_que_haremos_ahora: "" },
                            alicia: data.alicia || {},
                            sins: data.sins || {},
                            foco_principal: data.foco_principal || {},
                            hipotesis_orientativas: Array.isArray(data.hipotesis_orientativas) ? data.hipotesis_orientativas : [],
                            preguntas_faltantes: Array.isArray(data.preguntas_faltantes) ? data.preguntas_faltantes : [],
                            recomendaciones_p2_por_modulo: data.recomendaciones_p2_por_modulo || {},
                            factores_contextuales_clave: data.factores_contextuales_clave || { banderas_rojas: [], banderas_amarillas: [], facilitadores: [], barreras: [] }
                        };
                    }
                });

                return NextResponse.json({
                    success: true,
                    data: retryResult.data,
                    telemetry: { ...retryResult.telemetry, retryUsed: true }
                });

            } catch (error2: any) {
                console.error("P1_SYNTHESIS Intento 2 (Retry) también fallido:", error2.message);
                
                // Ambos intentos fallaron. Devolver error simple a UI.
                return NextResponse.json({
                    success: false,
                    error: "No se pudo procesar la síntesis clínica en este intento.",
                    details: error2.message
                });
            }
        }
    } catch (globalError: any) {
        console.error("Error global en /api/ai/p1-synthesis:", globalError);
        return NextResponse.json(
            { error: 'Error processing request', details: globalError.message },
            { status: 500 }
        );
    }
}
