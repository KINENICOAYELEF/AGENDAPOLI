import { NextResponse } from 'next/server';
import { geminiClient } from '@/lib/ai/geminiClient';
import { AnamnesisProximaV4 } from '@/types/clinica';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { interviewV4 } = data as { interviewV4: AnamnesisProximaV4 };

        const systemPromo = `Eres un asistente clínico experto en extracción de datos.
Tú tarea es extraer la información solicitada de una entrevista clínica no estructurada o semi estructurada.
REGLA DURA 1: PROHIBIDO inventar o alucinar datos. Si algo no está explícito en el texto entregado, DEBES devolver el string exacto "No_mencionado".
REGLA DURA 2: Cada campo extraído que lo pida, debe incluir la llave 'evidencia_textual' que debe ser una CITA EXACTA copiada literalmente del texto entregado, como substring idéntico. Cero parafraseo en la cita.
REGLA DURA 3: No realices diagnósticos médicos, no sugieras fármacos, y no afirmes que pruebas físicas se han realizado a menos que el texto diga explícitamente que ya se hicieron.
REGLA DURA 4: Devuelve únicamente JSON ESTRICTO válido. No agregues preámbulos ni comillas (\`\`\`json).
Tu respuesta debe ajustarse EXACTAMENTE a este esquema JSON:
{
    "preguntas_faltantes": [
        { "tema_faltante": "...", "como_preguntarlo": "...", "por_que_importa": "..." }
    ]
}
Recuerda: Máximo 5 preguntas. Si falta información o un ítem no se describe, en TODOS los valores donde sea posible, devolver "No_mencionado".
No devuelvas NADA MÁS QUE EL STRING JSON VÁLIDO. Tu respuesta debe comenzar con "{" y terminar con "}".`;

        const userPrompt = `A continuación te presento los datos estructurados y el Relato Libre de la persona.
-- RELATO LIBRE --
${interviewV4.experienciaPersona.relatoLibre || 'No hay relato libre provisto.'}
----------------

-- QUEJAS PRINCIPALES --
Quejas asociadas: ${interviewV4.experienciaPersona.quejas?.join(', ')}
Queja otro: ${interviewV4.experienciaPersona.quejaOtro}

-- ESTADOS DE SEGURIDAD CLÍNICA --
Seguridad Confirmada en UI: ${interviewV4.seguridad?.confirmado}
Detalle Banderas: ${interviewV4.seguridad?.detalleBanderas || 'Ninguno'}
Banderas Activas: ${Object.entries(interviewV4.seguridad || {}).filter(([k, v]) => typeof v === 'boolean' && v && k !== 'confirmado').map(([k, v]) => k).join(', ')}

-- ANCLAS MÍNIMAS (FOCOS) --
Focos: ${JSON.stringify(interviewV4.focos, null, 2)}
Limitación Funcional: ${interviewV4.hayLimitacionFuncional}
PSFS Global: ${JSON.stringify(interviewV4.psfsGlobal, null, 2)}
Capacidad Percibida: ${interviewV4.capacidadPercibidaActividad}
Contextos: ${interviewV4.contextosAnclas?.join(', ')}
Objetivo Persona: ${interviewV4.objetivoPersona}
Plazo Esperado: ${interviewV4.plazoEsperado}

Por favor, procede a extraer SOLO las preguntas_faltantes (máximo 5).`;

        const result = await geminiClient.generateStructuredObject({
            schema: null,
            systemMessage: systemPromo,
            userMessage: userPrompt,
            temperature: 0.1,
            topP: 0.8,
            topK: 40
        });

        return NextResponse.json(result);
    } catch (e: any) {
        console.error("Error en FASE 13 preguntas:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
