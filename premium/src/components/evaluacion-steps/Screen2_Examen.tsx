import React from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { autoSynthesizeFindings } from "@/lib/auto-engine";

export interface Screen2Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
    onNext?: () => void;
}

export function Screen2_Examen({ formData, updateFormData, isClosed, onNext }: Screen2Props) {
    const exam = (formData.guidedExam as any) || {};

    const v4 = formData.interview?.v4;
    const focoPrincipal = v4?.focos?.find(f => f.esPrincipal) || v4?.focos?.[0];
    const lado = focoPrincipal?.lado || "No definido";
    const queja = v4?.experienciaPersona?.prioridadPrincipal || "No definida";
    const irritabilidad = focoPrincipal?.irritabilidadAuto?.nivel || "No definido";
    const alertasActivas = [
        v4?.seguridad?.fiebre_sistemico_cancerPrevio && "Fiebre/Sistémico/Cáncer",
        v4?.seguridad?.bajaPeso_noIntencionada && "Baja de peso",
        v4?.seguridad?.dolorNocturno_inexplicable_noMecanico && "Dolor nocturno no mecánico",
        v4?.seguridad?.trauma_altaEnergia_caidaImportante && "Trauma alta energía",
        v4?.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar && "Neuro grave/Esfínteres",
        v4?.seguridad?.sospechaFractura_incapacidadCarga && "Sospecha fractura/Incapacidad carga"
    ].filter(Boolean).join(", ");
    const alertas = alertasActivas || "Ninguna alerta roja detectada";

    const sugerenciaNeuro = React.useMemo(() => {
        const porFocos = v4?.focos?.some(f =>
            (f.sintomasNeurologicos?.activados && f.sintomasNeurologicos.activados.length > 0) ||
            ["Regional", "Distal", "Radicular", "Referido"].includes(f.irradiacion as string)
        ) || false;

        const porQuejas = v4?.experienciaPersona?.quejas?.some(q =>
            /irradiaci|hormigue|adormeci|debilid|trauma/i.test(q)
        ) || false;

        const porSeguridad = v4?.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar || false;

        return porFocos || porQuejas || porSeguridad;
    }, [v4]);

    const [isNeuroOpen, setIsNeuroOpen] = React.useState(sugerenciaNeuro);
    const [isKOpen, setIsKOpen] = React.useState(false);

    const handleUpdateExam = (field: string, value: any) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, [field]: value }
        }));
    };

    const blocks = [
        { id: 'retest', icon: '🔄', theme: 'fuchsia', title: 'J. Re-test y cierre del examen físico', sub: 'Cambio post intervenciones de prueba (Signo comparable)', placeholder: 'Re-test de dolor a flexión disminuye de 7/10 a 3/10 tras modificación escapular...' },
        { id: 'complementary', icon: '🩻', theme: 'slate', title: 'K. Medidas complementarias (opcional)', sub: 'Imágenes traídas, exámenes de laboratorio o derivaciones', placeholder: 'Resonancia (05/03/2026) muestra tendinopatía supraespinoso sin rotura...' },
    ];

    const getThemeClasses = (theme: string) => {
        const themes: Record<string, { bg: string, text: string, border: string, focus: string }> = {
            slate: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', focus: 'focus:border-slate-400' },
            indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-900', border: 'border-indigo-100', focus: 'focus:border-indigo-400' },
            emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-900', border: 'border-emerald-100', focus: 'focus:border-emerald-400' },
            amber: { bg: 'bg-amber-50/50', text: 'text-amber-900', border: 'border-amber-100', focus: 'focus:border-amber-400' },
            rose: { bg: 'bg-rose-50/50', text: 'text-rose-900', border: 'border-rose-100', focus: 'focus:border-rose-400' },
            teal: { bg: 'bg-teal-50/50', text: 'text-teal-900', border: 'border-teal-100', focus: 'focus:border-teal-400' },
            sky: { bg: 'bg-sky-50/50', text: 'text-sky-900', border: 'border-sky-100', focus: 'focus:border-sky-400' },
            orange: { bg: 'bg-orange-50/50', text: 'text-orange-900', border: 'border-orange-100', focus: 'focus:border-orange-400' },
            fuchsia: { bg: 'bg-fuchsia-100/30', text: 'text-fuchsia-900', border: 'border-fuchsia-200', focus: 'focus:border-fuchsia-400' },
        };
        return themes[theme] || themes.slate;
    };

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* A. ENCABEZADO Y CONTEXTO HEREDADO */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">A. Inicio del examen físico</h2>
                            <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors" title="Usa esta franja para definir qué vas a re-evaluar al final del examen. No diagnostica. Solo orienta el examen físico de hoy.">
                                ?
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Contexto clínico heredado desde la Anamnesis (P1).</p>
                    </div>
                    <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full font-bold text-xl">
                        🩺
                    </div>
                </div>

                {/* Info heredada de P1 (Sólo Lectura) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Foco Principal</p>
                        <p className="text-sm font-medium text-slate-700">{focoPrincipal ? `Foco ${v4?.focos?.indexOf(focoPrincipal)! + 1}` : 'No definido'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lado</p>
                        <p className="text-sm font-medium text-slate-700">{lado}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Irritabilidad</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            {irritabilidad === "Alta" && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                            {irritabilidad === "Media" && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                            {irritabilidad === "Baja" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                            {irritabilidad}
                        </p>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Queja Prioritaria</p>
                        <p className="text-sm font-medium text-slate-700">{queja}</p>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Alertas Clínicas (Red Flags)</p>
                        <p className={`text-sm font-medium ${alertasActivas ? 'text-red-600' : 'text-slate-600'}`}>{alertas}</p>
                    </div>
                </div>

                {/* Inputs de Configuración de Examen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Modalidad de examen hoy
                        </label>
                        <select
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            value={exam.examModality || ''}
                            onChange={(e) => handleUpdateExam('examModality', e.target.value)}
                            disabled={isClosed}
                        >
                            <option value="">Selecciona modalidad...</option>
                            <option value="Completo">Completo</option>
                            <option value="Modificado por dolor/irritabilidad">Modificado por dolor/irritabilidad</option>
                            <option value="Muy acotado por seguridad/tolerancia">Muy acotado por seguridad/tolerancia</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Tarea o gesto índice para re-test
                        </label>
                        <input
                            type="text"
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="Ej. sentadilla, levantar brazo, cambio de dirección..."
                            value={exam.retestGesture || ''}
                            onChange={(e) => handleUpdateExam('retestGesture', e.target.value)}
                            disabled={isClosed}
                        />
                    </div>
                </div>
            </div>

            {/* B. BLOQUE ESTRUCTURADO OBSERVACIÓN Y MOVIMIENTO INICIAL */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-slate-50 p-4 flex justify-between items-start border-b border-slate-200">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">👀</span> B. Observación y movimiento inicial
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-slate-600">
                            Evaluación observacional estructurada
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-300 bg-white text-slate-600 opacity-60 hover:opacity-100 transition-opacity" title="Abre el examen mirando al paciente en general.&#13;&#10;Registra solo lo que aporta al caso clínicamente.&#13;&#10;Usa textos breves, evita sobreescribir.">
                        ?
                    </button>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-5 bg-white">
                    {irritabilidad === "Alta" && (
                        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                            <span className="text-lg">⚠️</span> Prefiere observación, movimiento dosificado y evita sobreprovocar al inicio debido a irritabilidad alta heredada.
                        </div>
                    )}

                    <div className="grid grid-cols-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-4">
                        {/* 1. Observación general */}
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">1. Observación general</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Estado general, trofismo, asimetrías evidentes.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Hallazgos que apoyen la hipótesis.</p>
                            </div>
                            <textarea
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[60px] resize-y"
                                placeholder="Ej. Atrofia evidente vasto medial derecho..."
                                value={exam.observationGeneral || ''}
                                onChange={(e) => handleUpdateExam('observationGeneral', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 2. Postura */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">2. Postura / alineación</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Posición estática si aporta al problema.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: "Sin hallazgos" o asimetrías clave.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Hombro adelantado y levemente elevado..."
                                value={exam.postureAlignment || ''}
                                onChange={(e) => handleUpdateExam('postureAlignment', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 3. Marcha genérica */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">3. Marcha o gesto habitual</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Cojera, fases de marcha o patrón base.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Desviaciones compensatorias.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Marcha antálgica con acortamiento fase de apoyo..."
                                value={exam.gaitBasicGesture || ''}
                                onChange={(e) => handleUpdateExam('gaitBasicGesture', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 4 y 5. Movimiento Activo Inicial */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">4. Mov. activo inicial</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Primer movimiento exploratorio libre del paciente.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Grado visual y calidad.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Logra elevar brazo activo solo hasta 90°..."
                                value={exam.initialActiveMovement || ''}
                                onChange={(e) => handleUpdateExam('initialActiveMovement', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">5. Conducta del síntoma</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Qué le pasa al dolor durante el gesto inicial.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: "Duele al final", "Arco doloroso", etc.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Pinchazo agudo al llegar a los 90° (Arco doloroso)..."
                                value={exam.symptomBehaviorMovement || ''}
                                onChange={(e) => handleUpdateExam('symptomBehaviorMovement', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* C. RANGO DE MOVIMIENTO ANALÍTICO */}
            <div className="bg-white border text-sm border-indigo-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-indigo-50/50 p-4 flex justify-between items-start border-b border-indigo-200">
                    <div>
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">📐</span> C. Rango de movimiento analítico
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-indigo-900">
                            Movilidad activa, pasiva y end-feel
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-500 opacity-60 hover:opacity-100 transition-opacity" title="📝 Partir por exploración activa.\n👉 Pasar a pasiva si aporta o hay déficit activo.\n📐 Usar goniómetro solo si el número es relevante (ej. post-op).\n🆚 Comparar lado sano y anotar calidad del movimiento (temblor, trinquete, vacilación).">
                        ?
                    </button>
                </div>

                <div className="p-0 overflow-x-auto bg-slate-50/30">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-indigo-50/40 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 w-40 max-w-[12rem]">Articulación / Lado</th>
                                <th className="p-3 w-40 max-w-[12rem]">Movimiento</th>
                                <th className="p-3 text-center w-28">¿Activo?</th>
                                <th className="p-3 w-48">Resultado ACT</th>
                                <th className="p-3 text-center w-28">¿Pasivo?</th>
                                <th className="p-3 w-48">Resultado PAS / Tope</th>
                                <th className="p-3 w-40">EVA / Ángulo</th>
                                <th className="p-3">Calidad / Hallazgo</th>
                                <th className="p-3 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.romAnaliticoConfig?.filas || exam.romAnaliticoConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400 italic font-medium text-sm">
                                        No hay movimientos ingresados. Presiona "+ Añadir Movimiento" para comenzar.
                                    </td>
                                </tr>
                            )}
                            {(exam.romAnaliticoConfig?.filas || []).map((fila: any, i: number) => {
                                // Lógica de Orientación Clínica Inteligente
                                let orientacionClinica = "";
                                if (fila.evalAct && fila.evalPas) {
                                    const actInt = fila.resAct === 'Completo doloroso' || fila.resAct === 'Incompleto doloroso' ? 'dolor' : (fila.resAct === 'Incompleto no doloroso' ? 'deficit' : 'ok');
                                    const actNum = fila.resAct?.includes('Incompleto') ? 0 : 1;
                                    const pasNum = fila.resPas?.includes('Incompleto') ? 0 : 1;

                                    if (actNum === 0 && pasNum === 1) { // Activo incompleto, Pasivo completo
                                        orientacionClinica = "Orientación: podría haber influencia de dolor, inhibición o componente contráctil. Interpretar con fuerza y control motor.";
                                    } else if (actNum === 0 && pasNum === 0) { // Ambos incompletos
                                        orientacionClinica = "Orientación: la limitación compartida sugiere revisar movilidad articular/tejidos no contráctiles dentro del cuadro completo.";
                                    } else if (actNum === 1 && fila.resPas === 'Completo doloroso') { // Activo y pasivo completos, pero pasivo duele
                                        orientacionClinica = "Orientación: revisar irritabilidad, sobrepresión o sensibilidad mecánica.";
                                    } else if (fila.resAct === 'Completo doloroso' || fila.resAct === 'Incompleto doloroso') {
                                        // Doloroso pero llegó, ya no evalúa rango funcional puro que es difuso en estos strings pero aplica la logica de dolor de movimiento
                                        orientacionClinica = "Orientación: registrar dolor de movimiento, no asumir déficit biológico de movilidad por sí solo.";
                                    }
                                }

                                const handleFilaChange = (campo: string, valor: any) => {
                                    const nuevasFilas = [...exam.romAnaliticoConfig.filas];
                                    nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };

                                    // Limpiezas automáticas si se desactiva
                                    if (campo === 'evalAct' && !valor) nuevasFilas[i].resAct = '';
                                    if (campo === 'evalPas' && !valor) {
                                        nuevasFilas[i].resPas = '';
                                        nuevasFilas[i].topeFinal = '';
                                    }
                                    if (campo === 'usaGoniometro' && !valor) nuevasFilas[i].grados = '';

                                    handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                                };

                                return (
                                    <React.Fragment key={fila.id}>
                                        <tr className="bg-white hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                    placeholder="Ej. Hombro"
                                                    value={fila.region}
                                                    onChange={(e) => handleFilaChange('region', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    value={fila.lado}
                                                    onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="Derecho">Derecho</option>
                                                    <option value="Izquierdo">Izquierdo</option>
                                                    <option value="Bilateral">Bilateral</option>
                                                    <option value="Axial">Axial</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="Ej. Flexión"
                                                    value={fila.movimiento}
                                                    onChange={(e) => handleFilaChange('movimiento', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                            </td>
                                            <td className="p-3 align-top text-center">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalAct} onChange={(e) => handleFilaChange('evalAct', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                                    value={fila.resAct}
                                                    onChange={(e) => handleFilaChange('resAct', e.target.value)}
                                                    disabled={isClosed || !fila.evalAct}
                                                >
                                                    <option value="">-- Resultado Activo --</option>
                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top text-center border-l border-slate-100">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalPas} onChange={(e) => handleFilaChange('evalPas', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-400"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 mb-2"
                                                    value={fila.resPas}
                                                    onChange={(e) => handleFilaChange('resPas', e.target.value)}
                                                    disabled={isClosed || !fila.evalPas}
                                                >
                                                    <option value="">-- Resultado Pasivo --</option>
                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                </select>
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                                    value={fila.topeFinal}
                                                    onChange={(e) => handleFilaChange('topeFinal', e.target.value)}
                                                    disabled={isClosed || !fila.evalPas}
                                                >
                                                    <option value="">-- Tope Final --</option>
                                                    <option value="No evaluado">No evaluado</option>
                                                    <option value="Blando">Blando (Aproximación tej.)</option>
                                                    <option value="Firme">Firme (Cápsula/Lig.)</option>
                                                    <option value="Duro">Duro (Hueso-Hueso)</option>
                                                    <option value="Vacío">Vacío (Dolor excesivo)</option>
                                                    <option value="Espástico">Espástico (Resorte)</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">EVA</span>
                                                    <input
                                                        type="number"
                                                        min="0" max="10"
                                                        className="w-16 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                        placeholder="0-10"
                                                        value={fila.eva}
                                                        onChange={(e) => handleFilaChange('eva', e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" className="rounded text-indigo-500 w-3 h-3 border-slate-300" checked={fila.usaGoniometro} onChange={(e) => handleFilaChange('usaGoniometro', e.target.checked)} disabled={isClosed} />
                                                        <span className="text-[10px] uppercase font-bold text-slate-400">Gon.</span>
                                                    </label>
                                                    {fila.usaGoniometro && (
                                                        <input
                                                            type="text"
                                                            className="w-16 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                            placeholder="Grados°"
                                                            value={fila.grados}
                                                            onChange={(e) => handleFilaChange('grados', e.target.value)}
                                                            disabled={isClosed}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                    placeholder="Calidad/Compensación (ej. temblor)"
                                                    value={fila.calidad}
                                                    onChange={(e) => handleFilaChange('calidad', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="Hallazgo breve"
                                                    value={fila.hallazgo}
                                                    onChange={(e) => handleFilaChange('hallazgo', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                            </td>
                                            <td className="p-3 align-top text-center border-l border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        const nuevasFilas = exam.romAnaliticoConfig.filas.filter((_: any, idx: number) => idx !== i);
                                                        handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                                                    }}
                                                    disabled={isClosed}
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 mt-2 mx-auto disabled:opacity-0"
                                                    title="Eliminar fila"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                        {orientacionClinica && (
                                            <tr className="bg-indigo-50/20 border-b border-indigo-100">
                                                <td colSpan={9} className="p-3">
                                                    <div className="flex gap-2 items-start text-xs text-indigo-800 font-medium">
                                                        <span className="text-sm mt-[-2px]">💡</span>
                                                        <p>{orientacionClinica}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <button
                        onClick={() => {
                            const configBase = exam.romAnaliticoConfig || { filas: [], configTejidos: { mostrar: false, filas: [] } };
                            const nuevaFila = {
                                id: Date.now().toString(), region: '', lado: 'Derecho', movimiento: '',
                                evalAct: true, evalPas: false, resAct: '', resPas: '', topeFinal: '',
                                eva: '', usaGoniometro: false, grados: '', calidad: '', hallazgo: ''
                            };
                            handleUpdateExam('romAnaliticoConfig', { ...configBase, filas: [...configBase.filas, nuevaFila] });
                        }}
                        disabled={isClosed}
                        className="text-sm font-bold text-indigo-600 bg-white border border-indigo-200 px-4 py-2 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <span>+</span> Añadir Movimiento
                    </button>

                    {!exam.romAnaliticoConfig?.configTejidos?.mostrar && (
                        <button
                            onClick={() => {
                                const configBase = exam.romAnaliticoConfig || { filas: [] };
                                handleUpdateExam('romAnaliticoConfig', {
                                    ...configBase,
                                    configTejidos: { mostrar: true, filas: [] }
                                });
                            }}
                            disabled={isClosed}
                            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors underline underline-offset-2"
                        >
                            + Añadir análisis específico de tejido (Opcional)
                        </button>
                    )}
                </div>

                {/* Submódulo opcional de Tejidos */}
                {exam.romAnaliticoConfig?.configTejidos?.mostrar && (
                    <div className="border-t-2 border-dashed border-indigo-100 bg-indigo-50/20 p-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                🧬 Movilidad / longitud de tejidos (Submódulo)
                            </h4>
                            <button
                                onClick={() => {
                                    const configBase = exam.romAnaliticoConfig || { filas: [] };
                                    handleUpdateExam('romAnaliticoConfig', {
                                        ...configBase,
                                        configTejidos: { mostrar: false, filas: [] }
                                    });
                                }}
                                disabled={isClosed}
                                className="text-[10px] text-red-500 uppercase font-bold tracking-widest hover:bg-red-50 px-2 py-1 rounded"
                            >
                                Quitar módulo
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-white shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-indigo-50 text-[10px] uppercase text-indigo-500 font-bold">
                                        <th className="p-3">Tejido / Músculo / Cadena</th>
                                        <th className="p-3">Lado</th>
                                        <th className="p-3">Prueba Usada</th>
                                        <th className="p-3">Resultado</th>
                                        <th className="p-3">Comentario Breve</th>
                                        <th className="p-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50">
                                    {(exam.romAnaliticoConfig.configTejidos.filas || []).map((tejido: any, i: number) => {
                                        const handleTejidoChange = (campo: string, valor: string) => {
                                            const nuevasFilas = [...exam.romAnaliticoConfig.configTejidos.filas];
                                            nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };
                                            handleUpdateExam('romAnaliticoConfig', {
                                                ...exam.romAnaliticoConfig,
                                                configTejidos: { ...exam.romAnaliticoConfig.configTejidos, filas: nuevasFilas }
                                            });
                                        };
                                        return (
                                            <tr key={tejido.id} className="hover:bg-slate-50 group">
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Isquiosurales" value={tejido.nombre} onChange={(e) => handleTejidoChange('nombre', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" value={tejido.lado} onChange={(e) => handleTejidoChange('lado', e.target.value)} disabled={isClosed}>
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Elevación pierna recta (SLR)" value={tejido.prueba} onChange={(e) => handleTejidoChange('prueba', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" value={tejido.resultado} onChange={(e) => handleTejidoChange('resultado', e.target.value)} disabled={isClosed}>
                                                        <option value="">-- Seleccionar --</option>
                                                        <option value="Normal">Normal</option>
                                                        <option value="Acortado">Acortado / Restringido</option>
                                                        <option value="Hiperlaxo">Hiperlaxo / Excesivo</option>
                                                        <option value="Doloroso sin restricción">Doloroso (sin restricción térmica)</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Dolor ciático a 40°..." value={tejido.comentario} onChange={(e) => handleTejidoChange('comentario', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => {
                                                        const nuevasFilas = exam.romAnaliticoConfig.configTejidos.filas.filter((_: any, idx: number) => idx !== i);
                                                        handleUpdateExam('romAnaliticoConfig', {
                                                            ...exam.romAnaliticoConfig,
                                                            configTejidos: { ...exam.romAnaliticoConfig.configTejidos, filas: nuevasFilas }
                                                        });
                                                    }} disabled={isClosed} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Borrar">
                                                        ✖
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            <div className="p-3 bg-slate-50 border-t border-indigo-50">
                                <button
                                    onClick={() => {
                                        const configBase = exam.romAnaliticoConfig;
                                        const nuevaFila = { id: Date.now().toString(), nombre: '', lado: 'Derecho', prueba: '', resultado: '', comentario: '' };
                                        handleUpdateExam('romAnaliticoConfig', {
                                            ...configBase,
                                            configTejidos: { ...configBase.configTejidos, filas: [...configBase.configTejidos.filas, nuevaFila] }
                                        });
                                    }}
                                    disabled={isClosed}
                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                >
                                    + Añadir tejido
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* D. FUERZA Y TOLERANCIA A CARGA */}
            <div className="bg-white border text-sm border-emerald-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-emerald-50/50 p-4 flex justify-between items-start border-b border-emerald-200">
                    <div>
                        <h3 className="font-bold text-emerald-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">🦾</span> D. Fuerza y tolerancia a carga
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-emerald-900">
                            Pruebas manuales, isometría, dinamometría o tests funcionales
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-emerald-200 bg-white text-emerald-600 opacity-60 hover:opacity-100 transition-opacity" title="📝 Fuerza no es solo MMT (1-5). Selecciona el tipo de evaluación adecuado según los recursos disponibles (ej. dinamómetro), la irritabilidad del paciente y el objetivo clínico de la fase actual.">
                        ?
                    </button>
                </div>

                {irritabilidad === "Alta" && (
                    <div className="bg-red-50 border-b border-red-100 p-3 text-red-700 text-xs font-medium flex items-center gap-2">
                        <span className="text-sm">⚠️</span>
                        <span>Orientación: Prioriza carga dosificada y evita máximos si no son necesarios debido a la irritabilidad actual.</span>
                    </div>
                )}

                <div className="p-0 overflow-x-auto bg-slate-50/30">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-emerald-50/40 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 w-40">Región / Patrón</th>
                                <th className="p-3 w-28">Lado</th>
                                <th className="p-3 w-40">Tipo Evaluación</th>
                                <th className="p-3 min-w-[200px]">Resultado Principal</th>
                                <th className="p-3 w-32">Dolor (Durante/Post)</th>
                                <th className="p-3 w-36">Calidad / Comparación</th>
                                <th className="p-3 w-40">Obs. Breve</th>
                                <th className="p-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.fuerzaCargaConfig?.filas || exam.fuerzaCargaConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium text-sm border-b border-transparent">
                                        No hay pruebas de fuerza ingresadas. Presiona "+ Añadir Prueba" para comenzar.
                                    </td>
                                </tr>
                            )}
                            {(exam.fuerzaCargaConfig?.filas || []).map((fila: any, i: number) => {
                                const handleFilaChange = (campo: string, valor: any) => {
                                    const nuevasFilas = [...exam.fuerzaCargaConfig.filas];

                                    // Limpieza condicional
                                    if (campo === 'tipoEvaluacion' && fila.tipoEvaluacion !== valor) {
                                        nuevasFilas[i].resultado = '';
                                        nuevasFilas[i].dinamometriaValor = '';
                                        nuevasFilas[i].dinamometriaUnidad = 'Kg';
                                        nuevasFilas[i].isometriaSegundos = '';
                                        nuevasFilas[i].repeticionesN = '';
                                        nuevasFilas[i].repeticionesCorte = '';
                                        nuevasFilas[i].testFuncionalNombre = '';
                                    }

                                    nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };
                                    handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                };

                                return (
                                    <tr key={fila.id} className="bg-white hover:bg-emerald-50/30 transition-colors group">
                                        <td className="p-3 align-top">
                                            <input
                                                type="text"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                placeholder="Ej. Cuádriceps / Push up"
                                                value={fila.region}
                                                onChange={(e) => handleFilaChange('region', e.target.value)}
                                                disabled={isClosed}
                                            />
                                        </td>
                                        <td className="p-3 align-top">
                                            <select
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                value={fila.lado}
                                                onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="Derecho">Derecho</option>
                                                <option value="Izquierdo">Izquierdo</option>
                                                <option value="Bilateral">Bilateral</option>
                                                <option value="Axial">Axial</option>
                                            </select>
                                        </td>
                                        <td className="p-3 align-top">
                                            <select
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-medium text-emerald-700"
                                                value={fila.tipoEvaluacion}
                                                onChange={(e) => handleFilaChange('tipoEvaluacion', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                <option value="Manual">Manual (MMT)</option>
                                                <option value="Dinamometría">Dinamometría</option>
                                                <option value="Isometría mantenida">Isometría mantenida</option>
                                                <option value="Repeticiones submáximas">Reps submáximas</option>
                                                <option value="Test funcional de carga">Test Func. Carga</option>
                                            </select>
                                        </td>
                                        <td className="p-3 align-top bg-slate-50/50 border-x border-slate-100">
                                            {/* Renders Condicionales para Resultado */}
                                            {!fila.tipoEvaluacion && (
                                                <span className="text-xs text-slate-400 italic">Selecciona un tipo.</span>
                                            )}
                                            {fila.tipoEvaluacion === 'Manual' && (
                                                <select
                                                    className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                    value={fila.resultado}
                                                    onChange={(e) => handleFilaChange('resultado', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="">-- Escala MRC --</option>
                                                    <option value="5 Normal">5 - Normal (Vence resistencia máxima)</option>
                                                    <option value="4 Buena">4 - Buena (Vence resistencia moderada)</option>
                                                    <option value="3 Regular">3 - Regular (Vence gravedad)</option>
                                                    <option value="2 Deficiente">2 - Deficiente (Movimiento en plano sin gravedad)</option>
                                                    <option value="1 Vestigio">1 - Vestigio (Contracción palpable sin movimiento)</option>
                                                    <option value="0 Nula">0 - Nula (Sin contracción)</option>
                                                </select>
                                            )}
                                            {fila.tipoEvaluacion === 'Dinamometría' && (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number" step="0.1" placeholder="Valor"
                                                        className="w-20 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.dinamometriaValor || ''} onChange={(e) => handleFilaChange('dinamometriaValor', e.target.value)} disabled={isClosed}
                                                    />
                                                    <select
                                                        className="w-16 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.dinamometriaUnidad || 'Kg'} onChange={(e) => handleFilaChange('dinamometriaUnidad', e.target.value)} disabled={isClosed}
                                                    >
                                                        <option value="Kg">Kg</option>
                                                        <option value="N">N</option>
                                                        <option value="Lbs">Lbs</option>
                                                    </select>
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Isometría mantenida' && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number" placeholder="Tiempo"
                                                        className="w-20 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.isometriaSegundos || ''} onChange={(e) => handleFilaChange('isometriaSegundos', e.target.value)} disabled={isClosed}
                                                    />
                                                    <span className="text-xs text-slate-500 font-medium">segundos</span>
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Repeticiones submáximas' && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number" placeholder="Cant."
                                                            className="w-16 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                            value={fila.repeticionesN || ''} onChange={(e) => handleFilaChange('repeticionesN', e.target.value)} disabled={isClosed}
                                                        />
                                                        <span className="text-xs text-slate-500">reps max</span>
                                                    </div>
                                                    <input
                                                        type="text" placeholder="Ej. Corte por pérdida técnica..."
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.repeticionesCorte || ''} onChange={(e) => handleFilaChange('repeticionesCorte', e.target.value)} disabled={isClosed}
                                                    />
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Test funcional de carga' && (
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        type="text" placeholder="Nombre Test (ej. Heel raise)"
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400 font-medium"
                                                        value={fila.testFuncionalNombre || ''} onChange={(e) => handleFilaChange('testFuncionalNombre', e.target.value)} disabled={isClosed}
                                                    />
                                                    <input
                                                        type="text" placeholder="Resultado / Criterio obs."
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.resultado || ''} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.dolorDurante} onChange={(e) => handleFilaChange('dolorDurante', e.target.value)} disabled={isClosed}
                                                    title="Dolor durante la prueba"
                                                >
                                                    <option value="">-- Durante --</option>
                                                    <option value="No">No duele</option>
                                                    <option value="Leve">S/S Leve</option>
                                                    <option value="Moderado">S/S Moderado</option>
                                                    <option value="Alto">S/S Alto</option>
                                                </select>
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.dolorPosterior} onChange={(e) => handleFilaChange('dolorPosterior', e.target.value)} disabled={isClosed}
                                                    title="Dolor posterior a la prueba"
                                                >
                                                    <option value="">-- Posterior --</option>
                                                    <option value="No">No repercute</option>
                                                    <option value="Sí breve">Repercusión Breve</option>
                                                    <option value="Sí persistente">Repercusión Persistente</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.calidadEsfuerzo} onChange={(e) => handleFilaChange('calidadEsfuerzo', e.target.value)} disabled={isClosed}
                                                    title="Calidad del esfuerzo"
                                                >
                                                    <option value="">-- Calidad --</option>
                                                    <option value="Buena">Buena contracción</option>
                                                    <option value="Compensa">Patrón Compensatorio</option>
                                                    <option value="Inhibido por dolor">Inhibición por Dolor</option>
                                                    <option value="Duda / inconsistente">Dudosa / Inconsistente</option>
                                                </select>
                                                <select
                                                    className="w-full text-[11px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.comparacion} onChange={(e) => handleFilaChange('comparacion', e.target.value)} disabled={isClosed}
                                                    title="Comparación contralateral"
                                                >
                                                    <option value="">-- Vs Contralateral --</option>
                                                    <option value="Similar">Similar (±10%)</option>
                                                    <option value="Menor">Menor (10-30% déficit)</option>
                                                    <option value="Mucho menor">Mucho menor (&gt;30%)</option>
                                                    <option value="No comparable">Lado sano afectado / NA</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <textarea
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 min-h-[65px] resize-y"
                                                placeholder="Observación breve..."
                                                value={fila.observacion}
                                                onChange={(e) => handleFilaChange('observacion', e.target.value)}
                                                disabled={isClosed}
                                            />
                                        </td>
                                        <td className="p-3 align-top text-center border-l border-slate-100">
                                            <button
                                                onClick={() => {
                                                    const nuevasFilas = exam.fuerzaCargaConfig.filas.filter((_: any, idx: number) => idx !== i);
                                                    handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                                }}
                                                disabled={isClosed}
                                                className="w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 mt-5 mx-auto disabled:opacity-0"
                                                title="Eliminar prueba"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200">
                    <button
                        onClick={() => {
                            const configBase = exam.fuerzaCargaConfig || { filas: [] };
                            const nuevaFila = {
                                id: Date.now().toString(), region: '', lado: 'Derecho', tipoEvaluacion: '',
                                dolorDurante: '', dolorPosterior: '', calidadEsfuerzo: '', comparacion: '', observacion: ''
                            };
                            handleUpdateExam('fuerzaCargaConfig', { ...configBase, filas: [...configBase.filas, nuevaFila] });
                        }}
                        disabled={isClosed}
                        className="text-sm font-bold text-emerald-600 bg-white border border-emerald-200 px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <span>+</span> Añadir Prueba de Fuerza/Carga
                    </button>
                </div>
            </div>

            {/* E. PALPACIÓN */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden flex flex-col">
                <div className="bg-amber-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🖐️</div>
                        <div>
                            <h3 className="font-bold text-amber-900 text-lg">E. Palpación</h3>
                            <p className="text-xs text-amber-700/80 mt-0.5">Temperatura, derrame, sensibilidad tisular</p>
                        </div>
                    </div>
                    <div className="text-xs bg-amber-100/50 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <span className="font-bold">💡</span> Úsala si agrega valor a tu hipótesis o al descarte.
                    </div>
                </div>

                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 pl-4">Estructura</th>
                                <th className="p-3 w-28">Lado</th>
                                <th className="p-3">Hallazgo ppal</th>
                                <th className="p-3 w-32">Dolor (0-10)</th>
                                <th className="p-3 w-32">Edema</th>
                                <th className="p-3 w-32">Temp.</th>
                                <th className="p-3">Obs</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(exam.palpacionConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.palpacionConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('palpacionConfig', { filas: m });
                                };
                                return (
                                    <tr key={fila.id} className="hover:bg-slate-50">
                                        <td className="p-2 pl-4"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.estructura} onChange={e => handleChange('estructura', e.target.value)} disabled={isClosed} placeholder="Ej. T. Rotuliano" /></td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.lado} onChange={e => handleChange('lado', e.target.value)} disabled={isClosed}>
                                                <option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option><option value="Bilateral">Bilateral</option>
                                            </select>
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.hallazgo} onChange={e => handleChange('hallazgo', e.target.value)} disabled={isClosed} placeholder="Tensión, gap..." /></td>
                                        <td className="p-2"><input type="number" min="0" max="10" className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.dolor} onChange={e => handleChange('dolor', e.target.value)} disabled={isClosed} placeholder="0-10" /></td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.edema} onChange={e => handleChange('edema', e.target.value)} disabled={isClosed}>
                                                <option value="No">No</option><option value="Leve">Leve</option><option value="Moderado">Moderado</option><option value="Severo">Severo</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.temperatura} onChange={e => handleChange('temperatura', e.target.value)} disabled={isClosed}>
                                                <option value="Normal">Normal</option><option value="Aumentada">Aumentada</option><option value="Disminuida">Disminuida</option>
                                            </select>
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.observacion} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed} placeholder="Breve nota" /></td>
                                        <td className="p-2 right-0">
                                            <button onClick={() => {
                                                const m = exam.palpacionConfig.filas.filter((_: any, index: number) => index !== i);
                                                handleUpdateExam('palpacionConfig', { filas: m });
                                            }} className="text-red-400 hover:text-red-600 p-1" disabled={isClosed}>✕</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 p-3 border-t border-slate-200">
                    <button onClick={() => {
                        const m = exam.palpacionConfig || { filas: [] };
                        handleUpdateExam('palpacionConfig', { filas: [...m.filas, { id: Date.now().toString(), estructura: '', lado: lado !== 'No definido' ? lado : 'Derecho', hallazgo: '', dolor: '', edema: 'No', temperatura: 'Normal', observacion: '' }] });
                    }} disabled={isClosed} className="text-xs font-bold text-amber-600 bg-white border border-amber-200 px-3 py-1.5 rounded shadow-sm hover:bg-amber-50">
                        + Añadir estructura
                    </button>
                </div>
            </div>

            {/* F. NEUROLÓGICO / VASCULAR */}
            <div className="bg-white rounded-2xl shadow-sm border border-rose-200 overflow-hidden flex flex-col">
                <div onClick={() => setIsNeuroOpen(!isNeuroOpen)} className="bg-rose-50/50 hover:bg-rose-100/50 cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl shrink-0">⚡</div>
                        <div>
                            <h3 className="font-bold text-rose-900 text-lg">F. Neurológico / vascular / somatosensorial</h3>
                            <p className="text-xs text-rose-700/80 mt-0.5">Dermatomas, reflejos, neurodinamia, pulsos, sensibilidad</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {sugerenciaNeuro && (
                            <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-1 rounded-full animate-pulse">Sugerido por P1</span>
                        )}
                        <span className="text-rose-400 text-sm font-bold">{isNeuroOpen ? '▲ Ocultar' : '▼ Expandir'}</span>
                    </div>
                </div>

                {isNeuroOpen && (
                    <div className="p-4 sm:p-6 flex flex-col gap-5 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {['Miotomas', 'Sensibilidad / Dermatomas', 'Reflejos (ROT)', 'Neurodinamia', 'Pulsos / Perfusión', 'Equilibrio / Propiocepción'].map((item) => {
                                const key = item.split(' ')[0].toLowerCase().replace('é', 'e');
                                const val = exam.neuroVascularConfig?.[key] || { evalua: false, hallazgo: '' };
                                return (
                                    <div key={item} className={`p-3 rounded-xl border transition-colors ${val.evalua ? 'border-rose-300 bg-rose-50/20' : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'}`}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <input type="checkbox" checked={val.evalua} className="rounded text-rose-500 w-4 h-4" disabled={isClosed} onChange={(e) => {
                                                const current = exam.neuroVascularConfig || {};
                                                handleUpdateExam('neuroVascularConfig', { ...current, [key]: { ...val, evalua: e.target.checked } });
                                            }} />
                                            <span className="text-sm font-bold text-slate-700">{item}</span>
                                        </div>
                                        {val.evalua && (
                                            <input type="text" className="w-full text-xs p-2 border border-rose-200 rounded outline-none focus:border-rose-400 mt-1" placeholder={`Resultados de ${item.toLowerCase()}...`} value={val.hallazgo} onChange={(e) => {
                                                const current = exam.neuroVascularConfig || {};
                                                handleUpdateExam('neuroVascularConfig', { ...current, [key]: { ...val, hallazgo: e.target.value } });
                                            }} disabled={isClosed} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <div className="mt-2">
                            <p className="text-xs font-bold text-slate-500 mb-1">Observación General Neuro/Vascular</p>
                            <textarea className="w-full text-sm p-3 border border-slate-200 rounded-xl outline-none focus:border-rose-400 min-h-[80px]" placeholder="Síntesis neurológica..." value={exam.neuroVascularConfig?.observacion || ''} onChange={(e) => handleUpdateExam('neuroVascularConfig', { ...exam.neuroVascularConfig, observacion: e.target.value })} disabled={isClosed} />
                        </div>
                    </div>
                )}
            </div>

            {/* G. CONTROL MOTOR Y ESTABILIDAD FUNCIONAL */}
            <div className="bg-white rounded-2xl shadow-sm border border-teal-200 overflow-hidden flex flex-col">
                <div className="bg-teal-50/50 p-4 sm:p-5 flex items-center gap-3 border-b border-teal-100">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-xl shrink-0">🧘</div>
                    <div>
                        <h3 className="font-bold text-teal-900 text-lg">G. Control motor y estabilidad funcional</h3>
                        <p className="text-xs text-teal-700/80 mt-0.5">Control segmentario, lumbopélvico, escapular, balance, gesto</p>
                    </div>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 pl-4 w-48">Región / Tarea</th>
                                <th className="p-3">Observación estructurada (Calidad, compensaciones)</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(exam.controlMotorConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.controlMotorConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('controlMotorConfig', { filas: m });
                                };
                                return (
                                    <tr key={fila.id} className="hover:bg-slate-50">
                                        <td className="p-2 pl-4">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.region} onChange={e => handleChange('region', e.target.value)} disabled={isClosed}>
                                                <option value="">Seleccione...</option>
                                                <option value="Control Segmentario Local">Control Segmentario Local</option>
                                                <option value="Estabilidad Lumbopélvica">Estabilidad Lumbopélvica</option>
                                                <option value="Estabilidad Escapular">Estabilidad Escapular</option>
                                                <option value="Balance / Postura">Balance / Postura</option>
                                                <option value="Desaceleración / Aterrizaje">Desaceleración / Aterrizaje</option>
                                                <option value="Control Unipodal">Control Unipodal</option>
                                                <option value="Control del Gesto Específico">Control del Gesto Específico</option>
                                            </select>
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.observacion} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed} placeholder="Ej. Valgo dinámico moderado en aterrizaje" /></td>
                                        <td className="p-2 right-0">
                                            <button onClick={() => {
                                                const m = exam.controlMotorConfig.filas.filter((_: any, index: number) => index !== i);
                                                handleUpdateExam('controlMotorConfig', { filas: m });
                                            }} className="text-red-400 hover:text-red-600 p-1" disabled={isClosed}>✕</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 p-3 border-t border-slate-200">
                    <button onClick={() => {
                        const m = exam.controlMotorConfig || { filas: [] };
                        handleUpdateExam('controlMotorConfig', { filas: [...m.filas, { id: Date.now().toString(), region: '', observacion: '' }] });
                    }} disabled={isClosed} className="text-xs font-bold text-teal-600 bg-white border border-teal-200 px-3 py-1.5 rounded shadow-sm hover:bg-teal-50">
                        + Añadir tarea motora
                    </button>
                </div>
            </div>

            {/* H. PRUEBAS ORTOPÉDICAS */}
            <div className="bg-white rounded-2xl shadow-sm border border-sky-200 overflow-hidden flex flex-col">
                <div className="bg-sky-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-xl shrink-0">🔨</div>
                        <div>
                            <h3 className="font-bold text-sky-900 text-lg">H. Pruebas ortopédicas</h3>
                            <p className="text-xs text-sky-700/80 mt-0.5">Tests provocativos o clústeres</p>
                        </div>
                    </div>
                    <div className="text-xs bg-sky-100/50 text-sky-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                        <span className="font-bold">⚠️</span> No usar aisladas para diagnosticar.
                    </div>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 pl-4">Nombre del Test / Clúster</th>
                                <th className="p-3 w-28">Lado</th>
                                <th className="p-3 w-32">Resultado</th>
                                <th className="p-3 w-32 text-center">Reproduce Síntoma</th>
                                <th className="p-3">Comentario</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(exam.ortopedicasConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.ortopedicasConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('ortopedicasConfig', { filas: m });
                                };
                                return (
                                    <tr key={fila.id} className="hover:bg-slate-50">
                                        <td className="p-2 pl-4"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.test} onChange={e => handleChange('test', e.target.value)} disabled={isClosed} placeholder="Ej. Neer" /></td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.lado} onChange={e => handleChange('lado', e.target.value)} disabled={isClosed}>
                                                <option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option><option value="Bilateral">Bilateral</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.resultado} onChange={e => handleChange('resultado', e.target.value)} disabled={isClosed}>
                                                <option value="">Seleccione...</option><option value="Positivo">Positivo (+)</option><option value="Negativo">Negativo (-)</option><option value="Equívoco">Equívoco</option><option value="No realizado">No realizado</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center">
                                            <input type="checkbox" checked={fila.reproduce} onChange={e => handleChange('reproduce', e.target.checked)} disabled={isClosed} className="rounded text-sky-500 w-4 h-4 cursor-pointer" />
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.comentario} onChange={e => handleChange('comentario', e.target.value)} disabled={isClosed} placeholder="Dolor agudo..." /></td>
                                        <td className="p-2 right-0">
                                            <button onClick={() => {
                                                const m = exam.ortopedicasConfig.filas.filter((_: any, index: number) => index !== i);
                                                handleUpdateExam('ortopedicasConfig', { filas: m });
                                            }} className="text-red-400 hover:text-red-600 p-1" disabled={isClosed}>✕</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 p-3 border-t border-slate-200">
                    <button onClick={() => {
                        const m = exam.ortopedicasConfig || { filas: [] };
                        handleUpdateExam('ortopedicasConfig', { filas: [...m.filas, { id: Date.now().toString(), test: '', lado: lado !== 'No definido' ? lado : 'Derecho', resultado: '', reproduce: false, comentario: '' }] });
                    }} disabled={isClosed} className="text-xs font-bold text-sky-600 bg-white border border-sky-200 px-3 py-1.5 rounded shadow-sm hover:bg-sky-50">
                        + Añadir test ortopédico
                    </button>
                </div>
            </div>

            {/* I. PRUEBAS FUNCIONALES Y REINTEGRO */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 overflow-hidden flex flex-col">
                <div className="bg-orange-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl shrink-0">🏃</div>
                        <div>
                            <h3 className="font-bold text-orange-900 text-lg">I. Pruebas funcionales y reintegro</h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-orange-700">Objetivo Principal:</span>
                        <select className="text-xs p-2 border border-orange-200 rounded-md bg-white text-orange-900 outline-none focus:border-orange-400"
                            value={exam.funcionalesConfig?.objetivo || ''}
                            onChange={e => handleUpdateExam('funcionalesConfig', { ...(exam.funcionalesConfig || {}), objetivo: e.target.value })}
                            disabled={isClosed}
                        >
                            <option value="">Selección general</option>
                            <option value="Vida diaria">Vida diaria</option>
                            <option value="Volver a entrenar">Volver a entrenar</option>
                            <option value="Volver a competir">Volver a competir</option>
                            <option value="Prevención / Carga">Prevención / Carga</option>
                        </select>
                    </div>
                </div>
                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 pl-4">Plantilla / Test</th>
                                <th className="p-3 w-28">Lado</th>
                                <th className="p-3 w-28">Resultado</th>
                                <th className="p-3 w-20">Dolor</th>
                                <th className="p-3 w-28">Calidad</th>
                                <th className="p-3">Obs / Tolerancia</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(exam.funcionalesConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.funcionalesConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('funcionalesConfig', { ...exam.funcionalesConfig, filas: m });
                                };
                                return (
                                    <tr key={fila.id} className="hover:bg-slate-50">
                                        <td className="p-2 pl-4">
                                            <input type="text" list={`func-list-${fila.id}`} className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.test} onChange={e => handleChange('test', e.target.value)} disabled={isClosed} placeholder="VD, Gym, Salto..." />
                                            <datalist id={`func-list-${fila.id}`}>
                                                <option value="Y-Balance Test" />
                                                <option value="Hop Test (Single)" />
                                                <option value="Hop Test (Triple)" />
                                                <option value="Change of Direction (COD)" />
                                                <option value="Sentadilla overhead" />
                                                <option value="Drop Jump" />
                                                <option value="Upper Quarter Y-Balance" />
                                                <option value="CBT (Closed Kinetic Chain Upper)" />
                                            </datalist>
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.lado} onChange={e => handleChange('lado', e.target.value)} disabled={isClosed}>
                                                <option value="Bilateral">Bilateral</option><option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option>
                                            </select>
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.resultado} onChange={e => handleChange('resultado', e.target.value)} disabled={isClosed} placeholder="cm, seg, %" /></td>
                                        <td className="p-2"><input type="number" min="0" max="10" className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.dolor} onChange={e => handleChange('dolor', e.target.value)} disabled={isClosed} placeholder="0-10" /></td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.calidad} onChange={e => handleChange('calidad', e.target.value)} disabled={isClosed}>
                                                <option value="">Seleccione...</option><option value="Óptima">Óptima</option><option value="Aceptable">Aceptable</option><option value="Pobre">Pobre</option>
                                            </select>
                                        </td>
                                        <td className="p-2"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.observacion} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed} placeholder="Fatiga, valgo..." /></td>
                                        <td className="p-2 right-0">
                                            <button onClick={() => {
                                                const m = exam.funcionalesConfig.filas.filter((_: any, index: number) => index !== i);
                                                handleUpdateExam('funcionalesConfig', { ...exam.funcionalesConfig, filas: m });
                                            }} className="text-red-400 hover:text-red-600 p-1" disabled={isClosed}>✕</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <div className="bg-slate-50 p-3 border-t border-slate-200">
                    <button onClick={() => {
                        const baseConfig = exam.funcionalesConfig || { objetivo: '', filas: [] };
                        handleUpdateExam('funcionalesConfig', { ...baseConfig, filas: [...(baseConfig.filas || []), { id: Date.now().toString(), test: '', lado: 'Bilateral', resultado: '', dolor: '', calidad: '', observacion: '' }] });
                    }} disabled={isClosed} className="text-xs font-bold text-orange-600 bg-white border border-orange-200 px-3 py-1.5 rounded shadow-sm hover:bg-orange-50">
                        + Añadir prueba funcional
                    </button>
                </div>
            </div>

            {/* J. RE-TEST Y CIERRE */}
            <div className="bg-white rounded-2xl shadow-sm border border-fuchsia-200 overflow-hidden flex flex-col">
                <div className="bg-fuchsia-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-fuchsia-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center text-xl shrink-0">🔄</div>
                        <div>
                            <h3 className="font-bold text-fuchsia-900 text-lg">J. Re-test y cierre del examen físico</h3>
                            <p className="text-xs text-fuchsia-700/80 mt-0.5">Cambio post intervenciones de prueba (Signo comparable)</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 sm:p-6 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tarea / Gesto Índice</label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                value={exam.retestConfig?.tareaIndice ?? exam.retestGesture ?? ''}
                                onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, tareaIndice: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Resultado Post-Examen</label>
                            <select
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                value={exam.retestConfig?.resultadoPost || ''}
                                onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, resultadoPost: e.target.value })}
                                disabled={isClosed}
                            >
                                <option value="">Selecciona...</option>
                                <option value="Mejoró">Mejoró</option>
                                <option value="Igual">Igual</option>
                                <option value="Empeoró">Empeoró</option>
                                <option value="No reevaluable">No reevaluable</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Comentario Breve</label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed min-h-[80px]"
                            placeholder="Qué cambió tras el examen..."
                            value={exam.retestConfig?.comentario || ''}
                            onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, comentario: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>
                </div>
            </div>

            {/* K. MEDIDAS COMPLEMENTARIAS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mt-6">
                <div onClick={() => setIsKOpen(!isKOpen)} className="bg-slate-50 hover:bg-slate-100/50 cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-xl shrink-0">🩻</div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">K. Medidas complementarias (opcional)</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Peso, IMC, Edema, Perímetros</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 transition-colors shrink-0" title="Usa este bloque solo si agrega valor al seguimiento, al control de carga, al posoperatorio o al análisis del caso.">?</button>
                        <span className="text-slate-400 text-sm font-bold">{isKOpen ? '▲ Ocultar' : '▼ Expandir'}</span>
                    </div>
                </div>
                {isKOpen && (
                    <div className="p-4 sm:p-6 flex flex-col gap-4 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Peso (kg)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    value={exam.medidasComplementariasConfig?.peso || ''}
                                    onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, peso: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Talla (cm)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    value={exam.medidasComplementariasConfig?.talla || ''}
                                    onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, talla: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">IMC Calc</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    value={exam.medidasComplementariasConfig?.imc || ''}
                                    onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, imc: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Perímetro / Edema (cm)</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="Ej. rodilla DER +2cm"
                                    value={exam.medidasComplementariasConfig?.perimetroEdema || ''}
                                    onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, perimetroEdema: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Otra Medida Segmentaria</label>
                                <input
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                    placeholder="Ángulo Q, Navicular drop..."
                                    value={exam.medidasComplementariasConfig?.otraMedida || ''}
                                    onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, otraMedida: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* BOTÓN FINAL */}
            <div className="flex justify-end pt-6 border-t border-slate-200 mt-4">
                <button
                    onClick={() => {
                        const synthesis = autoSynthesizeFindings(exam, formData.interview);
                        updateFormData((prev) => ({
                            autoSynthesis: { ...prev.autoSynthesis, ...synthesis }
                        }));
                        if (onNext) onNext();
                    }}
                    disabled={isClosed}
                    className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Sintetizar hallazgos físicos y continuar
                </button>
            </div>
        </div>
    );
}
