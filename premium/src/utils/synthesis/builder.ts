export function buildP2SummaryStructured(examState: any, contextP1?: any): any {
    if (!examState) return null;

    const summary: any = {
        signos_concordantes: [],
        signos_discordantes: [],
        resumen_hallazgos_positivos: '',
        patron_movilidad: '',
        patron_fuerza_control: '',
        irritabilidad_tisular: '',
        summary_text_structured: ''
    };

    let allFindings: string[] = [];

    // --- ENCABEZADO CLÍNICO (HEREDADO DE P1) ---
    if (contextP1) {
        const p1Info = [];
        if (contextP1.foco) p1Info.push(`Foco: ${contextP1.foco}`);
        if (contextP1.lado) p1Info.push(`Lado: ${contextP1.lado}`);
        if (contextP1.irritabilidad) p1Info.push(`Irritabilidad: ${contextP1.irritabilidad}`);
        if (contextP1.signoComparable) p1Info.push(`Signo Comparable (P1): ${contextP1.signoComparable}`);
        
        if (p1Info.length > 0) {
            allFindings.push(`[CONTEXTO P1] ${p1Info.join(' | ')}`);
        }
    }

    // --- B. OBSERVACIONAL ---
    if (examState.observacion) {
        const obs = [];
        if (examState.observacion.postura) obs.push(`Postura: ${examState.observacion.postura}`);
        if (examState.observacion.marcha) obs.push(`Marcha: ${examState.observacion.marcha}`);
        if (examState.observacion.trofismo) obs.push(`Trofismo: ${examState.observacion.trofismo}`);
        if (examState.observacion.actitudEvitativa) obs.push(`Actitud: ${examState.observacion.actitudEvitativa}`);
        if (examState.observacion.comentario) obs.push(`Comentario: ${examState.observacion.comentario}`);
        
        if (obs.length > 0) {
            allFindings.push(`### OBSERVACIÓN\n${obs.map(o => `- ${o}`).join('\n')}`);
        }
    }

    // --- C. ROM ANALÍTICO (CORRECCIÓN BILATERAL) ---
    if (examState.romAnaliticoConfig?.filas?.length > 0) {
        let romEntries: string[] = [];
        examState.romAnaliticoConfig.filas.forEach((f: any) => {
            let desc = `**${f.movimiento}** (${f.lado}):`;
            
            if (f.lado === 'Bilateral') {
                const der = [];
                if (f.evalAct && f.resActDer) der.push(`Act: ${f.resActDer}°`);
                if (f.evalPas && f.resPasDer) der.push(`Pas: ${f.resPasDer}°${f.topeFinalDer ? ` [Tope: ${f.topeFinalDer}]` : ''}`);
                if (f.hallazgosCustomDer?.length > 0) der.push(`Recorrido: ${f.hallazgosCustomDer.join(', ')}`);

                const izq = [];
                if (f.evalAct && f.resActIzq) izq.push(`Act: ${f.resActIzq}°`);
                if (f.evalPas && f.resPasIzq) izq.push(`Pas: ${f.resPasIzq}°${f.topeFinalIzq ? ` [Tope: ${f.topeFinalIzq}]` : ''}`);
                if (f.hallazgosCustomIzq?.length > 0) izq.push(`Recorrido: ${f.hallazgosCustomIzq.join(', ')}`);

                if (der.length > 0) desc += `\n  - DERECHO: ${der.join(' | ')}`;
                if (izq.length > 0) desc += `\n  - IZQUIERDO: ${izq.length > 0 ? izq.join(' | ') : 'No evaluado'}`;
            } else {
                const results = [];
                if (f.evalAct && f.resAct) results.push(`Act: ${f.resAct}°`);
                if (f.evalPas && f.resPas) results.push(`Pas: ${f.resPas}°${f.topeFinal ? ` [Tope: ${f.topeFinal}]` : ''}`);
                if (f.hallazgosCustom?.length > 0) results.push(`Recorrido: ${f.hallazgosCustom.join(', ')}`);
                if (results.length > 0) desc += ` ${results.join(' | ')}`;
            }

            if (f.hallazgo) desc += `\n  - Hallazgo: ${f.hallazgo}`;
            romEntries.push(desc);

            // Identificar concordancia
            const fullText = desc.toLowerCase();
            if (fullText.includes('dolor') || fullText.includes('limit') || fullText.includes('reproduce')) {
                summary.signos_concordantes.push(`${f.movimiento}: ${f.hallazgo || 'Hallazgo positivo'}`);
            }
        });
        summary.patron_movilidad = romEntries.join('\n');
        allFindings.push(`### RANGO DE MOVIMIENTO (ROM)\n${romEntries.join('\n')}`);
    }

    // --- D. FUERZA Y CARGA ---
    const fuerzaItems: string[] = [];
    
    // MRC
    if (examState.fuerzaMrc?.length > 0) {
        examState.fuerzaMrc.forEach((f: any) => {
            if (!f.grupo) return;
            let d = `${f.grupo} (${f.lado || 'N/A'}): M${f.grado}/5`;
            if (f.dolor) d += ` [Dolor EVA ${f.dolor}/10]`;
            if (f.observacion) d += ` - Obs: ${f.observacion}`;
            fuerzaItems.push(d);
            
            if (f.grado < 5 || (f.dolor && parseInt(f.dolor) > 3)) {
                summary.signos_concordantes.push(`Fuerza MRC ${f.grupo}: ${d}`);
            }
        });
    }

    // Dinamometría / Isometría / Load (fuerzaMlc)
    if (examState.fuerzaMlc?.filas?.length > 0) {
        examState.fuerzaMlc.filas.forEach((f: any) => {
            if (!f.test) return;
            let d = `**${f.test}** (${f.lado}): `;
            if (f.resultado_num) d += `${f.resultado_num} ${f.unidad || ''} `;
            if (f.calidad) d += `[Calidad: ${f.calidad}] `;
            if (f.dolor_mrc) d += `[EVA ${f.dolor_mrc}/10] `;
            if (f.obs) d += `(${f.obs})`;
            fuerzaItems.push(d);

            if (f.dolor_mrc > 3 || (f.calidad && f.calidad.toLowerCase().includes('pobre'))) {
                summary.signos_concordantes.push(`Fuerza específica ${f.test}: ${d}`);
            }
        });
    }

    if (fuerzaItems.length > 0) {
        summary.patron_fuerza_control = fuerzaItems.join('; ');
        allFindings.push(`### FUERZA Y CARGA\n${fuerzaItems.map(i => `- ${i}`).join('\n')}`);
    }

    // --- E. PALPACIÓN E IRRITABILIDAD ---
    if (examState.palpacionConfig?.filas?.length > 0) {
        let palpe: string[] = [];
        examState.palpacionConfig.filas.forEach((f: any) => {
            if (!f.estructura) return;
            let d = `${f.estructura} (${f.lado}): ${f.hallazgoPrincipal}`;
            if (f.dolor && f.dolor > 0) d += ` [EVA ${f.dolor}/10]`;
            if (f.edema && f.edema !== 'Normal') d += ` | Edema: ${f.edema}`;
            if (f.temperatura && f.temperatura !== 'Normal') d += ` | Temp: ${f.temperatura}`;
            if (f.observacion) d += ` | Obs: ${f.observacion}`;
            palpe.push(d);
            
            if (f.dolor > 3 || (f.hallazgoPrincipal && !f.hallazgoPrincipal.toLowerCase().includes('normal'))) {
                summary.signos_concordantes.push(`Palpación ${f.estructura}: ${d}`);
            }
        });
        summary.irritabilidad_tisular = palpe.join('; ');
        allFindings.push(`### PALPACIÓN E IRRITABILIDAD\n${palpe.map(p => `- ${p}`).join('\n')}`);
    }

    // --- F. NEUROLÓGICO ---
    if (examState.neurologico) {
        const neuroFindings: string[] = [];
        ['reflejos', 'sensibilidad', 'neurodinamia', 'fuerzaMiotomas'].forEach(tipo => {
            if (examState.neurologico[tipo]?.length > 0) {
                examState.neurologico[tipo].forEach((i: any) => {
                    const root = i.raiz || i.dermatoma || i.nervio || i.miotoma || 'Neuro';
                    const isNormal = i.estado === 'Normal' || i.estado === 'Normal (2+)';
                    let d = `${tipo.toUpperCase()} ${root} (${i.lado || 'N/A'}): ${i.estado}`;
                    if (i.comentario) d += ` - ${i.comentario}`;
                    
                    if (!isNormal) {
                        neuroFindings.push(d);
                        summary.signos_concordantes.push(d);
                    } else if (i.comentario) {
                        neuroFindings.push(d); // Incluir si tiene comentario aunque sea normal
                    }
                });
            }
        });
        if (neuroFindings.length > 0) {
            allFindings.push(`### EXAMEN NEUROLÓGICO\n${neuroFindings.map(n => `- ${n}`).join('\n')}`);
        }
    }

    // --- G. CONTROL MOTOR Y TAREAS ---
    if (examState.controlMotorConfig?.filas?.length > 0) {
        const motorFindings: string[] = [];
        examState.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.tareaRegion) return;
            let d = `**${f.tipoTarea}** - ${f.tareaRegion} (${f.ladoMotor || 'N/A'}): ${f.calidadEjecucion}`;
            const chips = f.hallazgosChips ? (Array.isArray(f.hallazgosChips) ? f.hallazgosChips.join(', ') : f.hallazgosChips) : '';
            if (chips) d += ` | Hallazgos: ${chips}`;
            if (f.comentario) d += ` (${f.comentario})`;
            motorFindings.push(d);
            
            if (f.calidadEjecucion !== 'Adecuada/Limpia') {
                summary.signos_concordantes.push(`Control Motor (${f.tareaRegion}): ${d}`);
            }
        });
        if (motorFindings.length > 0) {
            allFindings.push(`### CONTROL MOTOR Y TAREAS\n${motorFindings.map(m => `- ${m}`).join('\n')}`);
        }
    }

    // --- H. PRUEBAS ORTOPÉDICAS ---
    if (examState.pruebasOrtopedicas?.length > 0) {
        const orthoFindings: string[] = [];
        examState.pruebasOrtopedicas.forEach((p: any) => {
            if (!p.nombre) return;
            let d = `**${p.nombre}** (${p.lado || 'N/A'}): ${p.resultado}`;
            if (p.reproduce_sintoma) d += ' [⚠️ REPRODUCE SÍNTOMA]';
            if (p.comentario) d += ` - ${p.comentario}`;
            orthoFindings.push(d);
            
            if (p.resultado === 'Positiva' || p.reproduce_sintoma) {
                summary.signos_concordantes.push(`Test Ortopédico ${p.nombre}: ${p.resultado}${p.reproduce_sintoma ? ' (reproduce síntoma)' : ''}`);
            } else if (p.resultado === 'Negativa') {
                summary.signos_discordantes.push(`Test Ortopédico ${p.nombre}: Negativo`);
            }
        });
        if (orthoFindings.length > 0) {
            allFindings.push(`### PRUEBAS ORTOPÉDICAS\n${orthoFindings.map(o => `- ${o}`).join('\n')}`);
        }
    }

    // --- I. PRUEBAS FUNCIONALES / PERFORMANCE ---
    if (examState.funcionalesConfig?.filas?.length > 0) {
        const funcFindings: string[] = [];
        examState.funcionalesConfig.filas.forEach((f: any) => {
            if (!f.test) return;
            let d = `**${f.test}** (${f.lado}): ${f.resultado_num} ${f.unidad || ''}`;
            if (f.calidad) d += ` | Calidad: ${f.calidad}`;
            if (f.obs) d += ` (${f.obs})`;
            funcFindings.push(d);
            
            if (f.calidad && f.calidad.toLowerCase().includes('pobre')) {
                summary.signos_concordantes.push(`Funcional ${f.test}: Calidad pobre`);
            }
        });
        if (funcFindings.length > 0) {
            allFindings.push(`### PRUEBAS FUNCIONALES / PERFORMANCE\n${funcFindings.map(f => `- ${f}`).join('\n')}`);
        }
    }

    // --- J. RE-TEST (SIGNO COMPARABLE) ---
    if (examState.retestConfig?.estadoActual || examState.retestConfig?.resultadoPost) {
        const rc = examState.retestConfig;
        const signo = rc.signoPrueba || contextP1?.signoComparable || 'Signo comparable';
        const antes = rc.estadoActual || 'No registrado';
        const despues = rc.resultadoPost || 'Sin cambio registrado';
        
        allFindings.push(`### RE-TEST\n- **${signo}**: ${antes} -> ${despues}`);
        
        if (rc.comentario) {
            allFindings.push(`  - Comentario Re-test: ${rc.comentario}`);
        }

        if (rc.estadoActual === 'Mejor') {
            summary.signos_discordantes.push(`Re-test Exitoso: Mejoría en ${signo}`);
        } else if (rc.estadoActual === 'Peor') {
            summary.signos_concordantes.push(`Re-test Fallido: Empeoramiento en ${signo}`);
        }
    }

    // --- K. MEDIDAS COMPLEMENTARIAS ---
    if (examState.complementary) {
        allFindings.push(`### MEDIDAS COMPLEMENTARIAS\n- ${examState.complementary}`);
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
        textSections.push("### 🔥 SIGNOS CONCORDANTES (Hallazgos Positivos)\n" + summary.signos_concordantes.map((s: string) => `- ${s}`).join('\n'));
    }
    
    if (summary.signos_discordantes.length > 0) {
        textSections.push("### ❄️ SIGNOS DISCORDANTES (Descartan o Modifican)\n" + summary.signos_discordantes.map((s: string) => `- ${s}`).join('\n'));
    }

    textSections.push(...allFindings);

    summary.resumen_hallazgos_positivos = summary.signos_concordantes.join('\n');
    summary.summary_text_structured = textSections.join('\n\n') || "Examen físico sin hallazgos registrados.";

    return summary;
}
