import React, { useState } from "react";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const CollapsibleSection = ({ id, title, icon, collapsed, toggle, children }: any) => (
    <div className="border border-slate-200 rounded-2xl overflow-hidden">
        <button onClick={() => toggle(id)} className="w-full flex justify-between items-center px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="font-bold text-slate-700 text-sm flex items-center gap-2"><span>{icon}</span>{title}</span>
            <svg className={`w-4 h-4 text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {!collapsed && <div className="p-5 space-y-4 bg-white">{children}</div>}
    </div>
);

const Input = ({ label, value, onChange, placeholder, textarea, rows }: any) => (
    <div>
        {label && <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>}
        {textarea ? (
            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" placeholder={placeholder} rows={rows || 3} value={value} onChange={e => onChange(e.target.value)} />
        ) : (
            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300" placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
        )}
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
    const isCollapsed = (id: string) => collapsed[id] !== false; // collapsed by default

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
            if (d.objetivos_smart) setObjetivosSmart(d.objetivos_smart.map((o: any) => ({ ...o, id: generateId() })));
            if (d.pronostico) setPronostico(d.pronostico);
            if (d.fases_rehabilitacion) setFases(d.fases_rehabilitacion);
            if (d.reglas_reevaluacion) setReglasReeval(d.reglas_reevaluacion);
            // Expand all sections after generation
            setCollapsed({ A: false, B: false, C: false, D: false, E: false, F: false, G: false });
        } catch (err: any) { alert('Error generando plan: ' + err.message); }
        finally { setIsGenerating(false); }
    };

    const addSmart = () => setObjetivosSmart([...objetivosSmart, { id: generateId(), texto: '', plazo: '3-4 sem', prioridad: 'Media', variable_base: '', basal: '', meta: '' }]);
    const removeSmart = (id: string) => setObjetivosSmart(objetivosSmart.filter((o: any) => o.id !== id));
    const updateSmart = (id: string, field: string, val: string) => setObjetivosSmart(objetivosSmart.map((o: any) => o.id === id ? { ...o, [field]: val } : o));

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
                        <Input label="Subtipo" value={clasificacionDolor.subtipo} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, subtipo: v })} placeholder="Mecánico, Inflamatorio..." />
                    </div>
                    <Input label="Fundamento Clínico" value={clasificacionDolor.fundamento} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, fundamento: v })} placeholder="Justificación cruzando anamnesis con evaluación..." textarea rows={3} />
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
                    <Input value={diagnosticoNarrativo} onChange={setDiagnosticoNarrativo} placeholder="Diagnóstico CIF: [nombre] presenta [deficiencias] que generan [limitaciones] y [restricciones]..." textarea rows={6} />
                </CollapsibleSection>

                {/* C. Objetivo General con 4 opciones */}
                <CollapsibleSection id="C" title="Objetivo General" icon="🎯" collapsed={isCollapsed('C')} toggle={toggle}>
                    <Input label="Problema Principal del Caso" value={objetivoGeneral?.problema_principal_caso || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, problema_principal_caso: v })} placeholder="Describe el problema central..." textarea rows={3} />
                    {objetivoGeneral?.opciones_sugeridas?.length > 0 && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Opciones Sugeridas (selecciona una)</label>
                            <div className="space-y-2">
                                {objetivoGeneral.opciones_sugeridas.map((op: string, i: number) => (
                                    <label key={i} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${objetivoGeneral.seleccionado === op ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="obj_general" checked={objetivoGeneral.seleccionado === op} onChange={() => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: op })} className="mt-0.5" />
                                        <span className="text-sm text-slate-700">{op}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {(!objetivoGeneral?.opciones_sugeridas || objetivoGeneral.opciones_sugeridas.length === 0) && (
                        <Input label="Objetivo General (texto libre)" value={objetivoGeneral?.seleccionado || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, seleccionado: v })} placeholder="Restaurar la capacidad funcional..." textarea rows={2} />
                    )}
                </CollapsibleSection>

                {/* D. Objetivos SMART */}
                <CollapsibleSection id="D" title={`Objetivos SMART (${objetivosSmart.length})`} icon="📊" collapsed={isCollapsed('D')} toggle={toggle}>
                    {objetivosSmart.map((obj: any, idx: number) => (
                        <div key={obj.id} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100 relative">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-slate-400">SMART #{idx + 1}</span>
                                <button onClick={() => removeSmart(obj.id)} className="text-xs text-red-400 hover:text-red-600 font-bold">✕ Eliminar</button>
                            </div>
                            <Input value={obj.texto} onChange={(v: string) => updateSmart(obj.id, 'texto', v)} placeholder="Reducir el dolor de..." textarea rows={2} />
                            <div className="grid grid-cols-3 gap-2">
                                <Input label="Variable" value={obj.variable_base} onChange={(v: string) => updateSmart(obj.id, 'variable_base', v)} placeholder="EVA" />
                                <Input label="Basal" value={obj.basal} onChange={(v: string) => updateSmart(obj.id, 'basal', v)} placeholder="7/10" />
                                <Input label="Meta" value={obj.meta} onChange={(v: string) => updateSmart(obj.id, 'meta', v)} placeholder="3/10" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Plazo</label>
                                    <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" value={obj.plazo} onChange={e => updateSmart(obj.id, 'plazo', e.target.value)}>
                                        {['1-2 sem', '3-4 sem', '5-8 sem', '9-12 sem', '>12 sem'].map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div><label className="block text-xs font-bold text-slate-500 mb-1">Prioridad</label>
                                    <select className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm" value={obj.prioridad} onChange={e => updateSmart(obj.id, 'prioridad', e.target.value)}>
                                        {['Alta', 'Media', 'Baja'].map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button onClick={addSmart} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold text-sm hover:bg-slate-50 transition-colors">+ Agregar Objetivo SMART</button>
                </CollapsibleSection>

                {/* E. Pronóstico */}
                <CollapsibleSection id="E" title="Pronóstico Biopsicosocial" icon="📈" collapsed={isCollapsed('E')} toggle={toggle}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input label="Corto Plazo (0-4 sem)" value={pronostico.corto_plazo} onChange={(v: string) => setPronostico({ ...pronostico, corto_plazo: v })} textarea rows={3} />
                        <Input label="Mediano Plazo (4-12 sem)" value={pronostico.mediano_plazo} onChange={(v: string) => setPronostico({ ...pronostico, mediano_plazo: v })} textarea rows={3} />
                        <Input label="Largo Plazo (>12 sem)" value={pronostico.largo_plazo} onChange={(v: string) => setPronostico({ ...pronostico, largo_plazo: v })} textarea rows={3} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Factores a Favor</label>
                            {(pronostico.factores_a_favor || []).map((f: string, i: number) => (
                                <div key={i} className="flex gap-1 mb-1"><input className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={f} onChange={e => { const arr = [...pronostico.factores_a_favor]; arr[i] = e.target.value; setPronostico({ ...pronostico, factores_a_favor: arr }); }} /><button onClick={() => setPronostico({ ...pronostico, factores_a_favor: pronostico.factores_a_favor.filter((_: any, j: number) => j !== i) })} className="text-red-400 text-xs">✕</button></div>
                            ))}
                            <button onClick={() => setPronostico({ ...pronostico, factores_a_favor: [...(pronostico.factores_a_favor || []), ''] })} className="text-xs text-indigo-500 font-bold mt-1">+ Agregar</button>
                        </div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Factores en Contra</label>
                            {(pronostico.factores_en_contra || []).map((f: string, i: number) => (
                                <div key={i} className="flex gap-1 mb-1"><input className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs" value={f} onChange={e => { const arr = [...pronostico.factores_en_contra]; arr[i] = e.target.value; setPronostico({ ...pronostico, factores_en_contra: arr }); }} /><button onClick={() => setPronostico({ ...pronostico, factores_en_contra: pronostico.factores_en_contra.filter((_: any, j: number) => j !== i) })} className="text-red-400 text-xs">✕</button></div>
                            ))}
                            <button onClick={() => setPronostico({ ...pronostico, factores_en_contra: [...(pronostico.factores_en_contra || []), ''] })} className="text-xs text-indigo-500 font-bold mt-1">+ Agregar</button>
                        </div>
                    </div>
                    <Input label="Historia Natural (sin tratamiento)" value={pronostico.historia_natural} onChange={(v: string) => setPronostico({ ...pronostico, historia_natural: v })} textarea rows={3} />
                    <Input label="Comparativa Adherencia" value={pronostico.comparativa_adherencia} onChange={(v: string) => setPronostico({ ...pronostico, comparativa_adherencia: v })} textarea rows={3} />
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={pronostico.categoria} onChange={e => setPronostico({ ...pronostico, categoria: e.target.value })}>
                                <option value="">Seleccionar...</option>
                                {['favorable', 'favorable con vigilancia', 'reservado', 'reservado dependiente', 'desfavorable', 'incierto'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                    <Input label="Justificación Integral" value={pronostico.justificacion} onChange={(v: string) => setPronostico({ ...pronostico, justificacion: v })} textarea rows={4} />
                </CollapsibleSection>

                {/* F. Fases de Rehabilitación */}
                <CollapsibleSection id="F" title={`Fases de Rehabilitación (${fases.length})`} icon="🏋️" collapsed={isCollapsed('F')} toggle={toggle}>
                    {fases.map((fase: any, idx: number) => (
                        <div key={idx} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 border border-slate-200 space-y-3">
                            <h4 className="font-black text-indigo-800 text-sm">{fase.nombre || `Fase ${fase.fase}`}</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div><span className="font-bold text-slate-500">Foco:</span> <span className="text-slate-700">{fase.foco_principal}</span></div>
                                <div><span className="font-bold text-slate-500">Duración:</span> <span className="text-slate-700">{fase.duracion_estimada}</span></div>
                            </div>
                            <div><span className="text-xs font-bold text-slate-500">Objetivo Fisiológico:</span><p className="text-xs text-slate-600 mt-0.5">{fase.objetivo_fisiologico}</p></div>
                            {fase.intervenciones?.length > 0 && (
                                <div><span className="text-xs font-bold text-slate-500">Intervenciones:</span>
                                    <ul className="mt-1 space-y-0.5">{fase.intervenciones.map((int: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-emerald-500">•</span>{int}</li>)}</ul>
                                </div>
                            )}
                            {fase.tips_dosificacion?.length > 0 && (
                                <div><span className="text-xs font-bold text-slate-500">Dosificación:</span>
                                    <ul className="mt-1 space-y-0.5">{fase.tips_dosificacion.map((t: string, i: number) => <li key={i} className="text-xs text-slate-600 flex gap-1.5"><span className="text-blue-500">💊</span>{t}</li>)}</ul>
                                </div>
                            )}
                            {fase.criterios_avance && <div><span className="text-xs font-bold text-emerald-600">Criterios de Avance:</span><p className="text-xs text-slate-600 mt-0.5">{fase.criterios_avance}</p></div>}
                            {fase.criterios_regresion && <div><span className="text-xs font-bold text-amber-600">Criterios de Regresión:</span><p className="text-xs text-slate-600 mt-0.5">{fase.criterios_regresion}</p></div>}
                            {fase.errores_frecuentes?.length > 0 && (
                                <div><span className="text-xs font-bold text-red-500">Errores Frecuentes:</span>
                                    <ul className="mt-1">{fase.errores_frecuentes.map((e: string, i: number) => <li key={i} className="text-xs text-slate-600">⚠️ {e}</li>)}</ul>
                                </div>
                            )}
                            {fase.perla_docente && <div className="bg-amber-50 border border-amber-200 rounded-lg p-2"><span className="text-xs font-bold text-amber-700">💡 Perla Docente:</span><p className="text-xs text-amber-800 mt-0.5">{fase.perla_docente}</p></div>}
                            {fase.sesiones_tipo?.length > 0 && (
                                <div><span className="text-xs font-bold text-slate-500">Sesiones Tipo:</span>
                                    {fase.sesiones_tipo.map((s: any, si: number) => (
                                        <div key={si} className="mt-1 bg-white border border-slate-100 rounded-lg p-2">
                                            <span className="text-xs font-bold text-indigo-600">{s.titulo} ({s.duracion})</span>
                                            <ul className="mt-1">{(s.estructura || []).map((e: string, ei: number) => <li key={ei} className="text-xs text-slate-600">→ {e}</li>)}</ul>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                    {fases.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Genera con IA para ver las 4 fases de rehabilitación</p>}
                </CollapsibleSection>

                {/* G. Reglas de Reevaluación */}
                <CollapsibleSection id="G" title="Reglas de Reevaluación" icon="🔄" collapsed={isCollapsed('G')} toggle={toggle}>
                    <Input label="Signo Comparable Principal" value={reglasReeval.signo_comparable} onChange={(v: string) => setReglasReeval({ ...reglasReeval, signo_comparable: v })} />
                    <Input label="Razón del Signo Comparable" value={reglasReeval.razon_signo} onChange={(v: string) => setReglasReeval({ ...reglasReeval, razon_signo: v })} textarea rows={2} />
                    {reglasReeval.signos_comparables?.length > 0 && (
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Signos Comparables</label>
                            {reglasReeval.signos_comparables.map((sc: any, i: number) => (
                                <div key={i} className="bg-slate-50 rounded-lg p-2 mb-1 text-xs"><span className="font-bold text-indigo-600">{sc.evaluacion}</span> <span className="text-slate-400">({sc.tipo})</span><p className="text-slate-600 mt-0.5">{sc.justificacion}</p></div>
                            ))}
                        </div>
                    )}
                    <Input label="Frecuencia de Reevaluación" value={reglasReeval.frecuencia} onChange={(v: string) => setReglasReeval({ ...reglasReeval, frecuencia: v })} />
                    <Input label="Criterio de Mejora Real" value={reglasReeval.criterio_mejora} onChange={(v: string) => setReglasReeval({ ...reglasReeval, criterio_mejora: v })} textarea rows={2} />
                    <Input label="Criterio de Estancamiento / Derivación" value={reglasReeval.criterio_estancamiento} onChange={(v: string) => setReglasReeval({ ...reglasReeval, criterio_estancamiento: v })} textarea rows={2} />
                    {reglasReeval.alertas_derivacion?.length > 0 && (
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Alertas de Derivación</label>
                            <ul>{reglasReeval.alertas_derivacion.map((a: string, i: number) => <li key={i} className="text-xs text-red-600 flex gap-1">🚨 {a}</li>)}</ul>
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
