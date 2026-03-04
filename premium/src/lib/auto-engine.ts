import { EvaluacionInicial, KineFocusArea, KineAutoOutputs } from "@/types/clinica";

// 1. Irritabilidad
export function computeIrritability(foco: KineFocusArea): { level: 'Baja' | 'Media' | 'Alta' | 'Desconocida', reasons: string[] } {
    if (!foco) return { level: 'Desconocida', reasons: ['Foco no definido'] };

    let score = 0;
    const reasons: string[] = [];

    const current = Number(foco.painCurrent) || 0;
    const worst = Number(foco.painWorst24h) || 0;
    const maxPain = Math.max(current, worst);

    if (maxPain >= 7) { score += 3; reasons.push(`Dolor severo reportado (>=7).`); }
    else if (maxPain >= 4) { score += 1; reasons.push(`Dolor moderado reportado.`); }

    if (foco.wakesAtNight || foco.pattern24h === 'Noche peor') {
        score += 2; reasons.push('Dolor nocturno interrumpe el sueño.');
    }

    if (foco.afterEffectFreq === 'Frecuente' || foco.settlingTime === '>24 h' || foco.settlingTime === '1–24 h') {
        score += 3; reasons.push('El síntoma tiene un after-effect prolongado (>1h) o muy frecuente.');
    } else if (foco.afterEffectFreq === 'A veces') {
        score += 1;
    }

    if (foco.provocationEase === 'Alta') {
        score += 2; reasons.push('Poca carga o movimiento genera síntomas rápidamente (Alta facilidad de provocación).');
    }

    if (score >= 5) return { level: 'Alta', reasons };
    if (score >= 2) return { level: 'Media', reasons };
    return { level: 'Baja', reasons: ['Componentes de dolor y provocación estables, recuperación rápida tisular.'] };
}

// 2. Seguridad (Triage)
export function computeSafety(interview: EvaluacionInicial['interview']): { level: 'Verde' | 'Amarillo' | 'Rojo', reasons: string[], checklist: string[] } {
    const reasons: string[] = [];
    const checklist: string[] = [];
    let isRed = false;
    let isYellow = false;

    if (!interview) return { level: 'Verde', reasons: [], checklist: [] };

    if (interview.redFlagsSystemic || interview.redFlagsWeightLoss || interview.redFlagsNightPain) {
        isRed = true;
        reasons.push('ALERTA MÁSICA: Síntomas sistémicos, historia de cáncer o dolor nocturno implacable no mecánico.');
        checklist.push('Derivar a urgencias o evaluación médica a la brevedad. No iniciar terapia activa sin clearance.');
    }

    if (interview.redFlagsTraumaHigh || interview.redFlagsFractureParams) {
        isRed = true;
        reasons.push('Trauma de alta energía o presunción de fractura (incapacidad de carga grave).');
        checklist.push('Aplicar reglas de decisión clínica para fracturas (ej. Ottawa) o derivar a imagenología.');
    }

    if (interview.redFlagsNeuroSevere) {
        isRed = true;
        reasons.push('Síntomas neurológicos graves, progresivos o signos de alarma espinal (ej. síndrome cauda equina, mielopatía).');
        checklist.push('Examen neurológico ultra estricto (miotomas, dermatomas, reflejos, upper motor neuron tests). Derivación médica contingente.');
    }

    if (interview.redFlagsDvtTep) {
        isRed = true;
        reasons.push('Sospecha de Trombosis Venosa Profunda (ej. Hinchazón pantorrilla, calor, dolor) o TEP.');
        checklist.push('Aplicar criterios de Wells. Derivar a urgencia si es positivo.');
    }

    if (interview.orangeFlagPersonalRisk) {
        isYellow = true;
        reasons.push('Bandera Naranja o Riesgo Personal identificado. Requiere cautela e investigación.');
        checklist.push('Investigar contexto biopsicosocial severo o trastorno mental acompañante que frene el pronóstico.');
    }

    // Regla aguda Trauma
    const tieneTraumaAgudo = (interview.focos || []).some(f =>
        f.onsetType === 'Súbito' &&
        f.suddenSound === 'Chasquido' &&
        f.suddenImmediateCapacity === 'Incapaz' &&
        f.suddenSwellingVisible === 'Sí'
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
export function computePainMechanism(foco: KineFocusArea, interview: EvaluacionInicial['interview']): { category: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto' | 'Desconocido', label: string, reasons: string[] } {
    if (!foco) return { category: 'Desconocido', label: 'Sin Especificar', reasons: [] };

    let noci = 0;
    let neuro = 0;
    let nociPlastic = 0;
    const reasons: string[] = [];
    const nature = foco.symptomNature || [];

    // Neuropático
    if (nature.includes('Hormigueo') || nature.includes('Adormecimiento') || nature.includes('Corriente') || nature.includes('Quemazón')) {
        neuro += 3;
        reasons.push('Descriptores cardinales de neurodinamia (corriente, quemazón, hormigueo).');
    }
    if (foco.symptomRadiates === 'Sube-baja') { neuro += 2; reasons.push('El síntoma irradia en recorrido de trayecto nervioso aparentes.'); }

    // Nociplástico/Sensibilización
    if (nature.includes('Difuso') || nature.includes('Pesadez') || foco.symptomRadiates === 'Migratorio') {
        nociPlastic += 2;
        reasons.push('Patrón difuso o migratorio sugerente de sensibilización periférica/central.');
    }
    if (foco.onsetDuration === '3–6 meses' || foco.onsetDuration === '>6 meses') {
        nociPlastic += 2;
        reasons.push('Evolución crónica (>3 meses) amplifica el riesgo nociplástico.');
    }
    const sumYellow = interview?.yellowFlags ? Object.values(interview.yellowFlags).reduce((a, b) => Number(a) + Number(b), 0) : 0;
    if (sumYellow >= 6) {
        nociPlastic += 2;
        reasons.push('Alto cargo biopsicosocial asociado, gatillo común de sobre-representación central (Nociplastia).');
    }

    // Nociceptivo - Inflamatorio
    let isInflammatory = false;
    if (nature.includes('Pulsátil') || foco.pattern24h === 'Noche peor') {
        noci += 2;
        isInflammatory = true;
        reasons.push('Patrones pulsátiles y molestia nocturna sugieren perfil nociceptivo inflamatorio (químico).');
    }

    // Nociceptivo - Mecánico / Load Related
    let isMechanical = false;
    if (nature.includes('Punzante') || nature.includes('Tirantez') || nature.includes('Opresivo') || nature.includes('Inestabilidad') || nature.includes('Bloqueo')) {
        noci += 2;
        isMechanical = true;
        reasons.push('Descriptores mecánicos y asociación directa al test/movimiento.');
    }
    if (foco.provocationEase === 'Media' || foco.provocationEase === 'Baja') {
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

export function buildExamChecklist(interview: EvaluacionInicial['interview'], irritabilityLevel: 'Baja' | 'Media' | 'Alta' | 'Desconocida' = 'Baja'): KineAutoOutputs['examChecklistSelected'] {
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

    interview.focos?.forEach(f => {
        const nature = f.symptomNature || [];
        if (nature.includes('Inestabilidad') || nature.includes('Bloqueo')) {
            list.essentials.push({ title: 'Test de Estabilidad Articular / Integridad Capsuloligamentosa', rationale: `Reporte explícito de inestabilidad en ${f.region}`, lookFor: ['Laxitud', 'Aprehensión'] });
        }
        if (nature.includes('Hormigueo') || nature.includes('Adormecimiento') || nature.includes('Quemazón')) {
            list.essentials.push({ title: 'Examen Neurológico + Neurodinamia (Slump / SLR)', rationale: `Reportes neuropáticos en ${f.region}`, lookFor: ['Miotomas', 'Dermatomas', 'Mecanosensibilidad'] });
        }
        if (f.onsetType === 'Súbito') {
            list.recommended.push({ title: 'Palpación de alta especificidad', rationale: `Trauma en ${f.region}`, lookFor: ['Brechas tendíneas', 'Edema focal'] });
        }
    });

    return list;
}

export function computeBpsImpact(yellowFlags: any): { level: 'Bajo' | 'Medio' | 'Alto', tips: string[] } {
    if (!yellowFlags) return { level: 'Bajo', tips: ['Monitorear'] };
    const sum = Object.values(yellowFlags).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;

    if (sum >= 10) return { level: 'Alto', tips: ['Considerar el dolor como una experiencia compleja, validar el relato de la persona usuaria.', 'Evitar lenguaje biomédico catastrófico.', 'Priorizar educación sobre pacing y neurofisiología del dolor.'] };
    if (sum >= 5) return { level: 'Medio', tips: ['Aplicar manejo de carga empático, preguntar activamente sobre limitantes ocultas (sueño/estrés).'] };
    return { level: 'Bajo', tips: ['Paciente con buena disposición anímica/cognitiva, el cuadro apunta a resolución tisular clásica.'] };
}

export interface AutoSynthesisResult {
    structuralCandidates: { label: string; confidence: string; reproduceSymptom: boolean; source: string }[];
    functionalDeficits: { label: string; baseline: string; side: string; linkedPsfs: boolean }[];
    bpsNotes: { topBarriers: string[]; topFacilitators: string[] };
}

export function autoSynthesizeFindings(exam: any, interview: EvaluacionInicial['interview']): AutoSynthesisResult {
    const structuralCandidates: AutoSynthesisResult['structuralCandidates'] = [];
    const functionalDeficits: AutoSynthesisResult['functionalDeficits'] = [];
    const bpsNotes: AutoSynthesisResult['bpsNotes'] = { topBarriers: [], topFacilitators: [] };

    if (!interview) return { structuralCandidates, functionalDeficits, bpsNotes };

    // BPS
    const yellow = interview.yellowFlags || {} as any;
    if (yellow.sleepImpact > 0) bpsNotes.topBarriers.push('Alteración de Recuperación (Sueño)');
    if (yellow.kinesiophobia > 0 || yellow.highStress > 0) bpsNotes.topBarriers.push('Kinesiofobia / Sobrecarga Cognitiva');

    if (bpsNotes.topBarriers.length === 0) bpsNotes.topFacilitators.push('Paciente sin red-flags biopsicosociales aparentes (Buen pronóstico base).');

    interview.focos?.forEach((f: any) => {
        if (f.primaryComparable?.name) {
            functionalDeficits.push({
                label: f.primaryComparable.name,
                baseline: `Dolor EVA ${f.primaryComparable.painLevel}/10 bajo condiciones declaradas`,
                side: f.side || 'N/A',
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
