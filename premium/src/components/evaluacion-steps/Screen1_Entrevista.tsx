import React, { useState, useEffect, useMemo } from "react";
import { EvaluacionInicial, KineFocusArea, KineComparableSign } from "@/types/clinica";
import { computeIrritability, computeSafety, computePainMechanism, buildExamChecklist, computeBpsImpact } from "@/lib/auto-engine";
import { InterviewAssistType } from "@/lib/ai/schemas";

export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];
const NATURALEZA = ['Punzante', 'Opresivo', 'Quemazón', 'Corriente', 'Hormigueo', 'Adormecimiento', 'Pesadez', 'Rigidez', 'Tirantez', 'Pulsátil', 'Profundo', 'Inestabilidad', 'Bloqueo', 'Otro'];
const IRRADIACION = ['Local', 'Se extiende', 'Sube-baja', 'Migratorio'];

export function Screen1_Entrevista({ formData, updateFormData, isClosed }: Screen1Props) {
    const interview = (formData.interview || { focos: [] }) as any;
    const focos: KineFocusArea[] = interview.focos || [];

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<InterviewAssistType | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    // Engine Hooks
    const engine = useMemo(() => {
        const safety = computeSafety(interview);
        const bps = computeBpsImpact(interview.yellowFlags);

        // Asumimos foco 0 para sticky, si hay
        const principalFocus = focos.length > 0 ? focos[0] : null;
        const irritability = principalFocus ? computeIrritability(principalFocus) : { level: 'Desconocida', reasons: [] };
        const mechanism = principalFocus ? computePainMechanism(principalFocus, interview) : { category: 'Desconocido', label: '-', reasons: [] };

        return { safety, bps, irritability, mechanism };
    }, [interview, focos]);

    const handleUpdateInterview = (patch: any) => {
        updateFormData(prev => ({
            interview: { ...(prev.interview || {}), ...patch }
        }));
    };

    const handleUpdateFoco = (index: number, patch: Partial<KineFocusArea>) => {
        const newFocos = [...focos];
        newFocos[index] = { ...newFocos[index], ...patch } as KineFocusArea;
        handleUpdateInterview({ focos: newFocos });
    };

    const handleAddFoco = () => {
        if (focos.length >= 5) return;
        const newFoco = {
            id: Date.now().toString(),
            isPrincipal: focos.length === 0,
            region: '',
            side: 'N/A',
            onsetType: 'Gradual',
            onsetDuration: 'Hoy',
            course2w: 'Igual',
            mainLimitation: '',
            painScaleId: 'EVA',
            painCurrent: '',
            painWorst24h: '',
            painBest24h: '',
            pattern24h: 'Variable',
            morningStiffness: '0',
            wakesAtNight: false,
            afterEffectFreq: 'Nunca',
            settlingTime: '<15 min',
            provocationEase: 'Media',
            symptomNature: [],
            symptomRadiates: 'Local',
            symptomAssociated: [],
            psfs: [],
            fastIcfActivities: [],
            sportContextActive: false,
            prevTreatmentsTags: [],
            suddenKinematics: [],
            aggravatingFactors: [],
            easingFactors: []
        } as unknown as KineFocusArea;
        handleUpdateInterview({ focos: [...focos, newFoco] });
    };

    const handleRemoveFoco = (index: number) => {
        const newFocos = [...focos];
        newFocos.splice(index, 1);
        handleUpdateInterview({ focos: newFocos });
    };

    // AI Assist
    const handleAskAI = async () => {
        if (!(interview.freeNarrativeGlobal || '').trim()) return;
        setIsAiLoading(true); setAiError(null); setAiSuggestions(null);
        try {
            const res = await fetch('/api/ai/interview-assist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ freeNarrative: interview.freeNarrativeGlobal })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error IA');
            setAiSuggestions(data.data as InterviewAssistType);
        } catch (err: any) {
            setAiError(err.message);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleCloseAnamnesis = () => {
        // Enviar a EvaluacionForm la señal o generar summary.
        // Aquí actualizamos el status o autoOutputs y dejamos a EvaluacionForm cerrar el panel
        const checklist = buildExamChecklist(interview, engine.irritability.level as any);
        const finalOutputs = {
            globalSafetyTriage: engine.safety.level,
            globalSafetyReasons: engine.safety.reasons,
            globalSafetyChecklist: engine.safety.checklist,
            globalBpsImpact: engine.bps.level,
            globalBpsTips: engine.bps.tips,
            perFocus: focos.reduce((acc, f) => {
                const irr = computeIrritability(f);
                const mech = computePainMechanism(f, interview);
                acc[f.id] = {
                    irritabilityLevel: irr.level,
                    irritabilityReasons: irr.reasons,
                    painMechanismCategory: mech.category,
                    painMechanismLabel: mech.label,
                    painMechanismReasons: mech.reasons
                };
                return acc;
            }, {} as any),
            examChecklistSelected: checklist
        };
        handleUpdateInterview({ autoOutputs: finalOutputs });
        alert("¡Anamnesis Próxima Cerrada! Outputs generados y enviados al Examen Físico.");
    };

    return (
        <div className="flex flex-col gap-6 pb-12">

            {/* STICKY HEADER */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 pb-3 pt-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col md:flex-row justify-between md:items-center gap-3">
                <div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight">Anamnesis Próxima y Riesgo</h2>
                    <p className="text-xs text-slate-500">Razonamiento Kine Real Estructurado</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <div className={`px-2 py-1 rounded-full border shadow-sm flex items-center gap-1
                        ${engine.safety.level === 'Rojo' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                            engine.safety.level === 'Amarillo' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                'bg-emerald-100 text-emerald-800 border-emerald-300'}`}>
                        Seguridad {engine.safety.level}
                    </div>
                    <div className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full shadow-sm">
                        Irrit. {engine.irritability.level}
                    </div>
                    <div className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-full shadow-sm">
                        Mecanismo: {engine.mechanism.category}
                    </div>
                </div>
            </div>

            {/* SECCION 1: Relato Global */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3">
                    <h3 className="font-bold text-slate-800">1. Relato del Episodio</h3>
                </div>
                <div className="p-4 space-y-3">
                    <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:bg-white outline-none"
                        rows={3}
                        placeholder="Relato de la persona usuaria..."
                        value={interview.freeNarrativeGlobal || ''}
                        onChange={e => handleUpdateInterview({ freeNarrativeGlobal: e.target.value })}
                        disabled={isClosed}
                    />
                    <div className="flex justify-end">
                        <button onClick={handleAskAI} disabled={isClosed || isAiLoading} className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg font-bold">
                            {isAiLoading ? "Pensando..." : "✨ Sugerir selecciones desde relato"}
                        </button>
                    </div>
                    {aiSuggestions && (
                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 text-xs">
                            <strong className="block mb-2 text-indigo-800">Sugerencias (Aceptar lo útil):</strong>
                            <ul className="space-y-1">
                                {aiSuggestions.proposedSelections.map((s, i) => (
                                    <li key={i}><span className="font-bold">{s.field}:</span> {s.value}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </section>

            {/* SECCION 2: Seguridad (Red Flags) */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">2. Seguridad (Red Flags)</h3>
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{engine.safety.level}</span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'redFlagsSystemic', label: 'Fiebre/Compromiso Sistémico o Cáncer previo' },
                        { key: 'redFlagsWeightLoss', label: 'Baja de peso no intencionada' },
                        { key: 'redFlagsNightPain', label: 'Dolor nocturno implacable no mecánico' },
                        { key: 'redFlagsTraumaHigh', label: 'Trauma alta energía / Caída importante' },
                        { key: 'redFlagsNeuroSevere', label: 'Síntomas neurológicos graves/progresivos (esfínteres/silla montar)' },
                        { key: 'redFlagsFractureParams', label: 'Sospecha fractura / Incapacidad de carga' },
                    ].map(flag => (
                        <label key={flag.key} className="flex items-start gap-2 text-xs">
                            <input type="checkbox" className="mt-0.5" checked={interview[flag.key] || false} onChange={e => handleUpdateInterview({ [flag.key]: e.target.checked })} disabled={isClosed} />
                            <span>{flag.label}</span>
                        </label>
                    ))}
                    {(interview.redFlagsSystemic || interview.redFlagsWeightLoss || interview.redFlagsTraumaHigh || interview.redFlagsNeuroSevere || interview.redFlagsFractureParams) && (
                        <div className="col-span-full mt-2">
                            <input type="text" placeholder="Conducta/Justificación del interno requerida (Si es rojo/amarillo)..."
                                className="w-full bg-rose-50 border border-rose-200 rounded px-3 py-2 text-xs outline-none"
                                value={interview.redFlagsDetailsText || ''} onChange={e => handleUpdateInterview({ redFlagsDetailsText: e.target.value })} disabled={isClosed} />
                        </div>
                    )}
                </div>
            </section>

            {/* SECCION 3: Banderas Amarillas (BPS) */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800">3. Banderas Amarillas (Impacto: {engine.bps.level})</h3>
                </div>
                <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { key: 'sleepImpact', label: 'Sueño deteriorado' },
                        { key: 'highStress', label: 'Estrés alto' },
                        { key: 'kinesiophobia', label: 'Miedo a cargar/mover' },
                        { key: 'damageWorry', label: 'Preocupación daño' },
                        { key: 'lowSelfEfficacy', label: 'Baja autoeficacia' },
                        { key: 'catastrophizing', label: 'Catastrofización' },
                        { key: 'returnPressure', label: 'Presión retorno' },
                        { key: 'highFrustration', label: 'Frustración alta' },
                    ].map(flag => {
                        const val = (interview.yellowFlags && interview.yellowFlags[flag.key]) ? interview.yellowFlags[flag.key] : 0;
                        return (
                            <div key={flag.key} className="border border-slate-100 rounded p-2 text-center text-xs">
                                <span className="block mb-1.5 h-8 font-medium">{flag.label}</span>
                                <div className="flex justify-center gap-1">
                                    {[0, 1, 2].map(n => (
                                        <button key={n} disabled={isClosed} onClick={() => handleUpdateInterview({ yellowFlags: { ...(interview.yellowFlags || {}), [flag.key]: n } })}
                                            className={`w-6 h-6 rounded-full text-[10px] ${val === n ? (n === 0 ? 'bg-emerald-100 border-emerald-300' : n === 1 ? 'bg-amber-100 border-amber-400' : 'bg-rose-100 border-rose-400') : 'bg-slate-100 border-slate-200'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* SECCION 4: MAPA DE FOCOS */}
            <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 p-3 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800">4. Mapa de Focos ({focos.length}/5)</h3>
                    <button onClick={handleAddFoco} disabled={isClosed || focos.length >= 5} className="text-xs bg-white border outline-none border-slate-200 px-3 py-1 rounded hover:bg-slate-50 font-medium">
                        + Añadir Foco
                    </button>
                </div>

                <div className="p-4 space-y-6">
                    {focos.length === 0 && <p className="text-xs text-slate-400 italic">No hay focos agregados. Añade uno para comenzar.</p>}

                    {focos.map((foco, idx) => (
                        <div key={foco.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-100 p-2 px-3 border-b border-slate-200 flex justify-between items-center">
                                <strong className="text-indigo-800 text-xs">{foco.isPrincipal ? 'FOCO PRINCIPAL' : `FOCO SECUNDARIO ${idx}`}</strong>
                                <button onClick={() => handleRemoveFoco(idx)} disabled={isClosed} className="text-rose-500 hover:text-rose-700 font-medium text-xs">Eliminar</button>
                            </div>

                            <div className="p-3">
                                {/* Base */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    <select value={foco.region || ''} onChange={e => handleUpdateFoco(idx, { region: e.target.value })} disabled={isClosed} className="bg-white border border-slate-200 text-xs p-2 rounded">
                                        <option value="">Región...</option>
                                        {REGIONES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                    <select value={foco.side || ''} onChange={e => handleUpdateFoco(idx, { side: e.target.value as any })} disabled={isClosed} className="bg-white border border-slate-200 text-xs p-2 rounded">
                                        {LADOS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>

                                {/* Tabs simples de foco (usamos sections visuales por ahora) */}
                                <div className="space-y-4">

                                    {/* A. HISTORIA */}
                                    <div className="border border-slate-100 rounded bg-slate-50/50 p-3">
                                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 mb-2">A. Historia y Mecanismo</h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                                            <select value={foco.onsetType} onChange={e => handleUpdateFoco(idx, { onsetType: e.target.value as any })} disabled={isClosed} className="bg-white border border-slate-200 text-xs p-1.5 rounded">
                                                <option value="Súbito">Inicio Súbito (Trauma)</option>
                                                <option value="Gradual">Inicio Gradual (Sobrecarga)</option>
                                            </select>
                                            <select value={foco.onsetDuration} onChange={e => handleUpdateFoco(idx, { onsetDuration: e.target.value as any })} disabled={isClosed} className="bg-white border border-slate-200 text-xs p-1.5 rounded">
                                                <option value="Hoy">Hoy</option>
                                                <option value="1–7 días">1-7 días</option>
                                                <option value="2–6 sem">2-6 sem</option>
                                                <option value="6–12 sem">6-12 sem</option>
                                                <option value="3–6 meses">3-6 meses</option>
                                                <option value=">6 meses">&gt; 6 meses</option>
                                            </select>
                                        </div>

                                        {/* Ramificación Trauma vs Sobrecarga */}
                                        {foco.onsetType === 'Súbito' && (
                                            <div className="bg-amber-50/50 border border-amber-100 rounded p-2 grid grid-cols-2 gap-2 text-xs">
                                                <span className="col-span-full font-semibold text-amber-800">Ramificación Trauma Agudo</span>
                                                <select value={foco.suddenSound || ''} onChange={e => handleUpdateFoco(idx, { suddenSound: e.target.value as any })} disabled={isClosed} className="border border-slate-200 rounded p-1">
                                                    <option value="">Sonido...</option>
                                                    {['Chasquido', 'Tirón', 'Desgarro', 'Nada'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <select value={foco.suddenImmediateCapacity || ''} onChange={e => handleUpdateFoco(idx, { suddenImmediateCapacity: e.target.value as any })} disabled={isClosed} className="border border-slate-200 rounded p-1">
                                                    <option value="">Capacidad al momento...</option>
                                                    {['Igual', 'Con molestia', 'Detenerse', 'Incapaz'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <select value={foco.suddenSwellingVisible || ''} onChange={e => handleUpdateFoco(idx, { suddenSwellingVisible: e.target.value as any })} disabled={isClosed} className="border border-slate-200 rounded p-1">
                                                    <option value="">Hinchazón menor 2h...</option>
                                                    {['Sí', 'No', 'No sabe'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        {foco.onsetType === 'Gradual' && (
                                            <div className="bg-blue-50/50 border border-blue-100 rounded p-2 grid grid-cols-2 gap-2 text-xs">
                                                <span className="col-span-full font-semibold text-blue-800">Ramificación Cambios de Carga (1-4 sem)</span>
                                                <select value={foco.gradualVolumeChange || ''} onChange={e => handleUpdateFoco(idx, { gradualVolumeChange: e.target.value as any })} disabled={isClosed} className="border border-slate-200 rounded p-1">
                                                    <option value="">Cambio de Volumen (+ / -)...</option>
                                                    {['0–10', '10–30', '30–50', '>50', 'No sabe'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <select value={foco.gradualPainAppears || ''} onChange={e => handleUpdateFoco(idx, { gradualPainAppears: e.target.value as any })} disabled={isClosed} className="border border-slate-200 rounded p-1">
                                                    <option value="">El dolor aparece...</option>
                                                    {['Al inicio', 'Durante', 'Después', 'Al día siguiente'].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    {/* B. PERFIL SINTOMA */}
                                    <div className="border border-slate-100 rounded bg-slate-50/50 p-3">
                                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 mb-2">B. Perfil Sintomático</h4>
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {NATURALEZA.map(n => {
                                                const isActive = (foco.symptomNature || []).includes(n);
                                                return <button key={n} disabled={isClosed} onClick={() => {
                                                    const tags = foco.symptomNature || [];
                                                    handleUpdateFoco(idx, { symptomNature: isActive ? tags.filter(x => x !== n) : [...tags, n] });
                                                }} className={`px-2 py-0.5 rounded-full text-[10px] border ${isActive ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600'}`}>{n}</button>
                                            })}
                                        </div>

                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Dolor Actual ({foco.painScaleId})</label>
                                                <input type="number" min={0} max={10} value={foco.painCurrent} onChange={(e) => handleUpdateFoco(idx, { painCurrent: e.target.value })} disabled={isClosed} className="w-full text-xs p-1 mt-1 border rounded bg-white" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Peor 24h</label>
                                                <input type="number" min={0} max={10} value={foco.painWorst24h} onChange={(e) => handleUpdateFoco(idx, { painWorst24h: e.target.value })} disabled={isClosed} className="w-full text-xs p-1 mt-1 border rounded bg-white" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Irradiación</label>
                                                <select value={foco.symptomRadiates} onChange={e => handleUpdateFoco(idx, { symptomRadiates: e.target.value as any })} disabled={isClosed} className="w-full text-xs p-1 mt-1 border rounded bg-white">
                                                    {IRRADIACION.map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* C. FUNCION E IMPACTO */}
                                    <div className="border border-slate-100 rounded bg-slate-50/50 p-3">
                                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 mb-2">C. Función y Meta</h4>
                                        <input type="text" placeholder="Limitación principal (ej: Caminar 2 cuadras)" value={foco.mainLimitation} onChange={e => handleUpdateFoco(idx, { mainLimitation: e.target.value })} disabled={isClosed} className="w-full text-xs p-2 border rounded bg-white mb-2" />
                                    </div>

                                    {/* D. COMPARABLE */}
                                    <div className="border border-slate-100 rounded bg-slate-50/50 p-3">
                                        <h4 className="font-bold text-[11px] uppercase tracking-wider text-slate-500 mb-2 flex justify-between">
                                            D. Signo Comparable Estrella
                                            <span className="text-[9px] font-normal text-slate-400">(Surgiere base P2)</span>
                                        </h4>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <input type="text" placeholder="Nombre (Ej: Sentadilla)" value={foco.primaryComparable?.name || ''}
                                                onChange={e => handleUpdateFoco(idx, { primaryComparable: { ...(foco.primaryComparable || {} as any), name: e.target.value, type: 'Movimiento' } })} disabled={isClosed} className="border rounded bg-white p-1.5" />
                                            <input type="text" placeholder="Dolor EVA" value={foco.primaryComparable?.painLevel || ''}
                                                onChange={e => handleUpdateFoco(idx, { primaryComparable: { ...(foco.primaryComparable || {} as any), painLevel: e.target.value } })} disabled={isClosed} className="border rounded bg-white p-1.5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* SECCION 5 & 6 COMPRIMIDAS UX */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">5. Contexto Deportivo</h3>
                    <label className="flex items-center gap-2 text-xs mb-3">
                        <input type="checkbox" checked={focos[0]?.sportContextActive || false} onChange={e => {
                            if (focos.length > 0) handleUpdateFoco(0, { sportContextActive: e.target.checked });
                        }} disabled={isClosed} />
                        Persona practica deporte/gimnasio de manera regular
                    </label>
                    {focos[0]?.sportContextActive && (
                        <div className="space-y-2">
                            <input type="text" placeholder="Deporte o Disciplina principal" className="w-full text-xs p-2 border rounded bg-white" disabled={isClosed}
                                value={focos[0]?.sportMain || ''} onChange={e => handleUpdateFoco(0, { sportMain: e.target.value })} />
                            <select className="w-full text-xs p-2 border rounded bg-white" value={focos[0]?.sportCurrentState || ''} onChange={e => handleUpdateFoco(0, { sportCurrentState: e.target.value as any })} disabled={isClosed}>
                                <option value="">Estado Actual deportivo...</option>
                                {['Reposo', 'Modificado', 'Cruzado', 'Normal con dolor'].map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                </section>
                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">6. Experiencia de la Persona</h3>
                    <div className="space-y-3">
                        <input type="text" placeholder="¿Qué cree la persona que lo gatilló?" value={interview.triggerBelief || ''} onChange={e => handleUpdateInterview({ triggerBelief: e.target.value })} disabled={isClosed} className="w-full text-xs p-2 border rounded bg-white" />
                        <select value={interview.mainConcern || ''} onChange={e => handleUpdateInterview({ mainConcern: e.target.value })} disabled={isClosed} className="w-full text-xs p-2 border rounded bg-white">
                            <option value="">¿Qué le preocupa más?</option>
                            {['Dolor per se', 'Posible Daño estructural', 'Pérdida de rendimiento deportivo', 'Incapacidad de trabajar', 'Miedo a recaída/crónico', 'Otro'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                </section>
            </div>

            {/* SECCION 7: Cierre Anamnesis */}
            <section className="bg-emerald-50 border text-sm border-emerald-200 rounded-xl shadow-sm p-4 text-center">
                <h3 className="font-bold text-emerald-800 mb-2">7. Cierre Estructurado</h3>
                <p className="text-xs text-emerald-700 mb-4 max-w-lg mx-auto">
                    Al cerrar la anamnesis próxima, los motores de clínica y riesgo generan pautas y guías priorizadas para el Examen Físico automáticamente.
                </p>
                <button onClick={handleCloseAnamnesis} disabled={isClosed} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2 rounded-xl transition shadow-sm uppercase tracking-wider text-xs">
                    🔒 Aprobar Anamnesis
                </button>
            </section>

        </div>
    );
}
