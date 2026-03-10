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
    physicalSynthesis?: {
        frame: { foco: string; lado: string; queja_prioritaria: string; irritabilidad: string; tarea_indice: string };
        observation: string[];
        mobility: string[];
        strength_load: string[];
        palpation: string[];
        neurovascular_sensorimotor: string[];
        motor_control: string[];
        orthopedic_tests: string[];
        functional_tests: string[];
        retest: string[];
        complementary_measures: string[];
        summary_text_short: string;
        summary_text_structured: string;
    };
}

export function autoSynthesizeFindings(exam: any, interview: any): AutoSynthesisResult {
    const structuralCandidates: AutoSynthesisResult['structuralCandidates'] = [];
    const functionalDeficits: AutoSynthesisResult['functionalDeficits'] = [];
    const bpsNotes: AutoSynthesisResult['bpsNotes'] = { topBarriers: [], topFacilitators: [] };
    const pSyn: NonNullable<AutoSynthesisResult['physicalSynthesis']> = {
        frame: { foco: '', lado: '', queja_prioritaria: '', irritabilidad: '', tarea_indice: '' },
        observation: [], mobility: [], strength_load: [], palpation: [],
        neurovascular_sensorimotor: [], motor_control: [], orthopedic_tests: [],
        functional_tests: [], retest: [], complementary_measures: [],
        summary_text_short: '', summary_text_structured: ''
    };

    if (!interview) return { structuralCandidates, functionalDeficits, bpsNotes };

    // BPS
    const bps = interview.v3?.bpsQuick || interview.yellowFlags || {} as any;
    const isSleepIssue = bps.sueno > 0 || bps.sleepImpact > 0;
    const isStressIssue = bps.estres > 0 || bps.highStress > 0 || bps.kinesiophobia > 0 || bps.miedoMoverCargar > 0 || bps.preocupacionDano > 0;

    if (isSleepIssue) bpsNotes.topBarriers.push('Alteración de Recuperación (Sueño)');
    if (isStressIssue) bpsNotes.topBarriers.push('Kinesiofobia / Sobrecarga Cognitiva');
    if (bpsNotes.topBarriers.length === 0) bpsNotes.topFacilitators.push('Paciente sin red-flags biopsicosociales aparentes (Buen pronóstico base).');

    // A. Frame / Contexto base
    const focos = getFocos(interview);
    if (focos.length > 0) {
        const primary = focos[0];
        pSyn.frame.foco = primary.region || '';
        pSyn.frame.lado = primary.lado || primary.side || '';
        pSyn.frame.queja_prioritaria = primary.sintomasTags?.join(', ') || '';
        pSyn.frame.irritabilidad = computeIrritability(primary).level;

        const primaryComparableName = primary.signoComparable || primary.signoComparableEstrella?.nombre || primary.primaryComparable?.name;
        const comparablePain = primary.dolorEnSigno ?? primary.signoComparableEstrella?.dolor ?? primary.primaryComparable?.painLevel ?? '';

        if (primaryComparableName) {
            pSyn.frame.tarea_indice = `${primaryComparableName} (${comparablePain}/10)`;
            functionalDeficits.push({
                label: primaryComparableName,
                baseline: `Dolor EVA ${comparablePain}/10 bajo condiciones declaradas`,
                side: primary.lado || primary.side || 'N/A',
                linkedPsfs: true
            });
        }
    }

    if (!exam) return { structuralCandidates, functionalDeficits, bpsNotes };

    // B. Observación
    if (exam.observacionConfig) {
        const { general, postura, marcha, movimiento, conducta } = exam.observacionConfig;
        if (general?.trim()) pSyn.observation.push(`General: ${general.trim()}`);
        if (postura?.trim()) pSyn.observation.push(`Postura/Alineación: ${postura.trim()}`);
        if (marcha?.trim()) pSyn.observation.push(`Marcha/Gesto: ${marcha.trim()}`);
        if (movimiento?.trim()) pSyn.observation.push(`Movim. Inicial: ${movimiento.trim()}`);
        if (conducta?.trim()) pSyn.observation.push(`Conducta Síntoma: ${conducta.trim()}`);
    }

    // C. Movilidad (ROM)
    if (exam.romAnaliticoConfig?.filas?.length) {
        exam.romAnaliticoConfig.filas.forEach((f: any) => {
            if (!f.region && !f.movimiento) return;
            const context = `${f.region || ''} ${f.movimiento || ''}`.trim();
            const type = f.tipoEval || 'unilateral';

            let finding = context + ': ';
            if (type === 'bilateral') {
                finding += `Der [Act ${f.actDer || '-'}, Pas ${f.pasDer || '-'}], Izq [Act ${f.actIzq || '-'}, Pas ${f.pasIzq || '-'}]`;
                if (f.asimetriaObservada?.trim()) finding += ` (Asimetría: ${f.asimetriaObservada})`;
            } else if (type === 'axial') {
                finding += `Act ${f.resAct || '-'} / Pas ${f.resPas || '-'}`;
            } else {
                finding += `Lado ${f.ladoUnilateral || '-'}: Act ${f.resAct || '-'} / Pas ${f.resPas || '-'}`;
            }
            if (f.usaGoniometro && f.grados) finding += ` -> ${f.grados}º`;
            if (f.dolorActivo || f.dolorPasivo) {
                finding += ` | Dolor: ${[f.dolorActivo ? 'Activo' : '', f.dolorPasivo ? 'Pasivo' : ''].filter(Boolean).join('/')}`;
            }
            if (f.calidadMovimiento?.trim()) finding += ` | Calidad: ${f.calidadMovimiento}`;

            pSyn.mobility.push(finding);

            // Si hay módulo de tejidos, agregarlo discretamente sin mezclar
            if (f.tejidosConfig?.activo && f.tejidosConfig?.tejidoObjectivo) {
                const tStatus = f.tejidosConfig.estadoCorto === 'Normal' ? 'Normal' : f.tejidosConfig.estadoCorto;
                pSyn.mobility.push(` * Longitud/Tejido ${f.tejidosConfig.tejidoObjectivo}: ${tStatus}`);
            }
        });
    }

    // D. Fuerza y Carga
    if (exam.fuerzaCargaConfig?.filas?.length) {
        exam.fuerzaCargaConfig.filas.forEach((f: any) => {
            if (!f.region) return;
            let finding = `${f.tipoEvaluacion || 'Carga'} - ${f.region}:`;

            if (f.tipoEvaluacion?.includes('Dinamometría')) {
                if (f.dinamometriaDer || f.dinamometriaIzq) {
                    finding += ` Der: ${f.dinamometriaDer || '-'} ${f.dinamometriaUnidad}, Izq: ${f.dinamometriaIzq || '-'} ${f.dinamometriaUnidad}`;
                    if (f.asimetriaDina) finding += ` (Déficit ${f.asimetriaDina}%)`;
                }
            } else if (f.tipoEvaluacion === 'Ejercicios con Carga (Encoder)') {
                finding += ` Carga ${f.cargaKg || '-'}Kg, Vel ${f.velocidadEncoder || '-'}m/s`;
            } else {
                finding += ` ${f.calidadEsfuerzo || 'Esfuerzo no medido'}`;
            }

            if (f.dolorDurante) finding += ` | Provocación: ${f.dolorDurante}`;
            if (f.observacionExtra?.trim()) finding += ` | Obs: ${f.observacionExtra.trim()}`;

            pSyn.strength_load.push(finding.trim());
        });
    }

    // E. Palpación
    if (exam.palpacionConfig?.estructuras?.length) {
        exam.palpacionConfig.estructuras.forEach((e: any) => {
            if (!e.nombre) return;
            let finding = `${e.nombre} (${e.lado}):`;
            if (e.dolorCalificacion) finding += ` Dolor ${e.dolorCalificacion}.`;
            if (e.temperatura && e.temperatura !== 'Normal') finding += ` Temp ${e.temperatura}.`;
            if (e.edema) finding += ` Edema local.`;
            if (e.observacion?.trim()) finding += ` ${e.observacion.trim()}`;
            pSyn.palpation.push(finding.trim());
        });
    }

    // F. Neurovascular (Screening)
    if (exam.neuroVascularConfig) {
        const nv = exam.neuroVascularConfig;
        let hasRelevantNeuro = false;
        const neuroMap = [
            { key: 'miotomas', label: 'Miotomas' },
            { key: 'sensibilidad', label: 'Sensibilidad/Dermatomas' },
            { key: 'reflejos', label: 'Reflejos' },
            { key: 'neurodinamia', label: 'Neurodinamia (SLR/Slump/ULTT)' },
            { key: 'pulsos', label: 'Perfusión/Pulsos' },
            { key: 'equilibrio', label: 'Equilibrio/Propiocepción' }
        ];

        neuroMap.forEach(item => {
            if (nv[item.key]?.evalua) {
                const hallazgo = nv[item.key]?.hallazgo || '';
                // Consideramos normal o screening limpio si dice "Normal", "Sin alteraciones", o está vacío.
                if (hallazgo && !hallazgo.toLowerCase().includes('normal') && !hallazgo.toLowerCase().includes('sin alter')) {
                    hasRelevantNeuro = true;
                    pSyn.neurovascular_sensorimotor.push(`${item.label}: ${hallazgo}`);
                }
            }
        });

        if (nv.observacion?.trim()) {
            hasRelevantNeuro = true;
            pSyn.neurovascular_sensorimotor.push(`Obs Neuro: ${nv.observacion.trim()}`);
        }

        if (!hasRelevantNeuro && Object.values(nv).some((v: any) => v?.evalua)) {
            pSyn.neurovascular_sensorimotor.push('Screening neurológico/vascular sin hallazgos relevantes registrados.');
        }
    }

    // G. Control Motor
    if (exam.controlMotorConfig?.filas?.length) {
        exam.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.region) return;
            // Region aqui es la Tarea Funcional evaluada
            let finding = `${f.region}: ${f.calidadEjecucion || ''}`;
            if (f.compensaciones) finding += ` | Compensación: ${f.compensaciones}`;
            if (f.observacion?.trim()) finding += ` | Obs: ${f.observacion.trim()}`;
            pSyn.motor_control.push(finding.trim());
        });
    }

    // H. Ortopédicas Dirigidas
    if (exam.ortopedicasConfig?.filas?.length) {
        const groupedByRegion: Record<string, string[]> = {};

        exam.ortopedicasConfig.filas.forEach((f: any) => {
            const tName = f.test_name || f.test;
            if (!tName) return;

            const regionName = f.region || 'Global';
            if (!groupedByRegion[regionName]) groupedByRegion[regionName] = [];

            const hipotesis = f.hipotesis || 'Sin hipótesis';
            let findingLine = `[${hipotesis}] ${tName} (${f.side || f.lado || 'N/A'}): ${f.result || f.resultado || '-'}`;

            const reproduce = f.symptom_relation || f.reproduceTexto;
            if (reproduce) {
                findingLine += ` -> Síntoma índice: ${reproduce}`;
                const isPositive = f.result?.toLowerCase() === 'positivo' || f.resultado?.toLowerCase() === 'positivo';
                if (isPositive || reproduce.toLowerCase().includes('reproduce') || reproduce.toLowerCase().includes('exact')) {
                    structuralCandidates.push({
                        label: `Posible implicación mecánica explorada en ${tName} (${hipotesis}) - Región: ${regionName}`,
                        confidence: 'Media', reproduceSymptom: true, source: 'Pruebas Ortopédicas P2'
                    });
                }
            }
            if (f.optional_reason) findingLine += ` [Motivo: ${f.optional_reason}]`;

            const comment = f.comment || f.comentario;
            if (comment?.trim()) findingLine += ` | ${comment.trim()}`;

            groupedByRegion[regionName].push(findingLine);
        });

        Object.entries(groupedByRegion).forEach(([region, strings]) => {
            pSyn.orthopedic_tests.push(`Región ${region.toUpperCase()}:`);
            strings.forEach(s => pSyn.orthopedic_tests.push(`  - ${s}`));
        });

        if (exam.ortopedicasConfig.sintesisFinal?.trim()) {
            pSyn.orthopedic_tests.push(`Lectura clínica: ${exam.ortopedicasConfig.sintesisFinal.trim()}`);
        }
    }

    // I. Funcionales / Capacidad
    if (exam.funcionalesConfig?.filas?.length) {
        exam.funcionalesConfig.filas.forEach((f: any) => {
            if (!f.test) return;
            let finding = `${f.test} (${f.lado}):`;
            if (f.metricaObj?.trim()) finding += ` ${f.metricaObj}`;
            else if (f.resultado?.trim()) finding += ` Res: ${f.resultado}`;

            if (f.dolor) finding += ` | Dolor: ${f.dolor}/10`;
            if (f.calidad) finding += ` | Calidad: ${f.calidad}`;
            pSyn.functional_tests.push(finding.trim());
        });
        if (exam.funcionalesConfig.objetivo?.trim()) {
            pSyn.functional_tests.unshift(`Objetivo de bloque: ${exam.funcionalesConfig.objetivo.trim()}`);
        }
    }

    // J. Retest / Comparable
    if (exam.retestConfig && exam.retestConfig.tareaIndice) {
        let finding = `Signo Re-test: ${exam.retestConfig.tareaIndice} -> RESULTADO POST: ${exam.retestConfig.resultadoPost || 'No evaluado'}`;
        if (exam.retestConfig.intervencion?.trim()) finding += ` (Modificador: ${exam.retestConfig.intervencion.trim()})`;
        if (exam.retestConfig.comentario?.trim()) finding += `. Cambio observado: ${exam.retestConfig.comentario.trim()}`;
        pSyn.retest.push(finding);
    }

    // K. Medidas Complementarias (Solo si hay datos reales)
    if (exam.medidasComplementariasConfig) {
        const mc = exam.medidasComplementariasConfig;
        if (mc.peso || mc.talla || mc.otraMedida) {
            let f = [];
            if (mc.peso) f.push(`Peso: ${mc.peso}kg`);
            if (mc.talla) f.push(`Talla: ${mc.talla}cm`);
            if (mc.imc) f.push(`IMC: ${mc.imc}`);
            if (mc.otraMedida?.trim()) f.push(`Otra medida: ${mc.otraMedida.trim()}`);
            pSyn.complementary_measures.push(f.join(' | '));
        }
        if (mc.signosVitalesActivos && (mc.pa || mc.fc || mc.satO2 || mc.perimetroEdema || mc.fovea !== null)) {
            let s = [];
            if (mc.pa) s.push(`PA: ${mc.pa}`);
            if (mc.fc) s.push(`FC: ${mc.fc}lpm`);
            if (mc.satO2) s.push(`SatO2: ${mc.satO2}%`);
            if (mc.perimetroEdema?.trim()) s.push(`Edema: ${mc.perimetroEdema.trim()}`);
            if (mc.fovea !== null) s.push(`Fóvea: ${mc.fovea ? 'Positiva' : 'Negativa'}`);
            pSyn.complementary_measures.push(`Vitales: ` + s.join(' | '));
        }
    }

    // TEXTOS DE SALIDA DETERMINÍSTICOS
    const domainsWithFindings = [];
    if (pSyn.mobility.length) domainsWithFindings.push('movilidad articular');
    if (pSyn.strength_load.length) domainsWithFindings.push('fuerza y carga');
    if (pSyn.orthopedic_tests.length) domainsWithFindings.push('pruebas ortopédicas');
    if (pSyn.neurovascular_sensorimotor.some(s => !s.includes('sin hallazgos'))) domainsWithFindings.push('screening neurosensorial');
    if (pSyn.functional_tests.length) domainsWithFindings.push('función objetiva');
    if (pSyn.retest.length) domainsWithFindings.push('re-evaluación intrasesión');

    const domainListStr = domainsWithFindings.length > 0 ? `Hallazgos objetivos localizados en: ${domainsWithFindings.join(', ')}.` : 'Examen físico sin dominios objetivos estructurados.';

    // Texto Corto
    pSyn.summary_text_short = `Paciente con cuadro de irritabilidad ${pSyn.frame.irritabilidad || 'Pendiente'}. 
    Tarea Índice a re-evaluar: ${pSyn.frame.tarea_indice || 'No definida claramente'}. 
    ${domainListStr}
    ${pSyn.retest.length ? 'Respuesta a intervención de prueba: ' + pSyn.retest[0] : ''}
    Síntesis física registrada correctamente para P3.`.replace(/\n\s+/g, '\n').trim();

    // Texto Estructurado Completo (Para P3)
    const structuredChunks = [];
    if (pSyn.frame.tarea_indice) structuredChunks.push(`[MARCO CLÍNICO]\nFoco: ${pSyn.frame.foco || '-'} | Irritabilidad: ${pSyn.frame.irritabilidad}\nTarea Índice: ${pSyn.frame.tarea_indice}`);
    if (pSyn.observation.length) structuredChunks.push(`[OBSERVACIÓN]\n` + pSyn.observation.map(o => `• ${o}`).join('\n'));
    if (pSyn.mobility.length) structuredChunks.push(`[MOVILIDAD (ROM)]\n` + pSyn.mobility.map(o => `• ${o}`).join('\n'));
    if (pSyn.strength_load.length) structuredChunks.push(`[FUERZA Y CARGA]\n` + pSyn.strength_load.map(o => `• ${o}`).join('\n'));
    if (pSyn.palpation.length) structuredChunks.push(`[PALPACIÓN]\n` + pSyn.palpation.map(o => `• ${o}`).join('\n'));
    if (pSyn.neurovascular_sensorimotor.length) structuredChunks.push(`[NEURO/SENSORIAL]\n` + pSyn.neurovascular_sensorimotor.map(o => `• ${o}`).join('\n'));
    if (pSyn.motor_control.length) structuredChunks.push(`[CONTROL MOTOR]\n` + pSyn.motor_control.map(o => `• ${o}`).join('\n'));
    if (pSyn.orthopedic_tests.length) structuredChunks.push(`[PRUEBAS ORTOPÉDICAS]\n` + pSyn.orthopedic_tests.map(o => (o.startsWith('-') || o.startsWith('[') || o.startsWith(' ') || o.startsWith('Región') || o.startsWith('Lectura')) ? o : `• ${o}`).join('\n'));
    if (pSyn.functional_tests.length) structuredChunks.push(`[PRUEBAS FUNCIONALES]\n` + pSyn.functional_tests.map(o => o.startsWith('Objeti') ? o : `• ${o}`).join('\n'));
    if (pSyn.complementary_measures.length) structuredChunks.push(`[COMPLEMENTARIOS]\n` + pSyn.complementary_measures.map(o => `• ${o}`).join('\n'));
    if (pSyn.retest.length) structuredChunks.push(`[RE-TEST INTRA-SESIÓN]\n` + pSyn.retest.map(o => `• ${o}`).join('\n'));

    pSyn.summary_text_structured = structuredChunks.join('\n\n');

    return { structuralCandidates, functionalDeficits, bpsNotes, physicalSynthesis: pSyn };
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
