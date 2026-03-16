export function buildP2SummaryStructured(examState: any, contextP1?: any): any {
    if (!examState) return null;

    const summary: any = {
        signos_concordantes: [],
        signos_discordantes: [],
        resumen_hallazgos_positivos: '',
        patron_movilidad: '',
        patron_fuerza_control: '',
        irritabilidad_tisular: '',
        summary_text_short: '',
        summary_text_structured: ''
    };

    let allFindings: string[] = [];

    // --- A. ENCABEZADO CLÍNICO (HEREDADO DE P1) ---
    const p1Info = [];
    if (contextP1) {
        if (contextP1.foco) p1Info.push(`Foco: ${contextP1.foco}`);
        if (contextP1.lado) p1Info.push(`Lado: ${contextP1.lado}`);
        if (contextP1.queja) p1Info.push(`Queja: ${contextP1.queja}`);
        if (contextP1.irritabilidad) p1Info.push(`Irritabilidad: ${contextP1.irritabilidad}`);
        if (contextP1.signoComparable) p1Info.push(`Tarea Índice/Signo Comparable: ${contextP1.signoComparable}`);
    }
    // También campos de P2 que son encabezado
    if (examState.examModality) p1Info.push(`Modalidad: ${examState.examModality}`);
    
    if (p1Info.length > 0) {
        allFindings.push(`### A. MARCO CLÍNICO\n- ${p1Info.join(' | ')}`);
    }

    // --- B. EVALUACIÓN OBSERVACIONAL ---
    const obs = [];
    if (examState.movimientoObservadoHoy) obs.push(`Gesto/Movimiento observado: ${examState.movimientoObservadoHoy}`);
    if (examState.postureAlignment) obs.push(`Postura/Alineación: ${examState.postureAlignment}`);
    if (examState.gaitBasicGesture) obs.push(`Marcha: ${examState.gaitBasicGesture}`);
    
    if (examState.observacionInicialConfig) {
        const cfg = examState.observacionInicialConfig;
        if (cfg.posturaChips?.length > 0) obs.push(`Hallazgos Postura: ${cfg.posturaChips.join(', ')}`);
        if (cfg.marchaChips?.length > 0) obs.push(`Hallazgos Marcha: ${cfg.marchaChips.join(', ')}`);
        if (cfg.movLibreChips?.length > 0) obs.push(`Hallazgos Mov. Libre: ${cfg.movLibreChips.join(', ')}`);
    }
    
    // Legacy support or other detail fields
    if (examState.observacion?.comentario) obs.push(`Comentario: ${examState.observacion.comentario}`);
    
    if (obs.length > 0) {
        allFindings.push(`### B. OBSERVACIÓN\n${obs.map(o => `- ${o}`).join('\n')}`);
    }

    // --- C. RANGO DE MOVIMIENTO (ROM) ---
    if (examState.romAnaliticoConfig?.filas?.length > 0) {
        let romEntries: string[] = [];
        examState.romAnaliticoConfig.filas.forEach((f: any) => {
            let desc = `**${f.movimiento}** (${f.lado}):`;
            
            if (f.lado === 'Bilateral') {
                const der = [];
                if (f.evalAct && f.resActDer) der.push(`Act: ${f.resActDer}°`);
                if (f.evalPas && f.resPasDer) der.push(`Pas: ${f.resPasDer}°${f.topeFinalDer ? ` [Tope: ${f.topeFinalDer}]` : ''}`);
                if (f.evaDer) der.push(`EVA: ${f.evaDer}/10`);
                if (f.hallazgosCustomDer?.length > 0) der.push(`${f.hallazgosCustomDer.join(', ')}`);
                if (f.hallazgoDer) der.push(`Obs: ${f.hallazgoDer}`);

                const izq = [];
                if (f.evalAct && f.resActIzq) izq.push(`Act: ${f.resActIzq}°`);
                if (f.evalPas && f.resPasIzq) izq.push(`Pas: ${f.resPasIzq}°${f.topeFinalIzq ? ` [Tope: ${f.topeFinalIzq}]` : ''}`);
                if (f.evaIzq) izq.push(`EVA: ${f.evaIzq}/10`);
                if (f.hallazgosCustomIzq?.length > 0) izq.push(`${f.hallazgosCustomIzq.join(', ')}`);
                if (f.hallazgoIzq) izq.push(`Obs: ${f.hallazgoIzq}`);

                if (der.length > 0) desc += `\n  - DERECHO: ${der.join(' | ')}`;
                if (izq.length > 0) desc += `\n  - IZQUIERDO: ${izq.join(' | ')}`;
            } else {
                const results = [];
                if (f.evalAct && f.resAct) results.push(`Act: ${f.resAct}°`);
                if (f.evalPas && f.resPas) results.push(`Pas: ${f.resPas}°${f.topeFinal ? ` [Tope: ${f.topeFinal}]` : ''}`);
                if (f.eva) results.push(`EVA: ${f.eva}/10`);
                if (f.hallazgosCustom?.length > 0) results.push(`${f.hallazgosCustom.join(', ')}`);
                if (f.hallazgo) results.push(`Obs: ${f.hallazgo}`);
                if (results.length > 0) desc += ` ${results.join(' | ')}`;
            }

            romEntries.push(desc);

            // Concordancia
            const fullText = desc.toLowerCase();
            if (fullText.includes('dolor') || fullText.includes('limit') || fullText.includes('rígido') || (f.eva && parseInt(f.eva) > 3)) {
                summary.signos_concordantes.push(`${f.movimiento}: ${desc}`);
            }
        });
        summary.patron_movilidad = romEntries.join('\n');
        allFindings.push(`### C. RANGO DE MOVIMIENTO (ROM)\n${romEntries.join('\n')}`);
    }

    // --- D. FUERZA Y TOLERANCIA A CARGA ---
    const fuerzaItems: string[] = [];
    if (examState.fuerzaCargaConfig?.filas?.length > 0) {
        examState.fuerzaCargaConfig.filas.forEach((f: any) => {
            if (!f.tipoEvaluacion && !f.region) return;
            
            let d = `**${f.tipoEvaluacion || 'Evaluación'}** ${f.region ? `[${f.region}]` : ''} (${f.lado}): `;
            
            // Reconstruir resultado según tipo
            if (f.tipoEvaluacion === 'Dinamometría (Fuerza)') {
                d += `${f.dinamometriaDer || '?'}/${f.dinamometriaIzq || '?'} ${f.dinamometriaUnidad || 'Kg'}`;
                if (f.diferenciaCalculada) d += ` [Dif: ${f.diferenciaCalculada}% - ${f.clasificacionAutomatica || ''}]`;
            } else if (f.tipoEvaluacion === 'Isometría mantenida') {
                d += `${f.isometriaSegundos || '?'} seg. (Detención: ${f.isometriaMotivo || 'N/A'})`;
            } else if (f.tipoEvaluacion === 'Repeticiones submáximas') {
                d += `${f.repeticionesN || '?'} reps. (Corte: ${f.repeticionesCorte || 'N/A'})`;
            } else if (f.resultado) {
                d += f.resultado;
            }

            if (f.calidadEsfuerzo) d += ` | Calidad: ${f.calidadEsfuerzo}`;
            if (f.dolorDurante) d += ` | Dolor durante: ${f.dolorDurante}`;
            if (f.dolorPosterior) d += ` | Dolor posterior: ${f.dolorPosterior}`;
            if (f.observacion) d += ` | Obs: ${f.observacion}`;

            fuerzaItems.push(d);

            if (f.dolorDurante === 'Moderado' || f.dolorDurante === 'Alto' || (f.calidadEsfuerzo && f.calidadEsfuerzo !== 'Buena')) {
                summary.signos_concordantes.push(`Déficit Fuerza/Carga: ${d}`);
            }
        });
    }

    if (fuerzaItems.length > 0) {
        summary.patron_fuerza_control = fuerzaItems.join('; ');
        allFindings.push(`### D. FUERZA Y TOLERANCIA A CARGA\n${fuerzaItems.map(i => `- ${i}`).join('\n')}`);
    }

    // --- E. PALPACIÓN ---
    if (examState.palpacionConfig?.filas?.length > 0) {
        let palpe: string[] = [];
        examState.palpacionConfig.filas.forEach((f: any) => {
            if (!f.estructura) return;
            let d = `${f.estructura} (${f.lado || 'N/A'}): ${f.hallazgoPrincipal || 'Relieve sensible'}`;
            if (f.dolor && parseInt(f.dolor) > 0) d += ` [EVA ${f.dolor}/10]`;
            if (f.edema && f.edema !== 'Normal') d += ` | Edema: ${f.edema}`;
            if (f.temperatura && f.temperatura !== 'Normal') d += ` | Temperatura: ${f.temperatura}`;
            if (f.observacion) d += ` | Obs: ${f.observacion}`;
            palpe.push(d);
            
            if (parseInt(f.dolor) > 3 || (f.hallazgoPrincipal && !f.hallazgoPrincipal.toLowerCase().includes('normal') && !f.hallazgoPrincipal.toLowerCase().includes('sin hallazgos'))) {
                summary.signos_concordantes.push(`Palpación ${f.estructura}: ${d}`);
            }
        });
        
        if (examState.palpacionConfig.movilidadAccesoria) {
            palpe.push(`Movilidad Accesoria/End-feel: ${examState.palpacionConfig.movilidadAccesoria}`);
        }
        if (examState.palpacionConfig.sintesisFinal) {
            palpe.push(`SÍNTESIS PALPATORIA: ${examState.palpacionConfig.sintesisFinal}`);
        }

        if (palpe.length > 0) {
            summary.irritabilidad_tisular = palpe.join('; ');
            allFindings.push(`### E. PALPACIÓN\n${palpe.map(p => `- ${p}`).join('\n')}`);
        }
    }

    // --- F. NEUROVASCULAR ---
    if (examState.neuroVascularConfig) {
        const neuroFindings: string[] = [];
        const cfg = examState.neuroVascularConfig;

        if (cfg.screening) neuroFindings.push(`Screening Global: ${cfg.screening}${cfg.screeningComentario ? ` (${cfg.screeningComentario})` : ''}`);

        if (cfg.dominios) {
            Object.entries(cfg.dominios).forEach(([key, val]: [string, any]) => {
                if (val.resultado && val.resultado !== 'Normal' && val.resultado !== 'Pendiente') {
                    let d = `**${key}**: ${val.resultado}`;
                    if (val.detalle) d += ` - ${val.detalle}`;
                    neuroFindings.push(d);
                    summary.signos_concordantes.push(`Hallazgo Neuro: ${d}`);
                }
            });
        }

        if (neuroFindings.length > 0) {
            allFindings.push(`### F. EXAMEN NEUROVASCULAR\n${neuroFindings.map(n => `- ${n}`).join('\n')}`);
        }
    }

    // --- G. CONTROL MOTOR ---
    if (examState.controlMotorConfig?.filas?.length > 0) {
        const motorFindings: string[] = [];
        examState.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.regionTarea) return;
            let d = `**${f.tipoTarea || 'Tarea'}** en ${f.regionTarea}: ${f.calidad || 'No descrita'}`;
            if (f.sintoma) d += ` | Síntoma: ${f.sintoma}`;
            if (f.compensacion) d += ` | Compensaciones: ${f.compensacion}`;
            if (f.observacion) d += ` | Obs: ${f.observacion}`;
            motorFindings.push(d);
            
            if (f.calidad && f.calidad.toLowerCase() !== 'adecuada' && f.calidad.toLowerCase() !== 'limpia') {
                summary.signos_concordantes.push(`Control Motor (${f.regionTarea}): ${d}`);
            }
        });
        if (motorFindings.length > 0) {
            allFindings.push(`### G. CONTROL MOTOR\n${motorFindings.map(m => `- ${m}`).join('\n')}`);
        }
    }

    // --- H. PRUEBAS ORTOPÉDICAS ---
    if (examState.ortopedicasConfig?.filas?.length > 0) {
        const orthoFindings: string[] = [];
        examState.ortopedicasConfig.filas.forEach((p: any) => {
            if (!p.test_name) return;
            let d = `**${p.test_name}** (${p.side || 'N/A'}): ${p.result}`;
            if (p.symptom_relation && p.symptom_relation !== 'No reproduce') d += ` [⚠️ REPRODUCE: ${p.symptom_relation}]`;
            if (p.comment) d += ` - ${p.comment}`;
            orthoFindings.push(d);
            
            if (p.result === 'Positiva' || (p.symptom_relation && p.symptom_relation !== 'No reproduce')) {
                summary.signos_concordantes.push(`Test Ortopédico ${p.test_name}: ${p.result} (${p.symptom_relation})`);
            } else if (p.result === 'Negativa') {
                summary.signos_discordantes.push(`Test Ortopédico ${p.test_name}: Negativo`);
            }
        });
        
        if (examState.ortopedicasConfig.sintesisFinal) {
            orthoFindings.push(`SÍNTESIS ORTOPÉDICA: ${examState.ortopedicasConfig.sintesisFinal}`);
        }

        if (orthoFindings.length > 0) {
            allFindings.push(`### H. PRUEBAS ORTOPÉDICAS\n${orthoFindings.map(o => `- ${o}`).join('\n')}`);
        }
    }

    // --- I. PRUEBAS FUNCIONALES / PERFORMANCE ---
    if (examState.funcionalesConfig?.filas?.length > 0) {
        const funcFindings: string[] = [];
        examState.funcionalesConfig.filas.forEach((f: any) => {
            if (!f.test) return;
            let d = `**${f.test}** (${f.lado}): ${f.resultado || ''} ${f.unidad || ''}`;
            if (f.calidad) d += ` | Calidad: ${f.calidad}`;
            if (f.dolor) d += ` | EVA: ${f.dolor}/10`;
            if (f.observacion) d += ` | Obs: ${f.observacion}`;
            funcFindings.push(d);
            
            if ((f.dolor && parseInt(f.dolor) > 3) || (f.calidad && f.calidad.toLowerCase().includes('pobre'))) {
                summary.signos_concordantes.push(`Funcional ${f.test}: ${d}`);
            }
        });
        if (funcFindings.length > 0) {
            allFindings.push(`### I. PRUEBAS FUNCIONALES / PERFORMANCE\n${funcFindings.map(f => `- ${f}`).join('\n')}`);
        }
    }

    // --- J. RE-TEST (SIGNO COMPARABLE) ---
    if (examState.retestConfig?.resultadoPost || examState.retestConfig?.intervencion) {
        const rc = examState.retestConfig;
        const signo = rc.signoPrueba || contextP1?.signoComparable || 'Signo comparable';
        const antes = rc.estadoActual || 'No registrado';
        const despues = rc.resultadoPost || 'Sin cambio registrado';
        
        allFindings.push(`### J. RE-TEST\n- **Signo**: ${signo}\n- **Intervención**: ${rc.intervencion || 'N/A'}\n- **Cambio**: ${despues} (Línea base era: ${antes})`);
        
        if (rc.comentario) {
            allFindings.push(`  - Nota: ${rc.comentario}`);
        }

        if (despues.toLowerCase().includes('mejor')) {
            summary.signos_discordantes.push(`Re-test Positivo: Mejoría en ${signo}`);
        } else if (despues.toLowerCase().includes('peor') || despues.toLowerCase().includes('aumenta')) {
            summary.signos_concordantes.push(`Re-test Negativo: Empeoramiento en ${signo}`);
        }
    }

    // --- K. MEDIDAS COMPLEMENTARIAS ---
    if (examState.medidasComplementariasConfig) {
        const c = examState.medidasComplementariasConfig;
        const m = [];
        if (c.peso) m.push(`Peso: ${c.peso} Kg`);
        if (c.imc) m.push(`IMC: ${c.imc}`);
        if (examState.complementary) m.push(`Otras: ${examState.complementary}`);
        
        if (m.length > 0) {
            allFindings.push(`### K. MEDIDAS COMPLEMENTARIAS\n${m.map(i => `- ${i}`).join('\n')}`);
        }
    }

    // --- HIPÓTESIS TRACKING ---
    if (examState.hipotesis_tracking?.length > 0) {
        const hipFindings = examState.hipotesis_tracking.map((h: any) => {
            let res = `[${h.estado_en_p2?.toUpperCase() || 'PENDIENTE'}] ${h.titulo}`;
            if (h.comentario_corto) res += `: ${h.comentario_corto}`;
            return res;
        });
        allFindings.push(`### CONTRASTE DE HIPÓTESIS EN P2\n${hipFindings.map((h: string) => `- ${h}`).join('\n')}`);
    }

    // --- CONSTRUCCIÓN FINAL DEL TEXTO ---
    const textSections: string[] = [];
    
    if (summary.signos_concordantes.length > 0) {
        textSections.push("### 🔥 SIGNOS CONCORDANTES (Hallazgos Críticos)\n" + summary.signos_concordantes.map((s: string) => `- ${s}`).join('\n'));
    }
    
    if (summary.signos_discordantes.length > 0) {
        textSections.push("### ❄️ SIGNOS DISCORDANTES (Modificadores/Alivio)\n" + summary.signos_discordantes.map((s: string) => `- ${s}`).join('\n'));
    }

    textSections.push(...allFindings);

    summary.resumen_hallazgos_positivos = summary.signos_concordantes.join('\n');
    summary.summary_text_short = summary.signos_concordantes.slice(0, 3).join('; ') + (summary.signos_concordantes.length > 3 ? '...' : '');
    summary.summary_text_structured = textSections.join('\n\n') || "Examen físico sin hallazgos registrados.";

    return summary;
}
