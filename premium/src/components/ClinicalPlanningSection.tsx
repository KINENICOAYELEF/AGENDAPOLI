import React, { useState, useRef, useEffect, useCallback } from "react";

const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const AutoTextarea = ({ value, onChange, placeholder, className, minRows = 3 }: any) => {
    const ref = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { if (ref.current) { ref.current.style.height = 'auto'; ref.current.style.height = Math.max(ref.current.scrollHeight, minRows * 24) + 'px'; } }, [value, minRows]);
    return <textarea ref={ref} className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 leading-relaxed overflow-hidden ${className || ''}`} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />;
};

const Section = ({ id, title, icon, collapsed, toggle, children }: any) => (
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
    herramientas?: any[]; setHerramientas?: (v: any) => void;
}

export function ClinicalPlanningSection(props: Props) {
    const { clasificacionDolor, setClasificacionDolor, diagnosticoNarrativo, setDiagnosticoNarrativo,
        objetivoGeneral, setObjetivoGeneral, objetivosSmart, setObjetivosSmart,
        pronostico, setPronostico, fases, setFases, reglasReeval, setReglasReeval,
        collapsed, setCollapsed, onPublish, isPublishing, publishSuccess,
        razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica,
        herramientas = [], setHerramientas } = props;

    const [isGenerating, setIsGenerating] = useState(false);
    const toggle = useCallback((id: string) => setCollapsed((prev: any) => ({ ...prev, [id]: !prev[id] })), [setCollapsed]);
    const isC = (id: string) => collapsed[id] !== false;

    const updateSmart = (id: string, val: string) => setObjetivosSmart(objetivosSmart.map((o: any) => o.id === id ? { ...o, texto: val } : o));
    const removeSmart = (id: string) => setObjetivosSmart(objetivosSmart.filter((o: any) => o.id !== id));
    const addSmart = () => setObjetivosSmart([...objetivosSmart, { id: genId(), texto: '' }]);

    const handleGenerateAi = async () => {
        if (!razonamientoIA && !anamnesisProxima && !evaluacionFisica) return alert("Primero genera el razonamiento con IA.");
        setIsGenerating(true);
        try {
            const res = await fetch('/api/ai/express-plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica }) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Error');
            const d = json.data;
            if (d.clasificacion_dolor) setClasificacionDolor(d.clasificacion_dolor);
            if (d.diagnostico_narrativo) setDiagnosticoNarrativo(d.diagnostico_narrativo);
            if (d.objetivo_general) setObjetivoGeneral(d.objetivo_general);
            if (d.objetivos_smart) setObjetivosSmart(d.objetivos_smart.map((o: any) => ({ ...o, id: genId() })));
            if (d.pronostico) setPronostico(d.pronostico);
            if (d.fases_rehabilitacion) setFases(d.fases_rehabilitacion);
            if (d.reglas_reevaluacion) setReglasReeval(d.reglas_reevaluacion);
            if (d.herramientas_complementarias && setHerramientas) setHerramientas(d.herramientas_complementarias);
            setCollapsed({ A: false, B: false, C: false, D: false, E: false, F: false, G: false, H: false });
        } catch (err: any) { alert('Error: ' + err.message); } finally { setIsGenerating(false); }
    };

    const catIcon: Record<string, string> = { 'Terapia Manual': '🤲', 'Tejido Blando': '💆', 'Agente Físico': '❄️', 'Educación': '📚' };

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 space-y-6">
            <div className="text-center">
                <h3 className="font-black text-slate-800 text-lg flex items-center justify-center gap-2">🧠 Síntesis, Diagnóstico y Plan Clínico</h3>
                <p className="text-xs text-slate-500 mt-1">Clasificación CIF, objetivos SMART, fases de rehabilitación y reevaluación</p>
            </div>
            <button onClick={handleGenerateAi} disabled={isGenerating || (!razonamientoIA && !anamnesisProxima)} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isGenerating ? (<><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando Plan Clínico...</>) : (<><span className="text-xl">🧠</span> Generar Diagnóstico y Plan con IA</>)}
            </button>

            <div className="space-y-3">
                {/* A. Clasificación del Dolor */}
                <Section id="A" title="Clasificación del Dolor" icon="🎯" collapsed={isC('A')} toggle={toggle}>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={clasificacionDolor.categoria} onChange={e => setClasificacionDolor({ ...clasificacionDolor, categoria: e.target.value })}>
                                <option value="">Seleccionar...</option>{['Nociceptivo', 'Neuropático', 'Nociplástico', 'Mixto'].map(o => <option key={o}>{o}</option>)}
                            </select></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Subtipo</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" value={clasificacionDolor.subtipo} onChange={e => setClasificacionDolor({ ...clasificacionDolor, subtipo: e.target.value })} /></div>
                    </div>
                    <div><label className="block text-xs font-bold text-emerald-600 mb-1">✅ Hallazgos que apoyan esta clasificación</label>
                        <AutoTextarea value={clasificacionDolor.fundamento} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, fundamento: v })} minRows={4} /></div>
                    <div><label className="block text-xs font-bold text-amber-600 mb-1">⚠️ Datos que generan duda o sugieren mezcla</label>
                        <AutoTextarea value={clasificacionDolor.duda_mezcla || ''} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, duda_mezcla: v })} minRows={3} /></div>
                    <div><label className="block text-xs font-bold text-blue-600 mb-1">🔍 Diagnóstico Diferencial — Pruebas sugeridas para descartar</label>
                        <AutoTextarea value={clasificacionDolor.sugerencia_diferencial || ''} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, sugerencia_diferencial: v })} minRows={3} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Confianza</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={clasificacionDolor.confianza} onChange={e => setClasificacionDolor({ ...clasificacionDolor, confianza: e.target.value })}>
                            <option value="">Seleccionar...</option>{['Alta', 'Moderada', 'Baja'].map(o => <option key={o}>{o}</option>)}
                        </select></div>
                </Section>

                {/* B. Diagnóstico */}
                <Section id="B" title="Diagnóstico Kinesiológico" icon="📝" collapsed={isC('B')} toggle={toggle}>
                    <AutoTextarea value={diagnosticoNarrativo} onChange={setDiagnosticoNarrativo} placeholder="■ PRESENTACIÓN CLÍNICA: ...\n■ DEFICIENCIAS ESTRUCTURALES: ...\n■ DEFICIENCIAS FUNCIONALES: ...\n■ LIMITACIONES EN LA ACTIVIDAD: ...\n■ RESTRICCIONES EN LA PARTICIPACIÓN: ...\n■ FACTORES CONTEXTUALES: ..." minRows={10} />
                </Section>

                {/* C. Objetivo General */}
                <Section id="C" title="Objetivo General" icon="🎯" collapsed={isC('C')} toggle={toggle}>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Problema Principal del Caso</label>
                        <AutoTextarea value={objetivoGeneral?.problema_principal_caso || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, problema_principal_caso: v })} minRows={2} /></div>
                    {objetivoGeneral?.opciones_sugeridas?.length > 0 && (<div>
                        <label className="block text-xs font-bold text-slate-500 mb-2">Opciones Sugeridas (selecciona una para editar abajo)</label>
                        <div className="space-y-2">{objetivoGeneral.opciones_sugeridas.map((op: string, i: number) => (
                            <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${objetivoGeneral.seleccionado === op ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 hover:bg-slate-50'}`}>
                                <input type="radio" name="obj_gen" checked={objetivoGeneral.seleccionado === op} onChange={() => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: op })} className="mt-1 accent-indigo-600" />
                                <span className="text-sm text-slate-700 leading-relaxed">{op}</span>
                            </label>))}</div></div>)}
                    <div><label className="block text-xs font-bold text-indigo-600 mb-1">Objetivo General Definitivo (editable)</label>
                        <AutoTextarea value={objetivoGeneral?.seleccionado || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: v })} placeholder="Escribe o edita el objetivo general definitivo..." minRows={3} /></div>
                </Section>

                {/* D. Objetivos SMART — textarea only */}
                <Section id="D" title={`Objetivos Específicos SMART (${objetivosSmart.length})`} icon="📊" collapsed={isC('D')} toggle={toggle}>
                    <div className="space-y-3">
                        {objetivosSmart.map((obj: any, idx: number) => (
                            <div key={obj.id} className="relative bg-slate-50 rounded-xl p-4 border border-slate-200 group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">{idx + 1}</span>
                                    <button onClick={() => removeSmart(obj.id)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-red-100 hover:bg-red-200 text-red-500 flex items-center justify-center text-xs transition-opacity" title="Quitar">✕</button>
                                </div>
                                <AutoTextarea value={obj.texto} onChange={(v: string) => updateSmart(obj.id, v)} minRows={2} />
                            </div>
                        ))}
                    </div>
                    <button onClick={addSmart} className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 font-bold text-sm hover:bg-indigo-50 transition-colors">+ Agregar Objetivo</button>
                </Section>

                {/* E. Pronóstico */}
                <Section id="E" title="Pronóstico Biopsicosocial" icon="📈" collapsed={isC('E')} toggle={toggle}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[{ k: 'corto_plazo', l: 'Corto (0-4 sem)' }, { k: 'mediano_plazo', l: 'Mediano (4-12 sem)' }, { k: 'largo_plazo', l: 'Largo (>12 sem)' }].map(({ k, l }) => (
                            <div key={k}><label className="block text-xs font-bold text-slate-500 mb-1">{l}</label>
                                <AutoTextarea value={(pronostico as any)[k]} onChange={(v: string) => setPronostico({ ...pronostico, [k]: v })} minRows={4} /></div>))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-emerald-600 mb-1">Factores a Favor</label>
                            <AutoTextarea value={(pronostico.factores_a_favor || []).join('\n')} onChange={(v: string) => setPronostico({ ...pronostico, factores_a_favor: v.split('\n').filter((l: string) => l.trim()) })} minRows={3} /></div>
                        <div><label className="block text-xs font-bold text-red-500 mb-1">Factores en Contra</label>
                            <AutoTextarea value={(pronostico.factores_en_contra || []).join('\n')} onChange={(v: string) => setPronostico({ ...pronostico, factores_en_contra: v.split('\n').filter((l: string) => l.trim()) })} minRows={3} /></div>
                    </div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Historia Natural (sin tratamiento)</label>
                        <AutoTextarea value={pronostico.historia_natural} onChange={(v: string) => setPronostico({ ...pronostico, historia_natural: v })} minRows={3} /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={pronostico.categoria} onChange={e => setPronostico({ ...pronostico, categoria: e.target.value })}>
                                <option value="">Seleccionar...</option>{['favorable', 'favorable con vigilancia', 'reservado', 'reservado dependiente', 'desfavorable', 'incierto'].map(c => <option key={c}>{c}</option>)}
                            </select></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Justificación</label>
                            <AutoTextarea value={pronostico.justificacion} onChange={(v: string) => setPronostico({ ...pronostico, justificacion: v })} minRows={3} /></div>
                    </div>
                </Section>

                {/* F. Fases */}
                <Section id="F" title={`Fases de Rehabilitación (${fases.length})`} icon="🏋️" collapsed={isC('F')} toggle={toggle}>
                    {fases.map((f: any, i: number) => (
                        <details key={i} className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 overflow-hidden">
                            <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-indigo-800 hover:bg-slate-100 transition-colors flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">{f.fase}</span>
                                {f.nombre} <span className="text-xs font-normal text-slate-400 ml-auto">{f.duracion_estimada}</span>
                            </summary>
                            <div className="px-4 pb-4 pt-2 space-y-2 border-t border-slate-100 text-xs">
                                <p><span className="font-bold text-slate-500">Foco:</span> {f.foco_principal}</p>
                                <p><span className="font-bold text-slate-500">Obj. Fisiológico:</span> {f.objetivo_fisiologico}</p>
                                {f.objetivos_operacionales?.length > 0 && <div><span className="font-bold text-purple-600">Objetivos Operacionales:</span><ul className="mt-1 space-y-0.5">{f.objetivos_operacionales.map((x: string, j: number) => <li key={j} className="text-slate-600">▸ {x}</li>)}</ul></div>}
                                {f.intervenciones?.length > 0 && <div><span className="font-bold text-emerald-600">Intervenciones:</span><ul className="mt-1 space-y-0.5">{f.intervenciones.map((x: string, j: number) => <li key={j} className="text-slate-600">• {x}</li>)}</ul></div>}
                                {f.tips_dosificacion?.length > 0 && <div><span className="font-bold text-blue-600">Dosificación:</span><ul className="mt-1 space-y-0.5">{f.tips_dosificacion.map((x: string, j: number) => <li key={j} className="text-slate-600">→ {x}</li>)}</ul></div>}
                                {(f.criterios_avance || f.criterios_regresion) && <div className="grid grid-cols-2 gap-2">
                                    {f.criterios_avance && <div className="bg-emerald-50 rounded-lg p-2"><span className="font-bold text-emerald-700">Avance:</span><p className="text-emerald-800 mt-0.5">{f.criterios_avance}</p></div>}
                                    {f.criterios_regresion && <div className="bg-amber-50 rounded-lg p-2"><span className="font-bold text-amber-700">Regresión:</span><p className="text-amber-800 mt-0.5">{f.criterios_regresion}</p></div>}
                                </div>}
                                {f.sesiones_tipo?.length > 0 && <details><summary className="font-bold text-slate-500 cursor-pointer hover:text-slate-700 mt-1">Ver Sesiones Tipo</summary>
                                    <div className="mt-1 space-y-1">{f.sesiones_tipo.map((s: any, si: number) => <div key={si} className="bg-white border border-slate-100 rounded-lg p-2"><span className="font-bold text-indigo-600">{s.titulo} ({s.duracion})</span><ul className="mt-1">{(s.estructura||[]).map((e: string, ei: number) => <li key={ei} className="text-slate-600">→ {e}</li>)}</ul></div>)}</div></details>}
                            </div>
                        </details>
                    ))}
                    {fases.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Genera con IA para ver las fases</p>}
                </Section>

                {/* G. Herramientas Complementarias */}
                <Section id="G" title={`Herramientas Complementarias (${herramientas.length})`} icon="🧰" collapsed={isC('G')} toggle={toggle}>
                    {herramientas.length > 0 ? (
                        <div className="space-y-3">{herramientas.map((h: any, i: number) => (
                            <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-lg">{catIcon[h.categoria] || '🔧'}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase">{h.categoria}</span>
                                </div>
                                <p className="font-bold text-sm text-slate-800">{h.herramienta}</p>
                                <p className="text-xs text-slate-600 mt-1">{h.justificacion}</p>
                                <p className="text-xs text-indigo-700 mt-1 font-medium">Aplicación: {h.aplicacion}</p>
                                {h.nota_evidencia && <p className="text-xs text-slate-400 mt-1 italic">{h.nota_evidencia}</p>}
                            </div>
                        ))}</div>
                    ) : <p className="text-center text-slate-400 text-sm py-4">Genera con IA para ver herramientas</p>}
                </Section>

                {/* H. Reevaluación */}
                <Section id="H" title="Reevaluación" icon="🔄" collapsed={isC('H')} toggle={toggle}>
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-1">
                        <p className="text-sm"><span className="font-bold text-indigo-700">Signo Comparable:</span> <span className="text-indigo-900">{reglasReeval.signo_comparable || '—'}</span></p>
                        <p className="text-xs text-indigo-700">{reglasReeval.razon_signo}</p>
                        <p className="text-sm mt-1"><span className="font-bold text-indigo-700">Frecuencia:</span> <span className="text-indigo-900">{reglasReeval.frecuencia || '—'}</span></p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <label className="block text-xs font-bold text-emerald-700 mb-1">✅ Criterio de Mejora</label>
                            <p className="text-xs text-emerald-800">{reglasReeval.criterio_mejora || '—'}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <label className="block text-xs font-bold text-amber-700 mb-1">⚠️ Estancamiento / Derivación</label>
                            <p className="text-xs text-amber-800">{reglasReeval.criterio_estancamiento || '—'}</p>
                        </div>
                    </div>
                    {reglasReeval.alertas_derivacion?.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                            <label className="block text-xs font-bold text-red-600 mb-1">🚨 Alertas de Derivación</label>
                            <ul className="space-y-0.5">{reglasReeval.alertas_derivacion.map((a: string, i: number) => <li key={i} className="text-xs text-red-700">• {a}</li>)}</ul>
                        </div>
                    )}
                </Section>
            </div>

            {objetivosSmart.length > 0 && (
                <div className="pt-4 border-t border-slate-200">
                    <button onClick={onPublish} disabled={isPublishing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3.5 px-6 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {isPublishing ? 'Publicando...' : publishSuccess ? '✅ Objetivos Publicados' : '🚀 Publicar Objetivos al Proceso'}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-2">Los objetivos quedarán disponibles para vincular en las evoluciones.</p>
                </div>
            )}
        </div>
    );
}
