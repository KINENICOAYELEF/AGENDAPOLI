export type ArticleCategory = 'Clínica' | 'Biomecánica' | 'Fisiología' | 'Entrenamiento' | 'Anatomía' | 'Otro';
export type TaskStatus = 'PENDING' | 'REVISION' | 'APPROVED' | 'REJECTED';

export interface EvidenceContribution {
    id: string; // Un ID único para la contribución
    studentId: string;
    studentName: string;
    
    // Contenido del estudiante
    perlaClinica: string; // ¿Cómo aplicarías esto con tus usuarios?
    limitaciones: string; // ¿Qué cuidados hay que tener?
    
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
    url: string; // URL al drive o pubmed
    category: ArticleCategory;
    cif: string; // Contexto: Patología, Sistema, Movimiento, etc. según categoría
    population: string; // Población o deporte
    tags: string[]; // Etiquetas añadidas por IA o Docente
    
    summary: string; // Resumen principal del artículo
    finding: string; // Intervención, variable o mecanismo (campo adaptativo)
    methodology: string; // Resultado principal o datos clave (campo adaptativo)
    
    contributions: EvidenceContribution[];
    
    createdAt: number;
    createdBy: string; // Nombre de quien lo creó originalmente
}

export interface EvidenceTask {
    id?: string;
    studentId: string;
    studentName: string;
    
    articleTitle: string;
    articleUrl: string;
    
    dueDate: number; // Timestamp
    status: TaskStatus;
    
    // Si la tarea se refiere a un artículo que ya existe en la BD o uno nuevo
    articleId?: string;
    
    // Referencia a la contribución una vez enviada
    contributionId?: string;
    
    assignedBy: string; // Nombre del docente
    createdAt: number;
}
