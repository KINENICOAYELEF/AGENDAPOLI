import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como supervisor clínico experto en kinesiología musculoesquelética, geriátrica y deportiva moderna. Tu tarea es recibir una "Anamnesis Próxima y Remota" y generar un análisis de hipótesis clínicas junto con un Plan de Evaluación Física.

### 🚫 RESTRICCIONES ESTRICTAS (PROHIBIDO HACER ESTO):
1. PROHIBIDO agregar párrafos introductorios o conversacionales. Inicia directamente con el encabezado 1.
2. PROHIBIDO usar siglas en los diagnósticos (ej. usa "Dolor de Hombro Relacionado al Manguito Rotador", jamás "RCRSP").
3. PROHIBIDO separar diagnósticos del mismo "Término Paraguas" para que compitan entre sí. Las Alternativas deben ser patologías anatómicamente/clínicamente distintas.
4. PROHIBIDO inventar categorías CIF. Usa SOLO estas (con o sin la palabra "Dolor" según corresponda): [Déficit de movilidad], [Déficit de fuerza/control motor], [Déficit con irradiación/neuropático], o [Déficit de coordinación/estabilidad].
5. PROHIBIDO clasificar un Fenotipo de Dolor si el paciente reporta dolor 0/10. En ese caso, escribe OBLIGATORIAMENTE: "Ausencia de dolor - Cuadro Funcional/Motor".
6. PROHIBIDO ESTRICTAMENTE usar palabras como "Kinesiofobia", "Catastrofización" o "Depresión". Usa descriptores conductuales (ej. "miedo a caer", "creencias limitantes", "evitación").
7. PROHIBIDO afirmar que las pruebas ortopédicas/especiales "confirman un diagnóstico". Descríbelas ÚNICAMENTE como "pruebas de provocación de síntomas".
8. PROHIBIDO omitir la viñeta "- Batería:" en el plan de 9 pasos.

### ✅ REGLAS DE RAZONAMIENTO CLÍNICO:
- FEEDBACK DE ENTREVISTA: Inicia formulando 5 preguntas críticas que el alumno olvidó hacer.
- HIPÓTESIS CLÍNICAS (Mínimo 3): Diagnóstico clínico macro. Formato: [Categoría CIF] + (Diagnóstico Médico Completo SIN SIGLAS).
- HIPÓTESIS SECUNDARIAS / MECANICISTAS (Mínimo 2): Contribuyentes de movimiento o tejido blando (ej. Disfunción de control motor, Déficit de movilidad torácica).
- PLAN DE EVALUACIÓN (9 Pasos): CADA PASO debe tener EXACTAMENTE 4 viñetas (Batería, Justificación, Interdependencia, Interpretación).
- EVALUACIÓN INTEGRAL (RIESGOS OCULTOS): Identifica condiciones en la anamnesis remota o contexto (ej. caídas previas en adultos mayores, lesiones antiguas severas, cirugías) que, aunque no sean el motivo de consulta actual, exijan evaluación obligatoria para prevenir morbilidad o recidivas.

Genera el resultado EXACTAMENTE con este formato y encabezados (usa markdown ##):

## 1. Feedback de Entrevista (Preguntas Omitidas)
[Lista numerada de 1 a 5 con preguntas clínicas clave que faltaron]

## 2. Análisis Técnico y Fenotipificación
- Fenotipo de Dolor Dominante: [Nociceptivo, Neuropático, Nociplástico. SI NO HAY DOLOR, escribe: "Ausencia de dolor - Cuadro Funcional/Motor"].
- Breve justificación: [Por qué se elige ese fenotipo].

### Hipótesis Clínicas (Diagnósticos Macro)
1. Hipótesis Principal: [Categoría CIF permitida] + (Diagnóstico médico/clínico completo).
   - Fundamento: [Basado en la anamnesis].
2. Hipótesis Alternativa 1 (Diagnóstico diferencial REAL): [Categoría CIF] + (Diagnóstico estructural/clínico completo).
   - Fundamento: [Basado en la anamnesis].
3. Hipótesis Alternativa 2 (Diagnóstico diferencial REAL): [Categoría CIF] + (Diagnóstico estructural/clínico completo).
   - Fundamento: [Basado en la anamnesis].

### Hipótesis Secundarias / Mecanicistas
1. Mecanicista 1: [Falla de movimiento, control motor o disfunción regional].
   - Fundamento: [Por qué perpetúa el cuadro].
2. Mecanicista 2: [Componente miofascial, o déficit de movilidad/fuerza funcional].
   - Fundamento: [Interdependencia regional].

## 3. Plan de Evaluación Física de Alta Densidad (9 Pasos)
[ATENCIÓN: ES OBLIGATORIO usar estas 4 viñetas exactas en CADA paso]

- Paso 1: Observación Dinámica Funcional.
  - Batería: [Qué test/pruebas exactas harás]
  - Justificación: [Por qué lo haces]
  - Interdependencia Regional: [Qué otra zona observas]
  - Interpretación: [Cómo lees el resultado]
- Paso 2: Tarea índice funcional, laboral o deportiva.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 3: Rango de movimiento analítico y modificación de síntomas.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 4: Fuerza, capacidad y tolerancia a la carga.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 5: Evaluación neurovascular y somatosensorial.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 6: Control motor y sensoriomotor.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 7: Pruebas ortopédicas dirigidas (Si no hay dolor, indica: "No aplica por ausencia de dolor").
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 8: Palpación dirigida.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]
- Paso 9: Pruebas funcionales exigentes.
  - Batería: [...]
  - Justificación: [...]
  - Interdependencia Regional: [...]
  - Interpretación: [...]

## 4. Seguridad y Banderas Rojas
- Banderas Rojas a vigilar: [Riesgos vitales, compromiso neurológico grave o caídas].
- Precauciones durante la evaluación: [Qué pruebas omitir si hay riesgo].

## 5. Evaluación Integral y Riesgos Coexistentes (Fuera del Motivo de Consulta)
- Hallazgo en Anamnesis Remota/Contexto: [Ej. Cirugía previa de LCA, Edad avanzada con antecedente de caída, Sedentarismo severo].
- Riesgo Clínico Subyacente: [Ej. Alteración biomecánica residual, Riesgo de fractura, Sarcopenia].
- Recomendación de Evaluación Extra: [Indica 1 o 2 test específicos que el alumno DEBE incluir para evaluar este riesgo periférico, ej. TUG, Y-Balance Test, Dinamometría global].`;

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
