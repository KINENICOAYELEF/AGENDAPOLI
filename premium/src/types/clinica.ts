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
}

export interface TreatmentObjective {
    id: string; // ID local único
    description: string;
    category?: 'Pain' | 'ROM' | 'Strength' | 'Function' | 'Other';
    status: 'ACTIVE' | 'ACHIEVED' | 'DROPPED';
    targetDate?: string;
}

export interface Evaluacion {
    id?: string;
    usuariaId: string;
    procesoId: string;

    // Identificador de la versión para congelar objetivos
    versionId: string; // Usualmente igual al id o a un timestamp
    type: 'INITIAL' | 'REEVALUATION';
    status: 'DRAFT' | 'CLOSED';

    sessionAt: string; // Fecha de la sesión de evaluación
    clinicianResponsible: string;

    // Solo pondremos la colección de objetivos por ahora (lo que importa en 2.1.4)
    objectives: TreatmentObjective[];

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
    notes?: string; // Máx 200 chars
    objectiveIds?: string[]; // IDs vinculados de los meta-objetivos
}

export interface AuditTrail {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    lastEditedAt?: string; // FASE 2.1.16
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

    // FASE 2.1.18: Selección granular de objetivos macro trabajados hoy
    objectiveSetVersionId?: string;
    selectedObjectiveIds?: string[]; // Array simple de IDs para checkboxes
    selectedObjectivesSnapshot?: Array<{ id: string, label: string }>; // Foto para inmutabilidad del registro
    objectiveWork?: Array<{ id: string, sessionStatus: 'trabajado' | 'avanzó' | 'logrado' | 'sin cambio' }>;

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
