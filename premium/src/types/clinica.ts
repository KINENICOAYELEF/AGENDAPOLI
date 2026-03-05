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

export interface TreatmentObjective {
    id: string; // ID local único
    description: string;
    category?: 'Pain' | 'ROM' | 'Strength' | 'Function' | 'Other';
    status: 'ACTIVE' | 'ACHIEVED' | 'DROPPED';
    targetDate?: string;
}

// ---------------------------------------------------------
// FASE 2.2.X: ANAMNESIS PRÓXIMA ULTRA (KINE REAL) TIPADOS
// ---------------------------------------------------------

export interface KineComparableSign {
    type: 'Tarea funcional' | 'Movimiento' | 'Test clínico' | 'Gesto deportivo' | 'Modo seguro';
    name: string; // ej. Agacharse, Flexión lumbar, Salto
    conditions: string; // ej. Rango completo, 10 reps, con barra 20kg
    achieves: 'Sí' | 'No' | 'Parcial';
    painLevel: number | string;
    quality: 'Normal' | 'Compensado' | 'Sin control';
    expectedAfterEffect: 'Nunca' | 'A veces' | 'Frecuente';
    isSafeMode?: boolean; // Para cuando triage o irritabilidad limitan el test real
    safeModeJustification?: string;
}

export interface KineFocusArea {
    id: string;
    isPrincipal: boolean;

    // A) Definición
    region: string; // Jerárquico: Columna cervical, etc.
    subRegion?: string;
    side: 'Derecho' | 'Izquierdo' | 'Bilateral' | 'N/A';
    onsetDuration: 'Hoy' | '1–7 días' | '2–6 sem' | '6–12 sem' | '3–6 meses' | '>6 meses';
    onsetType: 'Súbito' | 'Gradual';
    course2w: 'Mejorando' | 'Igual' | 'Empeorando' | 'Fluctuante';

    // B) Limitaciones Activas
    mainLimitation: string; // Caminar, Correr, etc.
    clinicalNotes?: string;

    // C) Dolor y 24h
    painScaleId: 'EVA' | 'ENA';
    painCurrent: number | string;
    painWorst24h: number | string;
    painBest24h: number | string;
    painDuringLimitation?: number | string;
    pattern24h: 'Mañana peor' | 'Tarde peor' | 'Noche peor' | 'Variable';
    morningStiffness: '0' | '1–10' | '11–30' | '31–60' | '>60';
    wakesAtNight: boolean;
    afterEffectFreq: 'Nunca' | 'A veces' | 'Frecuente';
    settlingTime: '<15 min' | '15–60 min' | '1–24 h' | '>24 h';
    provocationEase: 'Baja' | 'Media' | 'Alta';

    // D) Ramas de Inicio
    // Solo si Súbito
    suddenContact?: 'Con contacto' | 'Sin contacto';
    suddenKinematics?: string[];
    suddenSound?: 'Chasquido' | 'Tirón' | 'Desgarro' | 'Nada';
    suddenImmediateCapacity?: 'Igual' | 'Con molestia' | 'Detenerse' | 'Incapaz';
    suddenSwellingVisible?: 'Sí' | 'No' | 'No sabe';

    // Solo si Gradual
    gradualVolumeChange?: '0–10' | '10–30' | '30–50' | '>50' | 'No sabe';
    gradualIntensityChange?: '0–10' | '10–30' | '30–50' | '>50' | 'No sabe';
    gradualFreqChange?: 'Igual' | '+1' | '+2' | '+3 o más' | 'No sabe';
    gradualRecovery?: 'Durmiendo menos' | 'Igual' | 'Más';
    gradualPainAppears?: 'Al inicio' | 'Durante' | 'Después' | 'Al día siguiente';

    // E) Perfil de síntomas
    symptomNature: string[]; // Punzante, Opresivo, etc.
    symptomRadiates: 'Local' | 'Se extiende' | 'Sube-baja' | 'Migratorio';
    symptomAssociated: string[]; // Mecánicos, Neuro, Sistémicos

    // F) PSF y Función 
    psfs: Array<{ activity: string, score: number, reproduces: boolean, impact: 'Bajo' | 'Medio' | 'Alto' }>;
    fastIcfActivities: Array<{ category: string, name: string, difficulty: number, reproduces: boolean }>;

    // G) Deporte y Carga
    sportContextActive: boolean;
    sportMain?: string;
    sportDaysPerWeek?: number;
    sportSessionDuration?: number;
    sportIntensity?: 'Baja' | 'Media' | 'Alta';
    sportUpcomingCompetition?: boolean;
    sportCurrentState?: 'Reposo' | 'Modificado' | 'Cruzado' | 'Normal con dolor';
    sportChangeSurface?: string;
    sportChangeShoes?: string;
    sportChangeTechnique?: string;
    sportChangeEquipment?: string;

    // H) Tratamientos Previos
    prevTreatmentsTags: string[];
    prevTreatmentsResult?: 'Mejoró' | 'Igual' | 'Empeoró' | 'No sabe';
    prevKineSessions?: '1–3' | '4–8' | '9–15' | '>15';
    prevKineOpinion?: string;

    // I) Signos Comparables
    primaryComparable?: KineComparableSign;
    secondaryComparables?: KineComparableSign[];
}

export interface KineAutoOutputs {
    // Foco Local Outputs
    perFocus: Record<string, { // focusId -> outputs
        irritabilityLevel: 'Baja' | 'Media' | 'Alta' | 'Desconocida';
        irritabilityReasons: string[];
        painMechanismCategory: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto' | 'Desconocido';
        painMechanismLabel: string; // ej "nociceptivo (mecánico/load-related)"
        painMechanismReasons: string[];
    }>;

    // Evaluación Global
    globalSafetyTriage: 'Verde' | 'Amarillo' | 'Rojo';
    globalSafetyReasons: string[];
    globalSafetyChecklist: string[];

    globalBpsImpact: 'Bajo' | 'Medio' | 'Alto';
    globalBpsTips: string[];

    functionalTags: string[]; // Sugerencias cruzadas (Inestabilidad, Control Motor, etc)

    // Preparación Pantalla 2
    examChecklistSelected: {
        essentials: Array<{ title: string, rationale: string, lookFor: string[] }>;
        recommended: Array<{ title: string, rationale: string, lookFor: string[] }>;
        avoidOrPostpone: Array<{ title: string, rationale: string, lookFor: string[] }>;
    };

    comparableCandidates: string[];
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

export interface AnamnesisProximaV3 {
    version: "v3";
    status: "draft" | "approved";
    updatedAt: string; // ISOString
    painScaleMode: "EVA" | "ENA"; // default "EVA"

    summaryBadges: {
        seguridad: "Verde" | "Amarillo" | "Rojo";
        irritabilidad: "Baja" | "Media" | "Alta" | "NoDefinida";
        mecanismoTop: "Aparentemente Nociceptivo" | "Aparentemente Neuropático" | "Aparentemente Nociplástico" | "Mixto" | "NoDefinido";
    };

    uiConfig: {
        isFocosExpanded: boolean;
    };

    relato: {
        enabled: boolean; // default true
        text: string;
        aiSuggestionStatus: "idle" | "running" | "done" | "error";
        lastSuggestedAt?: string; // ISOString
    };

    riesgo: {
        redFlags: {
            fiebre_sistemico_cancerPrevio: boolean;
            bajaPeso_noIntencionada: boolean;
            dolorNocturno_inexplicable_noMecanico: boolean;
            trauma_altaEnergia_caidaImportante: boolean;
            neuroGraveProgresivo_esfinteres_sillaMontar: boolean;
            sospechaFractura_incapacidadCarga: boolean;
        };
        overrideUrgenciaMedicaPura: boolean; // default false
        notesRiesgo: string;
    };

    bpsQuick: {
        sueno: 0 | 1 | 2;
        estres: 0 | 1 | 2;
        miedoMoverCargar: 0 | 1 | 2;
        preocupacionDano: 0 | 1 | 2;
        bajaAutoeficacia: 0 | 1 | 2;
        catastrofizacion: 0 | 1 | 2;
        presionRetorno: 0 | 1 | 2;
        frustracion: 0 | 1 | 2;
        otros?: string;
    };

    focos: Array<{
        id: string;
        isPrimary: boolean;
        region: string;
        lado: "Izquierdo" | "Derecho" | "Bilateral" | "N/A";

        historia: {
            inicioTipo: "Subito_Trauma" | "Subito_SinTrauma" | "Gradual" | "Reagudizacion" | "NoDefinido";
            tiempoDesdeInicio: string; // "2 días", "3 semanas"
            mecanismoContexto: string; // "cayó corriendo"
        };

        sintomasTags: string[];

        dolor: {
            actual: number | null; // 0-10
            peor24h: number | null;
            mejor24h: number | null;
        };

        irradiacion: "Local" | "Regional" | "Distal" | "NoDefinido";
        agravantes: string;
        aliviantes: string;

        irritabilidadInputs: {
            dolorPostCarga: "Nunca" | "A veces" | "Frecuente" | "Siempre" | "NoDefinida";
            tiempoCalma: string; // "<30 min"
        };

        funcionMeta: {
            limitacionPrincipal: string;
            psfsItems: Array<{ actividad: string; score0a10: number | null }>;
            expectativaPaciente: string;
        };

        signoComparableEstrella: {
            nombre: string;
            dosificacion: string;
            dolor: number | null;
        };

        mecanismoClasificacion: {
            categoria: "Aparentemente Nociceptivo" | "Aparentemente Neuropático" | "Aparentemente Nociplástico" | "Mixto" | "NoDefinido";
            subtipos: string[];
            confidence0a3: 0 | 1 | 2 | 3;
        };
    }>;

    contextoDeportivo: {
        aplica: boolean;
        deportePrincipal: string;
        nivel: "Recreativo" | "Competitivo" | "Elite" | "NoDefinido";
        frecuenciaSemanal: number | null;
        volumenRecienteCambio: "Aumento" | "Disminucion" | "SinCambios" | "NoDefinido";
        eventoProximo: string;
        gestoProvocador: string;
        objetivoRetorno: string;
        estadoActual?: "Normal_SinDolor" | "Normal_ConDolor" | "Modificado" | "ReposoDeportivo" | "NoAplica";
        horasSemanaNivel?: string;
    };

    experienciaPersona: {
        creeQueLoGatillo: string;
        preocupacionPrincipal: "Daño grave" | "Perder rendimiento" | "No poder trabajar" | "Dolor no se irá" | "Otra" | "NoDefinido";
        otraPreocupacionTexto?: string;
        expectativas: string;
    };

    automatizacionP2: {
        status: "idle" | "ready";
        prioridades: Array<{
            focoId: string;
            items: Array<{
                tipo: "Screening" | "ROM" | "Fuerza" | "Neuro" | "Palpacion" | "TestEspecial" | "Carga" | "Educacion";
                label: string;
                razon: string;
                prioridad: "Alta" | "Media" | "Baja";
            }>;
        }>;
        alertas: Array<{ nivel: "Info" | "Warn" | "Block"; mensaje: string }>;
    };
}

export interface FocoV4 {
    id: string;
    esPrincipal: boolean;
    region: string;
    lado: "Izquierdo" | "Derecho" | "Bilateral" | "N/A";

    inicio: "Subito_Trauma" | "Subito_SinTrauma" | "Gradual" | "Reagudizacion" | "NoDefinido";
    tiempoDesdeInicio: string;
    contextoDetallado: string;

    dolorActual: number | null;
    mejor24h: number | null;
    peor24h: number | null;

    irradiacion: "Local" | "Regional" | "Distal" | "NoDefinido" | "N/A" | "Referido" | "Radicular";
    tags: string[];

    agravantes: string;
    aliviantes: string;

    dolorPostActividad: "Nunca" | "A veces" | "Frecuente" | "Siempre" | "NoDefinida";
    tiempoCalma: string;

    signoComparable: string;
    dolorEnSigno: number | null;

    mecanismoCategoria: "Nociceptivo" | "Neuropático" | "Nociplástico" | "Mixto" | "NoDefinido";
    mecanismoApellido: string; // "Inflamatorio", "Mecánico", etc.
    mecanismoTextoFinal: string;

    notaRapida: string; // Log
}

export interface AnamnesisProximaV4 {
    version: "v4";
    status: "draft" | "approved";
    updatedAt: string; // ISOString

    escalaDolorGlobal: "EVA" | "ENA"; // default "EVA"

    focos: FocoV4[];

    psfsGlobal: Array<{
        id: string;
        actividad: string;
        score: number | null; // 0..10
        focoAsociado: string; // "General" o focusId
    }>;

    seguridad: {
        fiebre_sistemico_cancerPrevio: boolean;
        bajaPeso_noIntencionada: boolean;
        dolorNocturno_inexplicable_noMecanico: boolean;
        trauma_altaEnergia_caidaImportante: boolean;
        neuroGraveProgresivo_esfinteres_sillaMontar: boolean;
        sospechaFractura_incapacidadCarga: boolean;
        overrideUrgenciaMedica: boolean;
        justificacionUrgencia: string;
    };

    bps: {
        sueno: 0 | 1 | 2;
        estres: 0 | 1 | 2;
        miedoMoverCargar: 0 | 1 | 2;
        preocupacionDano: 0 | 1 | 2;
        bajaAutoeficacia: 0 | 1 | 2;
        catastrofizacion: 0 | 1 | 2;
        presionRetorno: 0 | 1 | 2;
        frustracion: 0 | 1 | 2;
        otros: string;
    };

    contextoDeportivo: {
        aplica: boolean;
        deportePrincipal: string;
        nivel: "Recreativo" | "Competitivo" | "Elite" | "NoDefinido";
        frecuenciaSemanal: number | null;
        volumenRecienteCambio: "Aumento" | "Disminucion" | "SinCambios" | "NoDefinido";
        eventoProximo: string;
        gestoProvocador: string;
        objetivoRetorno: string;
        estadoActual?: "Normal_SinDolor" | "Normal_ConDolor" | "Modificado" | "ReposoDeportivo" | "NoAplica";
    };

    experienciaPersona: {
        creencia: string;
        preocupacion: "Daño grave" | "Perder rendimiento" | "No poder trabajar" | "Dolor no se irá" | "Otra" | "NoDefinido";
        expectativa: string;
    };

    automatizacionP2: Array<{
        focoId: string;
        tipo: "Screening" | "ROM" | "Fuerza" | "Neuro" | "Palpacion" | "TestEspecial" | "Carga" | "Educacion";
        label: string;
        razon: string;
        prioridad: "Alta" | "Media" | "Baja";
        agregarAP2: boolean;
    }>;
}

export interface EvaluacionInicial extends BaseEvaluacion {
    type: 'INITIAL';
    // PANTALLA 1: ENTREVISTA INTEGRAL (FASE 2.2.X ACTUALIZADA)
    interview?: {
        // V3 (Fase 8)
        v3?: AnamnesisProximaV3;
        // V4 (Fase 9)
        v4?: AnamnesisProximaV4;
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
