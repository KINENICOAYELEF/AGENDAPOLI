import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { z } from 'zod';

const SmartObjectiveSchema = z.object({
    texto: z.string().describe("Objetivo SMART completo redactado de forma profesional"),
    plazo: z.enum(['1-2 sem', '3-4 sem', '5-8 sem', '9-12 sem', '>12 sem']).describe("Plazo temporal"),
    prioridad: z.enum(['Alta', 'Media', 'Baja']),
    variable_base: z.string().describe("Variable medible (EVA, ROM, MMT, PSFS, etc.)"),
    basal: z.string().describe("Valor inicial registrado"),
    meta: z.string().describe("Valor objetivo a alcanzar"),
});

const PilarSchema = z.object({
    titulo: z.string(),
    prioridad: z.number().int().min(1).max(5),
    justificacion: z.string(),
    objetivos_operacionales: z.array(z.string()),
    foco_que_aborda: z.array(z.string()),
});

const ExpressPlanSchema = z.object({
    clasificacion_dolor: z.object({
        categoria: z.enum(['Nociceptivo', 'Neuropático', 'Nociplástico', 'Mixto']),
        subtipo: z.string().describe("Ej: Mecánico, Inflamatorio, Radicular, Isquémico, etc."),
        fundamento: z.string().describe("Por qué se clasifica así, basado en la anamnesis y evaluación"),
        confianza: z.enum(['Alta', 'Moderada', 'Baja']),
    }),
    diagnostico_narrativo: z.string().describe("Diagnóstico kinesiológico narrativo CIF: [nombre] presenta [deficiencias] que generan [limitaciones funcionales] y [restricciones de participación] en contexto de [factores contextuales]"),
    objetivo_general: z.string().describe("Objetivo general del tratamiento, orientado a la funcionalidad"),
    objetivos_smart: z.array(SmartObjectiveSchema).min(2).max(4).describe("2 a 4 objetivos SMART priorizados"),
    pronostico: z.object({
        corto_plazo: z.string().describe("Expectativa 0-4 semanas"),
        mediano_plazo: z.string().describe("Expectativa 4-12 semanas"),
        largo_plazo: z.string().describe("Expectativa >12 semanas"),
        factores_a_favor: z.array(z.string()).describe("Máximo 4 factores pronósticos favorables"),
        factores_en_contra: z.array(z.string()).describe("Máximo 4 factores pronósticos desfavorables"),
        historia_natural: z.string().describe("Evolución esperable sin tratamiento"),
        comparativa_adherencia: z.string().describe("Diferencia entre alta adherencia vs abandono precoz"),
        categoria: z.enum(['favorable', 'favorable con vigilancia', 'reservado', 'reservado dependiente', 'desfavorable', 'incierto']),
        justificacion: z.string().describe("Síntesis integradora del pronóstico"),
    }),
    pilares: z.array(PilarSchema).min(2).max(4).describe("2 a 4 pilares de intervención prioritarios"),
    reglas_reevaluacion: z.object({
        signo_comparable: z.string().describe("El signo o test más sensible al cambio para monitorear"),
        razon_signo: z.string().describe("Por qué se eligió este signo comparable"),
        variables_seguimiento: z.array(z.string()).describe("Lista de variables a medir en cada sesión o reevaluación"),
        frecuencia: z.string().describe("Frecuencia de reevaluación formal (ej: Cada 4 sesiones / Quincenal)"),
        criterio_mejora: z.string().describe("Qué cambio objetivo define mejora real"),
        criterio_estancamiento: z.string().describe("Qué situación activa cambio de enfoque o derivación"),
    }),
});

const SYSTEM_PROMPT = `Eres un kinesiólogo clínico especialista con enfoque biopsicosocial y razonamiento basado en evidencia. 
Tu tarea es analizar las notas clínicas de un estudiante de kinesiología (anamnesis, evaluación física y razonamiento previo generado por IA) y producir un plan clínico estructurado completo.

REGLAS CRÍTICAS:
1. Usa lenguaje profesional kinesiológico, no médico general.
2. El diagnóstico narrativo DEBE seguir la estructura CIF (deficiencias → limitaciones → restricciones → factores contextuales).
3. Los objetivos SMART deben ser medibles, realistas y con plazo definido.
4. Los pilares de intervención deben ser kinesiológicos (ejercicio, educación, terapia manual, neuromodulación, etc.), NO diagnósticos médicos.
5. El pronóstico debe ser clínicamente fundamentado, no genérico.
6. Clasifica el tipo de dolor con precisión (nociceptivo/neuropático/nociplástico/mixto) basándote en el comportamiento del síntoma.
7. El signo comparable debe ser el test o movimiento que MEJOR reproduce el síntoma principal y es más sensible al cambio.
8. TODO debe estar directamente justificado por los datos del caso, no en abstracto.`;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica } = body;

        const context = [
            razonamientoIA ? `## RAZONAMIENTO CLÍNICO IA PREVIO:\n${razonamientoIA}` : null,
            anamnesisProxima ? `## ANAMNESIS PRÓXIMA:\n${anamnesisProxima}` : null,
            anamnesisRemota ? `## ANAMNESIS REMOTA:\n${anamnesisRemota}` : null,
            evaluacionFisica ? `## EVALUACIÓN FÍSICA:\n${evaluacionFisica}` : null,
        ].filter(Boolean).join('\n\n---\n\n');

        if (!context.trim()) {
            return NextResponse.json({ error: 'No hay datos clínicos suficientes para generar el plan.' }, { status: 400 });
        }

        const userPrompt = `Analiza los siguientes datos clínicos y genera el plan diagnóstico y terapéutico completo en formato JSON:\n\n${context}`;

        const result = await executeAIAction({
            screen: 'EXPRESS_V2',
            action: 'EXPRESS_PLAN',
            systemInstruction: SYSTEM_PROMPT,
            userPrompt,
            inputHash: Buffer.from(context).length.toString(),
            promptVersion: 'v1.0.0',
            temperature: 0.25,
            responseMimeType: 'application/json',
            skipGuardrails: true,
            validator: (data: any) => {
                // Parse JSON if it comes back as string
                if (typeof data === 'string') {
                    const clean = data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                    return JSON.parse(clean);
                }
                return data;
            }
        });

        return NextResponse.json({ data: result.data, telemetry: result.telemetry });
    } catch (error: any) {
        console.error('[express-plan] Error:', error);
        return NextResponse.json({ message: error.message || 'Error generando plan clínico' }, { status: 500 });
    }
}
