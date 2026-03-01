import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Instanciación "Lazy" para que el Build de Next (Vercel) no colapse si las claves no están inyectadas
let aiClient: GoogleGenAI | null = null;
const getAIClient = () => {
    if (!aiClient) aiClient = new GoogleGenAI({});
    return aiClient;
};

export const dynamic = 'force-dynamic'; // FASE 2.1.28 - Previene crash estático en Vercel Build

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, context } = body;

        if (!action || !context) {
            return NextResponse.json({ error: 'Missing action or context' }, { status: 400 });
        }

        let systemInstruction = "";
        let prompt = `CONTEXTO CLÍNICO ACTUAL:\n${JSON.stringify(context, null, 2)}\n\n`;

        const baseRole = "Eres un Kinesiólogo experto clínico deportivo y musculoesquelético con foco biopsicosocial y ejercicio terapéutico. MUY IMPORTANTE: Analiza siempre el 'Motivo de Ingreso' y las 'Evaluaciones' del paciente provistos en el contexto, y correlaciónalos de cerca con el historial de evoluciones anteriores para dar una respuesta con lógica clínica y coherencia temporal.";

        switch (action) {
            case 'generarObjetivoSesion':
                systemInstruction = `${baseRole} Basado en el gran contexto provisto, sugiere un objetivo operativo pragmático para la sesión de HOY en máximo 1 o 2 oraciones concisas. Responde SOLO con el texto propuesto. Debe ser útil y correlacionado con sus déficits iniciales y estado actual (ej: 'Mejorar tolerancia a la carga axial en 60 grados de flexión y reeducar control motor bajo fatiga').`;
                prompt += "Genera el OBJETIVO OPERATIVO para esta sesión.";
                break;
            case 'generarPlanProximaSesion':
                systemInstruction = `${baseRole} Describe brevemente qué elementos deberían priorizarse para la PRÓXIMA sesión basándote en la evolución general del proceso, lo que se hizo hoy y el dolor reportado. Usa un tono imperativo clínico, redactando entre 2 a 4 líneas continuas o puntos seguidos. Sé quirúrgico y asertivo.`;
                prompt += "Genera la PLANIFICACIÓN para la PRÓXIMA sesión.";
                break;
            case 'generarHandoffInterColega':
                systemInstruction = `${baseRole} Estás haciendo un traspaso a un colega (Hand-off). Sintetiza la progresión del proceso (evaluación inicial vs estado actual) e hila con los hallazgos críticos de hoy resumidos en exactamente 3 bullets (con guion). Foco en: Alertas biopsicosociales, progresiones logradas y variaciones atípicas de dolor. Redacta solo los 3 viñetas.`;
                prompt += "Genera el HAND-OFF (Traspaso) clínico en 3 viñetas críticas.";
                break;
            // --- FASE 2.2: EVALUACIONES INICIALES Y REEVALUACIONES ---
            case 'generarSintesisEvaluacion':
                systemInstruction = `${baseRole} Eres un redactor clínico experto. Lee la entrevista subjetiva, las red flags y el examen físico objetivo de los motivos de consulta provistos en el contexto. Redacta un SOLO párrafo integrador (Síntesis Biopsicosocial) que resuma la presentación clínica, factores agravantes/limitantes principales y la severidad/irritabilidad sin mencionar datos irrelevantes.`;
                prompt += "Genera la Síntesis Clínica Biopsicosocial de esta evaluación en 1 párrafo fluido.";
                break;
            case 'generarDxKinesiologico':
                systemInstruction = `${baseRole} Basado en la anamnesis y examen físico del paciente provisto, elabora un Diagnóstico Kinesiológico estructural-funcional definitivo (Ej: 'Disfunción patelofemoral derecha secundaria a valgo dinámico alterado'). Debe ser 1 oración concisa, usando nomenclatura técnica (MIF o CIF asimilada).`;
                prompt += "Genera el Diagnóstico Kinesiológico en 1 oración.";
                break;
            case 'generarPlanPronostico':
                systemInstruction = `${baseRole} Basado en todos los hallazgos de esta evaluación, sugiere un Pronóstico Médico-Kinésico y los Criterios de Alta proyectados. Devuelve un texto de máximo 3 oraciones.`;
                prompt += "Genera un texto sugerido para el Pronóstico Funcional y los Criterios proyectados de Alta.";
                break;
            default:
                return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
        }

        const ai = getAIClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                temperature: 0.2, // Baja temperatura para mantener consistencia médica y reducir alucinación
            }
        });

        // Retornar solo el texto
        return NextResponse.json({ result: response.text?.trim() });

    } catch (error: any) {
        console.error("Gemini API Error:", error);
        return NextResponse.json(
            { error: 'Error generating AI content', details: error.message },
            { status: 500 }
        );
    }
}
