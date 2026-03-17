import { z } from 'zod';

// Esquema A) eval-minimo
export const EvalMinimoSchema = z.object({
    version: z.string().describe("Versión del esquema, ej: '1'"),
    disclaimer_short: z.string().describe("Texto corto (1 línea) de aviso consultivo"),
    missing_inputs: z.array(z.string()).describe("Lista de datos relevantes que faltan para dar una mejor sugerencia"),
    exam_plan: z.object({
        essential: z.array(z.object({
            id: z.string(),
            label: z.string(),
            why: z.string(),
            how: z.string(),
            linked_focus: z.string().nullable().describe("ID del foco asociado o null"),
        })),
        recommended: z.array(z.object({
            id: z.string(),
            label: z.string(),
            why: z.string(),
            how: z.string(),
            linked_focus: z.string().nullable(),
        })),
        optional: z.array(z.object({
            id: z.string(),
            label: z.string(),
            why: z.string(),
            how: z.string(),
            linked_focus: z.string().nullable(),
        })),
    }),
    what_to_look_for: z.array(z.string()).describe("Bullets cortos sobre qué buscar en el paciente"),
    stop_rules: z.array(z.string()).describe("Si aparece X, considerar Y (derivar/ajustar)"),
});

// Esquema B) diagnosis (Case Organizer P3)
export const DiagnosisSchema = z.object({
    snapshot_clinico: z.object({
        nombre: z.string().optional(),
        edad: z.string().optional(),
        sexo: z.string().optional(),
        foco_y_lado: z.string(),
        deporte_basal: z.string().optional(),
        comorbilidades: z.string().optional(),
        irritabilidad_sugerida: z.string(),
        tolerancia_carga: z.object({
            nivel: z.string().describe("Texto descriptivo del nivel de tolerancia"),
            explicacion: z.string().describe("Justificación clínica de la tolerancia")
        }),
        tarea_indice: z.string(),
        alertas_clinicas: z.array(z.string())
    }),
    clasificacion_dolor: z.object({
        opciones_categoria: z.array(z.string()).describe("Opciones sugeridas de categoría (ej: Aparente nociceptivo, Mixto)"),
        categoria_seleccionada: z.string(),
        opciones_subtipo_apellido: z.array(z.string()).describe("Opciones ricas de subtipo (ej: Mecánico, Inflamatorio, Sensibilización)"),
        subtipos_seleccionados: z.array(z.string()).describe("Subtipos elegidos por la IA o el usuario"),
        subtipo_manual: z.string().optional().describe("Texto manual si el usuario escribe su propio subtipo"),
        fundamento_breve: z.string(),
        nivel_confianza: z.string()
    }),
    sistema_y_estructuras: z.object({
        sistemas_principales: z.array(z.string()),
        estructuras_principales: z.array(z.string()),
        estructuras_secundarias: z.array(z.string()),
        descripcion_libre: z.string().optional()
    }),
    alteraciones_detectadas: z.object({
        estructurales: z.array(z.object({
            estructura_involucrada: z.string().describe("Estructura específica involucrada (ej: Ligamentos sacroilíacos)"),
            alteracion_sospecha: z.string().describe("Disfunción o sospecha (ej: Irritación / compromiso)"),
            certeza: z.enum(['casi_confirmada', 'probable', 'posible', 'no_concluyente']),
            fundamento_clinico: z.string().describe("Cluster, signos, síntomas o imágenes que lo respaldan")
        })),
        functional: z.array(z.object({
            texto: z.string(),
            severidad: z.enum(['leve', 'ligera', 'moderada', 'severa', 'completa'])
        }))
    }),
    actividad_y_participacion: z.object({
        limitaciones_directas: z.array(z.object({
            texto: z.string(),
            severidad: z.enum(['leve', 'ligera', 'moderada', 'severa', 'completa'])
        })),
        restricciones_participacion: z.array(z.object({
            texto: z.string(),
            severidad: z.enum(['leve', 'ligera', 'moderada', 'severa', 'completa'])
        }))
    }),
    factores_biopsicosociales: z.object({
        factores_personales_positivos: z.array(z.string()),
        factores_personales_negativos: z.array(z.string()),
        facilitadores_ambientales: z.array(z.string()),
        barreras_ambientales: z.array(z.string())
    }),
    recordatorios_y_coherencia: z.object({
        recordatorios_clinicos: z.array(z.string()),
        cosas_a_vigilar_en_tratamiento: z.array(z.string()),
        faltantes_no_criticos: z.array(z.string()),
        incoherencias_detectadas: z.array(z.string())
    })
});

// Esquema B.5) narrative (Screen 4 P4 Narrative)
export const P4PlanStructuredSchema = z.object({
    referencia_p3_breve: z.string().describe("Breve resumen pasivo del caso de P3"),
    diagnostico_kinesiologico_narrativo: z.string().describe("Texto único continuo narrativo estructurado sobre hallazgos de P3. Sigue exactamente la lógica y palabras pedidas."),
    objetivo_general: z.object({
        opciones_sugeridas: z.array(z.string()).describe("2 a 3 opciones de objetivo general recomendadas"),
        seleccionado: z.string()
    }),
    objetivos_smart: z.array(z.object({
        texto: z.string().describe("El objetivo construido en formato SMART"),
        variable_base: z.string().describe("La alteración, actividad o variable basal ligada al objetivo"),
        basal: z.string().describe("Estado inicial"),
        meta: z.string().describe("Estado esperado"),
        plazo: z.string().describe("Tiempo sugerido"),
        prioridad: z.string().describe("Prioridad clínica")
    })),
    pronostico_biopsicosocial: z.object({
        corto_plazo: z.string(),
        mediano_plazo: z.string(),
        categoria: z.enum(["favorable", "favorable con vigilancia", "reservado", "reservado dependiente de adherencia/contexto", "desfavorable", "incierto"]),
        justificacion_clinica_integral: z.string(),
        comparativa_adherencia: z.string().describe("Comparativa entre seguir tratamiento propuesto vs mala adherencia")
    }),
    pilares_intervencion: z.array(z.object({
        titulo: z.string(),
        justificacion: z.string(),
        foco_que_aborda: z.array(z.string())
    })).describe("Pilares priorizados base (educación, ejercicio, manejo carga) y complementos"),
    plan_maestro: z.string().describe("Narrativa editable de desarrollo de intervención"),
    reglas_reevaluacion: z.object({
        signo_comparable_principal: z.string(),
        variables_seguimiento: z.array(z.string()),
        frecuencia_sugerida: z.string(),
        criterio_mejora_real: z.string(),
        criterio_estancamiento_derivacion: z.string()
    }),
    ia_metadata: z.object({
        model_used: z.string(),
        fallback_used: z.boolean(),
        input_hash: z.string(),
        cache_hit: z.boolean(),
        draft_mode: z.string()
    }).optional()
});
export type P4PlanStructuredType = z.infer<typeof P4PlanStructuredSchema>;

// Esquema C) plan
export const PlanSchema = z.object({
    version: z.string(),
    general_goals: z.array(z.string()).describe("3 alternativas de objetivos generales o macros"),
    specific_goals: z.array(z.object({
        id: z.string(),
        statement: z.string().describe("Texto del objetivo SMART"),
        metric: z.string(),
        baseline: z.string(),
        target: z.string(),
        timeframe: z.string(),
        symptom_rule: z.string(),
        linked_deficits: z.array(z.string()).describe("IDs o labels de déficits funcionales ligados"),
    })),
    interventions_by_goal: z.array(z.object({
        goal_id: z.string(),
        interventions: z.array(z.object({
            type: z.enum(["ejercicio", "educacion", "movilidad", "control_motor", "exposicion", "manual", "otra"]),
            summary: z.string(),
            dose: z.object({
                freq_per_week: z.string(),
                sets: z.string(),
                reps_or_time: z.string(),
                intensity: z.string().describe("Ej: RPE x o RIR x"),
                rest: z.string()
            }),
            progression_rule: z.string(),
            regression_rule: z.string(),
            safety_notes: z.string().describe("Notas de seguridad (sin sugerir medicamentos ni electroterapia)"),
        })),
    })),
    functional_prognosis: z.object({
        category: z.enum(["favorable", "reservado", "desfavorable"]),
        rationale: z.array(z.string()).describe("Razonamiento en viñetas cortas"),
        modifiable_factors: z.array(z.string()).describe("Factores modificables accionables"),
    }),
    load_management: z.object({
        traffic_light: z.enum(["verde", "amarillo", "rojo"]),
        rules: z.object({
            pain_rule: z.string(),
            after_effect_rule: z.string(),
            progression_rule: z.string(),
            regression_rule: z.string(),
        }),
        explanation: z.array(z.string()),
    }),
});

export type EvalMinimoType = z.infer<typeof EvalMinimoSchema>;
export type DiagnosisType = z.infer<typeof DiagnosisSchema>;
export type PlanType = z.infer<typeof PlanSchema>;

export const ReevaluationPlanSchema = z.object({
    progress_summary: z.string().describe("Resumen narrativo del progreso basado en los reteseos ingresados (max 500 chars)."),
    plan_modifications: z.string().describe("Sugerencia de ajustes, progresiones o regresiones al plan activo, justificadas por el retest clínico (max 500 chars)."),
    clinical_alerts: z.array(z.string()).optional().describe("Si el paciente empeoró o hay red flags detectadas en el retest, listarlas aquí.")
});
export type ReevaluationPlanType = z.infer<typeof ReevaluationPlanSchema>;

// ----------------------------------------------------------------------------------
// FASE 2.2.X (ANAMNESIS OMNIPOTENTE KINE REAL) - ASSISTANT ENDPOINTS
// ----------------------------------------------------------------------------------

// D) Asistencia en Entrevista (De Relato Libre -> Chips estructurados)
export const InterviewAssistSchema = z.object({
    proposedSelections: z.array(z.object({
        field: z.enum(["nature", "aggravators", "branch_hypothesis"]),
        value: z.string(),
        rationale: z.string()
    })).describe("Sugerencias para auto-completado de tags (ej. Punzante, Torsión, Nociceptivo) inferidas del relato."),
    confidence: z.enum(["baja", "media", "alta"]),
    missingQuestions: z.array(z.string()).describe("Lista de preguntas esenciales omitidas en el relato libre que el clínico debería preguntar (max 3).")
});
export type InterviewAssistType = z.infer<typeof InterviewAssistSchema>;

// E) Priorizador de Examen (De Anamnesis Estructurada -> Checklist Física Sugerida)
export const ExamPrioritizerSchema = z.object({
    essentials: z.array(z.string()).describe("Pruebas o regiones de evaluación estrictamente obligatorias según el relato."),
    recommended: z.array(z.string()).describe("Pruebas sugeridas confirmatorias."),
    avoid: z.array(z.string()).describe("Maniobras contraindicadas por triage rojo o dolor limitante severo reportado."),
    ifPositiveThen: z.array(z.string()).describe("Bloques condicionales: 'Si X sale positivo en test físico => evaluar Y'."),
    missingCriticalData: z.array(z.string()).describe("Agujeros lógicos en la anamnesis documentada.")
});
export type ExamPrioritizerType = z.infer<typeof ExamPrioritizerSchema>;

// F) Validador de Agujeros Lógicos Clínicos
export const MissingnessCheckSchema = z.object({
    missingCriticalData: z.array(z.object({
        severity: z.enum(["bloqueante", "advertencia"]),
        message: z.string(),
        suggestedFix: z.string()
    })).describe("Ej. 'Falta documentar si el dolor despierta de noche'. Solo datos que puedan afectar triage funcional o estructural.")
});
export type MissingnessCheckType = z.infer<typeof MissingnessCheckSchema>;

const P2ModuleRecommendationSchema = z.object({
    objetivo: z.string().describe("Objetivo clínico moderno"),
    razonamiento_clinico: z.string().describe("Microjustificación clínica y docente"),
    hallazgo_fortalece_hipotesis: z.string().describe("Qué hallazgo en este módulo fortalece la hipótesis principal"),
    hallazgo_debilita_hipotesis: z.string().describe("Qué hallazgo en este módulo la debilita"),
    diferencial_que_descarta: z.string().describe("Qué diferencial ayuda a descartar este módulo"),
    impacto_resultado_positivo: z.string().describe("Qué cambia en la interpretación clínica si sale positivo"),
    impacto_resultado_negativo: z.string().describe("Qué cambia en la interpretación clínica si sale negativo"),
    pruebas_o_tareas_sugeridas: z.array(z.string()).describe("Sugerir entre 3 y 6 tareas/tests útiles"),
    mini_perla_docente: z.string().optional().describe("Una micro-perla clínica o docente específica para este módulo"),
    prioridad: z.enum(["alta", "media", "baja"])
});

// G) FASE 11 (Refactor Total P1)
export const P1SynthesisSchema = z.object({
    resumen_clinico_editable: z.string(),
    contexto_basal_usado: z.boolean().optional().describe("Indica si se usó información de P1.5/expediente"),
    resumen_persona_usuaria: z.object({
        lo_que_entendi: z.string(),
        lo_que_te_preocupa: z.string(),
        lo_que_haremos_ahora: z.string()
    }),
    alicia: z.object({
        agravantes: z.string(),
        atenuantes: z.string(),
        localizacion_extension: z.string(),
        intensidad_actual: z.string(),
        intensidad_mejor_24h: z.string(),
        intensidad_peor_24h: z.string(),
        caracter_naturaleza: z.string(),
        irritabilidad_relato: z.string(),
        antiguedad_inicio: z.string(),
        historia_mecanismo: z.string()
    }),
    sins: z.object({
        severidad: z.string(),
        irritabilidad_global: z.string(),
        naturaleza_sugerida: z.string(),
        etapa: z.string(),
        facilidad_provocacion: z.string(),
        momento_aparicion: z.string(),
        tiempo_a_calmarse: z.string(),
        after_effect: z.string()
    }),
    foco_principal: z.object({
        region: z.string(),
        lado: z.string(),
        queja_prioritaria: z.string(),
        actividad_indice: z.string(),
        semaforo_carga_sugerido: z.string()
    }),
    hipotesis_orientativas: z.array(z.object({
        ranking: z.number(),
        titulo: z.string(),
        probabilidad: z.string(), // "mas_probable" | "probable_alternativa" | "menos_probable"
        fundamento_breve: z.string(),
        que_hay_que_descartar: z.string(),
        que_hay_que_confirmar: z.string()
    })).length(3),
    preguntas_faltantes: z.array(z.object({
        pregunta: z.string(),
        por_que_importa: z.string(),
        prioridad: z.string() // "alta"
    })).min(4).max(6),
    recomendaciones_p2_por_modulo: z.object({
        observacion_movimiento_inicial: P2ModuleRecommendationSchema,
        rango_movimiento_analitico: P2ModuleRecommendationSchema,
        fuerza_tolerancia_carga: P2ModuleRecommendationSchema,
        palpacion: P2ModuleRecommendationSchema,
        neuro_vascular_somatosensorial: P2ModuleRecommendationSchema,
        control_motor_sensoriomotor: P2ModuleRecommendationSchema,
        pruebas_ortopedicas_dirigidas: P2ModuleRecommendationSchema,
        pruebas_funcionales_reintegro: P2ModuleRecommendationSchema
    }),
    diferenciales_breves: z.array(z.string()).optional().describe("Otras hipótesis a considerar"),
    puntos_clave_p2: z.array(z.string()).optional().describe("Puntos clave a aclarar en P2"),
    factores_contextuales_clave: z.object({
        banderas_rojas: z.array(z.string()),
        banderas_amarillas: z.array(z.string()),
        factores_personales_positivos: z.array(z.string()).optional(),
        factores_personales_negativos: z.array(z.string()).optional(),
        facilitadores: z.array(z.string()),
        barreras: z.array(z.string())
    })
});

export type P1SynthesisType = z.infer<typeof P1SynthesisSchema>;

