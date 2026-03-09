// FASE 45: Cierre Final de Arquitectura Clínica y Datos
export interface RemoteHistory {
    // 1) Historial Médico y Consideraciones
    medicalHistory: {
        diagnoses: Array<{ name: string }>;
        chronicDiseases: Array<{ name: string }>;
        surgeries: Array<{ name: string }>;
        medications: Array<{ name: string }>;
        allergies: Array<{ name: string }>;
        clinicalConsiderations: string;
        criticalModifiers: string[];

        // FASE 45: Arrays estructurados analíticos
        condicionesClinicasRelevantes?: Array<{
            name: string; // Ej: Hipertensión arterial, Diabetes...
            estado: 'Controlada' | 'No controlada' | 'No sabe' | string;
            tratamiento: boolean;
            observacion: string;
        }>;
    };

    // FASE 45: Sub-bloque biológico
    biologicalFactors?: {
        embarazoActual?: boolean;
        postpartoReciente?: boolean;
        lactancia?: boolean;
        perimenopausiaMenopausia?: boolean;
        alteracionesMenstruales?: boolean;
        antecedentePelvico?: boolean;
        observacion?: string;
    };

    // 2) MSK y Deportivos Previos
    mskHistory: {
        relevantInjuries: Array<{ region: string; notes: string }>;
        recurrences: string;
        mskSurgeries: Array<{ name: string }>;
        usefulTreatments: string;
        uselessTreatments: string;
        previousImaging: string;
        persistentSequelae: string;
        historicalProblemRegion: string;
        dominancia?: string; // FASE 45
        usoOrtesis?: string; // FASE 45
    };

    // 3) Actividad Física, Deporte y Carga
    baseActivity: {
        primarySport: string;
        categoria?: string; // FASE 45: Running, Fútbol, etc.
        level: string;
        weeklyFrequency: string;
        typicalDuration: string;
        yearsExperience: string;
        basalGoal: string;
        competitiveCalendar: string;
        surfaceOrEquipment: string;
        doubleLoad: string;
    };

    // 4) Ocupación, Estudio y Contexto
    occupationalContext: {
        mainRole: string;
        physicalDemands: string;  // Demanda física ocupacional general
        shifts: string;
        timeSitting: string;
        timeStanding: string;
        weightLifting: string;
        repetitiveMovements: string;
        driving: string;
        adherenceBarriers: string[];
    };

    // 5) BPS (Factores Basales de Recuperación)
    bpsContext: {
        sleepQuality: 'poor' | 'ok' | 'good' | '';
        sleepHours: string;
        stressLevel: 'low' | 'med' | 'high' | '';
        basalMood: string;
        socialSupport: string;
        smoking: string;
        alcohol: string;
        otherHabits: string;
        poorAdherenceHistory: string;
        protectiveFactors: string;
    };

    // 6) Notas Basales del Expediente
    permanentNotes: string;

    // FASE 44: Consolidado string para IA P1
    basalSynthesis?: string;

    // Control
    lastUpdated?: string;
    updatedByClinician?: string;

    // Legacy Support
    comorbidities?: any;
}

export interface PersonaUsuaria {
    id?: string;

    // FASE 45: Datos base
    identity: {
        fullName: string;
        rut?: string;
        fechaNacimiento?: string; // YYYY-MM-DD
        edad?: number; // Para analítica, derivado de fechaNacimiento
        ageRange?: string; // Legacy
        sexoRegistrado?: 'Mujer' | 'Hombre' | 'Intersexual' | 'No especifica' | string;
        comuna?: string;
        ciudad?: string;
        telefono?: string;
        correo?: string;
        contactoEmergenciaNombre?: string;
        contactoEmergenciaRelacion?: string;
        observacionesAdministrativas?: string;
        dominantSide?: string; // Legacy
        contactMinimal?: string; // Legacy
    };

    // FASE 45: Contexto social y educacional
    socialContext?: {
        nivelEducacional?: 'Básica' | 'Media' | 'Técnico' | 'Universitario' | 'Postgrado' | 'No especifica' | string;
    };

    consent: {
        accepted: boolean;
        acceptedAt?: string;
        acceptedByUid?: string;
    };

    remoteHistory?: RemoteHistory;

    meta: {
        createdAt?: string;
        createdBy?: string;
        updatedAt?: string;
        updatedBy?: string;
    };

    // Legacy migration fields (deprecated)
    nombreCompleto?: string;
    telefono?: string;
    email?: string;
    notasAdministrativas?: string;
}
