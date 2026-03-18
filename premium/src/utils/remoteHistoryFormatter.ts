import { RemoteHistory } from '@/types/personaUsuaria';
import { humanize } from './humanizer';

export function buildBasalSynthesis(history: RemoteHistory): string {
    if (!history) return 'Sin antecedentes remotos basales registrados.';

    const sections: string[] = [];

    // 1. Historial Médico
    const med = history.medicalHistory;
    if (med) {
        const modifiers = med.criticalModifiers?.join(', ') || 'Ninuno';
        const considers = med.clinicalConsiderations || 'Ninguna explícita';
        const diagnoses = med.diagnoses?.map(d => d.name).join(', ') || 'Normal';
        const surgeries = med.surgeries?.map(s => s.name).join(', ') || 'Ninguna';
        const meds = med.medications?.map(m => m.name).join(', ') || 'Sin información o no relevantes';
        // FASE 63: Incluir condiciones clínicas relevantes del selector
        const condiciones = med.condicionesClinicasRelevantes?.map(c => (c as any).nombre || c.name || '').filter(Boolean).join(', ') || '';

        sections.push(`[HISTORIAL MÉDICO] Modificadores Clínicos: ${modifiers}. Consideraciones: ${considers}. Diagnósticos: ${diagnoses}${condiciones ? '. Condiciones Clínicas: ' + condiciones : ''}. Cirugías: ${surgeries}. Medicamentos: ${meds}.`);
    }

    // 2. Antecedentes MSK previos
    const msk = history.mskHistory;
    if (msk) {
        const problemRegion = msk.historicalProblemRegion || 'No aplica';
        const recurrences = msk.recurrences || 'No reportadas';
        const uselessTr = msk.uselessTreatments || 'No reportado';
        const usefulTr = msk.usefulTreatments || 'No reportado';
        const injuries = msk.relevantInjuries?.map(i => i.notes ? `${i.region}: ${i.notes}` : i.region).join(', ') || '';
        const surgeries = msk.mskSurgeries?.map(s => s.name).join(', ') || '';

        sections.push(`[MSK PREVIO] Región Histórica: ${problemRegion}. Recurrencias: ${recurrences}.${injuries ? ' Lesiones previas: ' + injuries + '.' : ''}${surgeries ? ' Cirugías MSK: ' + surgeries + '.' : ''} Tratamientos Exitosos: ${usefulTr}. Tratamientos Inútiles: ${uselessTr}.`);
    }

    // 3. Deporte y Carga Basal
    const act = history.baseActivity;
    if (act) {
        const sport = act.primarySport || 'Sedentario';
        const level = act.level || 'N/A';
        const load = act.doubleLoad || 'Sin doble carga física descrita';
        const rol = act.rolDeportivo ? ` (Rol: ${act.rolDeportivo})` : '';

        sections.push(`[CARGA BASAL/DEPORTE] Deporte Principal: ${sport}${rol} (Nivel: ${level}). Frecuencia/Duración: ${act.weeklyFrequency || '-'} / ${act.typicalDuration || '-'}. Doble Carga Física: ${load}.`);
    }

    // 4. Contexto Ocupacional
    const occ = history.occupationalContext;
    if (occ) {
        const role = occ.mainRole || 'No especificada';
        const barriers = occ.adherenceBarriers?.join(', ') || 'Ninguna descrita';

        sections.push(`[OCUPACIÓN] Rol: ${role}. Jornada: ${occ.shifts || 'Normal'}. Demandas posturales: Sentado(${occ.timeSitting || '-'}), DePie(${occ.timeStanding || '-'}), Carga(${occ.weightLifting || '-'}). Barreras Adherencia Logísticas: ${barriers}.`);
    }

    // 5. Terreno Biopsicosocial y Protectores
    const bps = history.bpsContext;
    if (bps) {
        const sleep = bps.sleepQuality || 'N/A';
        const stress = bps.stressLevel || 'N/A';
        const mood = bps.basalMood || 'N/A';
        const support = bps.socialSupport || 'N/A';
        const smoke = bps.smoking || 'N/A';
        const prot = bps.protectiveFactors || 'Ninguno';

        sections.push(`[BIO-PSICO-SOCIAL BASAL] Calidad Sueño: ${sleep}. Estrés: ${stress}. Ánimo Basal: ${mood}. Apoyo Social: ${support}. Tabaco: ${smoke}. Factores Protectores de Recuperación: ${prot}.`);
    }

    // 6. Notas Basales
    if (history.permanentNotes) {
        sections.push(`[NOTAS CLÍNICAS] ${history.permanentNotes.trim()}`);
    }

    return sections.join('\n');
}

export function buildP15Structured(history: RemoteHistory): NonNullable<RemoteHistory['p15_context_structured']> {
    const defaultVal: NonNullable<RemoteHistory['p15_context_structured']> = {
        condiciones_clinicas_relevantes: [],
        modificadores_clinicos: [],
        antecedentes_msk: {
            lesiones_previas: [],
            cirugias_previas: [],
            tratamientos_previos_exitosos: [],
            tratamientos_mal_tolerados: [],
            secuelas_persistentes: [],
            recurrencias: [],
            region_historicamente_problematica: [],
            dominancia: 'No especificada',
            ortesis_plantillas: [],
            imagenes_previas_relevantes: []
        },
        deporte_actividad_basal: {
            actividad_deporte_central: 'Sedentario u ocasional',
            categoria: 'N/A',
            nivel_practica_actual: 'N/A',
            frecuencia_semanal: 'N/A',
            duracion_tipica: 'N/A',
            experiencia_acumulada: 'N/A',
            doble_carga_basal: 'No descrita',
            calendario_competitivo_objetivo: 'N/A'
        },
        contexto_ocupacional: {
            ocupacion_principal: 'No especificada',
            jornada_formato: 'Normal',
            demandas_fisicas_laborales: [],
            barreras_logisticas_adherencia: [],
            exposicion_trayectos_conduccion: 'N/A',
            contexto_red_apoyo_laboral: 'N/A'
        },
        contexto_domiciliario: {
            vive_con: 'No especificado',
            red_apoyo_tratamiento: 'No especificada',
            personas_a_cargo: 'No especificado',
            barreras_hogar_entorno: [],
            observacion_contexto_domiciliario: ''
        },
        biopsicosocial_habitos: {
            calidad_sueno: 'Moderada',
            horas_promedio_sueno: 'N/A',
            despertares_nocturnos: 'N/A',
            sueno_reparador: 'No especificado',
            estres_basal: 'Moderado',
            fuente_principal_estres: 'N/A',
            estado_animo_basal: 'Normal',
            adherencia_historica: 'N/A',
            red_apoyo_social_emocional: 'N/A',
            tabaquismo: 'No',
            alcohol: 'Ocasional',
            cafeina: 'Regular',
            patron_dieta_principal: 'Habitual sin restricciones',
            hobbies_bienestar: [],
            factores_protectores: []
        },
        factores_biologicos_relevantes: {
            comorbilidades_relevantes: [],
            medicacion_relevante: [],
            alergias_relevantes: [],
            cirugias_medicas_relevantes: [],
            detalle_clinico_relevante: ''
        },
        notas_basales: history?.permanentNotes || ''
    };

    if (!history) return defaultVal;

    // Poblar condiciones médicas base (campos heredados)
    const med = history.medicalHistory;
    if (med) {
        if (med.criticalModifiers) defaultVal.modificadores_clinicos = [...med.criticalModifiers];
        if (med.diagnoses) defaultVal.factores_biologicos_relevantes.comorbilidades_relevantes = med.diagnoses.map((d: any) => d.name);
        if (med.medications) defaultVal.factores_biologicos_relevantes.medicacion_relevante = med.medications.map((m: any) => m.name);
        if (med.surgeries) defaultVal.factores_biologicos_relevantes.cirugias_medicas_relevantes = med.surgeries.map((s: any) => s.name);
        if (med.clinicalConsiderations) defaultVal.factores_biologicos_relevantes.detalle_clinico_relevante = med.clinicalConsiderations;

        // FASE 63 Bug #2: Condiciones clínicas del selector UI (condicionesClinicasRelevantes)
        if (med.condicionesClinicasRelevantes && med.condicionesClinicasRelevantes.length > 0) {
            med.condicionesClinicasRelevantes.forEach((c: any) => {
                const name = c.name || (c as any).nombre || '';
                if (!name) return;
                const label = c.estado ? `${name} (${c.estado})` : name;
                defaultVal.factores_biologicos_relevantes.comorbilidades_relevantes.push(label);
                // Bug #2b: Medicamentos asociados a las condiciones
                if (c.tratamientoActual && c.tratamientoDetalle && c.tratamientoDetalle.trim()) {
                    defaultVal.factores_biologicos_relevantes.medicacion_relevante.push(c.tratamientoDetalle.trim());
                }
                // Observacion adicional como detalle clínico
                if (c.observacionBreve && c.observacionBreve.trim()) {
                    const obs = defaultVal.factores_biologicos_relevantes.detalle_clinico_relevante;
                    defaultVal.factores_biologicos_relevantes.detalle_clinico_relevante = obs
                        ? `${obs}. ${c.observacionBreve.trim()}`
                        : c.observacionBreve.trim();
                }
            });
        }

        // FASE 63 Bug #4: Alergias
        if (med.allergies && med.allergies.length > 0) {
            defaultVal.factores_biologicos_relevantes.alergias_relevantes = med.allergies.map((a: any) => a.name || String(a)).filter(Boolean);
        }
    }

    // FASE 63 Bug #5: Factores biológicos (embarazo, menopausia, etc.)
    const bio = history.biologicalFactors;
    if (bio) {
        const bioFlags: string[] = [];
        if (bio.embarazoActual) bioFlags.push('Embarazo actual');
        if (bio.postpartoReciente) bioFlags.push('Postparto reciente');
        if (bio.lactancia) bioFlags.push('Lactancia activa');
        if (bio.perimenopausiaMenopausia) bioFlags.push('Perimenopausia / Menopausia');
        if (bio.alteracionesMenstruales) bioFlags.push('Alteraciones menstruales');
        if (bio.antecedentePelvico) bioFlags.push('Antecedente pélvico relevante');
        if (bio.observacion && bio.observacion.trim()) bioFlags.push(bio.observacion.trim());
        if (bioFlags.length > 0) {
            defaultVal.factores_biologicos_relevantes.comorbilidades_relevantes.push(...bioFlags);
        }
    }

    // Poblar MSK
    const msk = history.mskHistory;
    if (msk) {
        if (msk.historicalProblemRegion) defaultVal.antecedentes_msk.region_historicamente_problematica = [msk.historicalProblemRegion];
        if (msk.recurrences) defaultVal.antecedentes_msk.recurrencias = [msk.recurrences];
        if (msk.usefulTreatments) defaultVal.antecedentes_msk.tratamientos_previos_exitosos = [msk.usefulTreatments];
        if (msk.uselessTreatments) defaultVal.antecedentes_msk.tratamientos_mal_tolerados = [msk.uselessTreatments];

        // FASE 63 Bug #3: Lesiones previas, cirugías MSK, secuelas e imágenes
        if (msk.relevantInjuries && msk.relevantInjuries.length > 0) {
            defaultVal.antecedentes_msk.lesiones_previas = msk.relevantInjuries.map((i: any) =>
                i.notes ? `${i.region}: ${i.notes}` : i.region
            );
        }
        if (msk.mskSurgeries && msk.mskSurgeries.length > 0) {
            defaultVal.antecedentes_msk.cirugias_previas = msk.mskSurgeries.map((s: any) => s.name);
        }
        if (msk.persistentSequelae && msk.persistentSequelae.trim()) {
            defaultVal.antecedentes_msk.secuelas_persistentes = [msk.persistentSequelae.trim()];
        }
        if (msk.previousImaging && msk.previousImaging.trim()) {
            defaultVal.antecedentes_msk.imagenes_previas_relevantes = [msk.previousImaging.trim()];
        }
        if (msk.dominancia) defaultVal.antecedentes_msk.dominancia = humanize(msk.dominancia);
        if (msk.usoOrtesis && msk.usoOrtesis.trim()) {
            defaultVal.antecedentes_msk.ortesis_plantillas = [msk.usoOrtesis.trim()];
        }
    }

    // Deporte
    const act = history.baseActivity;
    if (act) {
        if (act.primarySport) defaultVal.deporte_actividad_basal.actividad_deporte_central = humanize(act.primarySport);
        // FASE 63 Bug #6: rolDeportivo (ej: "Instructora de Yoga")
        if (act.rolDeportivo && act.rolDeportivo.trim()) {
            const actual = defaultVal.deporte_actividad_basal.actividad_deporte_central;
            defaultVal.deporte_actividad_basal.actividad_deporte_central = actual
                ? `${actual} · Rol: ${act.rolDeportivo.trim()}`
                : act.rolDeportivo.trim();
        }
        if (act.categoria) defaultVal.deporte_actividad_basal.categoria = humanize(act.categoria);
        if (act.level) defaultVal.deporte_actividad_basal.nivel_practica_actual = humanize(act.level);
        if (act.weeklyFrequency) defaultVal.deporte_actividad_basal.frecuencia_semanal = act.weeklyFrequency;
        if (act.typicalDuration) defaultVal.deporte_actividad_basal.duracion_tipica = act.typicalDuration;
        if (act.yearsExperience) defaultVal.deporte_actividad_basal.experiencia_acumulada = act.yearsExperience;
        if (act.doubleLoad) defaultVal.deporte_actividad_basal.doble_carga_basal = humanize(act.doubleLoad);
        if (act.competitiveCalendar) defaultVal.deporte_actividad_basal.calendario_competitivo_objetivo = act.competitiveCalendar;
    }

    // Ocupacional
    const occ = history.occupationalContext;
    if (occ) {
        if (occ.mainRole) defaultVal.contexto_ocupacional.ocupacion_principal = occ.mainRole;
        if (occ.shifts) defaultVal.contexto_ocupacional.jornada_formato = humanize(occ.shifts);
        if (occ.timeSitting) defaultVal.contexto_ocupacional.demandas_fisicas_laborales.push(`Sentado: ${humanize(occ.timeSitting)}`);
        if (occ.timeStanding) defaultVal.contexto_ocupacional.demandas_fisicas_laborales.push(`De pie: ${humanize(occ.timeStanding)}`);
        if (occ.weightLifting) defaultVal.contexto_ocupacional.demandas_fisicas_laborales.push(`Carga: ${humanize(occ.weightLifting)}`);
        if (occ.repetitiveMovements && occ.repetitiveMovements.trim()) {
            defaultVal.contexto_ocupacional.demandas_fisicas_laborales.push(`Mov. repetitivos: ${occ.repetitiveMovements}`);
        }
        if (occ.driving && occ.driving.trim()) {
            defaultVal.contexto_ocupacional.exposicion_trayectos_conduccion = occ.driving;
        }
        if (occ.adherenceBarriers) defaultVal.contexto_ocupacional.barreras_logisticas_adherencia = occ.adherenceBarriers.map(b => humanize(b));
        if (occ.contextoDomiciliario) {
            const dom = occ.contextoDomiciliario;
            if (dom.viveCon) defaultVal.contexto_domiciliario.vive_con = humanize(dom.viveCon);
            if (dom.redApoyo) defaultVal.contexto_domiciliario.red_apoyo_tratamiento = humanize(dom.redApoyo);
            if (dom.personasACargo) defaultVal.contexto_domiciliario.personas_a_cargo = humanize(dom.personasACargo);
            if (dom.barrerasEntorno) defaultVal.contexto_domiciliario.barreras_hogar_entorno = dom.barrerasEntorno;
            if (dom.observacion) defaultVal.contexto_domiciliario.observacion_contexto_domiciliario = dom.observacion;
        }
    }

    // BPS
    const bps = history.bpsContext;
    if (bps) {
        if (bps.sleepQuality) defaultVal.biopsicosocial_habitos.calidad_sueno = humanize(bps.sleepQuality);
        if (bps.stressLevel) defaultVal.biopsicosocial_habitos.estres_basal = humanize(bps.stressLevel);
        if (bps.basalMood) defaultVal.biopsicosocial_habitos.estado_animo_basal = humanize(bps.basalMood);
        if (bps.smoking) defaultVal.biopsicosocial_habitos.tabaquismo = humanize(bps.smoking);
        if (bps.socialSupport) defaultVal.biopsicosocial_habitos.red_apoyo_social_emocional = humanize(bps.socialSupport);
        if (bps.protectiveFactors) defaultVal.biopsicosocial_habitos.factores_protectores = [bps.protectiveFactors];
        if (bps.sueno) {
            if (bps.sueno.horasPromedio) defaultVal.biopsicosocial_habitos.horas_promedio_sueno = bps.sueno.horasPromedio;
            if (bps.sueno.despertares) defaultVal.biopsicosocial_habitos.despertares_nocturnos = humanize(bps.sueno.despertares);
            if (bps.sueno.reparador) defaultVal.biopsicosocial_habitos.sueno_reparador = humanize(bps.sueno.reparador);
        }
        if (bps.estres?.fuentePrincipal) defaultVal.biopsicosocial_habitos.fuente_principal_estres = humanize(bps.estres.fuentePrincipal);
        if (bps.habitos) {
            if (bps.habitos.alcohol) defaultVal.biopsicosocial_habitos.alcohol = bps.habitos.alcohol;
            if (bps.habitos.cafeina) defaultVal.biopsicosocial_habitos.cafeina = bps.habitos.cafeina;
            if (bps.habitos.dieta) defaultVal.biopsicosocial_habitos.patron_dieta_principal = bps.habitos.dieta;
        }
        if (bps.actividadesSignificativas) defaultVal.biopsicosocial_habitos.hobbies_bienestar = [bps.actividadesSignificativas];
    }

    return defaultVal;
}

export function buildP15Flags(history: RemoteHistory): NonNullable<RemoteHistory['p15_context_flags']> {
    const flags: NonNullable<RemoteHistory['p15_context_flags']> = {
        factores_personales_positivos: [],
        factores_personales_negativos: [],
        facilitadores_ambientales: [],
        barreras_ambientales: [],
        modificadores_pronostico: [],
        modificadores_adherencia: [],
        factores_que_modulan_examen: [],
        factores_que_modulan_carga: []
    };

    if (!history) return flags;

    const bps = history.bpsContext;
    if (bps?.sleepQuality === 'poor') {
        flags.factores_personales_negativos.push('Mala calidad de sueño basal');
        flags.modificadores_pronostico.push('Baja recuperación por mal sueño');
    } else if (bps?.sleepQuality === 'good') {
        flags.factores_personales_positivos.push('Buena calidad de sueño basal (Protector)');
    }

    if (bps?.stressLevel === 'high') {
        flags.factores_personales_negativos.push('Estrés basal crónico elevado');
        flags.modificadores_pronostico.push('Estrés puede sensibilizar dolor y ralentizar tolerancia a cargas');
    }

    if (bps?.basalMood && bps.basalMood.includes('Depresivo')) {
         flags.factores_personales_negativos.push('Nota de ánimo depresivo o ansiedad basal');
    }

    if (history.medicalHistory?.criticalModifiers && history.medicalHistory.criticalModifiers.length > 0) {
        flags.factores_que_modulan_examen.push(...history.medicalHistory.criticalModifiers);
        flags.factores_que_modulan_carga.push(...history.medicalHistory.criticalModifiers);
    }

    if (history.occupationalContext?.adherenceBarriers && history.occupationalContext.adherenceBarriers.length > 0) {
        flags.barreras_ambientales.push(...history.occupationalContext.adherenceBarriers.map(b => humanize(b)));
        flags.modificadores_adherencia.push(...history.occupationalContext.adherenceBarriers.map(b => humanize(b)));
    }

    return flags;
}
