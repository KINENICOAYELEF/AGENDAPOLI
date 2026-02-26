export interface Evolucion {
    id?: string;
    usuariaId: string;
    casoId?: string | null;
    sesionId?: string | null;
    fechaHoraAtencion: string; // ISO string

    // Trazabilidad de Autor (Firebase Auth)
    autorUid: string;
    autorName: string;

    // Clínica (Campos mínimos sugeridos)
    dolorInicio: number | string; // EVA 0-10, lo dejamos string para que el input type="number" fluya o vacío
    objetivoSesion: string;
    intervenciones: string;
    ejerciciosPrescritos: string;
    dolorSalida: number | string; // EVA 0-10
    planProximaSesion: string;

    // Estado Legal Médico
    estado: 'BORRADOR' | 'CERRADA';
    lateCloseReason?: string;

    // Timestamps
    createdAt?: string;
    updatedAt?: string;
    closedAt?: string;

    // Flags de migración temporal
    _migratedFromLegacy?: boolean;
    _sourcePath?: string;
}
