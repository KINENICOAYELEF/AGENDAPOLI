import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { P1SynthesisSchema } from '@/lib/ai/schemas';
import { generateSHA256 } from '@/lib/ai/hash';

export const maxDuration = 60; // Evitar timeout en Vercel (Hobby 10s -> 60s si Pro o límite superior)

// 1. SISTEMA PROMPT (Corto, claro y enfocado en JSON)
const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología MSK y deportiva, actuando como Tutor Clínico Exhaustivo, Moderno y Pedagógico de nivel avanzado.
Tu objetivo es guiar al estudiante entregando razonamientos clínicos profundos, limpios y basados en evidencia moderna, integrando el contexto vital del paciente.

NO DEBES:
- Entregar diagnósticos médicos basados en imágenes (ej. "Ruptura de menisco"). Usa términos funcionales/clínicos.
- **PROHIBIDO USAR JERGA TÉCNICA INTERNA EN LOS CAMPOS VISIBLES**: No uses "H1", "H2", "H3", "Gana fuerza", "Pierde fuerza", "Hipótesis alternativa", "✅", "❌", "🔍", "Qué buscar", "Confirmar", "Descartar" como encabezados. Entrega solo contenido clínico puro.
- **PROHIBIDO RECOMENDAR PRUEBAS OBSOLETAS O DE BAJO VALOR**: Gillet, standing flexion test, long sit test, palpación segmentaria vertebral sin provocación, o tests tradicionales aislados sin cluster/evidencia. Esto aplica a TODAS las regiones (hombro, rodilla, columna, etc.).
- **NO REPETIR LO OBVIO**: No preguntes nada que ya esté claro en el relato o en los datos de P1.5/Expediente.

REGLAS DE CALIDAD CLÍNICA (OBLIGATORIAS):
1. **INTEGRACIÓN EXPLÍCITA DE P1.5 / EXPEDIENTE**: Debes leer y usar activamente condiciones clínicas, fármacos, antecedentes MSK, actividad física, carga laboral, sueño, estrés, red de apoyo y barreras logísticas. Estos datos DEBEN modular el resumen, el SINS, las hipótesis y la elección del examen físico.
2. **5 GRUPOS CONTEXTUALES (BPS)**: Separa estrictamente en: "Alertas/Riesgo", "Factores Personales Positivos", "Factores Personales Negativos", "Facilitadores" y "Barreras". Incluye sueño, estrés, carga y adherencia histórica donde corresponda.
3. **RECOMENDACIONES DOCENTES P2 (CIENCIA Y RAZONAMIENTO)**: 
   Cada módulo debe ser una micro-clase clínica. Sugiere entre 3 y 6 tareas/tests específicos y modernos por módulo.
   - "objetivo": El norte clínico del módulo (ej: "Aclarar patrón mecánico de carga en tendón vs bursa").
   - "razonamiento_clinico": Microjustificación docente de por qué importa en ESTE caso particular (ej: "Dado que el dolor es intermitente y post-carga, este módulo descartará sensibilización periférica").
   - "hallazgo_fortalece_hipotesis": Qué hallazgo específico daría peso a la sospecha principal.
   - "hallazgo_debilita_hipotesis": Qué hallazgo obligaría a pensar en otras hipótesis.
   - "diferencial_que_descarta": Qué otra posible causa ayuda a descartar este módulo.
   - "impacto_resultado_positivo/negativo": Cómo cambia el razonamiento clínico según el resultado.
   - **OBLIGATORIO**: Todos los campos de texto deben estar llenos con contenido pedagógico real. PROHIBIDO dejar campos vacíos o con placeholders. Si un módulo es relevante, debe tener sustancia docente.

4. **HIPÓTESIS (REGLA DE 3 + DIFERENCIALES)**: 
   - 3 hipótesis principales limpias y ricas (mas_probable, probable_alternativa, menos_probable).
   - Identifica claramente diferenciales breves para el bloque de "Otras hipótesis".

5. **PREGUNTAS FALTANTES (MALA CALIDAD / BAJO NÚMERO)**: Mínimo 4 y máximo 6 preguntas no redundantes. No repitas lo que ya está en el expediente basal.

ESTRUCTURA EXACTA JSON:
{
  "resumen_clinico_editable": "string",
  "contexto_basal_usado": true,
  "resumen_persona_usuaria": { "lo_que_entendi": "string", "lo_que_te_preocupa": "string", "lo_que_haremos_ahora": "string" },
  "alicia": { "agravantes": "string", "atenuantes": "string", "localizacion_extension": "string", "intensidad_actual": "string", "intensidad_mejor_24h": "string", "intensidad_peor_24h": "string", "caracter_naturaleza": "string", "irritabilidad_relato": "string", "antiguedad_inicio": "string", "historia_mecanismo": "string" },
  "sins": { "severidad": "string", "irritabilidad_global": "string", "naturaleza_sugerida": "string", "etapa": "string", "facilidad_provocacion": "string", "momento_aparicion": "string", "tiempo_a_calmarse": "string", "after_effect": "string" },
  "foco_principal": { "region": "string", "lado": "string", "queja_prioritaria": "string", "actividad_indice": "string", "semaforo_carga_sugerido": "string" },
  "hipotesis_orientativas": [ { "ranking": 1, "titulo": "string", "probabilidad": "mas_probable|probable_alternativa|menos_probable", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" } ],
  "diferenciales_breves": ["string"],
  "preguntas_faltantes": [ { "pregunta": "string", "por_que_importa": "string", "prioridad": "alta|media" } ],
  "recomendaciones_p2_por_modulo": {
    "ANY_MODULE_NAME": { 
        "objetivo": "string", 
        "razonamiento_clinico": "string", 
        "hallazgo_fortalece_hipotesis": "string",
        "hallazgo_debilita_hipotesis": "string",
        "diferencial_que_descarta": "string",
        "impacto_resultado_positivo": "string", 
        "impacto_resultado_negativo": "string", 
        "pruebas_o_tareas_sugeridas": ["string"], 
        "prioridad": "alta|media|baja" 
    }
  },
  "puntos_clave_p2": ["string"],
  "factores_contextuales_clave": { 
    "banderas_rojas": ["string"], 
    "banderas_amarillas": ["string"], 
    "factores_personales_positivos": ["string"], 
    "factores_personales_negativos": ["string"],
    "facilitadores": ["string"], 
    "barreras": ["string"] 
  }
}
`;

// 2. FUNCIÓN PARA COMPACTAR EL PAYLOAD (Solo datos clínicos)
function buildCompactP1Payload(interviewV4: any, remoteHistorySnapshot: any, p1_context_for_ai: any) {
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
        // Nueva estructura robusta Fase 36 + Prompt 2.8
        expediente_basal: {
            ...p1_context_for_ai,
            contexto_basal_estructurado: remoteHistorySnapshot?.p15_context_structured || "Sin datos estructuralizados",
            alertas_basales: remoteHistorySnapshot?.p15_context_flags || [],
            snapshot_completo_remote: !!remoteHistorySnapshot
        },
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
        razonamiento_clinico: mod?.razonamiento_clinico || "",
        hallazgo_fortalece_hipotesis: mod?.hallazgo_fortalece_hipotesis || "",
        hallazgo_debilita_hipotesis: mod?.hallazgo_debilita_hipotesis || "",
        diferencial_que_descarta: mod?.diferencial_que_descarta || "",
        impacto_resultado_positivo: mod?.impacto_resultado_positivo || "",
        impacto_resultado_negativo: mod?.impacto_resultado_negativo || "",
        pruebas_o_tareas_sugeridas: Array.isArray(mod?.pruebas_o_tareas_sugeridas) ? mod.pruebas_o_tareas_sugeridas : [],
        prioridad: mod?.prioridad || "media"
    };
}

// 4. HIDRATACIÓN MINIMA DE DEFAULTS PARA NO CAERSE ENTERO
function hydrateP1SynthesisDefaults(partial: any) {
    return {
        resumen_clinico_editable: partial?.resumen_clinico_editable || "",
        contexto_basal_usado: !!partial?.contexto_basal_usado,
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
        diferenciales_breves: Array.isArray(partial?.diferenciales_breves) ? partial.diferenciales_breves : [],
        puntos_clave_p2: Array.isArray(partial?.puntos_clave_p2) ? partial.puntos_clave_p2 : [],
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
            factores_personales_positivos: partial?.factores_contextuales_clave?.factores_personales_positivos || [],
            factores_personales_negativos: partial?.factores_contextuales_clave?.factores_personales_negativos || [],
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
        const compactPayload = buildCompactP1Payload(payload.interviewV4, payload.remoteHistorySnapshot, payload.p1_context_for_ai);
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
