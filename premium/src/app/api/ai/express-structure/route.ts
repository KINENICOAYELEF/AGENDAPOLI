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

### REGLAS DE RAZONAMIENTO CLÍNICO (NIVEL SUPERVISOR EXPERTO):

1. **DIAGNÓSTICO PARSIMONIOSO (Ley de Ockham)**:
   - Si el cuadro presenta un macrotrauma agudo claro (ej. sprint, caída, rotura confirmada), NO sugieras síndromes de dolor crónico (ej. miofascial, fibromialgia) como hipótesis alternativas. 
   - Las hipótesis alternativas en lesiones agudas deben orientarse a la gravedad arquitectónica (ej. clasificación BAMIC en isquiotibiales, compromiso de tendón central, afectación de estructuras adyacentes o de nervios periféricos).

2. **EVALUACIÓN PSICOSOCIAL CONTEXTUALIZADA**:
   - NO sugieras escalas de Kinesiofobia (TSK) o Catastrofización (PCS) por defecto.
   - Analiza la narrativa del paciente: Si demuestra urgencia temeraria por retornar al deporte ("hambre de cancha") o solicita intervenciones de alto riesgo (infiltraciones para jugar), enfoca el análisis en la "Gestión de Expectativas", "Comportamientos de Riesgo" o "Readiness to Return to Sport". 
   - Reserva las escalas de miedo/evitación solo para pacientes que explícitamente demuestren temor al movimiento.

3. **INDICADORES DE PROGRESIÓN OBJETIVOS (Kine Deportiva)**:
   - NUNCA propongas cargas absolutas inventadas (ej. "levantar 20kg").
   - Utiliza métricas deportivas: Limb Symmetry Index (LSI), Porcentaje de déficit bilateral, Tasa de Desarrollo de Fuerza (RFD), o métricas de dinamometría.
   - Los criterios para el Return to Play (RTP) o Return to Train (RTC) deben incluir la tolerancia asintomática a la carga excéntrica específica del gesto (ej. Askling H-Test, Nordic) y exposición a alta velocidad (Sprinting), no solo "ausencia de dolor".

4. **TERAPIA ACTIVA VS. PASIVA**:
   - Penaliza implícitamente los historiales basados puramente en modalidades pasivas (masajes, elongación estática, electroterapia).
   - Prioriza intervenciones centradas en la capacidad de tolerancia a la carga del tejido, exposición gradual y control motor dinámico.

5. **BANDERAS ROJAS EN EL ALTO RENDIMIENTO**:
   - Amplía el concepto de "Bandera Roja": Un riesgo inminente de daño estructural catastrófico (ej. jugar con déficit >50% de fuerza isométrica, infiltraciones agudas intratendinosas) debe ser alertado en la sección de Seguridad Clínica como una bandera roja deportiva que requiere detención inmediata.

Importante:
- No entregues diagnósticos definitivos.
- Formula hipótesis clínicas razonables.
- Diferencia claramente entre "dato registrado", "interpretación posible" y "dato faltante".
- Considera adultos mayores (fragilidad, polifarmacia, red de apoyo).

Analiza usando este marco:
1. Seguridad clínica y banderas
2. Fenotipo dominante de dolor/síntoma
3. Patrón clínico probable
4. Contribuyentes regionales
5. Factores influyentes (Cognitivos, emocionales, socioambientales)
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
- En adulto mayor, comentar caídas, cuidador, independencia y barreras:

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
