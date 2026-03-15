export function buildP2SummaryStructured(examState: any): any {
    if (!examState) return null;

    const summary: any = {
        signos_concordantes: [],
        signos_discordantes: [],
        resumen_hallazgos_positivos: '',
        patron_movilidad: '',
        patron_fuerza_control: '',
        irritabilidad_tisular: ''
    };

    let hallazgosGeneral: string[] = [];

    // B. Observacional
    if (examState.observacion) {
        if (examState.observacion.postura) hallazgosGeneral.push(`Postura: ${examState.observacion.postura}`);
        if (examState.observacion.marcha) hallazgosGeneral.push(`Marcha: ${examState.observacion.marcha}`);
        if (examState.observacion.trofismo) hallazgosGeneral.push(`Trofismo: ${examState.observacion.trofismo}`);
        if (examState.observacion.actitudEvitativa) hallazgosGeneral.push(`Actitud del paciente: ${examState.observacion.actitudEvitativa}`);
        if (examState.observacion.comentario) hallazgosGeneral.push(`Obs. Adicional: ${examState.observacion.comentario}`);
    }

    // C. ROM Analítico
    if (examState.romAnaliticoConfig?.filas?.length > 0) {
        let romPatron: string[] = [];
        examState.romAnaliticoConfig.filas.forEach((f: any) => {
            let desc = `${f.movimiento} (${f.lado}):`;
            if (f.evalAct && f.resActDer) desc += ` Act Der [${f.resActDer}]`;
            if (f.evalAct && f.resActIzq) desc += ` Act Izq [${f.resActIzq}]`;
            if (f.evalAct && f.resAct) desc += ` Act [${f.resAct}]`;
            
            if (f.evalPas && f.resPasDer) desc += ` Pas Der [${f.resPasDer}${f.topeFinalDer ? ' tope: ' + f.topeFinalDer : ''}]`;
            if (f.evalPas && f.resPasIzq) desc += ` Pas Izq [${f.resPasIzq}${f.topeFinalIzq ? ' tope: ' + f.topeFinalIzq : ''}]`;
            if (f.evalPas && f.resPas) desc += ` Pas [${f.resPas}${f.topeFinal ? ' tope: ' + f.topeFinal : ''}]`;

            const chips = [];
            if (f.hallazgosCustom) chips.push(...f.hallazgosCustom);
            if (f.hallazgosCustomDer) chips.push(`Der: ${f.hallazgosCustomDer.join(', ')}`);
            if (f.hallazgosCustomIzq) chips.push(`Izq: ${f.hallazgosCustomIzq.join(', ')}`);
            
            if (chips.length > 0) desc += ` -> ${chips.join(' | ')}`;
            if (f.hallazgo) desc += ` (${f.hallazgo})`;
            
            romPatron.push(desc);
            if (desc.toLowerCase().includes('dolor') || desc.toLowerCase().includes('limit')) {
                summary.signos_concordantes.push(desc);
            }
        });
        summary.patron_movilidad = romPatron.join('; ');
    }

    // D. Fuerza (MRC)
    if (examState.fuerzaMrc?.length > 0) {
        let fuerzaPatron: string[] = [];
        examState.fuerzaMrc.forEach((f: any) => {
            if (!f.grupo) return;
            let d = `${f.grupo} - M${f.grado}`;
            if (f.dolor) d += ` (Dolor EVN ${f.dolor})`;
            if (f.observacion) d += ` - Obs: ${f.observacion}`;
            fuerzaPatron.push(d);
            
            if (f.grado < 5 || (f.dolor && parseInt(f.dolor) > 3)) {
                summary.signos_concordantes.push(`Déficit Fuerza: ${d}`);
            }
        });
        summary.patron_fuerza_control = fuerzaPatron.join('; ');
    }

    // E. Palpación
    if (examState.palpacionConfig?.filas?.length > 0) {
        let palpe: string[] = [];
        examState.palpacionConfig.filas.forEach((f: any) => {
            if (!f.estructura) return;
            let d = `${f.estructura} (${f.lado}): ${f.hallazgoPrincipal}`;
            if (f.dolor && f.dolor > 0) d += ` EVA ${f.dolor}/10`;
            if (f.edema && f.edema !== 'Normal') d += ` Edema: ${f.edema}`;
            if (f.temperatura && f.temperatura !== 'Normal') d += ` Temp: ${f.temperatura}`;
            if (f.observacion) d += ` - ${f.observacion}`;
            palpe.push(d);
            if (f.hallazgoPrincipal && !f.hallazgoPrincipal.toLowerCase().includes('normal') && !f.hallazgoPrincipal.toLowerCase().includes('sin hallazgos')) {
                summary.signos_concordantes.push(`Palpación: ${d}`);
            }
        });
        summary.irritabilidad_tisular = palpe.join('; ');
    }

    // F. Neuro
    if (examState.neurologico) {
        ['reflejos', 'sensibilidad', 'neurodinamia', 'fuerzaMiotomas'].forEach(tipo => {
            if (examState.neurologico[tipo]?.length > 0) {
                examState.neurologico[tipo].forEach((i: any) => {
                    if (i.estado !== 'Normal' && i.estado !== 'Normal (2+)') {
                        const root = i.raiz || i.dermatoma || i.nervio || i.miotoma || 'Neuro';
                        const desc = `${tipo.toUpperCase()} ${root} (${i.lado}): ${i.estado}${i.comentario ? ` - ${i.comentario}` : ''}`;
                        summary.signos_concordantes.push(desc);
                        hallazgosGeneral.push(desc);
                    }
                });
            }
        });
    }

    // G. Control Motor
    if (examState.controlMotorConfig?.filas?.length > 0) {
        examState.controlMotorConfig.filas.forEach((f: any) => {
            if (!f.tareaRegion) return;
            let d = `${f.tipoTarea} - ${f.tareaRegion}`;
            if (f.ladoMotor) d += ` (${f.ladoMotor})`;
            d += `: Calidad [${f.calidadEjecucion}]`;
            
            let chips = f.hallazgosChips ? (Array.isArray(f.hallazgosChips) ? f.hallazgosChips.join(', ') : f.hallazgosChips) : '';
            if (chips) d += ` -> ${chips}`;
            if (f.comentario) d += ` (${f.comentario})`;
            
            if (f.calidadEjecucion !== 'Adecuada/Limpia') {
                summary.signos_concordantes.push(`Control Motor: ${d}`);
            }
            summary.patron_fuerza_control += (summary.patron_fuerza_control ? ' | ' : '') + d;
        });
    }

    // H. Ortopédicas
    if (examState.pruebasOrtopedicas?.length > 0) {
        examState.pruebasOrtopedicas.forEach((p: any) => {
            if (!p.nombre) return;
            let d = `Prueba Ortopédica: ${p.nombre} (${p.lado || 'N/A'}) -> ${p.resultado}`;
            if (p.reproduce_sintoma) d += ' [⚠️ Reproduce su síntoma exacto]';
            if (p.comentario) d += ` - ${p.comentario}`;
            
            if (p.resultado === 'Positiva' || p.reproduce_sintoma) {
                summary.signos_concordantes.push(d);
            } else if (p.resultado === 'Negativa') {
                summary.signos_discordantes.push(d);
            }
            hallazgosGeneral.push(d);
        });
    }

    // J. Retest Índice
    if (examState.retestConfig && examState.retestConfig.tareaIndice) {
        let d = `Test Índice [${examState.retestConfig.tareaIndice}]: `;
        d += `Previo [EVA ${examState.retestConfig.dolorBasal || '?'} / RPE ${examState.retestConfig.rpeBasal || '?'}] `;
        
        if (examState.retestConfig.estadoActual) {
            d += `-> Re-test [Estado: ${examState.retestConfig.estadoActual} | EVA ${examState.retestConfig.dolorPost || '?'} | RPE ${examState.retestConfig.rpePost || '?'}]`;
        }
        if (examState.retestConfig.comentario) d += ` (${examState.retestConfig.comentario})`;
        
        hallazgosGeneral.push(d);
        if (examState.retestConfig.estadoActual === 'Igual' || examState.retestConfig.estadoActual === 'Peor') {
            summary.signos_concordantes.push(`Retest Fallido: ${d}`);
        } else if (examState.retestConfig.estadoActual === 'Mejor') {
            summary.signos_discordantes.push(`Retest Exitoso (Signo que cambia): ${d}`);
        }
    }

    // Hipótesis Final
    if (examState.hipotesis_tracking) {
        const activas = Object.entries(examState.hipotesis_tracking)
            .filter(([_, data]: [string, any]) => data.estado === 'gana_fuerza' || data.estado === 'se_mantiene')
            .map(([title, data]: [string, any]) => `[${data.estado.toUpperCase()}] ${title}: ${data.comentario || 'Sin comentario de contraste'}`);
            
        if (activas.length > 0) {
            hallazgosGeneral.push(`Hipótesis Principal Mantenida/Reforzada: ${activas[0]}`);
        }
    }

    const textBlobs: string[] = [];
    if (hallazgosGeneral.length > 0) {
        textBlobs.push("### Hallazgos Positivos Generales\n" + hallazgosGeneral.map(h => `- ${h}`).join('\n'));
    }
    if (summary.patron_movilidad) {
        textBlobs.push(`### Patrón de Movilidad (ROM)\n${summary.patron_movilidad}`);
    }
    if (summary.patron_fuerza_control) {
        textBlobs.push(`### Fuerza y Control Motor\n${summary.patron_fuerza_control}`);
    }
    if (summary.irritabilidad_tisular) {
        textBlobs.push(`### Irritabilidad y Palpación\n${summary.irritabilidad_tisular}`);
    }
    if (summary.signos_concordantes.length > 0) {
        textBlobs.push("### 🔥 Signos Concordantes (Dolor Principal)\n" + summary.signos_concordantes.map((s: string) => `- ${s}`).join('\n'));
    }
    if (summary.signos_discordantes.length > 0) {
        textBlobs.push("### ❄️ Signos Discordantes (No reproducen síntoma)\n" + summary.signos_discordantes.map((s: string) => `- ${s}`).join('\n'));
    }

    summary.resumen_hallazgos_positivos = hallazgosGeneral.join('\n');
    summary.summary_text_structured = textBlobs.join('\n\n') || "Examen físico sin hallazgos registrados.";

    return summary;
}
