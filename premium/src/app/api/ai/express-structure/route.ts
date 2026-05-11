import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { generateSHA256 } from '@/lib/ai/hash';
import { z } from 'zod';

const ExpressStructureSchema = z.object({
    focoPrincipal: z.string().describe("Región principal o articulación afectada (ej: Rodilla Derecha)"),
    relatoEstructurado: z.string().describe("El texto de la entrevista, ordenado en viñetas o párrafos limpios y profesionales."),
    anamnesisRemota: z.string().describe("Antecedentes médicos, cirugías, fármacos, extraídos del texto."),
    examenFisico: z.string().describe("El examen físico estructurado (ROM, MMT, Pruebas Especiales, Palpación)."),
    sins: z.object({
        severidad: z.string(),
        irritabilidad: z.string(),
        naturaleza: z.string(),
        estadio: z.string()
    }).describe("Análisis SINS del caso"),
    hipotesis_orientativas: z.array(z.object({
        titulo: z.string(),
        fundamento: z.string()
    })).describe("1 a 3 hipótesis diagnósticas kinesiológicas"),
    sugerenciasFaltantes: z.array(z.object({
        pregunta: z.string(),
        por_que: z.string()
    })).describe("Lista de preguntas o evaluaciones cruciales que el kinesiólogo olvidó hacer, con su razón clínica.")
});

export async function POST(req: Request) {
    try {
        const { anamnesisProxima, anamnesisRemota, evaluacionFisica, userId } = await req.json();

        const inputHash = await generateSHA256(`express:${anamnesisProxima}:${anamnesisRemota}:${evaluacionFisica}`);

        const systemInstruction = `Actúa como supervisor clínico experto en kinesiología musculoesquelética, deportiva y actividad física moderna basada en evidencia. Tu tarea es analizar el razonamiento clínico del usuario en tres secciones: Anamnesis próxima, remota y evaluación física.

### 🚫 RESTRICCIONES ESTRICTAS (PROHIBIDO HACER ESTO):
- PROHIBIDO diagnosticar "Síndrome de dolor miofascial", "Puntos gatillo" o "Fibromialgia" si el mecanismo lesional es un macrotrauma agudo (ej. sprint, caída, rotura confirmada, esguince).
- PROHIBIDO sugerir la "corrección" de alteraciones posturales estructurales (ej. "corregir anteversión", "corregir valgo estático"). Enfócate en modificar el control motor dinámico y la tolerancia a la carga.
- PROHIBIDO sugerir escalas de Kinesiofobia (TSK) o Catastrofización (PCS) si el paciente muestra urgencia temeraria por jugar ("hambre de cancha").
- PROHIBIDO usar "Inhibición Muscular Artrogénica (AMI)" si la lesión es puramente de vientre muscular y no articular.
- PROHIBIDO sugerir indicadores de progresión subjetivos como "levantar 20kg" o solo "ausencia de dolor".

### ✅ REGLAS DE RAZONAMIENTO CLÍNICO:
1. DIAGNÓSTICO PARSIMONIOSO: Las hipótesis alternativas en lesiones agudas deben orientarse a la gravedad arquitectónica del tejido (ej. clasificación BAMIC, compromiso de tendón central) o irritación neural periférica asociada al hematoma/edema.
2. CONTEXTO PSICOSOCIAL DEPORTIVO: En atletas ansiosos por retornar, enfoca el análisis en "Readiness to Return to Sport", gestión de expectativas y el riesgo estructural de ignorar la biología de la cicatrización.
3. MÉTRICAS DE ALTO RENDIMIENTO: En la sección de indicadores, exige métricas objetivas. Ejemplos obligatorios: Limb Symmetry Index (LSI) > 90%, reducción del déficit bilateral de fuerza < 10%, mejora en la Tasa de Desarrollo de Fuerza (RFD), o tolerancia a pruebas específicas (ej. Askling H-Test, exposición progresiva a High Speed Running).
4. TERAPIA ACTIVA: Penaliza la dependencia de terapias pasivas previas. El plan inicial debe priorizar la analgesia inducida por ejercicio (isométricos submáximos), exposición gradual y capacidad de carga del tejido.
5. BANDERAS ROJAS DEPORTIVAS: Un déficit de fuerza isométrica masivo (>50%) o la exigencia de infiltraciones agudas intratendinosas para jugar, DEBEN ser declarados como Bandera Roja por riesgo de lesión catastrófica o avulsión.

Importante:
- No entregues diagnósticos definitivos. Formula hipótesis clínicas razonables.
- Diferencia entre "dato registrado", "interpretación" y "dato faltante".

Analiza usando este formato y devuelve el resultado EXACTAMENTE con estos encabezados (usa markdown ##):

## 1. Resumen breve del caso
[Máximo 5 líneas]

## 2. Seguridad clínica
- Banderas rojas posibles: [Evaluar riesgos vitales o riesgos catastróficos deportivos]
- Precauciones:
- ¿Requiere derivación o profundización antes de intervenir?:
- Justificación:

## 3. Fenotipo de dolor/síntoma probable
- Fenotipo probable: [Nociceptivo, Neuropático, Nociplástico]
- Nivel de confianza: bajo / moderado / alto
- Datos que lo apoyan:
- Datos que no calzan o generan duda:

## 4. Patrón clínico probable
- Patrón principal probable:
- Hipótesis alternativa 1: [Basada en arquitectura o estructuras vecinas, NO miofascial en trauma agudo]
- Hipótesis alternativa 2:
- Datos faltantes para diferenciar:

## 5. Contribuyentes regionales / coexistentes
- Posibles contribuyentes cinemáticos o de movilidad:
- Condiciones coexistentes relevantes:
- Cómo podrían influir:

## 6. Factores influyentes
- Cognitivos / expectativas: [Evaluar "hambre de cancha" o creencias desadaptativas]
- Emocionales:
- Socioambientales / Presión externa:
- Estilo de vida / Recuperación:

## 7. Problema kinésico principal
[Redactar como: "Incapacidad funcional para (tarea) debido a (mecanismo/déficit)"]

## 8. Prioridad inicial sugerida
[Enfocado en protección tisular, gestión de expectativas o exposición inicial]

## 9. Plan inicial sugerido
- Educación / Gestión de expectativas:
- Modificación de carga:
- Ejercicio / Exposición progresiva: [Detallar tipo de contracción y objetivo, ej. isometría analgésica]
- Reevaluación:

## 10. Qué falta preguntar o evaluar
[Listar evaluaciones funcionales, de movilidad o control motor pendientes]

## 11. Indicadores para próxima sesión
[Listar 2 a 5 variables duras y medibles (LSI, RFD, dolor en pruebas específicas, etc.)]

Cierra con esta frase textual:
“Este razonamiento es una orientación clínica basada en la información registrada. Debe ser confirmado, ajustado o descartado por el profesional tratante según la evolución, la evaluación presencial y el contexto de la persona.”`;

        const userPrompt = `A continuación los apuntes del clínico:

--- ANAMNESIS PRÓXIMA ---
${anamnesisProxima || 'Información no registrada'}

--- ANAMNESIS REMOTA / CONTEXTO ---
${anamnesisRemota || 'Información no registrada'}

--- EVALUACIÓN FÍSICA ---
${evaluacionFisica || 'Información no registrada'}`;

        const result = await executeAIAction({
            screen: 'EXPRESS',
            action: 'EXPRESS_STRUCTURE',
            systemInstruction,
            userPrompt,
            inputHash,
            promptVersion: 'v2.0.0',
            temperature: 0.2,
            responseMimeType: 'text/plain',
            validator: (data) => data // Retornar el string en markdown
        });

        return NextResponse.json({
            success: true,
            data: typeof result.data === 'string' ? result.data.trim() : String(result.data),
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/express-structure:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
