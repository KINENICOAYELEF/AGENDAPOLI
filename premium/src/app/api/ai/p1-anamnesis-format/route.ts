import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import { P1_ANAMNESIS_FORMAT_PROMPT } from '@/lib/ai/prompts'; 

export const maxDuration = 60; // 60 seconds

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { rawText } = body;

        if (!rawText) {
            return NextResponse.json({ error: 'Falta texto en bruto (rawText)' }, { status: 400 });
        }

        const promptPayload = `
Texto Dictado en Bruto:
"""
${rawText}
"""
`;

        // Llamada a Gemini
        const textResponse = await callGemini({
            systemInstruction: P1_ANAMNESIS_FORMAT_PROMPT,
            userPrompt: promptPayload,
            temperature: 0.2
        });

        console.log("Gemini Raw Response para p1-anamnesis-format:", textResponse);

        // Limpieza de JSON
        const rawBody = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
        const jsonMatch = rawBody.match(/\{[\s\S]*\}$/m); 
        
        let parsedData = null;
        if (jsonMatch) {
            try {
                parsedData = JSON.parse(jsonMatch[0]);
            } catch (jsonErr) {
                console.error("Error parseando JSON de Gemini (p1-anamnesis):", jsonErr);
                return NextResponse.json({ 
                    error: 'Error parseando JSON', 
                    rawResponse: textResponse 
                }, { status: 500 });
            }
        } else {
            console.error("No se encontró JSON válido en p1-anamnesis:", textResponse);
            return NextResponse.json({ 
                error: 'No JSON payload found', 
                rawResponse: textResponse 
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            data: parsedData 
        });
    } catch (error: any) {
        console.error("Error general en p1-anamnesis-format route:", error);
        return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
    }
}
