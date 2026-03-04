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

// Esquema B) diagnosis
export const DiagnosisSchema = z.object({
    version: z.string(),
    safety_alerts: z.array(z.string()).describe("Alertas por red flags o comorbilidades"),
    clinical_considerations: z.array(z.string()).describe("Consideraciones de seguridad o ajuste clínico (sin sugerir fármacos)"),
    missing_data_to_confirm: z.array(z.string()).describe("Qué falta medir o preguntar para precisar el diagnóstico"),
    diagnosis_narrative: z.string().describe("Texto en formato kinésico funcional, sin diagnóstico médico de imagen"),
    diagnosis_structured: z.object({
        body_structures: z.array(z.object({
            region: z.string(),
            side: z.enum(["Derecho", "Izquierdo", "Bilateral", "N/A"]),
            finding: z.string(),
            source: z.enum(["imagen", "clinica"]),
            confidence: z.enum(["baja", "media", "alta"]),
        })),
        body_functions: z.array(z.object({
            domain: z.enum(["movilidad", "fuerza", "control_motor", "capacidad", "dolor", "neuro", "equilibrio", "otra"]),
            region: z.string(),
            side: z.enum(["Derecho", "Izquierdo", "Bilateral", "N/A"]),
            baseline: z.string(),
            severity: z.enum(["leve", "moderada", "severa"]),
            reproduces_comparable: z.boolean(),
        })),
        activities: z.array(z.object({
            psfs_item: z.string(),
            score: z.number().min(0).max(10),
            linked_focus: z.string().nullable(),
        })),
        participation: z.array(z.object({
            area: z.enum(["trabajo", "deporte", "hogar", "otro"]),
            restriction: z.string(),
        })),
        personal_factors: z.array(z.object({
            factor: z.string(),
            valence: z.enum(["positivo", "negativo"]),
            severity_0_2: z.number().min(0).max(2),
        })),
        environment_factors: z.array(z.object({
            factor: z.string(),
            valence: z.enum(["facilitador", "barrera"]),
            severity_0_2: z.number().min(0).max(2),
        })),
        classifications: z.object({
            irritabilidad: z.enum(["baja", "media", "alta"]),
            pain_mechanism: z.enum(["nociceptivo", "neuropatico", "nociplastico", "mixto"]),
            tags: z.array(z.string()),
        }),
    }),
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

// NUEVO: Schema para Reevaluación (Retest IA)
export const ReevaluationPlanSchema = z.object({
    progress_summary: z.string().describe("Resumen narrativo del progreso basado en los reteseos ingresados (max 500 chars)."),
    plan_modifications: z.string().describe("Sugerencia de ajustes, progresiones o regresiones al plan activo, justificadas por el retest clínico (max 500 chars)."),
    clinical_alerts: z.array(z.string()).optional().describe("Si el paciente empeoró o hay red flags detectadas en el retest, listarlas aquí.")
});
export type ReevaluationPlanType = z.infer<typeof ReevaluationPlanSchema>;
