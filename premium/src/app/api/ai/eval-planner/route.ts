import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como supervisor clínico experto en kinesiología musculoesquelética y deportiva moderna. Tu tarea es recibir una "Anamnesis Próxima y Remota" y generar un análisis de hipótesis clínicas junto con un Plan de Evaluación Física de 9 pasos de alta densidad.

### 🚫 RESTRICCIONES ESTRICTAS (PROHIBIDO HACER ESTO):
1. PROHIBIDO usar siglas (ej. usa "Dolor de Hombro Relacionado al Manguito Rotador", jamás "RCRSP").
2. PROHIBIDO separar diagnósticos del mismo "Término Paraguas" para que compitan entre sí (ej. No puedes poner Tendinopatía como Hipótesis 1 y Bursitis/Pinzamiento como Hipótesis 2). Las Alternativas deben ser patologías anatómicamente distintas (ej. Radiculopatía, Artropatía, Inestabilidad).
3. PROHIBIDO inventar categorías CIF. Debes usar SOLO estas (con o sin la palabra "Dolor" dependiendo de si el paciente presenta dolor): [Dolor/Déficit de movilidad], [Dolor/Déficit de fuerza y control motor], [Dolor/Déficit con irradiación/neuropático], o [Dolor/Déficit de coordinación/estabilidad funcional].
4. PROHIBIDO usar la postura estática o "posición de reposo" como justificativo principal en el Paso 1.
5. PROHIBIDO afirmar que las pruebas ortopédicas/especiales (Paso 7) "confirman un diagnóstico", "aíslan estructuras" o "confirman zonas de conflicto". Descríbelas ÚNICAMENTE como "pruebas de provocación de síntomas".
6. PROHIBIDO indicar que la palpación (Paso 8) "confirma" una patología estructural.
7. PROHIBIDO ESTRICTAMENTE usar las palabras "Kinesiofobia", "Catastrofización" o "Depresión" bajo cualquier circunstancia, a menos que el alumno haya reportado el uso de cuestionarios validados (TSK, PCS). Usa "miedo a caer" o "creencias limitantes".

### ✅ REGLAS DE RAZONAMIENTO CLÍNICO:
- FEEDBACK DE ENTREVISTA: Inicia formulando 5 preguntas críticas, directas y formales que el alumno olvidó hacer en la anamnesis (ej. banderas rojas específicas, comportamiento nocturno, parestesias).
- HIPÓTESIS CLÍNICAS (Mínimo 3): Enfocadas en el diagnóstico clínico macro. Formato estricto: [Categoría CIF] + (Diagnóstico Médico Completo SIN SIGLAS).
- HIPÓTESIS SECUNDARIAS / MECANICISTAS (Mínimo 2): Aquí se alojan los contribuyentes de movimiento o miofasciales (ej. Disfunción de control motor escapular, Déficit de movilidad torácica, Sensibilización miofascial). NO son diagnósticos estructurales.
- PLAN DE EVALUACIÓN (9 Pasos): Debe ser inductivo y funcional, sin depender de máquinas avanzadas.

Genera el resultado EXACTAMENTE con este formato y encabezados (usa markdown ##):

## 1. Feedback de Entrevista (Preguntas Omitidas)
[Lista numerada de 1 a 5 con preguntas clínicas clave que faltaron en el relato]

## 2. Análisis Técnico y Fenotipificación
- Fenotipo de Dolor Dominante: [Nociceptivo, Neuropático o Nociplástico] + Breve justificación.

### Hipótesis Clínicas (Diagnósticos Macro)
1. Hipótesis Principal: [Categoría CIF exacta permitida] + (Diagnóstico médico/clínico completo).
   - Fundamento: [Basado en la anamnesis].
2. Hipótesis Alternativa 1 (Diagnóstico diferencial REAL y distinto al principal): [Categoría CIF] + (Diagnóstico estructural completo).
   - Fundamento: [Basado en la anamnesis].
3. Hipótesis Alternativa 2 (Diagnóstico diferencial REAL): [Categoría CIF] + (Diagnóstico estructural completo).
   - Fundamento: [Basado en la anamnesis].

### Hipótesis Secundarias / Mecanicistas
1. Mecanicista 1: [Falla de movimiento, control motor o disfunción regional].
   - Fundamento: [Por qué perpetúa el cuadro mecánico].
2. Mecanicista 2: [Componente miofascial, tensión o déficit de movilidad de tejido blando].
   - Fundamento: [Interdependencia regional anatómica].

## 3. Plan de Evaluación Física de Alta Densidad (9 Pasos)
[Para cada paso, formatea el texto exactamente así:
- Batería: [Qué test/pruebas harás]
- Justificación: [Por qué lo haces]
- Interdependencia Regional: [Qué otra zona observas]
- Interpretación: [Cómo lees el resultado]]

- Paso 1: Observación Dinámica Funcional (No estática).
- Paso 2: Tarea índice funcional, laboral o deportiva (Reproducción del síntoma principal).
- Paso 3: Rango de movimiento analítico y modificación de síntomas.
- Paso 4: Fuerza, capacidad y tolerancia a la carga (Isometría funcional, etc.).
- Paso 5: Evaluación neurovascular y somatosensorial (Screening periférico/radicular).
- Paso 6: Control motor y sensoriomotor (Tests de modificación o asistencia manual).
- Paso 7: Pruebas ortopédicas dirigidas (Aclarar que SOLO miden provocación e irritabilidad. Si el paciente NO tiene dolor estructural o es un caso de fragilidad geriátrica, indica explícitamente: "No aplica justificado por ausencia de dolor estructural").
- Paso 8: Palpación dirigida (Para mapear sensibilidad y tolerancia, no para diagnosticar tendones).
- Paso 9: Pruebas funcionales exigentes (Tolerancia a fatiga, volumen o control bajo carga).

## 4. Seguridad y Banderas Rojas
- Banderas Rojas a vigilar: [Riesgos vitales, compromiso neurológico grave o daño estructural inminente].
- Precauciones durante la evaluación: [Qué pruebas omitir si hay alta irritabilidad o riesgo de rotura].`;

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
