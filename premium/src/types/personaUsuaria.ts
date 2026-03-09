// FASE 38: Perfil Permanente Profundizado (PROMPT A)
export interface RemoteHistory {
    // 1) Historial Médico y Consideraciones
    medicalHistory: {
        diagnoses: Array<{ name: string }>;
        chronicDiseases: Array<{ name: string }>;
        surgeries: Array<{ name: string }>;
        medications: Array<{ name: string }>;
        allergies: Array<{ name: string }>;
        clinicalConsiderations: string; // "diabetes, patologías cardiovasculares..."
        criticalModifiers: string[]; // ['Diabetes', 'Oncológico', 'Osteoporosis']
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
    };

    // 3) Actividad Física, Deporte y Carga
    baseActivity: {
        primarySport: string;
        level: string; // "amateur, competitivo, sedentario..."
        weeklyFrequency: string;
        typicalDuration: string;
        yearsExperience: string;
        basalGoal: string;
        competitiveCalendar: string;
        surfaceOrEquipment: string;
        doubleLoad: string; // Ej: deporte + trabajo físico
    };

    // 4) Ocupación, Estudio y Contexto
    occupationalContext: {
        mainRole: string; // Ocupación / Estudio
        physicalDemands: string;
        shifts: string; // Jornada / Turnos
        timeSitting: string; // "Alta > 6h", "Baja"
        timeStanding: string;
        weightLifting: string; // "Frecuente", "Ocasional", "No"
        repetitiveMovements: string;
        driving: string; // Conducción prolongada
        adherenceBarriers: string[]; // ['Tiempo', 'Transporte', 'Dinero']
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
        protectiveFactors: string; // red de apoyo, etc.
    };

    // 6) Notas Basales del Expediente
    permanentNotes: string;

    // FASE 44: Consolidado string para IA P1
    basalSynthesis?: string;

    // Control
    lastUpdated?: string;
    updatedByClinician?: string;

    // (Legacy Support para evitar quiebres inmediatos de pacientes previos en P1.5)
    comorbidities?: any;
    surgeries?: any;
    medications?: any;
    allergies?: any;
    relevantInjuryHistory?: any;
    physicalActivity?: any;
    occupationDemands?: any;
    sleep?: any;
    stressMood?: any;
    logistics?: any;
    preferences?: any;
}

export interface PersonaUsuaria {
    id?: string;

    identity: {
        fullName: string;
        ageRange: string; // ej: "20-29"
        sexGender?: string;
        dominantSide?: string;
        contactMinimal?: string;
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
    rut?: string;
    telefono?: string;
    email?: string;
    notasAdministrativas?: string;
}
