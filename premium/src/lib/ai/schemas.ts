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
        // A1. Identificación clínica relevante
        identificacion: z.object({
            nombre: z.string(),
            edad: z.string(),
            sexo: z.string(),
        }),
        // A2. Contexto basal que modifica el caso
        contexto_basal: z.object({
            ocupacion: z.string(),
            deporte_actividad: z.string(),
            demanda_fisica: z.string(),
            ayudas_tecnicas: z.string().nullish(),
        }),
        // A3. Factores clínicos relevantes para el episodio
        factores_relevantes: z.object({
            comorbilidades: z.array(z.string()),
            medicamentos: z.array(z.string()),
            antecedentes_msk: z.array(z.string()),
            observaciones_seguridad: z.array(z.string()),
        }),
        // Datos de proceso P3
        foco_y_lado: z.string(),
        irritabilidad_sugerida: z.string(),
        tolerancia_carga: z.object({
            nivel: z.string().describe("Texto descriptivo del nivel de tolerancia"),
            explicacion: z.string().describe("Justificación clínica de la tolerancia")
        }),
        tarea_indice: z.string(),
        alertas_clinicas: z.array(z.string())
    }),
    clasificacion_dolor: z.object({
        // C1. Categoría principal (Selección única)
        categoria: z.enum(['nociceptivo', 'neuropático', 'nociplástico', 'mixto', 'no_concluyente']).describe("Categoría principal del dolor"),
        // C2. Subtipos / Apellidos (Multiselección)
        subtipos: z.array(z.string()).describe("Subtipos o apellidos sugeridos (multiselección)"),
        subtipo_manual: z.string().nullish().describe("Texto manual para 'otro' subtipo"),
        // C3. Fundamento clínico estructurado
        fundamento: z.object({
            apoyo: z.array(z.string()).describe("Hallazgos de P1/P1.5/P2/Expediente que apoyan la hipótesis principal"),
            duda_mezcla: z.array(z.string()).describe("Hallazgos que hacen dudar o sugieren mezcla de mecanismos / cautela"),
            conclusion: z.string().describe("Conclusión clínica integrada del caso")
        }),
        nivel_confianza: z.string().describe("Nivel de confianza clínica (Alta, Media, Baja)")
    }),
    sistema_y_estructuras: z.object({
        sistemas_involucrados: z.array(z.string()), // D1
        estructuras: z.object({
            principales: z.array(z.object({
                nombre: z.string().describe("Nombre de la estructura"),
                argumento: z.string().describe("Justificación clínica corta basada en P1/P1.5/P2/Expediente")
            })),
            secundarias: z.array(z.object({
                nombre: z.string(),
                argumento: z.string()
            })),
            asociadas_moduladoras: z.array(z.object({
                nombre: z.string(),
                argumento: z.string()
            })),
        }),
        estructuras_mas_afectan: z.string(), // Resumen para P4
    }),
    alteraciones_detectadas: z.object({
        // E1 - Alteraciones Estructurales (Anatómicas/Tisulares)
        estructurales: z.array(z.object({
            estructura: z.string().describe("Estructura específica (ej: Ligamento Cruzado Anterior)"),
            alteracion: z.string().describe("Alteración anatómica (ej: Desgarro parcial, Engrosamiento, Edema)"),
            certeza: z.string().describe("Certeza: 'Casi confirmada' | 'Probable' | 'Posible' | 'No concluyente'"),
            fundamento: z.string().describe("Cluster clínico, mecanismo o hallazgo de imagen que lo avala"),
            impacto_caso: z.string().describe("Impacto en el caso actual: 'Mucho' | 'Poco'")
        })),
        // E2 - Alteraciones Funcionales (Disfunciones/Desempeño)
        funcionales: z.array(z.object({
            funcion_disfuncion: z.string().describe("Disfunción operativa (ej: Déficit de fuerza, Irritabilidad, Dolor, Miedo)"),
            severidad: z.string().describe("Severidad: 'Leve' | 'Moderada' | 'Severa' | 'Completa'"),
            fundamento: z.string().describe("Hallazgo en P1/P2 que justifica la severidad"),
            dominio_sugerido: z.string().describe("Dominio: 'Dolor' | 'Movilidad' | 'Fuerza' | 'Control motor' | 'Carga' | 'Sensorimotor' | 'Metabólico' | 'Ventilatorio' | 'Cardiovascular' | 'Neurológico' | 'Tegumentario' | 'Psicosocial'")
        }))
    }),
    actividad_y_participacion: z.object({
        limitaciones_directas: z.array(z.object({
            texto: z.string(),
            severidad: z.string().describe("Severidad: leve | ligera | moderada | severa | completa"),
            detalle: z.string().optional().describe("Justificación clínica o detalle de la limitación")
        })),
        restricciones_participacion: z.array(z.object({
            texto: z.string(),
            severidad: z.string().describe("Severidad: leve | ligera | moderada | severa | completa"),
            detalle: z.string().optional().describe("Justificación clínica o detalle de la restricción")
        }))
    }),
    factores_biopsicosociales: z.object({
        factores_personales_positivos: z.array(z.string()),
        factores_personales_negativos: z.array(z.string()),
        facilitadores_ambientales: z.array(z.string()),
        barreras_ambientales: z.array(z.string()),
        factores_clinicos_moduladores: z.array(z.string()),
        observaciones_bps_integradas: z.string()
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
    diagnostico_kinesiologico_narrativo: z.string().describe("Texto único continuo narrativo estructurado sobre hallazgos de P3. Mínimo 8 líneas."),
    razonamiento_diagnostico: z.string().optional().describe("Explicación docente de cómo se construyó el diagnóstico: qué pesa más y por qué"),
    objetivo_general: z.object({
        problema_principal_caso: z.string().optional().describe("2-3 líneas identificando el problema central que hay que resolver en este caso"),
        opciones_sugeridas: z.array(z.string()).describe("3 a 5 opciones de objetivo general con distintos enfoques"),
        seleccionado: z.string()
    }),
    objetivos_smart: z.array(z.object({
        texto: z.string().describe("El objetivo construido en formato SMART"),
        variable_base: z.string().describe("La alteración, actividad o variable basal ligada al objetivo"),
        basal: z.string().describe("Estado inicial"),
        meta: z.string().describe("Estado esperado"),
        plazo: z.string().describe("Tiempo sugerido"),
        prioridad: z.string().describe("Prioridad clínica"),
        cluster: z.string().optional().describe("Dominio: Dolor, ROM, Fuerza, Control Motor, Psicosocial, Rendimiento, etc.")
    })),
    pronostico_biopsicosocial: z.object({
        corto_plazo: z.string(),
        mediano_plazo: z.string(),
        largo_plazo: z.string(),
        categoria: z.enum(["favorable", "favorable con vigilancia", "reservado", "reservado dependiente de adherencia/contexto", "desfavorable", "incierto"]),
        justificacion_clinica_integral: z.string(),
        factores_a_favor: z.array(z.string()).describe("Lista amplia de todo lo que juega a favor (mínimo 4)"),
        factores_en_contra: z.array(z.string()).describe("Lista amplia de todo en contra (mínimo 3)"),
        comparativa_adherencia: z.string().describe("Comparativa entre seguir tratamiento propuesto vs mala adherencia"),
        historia_natural: z.string().describe("Qué pasaría si NO se trata (evolución esperada)"),
        impacto_biologico: z.string().describe("Cómo afectan edad, sexo, ocupación y biología del caso")
    }),
    pilares_intervencion: z.array(z.object({
        titulo: z.string(),
        prioridad: z.number().describe("Prioridad 1 es la más alta"),
        rol_clinico: z.string().optional().describe("'Pilar Central' o 'Adjunto/Complementario'"),
        justificacion: z.string(),
        objetivos_operacionales: z.array(z.string()).describe("Mínimo 4 pasos concretos"),
        ejemplos_ejercicios: z.array(z.string()).optional().describe("Ejemplos de ejercicios o actividades para este pilar"),
        foco_que_aborda: z.array(z.string())
    })).describe("Mínimo 4-5 pilares priorizados: trinidad base + complementos justificados"),
    plan_maestro: z.array(z.object({
        fase: z.number().describe("Fase 1 a 4 típicas de rehabilitación"),
        nombre: z.string(),
        foco_principal: z.string(),
        objetivo_fisiologico: z.string().optional().describe("Meta biológica/tisular de esta fase"),
        duracion_estimada: z.string(),
        criterios_entrada: z.string(),
        intervenciones: z.array(z.string()).describe("Mínimo 4-6 intervenciones específicas"),
        progresiones: z.array(z.string()).describe("Mínimo 3-4 progresiones con criterio de carga"),
        criterios_avance: z.string(),
        criterios_regresion: z.string(),
        errores_frecuentes: z.array(z.string()).optional().describe("Errores comunes que el kinesiólogo debe evitar en esta fase"),
        perla_docente: z.string().optional().describe("Dato basado en evidencia útil para enseñanza clínica"),
        intervenciones_complementarias: z.array(z.string()).optional().describe("Terapias complementarias: movilización articular, MWM, terapia manual, exposición gradual, neurociencia del dolor, imaginería motora"),
        tips_dosificacion: z.array(z.string()).optional().describe("Tips para dosificar en esta fase: RPE, RIR, tempo, % 1RM, TUT, velocidad concéntrica"),
        sesiones_tipo: z.array(z.object({
            titulo: z.string().describe("Ej: Sesión tipo A: Modulación + Control Motor"),
            duracion: z.string().describe("Ej: ~60 min"),
            estructura: z.array(z.string()).describe("Bloques de la sesión: calentamiento, bloque principal, cool-down, con tipos de ejercicio y dosificación")
        })).optional().describe("2 sesiones tipo de ~60 min que cubran objetivos reales del caso")
    })).describe("4 fases de rehabilitación ultra-detalladas y docentes"),
    reglas_reevaluacion: z.object({
        signo_comparable_principal: z.string().optional().describe("Signo comparable principal (legacy, preferir signos_comparables)"),
        signos_comparables: z.array(z.object({
            evaluacion: z.string().describe("Nombre del test, movimiento o provocación"),
            tipo: z.string().describe("Test especial, ROM funcional, provocación, test funcional, etc."),
            justificacion: z.string().describe("Por qué sirve como guía de progreso")
        })).optional().describe("Evaluaciones guía: tests, movimientos y provocaciones que monitorean progreso"),
        razon_signo_comparable: z.string().optional().describe("Por qué se eligieron estos signos"),
        variables_seguimiento: z.array(z.string()),
        instrumentos_sugeridos: z.array(z.string()).optional().describe("Escalas/tests: PSFS, SANE, GROC, dinamometría, etc."),
        frecuencia_sugerida: z.string(),
        criterio_mejora_real: z.string(),
        criterio_estancamiento_derivacion: z.string(),
        alertas_derivacion: z.array(z.string()).optional().describe("Red flags específicos del caso que ameritan derivación"),
        plan_reevaluacion_temporal: z.array(z.object({
            momento: z.string().describe("Ej: Sesiones 1-3, Semana 4, Semana 8-10, Alta"),
            evaluaciones_incluidas: z.array(z.string()).describe("Qué evaluaciones aplicar en este momento"),
            evaluaciones_excluidas: z.string().nullish().describe("Qué NO evaluar aún y por qué"),
            razon: z.string().describe("Justificación clínica de esta selección")
        })).optional().describe("Timeline de qué evaluar en cada momento y qué postergar")
    }),
    banco_recursos: z.object({
        ejercicios_clave: z.array(z.object({
            nombre_es: z.string().describe("Nombre en español"),
            nombre_en: z.string().describe("Nombre en inglés para buscar en YouTube/internet"),
            fase_recomendada: z.string().describe("En qué fase usar: Fase 1, 2, 3 o 4"),
            objetivo: z.string().describe("Qué trabaja: fuerza, ROM, control motor, etc.")
        })).describe("8-15 ejercicios clave con nombre EN+ES para buscar"),
        busquedas_sugeridas: z.array(z.string()).optional().describe("Términos de búsqueda sugeridos para profundizar en PubMed/Scholar (ej: 'patellofemoral pain syndrome exercise pubmed')")
    }).optional().describe("Banco de recursos para el estudiante/evaluador"),
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

