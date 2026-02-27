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
    name: string;
    sets: string;
    repsOrTime: string;
    loadKg?: string;
    rpeOrRir?: string;
    notes?: string;
}

export interface AuditTrail {
    createdAt?: string;
    createdBy?: string;
    updatedAt?: string;
    updatedBy?: string;
    closedAt?: string;
    closedBy?: string;
    lateReason?: string;
}

export interface Evolucion {
    id?: string;
    usuariaId: string;
    casoId?: string | null;
    sesionId?: string | null;

    status: 'DRAFT' | 'CLOSED';
    sessionAt: string; // ISO string (Antes fechaHoraAtencion)
    clinicianResponsible: string; // Antes autorUid/autorName

    pain: {
        evaStart: number | string;
        evaEnd: number | string;
    };

    sessionGoal: string; // Antes objetivoSesion

    interventions: {
        categories: string[];
        notes: string; // Antes intervenciones (texto)
    };

    exercises: ExercisePrescription[]; // El Módulo estrella (Reemplaza ejerciciosPrescritos string)

    educationNotes?: string;
    nextPlan: string; // Antes planProximaSesion

    objectivesWorked?: {
        objectiveIds: string[];
        objectiveSetVersionId?: string;
    };

    outcomesSnapshot?: {
        groc?: number | string;
        sane?: number | string;
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
