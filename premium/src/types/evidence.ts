export type ArticleCategory = 'Clínica' | 'Biomecánica' | 'Fisiología' | 'Entrenamiento' | 'Neurociencia del Dolor' | 'Prevención / RTS' | 'Anatomía' | 'Otro';
export type TaskStatus = 'PENDING' | 'REVISION' | 'APPROVED' | 'REJECTED';

export interface EvidenceContribution {
    id: string;
    studentId: string;
    studentName: string;
    
    // Resumen propio del estudiante
    resumenEstudiante: string;
    
    // Diseño del estudio identificado
    studyDesign: string;
    
    // Múltiples perlas (cada una con su id y contenido)
    perlas: Record<string, string>;
    
    // Legacy: backward compatibility
    perlaClinica?: string;
    
    // Limitaciones (incluye metodología, transferibilidad, gaps)
    limitaciones: string;
    
    // Campos estructurados opcionales (para Entrenamiento)
    dosis?: {
        intensidad?: string;
        volumen?: string;
        frecuencia?: string;
        duracion?: string;
        tipoContraccion?: string;
    };
    
    // Evaluación Docente
    status: TaskStatus;
    nota?: number;
    feedbackDocente?: string;
    
    createdAt: number;
    updatedAt: number;
}

export interface EvidenceArticle {
    id?: string;
    title: string;
    url: string;
    category: ArticleCategory;
    cif: string;
    population: string;
    tags: string[];
    
    summary: string;
    finding: string;
    methodology: string;
    
    contributions: EvidenceContribution[];
    
    createdAt: number;
    createdBy: string;
}

export interface EvidenceTask {
    id?: string;
    studentId: string;
    studentName: string;
    
    articleTitle: string;
    articleUrl: string;
    
    dueDate: number;
    status: TaskStatus;
    
    articleId?: string;
    contributionId?: string;
    
    assignedBy: string;
    createdAt: number;
}
