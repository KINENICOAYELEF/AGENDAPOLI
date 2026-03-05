import { EvaluacionInicial, KineFocusArea, KineAutoOutputs, AnamnesisProximaV3 } from "@/types/clinica";

// Helper para sacar los focos en V4, V3 o V2
const getFocos = (interview: any): any[] => {
    if (interview?.v4?.focos) return interview.v4.focos;
    if (interview?.v3?.focos) return interview.v3.focos;
    return interview?.focos || [];
};

// 1. Irritabilidad
export function computeIrritability(foco: any): { level: 'Baja' | 'Media' | 'Alta' | 'Desconocida', reasons: string[] } {
    if (!foco) return { level: 'Desconocida', reasons: ['Foco no definido'] };

    let score = 0;
    const reasons: string[] = [];

    // V4 vs V3 vs V2
    const current = foco.dolorActual ?? foco.dolor?.actual ?? Number(foco.painCurrent) ?? 0;
    const worst = foco.peor24h ?? foco.dolor?.peor24h ?? Number(foco.painWorst24h) ?? 0;
    const maxPain = Math.max(current, worst);

    if (maxPain >= 7) { score += 3; reasons.push(`Dolor severo reportado (>=7).`); }
    else if (maxPain >= 4) { score += 1; reasons.push(`Dolor moderado reportado.`); }

    const isNightPain = foco.agravantes?.toLowerCase().includes('noche') || foco.wakesAtNight || foco.pattern24h === 'Noche peor';
    if (isNightPain) {
        score += 2; reasons.push('Dolor nocturno interrumpe el sueño.');
    }

    const afterEffectFreq = foco.dolorPostActividad || foco.irritabilidadInputs?.dolorPostCarga || foco.afterEffectFreq;
    const settlingTime = foco.tiempoCalma || foco.irritabilidadInputs?.tiempoCalma || foco.settlingTime;

    if (afterEffectFreq === 'Frecuente' || afterEffectFreq === 'Siempre' || settlingTime === '>24 h' || settlingTime === '1–24 h' || settlingTime.includes('hora') || settlingTime.includes('dia')) {
        score += 3; reasons.push('El síntoma tiene un after-effect prolongado o muy frecuente.');
    } else if (afterEffectFreq === 'A veces') {
        score += 1;
    }

    const ease = foco.provocationEase || (foco.inicio === 'Subito_Trauma' || foco.historia?.inicioTipo === 'Subito_Trauma' ? 'Media' : 'Baja');
    if (ease === 'Alta') {
        score += 2; reasons.push('Poca carga o movimiento genera síntomas rápidamente (Alta facilidad de provocación).');
    }

    if (score >= 5) return { level: 'Alta', reasons };
    if (score >= 2) return { level: 'Media', reasons };
    return { level: 'Baja', reasons: ['Componentes de dolor y provocación estables, recuperación rápida tisular.'] };
}

// 2. Seguridad (Triage)
export function computeSafety(interview: any): { level: 'Verde' | 'Amarillo' | 'Rojo', reasons: string[], checklist: string[] } {
    const reasons: string[] = [];
    const checklist: string[] = [];
    let isRed = false;
    let isYellow = false;

    if (!interview) return { level: 'Verde', reasons: [], checklist: [] };

    const v4Risk = interview.v4?.seguridad;
    const v3Risk = interview.v3?.riesgo?.redFlags;

    const sys = v4Risk?.fiebre_sistemico_cancerPrevio || v3Risk?.fiebre_sistemico_cancerPrevio || interview.redFlagsSystemic;
    const weight = v4Risk?.bajaPeso_noIntencionada || v3Risk?.bajaPeso_noIntencionada || interview.redFlagsWeightLoss;
    const night = v4Risk?.dolorNocturno_inexplicable_noMecanico || v3Risk?.dolorNocturno_inexplicable_noMecanico || interview.redFlagsNightPain;

    if (sys || weight || night) {
        isRed = true;
        reasons.push('ALERTA MÁSICA: Síntomas sistémicos, historia de cáncer, baja peso o dolor nocturno implacable no mecánico.');
        checklist.push('Derivar a urgencias o evaluación médica a la brevedad. No iniciar terapia activa sin clearance.');
    }

    const traumaHigh = v4Risk?.trauma_altaEnergia_caidaImportante || v3Risk?.trauma_altaEnergia_caidaImportante || interview.redFlagsTraumaHigh;
    const fracture = v4Risk?.sospechaFractura_incapacidadCarga || v3Risk?.sospechaFractura_incapacidadCarga || interview.redFlagsFractureParams;

    if (traumaHigh || fracture) {
        isRed = true;
        reasons.push('Trauma de alta energía o presunción de fractura (incapacidad de carga grave).');
        checklist.push('Aplicar reglas de decisión clínica para fracturas (ej. Ottawa) o derivar a imagenología.');
    }

    const neuroSevere = v4Risk?.neuroGraveProgresivo_esfinteres_sillaMontar || v3Risk?.neuroGraveProgresivo_esfinteres_sillaMontar || interview.redFlagsNeuroSevere;
    if (neuroSevere) {
        isRed = true;
        reasons.push('Síntomas neurológicos graves, progresivos o signos de alarma espinal (ej. síndrome cauda equina, mielopatía).');
        checklist.push('Examen neurológico ultra estricto (miotomas, dermatomas, reflejos, upper motor neuron tests). Derivación médica contingente.');
    }

    const dvtTep = interview.redFlagsDvtTep;
    if (dvtTep) {
        isRed = true;
        reasons.push('Sospecha de Trombosis Venosa Profunda (ej. Hinchazón pantorrilla, calor, dolor) o TEP.');
        checklist.push('Aplicar criterios de Wells. Derivar a urgencia si es positivo.');
    }

    // Manual Override V4
    if (v4Risk?.overrideUrgenciaMedica) {
        isRed = true;
        reasons.push(`Override Urgencia V4 Activado: ${v4Risk.justificacionUrgencia || 'Sin justificación'}`);
        checklist.push('Derivar a urgencias por bandera roja manual del clínico.');
    }

    const personalRisk = interview.orangeFlagPersonalRisk; // solo V2, V3 podria tener estres altisimo
    if (personalRisk) {
        isYellow = true;
        reasons.push('Bandera Naranja o Riesgo Personal identificado. Requiere cautela e investigación.');
        checklist.push('Investigar contexto biopsicosocial severo o trastorno mental acompañante que frene el pronóstico.');
    }

    // Regla aguda Trauma
    const focos = getFocos(interview);
    const tieneTraumaAgudo = focos.some(f =>
        (f.onsetType === 'Súbito' && f.suddenSound === 'Chasquido' && f.suddenImmediateCapacity === 'Incapaz' && f.suddenSwellingVisible === 'Sí') ||
        (f.inicio === 'Subito_Trauma' && f.contextoDetallado?.toLowerCase().includes('chasquido')) ||
        (f.historia?.inicioTipo === 'Subito_Trauma' && f.historia?.mecanismoContexto?.toLowerCase().includes('chasquido'))
    );
    if (tieneTraumaAgudo && !isRed) {
        isYellow = true;
        reasons.push('Patrón clásico de daño estructural agudo (Chasquido + Impotencia + Edema rápido).');
        checklist.push('Evaluar rango seguro e integridad ligamentosa con precaución extrema.');
    }

    if (isRed) return { level: 'Rojo', reasons, checklist };
    if (isYellow) return { level: 'Amarillo', reasons, checklist };
    return { level: 'Verde', reasons: ['Examen subjetivo no revela red flags evidentes para el cuidado conservador.'], checklist: ['Realizar examen físico estándar según irritabilidad de focos.'] };
}

// 3. Mecanismos de Dolor
export function computePainMechanism(foco: any, interview: any): { category: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto' | 'Desconocido', label: string, reasons: string[] } {
    if (!foco) return { category: 'Desconocido', label: 'Sin Especificar', reasons: [] };

    let noci = 0;
    let neuro = 0;
    let nociPlastic = 0;
    const reasons: string[] = [];
    const nature = foco.symptomNature || foco.sintomasTags || [];
    const radiates = foco.symptomRadiates || foco.irradiacion;

    // Neuropático
    if (nature.includes('Hormigueo') || nature.includes('Adormecimiento') || nature.includes('Corriente') || nature.includes('Quemazón')) {
        neuro += 3;
        reasons.push('Descriptores cardinales de neurodinamia (corriente, quemazón, hormigueo).');
    }
    if (radiates === 'Sube-baja' || radiates === 'Distal') { neuro += 2; reasons.push('El síntoma irradia en recorrido de trayecto nervioso aparentes.'); }

    // Nociplástico/Sensibilización
    if (nature.includes('Difuso') || nature.includes('Pesadez') || radiates === 'Migratorio') {
        nociPlastic += 2;
        reasons.push('Patrón difuso o migratorio sugerente de sensibilización periférica/central.');
    }
    const duration = foco.tiempoDesdeInicio || foco.onsetDuration || foco.historia?.tiempoDesdeInicio || "";
    if (duration.includes('meses') || duration === '>6 meses' || duration === '3–6 meses') {
        nociPlastic += 2;
        reasons.push('Evolución crónica (>3 meses) amplifica el riesgo nociplástico.');
    }

    let sumYellow = 0;
    if (interview?.v4?.bps) {
        sumYellow = Object.values(interview.v4.bps).reduce((a: any, b: any) => typeof b === 'number' ? a + b : a, 0) as number;
    } else if (interview?.v3?.bpsQuick) {
        sumYellow = Object.values(interview.v3.bpsQuick).reduce((a: any, b: any) => typeof b === 'number' ? a + b : a, 0) as number;
    } else if (interview?.yellowFlags) {
        sumYellow = Object.values(interview.yellowFlags).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
    }

    if (sumYellow >= 6) {
        nociPlastic += 2;
        reasons.push('Alto cargo biopsicosocial asociado, gatillo común de sobre-representación central (Nociplastia).');
    }

    // Nociceptivo - Inflamatorio
    let isInflammatory = false;
    const patternNight = foco.pattern24h === 'Noche peor' || foco.agravantes?.toLowerCase().includes('noche');
    if (nature.includes('Pulsátil') || patternNight) {
        noci += 2;
        isInflammatory = true;
        reasons.push('Patrones pulsátiles y molestia nocturna sugieren perfil nociceptivo inflamatorio (químico).');
    }

    // Nociceptivo - Mecánico / Load Related
    let isMechanical = false;
    if (nature.includes('Punzante') || nature.includes('Tirantez') || nature.includes('Opresivo') || nature.includes('Inestabilidad') || nature.includes('Bloqueo') || nature.includes('Agudo') || nature.includes('Oprensivo')) {
        noci += 2;
        isMechanical = true;
        reasons.push('Descriptores mecánicos y asociación directa al test/movimiento.');
    }
    const ease = foco.provocationEase || 'Media';
    if (ease === 'Media' || ease === 'Baja') {
        noci += 1;
        isMechanical = true;
    }

    const max = Math.max(noci, neuro, nociPlastic);
    if (max === 0) return { category: 'Desconocido', label: 'Indeterminado', reasons: ['Atributos no capturados'] };

    if (max === neuro && neuro >= noci + 2 && neuro >= nociPlastic + 1) {
        return { category: 'Neuropático', label: 'Aparente neuropático periférico (mecanosensibilidad v/s conducción)', reasons };
    }
    if (max === nociPlastic && nociPlastic >= noci + 2 && nociPlastic >= neuro + 2) {
        return { category: 'Nociplástico', label: 'Aparente nociplástico / sensibilización global', reasons };
    }

    if (Math.abs(neuro - nociPlastic) <= 1 && nociPlastic > noci || Math.abs(neuro - noci) <= 1 && noci > nociPlastic) {
        return { category: 'Mixto', label: 'Cuadro Mixto solapado', reasons };
    }

    if (isInflammatory && !isMechanical) return { category: 'Nociceptivo', label: 'Nociceptivo dominantemente Inflamatorio', reasons };
    if (isMechanical && !isInflammatory) return { category: 'Nociceptivo', label: 'Nociceptivo Mecánico / Relacionado a la Carga', reasons };
    return { category: 'Nociceptivo', label: 'Nociceptivo Mixto (Mecánico + Inflamatorio)', reasons };
}

export function buildExamChecklist(interview: any, irritabilityLevel: 'Baja' | 'Media' | 'Alta' | 'Desconocida' = 'Baja'): KineAutoOutputs['examChecklistSelected'] {
    const list = {
        essentials: [] as any[],
        recommended: [] as any[],
        avoidOrPostpone: [] as any[]
    };

    if (!interview) return list;

    if (irritabilityLevel === 'Alta') {
        list.essentials.push({ title: 'Rango Activo (AROM) hasta inicio de dolor', rationale: 'Alta irritabilidad', lookFor: ['Inicio dolor', 'Compensaciones motoras'] });
        list.avoidOrPostpone.push({ title: 'Test de sobrecarga sostenida (Isometría max, Carga pliométrica)', rationale: 'Riesgo de flare-up', lookFor: [] });
    } else {
        list.essentials.push({ title: 'Evaluación funcional de sobrepresión (Rango Pasivo + Resistencia Excéntrica)', rationale: 'Baja/Media irritabilidad', lookFor: ['Fin de rango', 'Fuerza estructural'] });
    }

    const focos = getFocos(interview);
    focos.forEach(f => {
        const nature = f.symptomNature || f.sintomasTags || [];
        if (nature.includes('Inestabilidad') || nature.includes('Bloqueo')) {
            list.essentials.push({ title: 'Test de Estabilidad Articular / Integridad Capsuloligamentosa', rationale: `Reporte explícito de inestabilidad en ${f.region}`, lookFor: ['Laxitud', 'Aprehensión'] });
        }
        if (nature.includes('Hormigueo') || nature.includes('Adormecimiento') || nature.includes('Quemazón')) {
            list.essentials.push({ title: 'Examen Neurológico + Neurodinamia (Slump / SLR)', rationale: `Reportes neuropáticos en ${f.region}`, lookFor: ['Miotomas', 'Dermatomas', 'Mecanosensibilidad'] });
        }
        if (f.onsetType === 'Súbito' || f.historia?.inicioTipo === 'Subito_Trauma') {
            list.recommended.push({ title: 'Palpación de alta especificidad', rationale: `Trauma en ${f.region}`, lookFor: ['Brechas tendíneas', 'Edema focal'] });
        }
    });

    return list;
}

export function computeBpsImpact(yellowFlagsOrBps: any): { level: 'Bajo' | 'Medio' | 'Alto', tips: string[] } {
    if (!yellowFlagsOrBps) return { level: 'Bajo', tips: ['Monitorear'] };

    // Sumar solo los valores numéricos del objeto (para manejar 'otros' en V3)
    const sum = Object.values(yellowFlagsOrBps).reduce((a: any, b: any) => typeof b === 'number' ? a + b : a, 0) as number;

    if (sum >= 10) return { level: 'Alto', tips: ['Considerar el dolor como una experiencia compleja, validar el relato de la persona usuaria.', 'Evitar lenguaje biomédico catastrófico.', 'Priorizar educación sobre pacing y neurofisiología del dolor.'] };
    if (sum >= 5) return { level: 'Medio', tips: ['Aplicar manejo de carga empático, preguntar activamente sobre limitantes ocultas (sueño/estrés).'] };
    return { level: 'Bajo', tips: ['Paciente con buena disposición anímica/cognitiva, el cuadro apunta a resolución tisular clásica.'] };
}

export interface AutoSynthesisResult {
    structuralCandidates: { label: string; confidence: string; reproduceSymptom: boolean; source: string }[];
    functionalDeficits: { label: string; baseline: string; side: string; linkedPsfs: boolean }[];
    bpsNotes: { topBarriers: string[]; topFacilitators: string[] };
}

export function autoSynthesizeFindings(exam: any, interview: any): AutoSynthesisResult {
    const structuralCandidates: AutoSynthesisResult['structuralCandidates'] = [];
    const functionalDeficits: AutoSynthesisResult['functionalDeficits'] = [];
    const bpsNotes: AutoSynthesisResult['bpsNotes'] = { topBarriers: [], topFacilitators: [] };

    if (!interview) return { structuralCandidates, functionalDeficits, bpsNotes };

    // BPS
    const bps = interview.v3?.bpsQuick || interview.yellowFlags || {} as any;
    const isSleepIssue = bps.sueno > 0 || bps.sleepImpact > 0;
    const isStressIssue = bps.estres > 0 || bps.highStress > 0 || bps.kinesiophobia > 0 || bps.miedoMoverCargar > 0 || bps.preocupacionDano > 0;

    if (isSleepIssue) bpsNotes.topBarriers.push('Alteración de Recuperación (Sueño)');
    if (isStressIssue) bpsNotes.topBarriers.push('Kinesiofobia / Sobrecarga Cognitiva');

    if (bpsNotes.topBarriers.length === 0) bpsNotes.topFacilitators.push('Paciente sin red-flags biopsicosociales aparentes (Buen pronóstico base).');

    const focos = getFocos(interview);
    focos.forEach((f: any) => {
        const primaryComparableName = f.signoComparable || f.signoComparableEstrella?.nombre || f.primaryComparable?.name;
        const comparablePain = f.dolorEnSigno ?? f.signoComparableEstrella?.dolor ?? f.primaryComparable?.painLevel ?? '';

        if (primaryComparableName) {
            functionalDeficits.push({
                label: primaryComparableName,
                baseline: `Dolor EVA ${comparablePain}/10 bajo condiciones declaradas`,
                side: f.lado || f.side || 'N/A',
                linkedPsfs: true
            });
        }

        if (!exam?.roms) {
            structuralCandidates.push({
                label: `Posible disfunción en ${f.region} (Tejido contráctil vs inerte a confirmar en P2)`,
                confidence: 'Baja', reproduceSymptom: false, source: 'Entrevista Subjetiva'
            });
        }
    });

    return { structuralCandidates, functionalDeficits, bpsNotes };
}

export function generateP2Priorities(interviewV3: AnamnesisProximaV3): AnamnesisProximaV3['automatizacionP2'] {
    const prioridades: AnamnesisProximaV3['automatizacionP2']['prioridades'] = [];
    const alertas: AnamnesisProximaV3['automatizacionP2']['alertas'] = [];

    // Safety global
    const isRed = interviewV3.summaryBadges.seguridad === 'Rojo' || interviewV3.riesgo.overrideUrgenciaMedicaPura;
    const isYellow = interviewV3.summaryBadges.seguridad === 'Amarillo';

    if (isRed) {
        alertas.push({ nivel: 'Block', mensaje: 'Riesgo ROJO detectado. Se requiere evaluación médica o confirmación expresa antes de test físicos activos.' });
    } else if (isYellow) {
        alertas.push({ nivel: 'Warn', mensaje: 'Riesgo AMARILLO. Precaución en tests estructurales.' });
    }

    interviewV3.focos.forEach(foco => {
        const items: AnamnesisProximaV3['automatizacionP2']['prioridades'][0]['items'] = [];

        // 1) Safety
        if (isRed || isYellow) {
            items.push({ tipo: 'Screening', label: 'Revisar banderas / derivación según criterio', razon: 'Presencia de Alertas de Seguridad en Entrevista', prioridad: 'Alta' });
        }

        // 2) Siempre
        items.push({ tipo: 'ROM', label: `Rango activo y pasivo de ${foco.region || 'región'}`, razon: 'Línea base funcional', prioridad: 'Alta' });
        items.push({ tipo: 'Fuerza', label: `Test fuerza basal relacionado a ${foco.region || 'región'}`, razon: 'Capacidad contráctil base', prioridad: 'Media' });
        items.push({ tipo: 'Carga', label: 'Test de carga progresiva según tolerancia', razon: 'Evaluar límite sintomático', prioridad: 'Media' });

        // 3) Neuro
        const nature = foco.sintomasTags || [];
        const isNeuro = nature.includes('Hormigueo') || nature.includes('Adormecimiento') || nature.includes('Corriente') || nature.includes('Quemazón') || nature.includes('Debilidad') || foco.mecanismoClasificacion.categoria.includes('Neuropático');
        if (isNeuro) {
            items.push({ tipo: 'Neuro', label: 'Screen neurológico + neurodinamia / miotomos / dermatomos', razon: 'Patrón de síntomas neuropáticos', prioridad: 'Alta' });
            items.push({ tipo: 'TestEspecial', label: 'Diferenciar raíz vs nervio periférico según patrón', razon: 'Sospecha neuropática', prioridad: 'Media' });
        }

        // 4) Irritabilidad
        const currentScore = computeIrritability(foco).level;
        if (currentScore === 'Alta') {
            items.push({ tipo: 'Carga', label: 'Dosificar exploración, evitar provocación excesiva', razon: 'Irritabilidad Alta', prioridad: 'Alta' });
            items.push({ tipo: 'Educacion', label: 'Explicar irritabilidad y pacing', razon: 'Modulación de síntomas', prioridad: 'Media' });
            alertas.push({ nivel: 'Warn', mensaje: `Foco ${foco.region} tiene Alta irritabilidad. Tenga cautela con la carga.` });
        }

        // 5) Contexto Deportivo
        if (interviewV3.contextoDeportivo?.aplica) {
            items.push({ tipo: 'Carga', label: 'Historia de carga: spikes, volumen, intensidad', razon: 'Contexto deportivo activo', prioridad: 'Alta' });
            if (interviewV3.contextoDeportivo.gestoProvocador) {
                items.push({ tipo: 'TestEspecial', label: `Test específico del gesto: ${interviewV3.contextoDeportivo.gestoProvocador}`, razon: 'Gesto provocador declarado', prioridad: 'Media' });
            }
        }

        // 6) Mecanismo
        const isInflamatorio = foco.mecanismoClasificacion.subtipos.includes('Inflamatorio') || (foco.mecanismoClasificacion.categoria === 'NoDefinido' && nature.includes('Pulsátil'));
        if (isInflamatorio) {
            items.push({ tipo: 'Palpacion', label: 'Signos inflamatorios locales según región', razon: 'Sospecha de nocicepción inflamatoria', prioridad: 'Media' });
            items.push({ tipo: 'Carga', label: 'Pruebas submáximas iniciales', razon: 'Proteger respuesta inflamatoria', prioridad: 'Media' });
        }

        const isNociplastico = foco.mecanismoClasificacion.categoria.includes('Nociplástico');
        if (isNociplastico) {
            items.push({ tipo: 'Educacion', label: 'Dolor persistente: explicación y expectativas', razon: 'Perfil nociplástico / sensibilización', prioridad: 'Alta' });
            items.push({ tipo: 'Screening', label: 'Factores psicosociales y sueño/estrés', razon: 'Sustento BPS del patrón persistente', prioridad: 'Media' });
        }

        if (items.length > 0) {
            prioridades.push({ focoId: foco.id, items });
        }
    });

    return { status: 'ready', prioridades, alertas };
}
