import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { AnamnesisProximaV4 } from '@/types/clinica';

export async function POST(req: Request) {
    try {
        const data = await req.json();
        const { interviewV4, remoteHistorySnapshot } = data as { interviewV4: AnamnesisProximaV4, remoteHistorySnapshot?: any };

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

-- CONTEXTO BASAL REMOTO --
${remoteHistorySnapshot ?
                `- Comorbilidades / Consideraciones: ${remoteHistorySnapshot.medicalHistory?.clinicalConsiderations || 'Ninguna explícita'}
- Diagnósticos Previos: ${remoteHistorySnapshot.medicalHistory?.diagnoses?.map((d: any) => d.name).join(', ') || 'Normal'}
- Cirugías Previas: ${remoteHistorySnapshot.medicalHistory?.surgeries?.map((s: any) => s.name).join(', ') || 'Ninguna'}
- Trastornos u Otras Enfermedades: ${remoteHistorySnapshot.medicalHistory?.chronicDiseases?.map((d: any) => d.name).join(', ') || 'Ninguna'}
- Fármacos/Medicamentos relevantes: ${remoteHistorySnapshot.medicalHistory?.medications?.map((m: any) => m.name).join(', ') || 'Sin información o no relevantes'}
- Antecedentes Musculoesqueléticos Previos (MSK): ${remoteHistorySnapshot.mskHistory?.previousInjuries?.map((i: any) => i.region).join(', ') || 'Sin historial'} / Recurrencias: ${remoteHistorySnapshot.mskHistory?.recurrenceHistory ? 'Sí' : 'No reportadas'}
- Ocupación y Demandas: ${remoteHistorySnapshot.occupationalContext?.role || 'No especificada'} (Demandas físicas: ${remoteHistorySnapshot.occupationalContext?.physicalDemands?.join(', ') || 'Ninguna'})
- Deporte y Carga Basal: ${remoteHistorySnapshot.baseActivity?.mainSport || 'Sedentario'} (Nivel: ${remoteHistorySnapshot.baseActivity?.level || 'N/A'})
- Factores de Riesgo / BPS e Historial de Adherencia: Calidad sueño (${remoteHistorySnapshot.bpsContext?.sleepQuality || 'N/A'}), Estrés basal (${remoteHistorySnapshot.bpsContext?.stressLevel || 'N/A'}), Adherencia previa (Barreras: ${remoteHistorySnapshot.occupationalContext?.adherenceBarriers || 'Ninguna descrita'})
` : 'Sin antecedentes remotos basales registrados en plataforma.'}

Por favor, procede a extraer SOLO las preguntas_faltantes (máximo 5). Evita preguntar por información que el usuario ya entregó implícita o explícitamente en el CONTEXTO BASAL REMOTO (ej. si allí ya se indica su deporte principal, no lo preguntes).`;

        const inputHash = await generateSHA256(`f13-questions:${JSON.stringify(interviewV4)}:${JSON.stringify(remoteHistorySnapshot)}`);

        const result = await executeAIAction({
            screen: 'P1',
            action: 'P1_QUESTIONS',
            systemInstruction: systemPromo,
            userPrompt: userPrompt,
            inputHash,
            promptVersion: 'v1.1',
            temperature: 0.1,
            validator: (data) => data
        });

        return NextResponse.json({ ...result.data, _telemetry: result.telemetry });
    } catch (e: any) {
        console.error("Error en FASE 13 preguntas:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
