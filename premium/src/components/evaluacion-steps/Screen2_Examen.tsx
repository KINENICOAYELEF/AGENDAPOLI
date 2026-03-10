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
    const [isGuideOpen, setIsGuideOpen] = React.useState(false);

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
            {/* GUÍA GLOBAL COLAPSABLE */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl overflow-hidden transition-all duration-300">
                <button
                    onClick={() => setIsGuideOpen(!isGuideOpen)}
                    className="w-full flex items-center justify-between p-4 bg-indigo-50/50 hover:bg-indigo-100/50 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xl">💡</span>
                        <h3 className="font-bold text-indigo-900">Cómo completar el examen físico</h3>
                    </div>
                    <span className="text-indigo-500 font-bold">{isGuideOpen ? '−' : '+'}</span>
                </button>
                {isGuideOpen && (
                    <div className="p-4 pt-0 text-sm text-indigo-800 flex flex-col sm:flex-row flex-wrap gap-4 border-t border-indigo-100/50">
                        <p className="w-full text-indigo-900/70 mb-1">Sigue esta secuencia sugerida para un examen ordenado y eficiente:</p>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm"><span className="font-black text-indigo-400">1</span> <span>Observar</span></div>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm"><span className="font-black text-indigo-400">2</span> <span>Mover</span></div>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm"><span className="font-black text-indigo-400">3</span> <span>Medir rango</span></div>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm"><span className="font-black text-indigo-400">4</span> <span>Cargar / Fuerza</span></div>
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-indigo-100 shadow-sm"><span className="font-black text-indigo-400">5</span> <span>Cerrar con re-test</span></div>
                    </div>
                )}
            </div>

            {/* A. ENCABEZADO Y CONTEXTO HEREDADO */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">A. Resumen Heredado (P1)</h2>
                            <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors" title="Cuándo usarlo: siempre revisa este bloque antes de tocar al paciente.&#10;Qué registrar: Verifica si falta info para derivar o tener cuidado.&#10;Cuándo no profundizar: Esto es solo contexto, no modifiques aquí.">
                                ?
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Si faltan datos críticos, puedes volver a la Anamnesis para completarlos.</p>
                    </div>
                </div>

                {/* Info heredada de P1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Foco / Lado</p>
                        <p className="text-sm font-medium text-slate-700">
                            {focoPrincipal ? `Foco ${v4?.focos?.indexOf(focoPrincipal)! + 1}` : <span className="text-orange-500 font-normal">No registrado...</span>}
                            {lado && lado !== "No definido" ? ` • ${lado}` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Queja / Dolor</p>
                        <p className="text-sm font-medium text-slate-700 truncate" title={queja}>
                            {queja !== "No definida" ? queja : <span className="text-orange-500 font-normal">No registrado...</span>}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Irritabilidad</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            {irritabilidad === "Alta" && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                            {irritabilidad === "Media" && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                            {irritabilidad === "Baja" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                            {irritabilidad !== "No definido" ? irritabilidad : <span className="text-orange-500 font-normal">No registrado...</span>}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">⚠️ Manejo Clínico (Red Flags)</p>
                        <p className={`text-xs font-semibold leading-tight ${alertasActivas ? 'text-red-600' : 'text-emerald-600'}`}>
                            {alertasActivas ? alertasActivas : "Seguro para evaluación"}
                        </p>
                    </div>
                </div>

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
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 relative">
                            Tarea o gesto índice para re-test
                            <span className="text-[10px] text-indigo-500 font-normal absolute right-0 top-0 hidden sm:inline">(Se conectará con el final de P2)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full bg-white border border-indigo-200 shadow-sm text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
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
                            <span className="text-lg">👀</span> B. Evaluación Observacional
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-slate-600">
                            Postura, Marcha, Movimiento libre y Reacción al síntoma
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-300 bg-white text-slate-600 opacity-60 hover:opacity-100 transition-opacity" title="Cuándo usarlo: Al inicio o mientras el paciente relata.&#10;Cómo aplicarlo: Observa libremente y selecciona los chips rápidos.&#10;Qué registrar: Solo anomalías, asimetrías o hallazgos relevantes de conducta del dolor.&#10;Cuándo no profundizar: Evita estar rato anotando si todo es normal.">
                        ?
                    </button>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-6 bg-white">
                    {irritabilidad === "Alta" && (
                        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                            <span className="text-lg">⚠️</span> Prefiere observación inicial para no sobre-provocar dolor.
                        </div>
                    )}

                    {(() => {
                        const obs = exam.observacionInicialConfig || {};
                        const setObs = (patch: any) => handleUpdateExam('observacionInicialConfig', { ...obs, ...patch });

                        const renderChipGroup = (field: string, options: string[]) => (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {options.map(opt => {
                                    const isSelected = (obs[field] || []).includes(opt);
                                    return (
                                        <button
                                            key={opt}
                                            onClick={() => {
                                                const current = obs[field] || [];
                                                setObs({ [field]: isSelected ? current.filter((x: string) => x !== opt) : [...current, opt] });
                                            }}
                                            disabled={isClosed}
                                            className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-300 hover:bg-indigo-50'} disabled:opacity-60 disabled:cursor-not-allowed`}
                                        >
                                            {opt}
                                        </button>
                                    );
                                })}
                            </div>
                        );

                        return (
                            <div className="grid grid-cols-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-6">
                                {/* 1. Observación general (Postura/Trofismo) */}
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="md:w-1/3">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">1. Postura y Trofismo</label>
                                        <p className="text-[11px] text-slate-500">¿Qué mirar? Estado general, simetría muscular, alineación del segmento.</p>
                                        <p className="text-[11px] text-slate-500 italic">Qué registrar: Asimetrías o atrofias relevantes.</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        {renderChipGroup('posturaChips', ['Sin hallazgos', 'Asimetría evidente', 'Atrofia visible', 'Alineación alterada', 'Edema / Aumento vol.'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Detalles sobre postura o asimetrías evidentes..."
                                            value={exam.postureAlignment || ''}
                                            onChange={(e) => handleUpdateExam('postureAlignment', e.target.value)}
                                            disabled={isClosed}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-200"></div>

                                {/* 2. Marcha */}
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="md:w-1/3">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">2. Marcha / Gesto habitual</label>
                                        <p className="text-[11px] text-slate-500">¿Qué mirar? Fases de la marcha, cojera, uso de ayudas ortopédicas.</p>
                                        <p className="text-[11px] text-slate-500 italic">Qué registrar: "Normal" o patrón compensatorio.</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        {renderChipGroup('marchaChips', ['Normal', 'Antálgica', 'Cojera', 'Uso ayuda técnica', 'Compensación evidente'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Especificar alteraciones en la marcha..."
                                            value={exam.gaitBasicGesture || ''}
                                            onChange={(e) => handleUpdateExam('gaitBasicGesture', e.target.value)}
                                            disabled={isClosed}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-200"></div>

                                {/* 3. Mov activo general */}
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="md:w-1/3">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">3. Movilidad visual libre</label>
                                        <p className="text-[11px] text-slate-500">¿Qué mirar? Calidad y confianza con la que mueve el segmento libremente.</p>
                                        <p className="text-[11px] text-slate-500 italic">Qué registrar: Aprehensión o bloqueo funcional visible.</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        {renderChipGroup('movVisualChips', ['Fluido', 'Rígido / Lento', 'Rango limitado', 'Evita usar zona'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Especificar calidad del movimiento libre..."
                                            value={exam.initialActiveMovement || ''}
                                            onChange={(e) => handleUpdateExam('initialActiveMovement', e.target.value)}
                                            disabled={isClosed}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-200"></div>

                                {/* 4. Conducta Dolor */}
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="md:w-1/3">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">4. Conducta al síntoma</label>
                                        <p className="text-[11px] text-slate-500">¿Qué mirar? Facies (gestos faciales) y reacción al llegar al rango doloroso.</p>
                                        <p className="text-[11px] text-slate-500 italic">Qué registrar: Si lo tolera, si hay arco doloroso, o temor (kinesiofobia).</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        {renderChipGroup('conductaSintomaChips', ['Tranquilo', 'Facies de dolor', 'Aprensivo', 'Arco doloroso', 'Temor al movimiento'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Detallar dónde o cómo reacciona al dolor..."
                                            value={exam.symptomBehaviorMovement || ''}
                                            onChange={(e) => handleUpdateExam('symptomBehaviorMovement', e.target.value)}
                                            disabled={isClosed}
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-slate-200"></div>

                                {/* Impresión General Opcional */}
                                <div className="flex flex-col md:flex-row gap-4 items-start">
                                    <div className="md:w-1/3">
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">5. Impresión Global</label>
                                        <p className="text-[11px] text-slate-500">Comentario breve que sintetice lo observado antes de evaluar rangos específicos.</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        <textarea
                                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[60px] resize-y"
                                            placeholder="Impresión observacional cualitativa final..."
                                            value={exam.observationGeneral || ''}
                                            onChange={(e) => handleUpdateExam('observationGeneral', e.target.value)}
                                            disabled={isClosed}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* C. RANGO DE MOVIMIENTO ANALÍTICO */}
            <div className="bg-white border text-sm border-indigo-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-indigo-50/50 p-4 flex justify-between items-start border-b border-indigo-200">
                    <div>
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">📐</span> C. Rango de movimiento analítico (Dinámico)
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-indigo-900">
                            Mov. activo, pasivo y end-feel. <span className="text-emerald-600 font-bold ml-1">ORIENTACIÓN CLÍNICA, NO DIAGNÓSTICO.</span>
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-500 opacity-60 hover:opacity-100 transition-opacity" title="Cuándo usarlo: Si hay déficit activo o dolor reportado.&#10;Cómo aplicarlo: Partir por exploración activa. Pasar a pasiva si aporta o hay déficit activo.&#10;Qué registrar: Comparar extremidades (Bilateral) o evaluar unilateral (Axial).&#10;Cuándo no profundizar: Usar goniómetro solo si el número es relevante (ej. post-op).">
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
                                    const rAct = fila.lado === 'Bilateral' ? (fila.resActDer || fila.resActIzq || '') : (fila.resAct || '');
                                    const rPas = fila.lado === 'Bilateral' ? (fila.resPasDer || fila.resPasIzq || '') : (fila.resPas || '');

                                    const actNum = rAct.includes('Incompleto') ? 0 : 1;
                                    const pasNum = rPas.includes('Incompleto') ? 0 : 1;

                                    if (actNum === 0 && pasNum === 1 && rAct !== '') { // Activo incompleto, Pasivo completo
                                        orientacionClinica = "Orientación: podría haber influencia de dolor, inhibición o componente contráctil. Interpretar con fuerza y control motor.";
                                    } else if (actNum === 0 && pasNum === 0 && rAct !== '' && rPas !== '') { // Ambos incompletos
                                        orientacionClinica = "Orientación: la limitación compartida sugiere revisar movilidad articular/tejidos no contráctiles dentro del cuadro completo.";
                                    } else if (actNum === 1 && rPas === 'Completo doloroso') { // Activo y pasivo completos, pero pasivo duele
                                        orientacionClinica = "Orientación: revisar irritabilidad, sobrepresión o sensibilidad mecánica.";
                                    } else if (rAct === 'Completo doloroso' || rAct === 'Incompleto doloroso') {
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
                                            <td className="p-3 align-top min-w-[200px]">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                    value={fila.region}
                                                    onChange={(e) => handleFilaChange('region', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="">-- Músculo / Articulación --</option>
                                                    <optgroup label="Miembro Superior">
                                                        <option value="Hombro">Hombro</option>
                                                        <option value="Codo">Codo</option>
                                                        <option value="Muñeca/Mano">Muñeca/Mano</option>
                                                        <option value="Dedos">Dedos</option>
                                                    </optgroup>
                                                    <optgroup label="Miembro Inferior">
                                                        <option value="Cadera">Cadera</option>
                                                        <option value="Rodilla">Rodilla</option>
                                                        <option value="Tobillo">Tobillo</option>
                                                        <option value="Pie/Ortejos">Pie/Ortejos</option>
                                                    </optgroup>
                                                    <optgroup label="Columna / Axial">
                                                        <option value="Cervical">Cervical</option>
                                                        <option value="Torácica">Torácica</option>
                                                        <option value="Lumbar">Lumbar</option>
                                                        <option value="Pelvis/SI">Pelvis/SI</option>
                                                        <option value="ATM">ATM</option>
                                                    </optgroup>
                                                    <option value="Otro">Otro/Personalizado...</option>
                                                </select>
                                                {fila.region === 'Otro' && (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                        placeholder="Especificar región..."
                                                        value={fila.regionCustom || ''}
                                                        onChange={(e) => handleFilaChange('regionCustom', e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                )}
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    value={fila.lado}
                                                    onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    {['Cervical', 'Torácica', 'Lumbar', 'Pelvis/SI', 'ATM'].includes(fila.region) ? (
                                                        <>
                                                            <option value="Axial">Axial</option>
                                                            <option value="Derecho">Rotación/Inclinación Derecha</option>
                                                            <option value="Izquierdo">Rotación/Inclinación Izquierda</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="Derecho">Derecho</option>
                                                            <option value="Izquierdo">Izquierdo</option>
                                                            <option value="Bilateral">Bilateral Comparativo</option>
                                                        </>
                                                    )}
                                                </select>
                                            </td>
                                            <td className="p-3 align-top min-w-[150px]">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    value={fila.movimiento}
                                                    onChange={(e) => handleFilaChange('movimiento', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="">-- Movimiento --</option>
                                                    <option value="Flexión">Flexión</option>
                                                    <option value="Extensión">Extensión</option>
                                                    <option value="Abducción">Abducción</option>
                                                    <option value="Aducción">Aducción</option>
                                                    <option value="Rotación Interna">Rotación Interna</option>
                                                    <option value="Rotación Externa">Rotación Externa</option>
                                                    <option value="Inclinación Lateral">Inclinación Lateral</option>
                                                    <option value="Rotación Axial">Rotación Axial</option>
                                                    <option value="Elevación">Elevación</option>
                                                    <option value="Depresión">Depresión</option>
                                                    <option value="Pronación">Pronación</option>
                                                    <option value="Supinación">Supinación</option>
                                                    <option value="Inversión">Inversión</option>
                                                    <option value="Eversión">Eversión</option>
                                                    <option value="Dorsiflexión">Dorsiflexión</option>
                                                    <option value="Plantiflexión">Plantiflexión</option>
                                                    <option value="Compuesto/Funcional">Gesto Compuesto/Funcional</option>
                                                    <option value="Otro">Otro/Personalizado...</option>
                                                </select>
                                                {fila.movimiento === 'Otro' && (
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs mt-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                        placeholder="Ej: Flexión cruzada..."
                                                        value={fila.movimientoCustom || ''}
                                                        onChange={(e) => handleFilaChange('movimientoCustom', e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                )}
                                            </td>
                                            <td className="p-3 align-top text-center">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalAct} onChange={(e) => handleFilaChange('evalAct', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                {fila.lado === 'Bilateral' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6">DER</span>
                                                            <select className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.resActDer || ''} onChange={(e) => handleFilaChange('resActDer', e.target.value)} disabled={isClosed || !fila.evalAct}>
                                                                <option value="">-- Activo --</option>
                                                                <option value="Completo no doloroso">Completo no doloroso</option>
                                                                <option value="Completo doloroso">Completo doloroso</option>
                                                                <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                                <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                            </select>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6">IZQ</span>
                                                            <select className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.resActIzq || ''} onChange={(e) => handleFilaChange('resActIzq', e.target.value)} disabled={isClosed || !fila.evalAct}>
                                                                <option value="">-- Activo --</option>
                                                                <option value="Completo no doloroso">Completo no doloroso</option>
                                                                <option value="Completo doloroso">Completo doloroso</option>
                                                                <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                                <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <select
                                                        className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                                        value={fila.resAct || ''}
                                                        onChange={(e) => handleFilaChange('resAct', e.target.value)}
                                                        disabled={isClosed || !fila.evalAct}
                                                    >
                                                        <option value="">-- Resultado Activo --</option>
                                                        <option value="Completo no doloroso">Completo no doloroso</option>
                                                        <option value="Completo doloroso">Completo doloroso</option>
                                                        <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                        <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                    </select>
                                                )}
                                            </td>
                                            <td className="p-3 align-top text-center border-l border-slate-100">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalPas} onChange={(e) => handleFilaChange('evalPas', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-400"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                {fila.lado === 'Bilateral' ? (
                                                    <div className="flex flex-col gap-2">
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">DER</span>
                                                            <div className="flex flex-col gap-1 w-full">
                                                                <select className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.resPasDer || ''} onChange={(e) => handleFilaChange('resPasDer', e.target.value)} disabled={isClosed || !fila.evalPas}>
                                                                    <option value="">-- Pasivo --</option>
                                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                                </select>
                                                                <select className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.topeFinalDer || ''} onChange={(e) => handleFilaChange('topeFinalDer', e.target.value)} disabled={isClosed || !fila.evalPas}>
                                                                    <option value="">-- Tope --</option>
                                                                    <option value="No evaluado">No evaluado</option>
                                                                    <option value="Blando">Blando</option>
                                                                    <option value="Firme">Firme</option>
                                                                    <option value="Duro">Duro</option>
                                                                    <option value="Vacío">Vacío</option>
                                                                    <option value="Espástico">Espástico</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">IZQ</span>
                                                            <div className="flex flex-col gap-1 w-full">
                                                                <select className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.resPasIzq || ''} onChange={(e) => handleFilaChange('resPasIzq', e.target.value)} disabled={isClosed || !fila.evalPas}>
                                                                    <option value="">-- Pasivo --</option>
                                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                                </select>
                                                                <select className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-600 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50" value={fila.topeFinalIzq || ''} onChange={(e) => handleFilaChange('topeFinalIzq', e.target.value)} disabled={isClosed || !fila.evalPas}>
                                                                    <option value="">-- Tope --</option>
                                                                    <option value="No evaluado">No evaluado</option>
                                                                    <option value="Blando">Blando</option>
                                                                    <option value="Firme">Firme</option>
                                                                    <option value="Duro">Duro</option>
                                                                    <option value="Vacío">Vacío</option>
                                                                    <option value="Espástico">Espástico</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <select
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 mb-2"
                                                            value={fila.resPas || ''}
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
                                                            value={fila.topeFinal || ''}
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
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-3 align-top">
                                                {fila.lado === 'Bilateral' ? (
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">DER</span>
                                                            <div className="flex flex-col gap-1.5 w-full">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] uppercase font-bold text-slate-400 w-6">EVA</span>
                                                                    <input type="number" min="0" max="10" className="w-12 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="0-10" value={fila.evaDer || ''} onChange={(e) => handleFilaChange('evaDer', e.target.value)} disabled={isClosed} />
                                                                </div>
                                                                {fila.usaGoniometro && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] uppercase font-bold text-slate-400 w-6">Gon.</span>
                                                                        <input type="text" className="w-14 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="°" value={fila.gradosDer || ''} onChange={(e) => handleFilaChange('gradosDer', e.target.value)} disabled={isClosed} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-1.5 border-t border-slate-100 pt-2 text-center">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">IZQ</span>
                                                            <div className="flex flex-col gap-1.5 w-full items-start">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] uppercase font-bold text-slate-400 w-6">EVA</span>
                                                                    <input type="number" min="0" max="10" className="w-12 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="0-10" value={fila.evaIzq || ''} onChange={(e) => handleFilaChange('evaIzq', e.target.value)} disabled={isClosed} />
                                                                </div>
                                                                {fila.usaGoniometro && (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] uppercase font-bold text-slate-400 w-6">Gon.</span>
                                                                        <input type="text" className="w-14 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="°" value={fila.gradosIzq || ''} onChange={(e) => handleFilaChange('gradosIzq', e.target.value)} disabled={isClosed} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="mt-1 flex justify-center items-center gap-1 border-t border-slate-100 pt-2">
                                                            <input type="checkbox" className="rounded text-indigo-500 w-3 h-3 border-slate-300" checked={fila.usaGoniometro} onChange={(e) => handleFilaChange('usaGoniometro', e.target.checked)} disabled={isClosed} />
                                                            <span className="text-[9px] uppercase font-bold text-slate-400">Usar Gon.</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="text-[10px] uppercase font-bold text-slate-400">EVA</span>
                                                            <input
                                                                type="number"
                                                                min="0" max="10"
                                                                className="w-16 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                                placeholder="0-10"
                                                                value={fila.eva || ''}
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
                                                                    value={fila.grados || ''}
                                                                    onChange={(e) => handleFilaChange('grados', e.target.value)}
                                                                    disabled={isClosed}
                                                                />
                                                            )}
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-3 align-top min-w-[200px]">
                                                {fila.lado === 'Bilateral' ? (
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start gap-1.5">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">DER</span>
                                                            <div className="flex flex-col gap-1.5 w-full">
                                                                <input type="text" className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="Calidad/Compensación (ej. temblor)" value={fila.calidadDer || ''} onChange={(e) => handleFilaChange('calidadDer', e.target.value)} disabled={isClosed} />
                                                                <input type="text" className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="Hallazgo breve" value={fila.hallazgoDer || ''} onChange={(e) => handleFilaChange('hallazgoDer', e.target.value)} disabled={isClosed} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-start gap-1.5 border-t border-slate-100 pt-2">
                                                            <span className="text-[9px] font-bold text-slate-400 w-6 mt-2">IZQ</span>
                                                            <div className="flex flex-col gap-1.5 w-full">
                                                                <input type="text" className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="Calidad/Compensación (ej. temblor)" value={fila.calidadIzq || ''} onChange={(e) => handleFilaChange('calidadIzq', e.target.value)} disabled={isClosed} />
                                                                <input type="text" className="w-full text-[10px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-1.5 outline-none focus:bg-white focus:border-indigo-400" placeholder="Hallazgo breve" value={fila.hallazgoIzq || ''} onChange={(e) => handleFilaChange('hallazgoIzq', e.target.value)} disabled={isClosed} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <input
                                                            type="text"
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                            placeholder="Calidad/Compensación (ej. temblor)"
                                                            value={fila.calidad || ''}
                                                            onChange={(e) => handleFilaChange('calidad', e.target.value)}
                                                            disabled={isClosed}
                                                        />
                                                        <input
                                                            type="text"
                                                            className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                            placeholder="Hallazgo breve"
                                                            value={fila.hallazgo || ''}
                                                            onChange={(e) => handleFilaChange('hallazgo', e.target.value)}
                                                            disabled={isClosed}
                                                        />
                                                    </>
                                                )}
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
                                🧬 Movilidad o análisis específico de tejidos
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
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-emerald-200 bg-white text-emerald-600 font-bold hover:bg-emerald-100 transition-colors group relative" title="Ayuda clínica">
                        ?
                        <div className="hidden group-hover:block absolute top-[110%] right-0 w-64 p-3 bg-white border border-emerald-200 rounded-lg shadow-xl text-left z-50 text-xs font-normal text-slate-700">
                            <p className="font-bold text-emerald-800 mb-1">¿Qué evaluación elegir?</p>
                            <ul className="list-disc pl-4 space-y-1 mb-2">
                                <li>**Manual (MMT):** Eval. rápida 1-5. Poco sensible para deportistas.</li>
                                <li>**Dinamometría:** Eval. comparativa dorada. Usa siempre Lado A vs Lado B para el cálculo automático de asimetría.</li>
                                <li>**Isometría mantenida:** Para tendinopatías o control analítico de dolor/tiempo.</li>
                                <li>**Reps submáximas:** Capacidad de resistencia local (ej. heel raises).</li>
                                <li>**Test Funcional:** Carga en cadena cinética / deportiva.</li>
                            </ul>
                            <p className="font-bold text-emerald-800">¿Qué registrar?</p>
                            <p>Siempre documentar calidad del movimiento y si el dolor fue un factor limitante en lugar de la debilidad real.</p>
                        </div>
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
                                <th className="p-3 w-32 text-center text-[10px] leading-tight leading-4">Dolor<br />(Durante/Post)</th>
                                <th className="p-3 w-36">Calidad</th>
                                <th className="p-3 w-40">Obs. Breve</th>
                                <th className="p-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.fuerzaCargaConfig?.filas || exam.fuerzaCargaConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center border-b border-transparent">
                                        <button
                                            onClick={() => {
                                                const configBase = exam.fuerzaCargaConfig || { filas: [] };
                                                const nuevaFila = {
                                                    id: Date.now().toString(), region: '', lado: 'Derecho', tipoEvaluacion: '',
                                                    dolorDurante: '', dolorPosterior: '', calidadEsfuerzo: '', observacion: ''
                                                };
                                                handleUpdateExam('fuerzaCargaConfig', { ...configBase, filas: [nuevaFila] });
                                            }}
                                            className="text-emerald-500 font-semibold text-sm hover:underline"
                                            disabled={isClosed}
                                        >
                                            El bloque está vacío. Presiona aquí para comenzar a evaluar la tolerancia a carga.
                                        </button>
                                    </td>
                                </tr>
                            )}
                            {(exam.fuerzaCargaConfig?.filas || []).map((fila: any, i: number) => {
                                const handleFilaChange = (campo: string, valor: any) => {
                                    const nuevasFilas = [...exam.fuerzaCargaConfig.filas];

                                    // Limpieza al cambiar el tipo
                                    if (campo === 'tipoEvaluacion' && fila.tipoEvaluacion !== valor) {
                                        nuevasFilas[i].resultado = '';
                                        nuevasFilas[i].dinamometriaIzq = '';
                                        nuevasFilas[i].dinamometriaDer = '';
                                        nuevasFilas[i].dinamometriaUnidad = 'Kg';
                                        nuevasFilas[i].isometriaSegundos = '';
                                        nuevasFilas[i].isometriaMotivo = '';
                                        nuevasFilas[i].repeticionesN = '';
                                        nuevasFilas[i].repeticionesCorte = '';
                                        nuevasFilas[i].testFuncionalNombre = '';
                                    }

                                    // Lógica automática para dinamometría comparativa
                                    if (campo === 'dinamometriaDer' || campo === 'dinamometriaIzq') {
                                        let tempRow = { ...nuevasFilas[i], [campo]: valor };
                                        let der = parseFloat(tempRow.dinamometriaDer);
                                        let izq = parseFloat(tempRow.dinamometriaIzq);

                                        if (!isNaN(der) && !isNaN(izq) && der > 0 && izq > 0) {
                                            let diffPercent = 0;
                                            // Asumimos Lado (del selector principal) como el lado afectado si 'Derecho' o 'Izquierdo'
                                            let ladoAfectado = tempRow.lado === 'Izquierdo' ? izq : der;
                                            let ladoSano = tempRow.lado === 'Izquierdo' ? der : izq;

                                            // Si está marcado Bilateral, usamos max(der,izq) como 100% de referencia
                                            if (tempRow.lado === 'Bilateral') {
                                                let ref = Math.max(der, izq);
                                                let low = Math.min(der, izq);
                                                diffPercent = ((ref - low) / ref) * 100;
                                            } else {
                                                diffPercent = ((ladoSano - ladoAfectado) / ladoSano) * 100;
                                            }

                                            tempRow.diferenciaCalculada = isNaN(diffPercent) ? 0 : Math.round(diffPercent);

                                            let clase = "Similar";
                                            if (Math.abs(diffPercent) <= 10) clase = "Similar";
                                            else if (Math.abs(diffPercent) > 10 && Math.abs(diffPercent) <= 20) clase = "Déficit Leve";
                                            else if (Math.abs(diffPercent) > 20 && Math.abs(diffPercent) <= 30) clase = "Déficit Moderado";
                                            else if (Math.abs(diffPercent) > 30) clase = "Déficit Marcado";

                                            tempRow.clasificacionAutomatica = clase;
                                        } else {
                                            tempRow.diferenciaCalculada = undefined;
                                            tempRow.clasificacionAutomatica = undefined;
                                        }
                                        nuevasFilas[i] = tempRow;
                                        handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                        return;
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
                                                <span className="text-xs text-slate-400 italic font-medium p-1">1. Selecciona el tipo...</span>
                                            )}
                                            {fila.tipoEvaluacion === 'Manual' && (
                                                <select
                                                    className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                    value={fila.resultado} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- MMT / MRC --</option>
                                                    <option value="5 Normal">5 - Normal (Vence resistencia máxima)</option>
                                                    <option value="4 Buena">4 - Buena (Vence resistencia moderada)</option>
                                                    <option value="3 Regular">3 - Regular (Vence gravedad)</option>
                                                    <option value="2 Deficiente">2 - Deficiente (Mov. sin gravedad)</option>
                                                    <option value="1 Vestigio">1 - Vestigio (Contracción palpable)</option>
                                                    <option value="0 Nula">0 - Nula (Sin contracción)</option>
                                                </select>
                                            )}
                                            {fila.tipoEvaluacion === 'Dinamometría' && (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex gap-1.5 items-center">
                                                        <div className="flex-1 flex flex-col items-center gap-0.5 relative">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase w-full text-center">Der</span>
                                                            <input type="number" step="0.1" className="w-full text-xs text-center font-bold bg-white border border-slate-200 text-slate-700 rounded p-1 mb-0.5 outline-none focus:border-emerald-400 focus:shadow-[0_0_0_1px_#34d399]" value={fila.dinamometriaDer || ''} onChange={(e) => handleFilaChange('dinamometriaDer', e.target.value)} disabled={isClosed} />
                                                        </div>
                                                        <div className="flex-1 flex flex-col items-center gap-0.5 relative">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase w-full text-center">Izq</span>
                                                            <input type="number" step="0.1" className="w-full text-xs text-center font-bold bg-white border border-slate-200 text-slate-700 rounded p-1 mb-0.5 outline-none focus:border-emerald-400 focus:shadow-[0_0_0_1px_#34d399]" value={fila.dinamometriaIzq || ''} onChange={(e) => handleFilaChange('dinamometriaIzq', e.target.value)} disabled={isClosed} />
                                                        </div>
                                                        <select className="w-12 mt-[14px] text-[10px] text-center font-bold bg-slate-100 border border-slate-200 text-slate-700 rounded p-1 outline-none" value={fila.dinamometriaUnidad || 'Kg'} onChange={(e) => handleFilaChange('dinamometriaUnidad', e.target.value)} disabled={isClosed}>
                                                            <option value="Kg">Kg</option><option value="N">N</option><option value="Lbs">Lbs</option>
                                                        </select>
                                                    </div>
                                                    {fila.diferenciaCalculada !== undefined && (
                                                        <div className="w-full flex items-center justify-between bg-emerald-50 px-2 py-1 rounded text-[10px] font-bold border border-emerald-100 text-emerald-800">
                                                            <span>Δ {Math.abs(fila.diferenciaCalculada)}%</span>
                                                            <span className="opacity-80 uppercase tracking-widest">{fila.clasificacionAutomatica}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Isometría mantenida' && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" placeholder="Segundos" className="w-20 text-xs text-center font-bold bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.isometriaSegundos || ''} onChange={(e) => handleFilaChange('isometriaSegundos', e.target.value)} disabled={isClosed} />
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Segundos</span>
                                                    </div>
                                                    <input type="text" placeholder="Motivo de corte (ej. Dolor / Fatiga)" className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.isometriaMotivo || ''} onChange={(e) => handleFilaChange('isometriaMotivo', e.target.value)} disabled={isClosed} />
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Repeticiones submáximas' && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" placeholder="Cant." className="w-20 text-xs text-center font-bold bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.repeticionesN || ''} onChange={(e) => handleFilaChange('repeticionesN', e.target.value)} disabled={isClosed} />
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Repeticiones</span>
                                                    </div>
                                                    <select className="w-full text-[11px] bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.repeticionesCorte || ''} onChange={(e) => handleFilaChange('repeticionesCorte', e.target.value)} disabled={isClosed}>
                                                        <option value="">-- Criterio de detención --</option>
                                                        <option value="Fatiga muscular">Fatiga muscular</option>
                                                        <option value="Pérdida de técnica">Pérdida de técnica</option>
                                                        <option value="Dolor inaceptable">Dolor inaceptable</option>
                                                        <option value="Miedo/Aprehensión">Miedo/Aprehensión</option>
                                                    </select>
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Test funcional de carga' && (
                                                <div className="flex flex-col gap-2">
                                                    <input type="text" placeholder="Nombre Test (ej. Hop Test L/R)" className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded font-bold p-1.5 outline-none focus:border-emerald-400" value={fila.testFuncionalNombre || ''} onChange={(e) => handleFilaChange('testFuncionalNombre', e.target.value)} disabled={isClosed} />
                                                    <input type="text" placeholder="Resultado / Criterio visual observado" className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.resultado || ''} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed} />
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
                                                    className="w-full text-[11px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.calidadEsfuerzo} onChange={(e) => handleFilaChange('calidadEsfuerzo', e.target.value)} disabled={isClosed}
                                                    title="Calidad del movimiento/contracción"
                                                >
                                                    <option value="">-- Calidad Mov. --</option>
                                                    <option value="Buena">Buena / Sin problemas</option>
                                                    <option value="Compensa">Compensa</option>
                                                    <option value="Inhibido por dolor">Inhibido por dolor</option>
                                                    <option value="Inconsistente">Inconsistente</option>
                                                    <option value="Fatiga temprana">Fatiga temprana</option>
                                                    <option value="Técnica deficiente">Técnica deficiente</option>
                                                </select>
                                                {/* Eliminamos el control de comparación conceptual manual como nos pidió el usuario */}
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
                            <p className="text-xs text-amber-700/80 mt-0.5">Temperatura, derrame, sensibilidad tisular, dolor focal</p>
                        </div>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-amber-200 bg-white text-amber-600 font-bold hover:bg-amber-100 transition-colors group relative" title="Ayuda clínica">
                        ?
                        <div className="hidden group-hover:block absolute top-[110%] right-0 w-64 p-3 bg-white border border-amber-200 rounded-lg shadow-xl text-left z-50 text-xs font-normal text-slate-700">
                            <p className="font-bold text-amber-800 mb-1">¿Cuándo usar este bloque?</p>
                            <p>Úsalo <strong>solo si suma valor</strong> a tu hipótesis o para descartar (ej. calor articular marcado, sensibilidad ósea exquisita).</p>
                        </div>
                    </button>
                </div>

                <div className="p-0 overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[900px]">
                        <thead>
                            <tr className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 pl-4 w-40">Estructura</th>
                                <th className="p-3 w-32">Lado</th>
                                <th className="p-3 w-48">Hallazgo Ppal</th>
                                <th className="p-3 w-28 text-center text-[10px] leading-tight leading-4">Dolor<br />(0-10)</th>
                                <th className="p-3 w-32">Edema</th>
                                <th className="p-3 w-32">Temp.</th>
                                <th className="p-3 w-48">Obs. Breve</th>
                                <th className="p-3 w-10 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.palpacionConfig?.filas || exam.palpacionConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium text-sm border-b border-transparent">
                                        Bloque vacío. Presiona "+ Añadir Hallazgo" para documentar.
                                    </td>
                                </tr>
                            )}
                            {(exam.palpacionConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.palpacionConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('palpacionConfig', { filas: m });
                                };
                                return (
                                    <tr key={fila.id} className="hover:bg-slate-50">
                                        <td className="p-2 pl-4"><input className="w-full text-xs p-2 border border-slate-200 rounded outline-none" value={fila.estructura || ''} onChange={e => handleChange('estructura', e.target.value)} disabled={isClosed} placeholder="Ej. Tón. rotuliano" /></td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-white focus:border-amber-400" value={fila.lado || 'Derecho'} onChange={e => handleChange('lado', e.target.value)} disabled={isClosed}>
                                                <option value="">Lado</option><option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option><option value="Bilateral">Bilateral</option><option value="N/A">N/A</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-white focus:border-amber-400" value={fila.hallazgoPrincipal || ''} onChange={e => handleChange('hallazgoPrincipal', e.target.value)} disabled={isClosed}>
                                                <option value="">-- Seleccionar --</option>
                                                <option value="Sensibilidad puntual">Sensibilidad puntual exquisita</option>
                                                <option value="Tensión muscular">Tensión/espasmo muscular</option>
                                                <option value="Punto gatillo">Punto gatillo activo</option>
                                                <option value="Aumento Tº">Aumento Tº local</option>
                                                <option value="Derrame aparente">Derrame articular aparente</option>
                                                <option value="Derrame confirmado">Derrame articular confirmado</option>
                                                <option value="Crepitación">Crepitación con movimiento</option>
                                                <option value="Brecha/Gap">Brecha (gap) estructural</option>
                                                <option value="Sin hallazgos">Sin hallazgos claros</option>
                                                <option value="Otro">Otro hallazgo</option>
                                            </select>
                                        </td>
                                        <td className="p-2 text-center text-xs">
                                            <input type="number" min="0" max="10" placeholder="0-10" className="w-16 p-2 text-center border border-slate-200 rounded outline-none focus:border-amber-400" value={fila.dolor || ''} onChange={e => handleChange('dolor', e.target.value)} disabled={isClosed} />
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-[11px] p-2 border border-slate-200 rounded outline-none bg-white focus:border-amber-400" value={fila.edema || 'Normal'} onChange={e => handleChange('edema', e.target.value)} disabled={isClosed}>
                                                <option value="Normal">Normal</option><option value="Leve">Leve</option><option value="Fóvea">Fóvea</option><option value="Intenso">Intenso</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <select className="w-full text-[11px] p-2 border border-slate-200 rounded outline-none bg-white focus:border-amber-400" value={fila.temperatura || 'Normal'} onChange={e => handleChange('temperatura', e.target.value)} disabled={isClosed}>
                                                <option value="Normal">Normal</option><option value="Caliente">Caliente</option><option value="Frío">Fría</option>
                                            </select>
                                        </td>
                                        <td className="p-2">
                                            <input className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-amber-400" placeholder="Ej. Aumenta con flexión" value={fila.observacion || ''} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed} />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => {
                                                const m = exam.palpacionConfig.filas.filter((_: any, index: number) => index !== i);
                                                handleUpdateExam('palpacionConfig', { filas: m });
                                            }} className="text-red-400 hover:text-red-600 p-1 outline-none" disabled={isClosed} title="Eliminar fila">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col gap-4">
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => {
                                const m = exam.palpacionConfig?.filas || [];
                                handleUpdateExam('palpacionConfig', { filas: [...m, { id: Date.now().toString(), estructura: '', lado: lado !== 'No definido' ? lado : 'Derecho', hallazgoPrincipal: '', dolor: '', edema: 'Normal', temperatura: 'Normal', observacion: '' }] });
                            }}
                            className="text-sm font-bold text-amber-600 bg-white border border-amber-200 px-4 py-2 rounded shadow-sm hover:bg-amber-50 outline-none flex items-center gap-2 transition"
                            disabled={isClosed}
                        >
                            <span>+</span> Añadir Hallazgo
                        </button>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                            Síntesis final de palpación (Opcional)
                        </label>
                        <textarea
                            className="w-full text-sm bg-white border border-slate-200 text-slate-700 rounded p-3 outline-none focus:border-amber-400 min-h-[60px]"
                            placeholder="Ej. Sensibilidad exquisita focalizada en inserción rotuliana, sin calor articular global."
                            value={exam.palpacionConfig?.sintesisFinal || ''}
                            onChange={(e) => handleUpdateExam('palpacionConfig', { ...exam.palpacionConfig, sintesisFinal: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>
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
                    <div className="p-0 overflow-hidden flex flex-col gap-0 bg-slate-50">
                        {/* Screening Rápido */}
                        <div className="p-4 sm:p-5 border-b border-rose-100 bg-white">
                            <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span>1.</span> Screening Rápido Global
                            </h4>
                            <div className="flex flex-wrap gap-3 items-center mb-3">
                                {['Normal', 'Alterado Leve', 'Alterado Claro', 'No evaluado'].map(opt => (
                                    <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${exam.neuroVascularConfig?.screening === opt ? (opt.includes('Alterado') ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800') : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="neuroScreening"
                                            value={opt}
                                            checked={exam.neuroVascularConfig?.screening === opt}
                                            onChange={(e) => handleUpdateExam('neuroVascularConfig', { ...exam.neuroVascularConfig, screening: e.target.value })}
                                            className="w-4 h-4 text-rose-500 rounded-full focus:ring-rose-400"
                                            disabled={isClosed}
                                        />
                                        <span className="text-xs font-bold">{opt}</span>
                                    </label>
                                ))}
                            </div>
                            <input
                                type="text"
                                className="w-full text-sm p-3 border border-slate-200 rounded-xl outline-none focus:border-rose-400 bg-slate-50 focus:bg-white transition-colors"
                                placeholder="Comentario breve del screening..."
                                value={exam.neuroVascularConfig?.screeningComentario || ''}
                                onChange={(e) => handleUpdateExam('neuroVascularConfig', { ...exam.neuroVascularConfig, screeningComentario: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>

                        {/* Subdominios Estructurados */}
                        <div className="p-4 sm:p-5 bg-slate-50/50">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <span>2.</span> Evaluación Específica (Subdominios)
                                </h4>
                                <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-100 transition-colors group relative" title="Ayuda clínica">
                                    ?
                                    <div className="hidden group-hover:block absolute top-[110%] right-0 w-64 p-3 bg-white border border-rose-200 rounded-lg shadow-xl text-left z-50 text-xs font-normal text-slate-700">
                                        <p className="font-bold text-rose-800 mb-1">¿Cuándo usar subdominios?</p>
                                        <p>Si el screening es NORMAL, puedes saltar esto.</p>
                                        <p className="mt-2">Si hay síntomas distales, irradiación o debilidad inexplicable, realiza y registra la evaluación específica.</p>
                                        <p className="mt-2 text-slate-500 italic">Marca solo lo que realmente evaluaste para no "ensuciar" el reporte.</p>
                                    </div>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { id: 'miotomas', label: 'Miotomas' },
                                    { id: 'sensibilidad', label: 'Sensibilidad sup. / Dermatomas' },
                                    { id: 'rot', label: 'Reflejos (ROT)' },
                                    { id: 'neurodinamia', label: 'Neurodinamia' },
                                    { id: 'pulsos', label: 'Pulsos / Perfusión' },
                                    { id: 'propiocepcion', label: 'Sensibilidad prof. / Propiocepción' },
                                    { id: 'coordinacion', label: 'Coordinación' },
                                    { id: 'especifico', label: 'Control Sensoriomotor Específico' }
                                ].map(({ id, label }) => {
                                    const dominio = exam.neuroVascularConfig?.dominios?.[id] || { resultado: 'No evaluado', detalle: '' };
                                    const activo = dominio.resultado !== 'No evaluado' && dominio.resultado !== '';

                                    return (
                                        <div key={id} className={`p-3 rounded-xl border transition-colors ${activo ? 'border-rose-300 bg-white shadow-sm' : 'border-slate-200 bg-white/50 hover:bg-white'}`}>
                                            <div className="flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-700">{label}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <select
                                                        className={`w-36 text-[11px] p-2 border rounded-lg outline-none focus:border-rose-400 font-bold ${dominio.resultado === 'Normal' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                dominio.resultado === 'Alterado' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                                    'bg-slate-50 text-slate-500 border-slate-200'
                                                            }`}
                                                        value={dominio.resultado || 'No evaluado'}
                                                        onChange={(e) => {
                                                            const current = exam.neuroVascularConfig || {};
                                                            const dominios = current.dominios || {};
                                                            handleUpdateExam('neuroVascularConfig', { ...current, dominios: { ...dominios, [id]: { ...dominio, resultado: e.target.value } } });
                                                        }}
                                                        disabled={isClosed}
                                                    >
                                                        <option value="No evaluado">No evaluado</option>
                                                        <option value="Normal">Normal</option>
                                                        <option value="Alterado">Alterado</option>
                                                    </select>
                                                    {activo && (
                                                        <input
                                                            type="text"
                                                            className="flex-1 text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-rose-400 bg-slate-50 focus:bg-white"
                                                            placeholder="Breve detalle..."
                                                            value={dominio.detalle || ''}
                                                            onChange={(e) => {
                                                                const current = exam.neuroVascularConfig || {};
                                                                const dominios = current.dominios || {};
                                                                handleUpdateExam('neuroVascularConfig', { ...current, dominios: { ...dominios, [id]: { ...dominio, detalle: e.target.value } } });
                                                            }}
                                                            disabled={isClosed}
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
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
