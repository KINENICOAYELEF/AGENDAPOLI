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
    console.log("=== [DEBUG] autoSynthesizeFindings INIT ===");
    console.log("Exam Keys provided:", exam ? Object.keys(exam) : "null");
    console.log("Exam Data:", JSON.stringify(exam, null, 2));

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

    if (interview) {
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
                pSyn.frame.tarea_indice = `${primaryComparableName}${comparablePain && comparablePain !== '-' ? ` (${comparablePain}/10)` : ''}`;
                functionalDeficits.push({
                    label: primaryComparableName,
                    baseline: `Dolor EVA ${comparablePain}/10 bajo condiciones declaradas`,
                    side: primary.lado || primary.side || 'N/A',
                    linkedPsfs: true
                });
            }
        }
    }

    if (!exam) return { structuralCandidates, functionalDeficits, bpsNotes, physicalSynthesis: pSyn };

    // Fallbacks si no hubo P1 o la Tarea Índice no se configuró en P1 pero sí en P2
    if (!pSyn.frame.tarea_indice) {
        const p2Task = exam.retestGesture || exam.contextoConfig?.reTestTask || exam.retestConfig?.tareaIndice;
        if (p2Task) {
            pSyn.frame.tarea_indice = p2Task;
            functionalDeficits.push({
                label: p2Task,
                baseline: 'Base registrada en Evaluación (P2)',
                side: pSyn.frame.lado || 'N/A',
                linkedPsfs: false
            });
        }
    }

    if (exam.examModality) {
        pSyn.observation.push(`Modalidad Evaluación: ${exam.examModality}`);
    }

    // Si aún no tenemos foco, inferirlo rudimentariamente de Pruebas Ortopédicas, ROM, o Fuerza
    if (!pSyn.frame.foco) {
        if (exam.ortopedicasConfig?.filas?.[0]?.region) {
            pSyn.frame.foco = exam.ortopedicasConfig.filas[0].region;
        } else if (exam.romAnaliticoConfig?.filas?.[0]?.region) {
            pSyn.frame.foco = exam.romAnaliticoConfig.filas[0].region;
        } else if (exam.fuerzaCargaConfig?.filas?.[0]?.region) {
            pSyn.frame.foco = exam.fuerzaCargaConfig.filas[0].region;
        }
    }

    // B. Observación
    const obsChips = exam.observacionInicialConfig || {};
    let obsText = "";

    if (exam.observationGeneral?.trim()) obsText += `${exam.observationGeneral.trim()}. `;
    if (obsChips.posturaChips?.length) obsText += `Se observa destacablemente: ${obsChips.posturaChips.join(', ').toLowerCase()}. `;
    if (exam.postureAlignment?.trim()) obsText += `En alineación: ${exam.postureAlignment.trim()}. `;

    if (exam.gaitBasicGesture?.trim()) obsText += `Marcha: ${exam.gaitBasicGesture.trim()}. `;
    if (obsChips.marchaChips?.length) obsText += `Características de la marcha: ${obsChips.marchaChips.join(', ').toLowerCase()}. `;

    if (exam.movimientoObservadoHoy?.trim()) {
        obsText += `Durante ${exam.movimientoObservadoHoy.trim()} `;
        if (exam.initialActiveMovement?.trim()) obsText += `se aprecia ${exam.initialActiveMovement.trim().toLowerCase()}. `;
        else obsText += `se evalúa el gesto. `;
    } else if (exam.initialActiveMovement?.trim()) {
        obsText += `Movimiento inicial activo muestra ${exam.initialActiveMovement.trim().toLowerCase()}. `;
    }

    if (obsChips.movVisualChips?.length) obsText += `Visualmente destaca: ${obsChips.movVisualChips.join(', ').toLowerCase()}. `;

    if (exam.symptomBehaviorMovement?.trim()) obsText += `El síntoma se comporta: ${exam.symptomBehaviorMovement.trim().toLowerCase()}. `;
    if (obsChips.conductaSintomaChips?.length) obsText += `Conducta frente al síntoma: ${obsChips.conductaSintomaChips.join(', ').toLowerCase()}. `;

    // Fallback al antiguo observacionConfig
    if (exam.observacionConfig) {
        const { general, postura, marcha, movimiento, conducta } = exam.observacionConfig;
        if (general?.trim() && !obsText.includes(general.trim())) obsText += `${general.trim()}. `;
        if (postura?.trim() && !obsText.includes(postura.trim())) obsText += `Postura: ${postura.trim()}. `;
        if (marcha?.trim() && !obsText.includes(marcha.trim())) obsText += `Marcha: ${marcha.trim()}. `;
        if (movimiento?.trim() && !obsText.includes(movimiento.trim())) obsText += `Movimiento: ${movimiento.trim()}. `;
        if (conducta?.trim() && !obsText.includes(conducta.trim())) obsText += `Conducta: ${conducta.trim()}. `;
    }

    if (obsText.trim()) pSyn.observation.push(obsText.trim());

    // C. Movilidad (ROM)
    if (exam.romAnaliticoConfig?.filas?.length) {
        exam.romAnaliticoConfig.filas.forEach((f: any) => {
            if (!f.region && !f.movimiento) return;
            const region = f.region?.trim() || '';
            const mov = f.movimiento?.trim() || '';
            const type = f.tipoEval || 'unilateral';

            let line = '';

            if (type === 'bilateral') {
                const derA = f.resActDer || f.actDer; const derP = f.resPasDer || f.pasDer;
                const izqA = f.resActIzq || f.actIzq; const izqP = f.resPasIzq || f.pasIzq;
                if (!derA && !derP && !izqA && !izqP) return;

                line = `En ${region} ${mov} bilateral: `;
                const rDer = [];
                if (derA) rDer.push(`activo ${derA.toLowerCase()}`);
                if (derP) rDer.push(`pasivo ${derP.toLowerCase()}`);
                const rIzq = [];
                if (izqA) rIzq.push(`activo ${izqA.toLowerCase()}`);
                if (izqP) rIzq.push(`pasivo ${izqP.toLowerCase()}`);

                if (rDer.length) line += `derecha presenta movimiento ${rDer.join(' y ')}`;
                if (rDer.length && rIzq.length) line += ', mientras que ';
                if (rIzq.length) line += `izquierda presenta movimiento ${rIzq.join(' y ')}`;
                
                if (f.asimetriaObservada?.trim() && f.asimetriaObservada !== '-') line += `. Se observa asimetría funcional (${f.asimetriaObservada})`;
            } else {
                // unilateral o axial
                const sideText = (type === 'axial' || !f.ladoUnilateral || f.ladoUnilateral === '-') ? '' : ` ${f.ladoUnilateral.toLowerCase()}`;
                const act = f.resAct && f.resAct !== '-' ? f.resAct : null; 
                const pas = f.resPas && f.resPas !== '-' ? f.resPas : null;
                if (!act && !pas && !f.grados && !f.calidadMovimiento) return; // Vacio total

                line = `${region} ${mov}${sideText}`;

                if (act && pas) {
                    if (act === pas) line += ` presenta movimiento activo y pasivo ${act.toLowerCase()}`;
                    else line += ` con activo ${act.toLowerCase()} y pasivo ${pas.toLowerCase()}`;
                } else if (act) {
                    line += ` activo ${act.toLowerCase()}`;
                } else if (pas) {
                    line += ` pasivo ${pas.toLowerCase()}`;
                } else {
                    line += ` evaluado`;
                }

                if (f.usaGoniometro && f.grados) line += ` logrando ${f.grados}º`;
            }

            const dolorPaths = [];
            if (f.dolorActivo) dolorPaths.push('al movimiento activo');
            if (f.dolorPasivo) dolorPaths.push('al pasivo');
            if (dolorPaths.length) line += `. Es doloroso ${dolorPaths.join(' y ')}`;

            if (f.calidadMovimiento?.trim()) line += `. Calidad del movimiento: ${f.calidadMovimiento}`;

            if (line) {
                line = line.replace(/  +/g, ' ').trim() + '.';
                pSyn.mobility.push(line);
            }

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
            const ladoText = (f.lado && f.lado !== '-') ? ` ${f.lado.toLowerCase()}` : '';
            const evalType = f.tipoEvaluacion || 'Carga';
            let line = `Al evaluar ${evalType.toLowerCase()} en ${f.region}${ladoText}, `;

            if (evalType.includes('Dinamometría')) {
                if (f.dinamometriaDer || f.dinamometriaIzq) {
                    const dDer = f.dinamometriaDer ? `derecha alcanza ${f.dinamometriaDer}${f.dinamometriaUnidad || 'kg'}` : '';
                    const dIzq = f.dinamometriaIzq ? `izquierda alcanza ${f.dinamometriaIzq}${f.dinamometriaUnidad || 'kg'}` : '';
                    line += `la ${[dDer, dIzq].filter(Boolean).join(' y la ')}`;
                    if (f.diferenciaCalculada || f.asimetriaDina) line += `, evidenciando un déficit del ${f.diferenciaCalculada || f.asimetriaDina}%`;
                } else return;
            } else if (evalType === 'Ejercicios con Carga (Encoder)' || f.cargaKg) {
                if (!f.cargaKg) return;
                line += `mueve ${f.cargaKg}Kg`;
                if (f.velocidadEncoder) line += ` a una velocidad de ${f.velocidadEncoder}m/s`;
            } else if (evalType === 'Test Resistencia / Capacidad') {
                if (!f.repeticionesN) return;
                line += `logra ${f.repeticionesN} repeticiones`;
                if (f.repeticionesCorte) line += ` (test finalizado por ${f.repeticionesCorte})`;
            } else if (evalType === 'Isometría Sostenida (Tiempo)') {
                if (!f.isometriaSegundos) return;
                line += `sostiene ${f.isometriaSegundos} segundos`;
                if (f.isometriaMotivo) line += ` cortando por ${f.isometriaMotivo}`;
            } else if (evalType === 'Fuerza Muscular Manual (Maddox/Daniel\'s)') {
                if (!f.resultado || f.resultado === '-') return;
                line += `se califica con un ${f.resultado}`;
            } else if (f.resultado) {
                line += `resulta en ${f.resultado}`;
            } else if (f.calidadEsfuerzo) {
                line += `esfuerzo calificado como ${f.calidadEsfuerzo.toLowerCase()}`;
            } else {
                return; // vacio
            }

            if (f.clasificacionAutomatica) line += `, catalogado como nivel ${f.clasificacionAutomatica}`;

            const dolores = [];
            if (f.dolorDurante) dolores.push(`durante la prueba (${f.dolorDurante})`);
            if (f.dolorPosterior) dolores.push(`y posterior a la prueba (${f.dolorPosterior})`);
            if (dolores.length) line += `. Se reporta dolor ${dolores.join(' ')}`;

            if (f.calidadEsfuerzo && !line.includes(f.calidadEsfuerzo.toLowerCase())) line += `. Calidad del esfuerzo general: ${f.calidadEsfuerzo.toLowerCase()}`;
            if (f.observacionExtra?.trim()) line += `. ${f.observacionExtra.trim()}`;

            line = line.replace(/  +/g, ' ').trim();
            if(!line.endsWith('.')) line += '.';
            pSyn.strength_load.push(line);
        });
    }

    // E. Palpación
    const palpItems = exam.palpacionConfig?.filas || exam.palpacionConfig?.estructuras;
    if (palpItems?.length) {
        palpItems.forEach((e: any) => {
            if (!e.estructura && !e.nombre) return;
            const est = e.estructura || e.nombre;
            if (est === '-' || !est.trim()) return;
            
            const ladoText = (e.lado && e.lado !== '-' && e.lado.toLowerCase() !== 'n/a' && e.lado.toLowerCase() !== 'side') ? ` ${e.lado.toLowerCase()}` : '';

            let line = `A la palpación de ${est}${ladoText}`;
            const hallazgo = e.hallazgoPrincipal?.trim() && e.hallazgoPrincipal !== '-' ? `se aprecia ${e.hallazgoPrincipal.toLowerCase()}` : '';

            const dolorVal = e.dolor || e.dolorCalificacion;
            let dolorStr = '';
            if (dolorVal === 'Exquisito' || e.dolor === 'Exquisito') dolorStr = 'dolor exquisito';
            else if (dolorVal && dolorVal !== '-' && dolorVal.toLowerCase() !== 'sin dolor') dolorStr = `dolor (${dolorVal})`;
            else if (dolorVal?.toLowerCase() === 'sin dolor') dolorStr = 'sin dolor';

            const temp = e.temperatura && e.temperatura !== 'Normal' && e.temperatura !== '-' ? `temperatura ${e.temperatura.toLowerCase()}` : '';
            const edema = (e.edema === 'Presente' || e.edema === true) ? 'edema focal' : '';

            const signs = [hallazgo, dolorStr, temp, edema].filter(Boolean);
            
            if (signs.length === 0) {
                // Solo si solo hay observacion
                if (e.observacion?.trim()) line += `, ${e.observacion.trim()}.`;
                else return; // Vacio total
            } else {
                line += ` ${signs.join(', ')}.`;
                if (e.observacion?.trim()) line += ` ${e.observacion.trim()}`;
            }

            pSyn.palpation.push(line.trim());
        });
    }
    if (exam.palpacionConfig?.movilidadAccesoria?.trim()) {
        pSyn.palpation.push(`En cuanto a la movilidad accesoria articular: ${exam.palpacionConfig.movilidadAccesoria.trim()}`);
    }

    // F. Neurovascular (Screening)
    if (exam.neuroVascularConfig) {
        const nv = exam.neuroVascularConfig;
        let hasRelevantNeuro = false;

        if (nv.screening && nv.screening !== 'no_evaluado') {
            hasRelevantNeuro = true;
            pSyn.neurovascular_sensorimotor.push(`Screening Global: ${nv.screening}`);
            if (nv.screeningComentario?.trim()) pSyn.neurovascular_sensorimotor.push(`Nota: ${nv.screeningComentario.trim()}`);
        }

        const neuroMap = [
            { key: 'miotomas', label: 'Miotomas' },
            { key: 'sensibilidad', label: 'Sensibilidad/Dermatomas' },
            { key: 'rot', label: 'Reflejos' },
            { key: 'reflejos', label: 'Reflejos (Legado)' },
            { key: 'neurodinamia', label: 'Neurodinamia (SLR/Slump/ULTT)' },
            { key: 'pulsos', label: 'Perfusión/Pulsos' },
            { key: 'propiocepcion', label: 'Propiocepción' },
            { key: 'coordinacion', label: 'Coordinación' },
            { key: 'equilibrio', label: 'Equilibrio (Legado)' },
            { key: 'especifico', label: 'Test Específico' }
        ];

        // Usamos el objeto "dominios" si existe, o caemos al nivel raíz
        const src = nv.dominios || nv;

        neuroMap.forEach(item => {
            const domainData = src[item.key];
            if (domainData && (domainData.evalua || domainData.resultado)) {
                const hallazgo = domainData.detalle || domainData.hallazgo || '';
                const resultado = domainData.resultado || (domainData.evalua ? 'Evaluado' : '');

                // Consideramos normal o screening limpio si dice "Normal", "Sin alteraciones", o está vacío y el resultado también es Normal.
                const isNormalResultado = resultado.toLowerCase().includes('normal') || resultado.toLowerCase().includes('sin alter');
                const isNormalHallazgo = !hallazgo || hallazgo.toLowerCase().includes('normal') || hallazgo.toLowerCase().includes('sin alter');

                if (!isNormalResultado || !isNormalHallazgo) {
                    hasRelevantNeuro = true;
                    let line = `${item.label}: ${resultado}`;
                    if (hallazgo) line += ` - ${hallazgo}`;
                    pSyn.neurovascular_sensorimotor.push(line);
                }
            }
        });

        if (nv.observacion?.trim()) {
            hasRelevantNeuro = true;
            pSyn.neurovascular_sensorimotor.push(`Obs Neuro: ${nv.observacion.trim()}`);
        }

        if (!hasRelevantNeuro && ((nv.screening === 'limpio' || nv.screening === 'Normal') || Object.values(src).some((v: any) => v?.evalua || v?.resultado === 'Normal'))) {
            pSyn.neurovascular_sensorimotor.push('Screening neurológico/vascular realizado sin hallazgos patológicos o relevantes.');
        }
    }

    // G. Control Motor
    if (exam.controlMotorConfig?.filas?.length) {
        exam.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.regionTarea) return;
            // Region aqui es la Tarea Funcional evaluada
            let finding = `${f.regionTarea} [${f.tipoTarea || 'Test'}]: ${f.calidad || f.calidadEjecucion || ''}`;
            if (f.sintoma) finding += ` | Provocación: ${f.sintoma}`;
            if (f.compensacion || f.compensaciones) finding += ` | Compensación: ${f.compensacion || f.compensaciones}`;
            if (f.observacion?.trim()) finding += ` | Obs: ${f.observacion.trim()}`;
            pSyn.motor_control.push(finding.trim());
        });
    }

    // H. Ortopédicas Dirigidas
    if (exam.ortopedicasConfig?.filas?.length || (exam.ortopedicasConfig && Object.keys(exam.ortopedicasConfig).length > 0 && !exam.ortopedicasConfig.filas)) {
        const filasOrto = exam.ortopedicasConfig.filas || [];
        const groupedByRegion: Record<string, string[]> = {};

        filasOrto.forEach((f: any) => {
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

        if (exam.ortopedicasConfig?.sintesisFinal?.trim()) {
            pSyn.orthopedic_tests.push(`Lectura clínica: ${exam.ortopedicasConfig.sintesisFinal.trim()}`);
        }
    }

    // I. Funcionales / Capacidad
    if (exam.funcionalesConfig?.filas?.length) {
        if (exam.funcionalesConfig.objetivo?.trim()) {
            pSyn.functional_tests.push(`Objetivo de bloque: ${exam.funcionalesConfig.objetivo.trim()}`);
        }
        exam.funcionalesConfig.filas.forEach((f: any) => {
            if (!f.test) return;
            let finding = `${f.test} (${f.lado || 'Bilateral'}):`;

            if (f.resultado?.trim()) {
                finding += ` Res: ${f.resultado}`;
                if (f.tipoMetrica) finding += ` ${f.tipoMetrica}`;
            } else if (f.metricaObj?.trim()) {
                finding += ` ${f.metricaObj}`;
            }

            if (f.dolor) finding += ` | Dolor: ${f.dolor}/10`;
            if (f.calidad) finding += ` | Calidad: ${f.calidad}`;
            if (f.criterioFuncional) finding += ` | Criterio: ${f.criterioFuncional}`;
            if (f.observacion?.trim()) finding += ` | Obs: ${f.observacion.trim()}`;

            pSyn.functional_tests.push(finding.trim());
        });
    }

    // J. Retest / Comparable
    if (exam.retestConfig && (exam.retestConfig.tareaIndice || exam.retestConfig.intervencion || exam.retestConfig.comentario || exam.retestConfig.resultadoPost)) {
        const tarea = exam.retestConfig.tareaIndice || pSyn.frame.tarea_indice || exam.retestGesture || 'la tarea índice';
        let line = `En el re-test de ${tarea}`;
        
        if (exam.retestConfig.intervencion?.trim()) line += ` tras prueba de modificación (${exam.retestConfig.intervencion.trim()}), `;
        else line += `, `;

        if (exam.retestConfig.resultadoPost && exam.retestConfig.resultadoPost !== '-') {
            line += `el síntoma resulta ${exam.retestConfig.resultadoPost.toLowerCase()}`;
        } else {
            line += `se evalúa el cambio sintomático`;
        }

        if (exam.retestConfig.comentario?.trim()) line += `. Clínicamente: ${exam.retestConfig.comentario.trim()}`;
        
        if (!line.endsWith('.')) line += '.';
        pSyn.retest.push(line);
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
    if (pSyn.neurovascular_sensorimotor.some(s => !s.toLowerCase().includes('sin hallazgos'))) domainsWithFindings.push('screening neurosensorial');
    if (pSyn.functional_tests.length) domainsWithFindings.push('función objetiva');
    
    // Texto Corto (Narrativo Breve)
    const narrativa = [];
    if (pSyn.frame.irritabilidad && pSyn.frame.irritabilidad !== 'Desconocida') {
        narrativa.push(`Paciente cursando cuadro de irritabilidad ${pSyn.frame.irritabilidad.toLowerCase()}`);
    } else {
         narrativa.push(`Paciente en evaluación clínica`);
    }

    if (pSyn.frame.tarea_indice) narrativa.push(`cuya tarea índice principal es ${pSyn.frame.tarea_indice}`);
    
    let narrativaIntro = narrativa.join(', ') + '.';
    const obsExtract = pSyn.observation.length > 0 ? pSyn.observation[0] : '';
    if (obsExtract) narrativaIntro += ` En la observación clínica general: ${obsExtract}`;
    
    const domainListStr = domainsWithFindings.length > 0 ? `A la evaluación analítica se rescatan hallazgos relevantes en los dominios de ${domainsWithFindings.join(', ')}.` : '';
    
    let retestSummary = '';
    if (pSyn.retest.length) {
        retestSummary = pSyn.retest[0];
    }

    pSyn.summary_text_short = [narrativaIntro, domainListStr, retestSummary].filter(Boolean).join(' ');

    // Texto Estructurado Completo (Para P3)
    const structuredChunks = [];
    if (pSyn.frame.foco || pSyn.frame.irritabilidad || pSyn.frame.tarea_indice) {
        let frameText = `Marco Clínico`;
        const lines = [];
        if (pSyn.frame.foco) lines.push(`Foco principal: ${pSyn.frame.foco}`);
        if (pSyn.frame.irritabilidad && pSyn.frame.irritabilidad !== 'Desconocida') lines.push(`Irritabilidad: ${pSyn.frame.irritabilidad}`);
        if (pSyn.frame.tarea_indice) lines.push(`Tarea a re-evaluar: ${pSyn.frame.tarea_indice}`);
        if(lines.length) structuredChunks.push(`${frameText}\n` + lines.map(o => `• ${o}`).join('\n'));
    }

    if (pSyn.observation.length) structuredChunks.push(`Observación\n` + pSyn.observation.map(o => `• ${o}`).join('\n'));
    if (pSyn.mobility.length) structuredChunks.push(`Movilidad\n` + pSyn.mobility.map(o => `• ${o}`).join('\n'));
    if (pSyn.strength_load.length) structuredChunks.push(`Fuerza y Carga\n` + pSyn.strength_load.map(o => `• ${o}`).join('\n'));
    if (pSyn.palpation.length) structuredChunks.push(`Palpación\n` + pSyn.palpation.map(o => `• ${o}`).join('\n'));
    if (pSyn.neurovascular_sensorimotor.length) structuredChunks.push(`Neurología y Sensoriomotor\n` + pSyn.neurovascular_sensorimotor.map(o => `• ${o}`).join('\n'));
    if (pSyn.motor_control.length) structuredChunks.push(`Control Motor\n` + pSyn.motor_control.map(o => `• ${o}`).join('\n'));
    if (pSyn.orthopedic_tests.length) structuredChunks.push(`Pruebas Ortopédicas\n` + pSyn.orthopedic_tests.map(o => (o.startsWith('-') || o.startsWith('[') || o.startsWith(' ') || o.startsWith('Región') || o.startsWith('Lectura')) ? o : `• ${o}`).join('\n'));
    if (pSyn.functional_tests.length) structuredChunks.push(`Pruebas Funcionales\n` + pSyn.functional_tests.map(o => o.startsWith('Objeti') ? o : `• ${o}`).join('\n'));
    if (pSyn.retest.length) structuredChunks.push(`Re-test Intrasesión\n` + pSyn.retest.map(o => `• ${o}`).join('\n'));
    if (pSyn.complementary_measures.length) structuredChunks.push(`Complementarios\n` + pSyn.complementary_measures.map(o => `• ${o}`).join('\n'));

    pSyn.summary_text_structured = structuredChunks.join('\n\n');

    console.log("=== [DEBUG] autoSynthesizeFindings OUTPUT ===");
    console.log("Physical Synthesis Generated:", JSON.stringify(pSyn, null, 2));

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
