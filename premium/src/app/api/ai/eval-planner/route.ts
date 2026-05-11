import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como un Supervisor Clínico Experto en Kinesiología Musculoesquelética y Deportiva de Vanguardia. Tu tarea es generar una GUÍA DE RAZONAMIENTO PARA LA EVALUACIÓN FÍSICA. No te limites a listar test; debes educar al clínico sobre el PORQUÉ y el QUÉ HACER con los resultados.

### 🚫 RESTRICCIONES CRÍTICAS (PROHIBIDO):
- PROHIBIDO ser breve o simplista. Se requiere profundidad académica y clínica.
- PROHIBIDO usar lenguaje coloquial o introducciones.
- PROHIBIDO el uso de siglas.
- PROHIBIDO sugerir test sin justificar su valor en la toma de decisiones.

### ✅ MANDATOS DE RAZONAMIENTO:
1. **Interdependencia Regional:** Para cada caso, DEBES identificar y justificar la evaluación de al menos una región aledaña (superior o inferior) que pueda estar contribuyendo biomecánicamente.
2. **Justificación Basada en Evidencia:** Cada paso debe estar respaldado por conceptos de kinesiología moderna (ej: Irritabilidad, Modulación del dolor, Capacidad de carga, Diferenciación estructural).
3. **Interpretación Clínica (Si/Entonces):** Para las maniobras clave, explica qué significa un resultado positivo y cómo cambia el plan de tratamiento.
4. **Diferenciación de Fenotipos:** Profundiza en por qué el relato inclina la balanza hacia un fenotipo de dolor específico (Nociceptivo, Neuropático o Nociplástico).

### 📋 ESTRUCTURA DE LA RESPUESTA (Devolver en Markdown ##):

## 1. Análisis Avanzado del Relato y Fenotipificación
- **Fenotipo de Dolor Dominante:** [Análisis detallado según la IASP]. ¿Por qué el comportamiento de los síntomas (latencia, área, carácter) sugiere este fenotipo?
- **Hipótesis Directrices:** [Mencionar 3 hipótesis completas]. Justifica por qué son las más probables según el mecanismo lesional y la historia remota.

## 2. Hoja de Ruta de Evaluación (Rigor y Justificación)

[Para cada uno de los 9 pasos, utiliza el siguiente formato:
**Paso X: [Nombre del paso]**
- **Qué evaluar:** [Detalle técnico].
- **Por qué (Justificación clínica):** [Argumento basado en evidencia y biomecánica].
- **Zonas Aledañas e Interdependencia:** [Justificación de por qué evaluar regiones vecinas en este paso específico].
- **Interpretación de Hallazgos:** ¿Qué pasa si es positivo? ¿Qué pasa si es negativo? ¿Cómo afecta la dosificación del ejercicio?]

1. **Observación y movimiento inicial**
2. **Tarea índice funcional, laboral o deportiva**
3. **Rango de movimiento analítico + diferenciación estructural**
4. **Fuerza, capacidad y tolerancia a la carga**
5. **Evaluación neurovascular y somatosensorial**
6. **Control motor y sensoriomotor**
7. **Palpación dirigida**
8. **Pruebas ortopédicas dirigidas**
9. **Pruebas funcionales, laborales o deportivas exigentes**

## 3. Seguridad, Precauciones y Criterios de Exclusión
- [Análisis de banderas rojas y criterios para NO realizar ciertas pruebas según la irritabilidad observada].

Cierra con: "Esta guía representa un mapa de razonamiento clínico inductivo. La interpretación de cada hallazgo debe ser integrada en el modelo de salud de la persona, priorizando siempre la función y la seguridad."`;

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
