/**
 * Fundamento de Datos del Agente Autónomo para Agenda Poli
 * Define los esquemas para Rotaciones, Asignaciones, Revisiones Privadas,
 * Perfiles Longitudinales de Estudiantes y Trayectorias de Personas Atendidas.
 */

export interface Rotation {
    id?: string;
    studentId: string;
    universityId: string;
    startDate: string;
    endDate: string;
    status: 'ACTIVE' | 'COMPLETED' | 'PAUSED';
    formativeWindow: { from: string; to: string };
    finalWindow: { from: string; to: string };
    secondOpportunity?: { enabled: boolean; window?: { from: string; to: string } };
    createdAt: string;
    updatedAt: string;
}

export interface PatientAssignment {
    id?: string;
    patientId: string;
    studentId: string;
    startDate: string;
    endDate?: string;
    isPrimary: boolean;
    reason?: string;
    createdBy: string;
    createdAt: string;
}

export interface RecordMetadata {
    authorId: string;
    authorRole: 'INTERNO' | 'DOCENTE' | 'ADMIN';
    patientId: string;
    processId?: string;
    createdAt: string;
    updatedAt: string;
    schemaVersion: string;
    attributionStatus: 'verified' | 'unknown';
}

export interface SourceReference {
    recordId: string;
    recordType: 'EVALUACION' | 'EVOLUCION' | 'OSCE' | 'DEFENSA' | 'ESCRITO';
    section?: string;
    fieldPath?: string;
    exactExcerpt: string;
    contentHash?: string;
}

export type ReviewCategory = 
    | 'DOCUMENTACION_INCOMPLETA' 
    | 'INCOHERENCIA_ENTREVISTA_EXAMEN'
    | 'INCOHERENCIA_HALLAZGOS_SINTESIS'
    | 'DOSIFICACION_INCORRECTA'
    | 'FALTA_REEVALUACION'
    | 'LENGUAJE_NOCEBO'
    | 'SESGO_ANCLAJE'
    | 'BANDERA_ROJA_OMITIDA';

export type TeacherDecisionStatus = 
    | 'accepted' 
    | 'edited' 
    | 'rejected_incorrect' 
    | 'rejected_irrelevant' 
    | 'rejected_too_strict' 
    | 'already_discussed' 
    | 'snoozed';

export interface AgentReview {
    id?: string;
    runId: string;
    studentId: string;
    patientId: string;
    recordType: 'EVALUACION' | 'EVOLUCION' | 'OSCE' | 'DEFENSA' | 'ESCRITO';
    recordId: string;
    category: ReviewCategory;
    severity: 'ALTA' | 'MEDIA' | 'BAJA';
    confidence: number; // 0.0 a 1.0
    observation: string;
    reasoning: string;
    whyItMatters: string;
    missingEvidence?: string;
    sourceReferences: SourceReference[];
    feedbackDraft: string;
    socraticQuestion?: string;
    recommendedPractice?: string;
    status: 'PENDIENTE' | 'REVISADO_DOCENTE' | 'APROBADO_ENVIADO' | 'DESCARTADO';
    teacherDecision?: TeacherDecisionStatus;
    agentVersion: string;
    promptVersion: string;
    createdAt: string;
    reviewedAt?: string;
}

export interface CompetencyMetric {
    status: 'NOVATO' | 'INTERMEDIO' | 'RESIDENTE';
    trend: 'UP' | 'STABLE' | 'DOWN';
    confidence: number;
    evidenceCount: number;
    recentEvidence: string[];
    insufficientEvidence?: boolean;
}

export interface StudentLearningProfile {
    studentId: string;
    competencies: {
        pilarA_entrevistaBPS: CompetencyMetric;
        pilarB_examenDirigido: CompetencyMetric;
        pilarC_intervencionEBM: CompetencyMetric;
    };
    repeatedPatterns: string[];
    strengths: string[];
    gaps: string[];
    simulationClinicalDiscrepancies?: string[];
    evidenceCoverage: number;
    confidence: number;
    lastClinicalActivity?: string;
    lastSimulationActivity?: string;
    currentCheckpoint?: 'INICIAL' | 'FORMATIVO' | 'FINAL';
    lastUpdatedAt: string;
}

export interface PatientContinuitySummary {
    patientId: string;
    initialProblems: string[];
    currentProblems: string[];
    goals: string[];
    outcomeMeasures: string[];
    interventionTrajectory: string[];
    importantChanges: string[];
    unresolvedQuestions: string[];
    continuityRisks: string[];
    lastEvaluationAt?: string;
    lastEvolutionAt?: string;
    lastReassessmentAt?: string;
}

export interface TeacherDecision {
    id?: string;
    reviewId: string;
    originalDraft: string;
    finalText: string;
    decision: TeacherDecisionStatus;
    reason?: string;
    editedFields?: string[];
    createdAt: string;
}

export interface AgentRun {
    id?: string;
    interactionId: string;
    triggerId?: string;
    status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'INCOMPLETE';
    startedAt: string;
    completedAt?: string;
    studentsProcessed: number;
    recordsProcessed: number;
    reviewsCreated: number;
    tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
    agentVersion: string;
    promptVersion: string;
    errorCode?: string;
    errorMessage?: string;
    retryCount?: number;
}
