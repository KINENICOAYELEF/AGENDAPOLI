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
    version: z.string(),
    clinicalClassification: z.object({
        category: z.enum(['Aparente nociceptivo', 'Aparente neuropático', 'Aparente nociplástico', 'Mixto', 'No concluyente']),
        subtype: z.string().describe("Ej: de origen inflamatorio, mecánico por carga, etc."),
        rationale: z.string().describe("Explicación breve de por qué se sugiere esta clasificación"),
    }),
    systems: z.object({
        primarySystem: z.enum(['Tejido contráctil', 'Articulación / cápsula', 'Ligamento / estabilidad pasiva', 'Sistema neural', 'Control motor / movimiento', 'Carga ósea', 'Tejido conectivo / fascia', 'Mixto']),
        primaryStructure: z.string().describe("Estructura o foco principal"),
        secondaryStructures: z.array(z.string()).describe("Estructuras secundarias, si aplica"),
    }),
    alterations: z.object({
        structural: z.array(z.object({
            name: z.string(),
            certainty: z.enum(['Casi confirmada', 'Probable', 'Posible']),
            comment: z.string().describe("Comentario breve, redactado de forma prudente si no hay certeza")
        })),
        functional: z.array(z.object({
            name: z.string().describe("Ej: dolor, disminución de rango, disminución de fuerza, etc."),
            severity: z.enum(['Leve', 'Moderada', 'Severa'])
        }))
    }),
    activityParticipation: z.object({
        limitations: z.array(z.object({
            name: z.string().describe("Actividades directas Ej: caminar, correr, agacharse"),
            severity: z.enum(['Leve', 'Moderada', 'Severa'])
        })),
        restrictions: z.array(z.object({
            name: z.string().describe("Roles, ej: trabajo, deporte, vida social"),
            severity: z.enum(['Leve', 'Moderada', 'Severa'])
        }))
    }),
    bpsFactors: z.object({
        personalPos: z.array(z.string()).describe("Ej: buena adherencia, motivación alta"),
        personalNeg: z.array(z.string()).describe("Ej: miedo al movimiento, estrés alto"),
        envFacilitators: z.array(z.string()).describe("Ej: apoyo familiar, acceso a gimnasio"),
        envBarriers: z.array(z.string()).describe("Ej: turnos, cuidar a terceros, distancia")
    }),
    clinicalReminders: z.array(z.string()).describe("Recordatorios útiles no invasivos (ej: correlacionar componente neural)")
});

// Esquema B.5) narrative (Screen 4 P4 Narrative)
export const NarrativeSchema = z.object({
    narrativeDiagnosis: z.string().describe("Texto único continuo narrativo estructurado sobre hallazgos de P3."),
    generalObjectiveOptions: z.array(z.string()).describe("2 a 3 opciones de objetivo general"),
    smartGoals: z.array(z.object({
        description: z.string().describe("El objetivo construido en formato SMART"),
        linkedVariable: z.string().describe("La alteración, actividad o variable basal ligada al objetivo")
    })),
    prognosis: z.object({
        shortTerm: z.string().describe("Pronóstico a corto plazo"),
        mediumTerm: z.string().describe("Pronóstico a mediano plazo"),
        category: z.string().describe("Ej: favorable, favorable con vigilancia, reservado, desfavorable, incierto / dependiente de evolución"),
        justification: z.string().describe("Justificación clínica")
    }),
    pillars: z.array(z.object({
        name: z.string().describe("Nombre del pilar, ej: Educación, Ejercicio, Terapia Manual..."),
        description: z.string().describe("Nota breve sobre por qué se escogió y qué aborda")
    })).describe("Pilares sugeridos principales (1 a 3)"),
    masterPlan: z.string().describe("Texto editable hoja de ruta general: focos, qué testear, progresiones, alertas."),
    reassessmentRules: z.object({
        comparableSign: z.string().describe("Signo comparable principal"),
        variables: z.array(z.string()).describe("Variables secundarias"),
        frequency: z.string().describe("Frecuencia de reevaluación recomendada"),
        progressCriteria: z.string().describe("Criterio para considerar mejora"),
        stagnationCriteria: z.string().describe("Criterio para estancamiento o derivación")
    })
});

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

// G) FASE 11 (Refactor Total P1)
export const P1SynthesisSchema = z.object({
    resumen_clinico_editable: z.string(),
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
    })).max(5),
    recomendaciones_p2_por_modulo: z.object({
        observacion_movimiento_inicial: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        rango_movimiento_analitico: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        fuerza_tolerancia_carga: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        palpacion: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        neuro_vascular_somatosensorial: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        control_motor_sensoriomotor: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        pruebas_ortopedicas_dirigidas: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() }),
        pruebas_funcionales_reintegro: z.object({ objetivo: z.string(), que_descarta: z.string(), que_confirma: z.string(), prioridad: z.string() })
    }),
    factores_contextuales_clave: z.object({
        banderas_rojas: z.array(z.string()),
        banderas_amarillas: z.array(z.string()),
        facilitadores: z.array(z.string()),
        barreras: z.array(z.string())
    })
});

export type P1SynthesisType = z.infer<typeof P1SynthesisSchema>;

