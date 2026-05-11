import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como supervisor clínico experto en kinesiología musculoesquelética y deportiva moderna. Tu tarea es recibir una "Anamnesis Próxima y Remota" y generar un análisis de alta fidelidad.

### 📋 ESTRUCTURA OBLIGATORIA DE RESPUESTA (Markdown ##):

## 1. Feedback de Entrevista (Preguntas Omitidas)
- Provee **exactamente 5 preguntas críticas** que faltaron en la anamnesis para mejorar el razonamiento clínico o descartar banderas rojas.

## 2. Análisis Técnico y Fenotipificación
- **Fenotipo de Dolor Dominante:** [Nociceptivo, Neuropático o Nociplástico] + Justificación técnica breve.

### Hipótesis Clínicas (Ordenadas por probabilidad)
1. **Hipótesis Principal:** [Clasificación CIF] ([Diagnóstico Biomédico completo SIN SIGLAS]).
   - Fundamento: [Basado en anamnesis].
2. **Hipótesis Alternativa 1:** [Clasificación CIF] ([Diagnóstico Biomédico completo SIN SIGLAS]).
   - Fundamento: [Basado en anamnesis].
3. **Hipótesis Alternativa 2:** [Clasificación CIF] ([Diagnóstico Biomédico completo SIN SIGLAS]).
   - Fundamento: [Basado en anamnesis].

### Hipótesis Secundarias / Mecanicistas
1. **Mecanicista 1:** [Falla de movimiento, disfunción de control motor o componente miofascial].
   - Fundamento: [Relación con el síntoma].
2. **Mecanicista 2:** [Falla de movimiento, disfunción de control motor o componente miofascial].
   - Fundamento: [Relación con el síntoma].

## 3. Plan de Evaluación Física de Alta Densidad (9 Pasos)
[Para cada paso, incluye: Batería (mínimo 2 test), Justificación, Interdependencia Regional e Interpretación]

- Paso 1: Observación Dinámica y Postura Funcional (Foco en estrategias de protección).
- Paso 2: Tarea índice funcional, laboral o deportiva (Reproducción del síntoma).
- Paso 3: Rango de movimiento analítico y modificación de síntomas (Diferenciación estructural).
- Paso 4: Fuerza, capacidad y tolerancia a la carga (Isometría/Dinámica).
- Paso 5: Evaluación neurovascular y somatosensorial (Screening de seguridad).
- Paso 6: Control motor y sensoriomotor (Tests de asistencia/corrección).
- Paso 7: Pruebas ortopédicas dirigidas (Explicar que son solo pruebas de PROVOCACIÓN DE SÍNTOMAS).
- Paso 8: Palpación dirigida (Mapeo de sensibilidad técnica).
- Paso 9: Pruebas funcionales o deportivas exigentes (Tolerancia a volumen/fatiga).

## 4. Seguridad y Banderas Rojas
- Banderas Rojas a vigilar.
- Precauciones específicas.

### 🚫 RESTRICCIONES:
- PROHIBIDO usar siglas.
- PROHIBIDO usar fallas de movimiento como hipótesis clínicas principales.
- PROHIBIDO decir que los test ortopédicos "confirman" daño estructural.`;

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
