import React, { useEffect, useMemo, useState } from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { computeIrritability, autoSynthesizeFindings, computeSafety } from "@/lib/auto-engine";
import { normalizeEvaluationState, buildCompactInterviewForAI, buildCompactPhysicalForAI, buildCompactContextForAI, buildCompactCasePackage } from "@/lib/state-normalizer";
import { useAuth } from "@/context/AuthContext";

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

            {/* BLOQUE A — RESUMEN AUTOMÁTICO DEL CASO (Solo lectura) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm text-sm">
                <h3 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2 flex justify-between items-center">
                    <span>A. Snapshot Clínico Normalizado (P1, P1.5 y P2)</span>
                    {autoSynth.snapshot_clinico?.tolerancia_carga?.nivel && (
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-black bg-indigo-600 text-white shadow-sm">
                            Propuesta IA
                        </span>
                    )}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1"><span className="text-xs text-slate-500 block">Identificación</span><span className="font-bold text-slate-800">{normalizedCase.identificacion}</span></div>
                    <div className="md:col-span-2"><span className="text-xs text-slate-500 block">Motivo / Foco Principal</span><span className="font-medium text-slate-800">{autoSynth.snapshot_clinico?.foco_principal || (normalizedCase.focoPrincipal ? `${normalizedCase.focoPrincipal.region || 'S/N'} (${normalizedCase.ladoPrincipal})` : 'No definido')}</span></div>
                    <div><span className="text-xs text-slate-500 block">Irritabilidad</span><span className="font-medium text-slate-800">{autoSynth.snapshot_clinico?.irritabilidad_sugerida || normalizedCase.irritabilidad}</span></div>
                    <div className="md:col-span-2 bg-white/60 p-2 rounded border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tolerancia Funcional a Carga</span>
                        <div className="font-bold text-slate-900 leading-tight">{autoSynth.snapshot_clinico?.tolerancia_carga?.nivel || 'Carga no evaluada'}</div>
                        {autoSynth.snapshot_clinico?.tolerancia_carga?.explicacion && (
                            <div className="text-[10px] text-slate-600 mt-1 italic leading-snug">{autoSynth.snapshot_clinico.tolerancia_carga.explicacion}</div>
                        )}
                    </div>
                    <div className="md:col-span-2"><span className="text-xs text-slate-500 block">Tarea Índice</span><span className="font-medium text-slate-800">{autoSynth.snapshot_clinico?.tarea_indice || normalizedCase.tareaIndice || 'No definida'}</span></div>
                </div>
                {(autoSynth.snapshot_clinico?.alertas_clinicas?.length ?? 0) > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-100 text-amber-800 p-2 rounded text-xs">
                        <strong>Alertas IA:</strong> {autoSynth.snapshot_clinico?.alertas_clinicas.join(' | ')}
                    </div>
                )}
                {safetyAlerts && safetyAlerts.length > 0 && (
                    <div className="mt-2 bg-rose-50 border border-rose-100 text-rose-700 p-2 rounded text-xs font-medium">
                        ⚠️ Alertas Locales: {safetyAlerts.join(' | ')}
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
                    
                    {/* BLOQUE C — CLASIFICACIÓN CLÍNICA SUGERIDA */}
                    <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <span className="text-xl bg-indigo-100 p-2 rounded-lg text-indigo-600">⚡</span> 
                                C. Clasificación del Dolor
                            </h3>
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-[10px] text-indigo-700 max-w-sm">
                                <strong>💡 Ayuda:</strong> IA sugiere las opciones más probables según P1, P1.5, P2 y expediente. Puedes editar, agregar o corregir manualmente.
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Categoría Principal Sugerida</label>
                                <div className="flex flex-wrap gap-2">
                                    {(autoSynth.clasificacion_dolor?.opciones_categoria || ['Aparente Nociceptivo', 'Aparente Neuropático', 'Aparentemente Nociplástico', 'Mixto']).map((cat: string) => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => updateDeepObj('clasificacion_dolor', { categoria_seleccionada: cat })}
                                            disabled={isClosed}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-sm ${
                                                autoSynth.clasificacion_dolor?.categoria_seleccionada === cat 
                                                ? 'bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-200' 
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-400 hover:bg-indigo-50/30'
                                            }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2 flex items-center justify-between">
                                    Subtipo / Apellido Sugerido (Multiselección)
                                    <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100 font-normal normal-case">Puedes elegir varios</span>
                                </label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {autoSynth.clasificacion_dolor?.opciones_subtipo_apellido && autoSynth.clasificacion_dolor.opciones_subtipo_apellido.length > 0 ? (
                                        autoSynth.clasificacion_dolor.opciones_subtipo_apellido.map((sub: string) => {
                                            const selectedSubtypes = autoSynth.clasificacion_dolor?.subtipos_seleccionados || [];
                                            const isSelected = selectedSubtypes.includes(sub);
                                            
                                            return (
                                                <button
                                                    key={sub}
                                                    type="button"
                                                    onClick={() => {
                                                        const newSelected = isSelected 
                                                            ? selectedSubtypes.filter((s: string) => s !== sub)
                                                            : [...selectedSubtypes, sub];
                                                        updateDeepObj('clasificacion_dolor', { subtipos_seleccionados: newSelected });
                                                    }}
                                                    disabled={isClosed}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border shadow-sm ${
                                                        isSelected 
                                                        ? 'bg-purple-600 border-purple-600 text-white ring-2 ring-purple-200' 
                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-purple-400 hover:bg-purple-50/30'
                                                    }`}
                                                >
                                                    {sub}
                                                </button>
                                            );
                                        })
                                    ) : (
                                        <span className="text-xs italic text-slate-400">Genera con IA para ver opciones</span>
                                    )}
                                </div>
                                <div className="mt-2">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Especificación Manual / Otro</label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none transition-all"
                                        value={autoSynth.clasificacion_dolor?.subtipo_manual || ''}
                                        onChange={(e) => updateDeepObj('clasificacion_dolor', { subtipo_manual: e.target.value })}
                                        placeholder="Ej: de origen inflamatorio, persistente..."
                                        disabled={isClosed}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2 flex gap-4">
                                <div className="flex-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Fundamento</label>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75 min-h-[100px]"
                                        value={autoSynth.clasificacion_dolor?.fundamento_breve || ''}
                                        onChange={(e) => updateDeepObj('clasificacion_dolor', { fundamento_breve: e.target.value })}
                                        disabled={isClosed}
                                    />
                                </div>
                                <div className="w-1/4">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Confianza</label>
                                    <select 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                        value={autoSynth.clasificacion_dolor?.nivel_confianza || ''}
                                        onChange={(e) => updateDeepObj('clasificacion_dolor', { nivel_confianza: e.target.value })}
                                        disabled={isClosed}
                                    >
                                        <option value="">...</option>
                                        <option value="Alta">Alta</option>
                                        <option value="Media">Media</option>
                                        <option value="Baja">Baja</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE D — SISTEMA / ESTRUCTURA */}
                    <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🦴</span> D. Sistema y Estructuras</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sistemas Principales (sep. por coma)</label>
                                <input 
                                    type="text" 
                                    list="sistema-options"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={Array.isArray(autoSynth.sistema_y_estructuras?.sistemas_principales) ? autoSynth.sistema_y_estructuras.sistemas_principales.join(', ') : ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { sistemas_principales: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    disabled={isClosed}
                                    placeholder="Ej: Articular, Neural..."
                                />
                                <datalist id="sistema-options">
                                    <option value="Articular" />
                                    <option value="Neural" />
                                    <option value="Tejido contráctil" />
                                    <option value="Estabilidad pasiva" />
                                    <option value="Control motor" />
                                    <option value="Carga ósea" />
                                    <option value="Mixto" />
                                </datalist>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estructuras Principales (sep. por coma)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={Array.isArray(autoSynth.sistema_y_estructuras?.estructuras_principales) ? autoSynth.sistema_y_estructuras.estructuras_principales.join(', ') : ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { estructuras_principales: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    disabled={isClosed}
                                    placeholder="Ej: LCA, Menisco medial..."
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estructuras Secundarias (sep. por coma)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={Array.isArray(autoSynth.sistema_y_estructuras?.estructuras_secundarias) ? autoSynth.sistema_y_estructuras.estructuras_secundarias.join(', ') : ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { estructuras_secundarias: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    disabled={isClosed}
                                    placeholder="Ej: Bursa, Tendón..."
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Descripción / Matices Libres</label>
                                <textarea 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75 h-20"
                                    value={autoSynth.sistema_y_estructuras?.descripcion_libre || ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { descripcion_libre: e.target.value })}
                                    disabled={isClosed}
                                    placeholder="Agregar matices sobre la interacción de sistemas si es necesario..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE E — ALTERACIONES */}
                    <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">⚙️</span> E. Alteraciones Detectadas</h3>
                        
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">E1. Estructurales</label>
                            <div className="space-y-3">
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
                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                            <div className="md:col-span-3 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">1. Estructura</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.estructura_involucrada || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].estructura_involucrada = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Lig. Sacroilíaco" 
                                                />
                                            </div>
                                            <div className="md:col-span-3 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">2. Alteración / Sospecha</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.alteracion_sospecha || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].alteracion_sospecha = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Irritación mecánica" 
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
                                                    <option value="posible">Posible</option>
                                                    <option value="probable">Probable</option>
                                                    <option value="casi_confirmada">Casi Confirmada</option>
                                                    <option value="no_concluyente">No concluyente</option>
                                                </select>
                                            </div>
                                            <div className="md:col-span-4 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">4. Fundamento Clínico (Cluster/P2)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none transition-all" 
                                                    value={alt.fundamento_clinico || ''} 
                                                    onChange={(e) => {
                                                        const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])];
                                                        copy[idx].fundamento_clinico = e.target.value;
                                                        updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                                    }} 
                                                    disabled={isClosed} 
                                                    placeholder="Ej: Cluster Laslett (+) + Palpación (+)" 
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
                                                { estructura_involucrada: '', alteracion_sospecha: '', certeza: 'posible', fundamento_clinico: '' }
                                            ] 
                                        })} 
                                        className="w-full py-2 border-2 border-dashed border-slate-100 rounded-xl text-xs text-indigo-500 font-bold hover:bg-indigo-50 hover:border-indigo-100 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="text-lg">+</span> Agregar Alteración Estructural
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">E2. Funcionales</label>
                            <div className="space-y-2">
                                {(autoSynth.alteraciones_detectadas?.functional || []).map((alt: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center bg-indigo-50/30 p-2 rounded-lg border border-indigo-100/50">
                                        <div className="flex-1">
                                            <input type="text" className="w-full bg-white border border-indigo-200/50 rounded px-2 py-1.5 text-sm" value={alt.texto} onChange={(e) => {
                                                const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy[idx].texto = e.target.value; updateDeepObj('alteraciones_detectadas', { functional: copy });
                                            }} disabled={isClosed} placeholder="Ej: Control motor lumbopélvico deficiente..." />
                                        </div>
                                        <select className="w-1/3 bg-white border border-indigo-200/50 rounded px-2 py-1.5 text-sm" value={alt.severidad} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy[idx].severidad = e.target.value; updateDeepObj('alteraciones_detectadas', { functional: copy });
                                        }} disabled={isClosed}>
                                            <option value="leve">Severidad: Leve</option><option value="moderada">Severidad: Moderada</option><option value="severa">Severidad: Severa</option>
                                        </select>
                                        {!isClosed && <button onClick={() => { const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy.splice(idx, 1); updateDeepObj('alteraciones_detectadas', { functional: copy }); }} className="p-1 text-rose-500 hover:bg-rose-50 rounded">✕</button>}
                                    </div>
                                ))}
                                {!isClosed && <button onClick={() => updateDeepObj('alteraciones_detectadas', { functional: [...(autoSynth.alteraciones_detectadas?.functional || []), { texto: '', severidad: 'moderada' }] })} className="text-xs text-indigo-600 font-bold p-1">+ Agregar Alteración Funcional</button>}
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE F — ACTIVIDAD Y PARTICIPACIÓN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🏃‍♀️</span> F. Actividad y Participación</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">F1. Limitaciones Directas</label>
                                <div className="space-y-2">
                                    {(autoSynth.actividad_y_participacion?.limitaciones_directas || []).map((lim: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input type="text" className="flex-1 bg-slate-50 border rounded px-2 py-1.5 text-sm" value={lim.texto} onChange={(e) => {
                                                const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])]; copy[idx].texto = e.target.value; updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                            }} disabled={isClosed} />
                                            <select className="w-[100px] bg-slate-50 border rounded px-1 py-1.5 text-[11px]" value={lim.severidad} onChange={(e) => {
                                                const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])]; copy[idx].severidad = e.target.value; updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy });
                                            }} disabled={isClosed}><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="severa">Severa</option></select>
                                            {!isClosed && <button onClick={() => { const copy = [...(autoSynth.actividad_y_participacion?.limitaciones_directas || [])]; copy.splice(idx, 1); updateDeepObj('actividad_y_participacion', { limitaciones_directas: copy }); }} className="px-1 text-rose-500">✕</button>}
                                        </div>
                                    ))}
                                    {!isClosed && <button onClick={() => updateDeepObj('actividad_y_participacion', { limitaciones_directas: [...(autoSynth.actividad_y_participacion?.limitaciones_directas || []), { texto: '', severidad: 'moderada' }] })} className="text-[10px] text-indigo-600 font-bold p-1">+ Agregar L.</button>}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">F2. Restricciones (Participación)</label>
                                <div className="space-y-2">
                                    {(autoSynth.actividad_y_participacion?.restricciones_participacion || []).map((res: any, idx: number) => (
                                        <div key={idx} className="flex gap-2 items-center">
                                            <input type="text" className="flex-1 bg-slate-50 border rounded px-2 py-1.5 text-sm" value={res.texto} onChange={(e) => {
                                                const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])]; copy[idx].texto = e.target.value; updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                            }} disabled={isClosed} />
                                            <select className="w-[100px] bg-slate-50 border rounded px-1 py-1.5 text-[11px]" value={res.severidad} onChange={(e) => {
                                                const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                copy[idx].severidad = e.target.value;
                                                updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                            }} disabled={isClosed}>
                                                <option value="ligera">Ligera</option>
                                                <option value="moderada">Moderada</option>
                                                <option value="severa">Severa</option>
                                                <option value="completa">Completa</option>
                                            </select>
                                            {!isClosed && <button onClick={() => {
                                                const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])];
                                                copy.splice(idx, 1);
                                                updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                            }} className="px-1 text-rose-500">✕</button>}
                                        </div>
                                    ))}
                                    {!isClosed && <button onClick={() => updateDeepObj('actividad_y_participacion', { restricciones_participacion: [...(autoSynth.actividad_y_participacion?.restricciones_participacion || []), { texto: '', severidad: 'moderada' }] })} className="text-[10px] text-indigo-600 font-bold p-1">+ Agregar R.</button>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* CONTEXTO DE LA PERSONA (Expediente Integration) */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-wrap gap-6 items-center shadow-inner">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">👤</span>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Persona Usuaria</span>
                                <span className="text-sm font-bold text-slate-800">{persona?.nombre || 'Nombre no disponible'}</span>
                            </div>
                        </div>
                        <div className="h-8 border-r border-slate-200 hidden md:block" />
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 flex-1">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Edad / Sexo</span>
                                <span className="text-xs font-semibold text-slate-600">
                                    {persona?.fechaNacimiento ? `${new Date().getFullYear() - new Date(persona.fechaNacimiento).getFullYear()} años` : 'N/A'} • {persona?.sexo || 'N/A'}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Actividad / Deporte</span>
                                <span className="text-xs font-semibold text-slate-600">{anamnesisV4?.contextoDeportivo?.deportePrincipal || 'No especificado'}</span>
                            </div>
                            <div className="md:col-span-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Comorbilidades / Alertas</span>
                                <span className="text-xs font-semibold text-rose-600">{persona?.diagnosticosMedicos?.join(', ') || 'Sin comorbilidades registradas'}</span>
                            </div>
                        </div>
                    </div>

            {/* BLOQUE G — FACTORES BPS */}
            <div className="bg-white border border-slate-200 rounded-xl p-7 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-6 border-b pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xl bg-indigo-100 p-2 rounded-lg text-indigo-600">🧠</span> 
                        <div>
                            <span className="block">G. Factores Biopsicosociales</span>
                            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">Contexto, Entorno y Creencias (P1/P1.5)</span>
                        </div>
                    </div>
                </h3>
                        
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    {/* Personales (+) */}
                    <div className="bg-emerald-50/20 rounded-2xl p-6 border border-emerald-100/50 hover:shadow-md transition-all group">
                        <label className="text-[11px] font-black text-emerald-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
                            <span className="bg-emerald-100 p-1.5 rounded-lg group-hover:scale-110 transition-transform">⭐</span> Personales Positivos (+)
                        </label>
                        <textarea 
                            className="w-full bg-white border border-emerald-200/50 rounded-xl p-4 text-xs min-h-[140px] shadow-inner focus:ring-4 focus:ring-emerald-100 outline-none transition-all placeholder:text-slate-300" 
                            value={(autoSynth.factores_biopsicosociales?.factores_personales_positivos || []).join('\n')} 
                            onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_positivos: e.target.value.split('\n') })} 
                            disabled={isClosed} 
                            placeholder="Motivación, conocimiento del cuerpo, adherencia previa, apoyo social fuerte..." 
                        />
                    </div>
                    {/* Personales (-) */}
                    <div className="bg-rose-50/20 rounded-2xl p-6 border border-rose-100/50 hover:shadow-md transition-all group">
                        <label className="text-[11px] font-black text-rose-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
                            <span className="bg-rose-100 p-1.5 rounded-lg group-hover:scale-110 transition-transform">⚠️</span> Personales Negativos (-)
                        </label>
                        <textarea 
                            className="w-full bg-white border border-rose-200/50 rounded-xl p-4 text-xs min-h-[140px] shadow-inner focus:ring-4 focus:ring-rose-100 outline-none transition-all placeholder:text-slate-300" 
                            value={(autoSynth.factores_biopsicosociales?.factores_personales_negativos || []).join('\n')} 
                            onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_negativos: e.target.value.split('\n') })} 
                            disabled={isClosed} 
                            placeholder="Miedo al movimiento, catastrofización, estrés elevado, sueño pobre, creencias limitantes..." 
                        />
                    </div>
                    {/* Ambientales (F) */}
                    <div className="bg-sky-50/20 rounded-2xl p-6 border border-sky-100/50 hover:shadow-md transition-all group">
                        <label className="text-[11px] font-black text-sky-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
                            <span className="bg-sky-100 p-1.5 rounded-lg group-hover:scale-110 transition-transform">🌱</span> Facilitadores Ambientales
                        </label>
                        <textarea 
                            className="w-full bg-white border border-sky-200/50 rounded-xl p-4 text-xs min-h-[140px] shadow-inner focus:ring-4 focus:ring-sky-100 outline-none transition-all placeholder:text-slate-300" 
                            value={(autoSynth.factores_biopsicosociales?.facilitadores_ambientales || []).join('\n')} 
                            onChange={(e) => updateDeepObj('factores_biopsicosociales', { facilitadores_ambientales: e.target.value.split('\n') })} 
                            disabled={isClosed} 
                            placeholder="Acceso a gimnasio, tiempo disponible para terapia, entorno familiar colaborador..." 
                        />
                    </div>
                    {/* Ambientales (B) */}
                    <div className="bg-amber-50/20 rounded-2xl p-6 border border-amber-100/50 hover:shadow-md transition-all group">
                        <label className="text-[11px] font-black text-amber-700 uppercase tracking-widest block mb-4 flex items-center gap-2">
                            <span className="bg-amber-100 p-1.5 rounded-lg group-hover:scale-110 transition-transform">🚧</span> Barreras Ambientales
                        </label>
                        <textarea 
                            className="w-full bg-white border border-amber-200/50 rounded-xl p-4 text-xs min-h-[140px] shadow-inner focus:ring-4 focus:ring-amber-100 outline-none transition-all placeholder:text-slate-300" 
                            value={(autoSynth.factores_biopsicosociales?.barreras_ambientales || []).join('\n')} 
                            onChange={(e) => updateDeepObj('factores_biopsicosociales', { barreras_ambientales: e.target.value.split('\n') })} 
                            disabled={isClosed} 
                            placeholder="Exigencias laborales altas, falta de equipamiento, problemas de transporte..." 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { icon: "⏰", label: "Tiempo / Disponibilidad", value: anamnesisV4?.occupationalContext?.shifts || 'No reportado' },
                        { icon: "😴", label: "Calidad de Sueño", value: anamnesisV4?.bpsContext?.sleepQuality || 'No reportado' },
                        { icon: "🤯", label: "Nivel de Estrés", value: anamnesisV4?.bpsContext?.stressLevel || 'No reportado' },
                        { icon: "🚬", label: "Hábitos (Fumador/Alc)", value: anamnesisV4?.bpsContext?.smoking || anamnesisV4?.bpsContext?.alcohol ? `${anamnesisV4?.bpsContext?.smoking ? 'Fuma' : ''}${anamnesisV4?.bpsContext?.smoking && anamnesisV4?.bpsContext?.alcohol ? ' / ' : ''}${anamnesisV4?.bpsContext?.alcohol ? 'Alcohol' : ''}` : 'No reportado' },
                        { icon: "🧘", label: "Factores Protectores", value: anamnesisV4?.bpsContext?.protectiveFactors || 'No reportados' }
                    ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-indigo-50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <span className="text-xl shrink-0">{item.icon}</span>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">{item.label}</p>
                                <p className="text-xs font-semibold text-slate-700 truncate">{item.value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* BLOQUE H: RECORDATORIOS Y RED FLAGS */}
            <div className="bg-gradient-to-br from-rose-50 to-white border border-rose-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-rose-950 tracking-tight uppercase">Bloque H: Recordatorios Clínicos</h3>
                        <p className="text-xs text-rose-600 font-medium">Prioridad alta y precauciones para el tratamiento</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Alertas Rojas/Amarillas Directas */}
                    {((anamnesisV4?.medicalHistory?.criticalModifiers || []).length > 0 || anamnesisV4?.medicalHistory?.condicionesClinicasRelevantes?.some((c: any) => c.estado === 'No controlada')) && (
                        <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-200 animate-pulse border-2 border-rose-400">
                            <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-80">⚠️ Alerta Sistémica Activa</p>
                            <p className="text-sm font-bold leading-tight">
                                {anamnesisV4?.medicalHistory?.criticalModifiers?.join(', ') || 'Condiciones clínicas no controladas detectadas.'}
                            </p>
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white border border-rose-100 rounded-2xl shadow-sm">
                            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-2 border-b border-rose-50 pb-1">🚩 Red Flags / Precauciones</p>
                            <ul className="space-y-2">
                                {(anamnesisV4?.p15_context_flags?.alertas_banderas_rojas || []).length > 0 ? (
                                    anamnesisV4.p15_context_flags.alertas_banderas_rojas.map((f: string, i: number) => (
                                        <li key={i} className="text-xs font-bold text-rose-700 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0"></span>
                                            {f}
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-xs text-slate-400 italic">Sin banderas rojas reportadas</li>
                                )}
                            </ul>
                        </div>
                        <div className="p-4 bg-white border border-rose-100 rounded-2xl shadow-sm">
                            <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2 border-b border-amber-50 pb-1">⚠️ Banderas Amarillas</p>
                            <ul className="space-y-2">
                                {(anamnesisV4?.p15_context_flags?.factores_personales_negativos || []).length > 0 ? (
                                    anamnesisV4.p15_context_flags.factores_personales_negativos.map((f: string, i: number) => (
                                        <li key={i} className="text-xs font-bold text-amber-700 flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                            {f}
                                        </li>
                                    ))
                                ) : (
                                    <li className="text-xs text-slate-400 italic">Sin banderas amarillas reportadas</li>
                                )}
                            </ul>
                        </div>
                    </div>

                    <div className="p-4 bg-indigo-900 text-white rounded-2xl shadow-xl shadow-indigo-100/50">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">💡 Tip de Adherencia para este paciente</p>
                        <p className="text-sm italic font-medium">
                            {anamnesisV4?.bpsContext?.poorAdherenceHistory 
                                ? `Atención: Historial de baja adherencia. ${anamnesisV4.bpsContext.poorAdherenceHistory}`
                                : "No hay historial de mala adherencia. Enfocar en objetivos deportivos directos."
                            }
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                        <div className="bg-white rounded-2xl p-4 border border-indigo-100">
                            <label className="text-[10px] font-black text-indigo-800 uppercase tracking-widest block mb-1">📋 Notas Estratégicas</label>
                            <textarea 
                                className="w-full text-xs min-h-[60px] outline-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.recordatorios_clinicos || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { recordatorios_clinicos: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
                            />
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-amber-100">
                            <label className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-1">🔎 Incoherencias</label>
                            <textarea 
                                className="w-full text-xs min-h-[60px] outline-none" 
                                value={(autoSynth.recordatorios_y_coherencia?.incoherencias_detectadas || []).join('\n')} 
                                onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { incoherencias_detectadas: e.target.value.split('\n').filter(Boolean) })} 
                                disabled={isClosed} 
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
