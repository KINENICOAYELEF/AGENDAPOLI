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
REGLA DURA 4: Devuelve SOLO un objeto JSON. No texto antes ni después.
REGLA DURA 5: No uses comillas sin escapar dentro de strings.
REGLA DURA 6: No agregues campos no solicitados.
REGLA DURA 7: Si falta info, debes usar: 'No_mencionado' o 'No_concluyente'.
REGLA DURA 8: La Naturaleza del dolor debes indicarla solo como 'posible [naturaleza]' (p. ej. posible nociceptivo) y puede ser múltiple si hay evidencia de más de una.
Tu respuesta debe ajustarse EXACTAMENTE a este esquema JSON:
{
    "resumen_clinico": "string, 1 párrafo. Resume el cuadro completo de forma profesional.",
    "resumen_persona_usuaria": {
        "lo_que_entiendi": "string resumen amigable para el paciente",
        "lo_que_te_preocupa": "string",
        "lo_que_haremos_ahora": "string"
    },
    "ALICIA": {
        "antiguedad_inicio": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" },
        "localizacion_extension": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" },
        "irradiacion_referencia": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" },
        "caracter_naturaleza_descriptores": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" },
        "intensidad": {
            "actual": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "peor_24h": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "mejor_24h": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "en_actividad_indice": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" }
        },
        "atenuantes": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" },
        "agravantes": { "valor": "texto", "evidencia_textual": "cita_exacta_o_No_mencionado", "origen": "relato" }
    },
    "SINS": {
        "severidad": { "valor": "texto descriptivo corto + [Baja|Media|Alta]", "evidencia_textual": "cita_o_No_mencionado", "origen": "calculado" },
        "irritabilidad": {
            "facilidad_provocacion": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "momento_aparicion": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "tiempo_a_calmarse": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "after_efecto": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
            "irritabilidad_global": { "valor": "[Baja|Media|Alta]", "evidencia_textual": "No_mencionado", "origen": "calculado" },
            "explicacion": "string explicando tu calculo de irritabilidad"
        },
        "naturaleza_sugerida": { "valor": "[Nociceptivo|Neuropatico|Nociplastico|Mixto|No_mencionado]", "evidencia_textual": "cita_o_No_mencionado", "origen": "calculado" },
        "etapa": { "valor": "[Agudo|Subagudo|Persistente|No_mencionado]", "evidencia_textual": "cita_o_No_mencionado", "origen": "calculado" }
    },
    "extraccion_general": {
        "motivo_en_palabras": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "objetivo_expectativa_plazo": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "historia_mecanismo": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "comportamiento_24h": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "limitaciones_funcionales": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "actividad_indice": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "anclas" },
        "psfs": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "anclas" },
        "capacidad_percibida": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "anclas" },
        "manejo_previo_y_respuesta": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "seguridad_mencionada_en_relato": { "valor": "texto", "evidencia_textual": "cita_o_No_mencionado", "origen": "relato" },
        "banderas_amarillas_orientativas": ["lista de strings (puede ser vacia)"]
    },
    "hipotesis_orientativas_por_sistema": [
        { "nombre": "ej: relacionado_a_carga", "explicacion": "...", "evidencia_textual": "cita_exacta" }
    ],
    "preguntas_faltantes": [
        { "tema_faltante": "...", "como_preguntarlo": "...", "por_que_importa": "..." }
    ],
    "sugerencias_examen_fisico_P2": [
        { "paso": "acción concreta", "por_que": "1 línea", "objetivo": "descartar|confirmar|cuantificar" }
    ]
}
Recuerda: Si falta información o un ítem no se describe, en TODOS los valores donde sea posible, devolver "No_mencionado".
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

Por favor, procede a hacer la extracción a JSON.`;

        const result = await geminiClient.generateStructuredObject({
            schema: null, // we ask for raw JSON text structured this way inside the prompt
            systemMessage: systemPromo,
            userMessage: userPrompt,
            temperature: 0.1, // STRICT from prompt
            topP: 0.8,
            topK: 40
        });

        return NextResponse.json(result);
    } catch (e: any) {
        console.error("Error en FASE 7 extract:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
