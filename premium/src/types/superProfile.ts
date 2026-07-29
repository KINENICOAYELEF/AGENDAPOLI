export type CognitiveLevel = 'NOVATO' | 'INTERMEDIO' | 'RESIDENTE';

export interface PillarMetrics {
    /** Pilar A: Entrevista Clínica, Anamnesis BPS, Banderas Rojas/Amarillas (0-100) */
    pilarA_entrevista: number;
    /** Pilar B: Examen Físico Dirigido, Clusters Clínicos, Hipótesis Diferenciales (0-100) */
    pilarB_examen: number;
    /** Pilar C: Intervención EBM, Dosificación FITT-VP/RPE, Educación al Paciente (0-100) */
    pilarC_intervencion: number;
}

export interface EPAMetric {
    id: string;
    nombre: string;
    estado: 'PENDIENTE' | 'EN_DESARROLLO' | 'ACREDITADA';
    observaciones: string;
}

export interface SuperProfile {
    userId: string;
    estudianteNombre: string;
    nivelCognitivo: CognitiveLevel;
    pilares: PillarMetrics;
    epas: EPAMetric[];
    sesgosCognitivosDetectados: string[];
    fortalezasLongitudinales: string[];
    brechasLongitudinales: string[];
    miniPromptDinamico: string;
    fechaUltimaSintesis: string;
    totalSimulacionesCompletadas: number;
}

export const INITIAL_SUPER_PROFILE = (userId: string, estudianteNombre: string = 'Interno'): SuperProfile => ({
    userId,
    estudianteNombre,
    nivelCognitivo: 'NOVATO',
    pilares: {
        pilarA_entrevista: 50,
        pilarB_examen: 50,
        pilarC_intervencion: 50
    },
    epas: [
        { id: 'EPA-1', nombre: 'Anamnesis e Historial BPS', estado: 'EN_DESARROLLO', observaciones: 'En proceso de evaluación inicial.' },
        { id: 'EPA-2', nombre: 'Razonamiento Diagnóstico y Clusters', estado: 'EN_DESARROLLO', observaciones: 'En proceso de evaluación inicial.' },
        { id: 'EPA-3', nombre: 'Examen Físico Dirigido EBM', estado: 'EN_DESARROLLO', observaciones: 'En proceso de evaluación inicial.' },
        { id: 'EPA-4', nombre: 'Prescripción de Ejercicio y Dosificación', estado: 'EN_DESARROLLO', observaciones: 'En proceso de evaluación inicial.' },
        { id: 'EPA-5', nombre: 'Defensa de Caso y Comunicación Profesional', estado: 'EN_DESARROLLO', observaciones: 'En proceso de evaluación inicial.' }
    ],
    sesgosCognitivosDetectados: [],
    fortalezasLongitudinales: ['Iniciando entrenamiento clínico interactivo.'],
    brechasLongitudinales: ['Pendiente de evaluación de razonamiento en 3 Pilares.'],
    miniPromptDinamico: '=== DIRECTRIZ ADAPTATIVA DE INICIO ===\n- Nivel del Estudiante: Novato.\n- Directiva socrática: Ofrece andamiaje comprensivo, exige justificación anatómica en cada respuesta y verifica la dosificación de ejercicio.',
    fechaUltimaSintesis: new Date().toISOString(),
    totalSimulacionesCompletadas: 0
});
