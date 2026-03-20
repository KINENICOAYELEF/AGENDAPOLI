import React, { useEffect, useMemo, useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { computeIrritability, autoSynthesizeFindings, computeSafety } from "@/lib/auto-engine";
import { normalizeEvaluationState, buildCompactInterviewForAI, buildCompactPhysicalForAI, buildCompactContextForAI, buildCompactCasePackage } from "@/lib/state-normalizer";
import { useAuth } from "@/context/AuthContext";
import TextareaAutosize from 'react-textarea-autosize';

export interface Screen3Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

export function Screen3_Sintesis({ formData, updateFormData, isClosed }: Screen3Props) {
    const { user } = useAuth();
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const autoSynth = formData.autoSynthesis || {};
    const normalizedCase = useMemo(() => normalizeEvaluationState(formData), [formData]);
    const persona = (formData as any).paciente || {};
    const anamnesisV4 = (formData as any).remoteHistorySnapshot || {};
    
    // Engine local extraction
    const engine = useMemo(() => {
        const irritability = computeIrritability({} as any); // fallback
        const safety = computeSafety(formData.interview);
        const synth = autoSynthesizeFindings(formData.guidedExam, formData.interview);
        return { safety, synth };
    }, [formData.interview, formData.guidedExam]);

    // Pre-pobla el semáforo
    useEffect(() => {
        if (!isClosed && !autoSynth.trafficLight && engine.safety.level) {
            handleUpdateSynth({ trafficLight: engine.safety.level });
        }
    }, [isClosed, autoSynth.trafficLight, engine.safety.level]);

    const handleUpdateSynth = (patch: any) => {
        updateFormData((prev: any) => ({
            autoSynthesis: { ...(prev.autoSynthesis || {}), ...patch }
        }));
    };

    // Generic updater for deep nested objects
    const updateDeepObj = (key: string, patch: any) => {
        handleUpdateSynth({
            [key]: { ...(autoSynth as any)[key], ...patch }
        });
    };

    const handleRefineSynthesis = async () => {
        if (isClosed) return;
        setIsGenerating(true);
        setAiError(null);
        try {
            // COMPARTA Y ENSAMBLA ESTRICTAMENTE LOS DATASETS ESTRUCTURADOS (P1, P1.5, P2) EN COMPACT_CASE_PACKAGE
            const compactedCase = buildCompactCasePackage(formData);
            
            const payloadForAI = {
                ...compactedCase,
                semaforo_seguridad_sugerido: engine.safety.level
            };

            const stringifiedPayloadForAI = JSON.stringify(payloadForAI);
            
            // FRONTEND CACHE GUARD
            if (formData.aiOutputs?.diagnosisLastInput === stringifiedPayloadForAI && autoSynth.clasificacion_dolor && !aiError) {
                alert("Se reutilizó la última síntesis porque no hubo cambios clínicos relevantes en el borrador.");
                setIsGenerating(false);
                return;
            }

            const response = await fetch('/api/ai/diagnosis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    payload: payloadForAI
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Error al conectar con la IA de Síntesis');

            // Set raw output for next screen to avoid double billing or for historical reasons
            updateFormData(prev => ({
                aiOutputs: { 
                    ...(prev.aiOutputs || {}), 
                    diagnosis: data.data,
                    diagnosisLastInput: stringifiedPayloadForAI,
                    diagnosisTelemetry: {
                        latencyMs: data.telemetry?.latencyMs || data.latencyMs,
                        timestamp: data.telemetry?.timestamp || new Date().toISOString(),
                        hash: data.telemetry?.inputHash || data.hash,
                        modelUsed: data.telemetry?.modelUsed || 'unknown',
                        fallbackUsed: !!data.telemetry?.fallbackUsed,
                        aiAction: data.telemetry?.aiAction || 'P3_SYNTHESIS',
                        promptVersion: data.telemetry?.promptVersion || 'v2.1',
                        estimatedInputTokens: Math.ceil(stringifiedPayloadForAI.length / 4)
                    }
                }
            }));

            const aiResult = data.data; // DiagnosisSchema matched
            if (aiResult) {
                // Populate new CIF schema blocks
                handleUpdateSynth({
                    snapshot_clinico: aiResult.snapshot_clinico,
                    clasificacion_dolor: aiResult.clasificacion_dolor,
                    sistema_y_estructuras: aiResult.sistema_y_estructuras,
                    alteraciones_detectadas: aiResult.alteraciones_detectadas,
                    actividad_y_participacion: aiResult.actividad_y_participacion,
                    factores_biopsicosociales: aiResult.factores_biopsicosociales,
                    recordatorios_y_coherencia: aiResult.recordatorios_y_coherencia
                });
            }
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    // Block A helper extraction
    const safetyAlerts = engine.safety.reasons;

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Síntesis y Ordenamiento del Caso</h2>
                <p className="text-sm text-slate-500 mt-1">Revisa el resumen y clasifica el caso estructuradamente antes de pasar a planificar.</p>
            </div>

            {/* BLOQUE A — SNAPSHOT CLÍNICO NORMALIZADO (Expediente + P1/P2) */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 flex items-center gap-2">
                        <span className="text-xl">📋</span> A. Snapshot Clínico del Proceso
                    </h3>
                    <span className="px-3 py-1 rounded-full text-[10px] uppercase font-black bg-indigo-600 text-white shadow-sm tracking-widest">
                        Sintetizado por IA v3.1.7
                    </span>
                </div>
                
                <div className="p-7">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* A1. Identificación clínica relevante */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> A1. Identificación
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Nombre Completo</label>
                                    <input 
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none font-bold text-slate-900 transition-all p-0"
                                        value={autoSynth.snapshot_clinico?.identificacion?.nombre || persona?.fullName || (persona?.nombres ? `${persona.nombres} ${persona.apellidos || ''}`.trim() : 'No consignado')}
                                        onChange={(e) => updateDeepObj('snapshot_clinico', { 
                                            identificacion: { ...(autoSynth.snapshot_clinico?.identificacion || {}), nombre: e.target.value } 
                                        })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Edad</label>
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all p-0"
                                            value={autoSynth.snapshot_clinico?.identificacion?.edad || (persona?.fechaNacimiento ? `${new Date().getFullYear() - new Date(persona.fechaNacimiento).getFullYear()} años` : (persona?.edad ? `${persona.edad} años` : 'No consignado'))}
                                            onChange={(e) => updateDeepObj('snapshot_clinico', { 
                                                identificacion: { ...(autoSynth.snapshot_clinico?.identificacion || {}), edad: e.target.value } 
                                            })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Sexo</label>
                                        <input 
                                            className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all p-0"
                                            value={autoSynth.snapshot_clinico?.identificacion?.sexo || persona?.sexoRegistrado || persona?.sexo || 'No consignado'}
                                            onChange={(e) => updateDeepObj('snapshot_clinico', { 
                                                identificacion: { ...(autoSynth.snapshot_clinico?.identificacion || {}), sexo: e.target.value } 
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* A2. Contexto basal que modifica el caso */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> A2. Contexto Basal
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Ocupación / Demanda Laboral</label>
                                    <textarea 
                                        rows={1}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all p-0 resize-none text-xs"
                                        value={autoSynth.snapshot_clinico?.contexto_basal?.ocupacion || 'No consignado'}
                                        onChange={(e) => updateDeepObj('snapshot_clinico', { 
                                            contexto_basal: { ...(autoSynth.snapshot_clinico?.contexto_basal || {}), ocupacion: e.target.value } 
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Deporte / Actividad Principal</label>
                                    <textarea 
                                        rows={1}
                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-indigo-500 focus:outline-none font-bold text-slate-800 transition-all p-0 resize-none text-xs"
                                        value={autoSynth.snapshot_clinico?.contexto_basal?.deporte_actividad || anamnesisV4?.contextoDeportivo?.deportePrincipal || 'No consignado'}
                                        onChange={(e) => updateDeepObj('snapshot_clinico', { 
                                            contexto_basal: { ...(autoSynth.snapshot_clinico?.contexto_basal || {}), deporte_actividad: e.target.value } 
                                        })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Demanda Física / Ayudas Técnicas</label>
                                    <div className="text-xs font-bold text-slate-700 leading-tight">
                                        {autoSynth.snapshot_clinico?.contexto_basal?.demanda_fisica || 'No consignado'}
                                        {autoSynth.snapshot_clinico?.contexto_basal?.ayudas_tecnicas && autoSynth.snapshot_clinico.contexto_basal.ayudas_tecnicas !== 'No consignado' && (
                                            <span className="text-indigo-600"> • {autoSynth.snapshot_clinico.contexto_basal.ayudas_tecnicas}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* A3. Factores clínicos relevantes para el episodio */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> A3. Factores Clínicos Relevantes
                            </h4>
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-[9px] font-black text-rose-500 uppercase">Comorbilidades <span className="text-[8px] text-rose-300 font-normal normal-case">(Relevancia Clínica)</span>:</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                        {(autoSynth.snapshot_clinico?.factores_relevantes?.comorbilidades || []).join(', ') || 'Sin hallazgos modulantes'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-[9px] font-black text-amber-500 uppercase">Medicamentos <span className="text-[8px] text-amber-300 font-normal normal-case">(Relevancia Clínica)</span>:</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                        {(autoSynth.snapshot_clinico?.factores_relevantes?.medicamentos || []).join(', ') || 'No consignado'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    <span className="text-[9px] font-black text-indigo-400 uppercase">Antecedentes MSK <span className="text-[8px] text-indigo-300 font-normal normal-case">(Relevancia Clínica)</span>:</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                        {(autoSynth.snapshot_clinico?.factores_relevantes?.antecedentes_msk || []).join(', ') || 'No consignado'}
                                    </span>
                                </div>
                                <div className="mt-2 bg-white/50 border border-slate-200 rounded-lg p-2">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Seguridad / Pronóstico</span>
                                    <p className="text-[11px] font-medium text-slate-600 leading-tight italic">
                                        {(autoSynth.snapshot_clinico?.factores_relevantes?.observaciones_seguridad || []).join(' | ') || 'Sin observaciones críticas'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Zona de Proceso P3 (Foco, Irritabilidad, Tolerancia) */}
                    <div className="mt-6 flex flex-col md:flex-row gap-4 border-t pt-6 border-slate-100">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Foco / Lado del Proceso</label>
                            <div className="font-bold text-slate-800 text-sm">
                                {autoSynth.snapshot_clinico?.foco_y_lado || (normalizedCase.focoPrincipal ? `${normalizedCase.focoPrincipal.region || 'S/N'} (${normalizedCase.ladoPrincipal})` : 'No definido')}
                            </div>
                        </div>
                        <div className="w-px bg-slate-100 hidden md:block"></div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Irritabilidad Sugerida</label>
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${
                                    (autoSynth.snapshot_clinico?.irritabilidad_sugerida || normalizedCase.irritabilidad) === 'Alta' ? 'bg-rose-500 animate-pulse' : 
                                    (autoSynth.snapshot_clinico?.irritabilidad_sugerida || normalizedCase.irritabilidad) === 'Media' ? 'bg-amber-500' : 'bg-emerald-500'
                                }`} />
                                <span className="font-bold text-slate-800 text-sm">{autoSynth.snapshot_clinico?.irritabilidad_sugerida || normalizedCase.irritabilidad}</span>
                            </div>
                        </div>
                        <div className="w-px bg-slate-100 hidden md:block"></div>
                        <div className="flex-1 px-4 py-2 bg-indigo-600 rounded-xl shadow-md flex items-center justify-between gap-4">
                            <div>
                                <span className="text-[9px] font-bold text-indigo-200 uppercase tracking-widest block">Tolerancia Carga</span>
                                <div className="font-black text-white text-base leading-none">{autoSynth.snapshot_clinico?.tolerancia_carga?.nivel || 'N/A'}</div>
                            </div>
                            <div className="text-[10px] text-indigo-50/90 leading-tight italic border-l border-indigo-400/50 pl-3 flex-1">
                                {autoSynth.snapshot_clinico?.tolerancia_carga?.explicacion || 'Sin detalles'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ALERTAS Y NOTAS */}
                {(autoSynth.snapshot_clinico?.alertas_clinicas?.length ?? 0) > 0 && (
                    <div className="bg-amber-50 px-6 py-3 border-t border-amber-100 flex items-center gap-3">
                        <span className="text-lg">⚠️</span>
                        <div className="text-xs text-amber-800">
                            <strong className="font-black">Alertas IA:</strong> {autoSynth.snapshot_clinico?.alertas_clinicas.join(' | ')}
                        </div>
                    </div>
                )}
                {safetyAlerts && safetyAlerts.length > 0 && (
                    <div className="bg-rose-50 px-6 py-3 border-t border-rose-100 flex items-center gap-3">
                        <span className="text-lg">🚨</span>
                        <div className="text-xs text-rose-800 font-bold">
                            Alertas Locales: {safetyAlerts.join(' | ')}
                        </div>
                    </div>
                )}
            </div>

            {/* BLOQUE B — BOTÓN PRINCIPAL DE IA */}
            <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
                <button 
                    onClick={handleRefineSynthesis} 
                    disabled={isClosed || isGenerating} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg px-8 py-4 rounded-2xl shadow-lg transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-3"
                >
                    {isGenerating ? <><span className="animate-spin text-2xl">⚙️</span> Procesando datos...</> : <><span className="text-2xl">✨</span> Ordenar caso con IA</>}
                </button>
                <p className="text-xs text-indigo-700/80 mt-3 max-w-md">
                    La IA propondrá una síntesis clínica estructurada usando P1, P1.5 y P2. <br/><strong className="text-indigo-900">Esta propuesta puede contener errores y debe ser revisada clínicamente.</strong>
                </p>
                {aiError && (
                    <div className="bg-rose-50 text-rose-700 p-3 rounded-lg text-sm font-medium border border-rose-200 mt-4">
                        ❌ {aiError}
                    </div>
                )}
            </div>

            {/* RENDERIZADO DE BLOQUES CIF (Solo si la IA llenó datos) */}
            {(autoSynth.clasificacion_dolor || autoSynth.sistema_y_estructuras || autoSynth.alteraciones_detectadas) && (
                <div className="flex flex-col gap-6 animate-in fade-in duration-700">
                    
                    {/* BLOQUE C — CLASIFICACIÓN CLÍNICA SUGERIDA (P3.1.9) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm border-t-4 border-t-indigo-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="text-xl bg-indigo-100 p-2 rounded-lg text-indigo-600">⚡</span> 
                                C. Clasificación del Dolor
                            </h3>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-[10px] text-indigo-700 max-w-sm leading-relaxed">
                                <strong>💡 Ayuda:</strong> La IA marca la opción más probable según integración de anamnesis, contexto basal y examen físico. <strong>Puedes editarla.</strong>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* C1. Categoría Principal */}
                            <div className="lg:col-span-5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">C1. Categoría Principal Sugerida</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {['nociceptivo', 'neuropático', 'nociplástico', 'mixto', 'no_concluyente'].map((cat: any) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => updateDeepObj('clasificacion_dolor', { categoria: cat })}
                                            disabled={isClosed}
                                            className={`px-3 py-2.5 rounded-xl text-xs font-black transition-all border shadow-sm text-left flex items-center justify-between group ${
                                                autoSynth.clasificacion_dolor?.categoria === cat 
                                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-indigo-200' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/30'
                                            }`}
                                        >
                                            <span className="capitalize">{cat.replace('_', ' ')}</span>
                                            {autoSynth.clasificacion_dolor?.categoria === cat && <span className="text-white/80">✓</span>}
                                        </button>
                                    ))}
                                </div>
                                <div className="mt-6">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center justify-between">
                                        C2. Subtipos / Apellidos
                                        <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full border border-purple-100 font-bold normal-case text-[9px]">Multiselección</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {/* Opciones ricas precargadas si la IA no ha generado nada o para complementar */}
                                        {['Mecánico', 'Isquémico', 'Inflamatorio', 'Sensibilización', 'Radicular', 'Atrapamiento', 'Proyectado', 'Autonómico'].map((sub: string) => {
                                            const selectedSubtypes = autoSynth.clasificacion_dolor?.subtipos || [];
                                            const isSelected = selectedSubtypes.includes(sub);
                                            
                                            return (
                                                <button
                                                    key={sub}
                                                    type="button"
                                                    onClick={() => {
                                                        const newSelected = isSelected 
                                                            ? selectedSubtypes.filter((s: string) => s !== sub)
                                                            : [...selectedSubtypes, sub];
                                                        updateDeepObj('clasificacion_dolor', { subtipos: newSelected });
                                                    }}
                                                    disabled={isClosed}
                                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                                                        isSelected 
                                                        ? 'bg-purple-600 border-purple-600 text-white shadow-sm' 
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-purple-300 hover:bg-purple-50/50'
                                                    }`}
                                                >
                                                    {sub}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs focus:ring-4 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all font-medium"
                                        value={autoSynth.clasificacion_dolor?.subtipo_manual || ''}
                                        onChange={(e) => updateDeepObj('clasificacion_dolor', { subtipo_manual: e.target.value })}
                                        placeholder="Especificación manual / Otro..."
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>

                            {/* C3. Fundamento Estructurado */}
                            <div className="lg:col-span-7 flex flex-col gap-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0">C3. Fundamento Cínico Integrado (Editable)</label>
                                
                                <div className="space-y-4">
                                    {/* Hallazgos que apoyan */}
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tight">Hallazgos que apoyan hipótesis</span>
                                        </div>
                                        <textarea 
                                            className="w-full bg-emerald-50/30 border border-emerald-100 rounded-2xl p-4 pt-8 text-xs font-semibold text-emerald-900 leading-relaxed min-h-[90px] focus:ring-4 focus:ring-emerald-100 focus:border-emerald-300 outline-none transition-all resize-none"
                                            value={(autoSynth.clasificacion_dolor?.fundamento?.apoyo || []).join('\n')}
                                            onChange={(e) => updateDeepObj('clasificacion_dolor', { 
                                                fundamento: { ...(autoSynth.clasificacion_dolor?.fundamento || {}), apoyo: e.target.value.split('\n') } 
                                            })}
                                            disabled={isClosed}
                                            rows={3}
                                            placeholder="Enumere hallazgos de P1, P1.5 y P2 que apoyan la categoría..."
                                        />
                                    </div>

                                    {/* Hallazgos que hacen dudar */}
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-tight">Hallazgos que hacen dudar / mezcla</span>
                                        </div>
                                        <textarea 
                                            className="w-full bg-amber-50/30 border border-amber-100 rounded-2xl p-4 pt-8 text-xs font-semibold text-amber-900 leading-relaxed min-h-[90px] focus:ring-4 focus:ring-amber-100 focus:border-amber-300 outline-none transition-all resize-none"
                                            value={(autoSynth.clasificacion_dolor?.fundamento?.duda_mezcla || []).join('\n')}
                                            onChange={(e) => updateDeepObj('clasificacion_dolor', { 
                                                fundamento: { ...(autoSynth.clasificacion_dolor?.fundamento || {}), duda_mezcla: e.target.value.split('\n') } 
                                            })}
                                            disabled={isClosed}
                                            rows={3}
                                            placeholder="Detalle elementos que obligan a cautela o sugieren mezcla de mecanismos..."
                                        />
                                    </div>

                                    {/* Conclusión */}
                                    <div className="relative">
                                        <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-tight">Conclusión Clínica Integrada</span>
                                        </div>
                                        <textarea 
                                            className="w-full bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 pt-8 text-sm font-bold text-indigo-900 leading-relaxed min-h-[110px] focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all resize-none shadow-inner"
                                            value={autoSynth.clasificacion_dolor?.fundamento?.conclusion || ''}
                                            onChange={(e) => updateDeepObj('clasificacion_dolor', { 
                                                fundamento: { ...(autoSynth.clasificacion_dolor?.fundamento || {}), conclusion: e.target.value } 
                                            })}
                                            disabled={isClosed}
                                            rows={4}
                                            placeholder="Redacte la síntesis final del razonamiento del dolor..."
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-3 mt-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Confianza Clínica:</label>
                                    <select 
                                        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                                        value={autoSynth.clasificacion_dolor?.nivel_confianza || ''}
                                        onChange={(e) => updateDeepObj('clasificacion_dolor', { nivel_confianza: e.target.value })}
                                        disabled={isClosed}
                                    >
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE D — SISTEMAS Y ESTRUCTURAS (P3.2.0) */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm border-t-4 border-t-blue-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="text-xl bg-blue-100 p-2 rounded-lg text-blue-600">🦴</span> 
                                D. Sistemas y Estructuras Involucradas
                            </h3>
                            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-[10px] text-blue-700 max-w-sm leading-relaxed">
                                <strong>D1 + D2:</strong> Mapa de sistemas afectados y segmentación de estructuras según su relevancia en el caso.
                            </div>
                        </div>

                        <div className="space-y-8">
                            {/* D1. SISTEMAS */}
                            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">D1. Sistemas Corporales Involucrados</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    {(autoSynth.sistema_y_estructuras?.sistemas_involucrados || []).map((sistema: string, idx: number) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs font-bold text-slate-700 flex items-center gap-2 shadow-sm group hover:border-blue-300 transition-all">
                                            {sistema}
                                            {!isClosed && (
                                                <button 
                                                    onClick={() => {
                                                    const currentS = autoSynth.sistema_y_estructuras?.sistemas_involucrados || [];
                                                    const next = currentS.filter((_: any, i: number) => i !== idx);
                                                    updateDeepObj('sistema_y_estructuras', { sistemas_involucrados: next });
                                                    }}
                                                    className="text-slate-300 hover:text-rose-500 transition-colors"
                                                >✕</button>
                                            )}
                                        </div>
                                    ))}
                                    {!isClosed && (
                                        <input 
                                            type="text"
                                            placeholder="+ Agregar sistema..."
                                            className="bg-transparent border-b border-dashed border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500 min-w-[150px] ml-1"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                    if (val) {
                                                        const next = [...(autoSynth.sistema_y_estructuras?.sistemas_involucrados || []), val];
                                                        updateDeepObj('sistema_y_estructuras', { sistemas_involucrados: next });
                                                        (e.currentTarget as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* D2. ESTRUCTURAS */}
                             {/* D2. ESTRUCTURAS */}
                             <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                 {/* Principales */}
                                 <div className="space-y-3">
                                     <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                         <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Principales
                                     </label>
                                     <div className="bg-indigo-50/30 border border-indigo-100 rounded-2xl p-4 min-h-[160px] flex flex-col gap-3">
                                         <div className="space-y-3 flex-1">
                                             {(autoSynth.sistema_y_estructuras?.estructuras?.principales || []).map((item: any, idx: number) => (
                                                 <div key={idx} className="bg-white border border-indigo-100 rounded-xl p-3 shadow-sm hover:border-indigo-300 transition-all flex flex-col gap-1.5 relative group">
                                                     <div className="flex items-center justify-between">
                                                         <span className="text-[11px] font-black text-indigo-900 leading-tight pr-5">{item.nombre}</span>
                                                         {!isClosed && <button onClick={() => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextE = { ...baseE, principales: (baseE.principales || []).filter((_: any, i: number) => i !== idx) };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: nextE });
                                                         }} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors">✕</button>}
                                                     </div>
                                                     <TextareaAutosize 
                                                         minRows={2}
                                                         className="text-[10px] text-indigo-700/70 bg-indigo-50/50 border-none outline-none rounded p-1.5 resize-none w-full focus:bg-white focus:text-indigo-800 transition-all"
                                                         placeholder="Argumento clínico..."
                                                         value={item.argumento || ''}
                                                         onChange={(e) => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextP = [...(baseE.principales || [])];
                                                             nextP[idx] = { ...nextP[idx], argumento: e.target.value };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, principales: nextP } });
                                                         }}
                                                         disabled={isClosed}
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                         {!isClosed && (
                                             <input 
                                                 className="bg-transparent border-b border-indigo-200 text-[10px] py-1 outline-none w-full mt-2"
                                                 placeholder="+ Añadir principal..."
                                                 onKeyDown={(e) => {
                                                     if (e.key === 'Enter') {
                                                         const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                         if (val) {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const current = baseE.principales || [];
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, principales: [...current, { nombre: val, argumento: '' }] } });
                                                             (e.currentTarget as HTMLInputElement).value = '';
                                                         }
                                                     }
                                                 }}
                                             />
                                         )}
                                     </div>
                                 </div>
 
                                 {/* Secundarias */}
                                 <div className="space-y-3">
                                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                         <span className="w-2 h-2 rounded-full bg-slate-500"></span> Secundarias / Sospecha
                                     </label>
                                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[160px] flex flex-col gap-3">
                                         <div className="space-y-3 flex-1">
                                             {(autoSynth.sistema_y_estructuras?.estructuras?.secundarias || []).map((item: any, idx: number) => (
                                                 <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-slate-300 transition-all flex flex-col gap-1.5 relative group">
                                                     <div className="flex items-center justify-between">
                                                         <span className="text-[11px] font-black text-slate-800 leading-tight pr-5">{item.nombre}</span>
                                                         {!isClosed && <button onClick={() => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextE = { ...baseE, secundarias: (baseE.secundarias || []).filter((_: any, i: number) => i !== idx) };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: nextE });
                                                         }} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors">✕</button>}
                                                     </div>
                                                     <TextareaAutosize 
                                                         minRows={2}
                                                         className="text-[10px] text-slate-600/70 bg-slate-50 border-none outline-none rounded p-1.5 resize-none w-full focus:bg-white focus:text-slate-800 transition-all"
                                                         placeholder="Argumento clínico..."
                                                         value={item.argumento || ''}
                                                         onChange={(e) => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextS = [...(baseE.secundarias || [])];
                                                             nextS[idx] = { ...nextS[idx], argumento: e.target.value };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, secundarias: nextS } });
                                                         }}
                                                         disabled={isClosed}
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                         {!isClosed && (
                                             <input 
                                                 className="bg-transparent border-b border-slate-200 text-[10px] py-1 outline-none w-full mt-2"
                                                 placeholder="+ Añadir secundaria..."
                                                 onKeyDown={(e) => {
                                                     if (e.key === 'Enter') {
                                                         const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                         if (val) {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const current = baseE.secundarias || [];
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, secundarias: [...current, { nombre: val, argumento: '' }] } });
                                                             (e.currentTarget as HTMLInputElement).value = '';
                                                         }
                                                     }
                                                 }}
                                             />
                                         )}
                                     </div>
                                 </div>
 
                                 {/* Asociadas */}
                                 <div className="space-y-3">
                                     <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                                         <span className="w-2 h-2 rounded-full bg-amber-500"></span> Asociadas / Moduladoras
                                     </label>
                                     <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 min-h-[160px] flex flex-col gap-3">
                                         <div className="space-y-3 flex-1">
                                             {(autoSynth.sistema_y_estructuras?.estructuras?.asociadas_moduladoras || []).map((item: any, idx: number) => (
                                                 <div key={idx} className="bg-white border border-amber-100 rounded-xl p-3 shadow-sm hover:border-amber-300 transition-all flex flex-col gap-1.5 relative group">
                                                     <div className="flex items-center justify-between">
                                                         <span className="text-[11px] font-black text-amber-900 leading-tight pr-5">{item.nombre}</span>
                                                         {!isClosed && <button onClick={() => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextE = { ...baseE, asociadas_moduladoras: (baseE.asociadas_moduladoras || []).filter((_: any, i: number) => i !== idx) };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: nextE });
                                                         }} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors">✕</button>}
                                                     </div>
                                                     <TextareaAutosize 
                                                         minRows={2}
                                                         className="text-[10px] text-amber-700/70 bg-amber-50/50 border-none outline-none rounded p-1.5 resize-none w-full focus:bg-white focus:text-amber-800 transition-all"
                                                         placeholder="Argumento clínico..."
                                                         value={item.argumento || ''}
                                                         onChange={(e) => {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const nextA = [...(baseE.asociadas_moduladoras || [])];
                                                             nextA[idx] = { ...nextA[idx], argumento: e.target.value };
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, asociadas_moduladoras: nextA } });
                                                         }}
                                                         disabled={isClosed}
                                                     />
                                                 </div>
                                             ))}
                                         </div>
                                         {!isClosed && (
                                             <input 
                                                 className="bg-transparent border-b border-amber-200 text-[10px] py-1 outline-none w-full mt-2"
                                                 placeholder="+ Añadir asociada..."
                                                 onKeyDown={(e) => {
                                                     if (e.key === 'Enter') {
                                                         const val = (e.currentTarget as HTMLInputElement).value.trim();
                                                         if (val) {
                                                             const baseE = autoSynth.sistema_y_estructuras?.estructuras || { principales: [], secundarias: [], asociadas_moduladoras: [] };
                                                             const current = baseE.asociadas_moduladoras || [];
                                                             updateDeepObj('sistema_y_estructuras', { estructuras: { ...baseE, asociadas_moduladoras: [...current, { nombre: val, argumento: '' }] } });
                                                             (e.currentTarget as HTMLInputElement).value = '';
                                                         }
                                                     }
                                                 }}
                                             />
                                         )}
                                     </div>
                                 </div>
                             </div>

                            {/* Resumen P4 */}
                            <div className="relative mt-4">
                                <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-tight">Estructuras que más afectan el caso hoy</span>
                                </div>
                                <TextareaAutosize 
                                    minRows={3}
                                    className="w-full bg-blue-50/50 border border-blue-100 rounded-2xl p-4 pt-8 text-sm font-bold text-blue-900 leading-relaxed focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none transition-all resize-none shadow-sm"
                                    value={autoSynth.sistema_y_estructuras?.estructuras_mas_afectan || ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { estructuras_mas_afectan: e.target.value })}
                                    disabled={isClosed}
                                    placeholder="Escriba aquí la síntesis de estructuras clave para la planificación..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE E — ALTERACIONES */}
                    <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">⚙️</span> E. Alteraciones Detectadas</h3>
                        
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">E1. Alteraciones Estructurales (Anatomía / Tejido)</label>
                            <div className="space-y-4">
                                {(autoSynth.alteraciones_detectadas?.estructurales || []).map((alt: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 relative group">
                                        {!isClosed && (
                                            <button 
                                                onClick={() => {
                                                    const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                    copy.splice(idx, 1);
                                                    updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                }}
                                                className="absolute -top-2 -right-2 bg-white text-rose-500 hover:bg-rose-500 hover:text-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                            <div className="md:col-span-4 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">1. Estructura</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold" 
                                                    value={alt.estructura || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].estructura = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Tendón Supraespinoso" 
                                                />
                                            </div>
                                            <div className="md:col-span-4 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">2. Alteración Anatómica</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.alteracion || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].alteracion = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Desgarro intrasustancia" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">3. Certeza</label>
                                                <select 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.certeza} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].certeza = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed}
                                                >
                                                    <option value="Posible">Posible</option>
                                                    <option value="Probable">Probable</option>
                                                    <option value="Casi confirmada">Casi confirmada</option>
                                                    <option value="No concluyente">No concluyente</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-2 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">4. Impacto</label>
                                                <select 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.impacto_caso} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].impacto_caso = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed}
                                                >
                                                    <option value="Mucho">Mucho</option>
                                                    <option value="Poco">Poco</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-12 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">5. Fundamento (Cluster / Imagen / Mecanismo)</label>
                                                <TextareaAutosize 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none overflow-hidden" 
                                                    value={alt.fundamento || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].fundamento = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    minRows={1}
                                                    placeholder="Justificación clínica..." 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!isClosed && (
                                    <button 
                                        onClick={() => updateDeepObj('alteraciones_detectadas', { 
                                            estructurales: [
                                                ...(autoSynth.alteraciones_detectadas?.estructurales || []), 
                                                { estructura: '', alteracion: '', certeza: 'Posible', fundamento: '', impacto_caso: 'Mucho' }
                                            ] 
                                        })} 
                                        className="w-full py-2 border-2 border-dashed border-indigo-100 rounded-xl text-xs text-indigo-500 font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Agregar Alteración Estructural (E1)
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-3">E2. Alteraciones Funcionales (Disfunción / Desempeño)</label>
                            <div className="space-y-4">
                                {(autoSynth.alteraciones_detectadas?.funcionales || []).map((alt: any, idx: number) => (
                                    <div key={idx} className="bg-indigo-50/20 p-4 rounded-xl border border-indigo-100/50 flex flex-col gap-3 relative group">
                                        {!isClosed && (
                                            <button 
                                                onClick={() => {
                                                    const copy = [...(autoSynth.alteraciones_detectadas?.funcionales || [])];
                                                    copy.splice(idx, 1);
                                                    updateDeepObj('alteraciones_detectadas', { funcionales: copy });
                                                }}
                                                className="absolute -top-2 -right-2 bg-white text-rose-500 hover:bg-rose-500 hover:text-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                                            >
                                                ✕
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 font-medium">
                                            <div className="md:col-span-5 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">1. Función / Disfunción</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all font-semibold" 
                                                    value={alt.funcion_disfuncion || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.funcionales || [])];
                                                        copy[idx].funcion_disfuncion = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { funcionales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Déficit fuerza abductores cadera" 
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">2. Dominio Sugerido</label>
                                                <select 
                                                    className="w-full bg-white border border-indigo-100 rounded-lg px-2 py-1.5 text-[11px] focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.dominio_sugerido} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.funcionales || [])];
                                                        copy[idx].dominio_sugerido = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { funcionales: copy });
                                                    }} 
                                                    disabled={isClosed}
                                                >
                                                    <option value="Dolor">Dolor</option>
                                                    <option value="Movilidad">Movilidad</option>
                                                    <option value="Fuerza">Fuerza</option>
                                                    <option value="Control motor">Control motor</option>
                                                    <option value="Carga">Carga</option>
                                                    <option value="Sensorimotor">Sensorimotor</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-4 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">3. Severidad</label>
                                                <select 
                                                    className="w-full bg-white border border-indigo-100 rounded-lg px-2 py-1.5 text-[11px] focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.severidad} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.funcionales || [])];
                                                        copy[idx].severidad = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { funcionales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                >
                                                    <option value="Leve">Leve</option>
                                                    <option value="Moderada">Moderada</option>
                                                    <option value="Severa">Severa</option>
                                                    <option value="Completa">Completa</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-12 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">4. Fundamento / Justificación</label>
                                                <TextareaAutosize 
                                                    className="w-full bg-white border border-indigo-100 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none overflow-hidden" 
                                                    value={alt.fundamento || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.funcionales || [])];
                                                        copy[idx].fundamento = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { funcionales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    minRows={1}
                                                    placeholder="Breve fundamento clínico..." 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!isClosed && (
                                    <button 
                                        onClick={() => updateDeepObj('alteraciones_detectadas', { 
                                            funcionales: [
                                                ...(autoSynth.alteraciones_detectadas?.funcionales || []), 
                                                { funcion_disfuncion: '', severidad: 'Moderada', fundamento: '', dominio_sugerido: 'Carga' }
                                            ] 
                                        })} 
                                        className="w-full py-2 border-2 border-dashed border-indigo-100 rounded-xl text-xs text-indigo-500 font-bold hover:bg-indigo-50 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Agregar Alteración Funcional (E2)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE F — ACTIVIDAD Y PARTICIPACIÓN */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm border-t-4 border-t-emerald-500">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <span className="text-xl bg-emerald-100 p-2 rounded-lg text-emerald-600">🏃‍♀️</span> 
                                F. Actividad y Participación
                            </h3>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-2.5 text-[10px] text-emerald-700 max-w-sm leading-relaxed">
                                <strong>F1 + F2:</strong> Captura de limitaciones en tareas y restricciones en roles sociales/deportivos, incluyendo inferencias clínicas.
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* F1. LIMITACIONES EN LA ACTIVIDAD */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">F1. Limitaciones Directas (Actividades)</label>
                                <div className="space-y-4">
                                    {(autoSynth.actividad_y_participacion?.limitaciones_directas || []).map((lim: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 relative group">
                                            {!isClosed && (
                                                <button 
                                                    onClick={() => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])];
                                                        copy.splice(idx, 1);
                                                        updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-white text-rose-500 hover:bg-rose-500 hover:text-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="text" 
                                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" 
                                                    value={lim.texto || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])];
                                                        copy[idx].texto = e.target.value;
                                                        updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Caminar > 20 min" 
                                                />
                                                <select 
                                                    className="w-[100px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" 
                                                    value={lim.severidad} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])];
                                                        copy[idx].severidad = e.target.value;
                                                        updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                                    }} 
                                                    disabled={isClosed}
                                                >
                                                    <option value="leve">Leve</option>
                                                    <option value="ligera">Ligera</option>
                                                    <option value="moderada">Moderada</option>
                                                    <option value="severa">Severa</option>
                                                    <option value="completa">Completa</option>
                                                </select>
                                            </div>
                                            <TextareaAutosize 
                                                className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none italic" 
                                                value={lim.detalle || ''} 
                                                onChange={(e) => {
                                                    const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])];
                                                    copy[idx].detalle = e.target.value;
                                                    updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                                }} 
                                                disabled={isClosed} 
                                                minRows={1}
                                                placeholder="Detalle o inferencia clínica..." 
                                            />
                                        </div>
                                    ))}
                                    {!isClosed && (
                                        <button 
                                            onClick={() => updateDeepObj('actividad_y_participacion', { 
                                                limitaciones_directas: [...(autoSynth.actividad_y_participacion?.limitaciones_directas || []), { texto: '', severidad: 'moderada', detalle: '' }] 
                                            })} 
                                            className="w-full py-2 border-2 border-dashed border-emerald-100 rounded-xl text-xs text-emerald-500 font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="text-lg">+</span> Agregar Actividad (F1)
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* F2. RESTRICCIONES EN LA PARTICIPACIÓN */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">F2. Restricciones (Roles / Entorno)</label>
                                <div className="space-y-4">
                                    {(autoSynth.actividad_y_participacion?.restricciones_participacion || []).map((res: any, idx: number) => (
                                        <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-3 relative group">
                                            {!isClosed && (
                                                <button 
                                                    onClick={() => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                        copy.splice(idx, 1);
                                                        updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                                    }}
                                                    className="absolute -top-2 -right-2 bg-white text-rose-500 hover:bg-rose-500 hover:text-white border border-slate-200 rounded-full w-6 h-6 flex items-center justify-center shadow-sm opacity-0 group-hover:opacity-100 transition-all z-10"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            <div className="flex items-center gap-3">
                                                <input 
                                                    type="text" 
                                                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" 
                                                    value={res.texto || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                        copy[idx].texto = e.target.value;
                                                        updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Rol laboral administrativo" 
                                                />
                                                <select 
                                                    className="w-[100px] bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-bold text-slate-600 focus:ring-2 focus:ring-emerald-100 outline-none transition-all" 
                                                    value={res.severidad} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                        copy[idx].severidad = e.target.value;
                                                        updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                                    }} 
                                                    disabled={isClosed}
                                                >
                                                    <option value="leve">Leve</option>
                                                    <option value="ligera">Ligera</option>
                                                    <option value="moderada">Moderada</option>
                                                    <option value="severa">Severa</option>
                                                    <option value="completa">Completa</option>
                                                </select>
                                            </div>
                                            <TextareaAutosize 
                                                className="w-full bg-emerald-50/30 border border-emerald-100/50 rounded-lg px-2.5 py-1.5 text-[11px] text-emerald-800 focus:bg-white focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none italic" 
                                                value={res.detalle || ''} 
                                                onChange={(e) => {
                                                    const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                    copy[idx].detalle = e.target.value;
                                                    updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                                }} 
                                                disabled={isClosed} 
                                                minRows={1}
                                                placeholder="Impacto en el rol o contexto..." 
                                            />
                                        </div>
                                    ))}
                                    {!isClosed && (
                                        <button 
                                            onClick={() => updateDeepObj('actividad_y_participacion', { 
                                                restricciones_participacion: [...(autoSynth.actividad_y_participacion?.restricciones_participacion || []), { texto: '', severidad: 'moderada', detalle: '' }] 
                                            })} 
                                            className="w-full py-2 border-2 border-dashed border-emerald-100 rounded-xl text-xs text-emerald-500 font-bold hover:bg-emerald-50 hover:border-emerald-200 transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="text-lg">+</span> Agregar Restricción (F2)
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

            {/* BLOQUE G — FACTORES BIOMÉDICOS Y PSICOSOCIALES (BPS) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm overflow-hidden group/bps">
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 transform group-hover/bps:rotate-3 transition-transform">
                            <span className="text-2xl text-white">🧠</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">G. Factores Biopsicosociales</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Contexto, Entorno y Creencias Traducidos</p>
                        </div>
                    </div>
                    <div className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100">
                        IA v3.1.4 | Lenguaje Humano
                    </div>
                </div>
                        
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
                    {/* Personales (+) */}
                    <div className="relative">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-emerald-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm z-10 transition-transform group-hover/bps:-translate-y-1">
                            Fortalezas (+)
                        </div>
                        <div className="bg-emerald-50/20 rounded-3xl p-6 pt-8 border border-emerald-100/50 hover:bg-emerald-50/40 transition-all min-h-[180px] shadow-sm">
                            <textarea 
                                className="w-full bg-transparent border-none text-xs font-medium text-emerald-900 leading-relaxed min-h-[120px] focus:ring-0 outline-none placeholder:text-emerald-200 resize-none selection:bg-emerald-200" 
                                value={(autoSynth.factores_biopsicosociales?.factores_personales_positivos || []).join('\n')} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_positivos: e.target.value.split('\n') })} 
                                disabled={isClosed} 
                                placeholder="Motivación alta, adherencia previa, apoyo social fuerte..." 
                            />
                        </div>
                    </div>

                    {/* Personales (-) */}
                    <div className="relative">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm z-10 transition-transform group-hover/bps:-translate-y-1">
                            Desafíos (-)
                        </div>
                        <div className="bg-rose-50/20 rounded-3xl p-6 pt-8 border border-rose-100/50 hover:bg-rose-50/40 transition-all min-h-[180px] shadow-sm">
                            <textarea 
                                className="w-full bg-transparent border-none text-xs font-medium text-rose-900 leading-relaxed min-h-[120px] focus:ring-0 outline-none placeholder:text-rose-200 resize-none selection:bg-rose-200" 
                                value={(autoSynth.factores_biopsicosociales?.factores_personales_negativos || []).join('\n')} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_negativos: e.target.value.split('\n') })} 
                                disabled={isClosed} 
                                placeholder="Miedo al movimiento, catastrofización, tiempo limitado..." 
                            />
                        </div>
                    </div>

                    {/* Ambientales (F) */}
                    <div className="relative">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-sky-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm z-10 transition-transform group-hover/bps:-translate-y-1">
                            Facilitadores 🌱
                        </div>
                        <div className="bg-sky-50/20 rounded-3xl p-6 pt-8 border border-sky-100/50 hover:bg-sky-50/40 transition-all min-h-[220px] shadow-sm">
                            <textarea 
                                className="w-full bg-transparent border-none text-sm font-bold text-sky-900 leading-relaxed min-h-[160px] focus:ring-0 outline-none placeholder:text-sky-200 resize-none selection:bg-sky-200" 
                                value={(autoSynth.factores_biopsicosociales?.facilitadores_ambientales || []).join('\n')} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { facilitadores_ambientales: e.target.value.split('\n') })} 
                                disabled={isClosed} 
                                rows={7}
                                placeholder="Acceso a gimnasio, familia colaboradora..." 
                            />
                        </div>
                    </div>

                    {/* Ambientales (B) */}
                    <div className="relative">
                        <div className="absolute -top-3 left-6 px-3 py-1 bg-amber-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm z-10 transition-transform group-hover/bps:-translate-y-1">
                            Barreras 🚧
                        </div>
                        <div className="bg-amber-50/20 rounded-3xl p-6 pt-8 border border-amber-100/50 hover:bg-amber-50/40 transition-all min-h-[220px] shadow-sm">
                            <textarea 
                                className="w-full bg-transparent border-none text-sm font-bold text-amber-900 leading-relaxed min-h-[160px] focus:ring-0 outline-none placeholder:text-amber-200 resize-none selection:bg-amber-200" 
                                value={(autoSynth.factores_biopsicosociales?.barreras_ambientales || []).join('\n')} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { barreras_ambientales: e.target.value.split('\n') })} 
                                disabled={isClosed} 
                                rows={7}
                                placeholder="Exigencias laborales altas, distancias largas..." 
                            />
                        </div>
                        {/* Moduladores Clínicos */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black text-amber-600 tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-xs">💊</span>
                                Moduladores Clínicos (G5)
                            </label>
                            <textarea 
                                className="w-full text-[12px] leading-relaxed text-slate-700 bg-white border border-amber-200 rounded-2xl px-5 py-4 resize-y focus:ring-2 focus:ring-amber-400/40 transition-all placeholder:text-slate-300"
                                value={(autoSynth.factores_biopsicosociales?.factores_clinicos_moduladores || []).join('\n')} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_clinicos_moduladores: e.target.value.split('\n') })} 
                                disabled={isClosed} 
                                rows={4}
                                placeholder="Diabetes tipo 2, Uso de estatinas, Cronicidad..." 
                            />
                        </div>
                        {/* Observaciones BPS Integradas */}
                        <div className="col-span-full space-y-2">
                            <label className="text-[10px] uppercase font-black text-indigo-600 tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-xs">🔗</span>
                                Síntesis Narrativa BPS Integrada (G6)
                            </label>
                            <textarea 
                                className="w-full text-[12px] leading-relaxed text-slate-700 bg-white border border-indigo-200 rounded-2xl px-5 py-4 resize-y focus:ring-2 focus:ring-indigo-400/40 transition-all placeholder:text-slate-300"
                                value={autoSynth.factores_biopsicosociales?.observaciones_bps_integradas || ''} 
                                onChange={(e) => updateDeepObj('factores_biopsicosociales', { observaciones_bps_integradas: e.target.value })} 
                                disabled={isClosed} 
                                rows={5}
                                placeholder="Narrativa experta conectando E, F y G con lógica clínica..." 
                            />
                        </div>
                    </div>
                </div>

                {/* Sub-indicadores rápidos */}
                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 flex flex-wrap gap-4 items-center justify-between">
                    {[
                        { icon: "⏰", label: "Disponibilidad", value: anamnesisV4?.contextoLaboral?.barrerasDetalles?.includes('tiempo') ? 'Limitada' : 'Adecuada' },
                        { icon: "😴", label: "Sueño", value: anamnesisV4?.bps?.sueno === 0 ? 'Bueno' : anamnesisV4?.bps?.sueno === 1 ? 'Regular' : 'Alterado' },
                        { icon: "🤯", label: "Estrés", value: anamnesisV4?.bps?.estres === 0 ? 'Bajo' : anamnesisV4?.bps?.estres === 1 ? 'Medio' : 'Alto' },
                        { icon: "🛡️", label: "Confianza", value: anamnesisV4?.bps?.confianzaBaja === 0 ? 'Alta' : anamnesisV4?.bps?.confianzaBaja === 1 ? 'Media' : 'Baja' },
                        { icon: "🔍", label: "Causa Percibida", value: anamnesisV4?.experienciaPersona?.causaPercibida || 'No reportada' }
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm hover:translate-y-[-2px] transition-transform flex-1 min-w-[160px]">
                            <span className="text-xl shrink-0">{item.icon}</span>
                            <div className="min-w-0">
                                <p className="text-[9px] uppercase font-black text-slate-400 tracking-widest mb-0.5">{item.label}</p>
                                <p className="text-[11px] font-bold text-slate-700 truncate">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* BLOQUE H: RECORDATORIOS Y RED FLAGS */}
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-rose-50 px-7 py-5 border-b border-rose-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                            <svg className="w-6 h-6 rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-rose-950 tracking-tight uppercase">Bloque H: Alertas y Vigilancia</h3>
                            <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest">Seguridad Clínica Prioritaria</p>
                        </div>
                    </div>
                    <div className="bg-white/80 px-4 py-1.5 rounded-full border border-rose-200 shadow-sm">
                        <span className="text-[10px] font-black text-rose-700 tracking-[0.2em] uppercase">Vigilancia Activa</span>
                    </div>
                </div>

                <div className="p-7 space-y-6">
                    {/* Alertas Sistémicas Críticas */}
                    {((anamnesisV4?.medicalHistory?.criticalModifiers || []).length > 0 || anamnesisV4?.seguridad?.fiebre_sistemico_cancerPrevio) && (
                        <div className="p-5 bg-rose-600 text-white rounded-3xl shadow-xl shadow-rose-100 border-4 border-rose-400/50 flex items-center gap-5">
                            <span className="text-4xl animate-bounce shrink-0">🚩</span>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest mb-1 opacity-80">Alerta Sistémica de Alta Prioridad</p>
                                <p className="text-sm font-bold leading-snug">
                                    {anamnesisV4?.medicalHistory?.criticalModifiers?.join(', ') || 'Condiciones de riesgo sistémico detectadas en la entrevista.'}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-6 bg-rose-50/30 border border-rose-100 rounded-3xl group hover:bg-rose-50/50 transition-all">
                            <div className="flex items-center gap-2 mb-4 border-b border-rose-100 pb-2">
                                <span className="text-xl">⚠️</span>
                                <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Banderas Rojas / Precauciones</p>
                            </div>
                            <ul className="space-y-3">
                                {Object.entries(anamnesisV4?.seguridad || {}).some(([k, v]) => v === true && k !== 'overrideUrgenciaMedica' && k !== 'confirmado') ? (
                                    Object.entries(anamnesisV4?.seguridad || {}).map(([key, val], i) => val === true && key !== 'overrideUrgenciaMedica' && key !== 'confirmado' && (
                                        <li key={i} className="text-[11px] font-bold text-rose-700 flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 shadow-sm"></span>
                                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-xs text-slate-400 italic font-medium">No se reportan banderas rojas directas.</li>
                                )}
                            </ul>
                        </div>

                        <div className="p-6 bg-amber-50/30 border border-amber-100 rounded-3xl group hover:bg-amber-50/50 transition-all">
                            <div className="flex items-center gap-2 mb-4 border-b border-amber-100 pb-2">
                                <span className="text-xl">☀️</span>
                                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Factores de Riesgo Psicosocial</p>
                            </div>
                            <ul className="space-y-3">
                                {Object.entries(anamnesisV4?.bps || {}).some(([_, v]) => v === 2) ? (
                                    Object.entries(anamnesisV4?.bps || {}).map(([key, val], i) => val === 2 && (
                                        <li key={i} className="text-[11px] font-bold text-amber-700 flex items-center gap-3">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 shadow-sm"></span>
                                            {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Severo
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-xs text-slate-400 italic font-medium">Sin factores BPS críticos reportados.</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="p-5 bg-indigo-900 text-white rounded-3xl shadow-2xl shadow-indigo-200 border border-indigo-700 flex items-start gap-4">
                        <span className="text-2xl mt-0.5">💡</span>
                        <div className="flex-1">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1.5 text-indigo-300">Tip de Adherencia Clínica</p>
                            <p className="text-xs italic font-medium leading-relaxed">
                                {anamnesisV4?.contextoLaboral?.trabajoDificultaRecuperacion 
                                    ? `Atención: El entorno laboral ("${anamnesisV4.contextoLaboral.barrerasDetalles.join(', ')}") representa una barrera de tiempo real. Ajustar dosis mínima efectiva.`
                                    : "Favorable: Sin barreras laborales críticas detectadas. Se puede prescribir carga regular con alta confianza."
                                }
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200 relative">
                            <span className="absolute -top-3 left-6 px-3 py-1 bg-slate-700 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">Notas Estratégicas IA</span>
                            <textarea 
                                className="w-full bg-transparent text-xs font-semibold text-slate-700 min-h-[80px] outline-none leading-relaxed resize-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.recordatorios_clinicos || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { recordatorios_clinicos: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
                                placeholder="Escribe notas sobre la estrategia de abordaje..."
                            />
                        </div>
                        <div className="bg-amber-50/20 rounded-3xl p-6 border border-amber-200 relative">
                            <span className="absolute -top-3 left-6 px-3 py-1 bg-amber-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">Incoherencias / Red Flags P2</span>
                            <textarea 
                                className="w-full bg-transparent text-xs font-semibold text-amber-900 min-h-[80px] outline-none leading-relaxed resize-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.incoherencias_detectadas || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { incoherencias_detectadas: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
                                placeholder="Reportar si hallazgos de P2 contradicen relato de P1..."
                            />
                        </div>
                        
                        <div className="bg-rose-50/30 rounded-3xl p-6 border border-rose-200 relative">
                            <span className="absolute -top-3 left-6 px-3 py-1 bg-rose-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">A Vigilar en Tratamiento</span>
                            <textarea 
                                className="w-full bg-transparent text-xs font-semibold text-rose-900 min-h-[80px] outline-none leading-relaxed resize-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.cosas_a_vigilar_en_tratamiento || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { cosas_a_vigilar_en_tratamiento: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
                                placeholder="Aspectos a vigilar (ej. signos de alarma, picos de irritabilidad)..."
                            />
                        </div>

                        <div className="bg-blue-50/40 rounded-3xl p-6 border border-blue-200 relative">
                            <span className="absolute -top-3 left-6 px-3 py-1 bg-blue-600 text-white text-[10px] font-black uppercase rounded-lg shadow-sm">Faltantes No Críticos</span>
                            <textarea 
                                className="w-full bg-transparent text-xs font-semibold text-blue-900 min-h-[80px] outline-none leading-relaxed resize-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.faltantes_no_criticos || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { faltantes_no_criticos: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
                                placeholder="Pruebas u observaciones que faltaron pero no impiden el inicio del tratamiento..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* PANEL DE TELEMETRÍA (ADMIN/DOCENTE) */}
            {((user?.role as string) === 'ADMIN' || (user?.role as string) === 'DOCENTE') && formData.aiOutputs?.diagnosisTelemetry && (
                <div className="bg-slate-800 text-slate-300 p-4 rounded-xl text-xs font-mono mt-6 mb-2 flex flex-col gap-1 border border-slate-700 shadow-inner">
                    <h4 className="text-slate-100 font-bold mb-2 flex items-center gap-2"><span className="text-base">📡</span> Terminal de Telemetría P3 (Admin)</h4>
                    <p><span className="text-slate-500">Action Type:</span> {formData.aiOutputs.diagnosisTelemetry.aiAction || 'P3_SYNTHESIS'}</p>
                    <p><span className="text-slate-500">Active Model:</span> <span className="text-amber-400 font-bold">{formData.aiOutputs.diagnosisTelemetry.modelUsed || 'Desconocido'}</span></p>
                    <p><span className="text-slate-500">Fallback Triggereado:</span> {formData.aiOutputs.diagnosisTelemetry.fallbackUsed ? <span className="text-rose-400 font-bold">SÍ</span> : <span className="text-emerald-400">NO</span>}</p>
                    <p><span className="text-slate-500">Estim. Input Tokens:</span> <span className="text-emerald-400 font-bold">{formData.aiOutputs.diagnosisTelemetry.estimatedInputTokens}</span></p>
                    <p><span className="text-slate-500">Network Latency:</span> {formData.aiOutputs.diagnosisTelemetry.latencyMs}ms</p>
                    <p><span className="text-slate-500">Payload Hash:</span> {formData.aiOutputs.diagnosisTelemetry.hash}</p>
                    <p><span className="text-slate-500">Version AI:</span> {formData.aiOutputs.diagnosisTelemetry.promptVersion || 'N/A'}</p>
                    <p><span className="text-slate-500">Generado en:</span> {new Date(formData.aiOutputs.diagnosisTelemetry.timestamp).toLocaleString()}</p>
                </div>
            )}
            </div>
        )}
        </div>
    );
}
