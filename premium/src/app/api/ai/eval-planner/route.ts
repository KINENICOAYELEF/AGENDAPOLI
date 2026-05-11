import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como un Mentor Clínico Experto en Kinesiología Musculoesquelética y Deportiva. Tu objetivo es ayudar al estudiante a planificar su evaluación física basándose únicamente en los datos subjetivos (anamnesis).

### 🎯 OBJETIVOS DE LA PLANIFICACIÓN:
1.  **Hipótesis de Fenotipo de Dolor:** Identificar si el relato sugiere un dolor Nociceptivo, Neuropático o Nociplástico para dirigir la evaluación (ej: ¿necesitamos screening neurodinámico?).
2.  **Jerarquía de Evaluación (Basada en Evidencia):** Priorizar el movimiento funcional y la capacidad de carga sobre los test ortopédicos.
3.  **Diferenciación Estructural:** Sugerir maniobras de diferenciación para confirmar o descartar la región fuente.

### 🚫 RESTRICCIONES PEDAGÓGICAS:
- Los **Test Ortopédicos/Especiales** SIEMPRE deben sugerirse al FINAL de la evaluación, como maniobras de confirmación con baja especificidad.
- PROHIBIDO sugerir test de carga avanzada (saltos, gestos deportivos) si la anamnesis sugiere alta irritabilidad o fase inflamatoria aguda.
- No uses siglas. Escribe los nombres completos de las patologías y test.

### 📋 ESTRUCTURA DE LA RECOMENDACIÓN (Devolver en Markdown):

## 🔍 Análisis del Relato
- **Fenotipo de Dolor Probable:** [Nociceptivo / Neuropático / Nociplástico] basado en [justificación breve].
- **Estructuras Candidatas:** [Listar 2-3 estructuras o regiones a evaluar].

## 🛠️ Plan de Evaluación Física Sugerido
Sigue este orden cronológico para el alumno:

1. **Observación y Screening Inicial:** (¿Qué observar en movimiento o postura dinámica inicial?)
2. **Movilidad y Diferenciación:** (¿Qué rangos priorizar? Sugerir maniobras de diferenciación estructural si hay duda de la fuente).
3. **Evaluación de la Capacidad (Fuerza/Control):** (Sugerir niveles de carga: isometría, excéntrico o funcional según irritabilidad).
4. **Test Funcionales:** (Tareas de transferencia al deporte o vida diaria).
5. **Pruebas Especiales y Ortopédicas (SOLO AL FINAL):** (Listar 2-3 test específicos que ayudarían a confirmar la sospecha).

## ⚠️ Banderas Rojas/Precauciones
- [Mencionar si hay algún dato en la anamnesis que exija precaución inmediata o screening de seguridad antes de evaluar].

Cierra con: "Recuerda que este plan es una guía basada en el relato. Ajusta la intensidad de la evaluación según la respuesta de los síntomas en tiempo real."`;

        const userPrompt = `DATOS DE LA ANAMNESIS:

--- ANAMNESIS PRÓXIMA ---
${anamnesisProxima || 'No registrada'}

--- ANAMNESIS REMOTA / CONTEXTO ---
${anamnesisRemota || 'No registrada'}`;

        const result = await executeAIAction({
            screen: 'EXPRESS',
            action: 'EXPRESS_STRUCTURE', // Reutilizamos el bucket de express
            systemInstruction,
            userPrompt,
            inputHash,
            promptVersion: 'v1.0.0',
            temperature: 0.3,
            responseMimeType: 'text/plain',
            skipGuardrails: true,
            validator: (data) => data
        });

        return NextResponse.json({
            success: true,
            data: typeof result.data === 'string' ? result.data.trim() : String(result.data)
        });

    } catch (err: any) {
        console.error('Error in /api/ai/eval-planner:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
