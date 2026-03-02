// FASE 2.2.1 V2 & FASE 8: Perfil Permanente Estricto
export interface RemoteHistory {
    comorbidities: Array<{ name: string; status: 'controlled' | 'uncontrolled' | 'unknown'; severity: 'low' | 'med' | 'high'; clinicalConsiderations: string }>;
    surgeries: Array<{ name: string; dateApprox: string; sequelae: string }>;
    medications: Array<{ name: string }>;
    allergies: Array<{ name: string }>;
    relevantInjuryHistory: Array<{ region: string; yearApprox: string; recurrence: boolean; notes: string }>;
    physicalActivity: { type: string; frequency: string; level: string; goals: string };
    occupationDemands: { type: string; standing: boolean; sitting: boolean; lifting: boolean; repetitive: boolean; shifts: boolean; notes: string };
    sleep: { hoursAvg: number; quality: 'poor' | 'ok' | 'good'; awakenings: number; notes: string };
    stressMood: { stressLevel: 'low' | 'med' | 'high'; mood: 'low' | 'ok' | 'high'; notes: string };
    logistics: { timeBarrier: boolean; transportBarrier: boolean; gymAccess: boolean; equipmentAccess: boolean; other: string };
    preferences: { likes: string; dislikes: string; schedulePreference: string; adherenceHistory: string };
    permanentNotes: string;

    // Legacy support
    lastUpdated?: string;
    updatedByClinician?: string;
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
