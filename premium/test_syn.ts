import { autoSynthesizeFindings } from './src/lib/auto-engine';

const interview = {
    v4: {
        focos: [{
            region: 'Rodilla',
            lado: 'Derecha',
            sintomasTags: ['Dolor punzante', 'Inestabilidad'],
            dolorActual: 4,
            peor24h: 6,
            provocationEase: 'Alta',
            afterEffectFreq: 'Siempre',
            settlingTime: '>24 h',
            primaryComparable: { name: 'Sentadilla' }
        }]
    }
};

const exam = {
    retestGesture: 'Sentadilla',
    observacionInicialConfig: {
        posturaChips: ['Asimetría evidente', 'Alineación alterada'],
        marchaChips: ['Marcha antálgica', 'Cojera']
    },
    romAnaliticoConfig: {
        filas: [
            { region: 'Rodilla', movimiento: 'Flexión', tipoEval: 'unilateral', ladoUnilateral: 'Derecha', resAct: 'Dolorosa', resPas: 'Normal', grados: 90, usaGoniometro: true, dolorActivo: true, dolorPasivo: false, calidadMovimiento: 'Compensada' },
            { region: 'Cadera', movimiento: 'Extensión', tipoEval: 'axial', resAct: '-', resPas: '-', grados: null }
        ]
    },
    fuerzaCargaConfig: {
        filas: [
            { tipoEvaluacion: 'Fuerza Muscular Manual (Maddox/Daniel\'s)', region: 'Cuádriceps', lado: 'Derecho', resultado: '3/5', dolorDurante: 'Moderado', dolorPosterior: 'Leve', observacionExtra: 'Con compensaciones' }
        ]
    },
    palpacionConfig: {
        filas: [
            { estructura: 'Tendón Rotuliano', lado: 'Derecho', hallazgoPrincipal: 'Engrosamiento', dolor: 'Exquisito', temperatura: 'Aumentada', observacion: 'Sospecha reactiva' },
             { estructura: 'Ligamento Cruzado', lado: '-', dolor: '-', hallazgoPrincipal: '' }
        ]
    },
    retestConfig: {
        tareaIndice: 'Sentadilla',
        intervencion: 'Mulligan sostenido',
        resultadoPost: 'Empeora',
        comentario: 'No tolera la carga'
    }
};

const res = autoSynthesizeFindings(exam, interview as any);

console.log("--------------- SHORT SYNT ---------------");
console.log(res.physicalSynthesis?.summary_text_short);
console.log("\n--------------- STRUCTURED SYNT ---------------");
console.log(res.physicalSynthesis?.summary_text_structured);

