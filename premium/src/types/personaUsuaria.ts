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

        // FASE 45/46.5: Arrays estructurados analíticos
        condicionesClinicasRelevantes?: Array<{
            name: string; // Ej: Hipertensión arterial, Diabetes...
            estado: 'Controlada' | 'No controlada' | 'No sabe' | string;
            tratamientoActual: boolean;
            tratamientoDetalle: string;
            observacionBreve: string;
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
        rolDeportivo?: string; // FASE 46.6: Rol, posición o especialidad
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

        // FASE 46: Contexto domiciliario y red de apoyo
        contextoDomiciliario?: {
            viveCon: 'solo' | 'pareja' | 'familia' | 'hijos' | 'otros' | '';
            redApoyo: 'si' | 'parcial' | 'no' | '';
            personasACargo: 'no' | 'ninos' | 'adulto_mayor' | 'otro' | '';
            barrerasEntorno: string[];
            observacion: string;
        };
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

        // FASE 46: Cuantificación BPS
        sueno?: {
            horasPromedio: string;
            despertares: 'ninguno' | '1' | '2_o_mas' | '';
            reparador: 'si' | 'no' | 'variable' | '';
        };
        estres?: {
            fuentePrincipal: 'laboral' | 'familiar' | 'economica' | 'academica' | 'salud' | 'otra' | '';
        };
        tabaquismo?: {
            cantidadDiaria: '1_5' | '6_10' | 'mas_10' | 'variable' | '';
        };
        habitos?: {
            alcohol: string;
            cafeina: string;
            dieta: string;
            otrasSustancias: string;
        };
        actividadesSignificativas?: string;
    };

    // 6) Notas Basales del Expediente
    permanentNotes: string;

    // FASE 44: Consolidado string para IA P1
    basalSynthesis?: string;

    // FASE 19: Contexto local estructurado P1.5
    p15_context_structured?: {
        condiciones_clinicas_relevantes: string[];
        modificadores_clinicos: string[];
        antecedentes_msk: {
            lesiones_previas: string[];
            cirugias_previas: string[];
            tratamientos_previos_exitosos: string[];
            tratamientos_mal_tolerados: string[];
            secuelas_persistentes: string[];
            recurrencias: string[];
            region_historicamente_problematica: string[];
            dominancia: string;
            ortesis_plantillas: string[];
            imagenes_previas_relevantes: string[];
        };
        deporte_actividad_basal: {
            actividad_deporte_central: string;
            categoria: string;
            nivel_practica_actual: string;
            frecuencia_semanal: string;
            duracion_tipica: string;
            experiencia_acumulada: string;
            doble_carga_basal: string;
            calendario_competitivo_objetivo: string;
        };
        contexto_ocupacional: {
            ocupacion_principal: string;
            jornada_formato: string;
            demandas_fisicas_laborales: string[];
            barreras_logisticas_adherencia: string[];
            exposicion_trayectos_conduccion: string;
            contexto_red_apoyo_laboral: string;
        };
        contexto_domiciliario: {
            vive_con: string;
            red_apoyo_tratamiento: string;
            personas_a_cargo: string;
            barreras_hogar_entorno: string[];
            observacion_contexto_domiciliario: string;
        };
        biopsicosocial_habitos: {
            calidad_sueno: string;
            horas_promedio_sueno: string;
            despertares_nocturnos: string;
            sueno_reparador: string;
            estres_basal: string;
            fuente_principal_estres: string;
            estado_animo_basal: string;
            adherencia_historica: string;
            red_apoyo_social_emocional: string;
            tabaquismo: string;
            alcohol: string;
            cafeina: string;
            patron_dieta_principal: string;
            hobbies_bienestar: string[];
            factores_protectores: string[];
        };
        factores_biologicos_relevantes: {
            comorbilidades_relevantes: string[];
            medicacion_relevante: string[];
            alergias_relevantes: string[];
            cirugias_medicas_relevantes: string[];
            detalle_clinico_relevante: string;
        };
        notas_basales: string;
    };

    p15_context_flags?: {
        factores_personales_positivos: string[];
        factores_personales_negativos: string[];
        facilitadores_ambientales: string[];
        barreras_ambientales: string[];
        modificadores_pronostico: string[];
        modificadores_adherencia: string[];
        factores_que_modulan_examen: string[];
        factores_que_modulan_carga: string[];
    };

    // Control
    lastUpdated?: string;
    updatedByClinician?: string;

    // FASE 63: Datos de identidad del paciente copiados del doc principal de la persona
    identity_paciente?: {
        fullName: string;
        fechaNacimiento: string;
        edad?: number | null;
        sexoRegistrado: string;
    };

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
        assignedInternId?: string;
        assignedInternName?: string;
    };

    // Legacy migration fields (deprecated)
    nombreCompleto?: string;
    telefono?: string;
    email?: string;
    notasAdministrativas?: string;
}
