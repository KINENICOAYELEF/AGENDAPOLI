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
    const normalizedCase = normalizeEvaluationState(formData);

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Síntesis y Ordenamiento del Caso</h2>
                <p className="text-sm text-slate-500 mt-1">Revisa el resumen y clasifica el caso estructuradamente antes de pasar a planificar.</p>
            </div>

            {/* BLOQUE A — RESUMEN AUTOMÁTICO DEL CASO (Solo lectura) */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-sm text-sm">
                <h3 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">A. Snapshot Clínico Normalizado (P1 y P2)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="md:col-span-2"><span className="text-xs text-slate-500 block">Identificación</span><span className="font-bold text-slate-800">{normalizedCase.identificacion}</span></div>
                    <div className="md:col-span-2"><span className="text-xs text-slate-500 block">Motivo / Foco Principal</span><span className="font-medium text-slate-800">{normalizedCase.focoPrincipal ? `${normalizedCase.focoPrincipal.region || 'S/N'} (${normalizedCase.ladoPrincipal})` : 'No definido'}</span></div>
                    <div><span className="text-xs text-slate-500 block">Irritabilidad Sugerida</span><span className="font-medium text-slate-800">{normalizedCase.irritabilidad}</span></div>
                    <div><span className="text-xs text-slate-500 block">Semáforo de Carga</span><span className={`font-bold ${engine.safety.level === 'Rojo' ? 'text-rose-600' : engine.safety.level === 'Amarillo' ? 'text-amber-600' : 'text-emerald-600'}`}>{engine.safety.level}</span></div>
                    <div className="md:col-span-2"><span className="text-xs text-slate-500 block">Tarea Índice</span><span className="font-medium text-slate-800">{normalizedCase.tareaIndice || 'No definida'}</span></div>
                </div>
                {safetyAlerts && safetyAlerts.length > 0 && (
                    <div className="mt-4 bg-rose-50 border border-rose-100 text-rose-700 p-2 rounded text-xs font-medium">
                        ⚠️ Alertas: {safetyAlerts.join(' | ')}
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
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🔥</span> C. Clasificación del Dolor</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Categoría Principal</label>
                                <select 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={autoSynth.clasificacion_dolor?.categoria_principal || ''}
                                    onChange={(e) => updateDeepObj('clasificacion_dolor', { categoria_principal: e.target.value })}
                                    disabled={isClosed}
                                >
                                    <option value="">Selecciona...</option>
                                    <option value="Aparente nociceptivo">Aparente nociceptivo</option>
                                    <option value="Aparente neuropático">Aparente neuropático</option>
                                    <option value="Aparente nociplástico">Aparente nociplástico</option>
                                    <option value="Mixto">Mixto</option>
                                    <option value="No concluyente">No concluyente</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Subtipo / Apellido</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={autoSynth.clasificacion_dolor?.subtipo_apellido || ''}
                                    onChange={(e) => updateDeepObj('clasificacion_dolor', { subtipo_apellido: e.target.value })}
                                    disabled={isClosed}
                                    placeholder="Ej: de origen inflamatorio"
                                />
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
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🦴</span> D. Sistema y Estructuras</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Sistema Principal</label>
                                <input 
                                    type="text" 
                                    list="sistema-options"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={autoSynth.sistema_y_estructuras?.sistema_principal || ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { sistema_principal: e.target.value })}
                                    disabled={isClosed}
                                    placeholder="Ej: Tejido contráctil / Mixto"
                                />
                                <datalist id="sistema-options">
                                    <option value="Tejido contráctil" />
                                    <option value="Articulación / cápsula" />
                                    <option value="Ligamento / estabilidad pasiva" />
                                    <option value="Sistema neural" />
                                    <option value="Control motor / movimiento" />
                                    <option value="Carga ósea" />
                                    <option value="Tejido conectivo / fascia" />
                                    <option value="Mixto" />
                                </datalist>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estructura Principal</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={autoSynth.sistema_y_estructuras?.estructura_principal || ''}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { estructura_principal: e.target.value })}
                                    disabled={isClosed}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Estructuras Secundarias (separadas por coma)</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-sm disabled:opacity-75"
                                    value={(autoSynth.sistema_y_estructuras?.estructuras_secundarias || []).join(', ')}
                                    onChange={(e) => updateDeepObj('sistema_y_estructuras', { estructuras_secundarias: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    disabled={isClosed}
                                    placeholder="Ej: Bursa subacromial, Bíceps largo..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE E — ALTERACIONES */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">⚙️</span> E. Alteraciones Detectadas</h3>
                        
                        <div className="mb-6">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">E1. Estructurales</label>
                            <div className="space-y-2">
                                {(autoSynth.alteraciones_detectadas?.estructurales || []).map((alt: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-start">
                                        <input type="text" className="flex-1 bg-slate-50 border rounded p-2 text-sm" value={alt.texto} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])]; copy[idx].texto = e.target.value; updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                        }} disabled={isClosed} />
                                        <select className="w-1/4 bg-slate-50 border rounded p-2 text-sm" value={alt.certeza} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])]; copy[idx].certeza = e.target.value; updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                        }} disabled={isClosed}>
                                            <option value="posible">Posible</option><option value="probable">Probable</option><option value="casi_confirmada">Casi confirmada</option><option value="no_concluyente">No concluyente</option>
                                        </select>
                                        <input type="text" className="flex-1 bg-slate-50 border rounded p-2 text-sm" value={alt.fundamento_breve} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])]; copy[idx].fundamento_breve = e.target.value; updateDeepObj('alteraciones_detectadas', { estructurales: copy });
                                        }} disabled={isClosed} placeholder="Fundamento..." />
                                        {!isClosed && <button onClick={() => { const copy = [...(autoSynth.alteraciones_detectadas?.estructurales || [])]; copy.splice(idx, 1); updateDeepObj('alteraciones_detectadas', { estructurales: copy }); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded">✕</button>}
                                    </div>
                                ))}
                                {!isClosed && <button onClick={() => updateDeepObj('alteraciones_detectadas', { estructurales: [...(autoSynth.alteraciones_detectadas?.estructurales || []), { texto: '', certeza: 'posible', fundamento_breve: '' }] })} className="text-xs text-indigo-600 font-bold p-1">+ Agregar Alteración Estructural</button>}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">E2. Funcionales</label>
                            <div className="space-y-2">
                                {(autoSynth.alteraciones_detectadas?.functional || []).map((alt: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <input type="text" className="flex-1 bg-slate-50 border rounded p-2 text-sm" value={alt.texto} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy[idx].texto = e.target.value; updateDeepObj('alteraciones_detectadas', { functional: copy });
                                        }} disabled={isClosed} />
                                        <select className="w-1/3 bg-slate-50 border rounded p-2 text-sm" value={alt.severidad} onChange={(e) => {
                                            const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy[idx].severidad = e.target.value; updateDeepObj('alteraciones_detectadas', { functional: copy });
                                        }} disabled={isClosed}>
                                            <option value="leve">Leve</option><option value="moderada">Moderada</option><option value="severa">Severa</option>
                                        </select>
                                        {!isClosed && <button onClick={() => { const copy = [...(autoSynth.alteraciones_detectadas?.functional || [])]; copy.splice(idx, 1); updateDeepObj('alteraciones_detectadas', { functional: copy }); }} className="p-2 text-rose-500 hover:bg-rose-50 rounded">✕</button>}
                                    </div>
                                ))}
                                {!isClosed && <button onClick={() => updateDeepObj('alteraciones_detectadas', { functional: [...(autoSynth.alteraciones_detectadas?.functional || []), { texto: '', severidad: 'moderada' }] })} className="text-xs text-indigo-600 font-bold p-1">+ Agregar Alteración Funcional</button>}
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE F — ACTIVIDAD Y PARTICIPACIÓN */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
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
                                                const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])]; copy[idx].severidad = e.target.value; updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy });
                                            }} disabled={isClosed}><option value="leve">Leve</option><option value="moderada">Moderada</option><option value="severa">Severa</option></select>
                                            {!isClosed && <button onClick={() => { const copy = [...(autoSynth.actividad_y_participacion?.restricciones_participacion || [])]; copy.splice(idx, 1); updateDeepObj('actividad_y_participacion', { restricciones_participacion: copy }); }} className="px-1 text-rose-500">✕</button>}
                                        </div>
                                    ))}
                                    {!isClosed && <button onClick={() => updateDeepObj('actividad_y_participacion', { restricciones_participacion: [...(autoSynth.actividad_y_participacion?.restricciones_participacion || []), { texto: '', severidad: 'moderada' }] })} className="text-[10px] text-indigo-600 font-bold p-1">+ Agregar R.</button>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE G — FACTORES BPS */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2"><span className="text-lg">🧠</span> G. Factores Biopsicosociales</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            {/* Personales (+) */}
                            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                <label className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-2">Personales Positivos (+)</label>
                                <textarea className="w-full bg-white border border-emerald-200 rounded p-2 text-xs h-[60px]" value={(autoSynth.factores_biopsicosociales?.factores_personales_positivos || []).join('\n')} onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_positivos: e.target.value.split('\n') })} disabled={isClosed} placeholder="Listado (enter)..." />
                            </div>
                            {/* Personales (-) */}
                            <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                                <label className="text-[10px] font-bold text-rose-800 uppercase tracking-wider block mb-2">Personales Negativos (-)</label>
                                <textarea className="w-full bg-white border border-rose-200 rounded p-2 text-xs h-[60px]" value={(autoSynth.factores_biopsicosociales?.factores_personales_negativos || []).join('\n')} onChange={(e) => updateDeepObj('factores_biopsicosociales', { factores_personales_negativos: e.target.value.split('\n') })} disabled={isClosed} placeholder="Listado (enter)..." />
                            </div>
                            {/* Ambientales (F) */}
                            <div className="bg-sky-50 rounded-lg p-3 border border-sky-100">
                                <label className="text-[10px] font-bold text-sky-800 uppercase tracking-wider block mb-2">Facilitadores Ambientales</label>
                                <textarea className="w-full bg-white border border-sky-200 rounded p-2 text-xs h-[60px]" value={(autoSynth.factores_biopsicosociales?.facilitadores_ambientales || []).join('\n')} onChange={(e) => updateDeepObj('factores_biopsicosociales', { facilitadores_ambientales: e.target.value.split('\n') })} disabled={isClosed} placeholder="Listado (enter)..." />
                            </div>
                            {/* Ambientales (B) */}
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block mb-2">Barreras Ambientales</label>
                                <textarea className="w-full bg-white border border-amber-200 rounded p-2 text-xs h-[60px]" value={(autoSynth.factores_biopsicosociales?.barreras_ambientales || []).join('\n')} onChange={(e) => updateDeepObj('factores_biopsicosociales', { barreras_ambientales: e.target.value.split('\n') })} disabled={isClosed} placeholder="Listado (enter)..." />
                            </div>
                        </div>
                    </div>

                    {/* BLOQUE H — RECORDATORIOS CLÍNICOS */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 shadow-sm">
                        <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2"><span className="text-lg">💡</span> H. Recordatorios y Coherencia</h3>
                        <p className="text-[10px] text-indigo-700/80 mb-3">Puntos a vigilar sugeridos por la IA.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-1">Recordatorios</label>
                                <textarea className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-xs h-[60px]" value={(autoSynth.recordatorios_y_coherencia?.recordatorios_clinicos || []).join('\n')} onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { recordatorios_clinicos: e.target.value.split('\n').filter(Boolean) })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-1">Vigilar en tto</label>
                                <textarea className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-xs h-[60px]" value={(autoSynth.recordatorios_y_coherencia?.cosas_a_vigilar_en_tratamiento || []).join('\n')} onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { cosas_a_vigilar_en_tratamiento: e.target.value.split('\n').filter(Boolean) })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-indigo-800 uppercase block mb-1">Faltantes no críticos</label>
                                <textarea className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-xs h-[60px]" value={(autoSynth.recordatorios_y_coherencia?.faltantes_no_criticos || []).join('\n')} onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { faltantes_no_criticos: e.target.value.split('\n').filter(Boolean) })} disabled={isClosed} />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-rose-800 uppercase block mb-1">Incoherencias</label>
                                <textarea className="w-full bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs h-[60px]" value={(autoSynth.recordatorios_y_coherencia?.incoherencias_detectadas || []).join('\n')} onChange={(e) => updateDeepObj('recordatorios_y_coherencia', { incoherencias_detectadas: e.target.value.split('\n').filter(Boolean) })} disabled={isClosed} />
                            </div>
                        </div>
                    </div>

                </div>
            )}

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
    );
}
