import React from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { autoSynthesizeFindings } from "@/lib/auto-engine";
import { normalizeEvaluationState } from "@/lib/state-normalizer";
import { buildP2SummaryStructured } from "@/utils/synthesis/builder";

export interface Screen2Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
    onNext?: () => void;
}

export function Screen2_Examen({ formData, updateFormData, isClosed, onNext }: Screen2Props) {
    const exam = (formData.guidedExam as any) || {};

    // 1. STATE NORMALIZATION
    const normalizedCase = normalizeEvaluationState(formData);
    
    // Fallbacks para UI Legacy (Prioritizando IA P1)
    const p1AI = (formData.interview as any)?.p1_ai_structured || (formData.interview as any)?.v4?.p1_ai_structured;
    const focoPrincipal = p1AI?.foco_principal?.region ? { ...normalizedCase.focoPrincipal, region: p1AI.foco_principal.region } : normalizedCase.focoPrincipal;
    const lado = p1AI?.foco_principal?.lado || normalizedCase.ladoPrincipal;
    const queja = p1AI?.foco_principal?.queja_prioritaria || normalizedCase.quejaPrioritaria;
    const irritabilidad = p1AI?.sins?.irritabilidad_global?.split(' ')[0] || normalizedCase.irritabilidad; // ej "Alta (fácil de provocar)" -> "Alta"
    const actividadIndiceP1 = p1AI?.foco_principal?.actividad_indice || normalizedCase.tareaIndice;
    const recomendaciones = p1AI?.recomendaciones_p2_por_modulo;

    const v4 = formData.interview?.v4;
    const alertasActivas = [
        v4?.seguridad?.fiebre_sistemico_cancerPrevio && "Fiebre/Sistémico/Cáncer",
        v4?.seguridad?.bajaPeso_noIntencionada && "Baja de peso",
        v4?.seguridad?.dolorNocturno_inexplicable_noMecanico && "Dolor nocturno no mecánico",
        v4?.seguridad?.trauma_altaEnergia_caidaImportante && "Trauma alta energía",
        v4?.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar && "Neuro grave/Esfínteres",
        v4?.seguridad?.sospechaFractura_incapacidadCarga && "Sospecha fractura/Incapacidad carga",
        v4?.seguridad?.riesgoEmocionalAgudo && "Riesgo Emocional Agudo"
    ].filter(Boolean).join(", ");
    
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
    const [openHelp, setOpenHelp] = React.useState<string | null>(null);

    const [isKeyboardOpen, setIsKeyboardOpen] = React.useState(false);
    const [isSynthesizing, setIsSynthesizing] = React.useState(false);
    const [synthesisSuccess, setSynthesisSuccess] = React.useState(false);
    const [localPreview, setLocalPreview] = React.useState<any>(null);

    // FASE 20: Panel de Hipótesis y Estado
    const [hipotesisTracking, setHipotesisTracking] = React.useState<any[]>(() => {
        // Inicializar desde formData.guidedExam.hipotesis_tracking si existe (persistencia local)
        if (exam.hipotesis_tracking && Array.isArray(exam.hipotesis_tracking) && exam.hipotesis_tracking.length > 0) {
            return exam.hipotesis_tracking;
        }
        
        // Si no existe, construir desde p1_ai_structured
        const interviewData = formData.interview as any;
        const p1Hipotesis = interviewData?.p1_ai_structured?.hipotesis_orientativas;
        
        if (p1Hipotesis && Array.isArray(p1Hipotesis)) {
            return p1Hipotesis.map((h: any, index: number) => ({
                ranking: index + 1,
                titulo: h.titulo || h.nombre || `Hipótesis ${index + 1}`,
                probabilidad: h.probabilidad || 'Moderada',
                fundamento_breve: h.fundamento_breve || h.explicacion || '',
                que_hay_que_confirmar: h.que_hay_que_confirmar || [],
                que_hay_que_descartar: h.que_hay_que_descartar || [],
                estado_en_p2: 'pendiente', // Por defecto
                comentario_corto: ''
            }));
        }
        
        return [];
    });

    const updateHipotesisTracking = (index: number, changes: any) => {
        setHipotesisTracking(prev => {
            const newTracking = [...prev];
            newTracking[index] = { ...newTracking[index], ...changes };
            
            // Auto-guardar en el formData al cambiar
            updateFormData((current) => ({
                guidedExam: { ...current.guidedExam, hipotesis_tracking: newTracking }
            }));
            
            return newTracking;
        });
    };

    const handleUpdateExam = (field: string, value: any) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, [field]: value }
        }));
    };

    const renderRecomendacionIA = (recomendacion: any) => {
        if (!recomendacion || (!recomendacion.por_que_aporta_en_este_caso && !recomendacion.objetivo)) return null;
        return (
            <div className="mb-4 bg-amber-50 rounded-xl p-4 border border-amber-200 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-200/50 to-transparent rounded-bl-full pointer-events-none"></div>
                <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest mb-3 flex items-center gap-2"><span className="text-base">🧠</span> Recomendación Clínica P1</h4>
                
                <div className="space-y-3 relative z-10">
                    <div>
                        <p className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Por qué usar este módulo</p>
                        <p className="text-xs font-medium text-amber-900">{recomendacion.por_que_aporta_en_este_caso || recomendacion.objetivo}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {(recomendacion.que_confirma || recomendacion.hallazgos_para_confirmar || recomendacion.hallazgo_que_apoya_hipotesis_principal) && (
                            <div className="bg-white/60 p-2 rounded-lg border border-amber-100/50">
                                <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">A Confirmar</p>
                                <p className="text-[11px] text-emerald-900 leading-snug">{recomendacion.que_confirma || recomendacion.hallazgos_para_confirmar || recomendacion.hallazgo_que_apoya_hipotesis_principal}</p>
                            </div>
                        )}
                        {(recomendacion.que_descarta || recomendacion.hallazgos_para_descartar || recomendacion.hallazgo_que_debilita_hipotesis_principal) && (
                            <div className="bg-white/60 p-2 rounded-lg border border-amber-100/50">
                                <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">A Descartar</p>
                                <p className="text-[11px] text-rose-900 leading-snug">{recomendacion.que_descarta || recomendacion.hallazgos_para_descartar || recomendacion.hallazgo_que_debilita_hipotesis_principal}</p>
                            </div>
                        )}
                    </div>

                    {recomendacion.pruebas_o_tareas_sugeridas && recomendacion.pruebas_o_tareas_sugeridas.length > 0 && (
                        <div className="mt-2">
                            <p className="text-[10px] font-bold text-indigo-700 uppercase mb-1 flex items-center gap-1"><span>⚡</span> Tests o Tareas Sugeridas</p>
                            <div className="flex flex-wrap gap-1.5">
                                {recomendacion.pruebas_o_tareas_sugeridas.map((test: string, idx: number) => (
                                    <span key={idx} className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-semibold">{test}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
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
        <div className="flex flex-col gap-4 sm:gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-x-hidden w-full max-w-full">
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
                            <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">A. Resumen Heredado (P1) <button type="button" onClick={() => setOpenHelp('A')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 transition-colors" title="Ayuda clínica">?</button></h2>

                        </div>
                        <p className="text-sm text-slate-500 mt-1">Si faltan datos críticos, puedes volver a la Anamnesis para completarlos.</p>
                    </div>
                </div>

                {/* Info heredada de P1 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Foco / Lado</p>
                        <p className="text-sm font-medium text-slate-700">
                            {focoPrincipal ? `Foco ${Math.max(1, (v4?.focos?.findIndex(f => f?.id === (normalizedCase?.focoPrincipal as any)?.id || f?.id === (normalizedCase?.focoPrincipal as any)?.focoId) || 0) + 1)}` : <span className="text-slate-400 font-normal italic">No registrado</span>}
                            {lado && lado !== "No definido" ? ` • ${lado}` : ''}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Queja / Dolor</p>
                        <p className="text-sm font-medium text-slate-700" title={queja}>
                            {queja !== "No definida" && queja !== "NoDefinido" ? queja : <span className="text-slate-400 font-normal italic">No registrado</span>}
                        </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Irritabilidad</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            {irritabilidad === "Alta" && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                            {irritabilidad === "Media" && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                            {irritabilidad === "Baja" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                            {irritabilidad !== "No definida" && irritabilidad !== "NoDefinido" ? irritabilidad : <span className="text-slate-400 font-normal italic">No registrado</span>}
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
                    <div className="lg:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 relative">
                            Tarea o gesto índice para re-test
                            <span className="text-[10px] text-indigo-500 font-normal absolute right-0 top-0 hidden sm:inline">(Se conectará con el final de P2)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full bg-indigo-50/50 border border-indigo-100 shadow-sm text-indigo-700 text-sm font-medium rounded-xl p-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="Ej. sentadilla, levantar brazo, cambio de dirección..."
                            value={exam.signoComparable !== undefined ? exam.signoComparable : (actividadIndiceP1 || formData.interview?.v4?.focos?.find((f: any) => f.esPrincipal)?.signoComparable || '')}
                            onChange={(e) => handleUpdateExam('signoComparable', e.target.value)}
                            disabled={isClosed}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Modalidad de examen hoy
                        </label>
                        <select className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed text-ellipsis"
                            value={normalizedCase.modalidadExamen !== 'Completo' ? exam.examModality || '' : 'Completo'}
                            onChange={(e) => handleUpdateExam('examModality', e.target.value)}
                            disabled={isClosed}
                        >
                            <option value="">Selecciona modalidad...</option>
                            <option value="Completo">Completo</option>
                            <option value="Modificado por dolor/irritabilidad">Modificado por dolor/irritabilidad</option>
                            <option value="Muy acotado por seguridad/tolerancia">Muy acotado por seguridad/tolerancia</option>
                        </select>
                    </div>
                </div>

                {/* FASE 20: Preguntas Faltantes Clave (Solo Lectura) */}
                {(formData.interview as any)?.p1_ai_structured?.preguntas_faltantes?.length > 0 && (
                    <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 mt-2">
                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1"><span>❓</span> Preguntas Faltantes Clave (P1)</p>
                        <ul className="text-xs text-amber-800 space-y-1.5 pl-4 list-disc">
                            {(formData.interview as any).p1_ai_structured.preguntas_faltantes.map((q: any, i: number) => (
                                <li key={i}><strong>{q.tema_faltante}:</strong> {q.como_preguntarlo} <span className="text-amber-600/70 italic">({q.por_que_importa})</span></li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* FASE 20: PANEL DE HIPÓTESIS Y ESTADO */}
            {hipotesisTracking.length > 0 && (
                <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="bg-indigo-50 border-b border-indigo-100 p-4 sm:p-5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold text-lg">🎯</div>
                        <div>
                            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-widest flex items-center">
                                Hipótesis de trabajo a contrastar en P2
                            </h3>
                            <p className="text-xs text-indigo-600 mt-1">Evalúa físicamente para confirmar o descartar estas sospechas de P1.</p>
                        </div>
                    </div>
                    <div className="p-4 sm:p-5 bg-white space-y-4">
                        {hipotesisTracking.map((hip, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">{hip.ranking}</span>
                                        <span className="font-bold text-slate-800 text-sm">{hip.titulo}</span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-600">{hip.probabilidad}</span>
                                    </div>
                                    <p className="text-xs text-slate-600 mb-2">{hip.fundamento_breve}</p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                        {hip.que_hay_que_confirmar?.length > 0 && (
                                            <div className="bg-emerald-50/50 p-2 rounded border border-emerald-100">
                                                <p className="text-[10px] font-bold text-emerald-700 uppercase mb-1">A Confirmar</p>
                                                <ul className="text-[11px] text-emerald-800 pl-3 list-disc space-y-0.5">
                                                    {hip.que_hay_que_confirmar.map((item: string, i: number) => <li key={i}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {hip.que_hay_que_descartar?.length > 0 && (
                                            <div className="bg-rose-50/50 p-2 rounded border border-rose-100">
                                                <p className="text-[10px] font-bold text-rose-700 uppercase mb-1">A Descartar</p>
                                                <ul className="text-[11px] text-rose-800 pl-3 list-disc space-y-0.5">
                                                    {hip.que_hay_que_descartar.map((item: string, i: number) => <li key={i}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="md:w-64 shrink-0 flex flex-col gap-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Estado en P2</label>
                                    <select 
                                        value={hip.estado_en_p2}
                                        onChange={(e) => updateHipotesisTracking(idx, { estado_en_p2: e.target.value })}
                                        disabled={isClosed}
                                        className={`w-full text-xs font-medium py-2 px-3 rounded-lg border outline-none ${
                                            hip.estado_en_p2 === 'gana_fuerza' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                                            hip.estado_en_p2 === 'pierde_fuerza' ? 'bg-orange-50 border-orange-200 text-orange-800' :
                                            hip.estado_en_p2 === 'descartada' ? 'bg-rose-50 border-rose-200 text-rose-800' :
                                            hip.estado_en_p2 === 'se_mantiene' ? 'bg-sky-50 border-sky-200 text-sky-800' :
                                            'bg-slate-50 border-slate-200 text-slate-600'
                                        }`}
                                    >
                                        <option value="pendiente">Pendiente de evaluación</option>
                                        <option value="se_mantiene">Se mantiene (Neutral)</option>
                                        <option value="gana_fuerza">Gana fuerza / Confirmada</option>
                                        <option value="pierde_fuerza">Pierde fuerza</option>
                                        <option value="descartada">Descartada Clínicamente</option>
                                    </select>
                                    
                                    <input 
                                        type="text"
                                        placeholder="Comentario breve..."
                                        value={hip.comentario_corto}
                                        onChange={(e) => updateHipotesisTracking(idx, { comentario_corto: e.target.value })}
                                        disabled={isClosed}
                                        className="w-full text-xs py-2 px-3 rounded-lg border border-slate-200 focus:border-indigo-400 outline-none"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* B. BLOQUE ESTRUCTURADO OBSERVACIÓN Y MOVIMIENTO INICIAL */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-slate-50 p-4 flex justify-between items-start border-b border-slate-200">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">👀</span> <span className="flex-1">B. Evaluación Observacional</span> <button type="button" onClick={() => setOpenHelp('B')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-600 font-bold hover:bg-indigo-100 transition-colors" title="Ayuda clínica">?</button>
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-slate-600">
                            Observa primero el gesto o movimiento más representativo referido en la entrevista.
                        </p>
                    </div>

                </div>

                <div className="p-5 flex-1 flex flex-col gap-6 bg-white">
                    {renderRecomendacionIA(recomendaciones?.observacion_movimiento_inicial)}
                    {irritabilidad === "Alta" && (
                        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                            <span className="text-lg">⚠️</span> Prefiere observación inicial para no sobre-provocar dolor.
                        </div>
                    )}

                    {normalizedCase.tareaIndice && (
                        <div className="bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                            <span className="text-lg">📌</span> Tarea / Gesto índice referido: <span className="font-bold">{normalizedCase.tareaIndice}</span>
                        </div>
                    )}
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Movimiento o gesto observado hoy</label>
                        <input
                            type="text"
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-lg p-2 outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20"
                            placeholder="Ej. sentadilla, levantar brazo, caminar libremente..."
                            value={exam.movimientoObservadoHoy || ''}
                            onChange={(e) => handleUpdateExam('movimientoObservadoHoy', e.target.value)}
                            disabled={isClosed}
                        />
                    </div>

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
                                        {renderChipGroup('posturaChips', ['Sin hallazgos', 'Asimetría evidente', 'Atrofia visible', 'Alineación alterada', 'Aumento de volumen aparente'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Detalles sobre postura, aumento de volumen aparente, asimetrías..."
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
                                        {renderChipGroup('marchaChips', ['Normal', 'Marcha antálgica', 'Cojera', 'Uso ayuda técnica', 'Compensación evidente'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Especificar marcha antálgica o alteraciones corporales..."
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
                                        {renderChipGroup('movVisualChips', ['Fluido', 'Rígido / Lento', 'Rango limitado', 'Movimiento temeroso', 'Compensa al elevar'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Especificar aprehensión o bloqueos..."
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
                                        {renderChipGroup('conductaSintomaChips', ['Tranquilo', 'Facies de dolor', 'Dolor al final del gesto', 'Arco doloroso', 'Estrategia de protección'])}
                                        <input
                                            type="text"
                                            className="w-full mt-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                            placeholder="Detallar dónde duele o estrategias de protección..."
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
                                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">5. Impresión observacional inicial</label>
                                        <p className="text-[11px] text-slate-500">Síntesis observacional corta antes de las pruebas analíticas.</p>
                                    </div>
                                    <div className="w-full md:w-2/3">
                                        <textarea
                                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[60px] resize-y"
                                            placeholder="Síntesis breve de lo observado..."
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
            <div className="bg-white border text-sm border-indigo-200 rounded-2xl shadow-sm flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-indigo-50/50 p-4 flex justify-between items-start border-b border-indigo-200">
                    <div>
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">📐</span> C. Rango de movimiento analítico (Dinámico)
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-indigo-900">
                            Mov. activo, pasivo y end-feel. <span className="text-emerald-600 font-bold ml-1">ORIENTACIÓN CLÍNICA, NO DIAGNÓSTICO.</span>
                        </p>
                    </div>
                    <button type="button" onClick={() => setOpenHelp('C')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-600 font-bold hover:bg-indigo-100 transition-colors" title="Ayuda clínica">?</button>
                </div>

                <div className="p-4 bg-slate-50 flex flex-col gap-4">
                    {renderRecomendacionIA(recomendaciones?.rango_movimiento_analitico)}
                    {(!exam.romAnaliticoConfig?.filas || exam.romAnaliticoConfig.filas.length === 0) && (
                        <div className="p-8 text-center bg-white border-2 border-dashed border-indigo-100 rounded-xl text-indigo-400 italic font-medium text-sm">
                            No hay movimientos ingresados. Presiona "+ Añadir Movimiento" para comenzar.
                        </div>
                    )}
                    {(exam.romAnaliticoConfig?.filas || []).map((fila: any, i: number) => {
                        let orientacionClinica = "";
                        if (fila.evalAct && fila.evalPas) {
                            const rAct = fila.lado === 'Bilateral' ? (fila.resActDer || fila.resActIzq || '') : (fila.resAct || '');
                            const rPas = fila.lado === 'Bilateral' ? (fila.resPasDer || fila.resPasIzq || '') : (fila.resPas || '');

                            const actNum = (rAct.includes('Incompleto') || rAct.includes('limitado') || rAct.includes('Rígido')) ? 0 : 1;
                            const pasNum = (rPas.includes('Incompleto') || rPas.includes('limitado') || rPas.includes('Rígido')) ? 0 : 1;

                            if (actNum === 0 && pasNum === 1 && rAct !== '') {
                                orientacionClinica = "Activo más limitado que pasivo: puede ser más relevante el dolor, control o tejido contráctil.";
                            } else if (actNum === 0 && pasNum === 0 && rAct !== '' && rPas !== '') {
                                orientacionClinica = "Activo y pasivo ambos limitados: puede haber restricción articular o rigidez relevante.";
                            } else if (actNum === 1 && (rPas.includes('doloroso') || rPas.includes('Dolor'))) {
                                orientacionClinica = "Dolor al final del arco pasivo: considera irritación mecánica al cierre del movimiento.";
                            } else if ((rAct.includes('doloroso') || rAct.includes('Dolor')) && fila.lado === 'Bilateral') {
                                orientacionClinica = "Diferencia marcada o dolorosa: conviene comparar con fuerza y tarea funcional.";
                            }
                        }

                        const handleFilaChange = (campo: string, valor: any) => {
                            const nuevasFilas = [...exam.romAnaliticoConfig.filas];
                            nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };
                            if (campo === 'evalAct' && !valor) {
                                nuevasFilas[i].resAct = ''; nuevasFilas[i].resActDer = ''; nuevasFilas[i].resActIzq = '';
                            }
                            if (campo === 'evalPas' && !valor) {
                                nuevasFilas[i].resPas = ''; nuevasFilas[i].resPasDer = ''; nuevasFilas[i].resPasIzq = '';
                                nuevasFilas[i].topeFinal = ''; nuevasFilas[i].topeFinalDer = ''; nuevasFilas[i].topeFinalIzq = '';
                            }
                            if (campo === 'usaGoniometro' && !valor) {
                                nuevasFilas[i].grados = ''; nuevasFilas[i].gradosDer = ''; nuevasFilas[i].gradosIzq = '';
                            }
                            handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                        };

                        const toggleChip = (ladoStr: string, valor: string) => {
                            const campo = ladoStr ? `hallazgosCustom${ladoStr}` : 'hallazgosCustom';
                            const actuales = fila[campo] || [];
                            const nuevos = actuales.includes(valor) ? actuales.filter((x: string) => x !== valor) : [...actuales, valor];
                            handleFilaChange(campo, nuevos);
                        };

                        const chipsDisponibles = ['Completo sin dolor', 'Completo doloroso', 'Limitado sin dolor', 'Limitado doloroso', 'Rígido', 'Temeroso', 'Arco doloroso', 'Compensa', 'No evaluado'];

                        const renderFields = (sideLabel: string = '') => {
                            const ext = sideLabel ? (sideLabel === 'DER' ? 'Der' : 'Izq') : '';
                            return (
                                <div className={`flex flex-col gap-3 p-3 rounded-lg border ${sideLabel === 'DER' ? 'bg-indigo-50/30 border-indigo-100' : sideLabel === 'IZQ' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50/50 border-slate-100'}`}>
                                    {sideLabel && <div className="text-xs font-bold text-slate-500 mb-1">{sideLabel}</div>}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Activo / Pasivo */}
                                        <div className="flex flex-col gap-2">
                                            {fila.evalAct && (
                                                <div>
                                                    <label className="text-[10px] uppercase font-bold text-indigo-400">Resultado Activo</label>
                                                    <select className="w-full mt-1 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-indigo-400 text-ellipsis" value={fila[`resAct${ext}`] || ''} onChange={(e) => handleFilaChange(`resAct${ext}`, e.target.value)} disabled={isClosed}>
                                                        <option value="">-- Activo --</option>
                                                        <option value="Completo no doloroso">Completo no doloroso</option>
                                                        <option value="Completo doloroso">Completo doloroso</option>
                                                        <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                        <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                    </select>
                                                </div>
                                            )}
                                            {fila.evalPas && (
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-orange-400">Resultado Pasivo</label>
                                                        <select className="w-full mt-1 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-orange-400 text-ellipsis" value={fila[`resPas${ext}`] || ''} onChange={(e) => handleFilaChange(`resPas${ext}`, e.target.value)} disabled={isClosed}>
                                                            <option value="">-- Pasivo --</option>
                                                            <option value="Completo no doloroso">Completo no doloroso</option>
                                                            <option value="Completo doloroso">Completo doloroso</option>
                                                            <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                            <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                        </select>
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400">Tope</label>
                                                        <select className="w-full mt-1 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none text-ellipsis" value={fila[`topeFinal${ext}`] || ''} onChange={(e) => handleFilaChange(`topeFinal${ext}`, e.target.value)} disabled={isClosed}>
                                                            <option value="">--</option>
                                                            <option value="Blando">Blando</option><option value="Firme">Firme</option><option value="Duro">Duro</option><option value="Vacío">Vacío</option><option value="Espástico">Espástico</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Valores y Hallazgos */}
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400">Dolor EVA</label>
                                                    <input type="number" min="0" max="10" className="w-full mt-1 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none" placeholder="0-10" value={fila[`eva${ext}`] || ''} onChange={(e) => handleFilaChange(`eva${ext}`, e.target.value)} disabled={isClosed} />
                                                </div>
                                                {fila.usaGoniometro && (
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400">Grados°</label>
                                                        <input type="text" className="w-full mt-1 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none" placeholder="°" value={fila[`grados${ext}`] || ''} onChange={(e) => handleFilaChange(`grados${ext}`, e.target.value)} disabled={isClosed} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chips de Hallazgo y Comentario */}
                                    <div className="mt-1">
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {chipsDisponibles.map(c => {
                                                const selectVal = fila[ext ? `hallazgosCustom${ext}` : 'hallazgosCustom'] || [];
                                                const selected = selectVal.includes(c);
                                                return (
                                                    <button key={c} onClick={() => toggleChip(ext, c)} disabled={isClosed} className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${selected ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                                                        {c}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        <input type="text" className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400" placeholder="Comentario o hallazgo adicional (ej. temor al final de excursión)" value={fila[`hallazgo${ext}`] || ''} onChange={(e) => handleFilaChange(`hallazgo${ext}`, e.target.value)} disabled={isClosed} />
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <div key={fila.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative">
                                <button
                                    onClick={() => {
                                        const nuevasFilas = exam.romAnaliticoConfig.filas.filter((_: any, idx: number) => idx !== i);
                                        handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                                    }}
                                    disabled={isClosed}
                                    className="absolute top-4 right-4 text-red-400 hover:bg-red-50 hover:text-red-600 p-1.5 rounded-lg transition-colors"
                                    title="Eliminar fila"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                                    {/* Controles Base */}
                                    <div className="md:col-span-4 flex flex-col gap-3">
                                        <select className="w-full text-sm font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-400 text-ellipsis" value={fila.region} onChange={(e) => handleFilaChange('region', e.target.value)} disabled={isClosed}>
                                            <option value="">-- Región --</option>
                                            <optgroup label="Miembro Superior"><option value="Hombro">Hombro</option><option value="Codo">Codo</option><option value="Muñeca/Mano">Muñeca/Mano</option><option value="Dedos">Dedos</option></optgroup>
                                            <optgroup label="Miembro Inferior"><option value="Cadera">Cadera</option><option value="Rodilla">Rodilla</option><option value="Tobillo">Tobillo</option><option value="Pie/Ortejos">Pie/Ortejos</option></optgroup>
                                            <optgroup label="Columna / Axial"><option value="Cervical">Cervical</option><option value="Torácica">Torácica</option><option value="Lumbar">Lumbar</option><option value="Pelvis/SI">Pelvis/SI</option><option value="ATM">ATM</option></optgroup>
                                            <option value="Otro">Otro/Personalizado...</option>
                                        </select>

                                        <select className="w-full text-xs font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-400 text-ellipsis" value={fila.lado} onChange={(e) => handleFilaChange('lado', e.target.value)} disabled={isClosed}>
                                            <option value="">-- Lado --</option>
                                            <option value="Derecho">Derecho</option>
                                            <option value="Izquierdo">Izquierdo</option>
                                            <option value="Bilateral">Bilateral comparativo</option>
                                            <option value="Axial">N/A (Axial/Central)</option>
                                        </select>

                                        <select className="w-full text-sm font-medium bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2.5 outline-none focus:border-indigo-400 text-ellipsis" value={fila.movimiento} onChange={(e) => handleFilaChange('movimiento', e.target.value)} disabled={isClosed}>
                                            <option value="">-- Movimiento --</option>
                                            <option value="Flexión">Flexión</option><option value="Extensión">Extensión</option><option value="Abducción">Abducción</option><option value="Aducción">Aducción</option><option value="Rotación Interna">Rotación Interna</option><option value="Rotación Externa">Rotación Externa</option><option value="Inclinación Lateral">Inclinación Lateral</option><option value="Rotación Axial">Rotación Axial</option><option value="Elevación">Elevación</option><option value="Depresión">Depresión</option><option value="Pronación">Pronación</option><option value="Supinación">Supinación</option><option value="Inversión">Inversión</option><option value="Eversión">Eversión</option><option value="Dorsiflexión">Dorsiflexión</option><option value="Plantiflexión">Plantiflexión</option><option value="Compuesto/Funcional">Gesto Compuesto/Funcional</option><option value="Otro">Otro/Personalizado...</option>
                                        </select>

                                        {/* Switches config */}
                                        <div className="flex flex-wrap gap-4 mt-2 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-500 border-slate-300" checked={fila.evalAct ?? true} onChange={(e) => handleFilaChange('evalAct', e.target.checked)} disabled={isClosed} />
                                                <span className="text-xs font-bold text-indigo-600">Activo</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 rounded text-orange-500 border-slate-300" checked={fila.evalPas} onChange={(e) => handleFilaChange('evalPas', e.target.checked)} disabled={isClosed} />
                                                <span className="text-xs font-bold text-orange-500">Pasivo</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 rounded text-slate-500 border-slate-300" checked={fila.usaGoniometro} onChange={(e) => handleFilaChange('usaGoniometro', e.target.checked)} disabled={isClosed} />
                                                <span className="text-xs font-bold text-slate-600">Con Goniómetro</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Inputs de Resultados */}
                                    <div className="md:col-span-8 flex flex-col gap-3 justify-center">
                                        {fila.lado === 'Bilateral' ? (
                                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                                {renderFields('DER')}
                                                {renderFields('IZQ')}
                                            </div>
                                        ) : (
                                            <div>
                                                {renderFields(fila.lado === 'Izquierdo' ? 'IZQ' : (fila.lado === 'Derecho' ? 'DER' : ''))}
                                            </div>
                                        )}

                                        {/* Orientación Docente */}
                                        {orientacionClinica && (
                                            <div className="mt-2 text-xs bg-indigo-50 text-indigo-700 p-3 rounded-lg flex items-start gap-2 border border-indigo-100">
                                                <span className="text-sm">💡</span>
                                                <div className="flex-1 font-medium">
                                                    <span className="font-bold opacity-80 uppercase text-[9px] tracking-widest block mb-0.5">Orientación para razonamiento (No diagnóstico)</span>
                                                    {orientacionClinica}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
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

                        <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-white shadow-sm w-full max-w-full">
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
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400 text-ellipsis" value={tejido.lado} onChange={(e) => handleTejidoChange('lado', e.target.value)} disabled={isClosed}>
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Elevación pierna recta (SLR)" value={tejido.prueba} onChange={(e) => handleTejidoChange('prueba', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400 text-ellipsis" value={tejido.resultado} onChange={(e) => handleTejidoChange('resultado', e.target.value)} disabled={isClosed}>
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
            <div className="bg-white border text-sm border-emerald-200 rounded-2xl shadow-sm flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-emerald-50/50 p-4 flex justify-between items-start border-b border-emerald-200">
                    <div>
                        <h3 className="font-bold text-emerald-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">🦾</span> <span className="flex-1">D. Fuerza y tolerancia a carga</span> <button type="button" onClick={() => setOpenHelp('D')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-600 font-bold hover:bg-indigo-100 transition-colors" title="Ayuda clínica">?</button>
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-emerald-900">
                            Pruebas manuales, isometría, dinamometría o tests funcionales
                        </p>
                    </div>

                </div>

                {irritabilidad === "Alta" && (
                    <div className="bg-red-50 border-b border-red-100 p-3 text-red-700 text-xs font-medium flex items-center gap-2">
                        <span className="text-sm">⚠️</span>
                        <span>Orientación: Prioriza carga dosificada y evita máximos si no son necesarios debido a la irritabilidad actual.</span>
                    </div>
                )}

                <div className="p-4 sm:p-5 flex flex-col gap-4 bg-slate-50/50">
                    {renderRecomendacionIA(recomendaciones?.fuerza_tolerancia_carga)}
                    {/* Controles de Lado Global */}
                    <div className="flex flex-col gap-3">
                        {(!exam.fuerzaCargaConfig?.filas || exam.fuerzaCargaConfig.filas.length === 0) ? (
                            <div className="p-8 text-center border-2 border-dashed border-emerald-200 rounded-xl bg-emerald-50/30">
                                <button
                                    onClick={() => {
                                        const configBase = exam.fuerzaCargaConfig || { filas: [] };
                                        const nuevaFila = {
                                            id: Date.now().toString(), region: '', lado: 'Derecho', tipoEvaluacion: '',
                                            dolorDurante: '', dolorPosterior: '', calidadEsfuerzo: '', observacion: ''
                                        };
                                        handleUpdateExam('fuerzaCargaConfig', { ...configBase, filas: [nuevaFila] });
                                    }}
                                    className="text-emerald-600 font-bold hover:text-emerald-700 transition"
                                    disabled={isClosed}
                                >
                                    + Comenzar Evaluación de Fuerza / Carga
                                </button>
                                <p className="text-xs text-slate-500 mt-2">Añade pruebas de fuerza, dinamometría o tests funcionales.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
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
                                            nuevasFilas[i].rfdData = [];
                                            nuevasFilas[i].cargaKg = '';
                                            nuevasFilas[i].velocidadEncoder = '';
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
                                        <div key={fila.id} className="bg-white border text-sm rounded-xl border-emerald-100 hover:border-emerald-300 transition-colors shadow-sm overflow-hidden flex flex-col group relative">
                                            {/* Header Corto (Región y Tipo) */}
                                            <div className="bg-emerald-50/50 p-3 border-b border-emerald-100 flex flex-wrap items-center gap-2 justify-between">
                                                <div className="flex flex-wrap items-center gap-2 flex-1 relative">
                                                    <input
                                                        type="text"
                                                        className="text-sm font-bold bg-white border border-slate-200 text-slate-800 rounded px-2 py-1 outline-none w-[140px] focus:border-emerald-400"
                                                        placeholder="Región/Gesto"
                                                        value={fila.region}
                                                        onChange={(e) => handleFilaChange('region', e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                    <select className="text-xs bg-white border border-slate-200 text-slate-600 font-bold rounded px-2 py-1 outline-none focus:border-emerald-400 text-ellipsis"
                                                        value={fila.lado}
                                                        onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                        disabled={isClosed}
                                                    >
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                        <option value="Axial">Axial</option>
                                                    </select>
                                                    <select className="text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold rounded px-2 py-1 outline-none focus:border-emerald-400 max-w-[180px] text-ellipsis"
                                                        value={fila.tipoEvaluacion}
                                                        onChange={(e) => handleFilaChange('tipoEvaluacion', e.target.value)}
                                                        disabled={isClosed}
                                                    >
                                                        <option value="">-- Seleccionar Tipo --</option>
                                                        <option value="Manual">Manual (MMT)</option>
                                                        <option value="Dinamometría Isométrica Máxima">Dinamometría Máx.</option>
                                                        <option value="Dinamometría Isométrica Submáxima">Dinamometría Submáx.</option>
                                                        <option value="Isometría mantenida">Isometría Mantenida</option>
                                                        <option value="Repeticiones submáximas">Reps Submáximas</option>
                                                        <option value="Test funcional de carga">Test Func. Carga</option>
                                                        <option value="Ejercicios con Carga (Encoder)">Carga + Encoder</option>
                                                    </select>
                                                    <button
                                                        onClick={() => {
                                                            const nuevasFilas = exam.fuerzaCargaConfig.filas.filter((_: any, idx: number) => idx !== i);
                                                            handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                                        }}
                                                        disabled={isClosed}
                                                        className="w-6 h-6 rounded bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 absolute right-0 top-0 bottom-0 my-auto"
                                                        title="Eliminar prueba"
                                                    >
                                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Contenido (Resultados + Dolor) */}
                                            <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Columna Resultados Específicos */}
                                                <div className="flex flex-col gap-2">
                                                    {!fila.tipoEvaluacion && (
                                                        <div className="text-xs text-slate-400 italic p-3 bg-slate-50 border border-slate-200 border-dashed rounded text-center">Selecciona un tipo de evaluación para ingresar resultados.</div>
                                                    )}
                                                    {fila.tipoEvaluacion === 'Manual' && (
                                                        <select className="w-full text-xs bg-white border border-slate-200 text-slate-700 font-bold rounded p-2 outline-none focus:border-emerald-400 text-ellipsis"
                                                            value={fila.resultado} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed}
                                                        >
                                                            <option value="">-- Escala MMT / MRC --</option>
                                                            <option value="5 Normal">5 - Normal (Vence resistencia máxima)</option>
                                                            <option value="4 Buena">4 - Buena (Vence resistencia moderada)</option>
                                                            <option value="3 Regular">3 - Regular (Vence gravedad)</option>
                                                            <option value="2 Deficiente">2 - Deficiente (Sin gravedad)</option>
                                                            <option value="1 Vestigio">1 - Vestigio (Contracción palpable)</option>
                                                            <option value="0 Nula">0 - Nula (Sin contracción)</option>
                                                        </select>
                                                    )}
                                                    {(fila.tipoEvaluacion === 'Dinamometría Isométrica Máxima' || fila.tipoEvaluacion === 'Dinamometría Isométrica Submáxima') && (
                                                        <div className="flex flex-col gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded">
                                                            <div className="flex gap-2 items-center">
                                                                <div className="flex-1 flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Der</span>
                                                                    <input type="number" step="0.1" className="w-full text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1 outline-none focus:border-emerald-400" value={fila.dinamometriaDer || ''} onChange={(e) => handleFilaChange('dinamometriaDer', e.target.value)} disabled={isClosed} />
                                                                </div>
                                                                <div className="flex-1 flex flex-col gap-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase text-center">Izq</span>
                                                                    <input type="number" step="0.1" className="w-full text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1 outline-none focus:border-emerald-400" value={fila.dinamometriaIzq || ''} onChange={(e) => handleFilaChange('dinamometriaIzq', e.target.value)} disabled={isClosed} />
                                                                </div>
                                                                <select className="w-14 items-end mt-4 text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-700 rounded p-1.5 outline-none text-ellipsis" value={fila.dinamometriaUnidad || 'Kg'} onChange={(e) => handleFilaChange('dinamometriaUnidad', e.target.value)} disabled={isClosed}>
                                                                    <option value="Kg">Kg</option><option value="N">N</option><option value="Lbs">Lbs</option>
                                                                </select>
                                                            </div>
                                                            {fila.diferenciaCalculada !== undefined && (
                                                                <div className="w-full flex items-center justify-between bg-emerald-50 px-2 py-1.5 rounded text-[11px] font-bold border border-emerald-200 text-emerald-800 mt-1 tracking-tight">
                                                                    <span>Déficit: {Math.abs(fila.diferenciaCalculada)}%</span>
                                                                    <span className="uppercase opacity-90">{fila.clasificacionAutomatica}</span>
                                                                </div>
                                                            )}

                                                            {/* BLOQUE RFD */}
                                                            <div className="w-full mt-2 bg-white rounded border border-emerald-100 p-1.5 flex flex-col gap-1">
                                                                <div className="flex justify-between items-center px-1">
                                                                    <span className="text-[10px] font-bold text-emerald-700">Explosividad (RFD)</span>
                                                                    <button
                                                                        onClick={() => {
                                                                            const nuevas = [...exam.fuerzaCargaConfig.filas];
                                                                            const currentRFD = nuevas[i].rfdData || [];
                                                                            nuevas[i].rfdData = [...currentRFD, { ms: '', valor: '' }];
                                                                            handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevas });
                                                                        }}
                                                                        disabled={isClosed}
                                                                        className="text-[9px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition"
                                                                    >
                                                                        + Tiempo
                                                                    </button>
                                                                </div>
                                                                {(fila.rfdData || []).map((rfd: any, idxRfd: number) => (
                                                                    <div key={idxRfd} className="flex gap-1 items-center bg-slate-50 p-1 rounded">
                                                                        <input
                                                                            type="number"
                                                                            placeholder="ms"
                                                                            className="w-12 text-[10px] text-center font-bold bg-white border border-slate-200 rounded p-1 outline-none focus:border-emerald-400"
                                                                            value={rfd.ms || ''}
                                                                            onChange={(e) => {
                                                                                const nuevas = [...exam.fuerzaCargaConfig.filas];
                                                                                if (!nuevas[i].rfdData) nuevas[i].rfdData = [];
                                                                                nuevas[i].rfdData[idxRfd].ms = e.target.value;
                                                                                handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevas });
                                                                            }}
                                                                            disabled={isClosed}
                                                                        />
                                                                        <span className="text-[9px] text-slate-400 font-bold mx-0.5 mt-0.5">ms</span>
                                                                        <input
                                                                            type="number"
                                                                            step="0.1"
                                                                            placeholder="Fuerza"
                                                                            className="flex-1 text-[10px] text-center font-bold bg-white border border-slate-200 rounded p-1 outline-none focus:border-emerald-400"
                                                                            value={rfd.valor || ''}
                                                                            onChange={(e) => {
                                                                                const nuevas = [...exam.fuerzaCargaConfig.filas];
                                                                                if (!nuevas[i].rfdData) nuevas[i].rfdData = [];
                                                                                nuevas[i].rfdData[idxRfd].valor = e.target.value;
                                                                                handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevas });
                                                                            }}
                                                                            disabled={isClosed}
                                                                        />
                                                                        <button
                                                                            onClick={() => {
                                                                                const nuevas = [...exam.fuerzaCargaConfig.filas];
                                                                                nuevas[i].rfdData = nuevas[i].rfdData.filter((_: any, index: number) => index !== idxRfd);
                                                                                handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevas });
                                                                            }}
                                                                            className="text-red-400 hover:text-red-600 p-0.5"
                                                                            disabled={isClosed}
                                                                        >
                                                                            ×
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {fila.tipoEvaluacion === 'Ejercicios con Carga (Encoder)' && (
                                                        <div className="flex bg-slate-50/50 p-2 border border-slate-100 rounded gap-2 items-center">
                                                            <div className="flex-1 flex flex-col gap-1">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Carga (Kg)</span>
                                                                <input type="number" step="0.5" className="w-full text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.cargaKg || ''} onChange={(e) => handleFilaChange('cargaKg', e.target.value)} disabled={isClosed} />
                                                            </div>
                                                            <div className="flex-1 flex flex-col gap-1">
                                                                <span className="text-[9px] font-bold text-slate-400 uppercase text-center">Velocidad (m/s)</span>
                                                                <input type="number" step="0.01" className="w-full text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.velocidadEncoder || ''} onChange={(e) => handleFilaChange('velocidadEncoder', e.target.value)} disabled={isClosed} />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {fila.tipoEvaluacion === 'Isometría mantenida' && (
                                                        <div className="flex flex-col gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[70px]">Tiempo:</span>
                                                                <input type="number" placeholder="Seg" className="w-[80px] shrink-0 text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1 outline-none focus:border-emerald-400" value={fila.isometriaSegundos || ''} onChange={(e) => handleFilaChange('isometriaSegundos', e.target.value)} disabled={isClosed} />
                                                                <span className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">seg</span>
                                                            </div>
                                                            <input type="text" placeholder="Motivo de corte (ej. Dolor / Fatiga)" className="w-full text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.isometriaMotivo || ''} onChange={(e) => handleFilaChange('isometriaMotivo', e.target.value)} disabled={isClosed} />
                                                        </div>
                                                    )}
                                                    {fila.tipoEvaluacion === 'Repeticiones submáximas' && (
                                                        <div className="flex flex-col gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide w-[70px]">Reps:</span>
                                                                <input type="number" className="w-[80px] shrink-0 text-sm text-center font-bold bg-white border border-slate-200 text-slate-800 rounded p-1 outline-none focus:border-emerald-400" value={fila.repeticionesN || ''} onChange={(e) => handleFilaChange('repeticionesN', e.target.value)} disabled={isClosed} />
                                                            </div>
                                                            <select className="w-full text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400 text-ellipsis" value={fila.repeticionesCorte || ''} onChange={(e) => handleFilaChange('repeticionesCorte', e.target.value)} disabled={isClosed}>
                                                                <option value="">-- Criterio de detención --</option>
                                                                <option value="Fatiga muscular">Fatiga muscular</option>
                                                                <option value="Pérdida de técnica">Pérdida de técnica</option>
                                                                <option value="Dolor inaceptable">Dolor inaceptable</option>
                                                                <option value="Miedo/Aprehensión">Miedo/Aprehensión</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                    {fila.tipoEvaluacion === 'Test funcional de carga' && (
                                                        <div className="flex flex-col gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded">
                                                            <input type="text" placeholder="Nombre (ej. Hop Test...)" className="w-full text-xs bg-white border border-slate-200 text-slate-800 rounded font-bold p-1.5 outline-none focus:border-emerald-400" value={fila.testFuncionalNombre || ''} onChange={(e) => handleFilaChange('testFuncionalNombre', e.target.value)} disabled={isClosed} />
                                                            <input type="text" placeholder="Resultado / Criterio visual observado" className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:border-emerald-400" value={fila.resultado || ''} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Columna Síntomas y Calidad */}
                                                <div className="flex flex-col gap-2 md:border-l md:border-slate-100 pl-0 md:pl-4 justify-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Durante:</span>
                                                        <select className="flex-1 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:bg-white focus:border-emerald-400 text-ellipsis"
                                                            value={fila.dolorDurante} onChange={(e) => handleFilaChange('dolorDurante', e.target.value)} disabled={isClosed}
                                                        >
                                                            <option value="">No duele</option>
                                                            <option value="Leve">S/S Leve</option>
                                                            <option value="Moderado">S/S Moderado</option>
                                                            <option value="Alto">S/S Alto</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Después:</span>
                                                        <select className="flex-1 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:bg-white focus:border-emerald-400 text-ellipsis"
                                                            value={fila.dolorPosterior} onChange={(e) => handleFilaChange('dolorPosterior', e.target.value)} disabled={isClosed}
                                                        >
                                                            <option value="">No repercute</option>
                                                            <option value="Sí breve">Reperc. Breve</option>
                                                            <option value="Sí persistente">Reperc. Prolongada</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Calidad:</span>
                                                        <select className="flex-1 text-[11px] bg-slate-50 border border-slate-200 text-slate-700 rounded p-1.5 outline-none focus:bg-white focus:border-emerald-400 text-ellipsis"
                                                            value={fila.calidadEsfuerzo} onChange={(e) => handleFilaChange('calidadEsfuerzo', e.target.value)} disabled={isClosed}
                                                        >
                                                            <option value="">-- Calidad Mov. --</option>
                                                            <option value="Buena">Buena</option>
                                                            <option value="Compensa">Compensa</option>
                                                            <option value="Inhibido por dolor">Inhibido p/dolor</option>
                                                            <option value="Inconsistente">Téc. incosistente</option>
                                                            <option value="Fatiga temprana">Fatiga temprana</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Fila Observaciones */}
                                            <div className="px-3 pb-3 border-t border-slate-50 pt-2 bg-slate-50/50">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 outline-none focus:border-emerald-400"
                                                    placeholder="Añadir nota breve (ej. 'Compensa elevando hombro')..."
                                                    value={fila.observacion}
                                                    onChange={(e) => handleFilaChange('observacion', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Acciones */}
                {exam.fuerzaCargaConfig?.filas?.length > 0 && (
                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-center">
                        <button
                            onClick={() => {
                                const configBase = exam.fuerzaCargaConfig || { filas: [] };
                                const nuevaFila = {
                                    id: Date.now().toString(), region: '', lado: 'Derecho', tipoEvaluacion: '',
                                    dolorDurante: '', dolorPosterior: '', calidadEsfuerzo: '', observacion: ''
                                };
                                handleUpdateExam('fuerzaCargaConfig', { ...configBase, filas: [...configBase.filas, nuevaFila] });
                            }}
                            disabled={isClosed}
                            className="text-sm font-bold text-emerald-600 bg-white border border-emerald-200 px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            <span>+</span> Añadir Prueba de Fuerza/Carga
                        </button>
                    </div>
                )}
            </div>

            {/* E. PALPACIÓN */}
            <div className="bg-white rounded-2xl shadow-sm border border-amber-200 flex flex-col">
                <div className="bg-amber-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-xl shrink-0">🖐️</div>
                        <div>
                            <h3 className="font-bold text-amber-900 text-lg">E. Palpación</h3>
                            <p className="text-xs text-amber-700/80 mt-0.5">Temperatura, derrame, sensibilidad tisular, dolor focal</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setOpenHelp('E')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-amber-200 bg-white text-amber-600 font-bold hover:bg-amber-100 transition-colors" title="Ayuda clínica">?</button>
                </div>

                <div className="p-4 grid grid-cols-1 gap-4 bg-slate-50/50">
                    {renderRecomendacionIA(recomendaciones?.palpacion)}
                    {(!exam.palpacionConfig?.filas || exam.palpacionConfig.filas.length === 0) && (
                        <div className="p-8 text-center text-slate-400 italic font-medium text-sm rounded-xl border border-dashed border-slate-200 bg-white">
                            Bloque vacío. Presiona "+ Añadir Hallazgo" para documentar.
                        </div>
                    )}
                    {(exam.palpacionConfig?.filas || []).map((fila: any, i: number) => {
                        const handleChange = (k: string, v: any) => {
                            const m = [...exam.palpacionConfig.filas];
                            m[i] = { ...m[i], [k]: v };
                            handleUpdateExam('palpacionConfig', { filas: m });
                        };
                        return (
                            <div key={fila.id} className="bg-white border text-sm rounded-xl border-amber-100 hover:border-amber-300 transition-colors shadow-sm overflow-hidden flex flex-col group relative">
                                {/* Encabezado Tarjeta */}
                                <div className="bg-amber-50/50 p-2 sm:p-3 border-b border-amber-100 flex items-start justify-between">
                                    <div className="flex-1 pr-8">
                                        <input
                                            className="w-full text-sm font-bold bg-white border border-slate-200 text-slate-800 rounded px-2 py-1.5 outline-none focus:border-amber-400"
                                            value={fila.estructura || ''}
                                            onChange={e => handleChange('estructura', e.target.value)}
                                            disabled={isClosed}
                                            placeholder="Estructura anatómica (Ej. LCI, tendón rotuliano)"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const m = exam.palpacionConfig.filas.filter((_: any, index: number) => index !== i);
                                            handleUpdateExam('palpacionConfig', { filas: m });
                                        }}
                                        disabled={isClosed}
                                        className="w-7 h-7 shrink-0 rounded bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 absolute right-2 top-2"
                                        title="Eliminar fila"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                                {/* Cuerpo Tarjeta - Grid 2 Columnas Movil */}
                                <div className="p-3 bg-white">
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">Hallazgo Principal</label>
                                            <select className="w-full text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded p-2 outline-none focus:bg-white focus:border-amber-400 text-ellipsis"
                                                value={fila.hallazgoPrincipal || ''}
                                                onChange={e => handleChange('hallazgoPrincipal', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="">-- Seleccionar Hallazgo --</option>
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
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">Lado</label>
                                            <select className="w-full text-xs font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded p-2 outline-none focus:bg-white focus:border-amber-400 text-ellipsis"
                                                value={fila.lado || 'Derecho'}
                                                onChange={e => handleChange('lado', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="">-- Lado --</option>
                                                <option value="Derecho">Derecho</option>
                                                <option value="Izquierdo">Izquierdo</option>
                                                <option value="Bilateral">Bilateral</option>
                                                <option value="N/A">N/A (Axial/Centro)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap sm:grid sm:grid-cols-3 gap-3">
                                        <div className="flex-1 min-w-[70px] flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">Dolor EVA</label>
                                            <input
                                                type="number"
                                                min="0"
                                                max="10"
                                                placeholder="0-10"
                                                className="w-full text-xs font-bold text-center bg-slate-50 border border-slate-200 text-slate-700 rounded p-2 outline-none focus:bg-white focus:border-amber-400"
                                                value={fila.dolor || ''}
                                                onChange={e => handleChange('dolor', e.target.value)}
                                                disabled={isClosed}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-[80px] flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">Edema</label>
                                            <select className="w-full text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded p-2 outline-none focus:bg-white focus:border-amber-400 text-ellipsis"
                                                value={fila.edema || 'Normal'}
                                                onChange={e => handleChange('edema', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="Leve">Leve</option>
                                                <option value="Fóvea">Fóvea</option>
                                                <option value="Intenso">Intenso</option>
                                            </select>
                                        </div>
                                        <div className="flex-1 min-w-[80px] flex flex-col gap-1">
                                            <label className="text-[10px] uppercase font-bold text-slate-400">Temperatura</label>
                                            <select className="w-full text-[11px] font-bold bg-slate-50 border border-slate-200 text-slate-700 rounded p-2 outline-none focus:bg-white focus:border-amber-400 text-ellipsis"
                                                value={fila.temperatura || 'Normal'}
                                                onChange={e => handleChange('temperatura', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="Normal">Normal</option>
                                                <option value="Caliente">Caliente</option>
                                                <option value="Frío">Fría</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="px-3 pb-3 border-t border-slate-50 pt-2 bg-slate-50/50">
                                    <textarea
                                        className="w-full text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 outline-none focus:border-amber-400 min-h-[40px] resize-none"
                                        placeholder="Descripción libre y matices clínicos breves..."
                                        value={fila.observacion || ''}
                                        onChange={e => handleChange('observacion', e.target.value)}
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>
                        )
                    })}
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


                    <div className="flex flex-col gap-2 mt-2">
                        <label className="text-xs font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                            <span className="text-lg">🦴</span> Movilidad Accesoria / Componentes Articulares
                        </label>
                        <textarea
                            className="w-full text-sm bg-orange-50/30 border border-amber-200 text-slate-700 rounded p-3 outline-none focus:border-amber-400 min-h-[60px]"
                            placeholder="Ej. Hipomovilidad PA en C5-C6 dolorosa. Hiperlaxitud grado II en LLI sin tope blando..."
                            value={exam.palpacionConfig?.movilidadAccesoria || ''}
                            onChange={(e) => handleUpdateExam('palpacionConfig', { ...exam.palpacionConfig, movilidadAccesoria: e.target.value })}
                            disabled={isClosed}
                        />
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
            <div className="bg-white rounded-2xl shadow-sm border border-rose-200 flex flex-col">
                <div onClick={() => setIsNeuroOpen(!isNeuroOpen)} className="bg-rose-50/50 hover:bg-rose-100/50 cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rose-100 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-xl shrink-0">🧠</div>
                        <div>
                            <h3 className="font-bold text-rose-900 text-lg flex items-center gap-2">F. Neurológico / vascular / somatosensorial <button type="button" onClick={() => setOpenHelp('F')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-100 transition-colors" title="Ayuda clínica">?</button></h3>
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
                    <div className="p-0 flex flex-col gap-0 bg-slate-50">
                        <div className="p-4 sm:p-5 pb-0 bg-white">
                            {renderRecomendacionIA(recomendaciones?.neuro_vascular_somatosensorial)}
                        </div>
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
                                <button type="button" onClick={() => setOpenHelp('F')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-rose-200 bg-white text-rose-600 font-bold hover:bg-rose-100 transition-colors" title="Ayuda clínica">?</button>
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
            <div className="bg-white rounded-2xl shadow-sm border border-teal-200 flex flex-col">
                <div className="bg-teal-50/50 p-4 sm:p-5 flex items-center justify-between gap-4 border-b border-teal-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center text-xl shrink-0">🧘</div>
                        <div>
                            <h3 className="font-bold text-teal-900 text-lg">G. Control motor y estabilidad funcional</h3>
                            <p className="text-xs text-teal-700/80 mt-0.5">Control segmentario, lumbopélvico, escapular, balance, gesto</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setOpenHelp('G')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-teal-200 bg-white text-teal-600 font-bold hover:bg-teal-100 transition-colors" title="Ayuda clínica">?</button>
                </div>
                <div className="p-4 sm:p-5 flex flex-col gap-4 bg-slate-50/50">
                    {renderRecomendacionIA(recomendaciones?.control_motor_sensoriomotor)}
                    {(!exam.controlMotorConfig?.filas || exam.controlMotorConfig.filas.length === 0) ? (
                        <div className="p-8 text-center border-2 border-dashed border-teal-200 rounded-xl bg-teal-50/30">
                            <button
                                onClick={() => {
                                    const m = exam.controlMotorConfig || { filas: [] };
                                    handleUpdateExam('controlMotorConfig', { filas: [...m.filas, { id: Date.now().toString(), regionTarea: '', tipoTarea: '', sintoma: '', calidad: '', compensacion: '', observacion: '' }] });
                                }}
                                className="text-teal-600 font-bold hover:text-teal-700 transition outline-none"
                                disabled={isClosed}
                            >
                                + Evaluar Control Motor
                            </button>
                            <p className="text-xs text-slate-500 mt-2">Añade tareas de balance, control lumbopélvico, aterrizaje, etc.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {(exam.controlMotorConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.controlMotorConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('controlMotorConfig', { filas: m });
                                };
                                return (
                                    <div key={fila.id} className="bg-white border text-sm rounded-xl border-teal-100 hover:border-teal-300 transition-colors shadow-sm overflow-hidden flex flex-col group relative">
                                        {/* Header */}
                                        <div className="bg-teal-50/50 p-2 sm:p-3 border-b border-teal-100 flex items-start justify-between">
                                            <div className="flex-1 pr-8">
                                                <input
                                                    className="w-full text-sm font-bold bg-white border border-slate-200 text-slate-800 rounded px-2 py-1.5 outline-none focus:border-teal-400 mb-2"
                                                    value={fila.regionTarea || ''} onChange={e => handleChange('regionTarea', e.target.value)} disabled={isClosed} placeholder="Región o Tarea Específica (Ej. Y-Balance, Salto Bipodal)"
                                                />
                                                <div className="flex flex-wrap gap-2">
                                                    <select
                                                        className="text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded px-2 py-1.5 outline-none focus:border-teal-400 min-w-[120px]"
                                                        value={fila.tipoTarea || ''} onChange={e => handleChange('tipoTarea', e.target.value)} disabled={isClosed}
                                                    >
                                                        <option value="">-- Familia de tarea --</option>
                                                        <option value="Control segmentario local">Control segmentario local</option>
                                                        <option value="Control lumbopélvico">Control lumbopélvico</option>
                                                        <option value="Control escapular">Control escapular</option>
                                                        <option value="Balance / postura">Balance / postura</option>
                                                        <option value="Desaceleración / aterrizaje">Desaceleración / aterrizaje</option>
                                                        <option value="Control unipodal">Control unipodal</option>
                                                        <option value="Gesto deportivo">Gesto deportivo específico</option>
                                                        <option value="Otro">Otro...</option>
                                                    </select>
                                                    
                                                    {['Control unipodal', 'Control segmentario local', 'Control escapular', 'Desaceleración / aterrizaje'].includes(fila.tipoTarea) && (
                                                        <select
                                                            className="text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded px-2 py-1.5 outline-none focus:border-teal-400 min-w-[100px]"
                                                            value={fila.ladoMotor || ''} onChange={e => handleChange('ladoMotor', e.target.value)} disabled={isClosed}
                                                        >
                                                            <option value="">Lado apoyado/activo</option>
                                                            <option value="Derecho">Derecho</option>
                                                            <option value="Izquierdo">Izquierdo</option>
                                                            <option value="Bilateral">Ambos/Bilateral</option>
                                                        </select>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const m = exam.controlMotorConfig.filas.filter((_: any, index: number) => index !== i);
                                                    handleUpdateExam('controlMotorConfig', { filas: m });
                                                }}
                                                className="w-7 h-7 shrink-0 rounded bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 absolute right-2 top-2"
                                                disabled={isClosed} title="Eliminar fila"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                        {/* Grid Detalles */}
                                        <div className="p-3 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Síntoma:</span>
                                                <select className="flex-1 text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-teal-400 font-bold text-slate-700 text-ellipsis"
                                                    value={fila.sintoma || ''} onChange={e => handleChange('sintoma', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Estado --</option>
                                                    <option value="Sin síntomas">Sin síntomas</option>
                                                    <option value="Dolor leve">Dolor leve</option>
                                                    <option value="Dolor limitante">Dolor limitante</option>
                                                    <option value="Inseguridad / Miedo">Inseguridad / Miedo</option>
                                                    <option value="Fatiga">Fatiga</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Calidad:</span>
                                                <select className="flex-1 text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-teal-400 font-medium text-ellipsis"
                                                    value={fila.calidad || ''} onChange={e => handleChange('calidad', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Seleccionar --</option>
                                                    <option value="Óptima">Óptima</option>
                                                    <option value="Adecuada (compensa leve)">Adecuada (c/leve compens.)</option>
                                                    <option value="Deficiente">Deficiente</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] uppercase font-bold text-slate-500 w-[60px]">Compens.:</span>
                                                <select className="flex-1 text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-teal-400 font-medium text-ellipsis"
                                                    value={fila.compensacion || ''} onChange={e => handleChange('compensacion', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Ninguna --</option>
                                                    <option value="Valgo dinámico">Valgo dinámico</option>
                                                    <option value="Hip drop">Hip drop</option>
                                                    <option value="Rigidez">Rigidez</option>
                                                    <option value="Wobble">Wobble</option>
                                                    <option value="Pérdida de disociación">Pérdida disociación</option>
                                                    <option value="Control deficiente">Control deficiente</option>
                                                    <option value="Miedo al movimiento">Miedo / Precaución</option>
                                                    <option value="Estrategia antálgica">Antalgia</option>
                                                    <option value="Otro">Otro...</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="px-3 pb-3 border-t border-slate-50 pt-2 bg-slate-50/50">
                                            <input
                                                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-teal-400 bg-white"
                                                placeholder="Observación breve (ej. Corrigió con feedback)..."
                                                value={fila.observacion || ''} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="bg-slate-50 p-4 border-t border-slate-200 flex">
                    <button onClick={() => {
                        const m = exam.controlMotorConfig || { filas: [] };
                        handleUpdateExam('controlMotorConfig', { filas: [...m.filas, { id: Date.now().toString(), regionTarea: '', tipoTarea: '', sintoma: '', calidad: '', compensacion: '', observacion: '' }] });
                    }} disabled={isClosed} className="text-sm font-bold text-teal-600 bg-white border border-teal-200 px-4 py-2 rounded shadow-sm hover:bg-teal-50 flex items-center gap-2 transition outline-none">
                        <span>+</span> Añadir Tarea Motora
                    </button>
                </div>
            </div>

            {/* H. PRUEBAS ORTOPÉDICAS */}
            <div className="bg-white rounded-2xl shadow-sm border border-sky-200 flex flex-col">
                <div className="bg-sky-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-sky-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center text-xl shrink-0">⚖️</div>
                        <div>
                            <h3 className="font-bold text-sky-900 text-lg">Pruebas ortopédicas dirigidas</h3>
                            <p className="text-xs text-sky-700/80 mt-0.5">Úsalas solo si aportan algo después de la entrevista y del resto del examen físico.</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setOpenHelp('H')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-sky-200 bg-white text-sky-600 font-bold hover:bg-sky-100 transition-colors" title="Ayuda clínica">?</button>
                </div>

                <div className="p-4 bg-sky-50/30 border-b border-sky-100">
                    <p className="text-sm font-medium text-sky-700">
                        💡 Elige pocas pruebas y solo si pueden cambiar tu razonamiento.
                    </p>
                </div>

                <div className="p-4 flex flex-col gap-4 bg-slate-50/50">
                    {renderRecomendacionIA(recomendaciones?.pruebas_ortopedicas_dirigidas)}
                    {(!exam.ortopedicasConfig?.filas || exam.ortopedicasConfig.filas.length === 0) ? (
                        <div className="p-8 text-center border-2 border-dashed border-sky-200 rounded-xl bg-white">
                            <p className="text-sm font-bold text-sky-800 mb-2">No hay pruebas asociadas</p>
                            <p className="text-xs text-slate-500 mb-4">Agrega test ortopédicos específicos a evaluar.</p>
                            <button
                                onClick={() => {
                                    const m = exam.ortopedicasConfig?.filas || [];
                                    const regionDefault = v4?.focos?.[0]?.region || '';
                                    const ladoDefault = v4?.focos?.[0]?.lado || '';
                                    handleUpdateExam('ortopedicasConfig', { filas: [...m, { id: Date.now().toString(), region: regionDefault, hipotesis: '', test_name: '', side: ladoDefault, result: '', symptom_relation: '', optional_reason: '', comment: '' }] });
                                }}
                                className="text-sky-600 font-bold hover:text-sky-700 transition outline-none bg-sky-50 px-4 py-2 rounded-lg border border-sky-200"
                                disabled={isClosed}
                            >
                                + Agregar prueba
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {(exam.ortopedicasConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.ortopedicasConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('ortopedicasConfig', { filas: m });
                                };

                                const suggestionsByRegion: Record<string, string[]> = {
                                    'hombro': ['Hawkins', 'Neer', 'ER lag', 'Belly press', 'Speed', 'O\'Brien', 'Drop arm'],
                                    'codo': ['Cozens', 'Mills', 'Valgus stress', 'Varus stress', 'Tinel'],
                                    'muñeca / mano': ['Finkelstein', 'Phalen', 'Tinel', 'Froment'],
                                    'cervical': ['Spurling', 'Distracción', '1er Costilla', 'Lhermitte'],
                                    'torácico': ['Slump', 'Expansión torácica'],
                                    'lumbar': ['Slump', 'SLR', 'Prone Instability', 'Extensión-Rotación'],
                                    'cadera': ['FABER', 'FADIR', 'Ober', 'Thomas'],
                                    'rodilla': ['Thessaly', 'Lachman', 'Valgo (0°, 30°)', 'Varo (0°, 30°)', 'McMurray', 'Pivot shift'],
                                    'tobillo / pie': ['Cajón anterior', 'Talar tilt', 'Thompson', 'Squeeze test', 'Windlass']
                                };
                                const testSuggestions = suggestionsByRegion[(fila.region || '').toLowerCase()] || [];

                                return (
                                    <div key={fila.id} className="bg-white border text-sm rounded-xl border-sky-100 hover:border-sky-300 transition-colors shadow-sm overflow-hidden flex flex-col group relative">
                                        <div className="absolute right-2 top-2 z-10">
                                            <button
                                                onClick={() => {
                                                    const m = exam.ortopedicasConfig.filas.filter((_: any, index: number) => index !== i);
                                                    handleUpdateExam('ortopedicasConfig', { filas: m });
                                                }}
                                                className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100"
                                                disabled={isClosed} title="Eliminar prueba"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>

                                        <div className="bg-sky-50/50 p-3 flex flex-wrap gap-3 items-start pr-10 border-b border-sky-100">
                                            <div className="flex flex-col flex-1 min-w-[120px]">
                                                <label className="text-[10px] uppercase font-bold text-sky-600 mb-1">Región</label>
                                                <input
                                                    type="text" list={`orto-region-${fila.id}`}
                                                    className="text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded px-2 py-1.5 outline-none focus:border-sky-400"
                                                    value={fila.region || ''} onChange={e => handleChange('region', e.target.value)} disabled={isClosed} placeholder="-- Región --"
                                                />
                                                <datalist id={`orto-region-${fila.id}`}>
                                                    <option value="hombro" />
                                                    <option value="codo" />
                                                    <option value="muñeca / mano" />
                                                    <option value="cervical" />
                                                    <option value="torácica" />
                                                    <option value="lumbar" />
                                                    <option value="cadera" />
                                                    <option value="rodilla" />
                                                    <option value="tobillo / pie" />
                                                </datalist>
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-[140px]">
                                                <label className="text-[10px] uppercase font-bold text-sky-600 mb-1">Hipótesis</label>
                                                <input
                                                    type="text" list={`orto-hipotesis-${fila.id}`}
                                                    className="text-xs font-bold bg-white border border-slate-200 text-slate-700 rounded px-2 py-1.5 outline-none focus:border-sky-400"
                                                    value={fila.hipotesis || ''} onChange={e => handleChange('hipotesis', e.target.value)} disabled={isClosed} placeholder="-- Hipótesis --"
                                                />
                                                <datalist id={`orto-hipotesis-${fila.id}`}>
                                                    <option value="tejido contráctil" />
                                                    <option value="tejido articular / capsular" />
                                                    <option value="inestabilidad ligamentaria" />
                                                    <option value="dolor meniscal / intraarticular" />
                                                    <option value="tendinopatía" />
                                                    <option value="dolor referido / radicular" />
                                                    <option value="compromiso neural" />
                                                    <option value="conflicto mecánico / pinzamiento" />
                                                </datalist>
                                            </div>
                                            <div className="flex flex-col flex-1 min-w-[140px]">
                                                <label className="text-[10px] uppercase font-bold text-sky-600 mb-1">Motivo (Opcional)</label>
                                                <input
                                                    type="text" list={`orto-motivo-${fila.id}`}
                                                    className="text-[11px] bg-white border border-slate-200 text-slate-600 rounded px-2 py-1.5 outline-none focus:border-sky-400"
                                                    value={fila.optional_reason || ''} onChange={e => handleChange('optional_reason', e.target.value)} disabled={isClosed} placeholder="-- Opcional --"
                                                />
                                                <datalist id={`orto-motivo-${fila.id}`}>
                                                    <option value="descartar" />
                                                    <option value="acercar confirmación" />
                                                    <option value="aclarar estructura" />
                                                    <option value="comparar" />
                                                    <option value="irritabilidad" />
                                                </datalist>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div className="flex flex-col lg:col-span-2">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Nombre del test / Lado</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text" list={`orto-list-${fila.id}`}
                                                        className="flex-1 text-sm bg-white border border-slate-200 text-slate-800 font-bold rounded px-2 py-1.5 outline-none focus:border-sky-400 min-w-[100px]"
                                                        value={fila.test_name || fila.test || ''} onChange={e => handleChange('test_name', e.target.value)} disabled={isClosed} placeholder="Ej. Neer"
                                                    />
                                                    <datalist id={`orto-list-${fila.id}`}>
                                                        {testSuggestions.map(s => <option key={s} value={s} />)}
                                                    </datalist>
                                                    <select
                                                        className="min-w-[90px] text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded px-2 py-1.5 outline-none focus:border-sky-400"
                                                        value={fila.side || fila.lado || ''} onChange={e => handleChange('side', e.target.value)} disabled={isClosed}
                                                    >
                                                        <option value="">Lado...</option>
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                        <option value="Axial">Axial</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Resultado</label>
                                                <select className="flex-1 text-xs font-bold rounded p-1.5 border outline-none focus:ring-1 focus:ring-sky-400 bg-slate-50 text-slate-700 text-ellipsis"
                                                    value={fila.result || fila.resultado || ''} onChange={e => handleChange('result', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Resultado --</option>
                                                    <option value="positivo">Positivo (+)</option>
                                                    <option value="negativo">Negativo (-)</option>
                                                    <option value="dudoso">Dudoso</option>
                                                    <option value="no concluyente">No concluyente</option>
                                                    <option value="no tolerado">No tolerado</option>
                                                </select>
                                            </div>

                                            <div className="flex flex-col">
                                                <label className="text-[10px] uppercase font-bold text-slate-500 mb-1">Síntoma</label>
                                                <select className="flex-1 text-xs font-bold rounded p-1.5 border outline-none focus:ring-1 focus:ring-sky-400 bg-slate-50 text-slate-700 text-ellipsis"
                                                    value={fila.symptom_relation || fila.reproduceTexto || ''} onChange={e => handleChange('symptom_relation', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Reproducción --</option>
                                                    <option value="reproduce claramente">Reproduce claramente</option>
                                                    <option value="reproduce parcialmente">Reproduce parcialmente</option>
                                                    <option value="dolor distinto">Dolor distinto</option>
                                                    <option value="solo tensión">Solo tensión</option>
                                                    <option value="no reproduce">No reproduce</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="px-3 pb-3 pt-2 bg-slate-50/50">
                                            <input
                                                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-400 bg-white"
                                                placeholder="Comentario breve..."
                                                value={fila.comment || fila.comentario || ''} onChange={e => handleChange('comment', e.target.value)} disabled={isClosed}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            <div className="mt-2 flex justify-start">
                                <button
                                    onClick={() => {
                                        const m = exam.ortopedicasConfig?.filas || [];
                                        const regionDefault = v4?.focos?.[0]?.region || '';
                                        const ladoDefault = v4?.focos?.[0]?.lado || '';
                                        handleUpdateExam('ortopedicasConfig', { filas: [...m, { id: Date.now().toString(), region: regionDefault, hipotesis: '', test_name: '', side: ladoDefault, result: '', symptom_relation: '', optional_reason: '', comment: '' }] });
                                    }}
                                    className="text-[12px] font-bold text-sky-600 bg-white border border-sky-200 px-4 py-2 rounded-lg shadow-sm hover:bg-sky-50 transition outline-none flex items-center gap-2"
                                    disabled={isClosed}
                                >
                                    <span>+</span> Agregar prueba
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200">
                    <details className="group">
                        <summary className="text-xs font-bold text-sky-700 cursor-pointer list-none flex items-center gap-2 select-none">
                            <span className="w-5 h-5 rounded bg-sky-100 flex items-center justify-center transition-transform group-open:rotate-90">▶</span>
                            Añadir lectura clínica final (Opcional)
                        </summary>
                        <div className="mt-3 pl-7">
                            <input
                                className="w-full text-sm p-3 border border-slate-200 rounded-lg outline-none focus:border-sky-400 bg-white shadow-sm"
                                placeholder="Síntesis / Lectura integrada de estas pruebas (Opcional)..."
                                value={exam.ortopedicasConfig?.sintesisFinal || ''} onChange={(e) => handleUpdateExam('ortopedicasConfig', { ...exam.ortopedicasConfig, sintesisFinal: e.target.value })} disabled={isClosed}
                            />
                        </div>
                    </details>
                </div>
            </div>

            {/* I. PRUEBAS FUNCIONALES, CAPACIDAD Y REINTEGRO */}
            <div className="bg-white rounded-2xl shadow-sm border border-orange-200 flex flex-col">
                <div className="bg-orange-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-xl shrink-0">🏃</div>
                        <div>
                            <h3 className="font-bold text-orange-900 text-lg">I. Pruebas funcionales, capacidad y reintegro</h3>
                            <p className="text-xs text-orange-700/80 mt-0.5">Evaluación orientada al rendimiento y seguimiento analítico</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-orange-700">Objetivo Principal:</span>
                            <select className="text-xs p-2 border border-orange-200 rounded-md bg-white text-orange-900 outline-none focus:border-orange-400 font-bold text-ellipsis"
                                value={exam.funcionalesConfig?.objetivo || ''}
                                onChange={e => handleUpdateExam('funcionalesConfig', { ...(exam.funcionalesConfig || {}), objetivo: e.target.value })}
                                disabled={isClosed}
                            >
                                <option value="">Selección general</option>
                                <option value="Vida diaria">Vida diaria</option>
                                <option value="Gimnasio">Gimnasio</option>
                                <option value="Carrera">Carrera</option>
                                <option value="Salto/Aterrizaje">Salto / Aterrizaje</option>
                                <option value="Cambio de dirección">Cambio de dirección</option>
                                <option value="Reintegro deportivo">Reintegro deportivo</option>
                                <option value="Preventivo">Preventivo / Carga</option>
                            </select>
                        </div>
                        <button type="button" onClick={() => setOpenHelp('I')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-orange-200 bg-white text-orange-600 font-bold hover:bg-orange-100 transition-colors" title="Ayuda clínica">?</button>
                    </div>
                </div>
                <div className="p-4 flex flex-col gap-4 bg-slate-50/50">
                    {renderRecomendacionIA(recomendaciones?.pruebas_funcionales_reintegro)}
                    {(!exam.funcionalesConfig?.filas || exam.funcionalesConfig.filas.length === 0) ? (
                        <div className="p-8 text-center border-2 border-dashed border-orange-200 rounded-xl bg-orange-50/30">
                            <button
                                onClick={() => {
                                    const baseConfig = exam.funcionalesConfig || { objetivo: '', filas: [] };
                                    handleUpdateExam('funcionalesConfig', { ...baseConfig, filas: [...(baseConfig.filas || []), { id: Date.now().toString(), test: '', lado: 'Bilateral', tipoMetrica: '', resultado: '', dolor: '', calidad: '', criterioFuncional: '', observacion: '' }] });
                                }}
                                className="text-orange-600 font-bold hover:text-orange-700 transition outline-none"
                                disabled={isClosed}
                            >
                                + Agregar Métrica de Rendimiento
                            </button>
                            <p className="text-xs text-slate-500 mt-2">Registra pruebas de capacidad, fuerza, saltos o agilidad.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {(exam.funcionalesConfig?.filas || []).map((fila: any, i: number) => {
                                const handleChange = (k: string, v: any) => {
                                    const m = [...exam.funcionalesConfig.filas];
                                    m[i] = { ...m[i], [k]: v };
                                    handleUpdateExam('funcionalesConfig', { ...exam.funcionalesConfig, filas: m });
                                };

                                const suggestionsByObj: Record<string, string[]> = {
                                    'Vida diaria': ['Sit to stand 30s', 'Timed Up and Go (TUG)', 'Step down test', 'Alcance funcional'],
                                    'Gimnasio': ['1RM', 'RM Estimado', 'Sentadilla (Reps/kg)', 'Peso Muerto (Reps/kg)', 'Push ups', 'Pull ups'],
                                    'Carrera': ['Test de marcha 6min', 'Test de Cooper', 'VAM-Eval', 'Hop test max'],
                                    'Salto/Aterrizaje': ['CMJ', 'Drop Jump', 'Single Hop', 'Triple Hop', 'Crossover Hop', 'LESS'],
                                    'Cambio de dirección': ['T-Test', 'Pro-Agility 5-10-5', 'Illinois', 'MAT Test', 'Carioca'],
                                    'Reintegro deportivo': ['Batería Hop Tests', 'Agilidad Reactiva', 'Test Específico'],
                                    'Preventivo': ['Y-Balance LQ', 'Y-Balance UQ', 'FMS', 'Perfil Isométrico (CST)']
                                };
                                const currentGoal = exam.funcionalesConfig?.objetivo || '';
                                const testSuggestions = suggestionsByObj[currentGoal] || suggestionsByObj['Salto/Aterrizaje'];

                                return (
                                    <div key={fila.id} className="bg-white border text-sm rounded-xl border-orange-100 hover:border-orange-300 transition-colors shadow-sm overflow-hidden flex flex-col group relative">
                                        {/* Header */}
                                        <div className="bg-orange-50/50 p-3 border-b border-orange-100 flex flex-wrap items-center gap-2 justify-between">
                                            <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 flex-1 relative pr-8">
                                                <input
                                                    type="text" list={`func-list-${fila.id}`}
                                                    className="w-full min-w-[120px] flex-1 text-sm font-bold p-1.5 border border-slate-200 rounded outline-none focus:border-orange-400 focus:bg-white bg-slate-50 text-slate-800"
                                                    value={fila.test || ''} onChange={e => handleChange('test', e.target.value)} disabled={isClosed} placeholder="Test (Ej. CMJ, TUG, 1RM...)"
                                                />
                                                <datalist id={`func-list-${fila.id}`}>
                                                    {testSuggestions.map(s => <option key={s} value={s} />)}
                                                </datalist>

                                                <select
                                                    className="text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded px-2 py-1.5 outline-none focus:border-orange-400 min-w-[100px]"
                                                    value={fila.lado || 'Bilateral'} onChange={e => handleChange('lado', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="Bilateral">Bilateral</option>
                                                    <option value="Derecho">Derecho</option>
                                                    <option value="Izquierdo">Izquierdo</option>
                                                </select>

                                                <button
                                                    onClick={() => {
                                                        const m = exam.funcionalesConfig.filas.filter((_: any, index: number) => index !== i);
                                                        handleUpdateExam('funcionalesConfig', { ...exam.funcionalesConfig, filas: m });
                                                    }}
                                                    className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 absolute right-0 top-0 bottom-0 my-auto"
                                                    disabled={isClosed} title="Eliminar prueba"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                        {/* Row Resultados */}
                                        <div className="p-3 bg-white flex flex-col md:flex-row gap-3 md:items-center justify-between">
                                            <div className="flex bg-slate-50 border border-slate-200 rounded-lg p-1.5 focus-within:border-orange-400 flex-1 md:max-w-[400px]">
                                                <input
                                                    className="w-full text-base font-bold bg-transparent outline-none text-center text-orange-600 placeholder:text-slate-400"
                                                    value={fila.resultado || ''} onChange={e => handleChange('resultado', e.target.value)} disabled={isClosed} placeholder="Valor"
                                                />
                                                <select className="bg-transparent text-xs font-bold text-slate-500 border-l border-slate-200 outline-none pl-2 ml-2 text-ellipsis"
                                                    value={fila.tipoMetrica || ''} onChange={e => handleChange('tipoMetrica', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">Tipo...</option>
                                                    <option value="Reps/kg">Reps / Kg</option>
                                                    <option value="Segundos">Segundos / min</option>
                                                    <option value="Distancia (cm/m)">Distancia (cm/m)</option>
                                                    <option value="Altura (cm)">Altura (cm)</option>
                                                    <option value="Simetría (LSI %)">LSI (%)</option>
                                                    <option value="Watts">Watts / Potencia</option>
                                                    <option value="Unidad/Otra">Otra</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <select
                                                    className="flex-1 min-w-[70px] text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-orange-400 font-bold text-slate-600"
                                                    value={fila.dolor || ''} onChange={e => handleChange('dolor', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">Dolor (EVA)</option>
                                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n.toString()}>{n}</option>)}
                                                </select>
                                                <select
                                                    className="flex-1 min-w-[90px] text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-orange-400 font-bold"
                                                    value={fila.calidad || ''} onChange={e => handleChange('calidad', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Calidad --</option>
                                                    <option value="Óptima">Óptima</option>
                                                    <option value="Aceptable">Aceptable</option>
                                                    <option value="Deficiente">Deficiente</option>
                                                </select>
                                                <select
                                                    className="flex-1 min-w-[100px] text-[11px] p-1.5 border border-slate-200 rounded outline-none bg-slate-50 focus:border-orange-400 font-medium"
                                                    value={fila.criterioFuncional || ''} onChange={e => handleChange('criterioFuncional', e.target.value)} disabled={isClosed}
                                                >
                                                    <option value="">-- Criterio --</option>
                                                    <option value="Adecuado">Adecuado</option>
                                                    <option value="Compensado">Compensado</option>
                                                    <option value="Doloroso">Doloroso</option>
                                                    <option value="Fatiga precoz">Fatiga precoz</option>
                                                    <option value="Inestable">Inestable</option>
                                                    <option value="Miedo/Apehension">Apehensión / Miedo</option>
                                                    <option value="Otro">Otro/No logra</option>
                                                </select>
                                            </div>
                                        </div>
                                        {/* Observacion */}
                                        <div className="px-3 pb-3 border-t border-slate-50 pt-2 bg-slate-50/50">
                                            <input
                                                className="w-full text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-orange-400 bg-white"
                                                placeholder="Observaciones de esfuerzo, estrategia o dolor intercurrente..."
                                                value={fila.observacion || ''} onChange={e => handleChange('observacion', e.target.value)} disabled={isClosed}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                {/* Footer Acciones */}
                {
                    exam.funcionalesConfig?.filas?.length > 0 && (
                        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col md:flex-row gap-4 justify-center items-center">
                            <button
                                onClick={() => {
                                    const baseConfig = exam.funcionalesConfig || { objetivo: '', filas: [] };
                                    handleUpdateExam('funcionalesConfig', { ...baseConfig, filas: [...(baseConfig.filas || []), { id: Date.now().toString(), test: '', lado: 'Bilateral', tipoMetrica: '', resultado: '', dolor: '', calidad: '', criterioFuncional: '', observacion: '' }] });
                                }}
                                disabled={isClosed}
                                className="text-sm font-bold text-orange-600 bg-white border border-orange-200 px-4 py-2 rounded-xl shadow-sm hover:bg-orange-50 flex items-center gap-2 transition outline-none w-full md:w-auto justify-center"
                            >
                                <span>+</span> Añadir Otra Prueba / Métrica
                            </button>
                        </div>
                    )
                }
            </div >
            {/* J. RE-TEST Y CIERRE */}
            < div className="bg-white rounded-2xl shadow-sm border border-fuchsia-200 flex flex-col mt-6" >
                <div className="bg-fuchsia-50/50 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-fuchsia-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center text-xl shrink-0">🔄</div>
                        <div>
                            <h3 className="font-bold text-fuchsia-900 text-lg">J. Re-test y cierre del examen físico</h3>
                            <p className="text-xs text-fuchsia-700/80 mt-0.5">Cambio post intervenciones de prueba o reevaluación del signo comparable</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 sm:p-6 flex flex-col gap-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                Tarea o Gesto Índice
                                <button type="button" onClick={() => setOpenHelp('J')} className="text-[10px] w-6 h-6 shrink-0 rounded-full flex items-center justify-center border border-fuchsia-200 bg-white text-fuchsia-600 font-bold hover:bg-fuchsia-100 transition-colors" title="Ayuda clínica">?</button>
                            </label>
                            <input
                                type="text"
                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed font-medium"
                                value={exam.retestConfig?.tareaIndice ?? exam.retestGesture ?? ''}
                                onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, tareaIndice: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Resultado Post-Examen</label>
                            <select className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed font-medium text-ellipsis"
                                value={exam.retestConfig?.resultadoPost || ''}
                                onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, resultadoPost: e.target.value })}
                                disabled={isClosed}
                            >
                                <option value="">Selecciona...</option>
                                <option value="Mejoró">Mejoró</option>
                                <option value="Mejoró parcialmente">Mejoró parcialmente</option>
                                <option value="Sin cambio">Sin cambio</option>
                                <option value="Empeoró">Empeoró</option>
                                <option value="No comparable">No comparable (No se evaluó / Dolor agudo)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Qué prueba, ajuste o intervención modificó el signo (Opcional)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="Ej. Tracción mantenida, activación de core, manipulación dorsal..."
                            value={exam.retestConfig?.intervencion || ''}
                            onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, intervencion: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Cambio clínicamente relevante observado</label>
                        <textarea
                            className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed min-h-[80px]"
                            placeholder="Describe qué cambió (rango, dolor, sensación del paciente)..."
                            value={exam.retestConfig?.comentario || ''}
                            onChange={(e) => handleUpdateExam('retestConfig', { ...exam.retestConfig, comentario: e.target.value })}
                            disabled={isClosed}
                        />
                    </div>
                </div>
            </div >

            {/* K. MEDIDAS COMPLEMENTARIAS */}
            < div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col mt-6" >
                <div onClick={() => setIsKOpen(!isKOpen)} className="bg-slate-50 hover:bg-slate-100/50 cursor-pointer p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-xl shrink-0">🩻</div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-lg">K. Medidas complementarias (opcional)</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Peso, Talla, Perímetros y Signos Vitales</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm font-bold">{isKOpen ? '▲ Ocultar' : '▼ Expandir'}</span>
                    </div>
                </div>
                {
                    isKOpen && (
                        <div className="p-4 sm:p-6 flex flex-col gap-6 bg-white">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Peso (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        value={exam.medidasComplementariasConfig?.peso || ''}
                                        placeholder="Ej. 75"
                                        onChange={(e) => {
                                            const peso = e.target.value;
                                            const tallaStr = exam.medidasComplementariasConfig?.talla;
                                            let imcStr = '';
                                            if (peso && tallaStr && parseFloat(tallaStr) > 0) {
                                                const tallaM = parseFloat(tallaStr) / 100;
                                                const imcCalc = parseFloat(peso) / (tallaM * tallaM);
                                                imcStr = imcCalc.toFixed(1);
                                            }
                                            handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, peso, imc: imcStr });
                                        }}
                                        disabled={isClosed}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Talla (cm)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        value={exam.medidasComplementariasConfig?.talla || ''}
                                        placeholder="Ej. 175"
                                        onChange={(e) => {
                                            const talla = e.target.value;
                                            const pesoStr = exam.medidasComplementariasConfig?.peso;
                                            let imcStr = '';
                                            if (talla && parseFloat(talla) > 0 && pesoStr) {
                                                const tallaM = parseFloat(talla) / 100;
                                                const imcCalc = parseFloat(pesoStr) / (tallaM * tallaM);
                                                imcStr = imcCalc.toFixed(1);
                                            }
                                            handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, talla, imc: imcStr });
                                        }}
                                        disabled={isClosed}
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">IMC Automático</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-100 border border-slate-200 text-slate-500 font-bold text-sm rounded-xl p-3 outline-none cursor-not-allowed text-center"
                                        value={exam.medidasComplementariasConfig?.imc || '-'}
                                        disabled
                                        readOnly
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Perímetro Espec. (cm)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        value={exam.medidasComplementariasConfig?.otraMedida || ''}
                                        placeholder="Ej. Muslo 45cm"
                                        onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, otraMedida: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>

                            {/* Signos vitales / Oculto por defecto */}
                            {!exam.medidasComplementariasConfig?.signosVitalesActivos && (
                                <div className="border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, signosVitalesActivos: true }); }}>
                                    <span className="text-sm font-bold text-slate-500 flex items-center gap-2">
                                        <span className="text-lg text-slate-400">+</span> Añadir Signos Vitales y Medidas Clínicas Complementarias
                                    </span>
                                </div>
                            )}

                            {exam.medidasComplementariasConfig?.signosVitalesActivos && (
                                <div className="border border-rose-100 bg-rose-50/30 rounded-xl p-4 sm:p-5 relative mt-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, signosVitalesActivos: false, pa: '', fc: '', satO2: '', perimetroEdema: '', fovea: null }); }} className="absolute top-4 right-4 text-[10px] text-slate-400 hover:text-rose-500 font-bold uppercase tracking-wider outline-none">
                                        Quitar bloque
                                    </button>
                                    <h4 className="text-sm font-bold text-rose-900 mb-4 flex items-center gap-2">
                                        <span className="text-rose-500">❤️</span> Signos Vitales y Fisiológicos
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Presión Arterial</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-none focus:border-rose-400"
                                                value={exam.medidasComplementariasConfig?.pa || ''}
                                                placeholder="Ej. 120/80"
                                                onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, pa: e.target.value })}
                                                disabled={isClosed}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frec. Cardiaca (lpm)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-none focus:border-rose-400"
                                                value={exam.medidasComplementariasConfig?.fc || ''}
                                                placeholder="Ej. 75"
                                                onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, fc: e.target.value })}
                                                disabled={isClosed}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sat. O2 (%)</label>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-none focus:border-rose-400"
                                                value={exam.medidasComplementariasConfig?.satO2 || ''}
                                                placeholder="Ej. 98"
                                                onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, satO2: e.target.value })}
                                                disabled={isClosed}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Evaluación Edema</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-none focus:border-rose-400"
                                                value={exam.medidasComplementariasConfig?.perimetroEdema || ''}
                                                placeholder="Volumen, asimetría..."
                                                onChange={(e) => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, perimetroEdema: e.target.value })}
                                                disabled={isClosed}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Signo de Fóvea</label>
                                            <div className="flex items-center gap-3 h-[38px] px-2">
                                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                                    <input type="radio" checked={exam.medidasComplementariasConfig?.fovea === true} onChange={() => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, fovea: true })} disabled={isClosed} className="text-rose-500 focus:ring-rose-500" />
                                                    Positivo
                                                </label>
                                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                                    <input type="radio" checked={exam.medidasComplementariasConfig?.fovea === false} onChange={() => handleUpdateExam('medidasComplementariasConfig', { ...exam.medidasComplementariasConfig, fovea: false })} disabled={isClosed} className="text-rose-500 focus:ring-rose-500" />
                                                    Negativo
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                }
            </div >

            {/* L. RESUMEN ESTRUCTURADO (PREVIEW) */}
            {localPreview && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl shadow-sm flex flex-col mt-6 p-4 sm:p-5 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-xl shrink-0">✨</div>
                        <div>
                            <h3 className="font-bold text-emerald-900 text-lg">Resumen estructurado del examen físico</h3>
                            <p className="text-xs text-emerald-700/80 mt-0.5">Síntesis generada correctamente. Los datos de tu examen físico permanecen intactos.</p>
                        </div>
                    </div>
                    {localPreview.summary_text_short && (
                        <div className="bg-white text-emerald-900 p-3 rounded-lg border border-emerald-100 mb-4 whitespace-pre-wrap text-xs font-medium shadow-sm">
                            {localPreview.summary_text_short}
                        </div>
                    )}
                    <div className="bg-white border-emerald-100 border shadow-sm rounded-lg p-3 text-xs text-emerald-800 whitespace-pre-wrap font-mono h-[200px] overflow-y-auto custom-scrollbar">
                        {localPreview.summary_text_structured}
                    </div>
                </div>
            )}

            {/* BOTÓN FINAL */}
            <div className="flex flex-col items-end pt-6 border-t border-slate-200 mt-4 gap-2">
                <button
                    onClick={() => {
                        setIsSynthesizing(true);
                        setSynthesisSuccess(false);
                        setLocalPreview(null);

                        // Guardamos copia inmutable para rollback por si acaso
                        const snapshotOriginal = JSON.parse(JSON.stringify(formData));

                        try {
                            // Operar sobre copias inmutables
                            const examCopy = JSON.parse(JSON.stringify(exam));
                            const interviewCopy = JSON.parse(JSON.stringify(formData.interview || {}));

                                const hasFindings = examCopy && (
                                    (examCopy.romAnaliticoConfig?.filas?.length > 0) ||
                                    (examCopy.fuerzaMrc?.length > 0) ||
                                    (examCopy.palpacionConfig?.filas?.length > 0) ||
                                    (examCopy.controlMotorConfig?.filas?.length > 0) ||
                                    (examCopy.pruebasOrtopedicas?.length > 0) ||
                                    (examCopy.neurologico?.fuerzaMiotomas?.length > 0) ||
                                    (examCopy.retestConfig?.tareaIndice && examCopy.retestConfig?.estadoActual) ||
                                    (examCopy.observacion?.postura || examCopy.observacion?.marcha)
                                );

                                if (!hasFindings) {
                                    alert('Faltan mínimos para sintetizar, pero tu examen no fue modificado. Registra al menos un hallazgo clínico útil (ROM, Palpación, etc).');
                                    setIsSynthesizing(false);
                                    return;
                                }

                                const p2_summary_structured = buildP2SummaryStructured(examCopy);

                                // Actualizar SIN borrar lo existente, asegurando inmutabilidad en top-level
                                updateFormData((prev) => {
                                    const newState = {
                                        ...prev,
                                        guidedExam: {
                                            ...(prev.guidedExam || {}),
                                            autoSynthesis: p2_summary_structured
                                        }
                                    };
                                    return newState;
                                });

                                setLocalPreview(p2_summary_structured);

                                setTimeout(() => {
                                    setIsSynthesizing(false);
                                    setSynthesisSuccess(true);
                                    if (onNext) onNext();
                                }, 1200);
                            } catch (error) {
                                console.error("Error al sintetizar localmente:", error);
                                alert("Hubo un error al generar la síntesis. El examen original no se ha modificado.");
                                setIsSynthesizing(false);
                                setSynthesisSuccess(false);
                            }
                    }}
                    disabled={isClosed || isSynthesizing || synthesisSuccess}
                    className={`font-bold py-3.5 px-8 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 group w-full sm:w-auto ${synthesisSuccess
                        ? 'bg-emerald-600 text-white shadow-emerald-200 hover:bg-emerald-700'
                        : (isSynthesizing ? 'bg-indigo-400 text-white cursor-wait' : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg')
                        }`}
                >
                    {isSynthesizing ? (
                        <>
                            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" /><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75" /></svg>
                            Sintetizando hallazgos...
                        </>
                    ) : synthesisSuccess ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            Síntesis generada correctamente
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Sintetizar hallazgos físicos
                        </>
                    )}
                </button>
                <p className="text-[11px] text-slate-500 font-medium italic pr-2 text-right">Ordena los hallazgos del examen y genera un resumen estructurado (no borra nada)</p>
            </div>


            {/* Modal de Ayuda Universal */}
            {
                openHelp && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in" onClick={() => setOpenHelp(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 scroll-m-0 overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3 shrink-0">
                                <div>
                                    <h3 className="font-black text-slate-800 text-xl tracking-tight">💡 Guía Clínica Profesional</h3>
                                    <p className="text-xs text-slate-500 mt-1">Sugerencias basadas en práctica basada en evidencia.</p>
                                </div>
                                <button onClick={() => setOpenHelp(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold shrink-0">✕</button>
                            </div>
                            <div className="text-sm text-slate-600 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
                                {openHelp === 'A' && (
                                    <>
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <p className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">📋</span> A. Historial y Contexto</p>
                                            <p className="text-xs text-slate-500 mt-1">Este bloque extrae las hipótesis y focos marcados en las pantallas previas (P1).</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Revisión rápida:</strong> Antes de tocar al paciente, verifica sus "Red Flags" y la irritabilidad reportada.</li>
                                            <li><strong>Planificación:</strong> Si la irritabilidad es ALTA, tu examen físico (los bloques siguientes) deben ser limitados, suaves e ir directo al punto para no exacerbar los síntomas.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'B' && (
                                    <>
                                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                            <p className="font-bold text-indigo-800 flex items-center gap-2"><span className="text-lg">👀</span> B. Evaluación Observacional</p>
                                            <p className="text-xs text-indigo-600 mt-1">Observación basal estricta de la conducta motora.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>No sobre-diagnostiques la postura:</strong> Las asimetrías son normales. Anota la postura solo si crees que está <strong>directamente ligada</strong> a la sintomatología actual (ej. shift antálgico).</li>
                                            <li><strong>Desviaciones antálgicas:</strong> Notas si el paciente evita apoyar peso, hace pausas por dolor o acorta la zancada. Es observación estricta de conducta, no palpación.</li>
                                            <li><strong>Marcha:</strong> Observa disimetrías dinámicas, velocidad o cojeras evidentes y anótalo de forma breve.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'C' && (
                                    <>
                                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                                            <p className="font-bold text-emerald-800 flex items-center gap-2"><span className="text-lg">📐</span> C. Rango de Movimiento (ROM)</p>
                                            <p className="text-xs text-emerald-600 mt-1">Testeo analítico de la capacidad articular y deducción de hipótesis mecánicas.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>A/PROM Clínico:</strong> Comienza siempre evaluando el Movimiento Activo libre. Aplica movimiento Pasivo con Overpressure al final para discriminar el <em>End-feel</em> capsular, elástico o vacío.</li>
                                            <li><strong>Hipótesis por Diferenciación:</strong> Si duele predominantemente el movimiento Activo pero NO el pasivo, inclina tu hipótesis hacia un foco contráctil. Si duele el Activo Y el Pasivo en el mismo sentido, sugiere fuertemente un compromiso Articular.</li>
                                            <li><strong>Calidad vs Cantidad:</strong> Registra la calidad del movimiento ("arco doloroso", "tope rígido") por sobre la pura medición goniométrica, que rara vez correlaciona con mejoría del dolor por sí misma.</li>
                                        </ul>
                                    </>
                                )}

                                {openHelp === 'D' && (
                                    <>
                                        <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                                            <p className="font-bold text-indigo-800 flex items-center gap-2"><span className="text-lg">🦾</span> D. Fuerza y Tolerancia a Carga</p>
                                            <p className="text-xs text-indigo-600 mt-1">Valoración analítica de la capacidad contráctil del tejido.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Dolor frente a la resistencia:</strong> Si el test isométrico duele, es indicativo fuerte de un problema contráctil (tendinopatía, desgarro).</li>
                                            <li><strong>Debilidad sin dolor:</strong> Alerta neurológica (Miotoma / Nervio Periférico) o rotura masiva completa del tendón.</li>
                                            <li><strong>Cuantificar:</strong> En deportistas usa Dinamometría de mano (HHD) o RM estimado para tener un <em>baseline</em> objetivo y evaluar asimetrías de torque.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'E' && (
                                    <>
                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                                            <p className="font-bold text-amber-800 flex items-center gap-2"><span className="text-lg">🦴</span> E. Evaluación Articular Específica</p>
                                            <p className="text-xs text-amber-600 mt-1">Palpación estructural focal y juego articular (Accessory motions).</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Palpación Anatómica:</strong> Busca calor, derrame intra/extra articular, o reproducción exquisita en la inserción ("¿Este es TU dolor?").</li>
                                            <li><strong>Movimientos Accesorios (Glide):</strong> Evalúa rigidez capsular o micro-inestabilidad en bloque articular. Anota las diferencias (hiper/hipo) aquí mismo en el área de texto libre.</li>
                                            <li><strong>Test de Ligamentos:</strong> Registrar laxitud (grados I-III) y calidad del tope blando/duro tras un trauma agudo.</li>
                                            <li><em>Tip Evidencia:</em> Solo utiliza estas maniobras si tu hipótesis sugiere un limitador mecánico local. En dolores crónicos nociplásticos aportarían poco valor.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'F' && (
                                    <>
                                        <div className="p-3 bg-rose-50 rounded-lg border border-rose-200">
                                            <p className="font-bold text-rose-800 flex items-center gap-2"><span className="text-lg">🧠</span> F. Examen Neuro / Sensitivo / Neural</p>
                                            <p className="text-xs text-rose-600 mt-1">Descarte o confirmación de involucro del Sistema Nervioso Periférico.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Dermatomas y Miotomas:</strong> Obligatorio si el paciente refiere irradiación, parestesia o debilidad que no responde anatómicamente a un músculo local.</li>
                                            <li><strong>Reflejos Osteotendíneos:</strong> Testea comparativamente asimetrías L/R para evaluar daño de raíz nerviosa (Hiporreflexia).</li>
                                            <li><strong>Neurodinamia:</strong> SLUMP, ULTT, PKB. Tensión neural adversa. Es Positiva SÓLO si altera los síntomas al mover un segmento distal (ej. flexión cervical altera el dolor del brazo).</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'G' && (
                                    <>
                                        <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                            <p className="font-bold text-teal-800 flex items-center gap-2"><span className="text-lg">⚖️</span> G. Control Motor y Biomecánica</p>
                                            <p className="text-xs text-teal-600 mt-1">Observación cualitativa de estrategias de movimiento.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Calidad vs Cantidad:</strong> Observa oscilaciones, pérdida de balance, estrategias de evitación (guarding) y control lumbopélvico (ej. valgo dinámico de rodilla en sentadilla).</li>
                                            <li><strong>Relevancia Clínica:</strong> No todos los "déficits" de control motor causan dolor (muchos asintomáticos los tienen). Evalúa si la corrección del patrón disminuye los síntomas del paciente al instante.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'H' && (
                                    <>
                                        <div className="p-3 bg-sky-50 rounded-lg border border-sky-200 mb-3">
                                            <p className="font-bold text-sky-800 flex items-center gap-2"><span className="text-lg">⚖️</span> H. Pruebas Ortopédicas Dirigidas</p>
                                            <p className="text-xs text-sky-600 mt-1">Úsalas solo si aportan algo después de la entrevista y del resto del examen físico.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2 text-sm text-slate-700">
                                            <li><strong>Cuándo usar estas pruebas:</strong> "Cuando la entrevista y el examen físico ya acotaron hipótesis y necesitas afinar o descartar."</li>
                                            <li><strong>Qué evitar:</strong> "No usar baterías largas de pruebas que evalúan lo mismo."</li>
                                            <li><strong>Cómo pensar:</strong> "Primero descarta con la información global; luego usa pocas pruebas para acercarte a confirmar."</li>
                                            <li><strong>Qué vale más:</strong> "Importa más la combinación entre historia, movilidad, fuerza, control motor y respuesta de la prueba que una prueba aislada."</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'I' && (
                                    <>
                                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                                            <p className="font-bold text-orange-800 flex items-center gap-2"><span className="text-lg">🏃</span> I. Functional & Performance Tests</p>
                                            <p className="text-xs text-orange-600 mt-1">Métricas objetivas para cuantificar alta o rendimiento.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Métricas Duras:</strong> CMJ (Salto Vertical en cm), Hop Tests cruzados (distancia LSI), Agilidad (Segundos). Todo requiere de datos exactos.</li>
                                            <li><strong>Adulto Mayor / Sedentario:</strong> No es exclusivo de atletas. El Timed Up and Go (TUG), Sit-to-Stand 30s o la Marcha 6 Min. son medidas funcionales vitales para predecir morbilidad y riesgo de caídas.</li>
                                            <li><strong>Progreso:</strong> Son la herramienta definitiva para demostrarle al paciente en la sesión 10 que ha mejorado un X% respecto al día 1.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'J' && (
                                    <>
                                        <div className="p-3 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
                                            <p className="font-bold text-fuchsia-800 flex items-center gap-2"><span className="text-lg">🔄</span> J. Signo Comparable / Re-test</p>
                                            <p className="text-xs text-fuchsia-600 mt-1">Confirmación intrasesión de efectividad.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li><strong>Auditoría Clínica:</strong> Consiste en encontrar un signo doloroso o restringido en la evaluación, aplicar una intervención de prueba rápida (ej. terapia manual, un tape, o instrucción motora) y <strong>re-evaluar el mismo signo inmediatamente</strong>.</li>
                                            <li><strong>Si cambia:</strong> Te confirma al 100% la pertinencia del tratamiento seleccionado a nivel neuromecánico y aumenta la confianza del paciente.</li>
                                        </ul>
                                    </>
                                )}
                                {openHelp === 'K' && (
                                    <>
                                        <div className="p-3 bg-slate-100 rounded-lg border border-slate-300">
                                            <p className="font-bold text-slate-800 flex items-center gap-2"><span className="text-lg">🩻</span> K. Exámenes Complementarios</p>
                                            <p className="text-xs text-slate-600 mt-1">Registro de imágenes o reportes médicos aportados.</p>
                                        </div>
                                        <ul className="list-disc pl-5 space-y-2 mt-2">
                                            <li>Recuerda la regla clínica máxima: <strong>Tratamos pacientes, no resonancias magnéticas</strong>. Úsalas para descartar banderas rojas graves, o como confirmación de hipótesis (ej. roturas completas) solo si el test clínico correlaciona con la imagen.</li>
                                        </ul>
                                    </>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-100 shrink-0">
                                <button onClick={() => setOpenHelp(null)} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition">Entendido</button>
                            </div>
                        </div>
                    </div>
                )
            }

        </div >
    );
}
