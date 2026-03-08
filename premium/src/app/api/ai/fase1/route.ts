import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import { SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';

export async function POST(req: Request) {
    try {
        const payload = await req.json();

        const userPrompt = `
REGLAS NO NEGOCIABLES:
1. Todo lo generado debe ser JSON estricto. Prohibido texto fuera del JSON.
2. Prohibido inferir: si no está explícitamente mencionado en el relato proporcionado, debes devolver "No_mencionado". Si falta información para calcular algo, devolver "No_determinado". NO adivinar.
3. Evidencia_textual debe ser cita exacta copiada del relato (substring literal). Prohibido parafrasear.
4. El resaltado debe buscar coincidencia exacta; prohibido fuzzy matching.

RELATO DEL PACIENTE:
"""
${payload.relato}
"""

OTROS DATOS (Anclas):
- Prioridad Principal: ${payload.prioridad}
- Antigüedad: ${payload.antiguedad}
- Dolor Actual: ${payload.dolorActual}

Debes devolver obligatoriamente la siguiente estructura JSON (reemplaza los valores de ejemplo):
{
  "extraccion_clinica": {
    "motivo_consulta": {
      "foco_principal": "Región o articulación (o 'No_mencionado')",
      "evidencia_textual": "Cita textual del relato"
    },
    "comportamiento_sintomas": {
      "agravantes": ["Cita 1", "Cita 2"],
      "aliviantes": ["Cita 1", "Cita 2"]
    },
    "banderas_rojas": {
      "detectadas": true/false,
      "detalles": ["Cita exacta de lo detectado" o "No_mencionado"]
    }
  },
  "sugerencias_triage": {
    "nivel_sugerido": "Verde / Amarilla / Roja / No_determinado",
    "justificacion": "Cita literal que apoya el nivel sugerido o 'No_mencionado'"
  }
}
`;

        const rawText = await callGemini({
            systemInstruction: SYSTEM_PROMPT_BASE,
            userPrompt: userPrompt,
            temperature: 0.0 // 0 to avoid hallucinations as much as possible
        });

        const cleanJsonText = rawText.replace(/^[\r\n\s]*```json/gi, '').replace(/```[\r\n\s]*$/g, '').trim();
        const parsedObj = JSON.parse(cleanJsonText);

        return NextResponse.json({
            success: true,
            data: parsedObj
        });

    } catch (err: any) {
        console.error('Error in /api/ai/fase1:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
