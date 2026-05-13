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
}

export function ClinicalPlanningSection(props: Props) {
    const { clasificacionDolor, setClasificacionDolor, diagnosticoNarrativo, setDiagnosticoNarrativo,
        objetivoGeneral, setObjetivoGeneral, objetivosSmart, setObjetivosSmart,
        pronostico, setPronostico, fases, setFases, reglasReeval, setReglasReeval,
        collapsed, setCollapsed, onPublish, isPublishing, publishSuccess,
        razonamientoIA, anamnesisProxima, anamnesisRemota, evaluacionFisica } = props;

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
            setCollapsed({ A: false, B: false, C: false, D: false, E: false, F: false, G: false });
        } catch (err: any) { alert('Error: ' + err.message); } finally { setIsGenerating(false); }
    };

    return (
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 space-y-6">
            <div className="text-center">
                <h3 className="font-black text-slate-800 text-lg flex items-center justify-center gap-2">🧠 Síntesis, Diagnóstico y Plan Clínico</h3>
                <p className="text-xs text-slate-500 mt-1">Diagnóstico funcional en 2 párrafos, SMART ordenados jerárquicamente, fases y reevaluación</p>
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
                    <div><label className="block text-xs font-bold text-emerald-600 mb-1">✅ Fundamento</label>
                        <AutoTextarea value={clasificacionDolor.fundamento} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, fundamento: v })} minRows={3} /></div>
                    <div><label className="block text-xs font-bold text-amber-600 mb-1">🔍 Duda Clínica y Descarte</label>
                        <AutoTextarea value={clasificacionDolor.duda_y_descarte || ''} onChange={(v: string) => setClasificacionDolor({ ...clasificacionDolor, duda_y_descarte: v })} placeholder='Duda clínica: [síntoma]. Para confirmar o descartar [Condición], se debe realizar [Prueba].' minRows={3} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Confianza</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm" value={clasificacionDolor.confianza} onChange={e => setClasificacionDolor({ ...clasificacionDolor, confianza: e.target.value })}>
                            <option value="">Seleccionar...</option>{['Alta', 'Moderada', 'Baja'].map(o => <option key={o}>{o}</option>)}
                        </select></div>
                </Section>

                {/* B. Diagnóstico Kinesiológico */}
                <Section id="B" title="Diagnóstico Kinesiológico (Estructura CIF)" icon="📝" collapsed={isC('B')} toggle={toggle}>
                    <AutoTextarea value={diagnosticoNarrativo} onChange={setDiagnosticoNarrativo} placeholder="[Paciente] presenta un cuadro compatible con... A nivel estructural... Presenta DEFICIENCIAS EN... Esto provoca LIMITACIONES EN... Generando RESTRICCIONES EN... FACTORES PERSONALES/AMBIENTALES NEGATIVOS (BARRERAS)... FACTORES PERSONALES/AMBIENTALES POSITIVOS (FACILITADORES)..." minRows={8} />
                </Section>

                {/* C. Objetivo General */}
                <Section id="C" title="Objetivo General (Único y Resolutivo)" icon="🎯" collapsed={isC('C')} toggle={toggle}>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Problema Principal</label>
                        <AutoTextarea value={objetivoGeneral?.problema_principal || objetivoGeneral?.problema_principal_caso || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, problema_principal: v })} placeholder="Incapacidad funcional principal que motivó la consulta..." minRows={2} /></div>
                    <div><label className="block text-xs font-bold text-indigo-600 mb-1">Objetivo General Maestro</label>
                        <AutoTextarea value={objetivoGeneral?.objetivo_maestro || objetivoGeneral?.seleccionado || ''} onChange={(v: string) => setObjetivoGeneral({ ...objetivoGeneral, objetivo_maestro: v })} placeholder="[Verbo de resolución] la capacidad de [Actividad/Participación] aumentando la tolerancia a la carga y disminuyendo los síntomas, en un plazo de [X semanas]..." minRows={3} /></div>
                </Section>

                {/* D. Objetivos SMART */}
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
                                <AutoTextarea value={(pronostico as any)?.[k] || ''} onChange={(v: string) => setPronostico({ ...pronostico, [k]: v })} minRows={3} /></div>))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-emerald-600 mb-1">Factores a Favor</label>
                            <AutoTextarea value={(pronostico.factores_a_favor || []).join('\n')} onChange={(v: string) => setPronostico({ ...pronostico, factores_a_favor: v.split('\n').filter((l: string) => l.trim()) })} minRows={3} /></div>
                        <div><label className="block text-xs font-bold text-red-500 mb-1">Factores en Contra</label>
                            <AutoTextarea value={(pronostico.factores_en_contra || []).join('\n')} onChange={(v: string) => setPronostico({ ...pronostico, factores_en_contra: v.split('\n').filter((l: string) => l.trim()) })} minRows={3} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Historia Natural</label>
                            <AutoTextarea value={pronostico.historia_natural || ''} onChange={(v: string) => setPronostico({ ...pronostico, historia_natural: v })} minRows={2} /></div>
                        <div><label className="block text-xs font-bold text-slate-500 mb-1">Categoría</label>
                            <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100" value={pronostico.categoria || ''} onChange={e => setPronostico({ ...pronostico, categoria: e.target.value })} placeholder='Ej: Favorable, Reservado' /></div>
                    </div>
                </Section>

                {/* F. Fases de Rehabilitación */}
                <Section id="F" title={`Fases de Rehabilitación (${fases.length})`} icon="🏋️" collapsed={isC('F')} toggle={toggle}>
                    {fases.map((f: any, i: number) => (
                        <details key={i} className="bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 overflow-hidden">
                            <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-indigo-800 hover:bg-slate-100 transition-colors flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">{f.fase}</span>
                                {f.nombre} <span className="text-xs font-normal text-slate-400 ml-auto">{f.duracion_estimada}</span>
                            </summary>
                            <div className="px-4 pb-4 pt-2 space-y-2 border-t border-slate-100 text-xs">
                                {f.objetivos_operacionales?.length > 0 && <div><span className="font-bold text-purple-600">Objetivos Operacionales:</span><ul className="mt-1 space-y-0.5">{f.objetivos_operacionales.map((x: string, j: number) => <li key={j} className="text-slate-600">▸ {x}</li>)}</ul></div>}
                                {f.intervenciones?.length > 0 && <div><span className="font-bold text-emerald-600">Intervenciones:</span><ul className="mt-1 space-y-0.5">{f.intervenciones.map((x: string, j: number) => <li key={j} className="text-slate-600">• {x}</li>)}</ul></div>}
                                {f.tips_dosificacion?.length > 0 && <div><span className="font-bold text-blue-600">Tips de Dosificación / Rangos:</span><ul className="mt-1 space-y-0.5">{(Array.isArray(f.tips_dosificacion) ? f.tips_dosificacion : [f.tips_dosificacion]).map((x: string, j: number) => <li key={j} className="text-slate-600">→ {x}</li>)}</ul></div>}
                                {f.criterios_progresion?.length > 0 && <div className="bg-emerald-50 rounded-lg p-2"><span className="font-bold text-emerald-700">Criterios de Progresión:</span><ul className="mt-1 space-y-0.5">{f.criterios_progresion.map((x: string, j: number) => <li key={j} className="text-emerald-800">✓ {x}</li>)}</ul></div>}
                            </div>
                        </details>
                    ))}
                    {fases.length === 0 && <p className="text-center text-slate-400 text-sm py-4">Genera con IA para ver las fases</p>}
                </Section>

                {/* G. Reevaluación */}
                <Section id="G" title="Reevaluación y Métricas" icon="🔄" collapsed={isC('G')} toggle={toggle}>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-indigo-600 mb-1">Métrica Subjetiva</label>
                            <AutoTextarea value={reglasReeval.metrica_subjetiva || ''} onChange={(v: string) => setReglasReeval({ ...reglasReeval, metrica_subjetiva: v })} placeholder="EVA/NPRS al realizar una tarea específica, RPE percibido..." minRows={2} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-emerald-600 mb-1">Métrica Objetiva</label>
                            <AutoTextarea value={reglasReeval.metrica_objetiva || ''} onChange={(v: string) => setReglasReeval({ ...reglasReeval, metrica_objetiva: v })} placeholder="Grados en Lunge Test, asimetría de fuerza en dinamometría..." minRows={2} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-purple-600 mb-1">Métrica Funcional / Participación</label>
                            <AutoTextarea value={reglasReeval.metrica_funcional_participacion || ''} onChange={(v: string) => setReglasReeval({ ...reglasReeval, metrica_funcional_participacion: v })} placeholder="Gesto emulado, claudicación simulando ir de compras..." minRows={2} />
                        </div>
                        {reglasReeval.criterio_estancamiento !== undefined && (
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                                <label className="block text-xs font-bold text-amber-700 mb-1">⚠️ Criterio de Estancamiento / Derivación</label>
                                <AutoTextarea className="bg-transparent border-0 p-0 text-xs text-amber-900 focus:ring-0" value={reglasReeval.criterio_estancamiento || ''} onChange={(v: string) => setReglasReeval({ ...reglasReeval, criterio_estancamiento: v })} placeholder="Señal clínica o de tiempo para derivar o replantear..." minRows={2} />
                            </div>
                        )}
                    </div>
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
