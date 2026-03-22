import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { DiagnosisSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const record = rateLimitCache.get(userId);

    if (!record) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (record.count >= MAX_REQUESTS) return false;
    record.count += 1;
    return true;
}

export async function POST(req: Request) {
    try {
        const { payload, userId } = await req.json();

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // El frontend ahora ensambla la estructura compact_case_package completa
        const normalizedPayload = normalizePayload(payload);

        const inputHash = await generateSHA256(`diagnosis:${normalizedPayload}`);

        const expectedJsonExample = `{
  "snapshot_clinico": { 
    "identificacion": { "nombre": "...", "edad": "...", "sexo": "..." },
    "contexto_basal": { "ocupacion": "...", "deporte_actividad": "...", "demanda_fisica": "...", "ayudas_tecnicas": "" },
    "factores_relevantes": { "comorbilidades": ["..."], "medicamentos": ["..."], "antecedentes_msk": ["..."], "observaciones_seguridad": ["..."] },
    "foco_y_lado": "...", "irritabilidad_sugerida": "...",
    "tolerancia_carga": { "nivel": "...", "explicacion": "..." },
    "tarea_indice": "...", "alertas_clinicas": ["..."]
  },
  "clasificacion_dolor": { 
    "categoria": "nociceptivo", 
    "subtipos": ["Mecánico", "Inflamatorio"], 
    "subtipo_manual": "", 
    "fundamento": { 
      "apoyo": ["Hallazgo 1 citando P1/P2...", "Hallazgo 2...", "Hallazgo 3...", "Hallazgo 4..."], 
      "duda_mezcla": ["Dato discordante 1...", "Dato discordante 2..."], 
      "conclusion": "Párrafo integrador de 3-4 oraciones..." 
    }, 
    "nivel_confianza": "Alta" 
  },
  "sistema_y_estructuras": { 
    "sistemas_involucrados": ["musculoesquelético", "neuromuscular", "..."], 
    "estructuras": {
      "principales": [{ "nombre": "Estructura X", "argumento": "3 oraciones cruzando P1+P2..." }],
      "secundarias": [{ "nombre": "Estructura Y", "argumento": "Correlación P1/P1.5 con P2..." }],
      "asociadas_moduladoras": [{ "nombre": "Comorbilidad/Modulador", "argumento": "Párrafo de por qué modula el caso..." }]
    },
    "estructuras_mas_afectan": "Resumen integrador..." 
  },
  "alteraciones_detectadas": { 
    "estructurales": [{ "estructura": "...", "alteracion": "...", "certeza": "Probable", "fundamento": "2-3 oraciones...", "impacto_caso": "Mucho" }], 
    "funcionales": [{ "funcion_disfuncion": "...", "severidad": "Moderada", "fundamento": "Cruce P1+P2...", "dominio_sugerido": "Dolor" }]
  },
  "actividad_y_participacion": { 
    "limitaciones_directas": [{ "texto": "...", "severidad": "moderada", "detalle": "Biomecánica o lógica..." }],
    "restricciones_participacion": [{ "texto": "...", "severidad": "moderada", "detalle": "Impacto en rol..." }]
  },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": ["..."],
    "factores_personales_negativos": ["..."],
    "facilitadores_ambientales": ["..."],
    "barreras_ambientales": ["..."],
    "factores_clinicos_moduladores": ["..."],
    "observaciones_bps_integradas": "Texto narrativo de 5-6 oraciones..."
  },
  "recordatorios_y_coherencia": { 
    "recordatorios_clinicos": ["..."], 
    "cosas_a_vigilar_en_tratamiento": ["..."], 
    "faltantes_no_criticos": ["..."], 
    "incoherencias_detectadas": [] 
  }
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura y tipos exactos:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA (COMPACT CASE PACKAGE):
${normalizedPayload}
    `;

        // Sanitizador: rellena campos que el modelo lite a veces omite, SIN relajar el schema
                const sanitizeP3Response = (data: any) => {
            if (!data) return {};
            
            // A. Clasificación Dolor
            if (!data.clasificacion_dolor) data.clasificacion_dolor = {};
            if (!data.clasificacion_dolor.subtipos) data.clasificacion_dolor.subtipos = [];
            if (!data.clasificacion_dolor.fundamento) data.clasificacion_dolor.fundamento = {};
            if (!data.clasificacion_dolor.fundamento.apoyo) data.clasificacion_dolor.fundamento.apoyo = [];
            if (!data.clasificacion_dolor.fundamento.duda_mezcla) data.clasificacion_dolor.fundamento.duda_mezcla = [];
            if (!data.clasificacion_dolor.fundamento.conclusion) data.clasificacion_dolor.fundamento.conclusion = "";

            // B. Sistemas y Estructuras
            if (!data.sistema_y_estructuras) data.sistema_y_estructuras = {};
            if (!data.sistema_y_estructuras.sistemas_involucrados) data.sistema_y_estructuras.sistemas_involucrados = [];
            if (!data.sistema_y_estructuras.estructuras) data.sistema_y_estructuras.estructuras = {};
            if (!data.sistema_y_estructuras.estructuras.principales) data.sistema_y_estructuras.estructuras.principales = [];
            if (!data.sistema_y_estructuras.estructuras.secundarias) data.sistema_y_estructuras.estructuras.secundarias = [];
            if (!data.sistema_y_estructuras.estructuras.asociadas_moduladoras) data.sistema_y_estructuras.estructuras.asociadas_moduladoras = [];
            if (!data.sistema_y_estructuras.estructuras_mas_afectan) data.sistema_y_estructuras.estructuras_mas_afectan = "";

            // C. Alteraciones
            if (!data.alteraciones_detectadas) data.alteraciones_detectadas = {};
            if (!data.alteraciones_detectadas.estructurales) data.alteraciones_detectadas.estructurales = [];
            if (!data.alteraciones_detectadas.funcionales) data.alteraciones_detectadas.funcionales = [];

            // D. Actividad y Participación
            if (!data.actividad_y_participacion) data.actividad_y_participacion = {};
            if (!data.actividad_y_participacion.limitaciones_directas) data.actividad_y_participacion.limitaciones_directas = [];
            if (!data.actividad_y_participacion.restricciones_participacion) data.actividad_y_participacion.restricciones_participacion = [];

            // E. Factores Biopsicosociales
            if (!data.factores_biopsicosociales) data.factores_biopsicosociales = {};
            if (!data.factores_biopsicosociales.factores_personales_positivos) data.factores_biopsicosociales.factores_personales_positivos = [];
            if (!data.factores_biopsicosociales.factores_personales_negativos) data.factores_biopsicosociales.factores_personales_negativos = [];
            if (!data.factores_biopsicosociales.facilitadores_ambientales) data.factores_biopsicosociales.facilitadores_ambientales = [];
            if (!data.factores_biopsicosociales.barreras_ambientales) data.factores_biopsicosociales.barreras_ambientales = [];
            if (!data.factores_biopsicosociales.factores_clinicos_moduladores) data.factores_biopsicosociales.factores_clinicos_moduladores = [];
            if (!data.factores_biopsicosociales.observaciones_bps_integradas) data.factores_biopsicosociales.observaciones_bps_integradas = "";

            // F. Recordatorios y Coherencia
            if (!data.recordatorios_y_coherencia) data.recordatorios_y_coherencia = {};
            if (!data.recordatorios_y_coherencia.recordatorios_clinicos) data.recordatorios_y_coherencia.recordatorios_clinicos = [];
            if (!data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento) data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento = [];
            if (!data.recordatorios_y_coherencia.faltantes_no_criticos) data.recordatorios_y_coherencia.faltantes_no_criticos = [];
            if (!data.recordatorios_y_coherencia.incoherencias_detectadas) data.recordatorios_y_coherencia.incoherencias_detectadas = [];

            return data;
        };

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\n\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v3.9.2',
            temperature: 0.1,
            validator: (data) => DiagnosisSchema.parse(sanitizeP3Response(data))
        });

        // The UI (Screen3_Sintesis) currently expects `{ success: true, data: ..., hash, latencyMs }`
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/diagnosis:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
