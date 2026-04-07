import { z } from 'zod';

// ============================================================
// SIMULADOR DE EXAMEN CLÍNICO — Schemas Zod
// ============================================================

// Call 1: Generación del caso completo
export const SimCaseSchema = z.object({
    ficha_visible: z.object({
        nombre: z.string(),
        edad: z.string(),
        sexo: z.string(),
        ocupacion: z.string(),
        deporte_actividad: z.string(),
        motivo_consulta: z.string(),
        derivacion: z.string().describe("'Sin diagnóstico médico previo' o el diagnóstico del médico derivante"),
        tiempo_evolucion: z.string(),
    }),
    perfil_secreto: z.object({
        historia_completa: z.string().describe("Historia médica completa del paciente, todo lo que sabe pero NO dice espontáneamente"),
        personalidad: z.string().describe("Ej: ansioso, estoico, detallista, vago, emocional"),
        datos_ocultos: z.array(z.object({
            dato: z.string(),
            solo_si_preguntan: z.string().describe("La pregunta que debe hacer el estudiante para que salga este dato"),
        })).describe("Datos clínicamente importantes que el paciente solo revela si preguntan directamente"),
        antecedentes_relevantes: z.array(z.string()),
        medicamentos: z.array(z.string()),
        bps_oculto: z.object({
            sueno: z.string(),
            estres: z.string(),
            miedos: z.string(),
            expectativa_real: z.string(),
        }),
    }),
    hallazgos_todos_modulos: z.object({
        observacion_movimiento_inicial: z.string(),
        rango_movimiento_analitico: z.string(),
        fuerza_tolerancia_carga: z.string(),
        palpacion: z.string(),
        neuro_vascular: z.string(),
        control_motor_sensoriomotor: z.string(),
        pruebas_ortopedicas: z.string(),
        pruebas_funcionales_reintegro: z.string(),
    }),
    rubrica_ideal: z.object({
        hipotesis_esperadas: z.array(z.object({
            titulo: z.string(),
            probabilidad: z.string(),
        })),
        clasificacion_dolor_esperada: z.string(),
        irritabilidad_esperada: z.string(),
        banderas_rojas_presentes: z.array(z.string()),
        banderas_amarillas_presentes: z.array(z.string()),
        modulos_examen_obligatorios: z.array(z.string()),
        diagnostico_ideal_resumido: z.string().describe("El diagnóstico CIF ideal en 4-6 líneas"),
        errores_disenados: z.array(z.string()).describe("Trampas diseñadas en el caso que un estudiante novato no detectaría"),
        objetivos_smart_esperados_count: z.number().describe("Cantidad mínima de SMARTs esperados"),
        pilares_intervencion_esperados: z.array(z.string()),
    }),
});
export type SimCaseType = z.infer<typeof SimCaseSchema>;

// Call 2: Respuesta del paciente + análisis oculto
export const SimInterviewSchema = z.object({
    respuestas_paciente: z.string().describe("Texto corrido en lenguaje coloquial del paciente respondiendo todas las preguntas"),
    analisis_oculto: z.object({
        preguntas_faltantes_criticas: z.array(z.object({
            pregunta: z.string(),
            por_que_importa: z.string(),
            que_diferencial_afecta: z.string(),
        })),
        preguntas_bien_hechas: z.array(z.object({
            pregunta_detectada: z.string(),
            por_que_importa: z.string(),
        })),
        cobertura_entrevista: z.object({
            alicia_completa: z.boolean(),
            banderas_rojas_exploradas: z.boolean(),
            bps_explorado: z.boolean(),
            expectativa_paciente: z.boolean(),
            antecedentes_explorados: z.boolean(),
            mecanismo_lesion_explorado: z.boolean(),
        }),
    }),
});
export type SimInterviewType = z.infer<typeof SimInterviewSchema>;

// Call 3: Hallazgos del examen + análisis de omisiones
export const SimExamSchema = z.object({
    hallazgos_revelados: z.record(z.string(), z.string()).describe("Key = nombre del módulo seleccionado, Value = hallazgos narrativos clínicos"),
    analisis_examen: z.object({
        modulos_omitidos_relevantes: z.array(z.object({
            modulo: z.string(),
            por_que_era_necesario: z.string(),
            que_diferencial_afecta: z.string(),
        })),
        justificaciones_debiles: z.array(z.object({
            modulo: z.string(),
            lo_que_escribio: z.string(),
            critica: z.string(),
        })),
        justificaciones_solidas: z.array(z.object({
            modulo: z.string(),
            comentario_positivo: z.string(),
        })),
    }),
});
export type SimExamType = z.infer<typeof SimExamSchema>;

// Call 4: Evaluación integral + preguntas de comisión
export const SimEvaluationSchema = z.object({
    puntaje_global: z.number().min(0).max(100),
    nivel: z.enum(["Aprobado con Distinción", "Aprobado", "Reprobado Recuperable", "Reprobado"]),
    scorecard: z.object({
        entrevista: z.object({ puntaje: z.number(), comentario: z.string() }),
        razonamiento: z.object({ puntaje: z.number(), comentario: z.string() }),
        examen_fisico: z.object({ puntaje: z.number(), comentario: z.string() }),
        diagnostico: z.object({ puntaje: z.number(), comentario: z.string() }),
        objetivos: z.object({ puntaje: z.number(), comentario: z.string() }),
        intervencion: z.object({ puntaje: z.number(), comentario: z.string() }),
        reevaluacion: z.object({ puntaje: z.number(), comentario: z.string() }),
    }),
    errores_criticos: z.array(z.object({
        fase: z.string(),
        error: z.string(),
        explicacion_docente: z.string(),
    })),
    aciertos_destacados: z.array(z.object({
        fase: z.string(),
        acierto: z.string(),
        por_que_importa: z.string(),
    })),
    preguntas_comision: z.array(z.object({
        pregunta: z.string(),
        respuesta_esperada: z.string(),
    })).min(3).max(6),
    areas_mejora: z.array(z.string()).max(3),
    perla_docente: z.string(),
});
export type SimEvaluationType = z.infer<typeof SimEvaluationSchema>;

// Call 5: Evaluación de respuestas de comisión
export const SimCommissionSchema = z.object({
    evaluacion_respuestas: z.array(z.object({
        pregunta_numero: z.number(),
        puntaje: z.number().min(0).max(100),
        comentario: z.string(),
        aspecto_correcto: z.string(),
        aspecto_a_mejorar: z.string(),
    })),
    puntaje_comision_global: z.number().min(0).max(100),
    feedback_final: z.string().describe("Párrafo final de 3-4 líneas con retroalimentación general de la defensa"),
});
export type SimCommissionType = z.infer<typeof SimCommissionSchema>;
