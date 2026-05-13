import React, { useState } from "react";

const CollapsibleSection = ({ id, title, icon, collapsed, toggle, children }: any) => (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <button onClick={() => toggle(id)} className="w-full flex justify-between items-center px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><span>{icon}</span>{title}</span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {!collapsed && <div className="p-5 space-y-4 bg-white">{children}</div>}
    </div>
);

interface Props {
    clasificacionDolor: any; setClasificacionDolor: (v: any) => void;
    diagnosticoNarrativo: string; setDiagnosticoNarrativo: (v: string) => void;
    objetivoGeneral: any; setObjetivoGeneral: (v: any) => void;
    objetivosSmart: any[]; setObjetivosSmart: (v: any) => void;
    pronostico: any; setPronostico: (v: any) => void;
    fases: any[]; setFases: (v: any) => void;
    reglasReeval: any; setReglasReeval: (v: any) => void;
    collapsed: Record<string, boolean>; setCollapsed: (v: any) => void;
    onPublish: () => void; isPublishing: boolean; publishSuccess: boolean;
    razonamientoIA?: string;
    anamnesisProxima?: string; anamnesisRemota?: string; evaluacionFisica?: string;
}

export function ClinicalPlanningSection(props: Props) {
    const { clasificacionDolor, setClasificacionDolor, diagnosticoNarrativo, setDiagnosticoNarrativo,
        objetivoGeneral, setObjetivoGeneral, objetivosSmart, setObjetivosSmart,
        pronostico, setPronostico, fases, setFases, reglasReeval, setReglasReeval,
        collapsed, setCollapsed, onPublish, isPublishing, publishSuccess,
        razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica } = props;

    const [isGenerating, setIsGenerating] = useState(false);
    const toggle = (id: string) => setCollapsed((prev: any) => ({ ...prev, [id]: !prev[id] }));
    const isCollapsed = (id: string) => collapsed[id] !== false;

    // Convert SMART array to text and back
    const smartToText = (arr: any[]) => arr.map((o: any) => o.texto || '').filter(Boolean).join('\n');
    const textToSmart = (text: string) => text.split('\n').filter((l: string) => l.trim()).map((l: string) => ({ id: Date.now().toString(36) + Math.random().toString(36).substring(2), texto: l.trim(), plazo: '', prioridad: 'Media', variable_base: '', basal: '', meta: '' }));

    const handleGenerateAi = async () => {
        if (!razonamientoIA && !anamnesisProxima && !evaluacionFisica) return alert("Primero genera el razonamiento con IA.");
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/express-plan', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Error');
            const d = json.data;
            if (d.clasificacion_dolor) setClasificacionDolor(d.clasificacion_dolor);
            if (d.diagnostico_narrativo) setDiagnosticoNarrativo(d.diagnostico_narrativo);
            if (d.objetivo_general) setObjetivoGeneral(d.objetivo_general);
            if (d.objetivos_smart) setObjetivosSmart(d.objetivos_smart.map((o: any) => ({ ...o, id: Date.now().toString(36) + Math.random().toString(36).substring(2) })));
            if (d.pronostico) setPronostico(d.pronostico);
            if (d.fases_rehabilitacion) setFases(d.fases_rehabilitacion);
            if (d.reglas_reevaluacion) setReglasReeval(d.reglas_reevaluacion);
            setCollapsed({ A: false, B: false, C: false, D: false, E: false, F: false, G: false });
        } catch (err: any) { alert('Error generando plan: ' + err.message); }
        finally { setIsGenerating(false); }
    };

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 space-y-6">
            <div className="text-center">
                <h3 className="font-black text-slate-800 text-lg flex items-center justify-center gap-2">🧠 Síntesis, Diagnóstico y Plan Clínico</h3>
                <p className="text-xs text-slate-500 mt-1">Clasificación CIF, objetivos SMART, fases de rehabilitación y reevaluación</p>
            </div>

            <button onClick={handleGenerateAi} disabled={isGenerating || (!razonamientoIA && !anamnesisProxima)}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-emerald-600/10 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isGenerating ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando Plan Clínico...</>) : (<><span className="text-xl">🧠</span> Generar Diagnóstico y Plan con IA</>)}
            </button>

            <div className="space-y-3">
                {/* A. Clasificación del Dolor */}
                <CollapsibleSection id="A" title="Clasificación del Dolor" icon="🎯" collapsed={isCollapsed('A')} toggle={toggle}>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={clasificacionDolor.categoria} onChange={e => setClasificacionDolor({ ...clasificacionDolor, categoria: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {['Nociceptivo', 'Neuropático', 'Nociplástico', 'Mixto'].map(o => <option key={o} value={o}>{o}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Subtipo</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" value={clasificacionDolor.subtipo} onChange={e => setClasificacionDolor({ ...clasificacionDolor, subtipo: e.target.value })} placeholder="Mecánico, Inflamatorio..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Fundamento Clínico</label>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[120px]" rows={5} value={clasificacionDolor.fundamento} onChange={e => setClasificacionDolor({ ...clasificacionDolor, fundamento: e.target.value })} placeholder="Justificación cruzando anamnesis con evaluación..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Confianza</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={clasificacionDolor.confianza} onChange={e => setClasificacionDolor({ ...clasificacionDolor, confianza: e.target.value })}>
                            <option value="">Seleccionar...</option>
                            {['Alta', 'Moderada', 'Baja'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                </CollapsibleSection>

                {/* B. Diagnóstico Narrativo */}
                <CollapsibleSection id="B" title="Diagnóstico Kinesiológico Narrativo" icon="📝" collapsed={isCollapsed('B')} toggle={toggle}>
                    <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[180px] leading-relaxed" rows={8} value={diagnosticoNarrativo} onChange={e => setDiagnosticoNarrativo(e.target.value)} placeholder="Diagnóstico CIF: [nombre] presenta [deficiencias] que generan [limitaciones] y [restricciones]..." />
                </CollapsibleSection>

                {/* C. Objetivo General con opciones */}
                <CollapsibleSection id="C" title="Objetivo General" icon="🎯" collapsed={isCollapsed('C')} toggle={toggle}>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Problema Principal del Caso</label>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]" rows={3} value={objetivoGeneral?.problema_principal_caso || ''} onChange={e => setObjetivoGeneral({ ...objetivoGeneral, problema_principal_caso: e.target.value })} placeholder="Describe el problema central..." />
                    </div>
                    {objetivoGeneral?.opciones_sugeridas?.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Opciones Sugeridas (selecciona una)</label>
                            <div className="space-y-2">
                                {objetivoGeneral.opciones_sugeridas.map((op: string, i: number) => (
                                    <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${objetivoGeneral.seleccionado === op ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="obj_general_radio" checked={objetivoGeneral.seleccionado === op} onChange={() => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: op })} className="mt-1 accent-indigo-600" />
                                        <span className="text-sm text-slate-700 leading-relaxed">{op}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {(!objetivoGeneral?.opciones_sugeridas || objetivoGeneral.opciones_sugeridas.length === 0) && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Objetivo General (texto libre)</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100" rows={3} value={objetivoGeneral?.seleccionado || ''} onChange={e => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: e.target.value })} placeholder="Restaurar la capacidad funcional..." />
                        </div>
                    )}
                </CollapsibleSection>

                {/* D. Objetivos SMART - simplified textarea */}
                <CollapsibleSection id="D" title={`Objetivos SMART (${objetivosSmart.length})`} icon="📊" collapsed={isCollapsed('D')} toggle={toggle}>
                    <p className="text-xs text-slate-400">Un objetivo por línea. Puedes editar, agregar o borrar líneas libremente.</p>
                    <textarea
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[200px] leading-relaxed font-mono"
                        rows={Math.max(8, objetivosSmart.length + 2)}
                        value={smartToText(objetivosSmart)}
                        onChange={e => setObjetivosSmart(textToSmart(e.target.value))}
                        placeholder={"Reducir dolor de rodilla derecha (EVA) de 7/10 a 3/10 en 4 semanas\nAumentar ROM de flexión de rodilla de 90° a 130° en 6 semanas\nMejorar fuerza de cuádriceps (MMT) de 3/5 a 4+/5 en 8 semanas"}
                    />
                    <p className="text-xs text-slate-400">{objetivosSmart.length} objetivo{objetivosSmart.length !== 1 ? 's' : ''} detectado{objetivosSmart.length !== 1 ? 's' : ''}</p>
                </CollapsibleSection>

                {/* E. Pronóstico */}
                <CollapsibleSection id="E" title="Pronóstico Biopsicosocial" icon="📈" collapsed={isCollapsed('E')} toggle={toggle}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { key: 'corto_plazo', label: 'Corto Plazo (0-4 sem)' },
                            { key: 'mediano_plazo', label: 'Mediano Plazo (4-12 sem)' },
                            { key: 'largo_plazo', label: 'Largo Plazo (>12 sem)' },
                        ].map(({ key, label }) => (
                            <div key={key}>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
                                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[100px]" rows={4} value={(pronostico as any)[key]} onChange={e => setPronostico({ ...pronostico, [key]: e.target.value })} />
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Factores a Favor</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]" rows={3} value={(pronostico.factores_a_favor || []).join('\n')} onChange={e => setPronostico({ ...pronostico, factores_a_favor: e.target.value.split('\n').filter((l: string) => l.trim()) })} placeholder="Un factor por línea" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Factores en Contra</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[80px]" rows={3} value={(pronostico.factores_en_contra || []).join('\n')} onChange={e => setPronostico({ ...pronostico, factores_en_contra: e.target.value.split('\n').filter((l: string) => l.trim()) })} placeholder="Un factor por línea" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Historia Natural (sin tratamiento)</label>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[100px]" rows={4} value={pronostico.historia_natural} onChange={e => setPronostico({ ...pronostico, historia_natural: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Categoría Pronóstica</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={pronostico.categoria} onChange={e => setPronostico({ ...pronostico, categoria: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {['favorable', 'favorable con vigilancia', 'reservado', 'reservado dependiente', 'desfavorable', 'incierto'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Justificación</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]" rows={3} value={pronostico.justificacion} onChange={e => setPronostico({ ...pronostico, justificacion: e.target.value })} />
                        </div>
                    </div>
                </CollapsibleSection>

                {/* F. Fases de Rehabilitación */}
                <CollapsibleSection id="F" title={`Fases de Rehabilitación (${fases.length})`} icon="🏋️" collapsed={isCollapsed('F')} toggle={toggle}>
                    {fases.map((fase: any, idx: number) => (
                        <details key={idx} className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 overflow-hidden group">
                            <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-indigo-800 hover:bg-slate-100 transition-colors flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">{fase.fase}</span>
                                {fase.nombre} <span className="text-xs font-normal text-slate-400 ml-auto">{fase.duracion_estimada}</span>
                            </summary>
                            <div className="px-4 pb-4 pt-2 space-y-3 border-t border-slate-100">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div><span className="font-bold text-slate-500">Foco:</span> <span className="text-slate-700">{fase.foco_principal}</span></div>
                                    <div><span className="font-bold text-slate-500">Obj. Fisiológico:</span> <span className="text-slate-700">{fase.objetivo_fisiologico}</span></div>
                                </div>
                                {fase.intervenciones?.length > 0 && (
                                    <div><span className="text-xs font-bold text-emerald-600">Intervenciones:</span>
                                        <ul className="mt-1 space-y-0.5">{fase.intervenciones.map((int: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500 shrink-0">•</span>{int}</li>)}</ul>
                                    </div>
                                )}
                                {fase.tips_dosificacion?.length > 0 && (
                                    <div><span className="text-xs font-bold text-blue-600">Dosificación:</span>
                                        <ul className="mt-1 space-y-0.5">{fase.tips_dosificacion.map((t: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-blue-500 shrink-0">→</span>{t}</li>)}</ul>
                                    </div>
                                )}
                                {(fase.criterios_avance || fase.criterios_regresion) && (
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {fase.criterios_avance && <div className="bg-emerald-50 rounded-lg p-2"><span className="font-bold text-emerald-700">Avance:</span><p className="text-emerald-800 mt-0.5">{fase.criterios_avance}</p></div>}
                                        {fase.criterios_regresion && <div className="bg-amber-50 rounded-lg p-2"><span className="font-bold text-amber-700">Regresión:</span><p className="text-amber-800 mt-0.5">{fase.criterios_regresion}</p></div>}
                                    </div>
                                )}
                                {fase.sesiones_tipo?.length > 0 && (
                                    <details className="text-xs">
                                        <summary className="font-bold text-slate-500 cursor-pointer hover:text-slate-700">Ver Sesiones Tipo ({fase.sesiones_tipo.length})</summary>
                                        <div className="mt-2 space-y-2">
                                            {fase.sesiones_tipo.map((s: any, si: number) => (
                                                <div key={si} className="bg-white border border-slate-100 rounded-lg p-2">
                                                    <span className="font-bold text-indigo-600">{s.titulo} ({s.duracion})</span>
                                                    <ul className="mt-1">{(s.estructura || []).map((e: string, ei: number) => <li key={ei} className="text-slate-600">→ {e}</li>)}</ul>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        </details>
                    ))}
                    {fases.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Genera con IA para ver las 4 fases de rehabilitación</p>}
                </CollapsibleSection>

                {/* G. Reglas de Reevaluación - simplified */}
                <CollapsibleSection id="G" title="Reglas de Reevaluación" icon="🔄" collapsed={isCollapsed('G')} toggle={toggle}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Signo Comparable Principal</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" value={reglasReeval.signo_comparable} onChange={e => setReglasReeval({ ...reglasReeval, signo_comparable: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Frecuencia</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" value={reglasReeval.frecuencia} onChange={e => setReglasReeval({ ...reglasReeval, frecuencia: e.target.value })} placeholder="Cada 4 sesiones..." />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Razón del Signo Comparable</label>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]" rows={2} value={reglasReeval.razon_signo} onChange={e => setReglasReeval({ ...reglasReeval, razon_signo: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Criterio de Mejora</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]" rows={2} value={reglasReeval.criterio_mejora} onChange={e => setReglasReeval({ ...reglasReeval, criterio_mejora: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Criterio de Estancamiento</label>
                            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 min-h-[60px]" rows={2} value={reglasReeval.criterio_estancamiento} onChange={e => setReglasReeval({ ...reglasReeval, criterio_estancamiento: e.target.value })} />
                        </div>
                    </div>
                    {reglasReeval.alertas_derivacion?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <label className="block text-xs font-bold text-red-600 mb-1">🚨 Alertas de Derivación</label>
                            <ul className="space-y-0.5">{reglasReeval.alertas_derivacion.map((a: string, i: number) => <li key={i} className="text-xs text-red-700">• {a}</li>)}</ul>
                        </div>
                    )}
                </CollapsibleSection>
            </div>

            {/* Publish */}
            {objetivosSmart.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                    <button onClick={onPublish} disabled={isPublishing}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isPublishing ? 'Publicando...' : publishSuccess ? '✅ Objetivos Publicados' : '🚀 Publicar Objetivos al Proceso'}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-2">Los objetivos quedarán disponibles para vincular en las evoluciones.</p>
                </div>
            )}
        </div>
    );
}
