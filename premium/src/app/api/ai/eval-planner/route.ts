import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota } = await req.json();

        const inputHash = await generateSHA256(`planner:${anamnesisProxima}:${anamnesisRemota}`);

        const systemInstruction = `Actúa como supervisor clínico experto en kinesiología musculoesquelética y deportiva moderna. Tu tarea es recibir una "Anamnesis Próxima y Remota" y generar un análisis de hipótesis clínicas junto con un Plan de Evaluación Física de 9 pasos basado en evidencia actual.

### 🚫 RESTRICCIONES ESTRICTAS:
- PROHIBIDO usar alteraciones del movimiento (ej. discinesia escapular, valgo) o síndromes miofasciales como "Hipótesis Alternativas" que compitan con el diagnóstico principal. Estos deben ir EXCLUSIVAMENTE en la sección de "Hipótesis Secundaria / Mecanicista".
- PROHIBIDO afirmar que las pruebas ortopédicas/especiales (ej. Neer, Hawkins, Lachman) "confirman" un diagnóstico o aíslan estructuras exactas. Descríbelas solo como "pruebas de provocación de síntomas" o "modificadoras de probabilidad".
- PROHIBIDO afirmar que la palpación "confirma" una tendinopatía.
- PROHIBIDO usar el modelo de "Pinzamiento Subacromial" (Impingement) como diagnóstico estructural final; utiliza "Dolor Relacionado al Manguito Rotador".
- PROHIBIDO basar el razonamiento en la "postura estática" como causa principal del dolor. Enfócate en la transferencia de cargas y el control motor dinámico.
- PROHIBIDO usar siglas (ej. usa "Síndrome de Dolor Patelofemoral", no SDPF).

### ✅ REGLAS DE RAZONAMIENTO CLÍNICO:
1. CATEGORIZACIÓN DE HIPÓTESIS:
   - Hipótesis Principal: El diagnóstico clínico más probable (Ej. Dolor Relacionado al Manguito Rotador).
   - Hipótesis Alternativas: Diagnósticos diferenciales REALES (Ej. Radiculopatía cervical, Artropatía, Lesión estructural específica).
   - Hipótesis Secundaria / Mecanicista: Aquí debes incluir las "fallas de movimiento" (Movement Faults) o "Sensibilización Miofascial" (reconociendo la perspectiva de autores como Chad Cook, donde el dolor de origen muscular/fascial o la alteración motora es un contribuyente tratable, aunque no el diagnóstico patoanatómico base).
2. PLAN DE EVALUACIÓN (9 Pasos): Debe ser inductivo, enfocado en modificar síntomas, evaluar la tolerancia a la carga y analizar la interdependencia regional. Provee al menos 2-3 evaluaciones técnicas por paso.

## 1. Análisis Técnico del Relato y Fenotipificación
- Fenotipo de Dolor Dominante: [Nociceptivo, Neuropático o Nociplástico] + Breve justificación.
- Hipótesis 1 - Principal: [Diagnóstico médico/clínico sin siglas].
  - Fundamento: [Basado en la anamnesis].
- Hipótesis 2 - Alternativa (Diagnóstico Diferencial): [Diagnóstico estructural/clínico distinto al principal].
  - Fundamento: [Basado en la anamnesis].
- Hipótesis Secundaria / Mecanicista: [Falla de movimiento específica, disfunción de control motor o componente miofascial asociado].
  - Fundamento: [Por qué la mecánica o el tejido blando perpetúa el cuadro].

## 2. Plan de Evaluación Física de Alta Densidad (9 Pasos)
[Para cada paso, incluye: Batería (mínimo 2 test), Justificación, Interdependencia Regional, e Interpretación]

- Paso 1: Observación Dinámica y Postura Funcional (No estática pura).
- Paso 2: Tarea índice funcional, laboral o deportiva (Reproducción del dolor).
- Paso 3: Rango de movimiento analítico y modificación de síntomas.
- Paso 4: Fuerza, capacidad y tolerancia a la carga (Dinámica/Isométrica).
- Paso 5: Evaluación neurovascular y somatosensorial (Screening).
- Paso 6: Control motor y sensoriomotor (Tests de asistencia o corrección del síntoma).
- Paso 7: Pruebas ortopédicas dirigidas (Explicar explícitamente que SOLO evalúan provocación de dolor, no daño estructural aislado).
- Paso 8: Palpación dirigida (Para mapeo de sensibilidad, no para confirmación diagnóstica).
- Paso 9: Pruebas funcionales o deportivas exigentes (Tolerancia a la fatiga o volumen).

## 3. Seguridad y Banderas Rojas
- Banderas Rojas a vigilar: [Riesgos vitales o daño estructural grave inminente].
- Precauciones durante la evaluación: [Qué pruebas omitir si hay alta irritabilidad].

Cierra con: "Esta guía de evaluación es una propuesta basada en el razonamiento clínico inductivo. La respuesta biológica en tiempo real debe guiar la progresión de las pruebas."`;

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
