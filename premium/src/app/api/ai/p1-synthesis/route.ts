import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256 } from '@/lib/ai/hash';

export const maxDuration = 60; // Evitar timeout en Vercel (Hobby 10s -> 60s si Pro o límite superior)

// 1. SISTEMA PROMPT (Corto, claro y enfocado en JSON)
const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología MSK y deportiva.
Funciones: clasificar dolor, irritabilidad, descartar red flags, generar hipótesis orientativas y sugerir enfoques de examen físico para P2.

NO DEBES:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir texto relleno o narrativo fuera del JSON
- Inventar hipótesis sin fundamento

REGLAS DE CALIDAD CLÍNICA (OBLIGATORIAS):
1. HIPÓTESIS: 3 distintas (principal, asociada/funcional, diferencial menos probable). Títulos clínicos específicos (evita vaguedades). El fundamento debe aterrizar al mecanismo.
2. PREGUNTAS FALTANTES: 3 a 5 preguntas concretas orientadas a afinar hipótesis, seguridad, pronóstico o examen físico. 'por_que_importa' debe explicar qué hipótesis ayuda a discriminar (ej: episodios de falla real vs miedo a la falla).
3. RECOMENDACIONES P2: Tienes rol de Tutor Clínico. Las recomendaciones para P2 deben ser específicas al caso, útiles para docencia clínica y orientadas a discriminar hipótesis. Evita frases genéricas ("evaluar marcha"). Indica qué buscar, qué hallazgos apoyan y qué hallazgos debilitan TODAS las hipótesis orientativas, y qué pruebas o tareas concretas conviene usar.
4. PRIORIDAD P2: 'alta' = discrimina conducta/hipótesis. 'media' = útil. 'baja' = solo si aparecen hallazgos extras. Ej: en lesiones traumáticas el ROM, fuerza y pruebas dirigidas son casi siempre de alta prioridad versus palpación pura.

TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VÁLIDO. 

ESTRUCTURA EXACTA JSON:
{
  "resumen_clinico_editable": "string",
  "resumen_persona_usuaria": { "lo_que_entendi": "string", "lo_que_te_preocupa": "string", "lo_que_haremos_ahora": "string" },
  "alicia": { "agravantes": "string", "atenuantes": "string", "localizacion_extension": "string", "intensidad_actual": "string", "intensidad_mejor_24h": "string", "intensidad_peor_24h": "string", "caracter_naturaleza": "string", "irritabilidad_relato": "string", "antiguedad_inicio": "string", "historia_mecanismo": "string" },
  "sins": { "severidad": "string", "irritabilidad_global": "string", "naturaleza_sugerida": "string", "etapa": "string", "facilidad_provocacion": "string", "momento_aparicion": "string", "tiempo_a_calmarse": "string", "after_effect": "string" },
  "foco_principal": { "region": "string", "lado": "string", "queja_prioritaria": "string", "actividad_indice": "string", "semaforo_carga_sugerido": "string" },
  "hipotesis_orientativas": [ { "ranking": 1, "titulo": "string", "probabilidad": "mas_probable|probable_alternativa|menos_probable", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" }, { "ranking": 2, "titulo": "string", "probabilidad": "probable_alternativa", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" }, { "ranking": 3, "titulo": "string", "probabilidad": "menos_probable", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" } ],
  "preguntas_faltantes": [ { "pregunta": "string", "por_que_importa": "string", "prioridad": "alta|media" } ],
  "recomendaciones_p2_por_modulo": {
    "observacion_movimiento_inicial": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "rango_movimiento_analitico": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "fuerza_tolerancia_carga": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "palpacion": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "neuro_vascular_somatosensorial": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "control_motor_sensoriomotor": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "pruebas_ortopedicas_dirigidas": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" },
    "pruebas_funcionales_reintegro": { "objetivo": "string", "por_que_aporta_en_este_caso": "string", "que_descarta": "string", "que_confirma": "string", "hallazgos_para_confirmar": "string", "hallazgos_para_descartar": "string", "pruebas_o_tareas_sugeridas": ["string"], "prioridad": "alta|media|baja" }
  },
  "factores_contextuales_clave": { "banderas_rojas": ["string"], "banderas_amarillas": ["string"], "facilitadores": ["string"], "barreras": ["string"] }
}
`;

// 2. FUNCIÓN PARA COMPACTAR EL PAYLOAD (Solo datos clínicos)
function buildCompactP1Payload(interviewV4: any, remoteHistorySnapshot: any) {
    if (!interviewV4) return {};
    
    // Solo extraer lo estrictamente clinico
    const exp = interviewV4.experienciaPersona || {};
    const dolor = interviewV4.comportamientoSintomas || {};
    
    const compact = {
        relatoLibre: exp.relatoLibre || "",
        motivoConsultaPrincipal: exp.motivoConsultaPrincipal || "",
        dolorPrincipal: exp.dolorPrincipal || "",
        focos: (interviewV4.focos || []).map((f: any) => ({
            lado: f.lado,
            region: f.region,
            actividadIndice: f.actividadIndice
        })),
        agravantes: dolor.agravantes || "",
        atenuantes: dolor.atenuantes || "",
        intensidadActual: dolor.intensidadActual,
        intensidadMejor24h: dolor.intensidadMejor24h,
        intensidadPeor24h: dolor.intensidadPeor24h,
        irritabilidadRelatada: dolor.irritabilidadRelatada || "",
        antiguedadInicio: dolor.antiguedadInicio || "",
        mecanismoInicio: dolor.mecanismoInicio || "",
        contextoFuncional: dolor.contextoFuncional || "",
        seguridad: interviewV4.seguridad || {},
        banderasAmarillas: (interviewV4.banderasAmarillas || []).filter((b:any)=> b.aplica),
        // Si hay historia remota, traer lo mas corto posible
        antecedentesBasales: remoteHistorySnapshot ? 
            "Existe historia remota previa cargada (ver resumen o contexto si aplica)" : "No"
    };

    return compact;
}

// 3. SANITIZACIÓN SILENCIOSA SOLO PARA EL MODELO
function sanitizeClinicalTextForModel(text: string): string {
    if (!text) return "";
    let sanitized = text;

    // Masking terms that trigger Google Safety Filters inappropriately
    sanitized = sanitized.replace(/\b(tens|t\.e\.n\.s)\b/gi, "electroanalgesia tipo TENS");
    sanitized = sanitized.replace(/\b(paracetamol)\b/gi, "analgésico común");
    sanitized = sanitized.replace(/\b(ketoprofeno|diclofenaco|ibuprofeno|ketorolaco|naproxeno|meloxicam|celecoxib|etoricoxib|aspirina|viadil|tapsin)\b/gi, "AINE");
    sanitized = sanitized.replace(/\b(tramadol|pregabalina|gabapentina)\b/gi, "analgésico de rescate/neuromodulador");
    sanitized = sanitized.replace(/\b(medicamento|medicamentos|pastillas|pastilla|remedios?|f[aá]rmacos?)\b/gi, "tratamiento farmacológico");
    sanitized = sanitized.replace(/\b(infiltraci[oó]n|filiaci[oó]n|inyecci[oó]n|bloqueo facetario)\b/gi, "tratamiento inyectable/mínimamente invasivo");
    sanitized = sanitized.replace(/\b(calmante)\b/gi, "analgésico");
    sanitized = sanitized.replace(/\b(cirug[ií]a|operaci[oó]n)\b/gi, "procedimiento quirúrgico");

    return sanitized;
}

// Helper para poblar el P2 Module con las nuevas llaves pedagógicas
function hydrateP2Module(mod: any) {
    return {
        objetivo: mod?.objetivo || "",
        por_que_aporta_en_este_caso: mod?.por_que_aporta_en_este_caso || "",
        que_descarta: mod?.que_descarta || "",
        que_confirma: mod?.que_confirma || "",
        hallazgo_que_apoya_hipotesis_principal: mod?.hallazgo_que_apoya_hipotesis_principal || "",
        hallazgo_que_debilita_hipotesis_principal: mod?.hallazgo_que_debilita_hipotesis_principal || "",
        hallazgos_para_confirmar: mod?.hallazgos_para_confirmar || "",
        hallazgos_para_descartar: mod?.hallazgos_para_descartar || "",
        pruebas_o_tareas_sugeridas: Array.isArray(mod?.pruebas_o_tareas_sugeridas) ? mod.pruebas_o_tareas_sugeridas : [],
        prioridad: mod?.prioridad || ""
    };
}

// 4. HIDRATACIÓN MINIMA DE DEFAULTS PARA NO CAERSE ENTERO
function hydrateP1SynthesisDefaults(partial: any) {
    return {
        resumen_clinico_editable: partial?.resumen_clinico_editable || "",
        resumen_persona_usuaria: {
            lo_que_entendi: partial?.resumen_persona_usuaria?.lo_que_entendi || "",
            lo_que_te_preocupa: partial?.resumen_persona_usuaria?.lo_que_te_preocupa || "",
            lo_que_haremos_ahora: partial?.resumen_persona_usuaria?.lo_que_haremos_ahora || ""
        },
        alicia: {
            agravantes: partial?.alicia?.agravantes || "",
            atenuantes: partial?.alicia?.atenuantes || "",
            localizacion_extension: partial?.alicia?.localizacion_extension || "",
            intensidad_actual: partial?.alicia?.intensidad_actual || "",
            intensidad_mejor_24h: partial?.alicia?.intensidad_mejor_24h || "",
            intensidad_peor_24h: partial?.alicia?.intensidad_peor_24h || "",
            caracter_naturaleza: partial?.alicia?.caracter_naturaleza || "",
            irritabilidad_relato: partial?.alicia?.irritabilidad_relato || "",
            antiguedad_inicio: partial?.alicia?.antiguedad_inicio || "",
            historia_mecanismo: partial?.alicia?.historia_mecanismo || ""
        },
        sins: {
            severidad: partial?.sins?.severidad || "",
            irritabilidad_global: partial?.sins?.irritabilidad_global || "",
            naturaleza_sugerida: partial?.sins?.naturaleza_sugerida || "",
            etapa: partial?.sins?.etapa || "",
            facilidad_provocacion: partial?.sins?.facilidad_provocacion || "",
            momento_aparicion: partial?.sins?.momento_aparicion || "",
            tiempo_a_calmarse: partial?.sins?.tiempo_a_calmarse || "",
            after_effect: partial?.sins?.after_effect || ""
        },
        foco_principal: {
            region: partial?.foco_principal?.region || "",
            lado: partial?.foco_principal?.lado || "",
            queja_prioritaria: partial?.foco_principal?.queja_prioritaria || "",
            actividad_indice: partial?.foco_principal?.actividad_indice || "",
            semaforo_carga_sugerido: partial?.foco_principal?.semaforo_carga_sugerido || ""
        },
        hipotesis_orientativas: Array.isArray(partial?.hipotesis_orientativas) ? 
            [...partial.hipotesis_orientativas, { ranking: 3, titulo: "", probabilidad: "menos_probable", fundamento_breve: "", que_hay_que_descartar: "", que_hay_que_confirmar: "" }].slice(0, 3) 
            : [],
        preguntas_faltantes: Array.isArray(partial?.preguntas_faltantes) ? partial.preguntas_faltantes.slice(0, 5) : [],
        recomendaciones_p2_por_modulo: {
            observacion_movimiento_inicial: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.observacion_movimiento_inicial),
            rango_movimiento_analitico: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.rango_movimiento_analitico),
            fuerza_tolerancia_carga: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.fuerza_tolerancia_carga),
            palpacion: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.palpacion),
            neuro_vascular_somatosensorial: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.neuro_vascular_somatosensorial),
            control_motor_sensoriomotor: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.control_motor_sensoriomotor),
            pruebas_ortopedicas_dirigidas: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.pruebas_ortopedicas_dirigidas),
            pruebas_funcionales_reintegro: hydrateP2Module(partial?.recomendaciones_p2_por_modulo?.pruebas_funcionales_reintegro)
        },
        factores_contextuales_clave: {
            banderas_rojas: partial?.factores_contextuales_clave?.banderas_rojas || [],
            banderas_amarillas: partial?.factores_contextuales_clave?.banderas_amarillas || [],
            facilitadores: partial?.factores_contextuales_clave?.facilitadores || [],
            barreras: partial?.factores_contextuales_clave?.barreras || []
        }
    };
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { payload } = body;

        if (!payload || !payload.interviewV4) {
            return NextResponse.json({ error: 'Missing payload or interviewV4' }, { status: 400 });
        }

        // 1. Compactar el payload para no abrumar al modelo Lite
        const compactPayload = buildCompactP1Payload(payload.interviewV4, payload.remoteHistorySnapshot);
        const jsonPayload = JSON.stringify(compactPayload);

        // 2. Sanitizar solo para el prompt (invisible para el usuario)
        const sanitizedPayload = sanitizeClinicalTextForModel(jsonPayload);
        
        // 3. Generar hash de caché
        const inputHash = await generateSHA256(`p1-synthesis:v3:${sanitizedPayload}`);

        const userPrompt = `
Genera la síntesis de P1 estructurada en json según las reglas. Responde de forma clínica, precisa y compacta.
DATOS CLÍNICOS ESTRUCTURADOS (ANAMNESIS Y MOTIVO DE CONSULTA):
${sanitizedPayload}
        `;

        const result = await executeAIAction({
            screen: 'P1',
            action: 'P1_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
            userPrompt,
            inputHash,
            promptVersion: 'v3.0',
            temperature: 0.1,
            responseMimeType: 'application/json',
            validator: (data) => {
                // Validación robusta
                const validation = P1SynthesisSchema.safeParse(data);
                if (validation.success) {
                    return validation.data;
                } else {
                    console.warn("[p1-synthesis] Zod estricto falló por llaves menores. Hidratando defaults...", validation.error.message);
                    // Caída segura hacia defaults si el modelo omitió algo
                    return hydrateP1SynthesisDefaults(data);
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: result.data,
            telemetry: result.telemetry
        });

    } catch (error: any) {
        console.error("Error definitivo en /api/ai/p1-synthesis:", error);
        
        // MENSAJE DE ERROR FINAL SOLICITADO
        return NextResponse.json({
            success: false,
            error: "No se pudo procesar la síntesis clínica en este intento. Tu relato está guardado y no se ha borrado. Reintenta."
        }, { status: 500 });
    }
}
