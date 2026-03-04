/**
 * PROCESO CLÍNICO (Atención Activa)
 * Contenedor macro que agrupa Sesiones y Evoluciones de una persona
 */
export interface Proceso {
    id?: string;
    personaUsuariaId: string;

    // Estado de la relación clínica
    estado: 'ACTIVO' | 'PAUSADO' | 'ALTA' | 'CERRADO_ADMIN' | 'EN_PAUSA' | 'CERRADO';

    // Control Temporal
    fechaInicio: string; // ISO String
    fechaAlta?: string | null; // ISO String o nulo si sigue activo

    // Razón de consulta general
    motivoIngresoLibre: string;

    // Trazabilidad
    createdAt?: string;
    updatedAt?: string;
    createdByUid: string;
    createdByName: string;
    closedAt?: string; // FASE 2.2.4

    // FASE 2.1.18: Contenedor global de los objetivos de atención
    activeObjectiveSet?: {
        versionId: string;
        updatedAt: string;
        objectives: Array<{
            id: string;
            label: string;
            status?: 'activo' | 'pausado' | 'logrado';
        }>;
    };

    // FASE 2.2.1 V2: Master Pointers y Snapshots
    activeEvaluationId?: string;
    activeEvaluationIndexId?: string; // FASE 2.2.4: Eval inicial vigente del caso
    activeObjectiveSetVersionId?: string;
    timelineIndex?: number;
    diagnosisVigente?: string;        // FASE 2.2.4: Diagnóstico narrativo activo
    diagnosisStructuredVigente?: any; // FASE 2.2.4: Opcional estructural ICF-like

    caseSnapshot?: {
        // Un resumen compacto en texto o tags que deja la evaluación M13 para leer rápido
        summary: string;
        lastUpdated: string;
        trafficLight?: 'Verde' | 'Amarillo' | 'Rojo';
        // Agregados por FASE 2.2.3
        baselineComparable?: any;
        psfsBaseline?: any;
        psfsLast?: any;
        topDeficits?: any;
        lastProgressSummary?: string;
        lastRetest?: string;
    };

    // FASE 2.2.4: Integración Total
    flags?: {
        redFlagsSummary?: string;
        consideracionesClinicas?: string[];
    };
    loadManagementVigente?: {
        trafficLight?: 'Verde' | 'Amarillo' | 'Rojo';
        rules?: string[];
    };

    // FASE 2.3.3: Continuidad Clínica (Agenda Pro)
    continuityInternIds?: string[]; // 1-3 internos habituales
    primaryInternId?: string; // referente del caso

    // FASE 2.3.0: Agenda Núcleo (Plan de Asistencia Semanal)
    attendancePlan?: {
        daysOfWeek: string[]; // e.g., ['TUE', 'THU']
        time: string; // e.g., '18:00'
        durationMin: number; // e.g., 50
        startDate: string; // ISO String (YYYY-MM-DD)
        endDate?: string; // ISO String (YYYY-MM-DD) opcional
        excludeHolidays: boolean;
        status: 'ACTIVO' | 'EN_PAUSA' | 'ALTA' | 'CERRADO';
        assignedInternIds: string[];
        primaryInternId?: string;
    };
}

/**
 * CITA (Instancia Concreta de Agenda) - Fases 2.3.0 - 2.3.3
 * Documentos generados por el motor rodante basados en el attendancePlan
 */
export interface Cita {
    id: string; // Unique ID
    procesoId: string;
    usuariaId: string;
    date: string; // ISO String (YYYY-MM-DD)
    startTime: string; // "18:00"
    endTime: string; // "18:50"
    status: 'SCHEDULED' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED' | 'SUSPENDED' | 'HOLIDAY' | 'RESCHEDULED';

    // FASE 2.3.1 - 2.3.2: Reemplazos y Asistencia
    internoPlanificadoId?: string; // Interno esperado (según primary/turno)
    internoAtendioId?: string; // Interno que realmente inició la atención
    linkedEvolutionId?: string; // ID de la evolución que concreta esta cita
    attendanceMarkedAt?: string; // ISO String
    attendanceMarkedBy?: string; // RUID

    cancelReason?: string; // Razón si fue CANCELLED
    noShowReason?: string; // Razón si fue NO_SHOW

    coverage?: { // Si un interno atiende horario distinto o como reemplazo explícito
        replacedInternId: string | null;
        reason: string; // 'ausente', 'cambio_bloque', 'apoyo', 'otro'
        at: string; // ISO
    };

    createdAt: string; // ISO
    updatedAt: string; // ISO
}

/**
 * TURNO (Bloque Docente) - Fase 2.3.4
 */
export interface Turno {
    id?: string;
    diaSemana: 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';
    horaInicio: string; // "18:00"
    horaFin: string; // "20:00"
    internosAsignados: string[]; // UID de los alumnos que corresponden a esta franja
}

/**
 * FERIADO / BLOQUEO INSTITUCIONAL - Fase 2.3.0
 * Controla días donde no se agendan citas regulares
 */
export interface Feriado {
    id: string; // e.g., "2026-05-01"
    date: string; // ISO YYYY-MM-DD
    description: string;
    type: 'NACIONAL' | 'INSTITUCIONAL';
    active: boolean; // Si se decide ignorarlo
}

/**
 * OUTCOME MEASURES (Fase 2.2.6)
 * Documentos independientes por proceso para trazabilidad longitudinal
 */
export interface Outcome {
    id?: string;
    procesoId: string;
    usuariaId: string;
    type: 'PSFS' | 'SANE' | 'GROC' | 'OTRO';
    capturedAt: string; // ISO String (fecha/hora real de captura)
    context: 'EVALUACION_INICIAL' | 'REEVALUACION' | 'SEGUIMIENTO' | 'EVOLUCION';

    // Su estructura interna y numéricas varían por tipo
    values: any;

    // Si aplica, referenciar a qué Foco Clínico está atado
    linkedFocus?: string | null;

    createdByUid: string;
    createdAt: string;
}

export interface TreatmentObjective {
    id: string; // ID local único
    description: string;
    category?: 'Pain' | 'ROM' | 'Strength' | 'Function' | 'Other';
    status: 'ACTIVE' | 'ACHIEVED' | 'DROPPED';
    targetDate?: string;
}

export interface FocusArea {
    id: string; // ID local único
    isPrincipal: boolean;
    region: string;
    lado: 'Izquierdo' | 'Derecho' | 'Bilateral' | 'N/A';
    onsetType: 'Súbito' | 'Insidioso' | 'Post-quirúrgico' | string;
    onsetDuration: string; // Ej: "1-2 semanas"
    context: string; // Ej: "Deporte", "Trabajo"
    dominantSymptoms: string[]; // Chips: Dolor, Pinchazo, Quemazón, etc.

    // Dolor y Conducta
    painCurrent: number | string;
    painWorst24h: number | string;
    painBest24h: number | string;
    pattern24h: string;
    morningStiffness: string;
    aggravatingFactors: string[];
    easingFactors: string[];
    afterEffect: 'Nunca' | 'A veces' | 'Siempre';
    settlingTime: string;
    associatedSymptoms: string[]; // Inflamación, Inestabilidad, Bloqueo, etc.
    imaging?: string;

    // Comparable
    comparableSign?: {
        type: string;
        name: string;
        conditions: string;
        painLevel: number | string;
        reproducesSymptom: boolean;
        afterEffect: string;
        severity: string;
    };
}

export interface BaseEvaluacion {
    id?: string;
    usuariaId: string;
    procesoId: string;
    year?: string;

    status: 'DRAFT' | 'CLOSED';
    sessionAt: string; // Fecha de la sesión
    clinicianResponsible: string;

    // Control Reloj (Pill Tracker)
    timer?: {
        screen1Seconds: number;
        screen2Seconds: number;
        screen3Seconds: number;
        screen4Seconds: number;
        screen5Seconds: number;
        totalSeconds: number;
        startedAt?: string;
    };

    // AI Tracker
    ai?: {
        lastRunAt?: string;
        inputHash?: string;
        errors?: string[];
        lastEndpointCalled?: string;
    };
    aiCache?: Record<string, { hash: string, createdAt: string, model: string, latencyMs: number }>;
    aiOutputs?: Record<string, any>;

    audit: AuditTrail;

    // ----- FASE 2.1 y Antiguas Legacy properties (para compatibilidad de compilación transicional) -----
    activeObjectiveSetVersionId?: string;
    motivos?: any[];
    objectivesVersion?: any;
    dxKinesico?: any;
    psfs?: any;
    bpsFactors?: any;
    timeSpentSeconds?: number;
    objectives?: TreatmentObjective[];
    planPronostico?: any;
    clinicalSynthesis?: string;
    dxKinesiologico?: string;
    planAsistenciaRecomendado?: string;
    operationalPlan?: any;
    attendancePlan?: any;
    loadTrafficLight?: any;
}

export interface EvaluacionInicial extends BaseEvaluacion {
    type: 'INITIAL';
    // PANTALLA 1: ENTREVISTA INTEGRAL
    interview?: {
        hasUrgency?: boolean;
        redFlagsCheck?: Record<string, boolean>;
        redFlagsAction?: string;
        safetyStatusSuggested?: 'Verde' | 'Amarillo' | 'Rojo';

        focos: FocusArea[];

        irritabilityCalculated?: 'Alta' | 'Media' | 'Baja';
        irritabilityExplanation?: string;

        mechanismSuggested?: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto';
        mechanismReasons?: string;

        functionalLimitationPrimary?: string;
        personGoal?: string;
        psfs: Array<{ activity: string, score: number, linkedFocusId: string }>;
        sane?: number;
        groc?: number;

        bpsFactors?: string[];
        bpsImpactSuggested?: 'Bajo' | 'Moderado' | 'Alto';
    };

    // PANTALLA 2: EXAMEN FISICO GUIADO
    guidedExam?: {
        checklistSuggested?: {
            essential: Array<{ id: string, label: string, why: string, how: string, linked_focus: string | null }>;
            recommended: Array<{ id: string, label: string, why: string, how: string, linked_focus: string | null }>;
            optional: Array<{ id: string, label: string, why: string, how: string, linked_focus: string | null }>;
        };
        observation?: string;
        inspection?: string;
        palpation?: string;
        functionalMobility?: Array<{ movement: string, achieves: string, pain: string, quality: string, comparison: string, reproducesFocusIds: string[], notes: string }>;
        comparableRetest?: Array<{ focusId: string, result: string, reproduces: boolean, notes: string }>;
        analyticMobility?: Array<{ test: string, degrees: string, notes: string }>;
        strengthCapacity?: Array<{ test: string, pattern: string, mrc: string, dynamometry: string, notes: string }>;
        neuro?: string;
        flexibility?: string;
        orthopedicTests?: Array<{ test: string, result: string, reproducesFocusIds: string[], notes: string }>;
        motorControl?: string;
    };

    // PANTALLA 3: SINTESIS Y CLASIFICACION (Motor)
    autoSynthesis?: {
        structuralSuspicions?: Array<{ label: string; confidence: string; reproduceSymptom: boolean; source: string }>;
        functionalDeficits?: Array<{ label: string; baseline: string; side: string; linkedPsfs: boolean }>;
        contextBps?: string[];
        trafficLight?: 'Verde' | 'Amarillo' | 'Rojo';
        trafficLightRationale?: string;
        presentationTags?: string[];
    };

    // PANTALLA 4: DIAGNOSTICO Y METAS (Gemini + Editor)
    geminiDiagnostic?: {
        kinesiologicalDxNarrative?: string;
        differentialFunctional?: string;

        safetyAlerts?: string[];
        clinicalConsiderations?: string[];
        missingData?: string[];

        objectivesGeneral?: string[];
        objectivesSmart?: Array<{ text: string, linkedDeficit: string }>;

        operationalPlan?: {
            interventions: string[];
            dosage: string;
        };
        prognosis?: string;
        prognosisFactors?: string;
    };
}

export interface EvaluacionReevaluacion extends BaseEvaluacion {
    type: 'REEVALUATION';
    // PANTALLA 5: REEVALUACION 
    reevaluation?: {
        indexEvaluationId?: string; // Baseline pointer
        isSameProblem?: boolean;
        newRedFlags?: boolean;
        changedMechanism?: boolean;
        changedComparable?: boolean; // FASE 2.2.5
        changedPsfs?: boolean;       // FASE 2.2.5
        progressSummary?: string;
        planModifications?: string;
        // Agregado por req: Retest
        retest?: any;
        updatedObjectives?: any;     // FASE 2.2.5
    };
}

export type Evaluacion = EvaluacionInicial | EvaluacionReevaluacion;

export interface ExercisePrescription {
    id: string; // ID local para key mapping en UI
    name: string; // Obligatorio
    pattern?: 'Sentadilla' | 'Bisagra' | 'Empuje' | 'Tracción' | 'Core' | 'Movilidad' | 'Respiratorio' | 'Potencia' | 'Otro';
    side?: 'Bilateral' | 'Unilateral Izq' | 'Unilateral Der';
    equipment?: string[]; // Array de items (Banda, Mancuerna, etc.)
    sets: string;
    repsOrTime: string;
    loadKg?: string;
    rpe?: string; // Nuevo exclusivo
    rir?: string; // Nuevo exclusivo
    rpeOrRir?: string; // Legacy field
    rest?: string;
    frequency?: string;

    // Variables premium
    mainVariable?: 'Carga' | 'ROM' | 'Velocidad' | 'Volumen' | 'Densidad' | 'Técnica';
    progressionCriteria?: string;
    notes?: string;

    // FASE 2.1.24 Integración
    objectiveIds?: string[];
}

export interface ExerciseRx {
    effortMode: 'RIR' | 'RPE';
    rows: Array<ExercisePrescription>;
}

export interface InterventionRecord {
    id: string; // Para iterar en React
    category: 'Educación' | 'Terapia manual' | 'Modalidades físicas' | 'Vendaje/soporte' | 'Exposición/retorno' | 'Respiratorio/relajación' | 'Otras';
    subType: string; // Seleccionado de lista sugerida o 'Otro'
    dose?: string; // Ej: 15 min, 3x10
    intensity?: 'Baja' | 'Media' | 'Alta';
    durationMinutes?: number; // FASE 2.1.25: Analitica de tiempos
    notes?: string; // Máx 200 chars
    objectiveIds?: string[]; // IDs vinculados de los meta-objetivos
    createdAt?: string;
    createdBy?: string;
    copiedFromEvolutionId?: string; // Trazabilidad
}

export interface AuditTrail {
    draftCreatedAt?: string; // FASE 2.1.23: Apertura del borrador
    firstSavedAt?: string;   // FASE 2.1.23: Primer guardado real en DB
    createdAt?: string;      // Fecha en que se creó el registro final (si no era draft)
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    lastEditedAt?: string; // FASE 2.1.16: Última edición
    closedAt?: string;
    closedBy?: string;
    lateReason?: string;
    copiedFromEvolutionId?: string; // Para FASE 2.1.6
}

export interface Evolucion {
    id?: string;
    usuariaId: string;
    casoId?: string | null;     // Legacy, equivalente a procesoId
    procesoId?: string;         // FASE 2.2.4: Conexión explícita al Proceso
    sesionId?: string | null;
    evaluationIndexId?: string; // FASE 2.2.4: Eval inicial vigente del proceso
    loadTrafficLightAtSession?: 'Verde' | 'Amarillo' | 'Rojo'; // FASE 2.2.4
    considerationsAtSession?: string[];                        // FASE 2.2.4

    status: 'DRAFT' | 'CLOSED';
    sessionAt: string; // ISO string (Antes fechaHoraAtencion)
    sessionAtChangeReason?: string; // FASE 2.1.23: Justificación de cambio de sessionAt
    sessionAtHistory?: Array<{
        before: string;
        after: string;
        reason: string;
        changedAt: string;
        changedByUid: string;
        changedByName: string;
    }>; // FASE 2.1.23: Trazabilidad de corrección de fecha/hora de atención

    clinicianResponsible: string; // Antes autorUid/autorName

    // Estado principal de la sesión (Fase 2.1.14)
    sessionStatus?: 'Realizada' | 'No asiste' | 'Cancelada' | 'Suspendida por mal estado';

    // Bloque extra opcional de signos vitales (Fase 2.1.14)
    vitalSigns?: {
        bloodPressureSys?: number | '';
        bloodPressureDia?: number | '';
        heartRate?: number | '';
        spO2?: number | '';
        acuteSymptoms?: string[];
        symptomNote?: string;
    };

    // Sub-bloque si la sesión fue Suspendida/Cancelada
    suspensionDetails?: {
        reason: string;
        action: string;
        note?: string;
    };

    pain: {
        evaStart: number | string;
        evaEnd: number | string;
        contradictionReason?: string; // FASE 2.1.21: Justificación requerida si dolor aumenta y plan progresa.
    };

    sessionGoal: string; // Antes objetivoSesion

    // Preferencias y UI State guardadas en DB
    perceptionMode?: 'RIR' | 'RPE'; // Modo perceptual del kinesiólogo

    // FASE 2.1.22 - Readiness y Wellness Check-In
    sessionNumber?: number; // Contador correlativo (Sesión N/M)
    readiness?: {
        sleepQuality?: 'Pobre' | 'Normal' | 'Óptimo';
        stressLevel?: 'Alto' | 'Moderado' | 'Bajo';
        energy?: 'Baja' | 'Normal' | 'Alta';
        homeTasksCompleted?: 'No Aplica' | 'No' | 'Parcial' | 'Sí';
    };
    outcomesSnapshot?: { // Optativo, para cierres analíticos.
        groc?: number;
        sane?: number;
    };

    // Campos FASE 2.1.17 - Registro Clínico y Cierre
    handoffText?: string;

    // Soporte Legacy y Pro para refactor progresivo
    interventions: InterventionRecord[] | {
        categories: string[];
        notes: string; // Antes intervenciones (texto)
    };

    exercises?: ExercisePrescription[]; // Legacy FASE 2.1.19
    exerciseRx?: ExerciseRx; // Nuevo FASE 2.1.20

    educationNotes?: string;
    nextPlan: string; // Antes planProximaSesion

    // FASE 2.1.18: Selección granular    // FASE 2.1.24: Objetivos del Proceso trabajados intra-sesión
    objectiveSetVersionId?: string; // Heredada del Proceso Clínico
    selectedObjectiveIds?: string[];
    selectedObjectivesSnapshot?: Array<{ id: string, label: string }>;
    objectiveWork?: Array<{ id: string, sessionStatus: 'trabajado' | 'avanzó' | 'sin cambio' | 'empeoró' }>;
    objectiveSelectionReason?: string; // Para justificar dejar en 0 si había objetivos.

    // Legacy FASE 2.1.4 (será reemplazado por objectiveWork en UI, mantenido por safety)
    objectivesWorked?: {
        objectiveIds: string[];
        objectiveSetVersionId?: string;
    };

    audit: AuditTrail;

    // Campos Antiguos Legacy / Migración
    notesLegacy?: string;
    _migratedFromLegacy?: boolean;
    _sourcePath?: string;

    // Campos en Desuso (Deprecados progresivamente, se mapean a los nuevos al leer/guardar)
    fechaHoraAtencion?: string;
    autorUid?: string;
    autorName?: string;
    dolorInicio?: number | string;
    objetivoSesion?: string;
    intervencionesLegacy?: string;
    ejerciciosPrescritos?: string;
    dolorSalida?: number | string;
    planProximaSesionLegacy?: string;
    estado?: 'BORRADOR' | 'CERRADA';
    lateCloseReason?: string;
}
