import React, { useState } from "react";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

const CollapsibleSection = ({ id, title, icon, children, collapsed, toggle, color = "slate" }: {
    id: string; title: string; icon: string; children: React.ReactNode;
    collapsed: boolean; toggle: () => void; color?: string;
}) => {
    const colors: Record<string, string> = {
        indigo: "border-t-indigo-500", emerald: "border-t-emerald-500", blue: "border-t-blue-500",
        amber: "border-t-amber-500", violet: "border-t-violet-500", rose: "border-t-rose-500",
        teal: "border-t-teal-500", slate: "border-t-slate-500"
    };
    return (
        <div className={`bg-white rounded-2xl border border-slate-200 border-t-4 ${colors[color] || colors.slate} shadow-sm overflow-hidden`}>
            <button onClick={toggle} className="w-full px-5 py-3.5 flex justify-between items-center bg-slate-50/50 hover:bg-slate-100/50 transition-colors">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <span>{icon}</span> {title}
                </h4>
                <span className={`text-slate-400 transition-transform ${collapsed ? '' : 'rotate-180'}`}>▼</span>
            </button>
            {!collapsed && <div className="p-5 border-t border-slate-100">{children}</div>}
        </div>
    );
};

interface Props {
    clasificacionDolor: { categoria: string; subtipo: string; fundamento: string; confianza: string };
    setClasificacionDolor: (v: any) => void;
    diagnosticoNarrativo: string; setDiagnosticoNarrativo: (v: string) => void;
    objetivoGeneral: string; setObjetivoGeneral: (v: string) => void;
    objetivosSmart: Array<{ id: string; texto: string; plazo: string; prioridad: string; variable_base: string; basal: string; meta: string }>;
    setObjetivosSmart: (v: any) => void;
    pronostico: { corto_plazo: string; mediano_plazo: string; largo_plazo: string; factores_a_favor: string[]; factores_en_contra: string[]; historia_natural: string; comparativa_adherencia: string; categoria: string; justificacion: string };
    setPronostico: (v: any) => void;
    pilares: Array<{ titulo: string; prioridad: number; justificacion: string; objetivos_operacionales: string[]; foco_que_aborda: string[] }>;
    setPilares: (v: any) => void;
    reglasReeval: { signo_comparable: string; razon_signo: string; variables_seguimiento: string[]; frecuencia: string; criterio_mejora: string; criterio_estancamiento: string };
    setReglasReeval: (v: any) => void;
    collapsed: Record<string, boolean>;
    setCollapsed: (v: any) => void;
    onPublish: () => void; isPublishing: boolean; publishSuccess: boolean;
    razonamientoIA?: string;
    anamnesisProxima?: string; anamnesisRemota?: string; evaluacionFisica?: string;
    onAiGenerate?: (data: any) => void;
}

export function ClinicalPlanningSection(props: Props) {
    const { clasificacionDolor, setClasificacionDolor, diagnosticoNarrativo, setDiagnosticoNarrativo,
        objetivoGeneral, setObjetivoGeneral, objetivosSmart, setObjetivosSmart,
        pronostico, setPronostico, pilares, setPilares, reglasReeval, setReglasReeval,
        collapsed, setCollapsed, onPublish, isPublishing, publishSuccess,
        razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica, onAiGenerate } = props;

    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleGenerateAi = async () => {
        const context = [razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica].filter(Boolean).join('\n\n');
        if (!context.trim()) return alert('Primero genera el Razonamiento con IA en la sección de evaluación.');
        setIsAiLoading(true);
        setAiError(null);
        // Open all sections so user can see results
        setCollapsed({});
        try {
            const res = await fetch('/api/ai/express-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message || 'Error IA Plan');
            const d = json.data;
            if (d.clasificacion_dolor) setClasificacionDolor(d.clasificacion_dolor);
            if (d.diagnostico_narrativo) setDiagnosticoNarrativo(d.diagnostico_narrativo);
            if (d.objetivo_general) setObjetivoGeneral(d.objetivo_general);
            if (d.objetivos_smart?.length) setObjetivosSmart(d.objetivos_smart.map((o: any) => ({ id: generateId(), texto: o.texto || o, plazo: o.plazo || '', prioridad: o.prioridad || '', variable_base: o.variable_base || '', basal: o.basal || '', meta: o.meta || '' })));
            if (d.pronostico) setPronostico({ corto_plazo: d.pronostico.corto_plazo || '', mediano_plazo: d.pronostico.mediano_plazo || '', largo_plazo: d.pronostico.largo_plazo || '', factores_a_favor: d.pronostico.factores_a_favor || [], factores_en_contra: d.pronostico.factores_en_contra || [], historia_natural: d.pronostico.historia_natural || '', comparativa_adherencia: d.pronostico.comparativa_adherencia || '', categoria: d.pronostico.categoria || '', justificacion: d.pronostico.justificacion || '' });
            if (d.pilares?.length) setPilares(d.pilares.map((p: any) => ({ titulo: p.titulo || '', prioridad: p.prioridad || 1, justificacion: p.justificacion || '', objetivos_operacionales: p.objetivos_operacionales || [], foco_que_aborda: p.foco_que_aborda || [] })));
            if (d.reglas_reevaluacion) setReglasReeval({ signo_comparable: d.reglas_reevaluacion.signo_comparable || '', razon_signo: d.reglas_reevaluacion.razon_signo || '', variables_seguimiento: d.reglas_reevaluacion.variables_seguimiento || [], frecuencia: d.reglas_reevaluacion.frecuencia || '', criterio_mejora: d.reglas_reevaluacion.criterio_mejora || '', criterio_estancamiento: d.reglas_reevaluacion.criterio_estancamiento || '' });
            if (onAiGenerate) onAiGenerate(d);
        } catch (e: any) {
            setAiError(e.message);
        } finally {
            setIsAiLoading(false);
        }
    };

    const toggle = (k: string) => setCollapsed((p: any) => ({ ...p, [k]: !p[k] }));
    const tc = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all min-h-[50px]";
    const ic = "w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all";
    const lb = "text-[10px] font-bold uppercase tracking-wider block mb-1";

    return (
        <div className="bg-gradient-to-b from-indigo-50/30 to-emerald-50/30 rounded-3xl p-6 md:p-8 shadow-sm border border-indigo-100/60">
            <div className="text-center mb-5">
                <h3 className="font-black text-slate-800 text-lg">Síntesis, Diagnóstico y Plan Clínico</h3>
                <p className="text-xs text-slate-500 mt-1 mb-4">Completa la planificación clínica basándote en tu razonamiento. Estos campos son educativos y vinculan los objetivos con las evoluciones futuras.</p>
                <button onClick={handleGenerateAi} disabled={isAiLoading} className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:shadow-none">
                    {isAiLoading ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando Plan Clínico con IA...</>) : (<><span className="text-base">🧠</span> Generar Diagnóstico y Plan con IA</>)}
                </button>
                {aiError && <p className="text-xs text-rose-600 mt-2 font-medium">{aiError}</p>}
                {isAiLoading && <p className="text-[10px] text-slate-400 mt-2">Esto puede tomar 15-30 segundos. La IA leerá el razonamiento clínico y completará todas las secciones automáticamente.</p>}
            </div>
            <div className="flex flex-col gap-4">

                {/* A. Clasificación del Dolor */}
                <CollapsibleSection id="p3-dolor" title="A. Clasificación del Dolor" icon="🔬" collapsed={!!collapsed['dolor']} toggle={() => toggle('dolor')} color="indigo">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className={`${lb} text-indigo-600`}>Categoría Dominante</label>
                            <select className={ic + " font-bold"} value={clasificacionDolor.categoria} onChange={e => setClasificacionDolor({ ...clasificacionDolor, categoria: e.target.value })}>
                                <option value="">Selecciona...</option>
                                <option value="Nociceptivo">Nociceptivo</option>
                                <option value="Neuropático">Neuropático</option>
                                <option value="Nociplástico">Nociplástico</option>
                                <option value="Mixto">Mixto</option>
                            </select>
                        </div>
                        <div>
                            <label className={`${lb} text-indigo-600`}>Subtipo / Apellido</label>
                            <input type="text" className={ic} placeholder="Ej: Mecánico, Inflamatorio, Radicular..." value={clasificacionDolor.subtipo} onChange={e => setClasificacionDolor({ ...clasificacionDolor, subtipo: e.target.value })} />
                        </div>
                        <div className="md:col-span-2">
                            <label className={`${lb} text-slate-500`}>Fundamento Clínico</label>
                            <textarea className={tc} placeholder="Por qué se clasifica así basado en la anamnesis y hallazgos..." value={clasificacionDolor.fundamento} onChange={e => setClasificacionDolor({ ...clasificacionDolor, fundamento: e.target.value })} />
                        </div>
                        <div>
                            <label className={`${lb} text-slate-500`}>Confianza</label>
                            <select className={ic} value={clasificacionDolor.confianza} onChange={e => setClasificacionDolor({ ...clasificacionDolor, confianza: e.target.value })}>
                                <option value="">Selecciona...</option>
                                <option value="Alta">Alta</option>
                                <option value="Moderada">Moderada</option>
                                <option value="Baja">Baja</option>
                            </select>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* B. Diagnóstico Kinesiológico */}
                <CollapsibleSection id="p4-dx" title="B. Diagnóstico Kinesiológico Narrativo" icon="📋" collapsed={!!collapsed['dx']} toggle={() => toggle('dx')} color="emerald">
                    <textarea className={tc + " min-h-[100px] text-sm"} placeholder="Narrativa CIF integrada: Persona de X años presenta [deficiencias] que generan [limitaciones funcionales] y [restricciones de participación], en contexto de [factores contextuales]..." value={diagnosticoNarrativo} onChange={e => setDiagnosticoNarrativo(e.target.value)} />
                </CollapsibleSection>

                {/* C. Objetivo General */}
                <CollapsibleSection id="p4-obj" title="C. Objetivo General del Tratamiento" icon="🎯" collapsed={!!collapsed['obj']} toggle={() => toggle('obj')} color="blue">
                    <textarea className={tc + " min-h-[60px]"} placeholder="Ej: Restablecer la capacidad funcional de la persona para retornar a su actividad deportiva/laboral sin limitación significativa..." value={objetivoGeneral} onChange={e => setObjetivoGeneral(e.target.value)} />
                </CollapsibleSection>

                {/* D. Objetivos SMART */}
                <CollapsibleSection id="p4-smart" title={`D. Objetivos SMART (${objetivosSmart.length})`} icon="📐" collapsed={!!collapsed['smart']} toggle={() => toggle('smart')} color="violet">
                    <div className="space-y-3">
                        {objetivosSmart.map((obj, idx) => (
                            <div key={obj.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group">
                                <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    {idx > 0 && <button onClick={() => { const c = [...objetivosSmart]; [c[idx-1], c[idx]] = [c[idx], c[idx-1]]; setObjetivosSmart(c); }} className="text-slate-400 hover:text-indigo-600 p-1 text-xs">↑</button>}
                                    {idx < objetivosSmart.length - 1 && <button onClick={() => { const c = [...objetivosSmart]; [c[idx+1], c[idx]] = [c[idx], c[idx+1]]; setObjetivosSmart(c); }} className="text-slate-400 hover:text-indigo-600 p-1 text-xs">↓</button>}
                                    <button onClick={() => setObjetivosSmart(objetivosSmart.filter((_,i) => i !== idx))} className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold">✕</button>
                                </div>
                                <div className="pr-16 mb-2">
                                    <label className={`${lb} text-violet-600`}>Objetivo #{idx + 1}</label>
                                    <textarea className={tc + " min-h-[40px]"} value={obj.texto} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], texto: e.target.value }; setObjetivosSmart(c); }} placeholder="Descripción SMART del objetivo..." />
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    <div><label className={`${lb} text-slate-400`}>Variable Base</label><input className={ic} value={obj.variable_base} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], variable_base: e.target.value }; setObjetivosSmart(c); }} placeholder="EVA, ROM..." /></div>
                                    <div><label className={`${lb} text-slate-400`}>Basal</label><input className={ic} value={obj.basal} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], basal: e.target.value }; setObjetivosSmart(c); }} placeholder="Valor actual" /></div>
                                    <div><label className={`${lb} text-slate-400`}>Meta</label><input className={ic} value={obj.meta} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], meta: e.target.value }; setObjetivosSmart(c); }} placeholder="Valor objetivo" /></div>
                                    <div><label className={`${lb} text-slate-400`}>Plazo</label>
                                        <select className={ic} value={obj.plazo} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], plazo: e.target.value }; setObjetivosSmart(c); }}>
                                            <option value="">--</option><option value="1-2 sem">1-2 sem</option><option value="3-4 sem">3-4 sem</option><option value="5-8 sem">5-8 sem</option><option value="9-12 sem">9-12 sem</option><option value=">12 sem">&gt;12 sem</option>
                                        </select>
                                    </div>
                                    <div><label className={`${lb} text-slate-400`}>Prioridad</label>
                                        <select className={ic} value={obj.prioridad} onChange={e => { const c = [...objetivosSmart]; c[idx] = { ...c[idx], prioridad: e.target.value }; setObjetivosSmart(c); }}>
                                            <option value="">--</option><option value="Alta">Alta</option><option value="Media">Media</option><option value="Baja">Baja</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setObjetivosSmart([...objetivosSmart, { id: generateId(), texto: '', plazo: '', prioridad: '', variable_base: '', basal: '', meta: '' }])} className="w-full py-3 border-2 border-dashed border-violet-200 rounded-xl text-violet-600 font-bold text-xs hover:bg-violet-50 transition-colors">
                            + Agregar Objetivo SMART
                        </button>
                    </div>
                </CollapsibleSection>

                {/* E. Pronóstico Biopsicosocial */}
                <CollapsibleSection id="p4-prog" title="E. Pronóstico Biopsicosocial" icon="🔮" collapsed={!!collapsed['prog']} toggle={() => toggle('prog')} color="amber">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div><label className={`${lb} text-blue-600`}>Corto Plazo (0-4 sem)</label><textarea className={tc + " bg-blue-50/50 border-blue-200"} value={pronostico.corto_plazo} onChange={e => setPronostico({ ...pronostico, corto_plazo: e.target.value })} /></div>
                            <div><label className={`${lb} text-violet-600`}>Mediano Plazo (4-12 sem)</label><textarea className={tc + " bg-violet-50/50 border-violet-200"} value={pronostico.mediano_plazo} onChange={e => setPronostico({ ...pronostico, mediano_plazo: e.target.value })} /></div>
                            <div><label className={`${lb} text-indigo-600`}>Largo Plazo (&gt;12 sem)</label><textarea className={tc + " bg-indigo-50/50 border-indigo-200"} value={pronostico.largo_plazo} onChange={e => setPronostico({ ...pronostico, largo_plazo: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <label className={`${lb} text-emerald-800`}>Factores a Favor</label>
                                <textarea className="w-full bg-transparent border-none p-0 text-xs text-emerald-900 outline-none min-h-[40px] resize-none" value={pronostico.factores_a_favor.join('\n')} onChange={e => setPronostico({ ...pronostico, factores_a_favor: e.target.value.split('\n').filter(Boolean) })} placeholder="Un factor por línea..." />
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                                <label className={`${lb} text-rose-800`}>Factores en Contra</label>
                                <textarea className="w-full bg-transparent border-none p-0 text-xs text-rose-900 outline-none min-h-[40px] resize-none" value={pronostico.factores_en_contra.join('\n')} onChange={e => setPronostico({ ...pronostico, factores_en_contra: e.target.value.split('\n').filter(Boolean) })} placeholder="Un factor por línea..." />
                            </div>
                        </div>
                        <div><label className={`${lb} text-slate-500`}>Historia Natural (Sin Tratamiento)</label><textarea className={tc} value={pronostico.historia_natural} onChange={e => setPronostico({ ...pronostico, historia_natural: e.target.value })} /></div>
                        <div><label className={`${lb} text-amber-700`}>Comparativa: Alta Adherencia vs Abandono</label><textarea className={tc + " bg-amber-50/50 border-amber-200"} value={pronostico.comparativa_adherencia} onChange={e => setPronostico({ ...pronostico, comparativa_adherencia: e.target.value })} placeholder="Escenario favorable vs desfavorable..." /></div>
                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-xl p-4">
                            <h4 className="text-white font-bold text-sm mb-3">Conclusión Pronóstica</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                                <div>
                                    <label className={`${lb} text-slate-300`}>Categoría</label>
                                    <select className="w-full bg-white border border-slate-300 rounded p-2 text-sm font-bold" value={pronostico.categoria} onChange={e => setPronostico({ ...pronostico, categoria: e.target.value })}>
                                        <option value="">Selecciona...</option>
                                        <option value="favorable">Favorable</option>
                                        <option value="favorable con vigilancia">Favorable con vigilancia</option>
                                        <option value="reservado">Reservado</option>
                                        <option value="reservado dependiente">Reservado dependiente</option>
                                        <option value="desfavorable">Desfavorable</option>
                                        <option value="incierto">Incierto</option>
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className={`${lb} text-slate-300`}>Justificación Clínica</label>
                                    <textarea className="w-full bg-white border border-slate-300 rounded p-2 text-xs min-h-[60px]" value={pronostico.justificacion} onChange={e => setPronostico({ ...pronostico, justificacion: e.target.value })} />
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* F. Pilares de Intervención */}
                <CollapsibleSection id="p4-pilares" title={`F. Pilares de Intervención (${pilares.length})`} icon="🏛️" collapsed={!!collapsed['pilares']} toggle={() => toggle('pilares')} color="teal">
                    <div className="space-y-3">
                        {pilares.map((p, idx) => (
                            <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative group">
                                <div className="absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setPilares(pilares.filter((_,i) => i !== idx))} className="text-slate-400 hover:text-rose-600 p-1 text-xs font-bold">✕</button>
                                </div>
                                <div className="flex gap-2 mb-2 pr-8">
                                    <input type="number" min={1} className="w-14 bg-white border border-slate-200 rounded p-1.5 text-sm font-bold text-center" value={p.prioridad} onChange={e => { const c = [...pilares]; c[idx] = { ...c[idx], prioridad: parseInt(e.target.value) || 1 }; setPilares(c); }} title="Prioridad" />
                                    <input className={ic + " flex-1 font-bold"} value={p.titulo} onChange={e => { const c = [...pilares]; c[idx] = { ...c[idx], titulo: e.target.value }; setPilares(c); }} placeholder="Título del Pilar" />
                                </div>
                                <textarea className={tc + " mb-2"} value={p.justificacion} onChange={e => { const c = [...pilares]; c[idx] = { ...c[idx], justificacion: e.target.value }; setPilares(c); }} placeholder="Justificación..." />
                                <div className="mb-2"><label className={`${lb} text-blue-500`}>Objetivos Operacionales (por línea)</label>
                                    <textarea className={tc + " bg-blue-50/50 border-blue-100"} value={p.objetivos_operacionales.join('\n')} onChange={e => { const c = [...pilares]; c[idx] = { ...c[idx], objetivos_operacionales: e.target.value.split('\n').filter(Boolean) }; setPilares(c); }} />
                                </div>
                                <div><label className={`${lb} text-slate-400`}>Focos (separados por coma)</label>
                                    <input className={ic} value={p.foco_que_aborda.join(', ')} onChange={e => { const c = [...pilares]; c[idx] = { ...c[idx], foco_que_aborda: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }; setPilares(c); }} placeholder="kinesiofobia, fuerza..." />
                                </div>
                            </div>
                        ))}
                        <button onClick={() => setPilares([...pilares, { titulo: '', prioridad: pilares.length + 1, justificacion: '', objetivos_operacionales: [], foco_que_aborda: [] }])} className="w-full py-3 border-2 border-dashed border-teal-200 rounded-xl text-teal-600 font-bold text-xs hover:bg-teal-50 transition-colors">
                            + Agregar Pilar
                        </button>
                    </div>
                </CollapsibleSection>

                {/* G. Reglas de Reevaluación */}
                <CollapsibleSection id="p4-reeval" title="G. Reglas de Reevaluación y Seguimiento" icon="🔄" collapsed={!!collapsed['reeval']} toggle={() => toggle('reeval')} color="rose">
                    <div className="space-y-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div><label className={`${lb} text-emerald-800`}>Signo Comparable Principal</label><input className={ic + " font-bold"} value={reglasReeval.signo_comparable} onChange={e => setReglasReeval({ ...reglasReeval, signo_comparable: e.target.value })} /></div>
                                <div><label className={`${lb} text-indigo-700`}>Por Qué Este Signo</label><textarea className={tc + " bg-indigo-50 border-indigo-200 min-h-[40px]"} value={reglasReeval.razon_signo} onChange={e => setReglasReeval({ ...reglasReeval, razon_signo: e.target.value })} /></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div><label className={`${lb} text-slate-600`}>Variables de Seguimiento (por línea)</label><textarea className={tc} value={reglasReeval.variables_seguimiento.join('\n')} onChange={e => setReglasReeval({ ...reglasReeval, variables_seguimiento: e.target.value.split('\n').filter(Boolean) })} placeholder="PSFS&#10;EVA&#10;ROM&#10;Fuerza" /></div>
                            <div><label className={`${lb} text-slate-600`}>Frecuencia Sugerida</label><input className={ic} value={reglasReeval.frecuencia} onChange={e => setReglasReeval({ ...reglasReeval, frecuencia: e.target.value })} placeholder="Cada sesión / Quincenal" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                <label className={`${lb} text-emerald-800`}>Criterio de Mejora Real</label>
                                <textarea className="w-full bg-transparent border-none p-0 text-xs text-emerald-900 outline-none min-h-[40px] resize-none" value={reglasReeval.criterio_mejora} onChange={e => setReglasReeval({ ...reglasReeval, criterio_mejora: e.target.value })} placeholder="Ej: Aumento >20% en dinamometría..." />
                            </div>
                            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                                <label className={`${lb} text-rose-800`}>Criterio Estancamiento / Derivación</label>
                                <textarea className="w-full bg-transparent border-none p-0 text-xs text-rose-900 outline-none min-h-[40px] resize-none" value={reglasReeval.criterio_estancamiento} onChange={e => setReglasReeval({ ...reglasReeval, criterio_estancamiento: e.target.value })} placeholder="Ej: Sin cambio a las 4 semanas..." />
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* Publish Button */}
                {objetivosSmart.length > 0 && (
                    <div className="mt-2">
                        {publishSuccess && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-3 text-emerald-800 text-sm font-bold text-center animate-in fade-in">
                                Objetivos publicados exitosamente. Ya estarán disponibles en las Evoluciones.
                            </div>
                        )}
                        <button onClick={onPublish} disabled={isPublishing} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 px-6 rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none">
                            {isPublishing ? (
                                <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publicando...</>
                            ) : (
                                <><span className="text-xl">🚀</span> Publicar Objetivos al Proceso ({objetivosSmart.length} objetivos)</>
                            )}
                        </button>
                        <p className="text-[10px] text-slate-400 text-center mt-2">Al publicar, los objetivos estarán disponibles para seleccionar en cada evolución del paciente.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
