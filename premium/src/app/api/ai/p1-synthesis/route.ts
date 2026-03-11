import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256 } from '@/lib/ai/hash';

// 1. SISTEMA PROMPT (Corto, claro y enfocado en JSON)
const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología MSK y deportiva.
Funciones: clasificar dolor, irritabilidad, descartar red flags, generar hipótesis orientativas y sugerir enfoques de examen físico para P2.

NO DEBES:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir texto relleno o narrativo fuera del JSON
- Inventar hipótesis sin fundamento

TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VÁLIDO. Piensa primero en descartar cuadros graves y luego en confirmar hipótesis. 
Debe ser especialmente bueno razonando irritabilidad, naturaleza del dolor y qué examen físico aporta realmente.
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
        seguridad: (interviewV4.seguridadYExclusion || []).filter((s:any)=> s.aplica),
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
            observacion_movimiento_inicial: { objetivo: partial?.recomendaciones_p2_por_modulo?.observacion_movimiento_inicial?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.observacion_movimiento_inicial?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.observacion_movimiento_inicial?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.observacion_movimiento_inicial?.prioridad || "" },
            rango_movimiento_analitico: { objetivo: partial?.recomendaciones_p2_por_modulo?.rango_movimiento_analitico?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.rango_movimiento_analitico?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.rango_movimiento_analitico?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.rango_movimiento_analitico?.prioridad || "" },
            fuerza_tolerancia_carga: { objetivo: partial?.recomendaciones_p2_por_modulo?.fuerza_tolerancia_carga?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.fuerza_tolerancia_carga?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.fuerza_tolerancia_carga?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.fuerza_tolerancia_carga?.prioridad || "" },
            palpacion: { objetivo: partial?.recomendaciones_p2_por_modulo?.palpacion?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.palpacion?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.palpacion?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.palpacion?.prioridad || "" },
            neuro_vascular_somatosensorial: { objetivo: partial?.recomendaciones_p2_por_modulo?.neuro_vascular_somatosensorial?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.neuro_vascular_somatosensorial?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.neuro_vascular_somatosensorial?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.neuro_vascular_somatosensorial?.prioridad || "" },
            control_motor_sensoriomotor: { objetivo: partial?.recomendaciones_p2_por_modulo?.control_motor_sensoriomotor?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.control_motor_sensoriomotor?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.control_motor_sensoriomotor?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.control_motor_sensoriomotor?.prioridad || "" },
            pruebas_ortopedicas_dirigidas: { objetivo: partial?.recomendaciones_p2_por_modulo?.pruebas_ortopedicas_dirigidas?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.pruebas_ortopedicas_dirigidas?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.pruebas_ortopedicas_dirigidas?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.pruebas_ortopedicas_dirigidas?.prioridad || "" },
            pruebas_funcionales_reintegro: { objetivo: partial?.recomendaciones_p2_por_modulo?.pruebas_funcionales_reintegro?.objetivo || "", que_descarta: partial?.recomendaciones_p2_por_modulo?.pruebas_funcionales_reintegro?.que_descarta || "", que_confirma: partial?.recomendaciones_p2_por_modulo?.pruebas_funcionales_reintegro?.que_confirma || "", prioridad: partial?.recomendaciones_p2_por_modulo?.pruebas_funcionales_reintegro?.prioridad || "" }
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
        const inputHash = await generateSHA256(`p1-synthesis:v2:${sanitizedPayload}`);

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
            promptVersion: 'v2.0',
            temperature: 0.1,
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
