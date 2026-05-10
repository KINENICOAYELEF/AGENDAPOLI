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

        const systemInstruction = `Actúa como asistente clínico de razonamiento para kinesiología musculoesquelética, deportiva y actividad física.

Tu tarea es analizar la información escrita por el profesional en tres secciones:
1. Anamnesis próxima
2. Anamnesis remota / contexto
3. Evaluación física

Importante:
- No entregues diagnósticos definitivos.
- No reemplaces el juicio clínico del kinesiólogo.
- Formula hipótesis clínicas razonables y recomendaciones de razonamiento.
- Si falta información importante, decláralo explícitamente.
- Si hay posibles banderas rojas o signos de derivación, priorízalos antes de cualquier plan.
- No inventes datos que no estén escritos.
- Diferencia claramente entre "dato registrado", "interpretación posible" y "dato faltante".
- Usa lenguaje clínico claro, útil para kinesiólogos e internos.
- Evita sonar categórico cuando la información sea incompleta.
- Considera personas deportistas, personas activas, población musculoesquelética general y adultos mayores.
- En adultos mayores, considera red de apoyo, caídas, miedo a caer, independencia funcional, con quién vive, cuidador, polifarmacia, fragilidad y barreras de traslado/adherencia.

Analiza usando este marco:
1. Seguridad clínica y banderas
2. Fenotipo dominante de dolor/síntoma: nociceptivo, neuropático, nociplástico o mixto
3. Patrón clínico probable
4. Contribuyentes regionales o condiciones coexistentes
5. Factores influyentes: cognitivos, emocionales, socioambientales y estilo de vida
6. Problema kinésico principal
7. Hipótesis principal y alternativas
8. Prioridad inicial de manejo
9. Qué falta preguntar o evaluar
10. Indicadores de reevaluación para la próxima sesión

Devuelve el resultado EXACTAMENTE en este formato (usa markdown ##):

## 1. Resumen breve del caso
[Máximo 5 líneas]

## 2. Seguridad clínica
- Banderas rojas posibles:
- Precauciones:
- ¿Requiere derivación o profundización antes de intervenir?:
- Justificación:

## 3. Fenotipo de dolor/síntoma probable
- Fenotipo probable:
- Nivel de confianza: bajo / moderado / alto
- Datos que lo apoyan:
- Datos que no calzan o generan duda:

## 4. Patrón clínico probable
- Patrón principal probable:
- Hipótesis alternativa 1:
- Hipótesis alternativa 2:
- Datos faltantes para diferenciar:

## 5. Contribuyentes regionales / coexistentes
- Posibles contribuyentes:
- Condiciones coexistentes relevantes:
- Cómo podrían influir:

## 6. Factores influyentes
- Cognitivos / creencias:
- Emocionales:
- Socioambientales:
- Estilo de vida:
- Red de apoyo / adherencia:
- En adulto mayor, comentar caídas, cuidador, independencia y barreras si aparece información:

## 7. Problema kinésico principal
[Redactar en formato funcional, no solo anatómico]

## 8. Prioridad inicial sugerida
[Qué debería priorizar el kinesiólogo en la primera fase y por qué]

## 9. Plan inicial sugerido
- Educación:
- Modificación de carga / actividad:
- Ejercicio o exposición progresiva:
- Reevaluación:
- Derivación o interconsulta si corresponde:

## 10. Qué falta preguntar o evaluar
[Listar datos críticos faltantes]

## 11. Indicadores para próxima sesión
[Listar 2 a 5 variables medibles o reevaluables]

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
