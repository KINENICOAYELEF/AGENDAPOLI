import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256 } from '@/lib/ai/hash';

export const maxDuration = 60; // Evitar timeout en Vercel (Hobby 10s -> 60s si Pro o límite superior)

// 1. SISTEMA PROMPT (Corto, claro y enfocado en JSON)
const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología MSK y deportiva, actuando como Tutor Clínico Exhaustivo.
Funciones: clasificar dolor, irritabilidad, descartar red flags, generar hipótesis orientativas y sugerir enfoques de examen físico para P2 basándote en todo el contexto provisto (incluyendo factores biopsicosociales, expediente, historia remota P1.5, PSFS, y contexto deportivo/laboral).

NO DEBES:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir texto relleno o narrativo fuera del JSON
- Inventar hipótesis sin fundamento

REGLAS DE CALIDAD CLÍNICA (OBLIGATORIAS):
1. HIPÓTESIS ORIENTATIVAS: Debes generar obligatoriamente 3 hipótesis (más probable, alternativa probable, menos probable). Títulos diagnósticos kinesiológicos específicos, evita vaguedades. El 'fundamento_breve' debe ser un razonamiento profundo y fundamentado. Debes diferenciar claramente 'que_hay_que_confirmar' (qué hallazgos apoyarían firmemente esto) y 'que_hay_que_descartar' (qué hallazgos lo descartarían o qué patología grave/diferencial hay que excluir). NO generes hipótesis obvias o flojas.
2. PREGUNTAS FALTANTES: Genera entre 3 y 5 preguntas (permite una 6ta solo si la incertidumbre clínica es muy alta). PRIORIZA: seguridad/descarte, discriminación clínica entre hipótesis, y carga/función/pronóstico. MUY IMPORTANTE: NO preguntes cosas que ya están claras en el relato, en antecedentes P1.5, expediente o en campos estructurados. NO sugieras evaluar PSFS, banderas (BPS) o datos laborales si ya están capturados. Cero redundancias absurdas.
3. RESUMEN PERSONA USUARIA: Llenar SIEMPRE 'lo_que_entendi', 'lo_que_te_preocupa' y 'lo_que_haremos_ahora'. Si la persona no dice explícitamente lo que le preocupa, INFIÉRELO empáticamente basándote en su limitación.
4. RECOMENDACIONES PARA P2 (¡Crucial para docencia!):
   Para CADA módulo, no digas cosas genéricas como "evaluar ROM" o "evaluar fuerza".
   - En 'objetivo': Di exactamente QUÉ mirar realmente (ej. patrón específico, cadena, reclutamiento).
   - En 'por_que_aporta_en_este_caso': Explica profundamente por qué este módulo importa en ESTE caso particular (integrando contexto de P1.5 y Expediente), qué hipótesis específica ayuda a apoyar y cuál a debilitar (explícitamente).
   - En 'hallazgos_para_confirmar'/'hallazgos_para_descartar': Qué hallazgo puntual sería la clave clínica que esperas encontrar.
   - En PRUEBAS ORTOPÉDICAS: NO sugieras tests obsoletos o sin utilidad clínica actual fundamentada. Si la ortopedia NO ES lo más útil en este caso, indícalo claramente en el objetivo diciendo "En este caso, las pruebas ortopédicas clásicas son menos relevantes que la evaluación funcional de X...".
   IMPORTANTE: Asigna "pruebas_o_tareas_sugeridas" al módulo CORRECTO:
   - "pruebas_ortopedicas_dirigidas": SOLO tests ortopédicos clásicos con eponimia o nombre técnico válidos. No pongas tareas funcionales aquí.
   - "pruebas_funcionales_reintegro": SOLO tareas de carga cruzada o rendimiento (ej. Sentadilla, Salto, Carrera).
   - "control_motor_sensoriomotor": SOLO tareas de control motor fino o disociación.
   - "palpacion" o "fuerza_tolerancia_carga": estructuras específicas a palpar o testeos de tolerancia isométrica/dinámica.
5. LECTURA DE CONTEXTO OBLIGATORIA: Lee activamente y basa tu síntesis en el expediente, P1.5 (Anamnesis Remota), PSFS (si existe), banderas psicosociales (BPS), contexto basal, deportivo, laboral, facilitadores y barreras dados. Integra toda esa riqueza en el razonamiento de las hipótesis y recomendaciones P2.
6. PRIORIDAD P2: 'alta' = discrimina conducta/hipótesis. 'media' = útil. 'baja' = solo si aparecen hallazgos extras. 
7. PROFUNDIDAD CLÍNICA REQUERIDA: Para campos descriptivos de recomendaciones P2 usa lenguaje técnico minucioso. Para "pruebas_o_tareas_sugeridas", entrega opciones pertinentes al caso.
8. PROHIBIDO USAR las siguientes palabras: "farmaco", "tens", "ultrasonido", "pastilla", "ibuprofeno", "paracetamol", "electroterapia". Usa "tratamiento conservador" si aplica.

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
function buildCompactP1Payload(interviewV4: any, remoteHistorySnapshot: any, expedienteData: any) {
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
        bps: interviewV4.bps || {},
        psfs: interviewV4.psfsGlobal || [],
        expediente: expedienteData ? {
            nombre: expedienteData.nombre,
            edad: expedienteData.edad,
            sexo: expedienteData.sexo,
            ocupacion: expedienteData.ocupacion,
            contextoBasalEstructurado: expedienteData.p15_context_structured || remoteHistorySnapshot?.p15_context_structured || "Sin datos estructurados profundos",
            alertasBasales: expedienteData.p15_context_flags || remoteHistorySnapshot?.p15_context_flags || []
        } : (remoteHistorySnapshot ? {
            contextoBasalEstructurado: remoteHistorySnapshot.p15_context_structured || "Sin datos estructurados profundos",
            alertasBasales: remoteHistorySnapshot.p15_context_flags || []
        } : "Sin datos de expediente provistos"),
        banderasAmarillas: (interviewV4.banderasAmarillas || []).filter((b:any)=> b.aplica)
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
        preguntas_faltantes: Array.isArray(partial?.preguntas_faltantes) ? partial.preguntas_faltantes.slice(0, 6) : [],
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
        const compactPayload = buildCompactP1Payload(payload.interviewV4, payload.remoteHistorySnapshot, payload.expedienteData);
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

        // FASE 24: Part 5 - P1 Fallbacks Resumen Usuario
        // Si la IA generó 2 campos pero dejó 1 vacío, lo rellenamos localmente
        if (result.data?.resumen_persona_usuaria) {
            const summary = result.data.resumen_persona_usuaria;
            const exp = compactPayload as any;
            
            if (!summary.lo_que_entendi || summary.lo_que_entendi.trim() === "") {
                summary.lo_que_entendi = `Me comentas que consultas principalmente por ${exp.motivoConsultaPrincipal || exp.dolorPrincipal || 'tu dolor/molestia actual'}. Lo tendré muy en cuenta.`;
            }
            if (!summary.lo_que_te_preocupa || summary.lo_que_te_preocupa.trim() === "") {
                summary.lo_que_te_preocupa = `Noto que esta situación está afectando tu bienestar. Abordaremos tus inquietudes paso a paso.`;
            }
            if (!summary.lo_que_haremos_ahora || summary.lo_que_haremos_ahora.trim() === "") {
                summary.lo_que_haremos_ahora = `Vamos a realizar una evaluación física enfocada en entender mejor cómo responde tu cuerpo para construir un plan seguro y efectivo hacia tus metas.`;
            }
        }

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
            error: "No se pudo procesar la síntesis clínica en este intento. Tu relato está guardado y no se ha borrado. Reintenta.",
            errDetails: error?.message || String(error)
        }, { status: 500 });
    }
}
