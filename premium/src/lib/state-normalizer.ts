import { EvaluacionInicial } from "@/types/clinica";
import { buildP2SummaryStructured } from "@/utils/synthesis/builder";
// FASE 63 Fix B: import formatters to rebuild p15 fresh (never use stale cached version)
import { buildP15Structured, buildP15Flags } from "@/utils/remoteHistoryFormatter";

export interface NormalizedCase {
    identificacion: string;
    focoPrincipal: any | null; // Tipado crudo por ahora, KineFocusArea ideal
    ladoPrincipal: string;
    quejaPrioritaria: string;
    irritabilidad: "Alta" | "Media" | "Baja" | "No definida";
    tareaIndice: string;
    modalidadExamen: string;
    hallazgosP2: any | null; // guidedExam reference
    remoteHistory: any | null;
    p3Structured: any | null; // autoSynthesis reference
    p4Structured: any | null; // geminiDiagnostic reference
}

export function normalizeEvaluationState(payload: Partial<EvaluacionInicial>): NormalizedCase {
    // 1. EXTRAER FOCO PRINCIPAL
    const v4 = payload.interview?.v4;
    const v3 = payload.interview?.v3;
    const legacy = payload.interview;

    let foco = null;
    let lado = "No definido";

    if (v4?.focos && v4.focos.length > 0) {
        foco = v4.focos.find(f => f.esPrincipal) || v4.focos[0];
        lado = foco?.lado || "No definido";
    } else if ((v3 as any)?.focos && (v3 as any).focos.length > 0) {
        // Migration support for v3/legacy
        foco = (v3 as any).focos.find((f: any) => f.isPrimary || f.isPrincipal) || (v3 as any).focos[0];
        lado = (foco as any)?.lado || (foco as any)?.side || "No definido";
    } else if ((legacy as any)?.focos && (legacy as any).focos.length > 0) {
        foco = (legacy as any).focos.find((f: any) => f.isPrincipal) || (legacy as any).focos[0];
        lado = (foco as any)?.lado || (foco as any)?.side || "No definido";
    }

    // 2. EXTRAER TAREA ÍNDICE / SIGNO COMPARABLE (Top Priority to P2 directly)
    const exam = (payload.guidedExam as any) || {};
    let tareaIndice = "";
    if (exam.retestGesture && exam.retestGesture.trim() !== "") {
        tareaIndice = exam.retestGesture;
    } else if (foco?.signoComparable && foco.signoComparable.trim() !== "") {
        tareaIndice = foco.signoComparable;
    } else if (foco?.actividadIndice && foco.actividadIndice.trim() !== "") {
        tareaIndice = foco.actividadIndice;
    } else if (v4?.experienciaPersona?.objetivos && v4.experienciaPersona.objetivos.length > 0) {
        tareaIndice = v4.experienciaPersona.objetivos[0].actividad || "";
    }

    // 3. EXTRAER IRRITABILIDAD
    let irritabilidad: "Alta" | "Media" | "Baja" | "No definida" = "No definida";
    if (v4?.analisisIA?.SINS?.irritabilidad?.irritabilidad_global?.valor) {
        irritabilidad = v4.analisisIA.SINS.irritabilidad.irritabilidad_global.valor as any;
    } else if (foco?.irritabilidadAuto?.nivel) {
        irritabilidad = foco.irritabilidadAuto.nivel as any;
    }

    // 4. EXTRAER MODALIDAD EXAMEN
    const modalidadExamen = exam.examModality || "Completo";

    // 5. QUEJA PRIORITARIA
    let quejaPrioritaria = "No definida";
    if (v4?.experienciaPersona?.prioridadPrincipal) {
        quejaPrioritaria = v4.experienciaPersona.prioridadPrincipal;
    }

    // 6. IDENTIFICACIÓN
    const pat = (payload as any).paciente || {};
    let identificacion = "Sin nombre cargado";
    if (pat.fullName || pat.nombres) {
        identificacion = pat.fullName || `${pat.nombres} ${pat.apellidos || ''}`.trim();
        const age = pat.fechaNacimiento ? Math.floor((Date.now() - new Date(pat.fechaNacimiento).getTime()) / (1000 * 60 * 60 * 24 * 365.25)) : pat.edad;
        const sex = pat.sexoRegistrado || pat.sexoBiomecanico;
        
        if (age || sex) {
            identificacion += ` (${age ? age + ' años' : ''}${age && sex ? ', ' : ''}${sex || ''})`;
        }
    }

    return {
        identificacion,
        focoPrincipal: foco,
        ladoPrincipal: lado,
        quejaPrioritaria,
        irritabilidad,
        tareaIndice,
        modalidadExamen,
        hallazgosP2: exam,
        remoteHistory: payload.remoteHistorySnapshot || null,
        p3Structured: payload.autoSynthesis || null,
        p4Structured: payload.geminiDiagnostic || null
    };
}

// =========================================================================
// TOKENS COMPACTION REDUCTION SYSTEM
// =========================================================================

export function buildCompactInterviewForAI(normalized: NormalizedCase, interviewRaw: any) {
    const v4 = interviewRaw?.v4 || {};
    const bps = v4.bps || {};
    const seg = v4.seguridad || {};

    const bpsArray = [];
    if (bps.sueno > 5) bpsArray.push(`Alteración sueño (${bps.sueno}/10)`);
    if (bps.estres > 5) bpsArray.push(`Estrés alto (${bps.estres}/10)`);
    if (bps.miedoMoverCargar > 5) bpsArray.push(`Kinesiofobia (${bps.miedoMoverCargar}/10)`);
    if (bps.confianzaBaja > 5) bpsArray.push(`Baja autoeficacia (${bps.confianzaBaja}/10)`);

    const flagsArray = [];
    if (seg.fiebre_sistemico_cancerPrevio) flagsArray.push("Alerta sistémica / cáncer");
    if (seg.bajaPeso_noIntencionada) flagsArray.push("Baja de peso");
    if (seg.dolorNocturno_inexplicable_noMecanico) flagsArray.push("Dolor nocturno no mecánico");
    if (seg.trauma_altaEnergia_caidaImportante) flagsArray.push("Trauma alta energía");
    if (seg.neuroGraveProgresivo_esfinteres_sillaMontar) flagsArray.push("Afección neurológica grave");
    if (seg.sospechaFractura_incapacidadCarga) flagsArray.push("Sospecha de fractura / Incapaz de cargar peso");
    if (seg.riesgoEmocionalAgudo) flagsArray.push("Riesgo emocional agudo (Amarillo)");

    const fp = normalized.focoPrincipal || {};

    return {
        motivo: fp.region ? `${fp.region} (${normalized.ladoPrincipal})` : "Desconocido",
        queja: normalized.quejaPrioritaria,
        irritabilidad: normalized.irritabilidad,
        comportamiento: {
            temporalidad: fp.antiguedad || fp.patronTemporal?.frecuencia || "No definido",
            mecanismoLeve: fp.mecanismoApellido || "No aclarado",
            agravantes: fp.agravantes || "",
            aliviantes: fp.aliviantes || ""
        },
        severidadBase: fp.dolorActual || fp.peor24h || null,
        metas: {
            tareaIndice: normalized.tareaIndice,
            psfsKeys: v4.psfsGlobal?.filter((p: any) => p.actividad).map((p: any) => `${p.actividad} (${p.score || 0}/10)`) || []
        },
        bpsActivos: bpsArray,
        alertas: flagsArray,
        contexto: fp.contextoDetallado || v4.experienciaPersona?.relatoLibre || ""
    };
}

export function buildCompactContextForAI(remoteHistory: any) {
    if (!remoteHistory || (!remoteHistory.p15_context_structured && !remoteHistory.p15_context_flags)) {
        return null;
    }
    const struct = remoteHistory.p15_context_structured || {};
    const flags = remoteHistory.p15_context_flags || {};
    
    return {
        modificadores_clinicos: struct.modificadores_clinicos || [],
        antecedentes_relevantes: [
            ...(struct.antecedentes_msk?.lesiones_previas || []),
            ...(struct.antecedentes_msk?.cirugias_previas || []),
            ...(struct.factores_biologicos_relevantes?.comorbilidades_relevantes || [])
        ],
        deporte_contexto_breve: struct.deporte_actividad_basal?.actividad_deporte_central || '',
        ocupacion_contexto_breve: struct.contexto_ocupacional?.ocupacion_principal || '',
        hogar_contexto_breve: struct.contexto_domiciliario?.vive_con || '',
        factores_personales_positivos: flags.factores_personales_positivos || [],
        factores_personales_negativos: flags.factores_personales_negativos || [],
        facilitadores: flags.facilitadores_ambientales || [],
        barreras: flags.barreras_ambientales || []
    };
}

export function buildCompactPhysicalForAI(normalized: NormalizedCase) {
    const p2 = normalized.hallazgosP2 || {};
    const compactPath: any = {
        observacion: null,
        rom: null,
        fuerza: null,
        neurologico: null,
        ortopedicas: null,
        funcionales: null,
        palpacion: null,
        retest: null,
        indiciosGlobales: []
    };

    // Observacion
    let obsStr = p2.movimientoObservadoHoy ? `Gesto observado: ${p2.movimientoObservadoHoy}. ` : "";
    if (p2.postureAlignment) obsStr += `Postura: ${p2.postureAlignment}. `;
    if (p2.gaitBasicGesture) obsStr += `Marcha: ${p2.gaitBasicGesture}. `;
    if (p2.observacionInicialConfig) {
        const chips = [];
        if (p2.observacionInicialConfig.posturaChips?.length) chips.push(...p2.observacionInicialConfig.posturaChips);
        if (p2.observacionInicialConfig.marchaChips?.length) chips.push(...p2.observacionInicialConfig.marchaChips);
        if (p2.observacionInicialConfig.movLibreChips?.length) chips.push(...p2.observacionInicialConfig.movLibreChips);
        if (chips.length > 0) obsStr += `Hallazgos rápidos: [${chips.join(', ')}].`;
    }
    if (obsStr.trim()) compactPath.observacion = obsStr.trim();

    // ROM (solo filas con hallazgos anormales o notas)
    if (p2.romRangeRows && p2.romRangeRows.length > 0) {
        const romFilt = p2.romRangeRows.filter((r: any) => r.movement && (r.painLevel || r.endFeel !== 'Normal' || r.notes));
        if (romFilt.length > 0) {
            compactPath.rom = romFilt.map((r: any) => `${r.movement} (${r.side || 'B'}): EVA ${r.painLevel || 0}, EndFeel: ${r.endFeel || 'NR'}${r.notes ? ` - Nota: ${r.notes}` : ''}`);
        }
    }

    // Fuerza (solo filas con notas musculares)
    if (p2.musclePerformanceRows && p2.musclePerformanceRows.length > 0) {
        const mFilt = p2.musclePerformanceRows.filter((r: any) => r.action && (r.mrcGrade !== '5 - Normal' || r.painScale || r.notes));
        if (mFilt.length > 0) {
            compactPath.fuerza = mFilt.map((r: any) => `${r.action} (${r.side || 'B'}): Fuerza ${r.mrcGrade || 'NR'}, Dolor: ${r.painScale || 0}${r.notes ? ` - Nota: ${r.notes}` : ''}`);
        }
    }

    // Neuro
    if (p2.neuroRows && p2.neuroRows.length > 0) {
        const nFilt = p2.neuroRows.filter((r: any) => r.test && r.finding !== 'Normal' && r.finding !== 'Selecciona...');
        if (nFilt.length > 0) {
            compactPath.neurologico = nFilt.map((r: any) => `${r.test}: ${r.finding}${r.notes ? ` (${r.notes})` : ''}`);
        }
    }

    // Pruebas Ortopédicas Especiales (solo si hay tests dictados)
    if (p2.specialTestsText && p2.specialTestsText.trim()) compactPath.ortopedicas = p2.specialTestsText;
    if (p2.functionalTestsText && p2.functionalTestsText.trim()) compactPath.funcionales = p2.functionalTestsText;
    if (p2.palpationDetails && p2.palpationDetails.trim()) compactPath.palpacion = p2.palpationDetails;

    // Retest / Confirmación
    if (p2.retestNotes && p2.retestNotes.trim()) compactPath.retest = p2.retestNotes;
    
    // Tarea índice oficial extraída en P2 si el Doc ha decidido cambiarla
    if (normalized.tareaIndice) compactPath.tareaIndiceTarget = normalized.tareaIndice;

    // Purge keys that remained null completely
    for (const key in compactPath) {
        if (compactPath[key] === null || (Array.isArray(compactPath[key]) && compactPath[key].length === 0)) {
            delete compactPath[key];
        }
    }

    return compactPath;
}

// FASE 22: NEW DETERMINISTIC COMPACT CASE PACKAGE ASSEMBLER FOR P3/P4
export function buildCompactCasePackage(formData: any) {
    const pat = formData.paciente || {};
    const p1_struct = formData.interview?.v4?.p1_ai_structured || {};
    // FASE 63 Fix B: SIEMPRE reconstruir p15_context_structured desde los datos crudos
    // NO usar la caché guardada en Firestore (puede estar desactualizada)
    const remoteRaw = formData.remoteHistorySnapshot;
    const p15_struct = remoteRaw 
        ? buildP15Structured(remoteRaw as any)
        : (formData.remoteHistorySnapshot?.p15_context_structured || {});
    const p15_flags = remoteRaw
        ? buildP15Flags(remoteRaw as any)
        : (formData.remoteHistorySnapshot?.p15_context_flags || {});
    const p1_raw = formData.interview?.v4 || {};
    
    // Auto calculate if the user skipped the P2 synthesis button
    const p2_struct = formData.guidedExam?.autoSynthesis || buildP2SummaryStructured(formData.guidedExam) || {};

    // Filter P1 Core to prevent sending massive hypotheses
    const p1_core = {
        motivo_consulta_breve: p1_struct.motivo_consulta_breve || "",
        objetivo_expectativa_breve: p1_struct.objetivo_expectativa_breve || "",
        resumen_clinico_breve: p1_struct.resumen_clinico_breve || "",
        // FASE 61: Enriquecimiento para inferencia profunda
        perspectiva_persona: {
            entendido: p1_raw.analisisIA?.resumen_persona_usuaria?.lo_que_entiendi || "",
            preocupacion: p1_raw.analisisIA?.resumen_persona_usuaria?.lo_que_te_preocupa || "",
            causa_percibida: p1_raw.analisisIA?.extraccion_general?.capacidad_percibida?.evidencia_textual || ""
        },
        alicia_core: p1_struct.alicia_core || {},
        sins_core: p1_struct.sins_core || {},
        foco_principal: p1_struct.foco_principal || {},
        hipotesis_titulos: (p1_struct.hipotesis_orientativas || []).map((h: any) => h.titulo),
        factores_contextuales: p1_struct.factores_contextuales || {
            banderas_rojas: [], banderas_amarillas: [], facilitadores: [], barreras: []
        },
        bps_scores: p1_raw.bps || {},
        psfs_global: p1_raw.psfsGlobal || [],
        relato_completo_p1: p1_raw.experienciaPersona?.relatoLibre || ""
    };

    const p15_core = {
        modificadores_clinicos: p15_struct.modificadores_clinicos || [],
        // FASE 63 Bug #7: incluir medicamentos y alergias en el payload de la IA
        antecedentes_relevantes: [
            ...(p15_struct.antecedentes_msk?.lesiones_previas || []),
            ...(p15_struct.antecedentes_msk?.cirugias_previas || []),
            ...(p15_struct.antecedentes_msk?.secuelas_persistentes || []),
            ...(p15_struct.factores_biologicos_relevantes?.comorbilidades_relevantes || [])
        ],
        // Medicamentos y alergias como campos separados para que la IA los clasifique correctamente
        medicamentos: p15_struct.factores_biologicos_relevantes?.medicacion_relevante || [],
        alergias: p15_struct.factores_biologicos_relevantes?.alergias_relevantes || [],
        antecedentes_msk_detalle: {
            region_problematica: p15_struct.antecedentes_msk?.region_historicamente_problematica || [],
            recurrencias: p15_struct.antecedentes_msk?.recurrencias || [],
            secuelas: p15_struct.antecedentes_msk?.secuelas_persistentes || [],
            imagenes_previas: p15_struct.antecedentes_msk?.imagenes_previas_relevantes || []
        },
        detalles_historia: p15_struct.factores_biologicos_relevantes?.detalle_clinico_relevante || "",
        deporte_contexto_breve: p15_struct.deporte_actividad_basal?.actividad_deporte_central || "",
        ocupacion_contexto_breve: p15_struct.contexto_ocupacional?.ocupacion_principal || "",
        hogar_contexto_breve: p15_struct.contexto_domiciliario?.vive_con || "",
        factores_personales_positivos: p15_flags.factores_personales_positivos || [],
        factores_personales_negativos: p15_flags.factores_personales_negativos || [],
        facilitadores: p15_flags.facilitadores_ambientales || [],
        barreras: p15_flags.barreras_ambientales || [],
        observaciones_p15_raw: formData.remoteHistorySnapshot?.permanentNotes || ""
    };

    const p2_core = {
        tarea_indice: formData.guidedExam?.retestGesture || formData.guidedExam?.retestConfig?.tareaIndice || "",
        signos_concordantes: p2_struct.signos_concordantes || [],
        signos_discordantes: p2_struct.signos_discordantes || [],
        resumen_hallazgos_positivos: p2_struct.resumen_hallazgos_positivos || "",
        patron_movilidad: p2_struct.patron_movilidad || "",
        patron_fuerza_control: p2_struct.patron_fuerza_control || "",
        irritabilidad_tisular: p2_struct.irritabilidad_tisular || "",
        hipotesis_tracking: formData.guidedExam?.hipotesis_tracking || [],
        texto_sintesis_completa: p2_struct.summary_text_structured || ""
    };

    const calculateAge = (dob: string) => {
        if (!dob) return null;
        const diff = Date.now() - new Date(dob).getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    };

    // FASE 63 Bug #1 (bridge): usar identity_paciente que Screen15 ahora copia desde Firestore
    const identPac = (formData.remoteHistorySnapshot as any)?.identity_paciente || {};
    const patAge = pat.fechaNacimiento ? calculateAge(pat.fechaNacimiento) : (pat.edad || null);
    const snapAge = identPac.fechaNacimiento ? calculateAge(identPac.fechaNacimiento) : (identPac.edad || null);
    const finalAge = patAge || snapAge;

    const finalName = pat.fullName || (pat.nombres ? `${pat.nombres} ${pat.apellidos || ''}`.trim() : null) || identPac.fullName || "Desconocido";
    const finalSex = pat.sexoRegistrado || pat.sexoBiomecanico || identPac.sexoRegistrado || "Desconocido";

    return {
        demographics: {
            nombre: finalName,
            edad: finalAge ? `${finalAge} años` : "Desconocida",
            sexo: finalSex
        },
        p1_core,
        p15_core,
        p2_core
    };
}
