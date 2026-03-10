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

    const handleUpdateExam = (field: string, value: string) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, [field]: value }
        }));
    };

    const blocks = [
        { id: 'analyticRom', icon: '📐', theme: 'indigo', title: 'C. Rango de movimiento analítico', sub: 'Movilidad activa, pasiva y end-feel', placeholder: 'Flexión activa hombro 120° con dolor, pasiva completa...' },
        { id: 'strengthAndLoad', icon: '🦾', theme: 'emerald', title: 'D. Fuerza y tolerancia a carga', sub: 'Pruebas isométricas, RM, dinamometría o tolerancia a cargar peso', placeholder: 'Fuerza isométrica conservada pero dolorosa (4/5) en abducción...' },
        { id: 'palpation', icon: '🖐️', theme: 'amber', title: 'E. Palpación', sub: 'Temperatura, derrame, puntos gatillo, sensibilidad tisular', placeholder: 'Dolor exquisito a la palpación del epicóndilo lateral, sin aumento de temperatura local...' },
        { id: 'neuroVascular', icon: '⚡', theme: 'rose', title: 'F. Neurológico / vascular / somatosensorial', sub: 'Dermatomas, reflejos, neurodinamia, pulsos, sensibilidad', placeholder: 'Sensibilidad conservada, reflejos osteotendíneos ++/++, pulsos distales presentes y simétricos...' },
        { id: 'motorControl', icon: '🧘', theme: 'teal', title: 'G. Control motor y estabilidad funcional', sub: 'Disociación, estabilizadores, propiocepción', placeholder: 'Pobre control lumbopélvico durante sentadilla profunda, valgo dinámico de rodilla derecha...' },
        { id: 'orthopedicTestsText', icon: '🔨', theme: 'sky', title: 'H. Pruebas ortopédicas', sub: 'Tests especiales y provocativos', placeholder: 'Test de Neer (+), Hawkins-Kennedy (+), Drop Arm (-)...' },
        { id: 'functionalTests', icon: '🏃', theme: 'orange', title: 'I. Pruebas funcionales y reintegro', sub: 'Saltos, agilidad, gestos deportivos específicos', placeholder: 'Y-Balance Test asimetría > 4cm en alcance anterior, dolor en aterrizaje de salto...' },
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

            {/* C-K BLOQUES CLINICOS RESTANTES*/}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {blocks.map((block) => {
                    const theme = getThemeClasses(block.theme);
                    return (
                        <div key={block.id} className={`bg-white border text-sm ${theme.border} rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md`}>
                            <div className={`${theme.bg} p-4 flex justify-between items-start border-b ${theme.border}`}>
                                <div>
                                    <h3 className={`font-bold ${theme.text} flex items-center gap-2 tracking-wide`}>
                                        <span className="text-lg">{block.icon}</span> {block.title}
                                    </h3>
                                    <p className={`text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest ${theme.text}`}>
                                        {block.sub}
                                    </p>
                                </div>
                                <button className={`text-[10px] w-6 h-6 rounded-full flex items-center justify-center border ${theme.border} bg-white opacity-60 hover:opacity-100 transition-opacity`} title="Ayuda sobre este bloque">
                                    ?
                                </button>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <textarea
                                    className={`w-full flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-[14px] rounded-xl p-3 sm:p-4 outline-none ${theme.focus} focus:ring-2 focus:ring-opacity-20 focus:bg-white min-h-[120px] shadow-inner transition-all resize-y leading-relaxed disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed`}
                                    placeholder={block.placeholder}
                                    value={exam[block.id] || ''}
                                    onChange={(e) => handleUpdateExam(block.id, e.target.value)}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>
                    );
                })}
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
