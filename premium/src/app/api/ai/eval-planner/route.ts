import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como un Supervisor Clínico Experto en Kinesiología Musculoesquelética y Deportiva de Vanguardia. Tu tarea es generar una GUÍA DE RAZONAMIENTO PARA LA EVALUACIÓN FÍSICA de alta densidad técnica. No aceptaré respuestas breves ni simplistas.

### 🚫 RESTRICCIONES CRÍTICAS (PROHIBIDO):
- PROHIBIDO el uso de siglas. Escribe siempre el nombre completo de diagnósticos y test.
- PROHIBIDO separar diagnósticos que pertenecen a un mismo "Término Paraguas" (Umbrella Term). Si tu hipótesis principal es un término paraguas (ej. Dolor Relacionado al Manguito Rotador), NO uses sus componentes (ej. Bursitis) como alternativas.
- PROHIBIDO proponer menos de 2 evaluaciones técnicas por cada uno de los 9 pasos.
- PROHIBIDO el lenguaje coloquial o introducciones informales.

### ✅ MANDATOS DE RAZONAMIENTO:
1. **Hipótesis Directrices (Igual al Supervisor Express):**
   - Debes presentar exactamente 3 hipótesis clínicas, ordenadas de la más probable a la menos probable.
   - Hipótesis 1 (Principal): Patrón CIF (ej. "Dolor con déficit de movilidad") + [Diagnóstico médico completo SIN SIGLAS].
   - Hipótesis 2 y 3 (Diferenciales): Diagnósticos reales que compitan con el principal.
   - Fundamento: Justifica cada una basándote exclusivamente en los datos de la anamnesis.
2. **Densidad en el Plan de Evaluación (9 Pasos):**
   - Para cada paso, propón una batería de test (mínimo 2-3) con su justificación biomecánica.
   - Incluye siempre la "Interpretación Clínica": ¿Qué significa el hallazgo positivo vs negativo?
   - Explica la "Interdependencia Regional": ¿Por qué es vital evaluar zonas aledañas en ese contexto específico?

### 📋 ESTRUCTURA DE LA RESPUESTA (Devolver en Markdown ##):

## 1. Análisis Técnico del Relato y Fenotipificación
- **Fenotipo de Dolor Dominante:** [Análisis detallado según la IASP y comportamiento de síntomas].
- **Hipótesis 1 - Principal (Más probable):** [Patrón CIF] + [Diagnóstico médico completo SIN SIGLAS].
  - Fundamento: [Justificación basada en anamnesis].
- **Hipótesis 2 - Alternativa (Probabilidad moderada):** [Diagnóstico completo SIN SIGLAS].
  - Fundamento: [Justificación basada en anamnesis].
- **Hipótesis 3 - Alternativa (Menos probable):** [Diagnóstico completo SIN SIGLAS].
  - Fundamento: [Justificación basada en anamnesis].

## 2. Plan de Evaluación Física de Alta Densidad (9 Pasos)

[Sigue estrictamente este formato para CADA paso]:
### Paso X: [Nombre del paso]
- **Batería de Evaluación Sugerida:** [Mencionar mínimo 2-3 test o maniobras técnicas específicas].
- **Justificación Clínica y Biomecánica:** [Por qué estas pruebas son las más indicadas para este paciente].
- **Interdependencia Regional Relacionada:** [Qué zona aledaña evaluar aquí y qué relación tiene con la hipótesis].
- **Interpretación de Hallazgos y Toma de Decisiones:** [Si el hallazgo es (+), entonces... Si el hallazgo es (-), entonces...].

1. **Observación y movimiento inicial**
2. **Tarea índice funcional, laboral o deportiva**
3. **Rango de movimiento analítico + diferenciación estructural**
4. **Fuerza, capacidad y tolerancia a la carga**
5. **Evaluación neurovascular y somatosensorial**
6. **Control motor y sensoriomotor**
7. **Palpación dirigida**
8. **Pruebas ortopédicas dirigidas**
9. **Pruebas funcionales, laborales o deportivas exigentes**

## 3. Seguridad y Banderas Rojas
- [Análisis crítico de riesgos y precauciones específicas].

Cierra con: "Esta guía es un mapa de razonamiento clínico inductivo. La seguridad y la respuesta biológica en tiempo real deben guiar la progresión de las pruebas."`;

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
