export function buildP2SummaryStructured(examState: any, contextP1?: any): any {
    if (!examState) return null;

    const summary: any = {
        signos_concordantes: [],
        signos_discordantes: [],
        resumen_hallazgos_positivos: '',
        patron_movilidad: '',
        patron_fuerza_control: '',
        irritabilidad_tisular: '',
        summary_text_structured: '',
        summary_text_short: '',
        p2_summary_rendered: '' // New human-readable version
    };

    const sectionsRendered: { title: string; lines: string[] }[] = [];
    const sectionsStructured: string[] = [];

    // --- A. MARCO CLÍNICO ---
    const marcoLines: string[] = [];
    if (contextP1) {
        if (contextP1.foco) marcoLines.push(`Foco principal: ${contextP1.foco}.`);
        if (contextP1.lado) marcoLines.push(`Lado: ${contextP1.lado}.`);
        if (contextP1.queja) marcoLines.push(`Queja prioritaria: ${contextP1.queja}.`);
        if (contextP1.irritabilidad) marcoLines.push(`Irritabilidad clínica: ${contextP1.irritabilidad}.`);
        if (contextP1.signoComparable) marcoLines.push(`Tarea índice: ${contextP1.signoComparable}.`);
    }
    if (examState.examModality) marcoLines.push(`Modalidad del examen: ${examState.examModality}.`);
    
    if (marcoLines.length > 0) {
        sectionsRendered.push({ title: 'Marco clínico', lines: marcoLines });
        sectionsStructured.push(`### A. MARCO CLÍNICO\n${marcoLines.map(l => `- ${l}`).join('\n')}`);
    }

    // --- B. OBSERVACIÓN ---
    const obsLines: string[] = [];
    if (examState.movimientoObservadoHoy) obsLines.push(`En los gestos funcionales evaluados se aprecia: ${examState.movimientoObservadoHoy}.`);
    if (examState.postureAlignment) obsLines.push(`En la postura se aprecia: ${examState.postureAlignment}.`);
    if (examState.gaitBasicGesture) obsLines.push(`En la marcha se observa: ${examState.gaitBasicGesture}.`);
    
    if (examState.observacionInicialConfig) {
        const cfg = examState.observacionInicialConfig;
        if (cfg.posturaChips?.length > 0) obsLines.push(`Hallazgos en postura: ${cfg.posturaChips.join(', ')}.`);
        if (cfg.marchaChips?.length > 0) obsLines.push(`Hallazgos en marcha: ${cfg.marchaChips.join(', ')}.`);
        if (cfg.movLibreChips?.length > 0) obsLines.push(`Hallazgos en movimiento libre: ${cfg.movLibreChips.join(', ')}.`);
    }
    if (examState.observacion?.comentario) obsLines.push(`Comentario adicional: ${examState.observacion.comentario}.`);

    if (obsLines.length > 0) {
        sectionsRendered.push({ title: 'Observación', lines: obsLines });
        sectionsStructured.push(`### B. OBSERVACIÓN\n${obsLines.map(l => `- ${l}`).join('\n')}`);
    }

    // --- C. RANGO DE MOVIMIENTO (ROM) ---
    if (examState.romAnaliticoConfig?.filas?.length > 0) {
        const romLinesRendered: string[] = [];
        const romLinesStructured: string[] = [];

        examState.romAnaliticoConfig.filas.forEach((f: any) => {
            let line = `${f.movimiento} (${f.lado})`;
            let structLine = `**${f.movimiento}** (${f.lado}):`;

            if (f.lado === 'Bilateral') {
                const der = [];
                if (f.evalAct && f.resActDer) der.push(`Activo ${f.resActDer}°`);
                if (f.evalPas && f.resPasDer) der.push(`Pasivo ${f.resPasDer}°${f.topeFinalDer ? ` (${f.topeFinalDer})` : ''}`);
                if (f.evaDer) der.push(`EVA ${f.evaDer}/10`);
                if (f.hallazgosCustomDer?.length > 0) der.push(f.hallazgosCustomDer.join(', '));
                if (f.hallazgoDer) der.push(f.hallazgoDer);

                const izq = [];
                if (f.evalAct && f.resActIzq) izq.push(`Activo ${f.resActIzq}°`);
                if (f.evalPas && f.resPasIzq) izq.push(`Pasivo ${f.resPasIzq}°${f.topeFinalIzq ? ` (${f.topeFinalIzq})` : ''}`);
                if (f.evaIzq) izq.push(`EVA ${f.evaIzq}/10`);
                if (f.hallazgosCustomIzq?.length > 0) izq.push(f.hallazgosCustomIzq.join(', '));
                if (f.hallazgoIzq) izq.push(f.hallazgoIzq);

                line += `: Derecho [${der.join(' | ')}] | Izquierdo [${izq.join(' | ')}]`;
                structLine += `\n  - DERECHO: ${der.join(' | ')}\n  - IZQUIERDO: ${izq.join(' | ')}`;
            } else {
                const res = [];
                if (f.evalAct && f.resAct) res.push(`Activo ${f.resAct}°`);
                if (f.evalPas && f.resPas) res.push(`Pasivo ${f.resPas}°${f.topeFinal ? ` (${f.topeFinal})` : ''}`);
                if (f.eva) res.push(`EVA ${f.eva}/10`);
                if (f.hallazgosCustom?.length > 0) res.push(f.hallazgosCustom.join(', '));
                if (f.hallazgo) res.push(f.hallazgo);
                
                line += `: ${res.join(' | ')}`;
                structLine += ` ${res.join(' | ')}`;
            }

            romLinesRendered.push(line + '.');
            romLinesStructured.push(structLine);

            // Concordancia
            const lower = line.toLowerCase();
            if (lower.includes('dolor') || lower.includes('limit') || lower.includes('rígido') || (f.evaDer > 3) || (f.evaIzq > 3) || (f.eva > 3)) {
                summary.signos_concordantes.push(`ROM ${f.movimiento}: ${line}`);
            }
        });

        if (romLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Rango de movimiento', lines: romLinesRendered });
            sectionsStructured.push(`### C. RANGO DE MOVIMIENTO (ROM)\n${romLinesStructured.join('\n')}`);
            summary.patron_movilidad = romLinesRendered.join('; ');
        }
    }

    // --- D. FUERZA Y TOLERANCIA A CARGA ---
    if (examState.fuerzaCargaConfig?.filas?.length > 0) {
        const fLinesRendered: string[] = [];
        const fLinesStructured: string[] = [];

        examState.fuerzaCargaConfig.filas.forEach((f: any) => {
            if (!f.tipoEvaluacion && !f.region) return;
            
            let label = `${f.tipoEvaluacion || 'Evaluación'} de ${f.region || 'grupo'} (${f.lado})`;
            let line = label + ': ';
            let structLine = `**${label}**: `;
            
            if (f.tipoEvaluacion === 'Dinamometría (Fuerza)') {
                const res = `${f.dinamometriaDer || '?'}/${f.dinamometriaIzq || '?'} ${f.dinamometriaUnidad || 'Kg'}`;
                line += res;
                structLine += res;
                if (f.diferenciaCalculada) {
                    const dif = ` [Diferencia: ${f.diferenciaCalculada}% - ${f.clasificacionAutomatica || ''}]`;
                    line += dif;
                    structLine += dif;
                }
            } else if (f.tipoEvaluacion === 'Isometría mantenida') {
                const res = `${f.isometriaSegundos || '?'} segundos (Término por: ${f.isometriaMotivo || 'N/A'})`;
                line += res;
                structLine += res;
            } else if (f.tipoEvaluacion === 'Repeticiones submáximas') {
                const res = `${f.repeticionesN || '?'} repeticiones (Corte por: ${f.repeticionesCorte || 'N/A'})`;
                line += res;
                structLine += res;
            } else if (f.resultado) {
                line += f.resultado;
                structLine += f.resultado;
            }

            const extra = [];
            if (f.calidadEsfuerzo) extra.push(`Calidad: ${f.calidadEsfuerzo}`);
            if (f.dolorDurante) extra.push(`EVA durante: ${f.dolorDurante}`);
            if (f.dolorPosterior) extra.push(`Dolor posterior: ${f.dolorPosterior}`);
            if (f.observacion) extra.push(f.observacion);

            if (extra.length > 0) {
                line += ` | ${extra.join(' | ')}`;
                structLine += ` | ${extra.join(' | ')}`;
            }

            fLinesRendered.push(line + '.');
            fLinesStructured.push(structLine);

            if (f.dolorDurante === 'Moderado' || f.dolorDurante === 'Alto' || (f.calidadEsfuerzo && f.calidadEsfuerzo === 'Pobre')) {
                summary.signos_concordantes.push(`Fuerza: ${line}`);
            }
        });

        if (fLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Fuerza y tolerancia a carga', lines: fLinesRendered });
            sectionsStructured.push(`### D. FUERZA Y TOLERANCIA A CARGA\n${fLinesStructured.map(l => `- ${l}`).join('\n')}`);
            summary.patron_fuerza_control = fLinesRendered.join('; ');
        }
    }

    // --- E. PALPACIÓN ---
    if (examState.palpacionConfig?.filas?.length > 0) {
        const pLinesRendered: string[] = [];
        const pLinesStructured: string[] = [];

        examState.palpacionConfig.filas.forEach((f: any) => {
            if (!f.estructura) return;
            let line = `${f.estructura} (${f.lado}): ${f.hallazgoPrincipal || 'Sensibilidad local'}`;
            if (f.dolor) line += ` (EVA ${f.dolor}/10)`;
            if (f.edema && f.edema !== 'Normal') line += `, con edema ${f.edema}`;
            if (f.temperatura && f.temperatura !== 'Normal') line += `, temperatura ${f.temperatura}`;
            if (f.observacion) line += `. Obs: ${f.observacion}`;
            
            pLinesRendered.push(line + '.');
            pLinesStructured.push(`- ${line}`);

            if (parseInt(f.dolor) > 3 || (f.hallazgoPrincipal && !f.hallazgoPrincipal.toLowerCase().includes('normal'))) {
                summary.signos_concordantes.push(`Palpación ${f.estructura}: ${line}`);
            }
        });

        if (examState.palpacionConfig.movilidadAccesoria) {
            pLinesRendered.push(`Movilidad accesoria/End-feel: ${examState.palpacionConfig.movilidadAccesoria}.`);
            pLinesStructured.push(`- Movilidad accesoria: ${examState.palpacionConfig.movilidadAccesoria}`);
        }
        if (examState.palpacionConfig.sintesisFinal) {
            pLinesRendered.push(`Síntesis palpatoria: ${examState.palpacionConfig.sintesisFinal}.`);
            pLinesStructured.push(`- SÍNTESIS: ${examState.palpacionConfig.sintesisFinal}`);
        }

        if (pLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Palpación', lines: pLinesRendered });
            sectionsStructured.push(`### E. PALPACIÓN\n${pLinesStructured.join('\n')}`);
            summary.irritabilidad_tisular = pLinesRendered.join('; ');
        }
    }

    // --- F. NEUROVASCULAR / SOMATOSENSORIAL ---
    if (examState.neuroVascularConfig) {
        const nLinesRendered: string[] = [];
        const nLinesStructured: string[] = [];
        const cfg = examState.neuroVascularConfig;

        if (cfg.screening) {
            nLinesRendered.push(`Screening global: ${cfg.screening}${cfg.screeningComentario ? ` (${cfg.screeningComentario})` : ''}.`);
            nLinesStructured.push(`- Screening: ${cfg.screening} (${cfg.screeningComentario || ''})`);
        }

        if (cfg.dominios) {
            Object.entries(cfg.dominios).forEach(([key, val]: [string, any]) => {
                if (val.resultado && val.resultado !== 'Normal' && val.resultado !== 'Pendiente') {
                    let line = `${key}: ${val.resultado}${val.detalle ? ` (${val.detalle})` : ''}.`;
                    nLinesRendered.push(line);
                    nLinesStructured.push(`- **${key}**: ${val.resultado}${val.detalle ? ` - ${val.detalle}` : ''}`);
                    summary.signos_concordantes.push(`Neuro: ${line}`);
                }
            });
        }

        if (nLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Neurovascular / somatosensorial', lines: nLinesRendered });
            sectionsStructured.push(`### F. EXAMEN NEUROVASCULAR\n${nLinesStructured.join('\n')}`);
        }
    }

    // --- G. CONTROL MOTOR / SENSORIOMOTOR ---
    if (examState.controlMotorConfig?.filas?.length > 0) {
        const mLinesRendered: string[] = [];
        const mLinesStructured: string[] = [];

        examState.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.regionTarea) return;
            let line = `${f.tipoTarea || 'Tarea'} en ${f.regionTarea}: Calidad ${f.calidad || 'pendiente'}`;
            if (f.sintoma) line += `, síntoma ${f.sintoma}`;
            if (f.compensacion) line += `, compensaciones: ${f.compensacion}`;
            if (f.observacion) line += `. Obs: ${f.observacion}`;

            mLinesRendered.push(line + '.');
            mLinesStructured.push(`- **${f.tipoTarea}** (${f.regionTarea}): ${f.calidad} | Síntoma: ${f.sintoma}`);

            if (f.calidad && f.calidad.toLowerCase() !== 'adecuada' && f.calidad.toLowerCase() !== 'limpia') {
                summary.signos_concordantes.push(`Control Motor: ${line}`);
            }
        });

        if (mLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Control motor / sensoriomotor', lines: mLinesRendered });
            sectionsStructured.push(`### G. CONTROL MOTOR\n${mLinesStructured.join('\n')}`);
        }
    }

    // --- H. PRUEBAS ORTOPÉDICAS DIRIGIDAS ---
    if (examState.ortopedicasConfig?.filas?.length > 0) {
        const oLinesRendered: string[] = [];
        const oLinesStructured: string[] = [];

        examState.ortopedicasConfig.filas.forEach((p: any) => {
            if (!p.test_name) return;
            let line = `${p.test_name} (${p.side}): Resultado ${p.result}`;
            if (p.symptom_relation && p.symptom_relation !== 'No reproduce') line += ` [Reproduce: ${p.symptom_relation}]`;
            if (p.comment) line += `. Obs: ${p.comment}`;

            oLinesRendered.push(line + '.');
            oLinesStructured.push(`- **${p.test_name}**: ${p.result}${p.symptom_relation !== 'No reproduce' ? ` [REPRODUCE]` : ''}`);

            if (p.result === 'Positiva' || (p.symptom_relation && p.symptom_relation !== 'No reproduce')) {
                summary.signos_concordantes.push(`Test Ortopédico ${p.test_name}: ${p.result} (${p.symptom_relation})`);
            } else if (p.result === 'Negativa') {
                summary.signos_discordantes.push(`Test Ortopédico ${p.test_name}: Negativo`);
            }
        });

        if (examState.ortopedicasConfig.sintesisFinal) {
            oLinesRendered.push(`Síntesis ortopédica: ${examState.ortopedicasConfig.sintesisFinal}.`);
            oLinesStructured.push(`- SÍNTESIS: ${examState.ortopedicasConfig.sintesisFinal}`);
        }

        if (oLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Pruebas ortopédicas dirigidas', lines: oLinesRendered });
            sectionsStructured.push(`### H. PRUEBAS ORTOPÉDICAS\n${oLinesStructured.join('\n')}`);
        }
    }

    // --- I. PRUEBAS FUNCIONALES / REINTEGRO ---
    if (examState.funcionalesConfig?.filas?.length > 0) {
        const fuLinesRendered: string[] = [];
        const fuLinesStructured: string[] = [];

        examState.funcionalesConfig.filas.forEach((f: any) => {
            if (!f.test) return;
            let line = `${f.test} (${f.lado}): ${f.resultado || '?'} ${f.unidad || ''}, Calidad ${f.calidad || 'NR'}`;
            if (f.dolor) line += `, EVA ${f.dolor}/10`;
            if (f.observacion) line += `. Obs: ${f.observacion}`;

            fuLinesRendered.push(line + '.');
            fuLinesStructured.push(`- **${f.test}**: ${f.resultado} ${f.unidad} | Calidad: ${f.calidad}`);

            if ((f.dolor && parseInt(f.dolor) > 3) || (f.calidad && f.calidad.toLowerCase().includes('pobre'))) {
                summary.signos_concordantes.push(`Funcional ${f.test}: ${line}`);
            }
        });

        if (fuLinesRendered.length > 0) {
            sectionsRendered.push({ title: 'Pruebas funcionales / reintegro', lines: fuLinesRendered });
            sectionsStructured.push(`### I. PRUEBAS FUNCIONALES\n${fuLinesStructured.join('\n')}`);
        }
    }

    // --- J. RE-TEST ---
    if (examState.retestConfig?.resultadoPost || examState.retestConfig?.intervencion) {
        const rc = examState.retestConfig;
        const signo = rc.signoPrueba || contextP1?.signoComparable || 'Signo comparable';
        
        const rLines = [
            `Signo evaluado: ${signo}.`,
            `Intervención realizada: ${rc.intervencion || 'N/A'}.`,
            `Resultado del re-test: ${rc.resultadoPost || 'Sin cambio registrado'} (Línea base: ${rc.estadoActual || 'N/A'}).`
        ];
        if (rc.comentario) rLines.push(`Comentario: ${rc.comentario}.`);

        sectionsRendered.push({ title: 'Re-test', lines: rLines });
        sectionsStructured.push(`### J. RE-TEST\n${rLines.map(l => `- ${l}`).join('\n')}`);

        if (rc.resultadoPost?.toLowerCase().includes('mejor')) {
            summary.signos_discordantes.push(`Re-test: Mejoría en ${signo}`);
        } else if (rc.resultadoPost?.toLowerCase().includes('peor')) {
            summary.signos_concordantes.push(`Re-test: Empeoramiento en ${signo}`);
        }
    }

    // --- K. MEDIDAS COMPLEMENTARIAS ---
    if (examState.medidasComplementariasConfig) {
        const c = examState.medidasComplementariasConfig;
        const mLines = [];
        if (c.peso) mLines.push(`Peso corporal: ${c.peso} Kg.`);
        if (c.imc) mLines.push(`Índice de Masa Corporal (IMC): ${c.imc}.`);
        if (examState.complementary) mLines.push(`Otras medidas: ${examState.complementary}.`);
        
        if (mLines.length > 0) {
            sectionsRendered.push({ title: 'Medidas complementarias', lines: mLines });
            sectionsStructured.push(`### K. MEDIDAS COMPLEMENTARIAS\n${mLines.map(l => `- ${l}`).join('\n')}`);
        }
    }

    // --- L. HALLAZGOS CONCORDANTES CLAVE ---
    if (summary.signos_concordantes.length > 0) {
        const concordantes = summary.signos_concordantes.slice(0, 5); // Tomar solo los 5 principales para evitar redundancia masiva
        sectionsRendered.push({ title: 'Hallazgos concordantes clave', lines: concordantes.map((s: string) => s + '.') });
    }

    // --- ENSAMBLAJE FINAL ---
    summary.p2_summary_rendered = sectionsRendered.map((s: any) => `${s.title}\n${s.lines.map((l: string) => `• ${l}`).join('\n')}`).join('\n\n');
    summary.summary_text_structured = sectionsStructured.join('\n\n') || "Examen físico sin hallazgos registrados.";
    summary.summary_text_short = summary.signos_concordantes.slice(0, 3).join('; ') + (summary.signos_concordantes.length > 3 ? '...' : '');
    summary.resumen_hallazgos_positivos = summary.signos_concordantes.join('\n');

    return summary;
}
