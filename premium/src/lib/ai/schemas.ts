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
    version: z.string(),
    safety_alerts: z.array(z.string()).describe("Alertas por red flags o comorbilidades"),
    clinical_considerations: z.array(z.string()).describe("Consideraciones de seguridad o ajuste clínico (sin sugerir fármacos)"),
    missing_data_to_confirm: z.array(z.string()).describe("Qué falta medir o preguntar para precisar el diagnóstico"),
    diagnosis_narrative: z.string().describe("Texto en formato kinésico funcional integrativo, utilizando los hallazgos de P1, P2 y la clasificación estructurada de P3."),
    differential_functional: z.array(z.string()).describe("Alternativas funcionales clínicas si falla la hipótesis principal"),
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
