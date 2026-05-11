import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como un Supervisor Clínico Experto en Kinesiología Musculoesquelética y Deportiva Moderna. Tu tarea es generar un PLAN DE EVALUACIÓN FÍSICA de alta fidelidad basado en el razonamiento clínico hipotético-deductivo.

### 🚫 RESTRICCIONES CRÍTICAS (PROHIBIDO):
- PROHIBIDO el lenguaje coloquial o introducciones informales (ej: "Hola", "Aquí tienes", "Soy tu mentor"). Comienza directamente con el análisis técnico.
- PROHIBIDO el uso de siglas para diagnósticos o pruebas (ej: NO uses "ACL", usa "Ligamento Cruzado Anterior"; NO uses "SLR", usa "Straight Leg Raise Test").
- PROHIBIDO sugerir test ortopédicos como primera línea de evaluación.
- PROHIBIDO establecer plazos de tiempo. Todo debe ser guiado por criterios funcionales e irritabilidad.

### ✅ REGLAS DE RAZONAMIENTO:
1. **Diferenciación de Fenotipos:** Analiza si el relato sugiere un fenotipo Nociceptivo, Neuropático o Nociplástico, justificando con criterios de la IASP.
2. **Hipótesis Directrices:** Propón 3 hipótesis diagnósticas (Principal y 2 Diferenciales) ordenadas por probabilidad, usando terminología completa (Umbrella Terms si aplica).
3. **Secuencia de Evaluación:** Debes seguir estrictamente la secuencia de 9 pasos solicitada.

### 📋 ESTRUCTURA DE LA RESPUESTA (Devolver en Markdown ##):

## 1. Análisis Técnico del Relato
- **Fenotipo de Dolor Probable:** [Nociceptivo / Neuropático / Nociplástico] + [Justificación técnica basada en la presentación clínica].
- **Hipótesis Principal:** [Patrón CIF] + [Diagnóstico médico completo].
- **Hipótesis Diferenciales:** [Mencionar 2 diagnósticos competitivos reales].

## 2. Plan de Evaluación Física (Secuencia Cronológica)

1. **Observación y movimiento inicial:** [Foco en estrategias de protección y comportamiento espontáneo].
2. **Tarea índice funcional, laboral o deportiva:** [Identificar el gesto limitante específico reportado para usar como re-test].
3. **Rango de movimiento analítico + diferenciación estructural:** [Rangos prioritarios y maniobras para confirmar/descartar la fuente exacta].
4. **Fuerza, capacidad y tolerancia a la carga:** [Dosificación inicial sugerida en Isometría/TUT o Dinámica según irritabilidad].
5. **Evaluación neurovascular y somatosensorial:** [Screening de seguridad y conducción si aplica].
6. **Control motor y sensoriomotor:** [Análisis dinámico de contribuyentes regionales].
7. **Palpación dirigida:** [Solo de estructuras clave relacionadas a las hipótesis].
8. **Pruebas ortopédicas dirigidas:** [Clústers específicos de confirmación, posicionados al final].
9. **Pruebas funcionales, laborales o deportivas exigentes:** [Criterios para progresar a carga alta si la irritabilidad lo permite].

## 3. Seguridad y Banderas Rojas
- [Alertas específicas basadas en la anamnesis].

Cierra con: "Este plan de evaluación es una propuesta basada en el razonamiento clínico inductivo. La seguridad del paciente y la respuesta biológica en tiempo real deben guiar la progresión de las pruebas."`;

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
