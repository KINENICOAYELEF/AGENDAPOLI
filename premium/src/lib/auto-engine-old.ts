import { EvaluacionInicial, KineFocusArea } from "@/types/clinica";

export interface IrritabilityResult {
    level: 'Baja' | 'Moderada' | 'Alta';
    reasons: string[];
    inputsUsed: Record<string, any>;
}

export function computeIrritability(interview: EvaluacionInicial['interview']): IrritabilityResult {
    let maxPain = 0;
    let worstSettleTime = 'Nunca';
    let worstAfterEffect = 'Nunca';
    const reasons: string[] = [];

    if (!interview || !interview.focos || interview.focos.length === 0) {
        return {
            level: 'Baja',
            reasons: ['No hay focos registrados para analizar dolor.'],
            inputsUsed: { maxPain: 0, worstAfterEffect: 'Nunca', worstSettleTime: 'Nunca' }
        };
    }

    interview.focos.forEach((f: any) => {
        const pCurrent = Number(f.painCurrent) || 0;
        const pWorst = Number(f.painWorst24h) || 0;
        const localMax = Math.max(pCurrent, pWorst);
        if (localMax > maxPain) maxPain = localMax;

        if (f.afterEffect === 'Siempre') worstAfterEffect = 'Siempre';
        else if (f.afterEffect === 'A veces' && worstAfterEffect !== 'Siempre') worstAfterEffect = 'A veces';

        if (f.settlingTime?.toLowerCase().includes('constante') || f.settlingTime?.toLowerCase().includes('hora')) worstSettleTime = 'Constante/Lento';
    });

    const inputsUsed = { maxPain, worstAfterEffect, worstSettleTime };

    if (maxPain >= 7 || worstAfterEffect === 'Siempre' || worstSettleTime === 'Constante/Lento') {
        if (maxPain >= 7) reasons.push(`Dolor intenso reportado (EVA >= 7).`);
        if (worstAfterEffect === 'Siempre') reasons.push(`Dolor o rigidez residual se mantiene permanentemente post-actividad.`);
        if (worstSettleTime === 'Constante/Lento') reasons.push(`El tiempo de recuperación tisular reportado es constante o muy lento.`);
        return { level: 'Alta', reasons, inputsUsed };
    }

    if (maxPain >= 4 || worstAfterEffect === 'A veces') {
        if (maxPain >= 4) reasons.push(`Dolor modeado reportado (EVA >= 4 y < 7).`);
        if (worstAfterEffect === 'A veces') reasons.push(`Existen recesos irregulares de dolor residual intermitente post-actividad.`);
        return { level: 'Moderada', reasons, inputsUsed };
    }

    reasons.push(`Niveles de dolor soportables y sin alteraciones crónicas graves de recuperación post-carga.`);
    return { level: 'Baja', reasons, inputsUsed };
}

export interface PainMechanismResult {
    dominant: 'Nociceptivo' | 'Neuropático' | 'Nociplástico' | 'Mixto';
    confidence: 'Baja' | 'Media' | 'Alta';
    reasons: string[];
}

export function suggestPainMechanism(interview: EvaluacionInicial['interview']): PainMechanismResult {
    if (!interview || !interview.focos || interview.focos.length === 0) {
        return { dominant: 'Nociceptivo', confidence: 'Baja', reasons: ['Sin focos reportados. Se asume mecánico por descarte temporal.'] };
    }

    let nociScore = 0;
    let neuroScore = 0;
    let nociPlasticoScore = 0;
    const reasons: string[] = [];

    interview.focos.forEach((f: any) => {
        const sym = f.dominantSymptoms || [];
        if (sym.includes('Intermitente') || sym.includes('Pinchazo') || sym.includes('Mecánico')) nociScore += 2;
        if (sym.includes('Hormigueo') || sym.includes('Adormecimiento') || sym.includes('Fulsurante') || sym.includes('Eléctrico') || sym.includes('Quemazón')) neuroScore += 3;
        if (sym.includes('Difuso') || sym.includes('Migratorio') || sym.includes('Constante') || sym.includes('Pesadez')) nociPlasticoScore += 2;

        // Multiplicador temporal
        if (f.onsetDuration?.toLowerCase().includes('año') || f.onsetDuration?.toLowerCase().includes('meses>3')) nociPlasticoScore += 2;
    });

    if (interview.bpsFactors && interview.bpsFactors.length > 2) nociPlasticoScore += 2;

    const max = Math.max(nociScore, neuroScore, nociPlasticoScore);

    if (max === 0) return { dominant: 'Nociceptivo', confidence: 'Baja', reasons: ['Sintomatología no especificada.'] };

    if (neuroScore === max && neuroScore > nociScore + 2) {
        reasons.push('Se reportan síntomas cardinales neurológicos periféricos (adormecimiento, eléctrico, hormigueo) dominante.');
        return { dominant: 'Neuropático', confidence: neuroScore > 4 ? 'Alta' : 'Media', reasons };
    }

    if (nociPlasticoScore === max && nociPlasticoScore > nociScore + 2) {
        reasons.push('Cuadro difuso, crónico o altamente modulado por factores BPS dominantes indicaría dolor persistente complejo.');
        return { dominant: 'Nociplástico', confidence: nociPlasticoScore > 5 ? 'Alta' : 'Media', reasons };
    }

    if (nociScore === max || Math.abs(max - nociScore) <= 2) {
        if (neuroScore > 1 || nociPlasticoScore > 1) {
            reasons.push('Existen solapamientos de dolor mecánico pero con rasgos neuronales y/o cronificados. Es un cuadro mixto.');
            return { dominant: 'Mixto', confidence: 'Alta', reasons };
        }
        reasons.push('Síntomas intermitentes altamente reproducibles típicamente mecánicos/tisulares dominan la clínica.');
        return { dominant: 'Nociceptivo', confidence: 'Alta', reasons };
    }

    return { dominant: 'Mixto', confidence: 'Baja', reasons: ['No hay datos suficientes para segregar dominancia.'] };
}

export interface TrafficLightResult {
    color: 'Verde' | 'Amarillo' | 'Rojo';
    rules: {
        painRule?: string;
        afterEffectRule?: string;
        progressionRule?: string;
        regressionRule?: string;
        redFlagRule?: string;
    };
    reasons: string[];
}

export function computeLoadTrafficLight(irritability: IrritabilityResult, interview: EvaluacionInicial['interview']): TrafficLightResult {
    const reasons: string[] = [];
    const rules: TrafficLightResult['rules'] = {};
    let color: 'Verde' | 'Amarillo' | 'Rojo' = 'Verde';

    const hasUrgency = interview?.hasUrgency || false;
    const hasRedFlags = Object.values((interview as any)?.redFlagsCheck || {}).some(v => v === true);

    if (hasUrgency || hasRedFlags) {
        color = 'Rojo';
        rules.redFlagRule = 'ESTADO DE ALARMA';
        reasons.push('Se han levantado sospechas de urgencia médica o banderas rojas positivas. Proceder con extrema cautela y/o derivar de inmediato.');
        return { color, rules, reasons }; // Short-circuit
    }

    if (irritability.level === 'Alta') {
        color = 'Rojo';
        rules.painRule = 'Irritabilidad Alta prohíbe carga compresiva desmedida.';
        reasons.push('El tejido no soporta testeo de esfuerzo agresivo ni de alta repetición.');
    } else if (irritability.level === 'Moderada') {
        color = 'Amarillo';
        rules.progressionRule = 'Progresar sintomatología controlada.';
        reasons.push('Pruebas funcionales y de carga permitidas pero sin alcanzar hiper-fatiga ni dolor > 5/10 sostenido.');
    } else {
        color = 'Verde';
        rules.progressionRule = 'Exploración agresiva permitida.';
        reasons.push('Tejido sumable. Se permite sobrecarga iterativa en pro de reproducir signos escondidos.');
    }

    if (interview?.bpsFactors && interview.bpsFactors.length >= 3 && color === 'Verde') {
        color = 'Amarillo';
        rules.regressionRule = 'Ponderación BPS retrocede el semáforo.';
        reasons.push('Carga tisular alta permitida pero el marco mental del usuario amerita pacing psicológico.');
    }

    return { color, rules, reasons };
}

export interface ExamChecklistResult {
    essential: { category: string; test: string; rationale: string; whatToLookFor: string }[];
    recommended: { category: string; test: string; rationale: string; whatToLookFor: string }[];
    optional: { category: string; test: string; rationale: string; whatToLookFor: string }[];
}

export function buildExamChecklist(interview: EvaluacionInicial['interview']): ExamChecklistResult {
    const essential: ExamChecklistResult['essential'] = [];
    const recommended: ExamChecklistResult['recommended'] = [];
    const optional: ExamChecklistResult['optional'] = [];

    // Siempre esenciales (Baseline)
    essential.push({ category: 'Observación', test: 'Inspección Estática y Postura', rationale: 'Base clínica', whatToLookFor: 'Asimetrías mayores, atrofias, actitud protectora o cojera.' });

    if (!interview || !interview.focos) {
        return { essential, recommended, optional };
    }

    interview.focos.forEach((f: any) => {
        // Signo Comparable
        if (f.comparableSign?.name) {
            essential.push({
                category: 'Retest Funcional', test: `Recrear ${f.comparableSign.name}`,
                rationale: 'Establecer base objetiva',
                whatToLookFor: `Exactitud del dolor en ${f.region}, compensaciones perimetrales justo antes del dolor.`
            });
        }

        // ROM
        essential.push({
            category: 'Movilidad Funcional', test: `ROM Asistido/Aislado de ${f.region}`,
            rationale: 'Rango de base activo y pasivo',
            whatToLookFor: 'Tope blando/duro/firme, arco doloroso, o pinzamiento terminal.'
        });

        const sym = f.dominantSymptoms || [];
        const regionLow = f.region.toLowerCase();

        // Inflamación/Edema
        if (sym.includes('Inflamación') || sym.includes('Edema') || sym.includes('Calor')) {
            essential.push({
                category: 'Inflamatorio', test: 'Palpación de Temperatura y Test de Signo del Témpano/Derrame',
                rationale: 'Cuantificar derrame intra/extra articular',
                whatToLookFor: 'Aumento de volumen > 1cm vs contralateral, aumento térmico, fluctuación palpable.'
            });
        }

        // Neuro
        if (sym.includes('Hormigueo') || sym.includes('Adormecimiento') || sym.includes('Debilidad')) {
            essential.push({
                category: 'Neurológico (Screen)', test: 'Dermatomas, Miotomas y Reflejos periféricos',
                rationale: 'Signos radiculares periféricos reportados',
                whatToLookFor: 'Déficit sensitivo en bloque dermatomal, hiporreflexia, debilidad franca al MMT 5s.'
            });
            recommended.push({
                category: 'Neurodinamia', test: `Test Tensión Neural Prox/Distal (${regionLow})`,
                rationale: 'Sensibilidad mecanosensitiva nerviosa',
                whatToLookFor: 'Reproducción exacta del síntoma neuropático, asimetría de ROM > 10° vs sano.'
            });
        }

        // Estabilidad
        if (sym.includes('Inestabilidad') || sym.includes('Chasquido') || sym.includes('Fallo')) {
            essential.push({
                category: 'Estabilidad (Pasiva)', test: `Pruebas Ortopédicas Ligamentosas Clave - ${f.region}`,
                rationale: 'Reporte de Giving-way mecánico',
                whatToLookFor: 'Laxitud anormal comparada pasiva, tope capsular blando en vez de firme.'
            });
            recommended.push({
                category: 'Control Motor (Dinámico)', test: `Pruebas propioceptivas de carga unipedal o balance - ${f.region}`,
                rationale: 'Correlacionar laxitud con déficit motor dinámico',
                whatToLookFor: 'Retraso de activación refleja, compensaciones multiregionales proximales (ej: abd cadera).'
            });
        }

        // Pistas anatómicas por subregión
        if (regionLow.includes('hombro')) {
            optional.push({ category: 'Diagnostico Diferencial', test: 'Screen Cervical Pasivo', rationale: 'Dolor radiado silente', whatToLookFor: 'Limitación o reproducción de síntomas glenohumerales al mover el cuello.' });
        }
        if (regionLow.includes('rodilla')) {
            optional.push({ category: 'Diagnóstico Diferencial', test: 'Screen Cadera/Tobillo', rationale: 'Complejo articular adjunto', whatToLookFor: 'Restricción de rotación interna cadera o dorsiflexión limitante.' });
        }
    });

    // Filtros de dupliciad pura
    const filterDups = (arr: any[]) => arr.filter((v, i, a) => a.findIndex(t => (t.test === v.test)) === i);

    return {
        essential: filterDups(essential),
        recommended: filterDups(recommended),
        optional: filterDups(optional)
    };
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
    const bps = interview.bpsFactors || [];
    if (bps.includes('Estrés/Ansiedad') || bps.includes('Miedo al movimiento')) bpsNotes.topBarriers.push('Kinesiofobia / Sobrecarga Cognitiva');
    if (bps.includes('Mala calidad de sueño')) bpsNotes.topBarriers.push('Alteración de Recuperación (Sueño)');

    // Asumir que si no hay BPS graves es un facilitador de adherencia
    if (bpsNotes.topBarriers.length === 0) bpsNotes.topFacilitators.push('Paciente sin red-flags biopsicosociales aparentes (Buen pronóstico base).');

    interview.focos?.forEach((f: any) => {
        if (f.comparableSign?.name) {
            functionalDeficits.push({
                label: f.comparableSign.name,
                baseline: `Dolor EVA ${f.comparableSign.painLevel}/10 bajo ${f.comparableSign.conditions}`,
                side: f.lado || 'N/A',
                linkedPsfs: true
            });
        }

        // Examen Mocking Synthesis (Se ajustará si exite data de ROM en el param "exam")
        if (exam?.roms) {
            // Ejemplo de uso futuro de data real de examen
        } else {
            // Predictivo basado en entrevista
            structuralCandidates.push({
                label: `Posible disfunción en ${f.region} (Tejido contráctil vs inerte a confirmar)`,
                confidence: 'Baja', reproduceSymptom: false, source: 'Entrevista Subjetiva'
            });
        }
    });

    return { structuralCandidates, functionalDeficits, bpsNotes };
}
