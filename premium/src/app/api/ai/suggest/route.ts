import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Instanciar cliente
// Requiere process.env.GEMINI_API_KEY configurada en el entorno
const ai = new GoogleGenAI({});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, context } = body;

        if (!action || !context) {
            return NextResponse.json({ error: 'Missing action or context' }, { status: 400 });
        }

        let systemInstruction = "";
        let prompt = `CONTEXTO CLÍNICO ACTUAL:\n${JSON.stringify(context, null, 2)}\n\n`;

        switch (action) {
            case 'generarObjetivoSesion':
                systemInstruction = "Eres un Kinesiólogo experto clínico. Basado en el contexto de la evolución actual y pasada, sugiere un objetivo operativo pragmático para la sesión de HOY en máximo 1 o 2 oraciones concisas. Responde SOLO con el texto propuesto, sin saludos, sin viñetas, ni explicaciones extra. Debe ser útil y accionable (ej: 'Mejorar tolerancia a la carga axial en 60 grados de flexión y reeducar control motor bajo fatiga').";
                prompt += "Genera el OBJETIVO OPERATIVO para esta sesión.";
                break;
            case 'generarPlanProximaSesion':
                systemInstruction = "Eres un Kinesiólogo experto clínico. Describe brevemente qué elementos deberían priorizarse para la PRÓXIMA sesión basándote en lo que se hizo hoy y la respuesta del paciente. Usa un tono imperativo clínico, redactando entre 2 a 4 líneas continuas o puntos seguidos, evitando listas exageradas. No uses saludos ni explicaciones de IA. Sé quirúrgico y asertivo.";
                prompt += "Genera la PLANIFICACIÓN para la PRÓXIMA sesión.";
                break;
            case 'generarHandoffInterColega':
                systemInstruction = "Eres un Kinesiólogo experto haciendo un traspaso a un colega (Hand-off). Extrae los hallazgos críticos de hoy y resúmelos en exactamente 3 bullets (formatos cortos con guion). Foco en: Alertas, Variaciones marcadas del dolor, y Nivel de progresión tolerada. No escribas nada más que los 3 viñetas descriptivas breves y al grano.";
                prompt += "Genera el HAND-OFF (Traspaso) clínico en 3 viñetas críticas.";
                break;
            default:
                return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
        }

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
