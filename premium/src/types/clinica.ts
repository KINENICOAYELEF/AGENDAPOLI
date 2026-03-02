/**
 * PROCESO CLÍNICO (Atención Activa)
 * Contenedor macro que agrupa Sesiones y Evoluciones de una persona
 */
export interface Proceso {
    id?: string;
    personaUsuariaId: string;

    // Estado de la relación clínica
    estado: 'ACTIVO' | 'PAUSADO' | 'ALTA' | 'CERRADO_ADMIN';

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
    activeObjectiveSetVersionId?: string;
    timelineIndex?: number;
    caseSnapshot?: {
        // Un resumen compacto en texto o tags que deja la evaluación M13 para leer rápido
        summary: string;
        lastUpdated: string;
        trafficLight?: 'Verde' | 'Amarillo' | 'Rojo';
    };
}

export interface TreatmentObjective {
    id: string; // ID local único
    description: string;
    category?: 'Pain' | 'ROM' | 'Strength' | 'Function' | 'Other';
    status: 'ACTIVE' | 'ACHIEVED' | 'DROPPED';
    targetDate?: string;
}

export interface MotivoEvaluacion {
    id: string; // ID local único
    motivoLabel: string; // Ej: 'Principal', 'Secundario' (M0)
    region: string;
    lado: 'Izquierdo' | 'Derecho' | 'Bilateral' | 'N/A';

    priority?: number;
    active?: boolean;

    // Entrevista / Subjetivo (M2)
    subjective: {
        onsetType?: 'Agudo' | 'Insidioso' | 'Post-quirúrgico' | string;
        onsetDateOrDuration?: string;
        mechanism?: 'Puro' | 'Mixto' | string;
        symptomLocationMap?: string;
        painPattern?: string;
        irritability?: 'Baja' | 'Media' | 'Alta' | '';
        aggravatingFactors?: string[];
        easingFactors?: string[];
        functionalLimitationPrimary?: string;
        otherLimitations?: string[];
        sportOrWorkDemand?: string;
        beliefsFearAvoidanceQuick?: string;
        goalOfPerson?: string;

        // Legacy (mantener para compatibilidad transicional si es necesario)
        mecanismo?: string;
        tiempoEvolucion?: string;
        agravantes?: string;
        alivios?: string;
        limitacionFuncional?: string;
        metasPersonaUsuaria?: string;
    };

    // Banderas Rojas (M1)
    redFlagsChecklist: Record<string, boolean>;
    redFlagsActionText?: string;
    safetyStatusSuggested?: 'Verde' | 'Amarillo' | 'Rojo'; // IA / Determinista flag

    // Comparable Sign (M6)
    comparableSign?: {
        asteriscoPrincipal?: {
            tipo: string;
            condiciones: string;
            dolor: string;
            afterEffect: string;
        };
        secundarios?: Array<{ descripcion: string, dolor: string }>;
    };

    // Examen Físico / Objetivo (M7)
    objectiveExam?: {
        // Universal
        rom?: Array<{ mov: string, lado: string, val: string, dolor: boolean, notes: string }>;
        strength?: Array<{ group: string, lado: string, method: string, val: string, dolor: boolean, notes: string }>;
        specialTests?: Array<{ test: string, result: string, dolor: boolean, notes: string }>;
        functionalTests?: Array<{ test: string, metric: string, result: string, dolor: boolean, notes: string }>;
        neuroScreen?: { tags: string[], notes: string };
        painProvokers?: Array<{ action: string, context: string }>;
        movementQuality?: { tags: string[], notes: string };
        palpationOther?: string;
        // Condicionales M7
        loadRelatedTests?: Array<{ test: string, result: string, notes: string }>;
        instabilityTests?: Array<{ test: string, result: string, notes: string }>;
        motorControlTests?: string;
    };

    // Hallazgos Estructurales vs Funcionales (M8)
    structuralVsFunctional?: {
        estructurales: string[];
        funcionales: string[];
        driverPrincipal?: 'Estructural' | 'Funcional' | 'Mixto';
    };

    // Clasificación Inteligente (M9)
    classification?: {
        irritabilityFinal?: 'Alta' | 'Media' | 'Baja';
        mecanismoDolorDefinitivo?: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto';
        tags?: string[];
    };

    // Resumen Analítico (Previo / Legacy)
    impairmentSummary?: {
        mobilityDeficit?: boolean;
        strengthDeficit?: boolean;
        loadIntolerance?: boolean;
        movementCoordinationDeficit?: boolean;
        sensitizationFeatures?: boolean;
        otherDrivers?: string[];
    };

    // Legacy Examen (2.2)
    objectiveMeasures?: {
        rom: string;
        fuerza: string;
        pruebasEspeciales: string;
        dolorConPruebas: string;
        controlMotor: string;
        textoLibre: string;
    };
}

export interface Evaluacion {
    id?: string;
    usuariaId: string; // Equivalent a personId
    procesoId: string;
    year?: string;

    type: 'INITIAL' | 'REEVALUATION' | 'NEW_MOTIVE_EVAL';
    status: 'DRAFT' | 'CLOSED';
    sessionAt: string; // Fecha de la sesión de evaluación (real evaluationAt)

    // M0: Inicio Rápido Global
    urgencyFilter?: boolean;
    evaActualGlobal?: string | number;

    // Control Reloj (FASE 2.2.1)
    timer?: {
        startedAt?: string;
        totalSeconds?: number;
        pausedSeconds?: number;
        pauses?: Array<{ start: string, end: string }>;
    };
    timeSpentSeconds?: number; // Legacy cronometraje

    clinicianResponsible: string;

    // AI Tracker (FASE 2.2.1)
    ai?: {
        enabled?: boolean;
        lastRunAt?: string;
        inputHash?: string;
        outputs?: Record<string, any>;
        appliedFlags?: Record<string, boolean>;
        errors?: string[];
    };

    // M4: Factores BPS Global
    bpsFactors?: {
        flagsChecklist?: { [key: string]: boolean };
        positiveFactors?: string[];
        negativeFactors?: string[];
        bpsImpactSuggested?: 'Bajo' | 'Moderado' | 'Alto';
    };

    // M5: Función y Actividad Global (PSFS)
    psfs?: {
        activities: Array<{ activity: string, score: number }>;
        quickActivitiesTags?: string[];
    };

    // FASE 2.2: Estructura modular Múltiples Motivos (M2, M6, M7, M8, M9)
    motivos?: MotivoEvaluacion[];

    // M11: Dx kinésico y BPS (IA)
    dxKinesico?: {
        narrative?: string; // Síntesis clínica final editable
        icfStructure?: string; // Estructuración ICF-like
        differentialFunctional?: string; // Diagnóstico Diferencial Funcional

        // Legacy
        primary?: string;
        differentialList?: string[];
        classificationTags?: string[];
        confidenceLowMedHigh?: string;
        notes?: string;
    };
    integration?: {
        synthesis?: string;
    };

    // IA y Síntesis Centralizada (Legacy 2.2)
    clinicalSynthesis?: string;
    dxKinesiologico?: string;
    planAsistenciaRecomendado?: string;

    // M12: Objetivos + Semáforo + Pronóstico (IA)
    objectivesVersion?: {
        objectiveSetVersionId: string;
        isActiveForProcess?: boolean;
        objectives: Array<{
            id: string;
            texto: string; // Reemplaza "label" y "description"
            tipo: 'General' | 'Específico';
            medidaAsociada?: string;
            criterioExito?: string;
        }>;
    };

    // FASE 2.2.1: Planes Separados
    operationalPlan?: {
        interventionsPlanned?: string[];
        dosagePrinciples?: string;
        educationPlan?: string;
        homePlan?: string;
        constraints?: string;
    };
    attendancePlan?: {
        recommendedFrequencyWeekly?: string;
        estimatedDurationWeeks?: string;
        prognosisFunctional?: string;
        dischargeCriteria?: string;
    };
    loadTrafficLight?: 'Verde' | 'Amarillo' | 'Rojo'; // M12

    // Identificador legacy (2.1) temporalmente deprecado a favor de objectivesVersion
    versionId?: string;
    objectives?: TreatmentObjective[];

    // FASE 2.2: Plan de Asignación y Pronóstico (Legacy)
    planPronostico?: {
        frecuenciaSemanal: string;
        duracionEstimadaSemanas: string;
        criteriosProgresion: string;
        criteriosAlta: string;
        pronosticoTexto: string;
    };

    audit: AuditTrail;
}

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
    casoId?: string | null;
    sesionId?: string | null;

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
