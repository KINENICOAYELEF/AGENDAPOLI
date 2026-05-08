"use client";
import { useState, useEffect } from "react";
import { getStudentTasks, updateTaskStatus, saveEvidenceArticle, addContributionToArticle } from "@/services/evidence";
import { EvidenceTask, EvidenceArticle, ArticleCategory } from "@/types/evidence";
import { CATEGORY_CONFIGS, generateAutoTags } from "./EvidenceFormConfig";

interface Props { studentId: string; studentName: string; }

export function StudentEvidenceTasks({ studentId, studentName }: Props) {
    const [tasks, setTasks] = useState<EvidenceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTask, setSelectedTask] = useState<EvidenceTask | null>(null);
    const [category, setCategory] = useState<ArticleCategory>("Clínica");
    const [population, setPopulation] = useState("");
    const [contextField, setContextField] = useState("");
    const [studyDesign, setStudyDesign] = useState("");
    const [finding, setFinding] = useState("");
    const [methodology, setMethodology] = useState("");
    const [resumen, setResumen] = useState("");
    const [perlas, setPerlas] = useState<Record<string, string>>({});
    const [limitMetodo, setLimitMetodo] = useState("");
    const [limitTransfer, setLimitTransfer] = useState("");
    const [limitFalta, setLimitFalta] = useState("");
    // Dose fields for Entrenamiento
    const [doseIntensidad, setDoseIntensidad] = useState("");
    const [doseVolumen, setDoseVolumen] = useState("");
    const [doseFrecuencia, setDoseFrecuencia] = useState("");
    const [doseDuracion, setDoseDuracion] = useState("");
    const [doseTipoContraccion, setDoseTipoContraccion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { loadTasks(); }, [studentId]);
    const loadTasks = async () => {
        setLoading(true);
        try { setTasks(await getStudentTasks(studentId)); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const openTask = (task: EvidenceTask) => {
        setSelectedTask(task); setCategory("Clínica");
        setPopulation(""); setContextField(""); setStudyDesign("");
        setFinding(""); setMethodology(""); setResumen("");
        setPerlas({}); setLimitMetodo(""); setLimitTransfer(""); setLimitFalta("");
        setDoseIntensidad(""); setDoseVolumen(""); setDoseFrecuencia(""); setDoseDuracion(""); setDoseTipoContraccion("");
    };

    const cfg = CATEGORY_CONFIGS[category];
    const setPerlaValue = (id: string, v: string) => setPerlas(prev => ({ ...prev, [id]: v }));

    const submitAnalysis = async () => {
        if (!selectedTask) return;
        const requiredPerlas = cfg.perlas.filter(p => p.required);
        const missingPerlas = requiredPerlas.filter(p => !(perlas[p.id] || '').trim());
        if (!contextField.trim() || !finding.trim() || !resumen.trim() || !population.trim()) { alert("Completa todos los campos obligatorios (*)."); return; }
        if (missingPerlas.length > 0) { alert(`Completa las perlas obligatorias: ${missingPerlas.map(p => p.label).join(', ')}`); return; }

        setIsSubmitting(true);
        try {
            const contribId = `contrib_${Date.now()}`;
            const allLimitations = [limitMetodo ? `[METODOLOGÍA] ${limitMetodo}` : '', limitTransfer ? `[TRANSFERIBILIDAD] ${limitTransfer}` : '', limitFalta ? `[FALTA INVESTIGAR] ${limitFalta}` : ''].filter(Boolean).join('\n\n');
            const dosis = cfg.hasDoseFields ? { intensidad: doseIntensidad, volumen: doseVolumen, frecuencia: doseFrecuencia, duracion: doseDuracion, tipoContraccion: doseTipoContraccion } : undefined;

            const contribution = {
                id: contribId, studentId, studentName, resumenEstudiante: resumen, studyDesign, perlas,
                perlaClinica: Object.values(perlas).join(' | '), limitaciones: allLimitations, dosis: dosis as any,
                status: 'REVISION' as const, createdAt: Date.now(), updatedAt: Date.now()
            };

            // Remove dosis property explicitly to avoid undefined Firebase error
            if (contribution.dosis === undefined) {
                delete contribution.dosis;
            }

            // Auto-generate tags
            const autoTags = generateAutoTags({ category, cif: contextField, population, finding, methodology, summary: resumen }, studyDesign);

            let articleId = selectedTask.articleId;
            if (!articleId) {
                const newArticle: EvidenceArticle = {
                    title: selectedTask.articleTitle, url: selectedTask.articleUrl || "",
                    category, cif: contextField, population, tags: autoTags,
                    summary: resumen, finding, methodology,
                    contributions: [contribution], createdAt: Date.now(), createdBy: studentName,
                };
                articleId = await saveEvidenceArticle(newArticle);
            } else {
                await addContributionToArticle(articleId, contribution);
            }
            await updateTaskStatus(selectedTask.id!, { status: 'REVISION', articleId, contributionId: contribId });
            alert("✅ Análisis enviado correctamente. Está en revisión docente.");
            setSelectedTask(null); loadTasks();
        } catch (e: any) { alert("Error al enviar: " + e.message); }
        finally { setIsSubmitting(false); }
    };

    if (loading) return <div className="text-center py-6 text-gray-500">Cargando tus tareas...</div>;
    const pendingOrRejected = tasks.filter(t => t.status === 'PENDING' || t.status === 'REJECTED');
    if (pendingOrRejected.length === 0) return null;

    const colorMap: Record<string, string> = { emerald:'from-emerald-600 to-teal-700', blue:'from-blue-600 to-cyan-700', violet:'from-violet-600 to-purple-700', orange:'from-orange-500 to-red-600', pink:'from-pink-600 to-rose-700', slate:'from-slate-600 to-gray-700', rose:'from-rose-600 to-pink-700', cyan:'from-cyan-600 to-teal-700' };
    const totalF = 5 + cfg.perlas.filter(p => p.required).length;
    const filledF = [contextField, population, finding, resumen, limitMetodo].filter(v => v.trim()).length + cfg.perlas.filter(p => p.required && (perlas[p.id] || '').trim()).length;
    const progress = selectedTask ? Math.round((filledF / totalF) * 100) : 0;

    return (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6 shadow-lg mb-8">
            <h3 className="font-black text-orange-800 text-lg mb-4 flex items-center gap-2"><span className="text-2xl">⚠️</span> Tareas de Lectura Pendientes</h3>
            <div className="grid gap-4">
                {pendingOrRejected.map(t => {
                    const isOverdue = t.status === 'PENDING' && t.dueDate < Date.now();
                    return (
                        <div key={t.id} className={`bg-white border-2 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isOverdue ? 'border-red-400 shadow-md ring-2 ring-red-100' : 'border-orange-200'}`}>
                            <div><h4 className="font-bold text-gray-900">{t.articleTitle}</h4><div className="text-sm text-gray-500 mt-1">Vencimiento: <span className={isOverdue ? 'text-red-600 font-bold' : ''}>{new Date(t.dueDate).toLocaleString()}</span></div>
                                {t.status === 'REJECTED' && <div className="mt-2 text-xs font-bold bg-red-100 text-red-700 inline-block px-3 py-1 rounded-full">❌ Rechazado — Requiere corrección</div>}
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {t.articleUrl && <a href={t.articleUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">📄 Ver Artículo</a>}
                                <button onClick={() => openTask(t)} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-black px-5 py-2.5 rounded-xl transition-all shadow-sm">📝 Completar Análisis</button>
                            </div>
                        </div>);
                })}
            </div>

            {selectedTask && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl my-4">
                        <div className={`bg-gradient-to-r ${colorMap[cfg.color] || colorMap.slate} p-5 sticky top-0 z-10 rounded-t-2xl`}>
                            <div className="flex justify-between items-start text-white">
                                <div className="flex-1 min-w-0"><h3 className="font-black text-lg">📋 Ficha de Análisis Científico</h3><p className="text-white/70 text-sm mt-0.5 truncate">{selectedTask.articleTitle}</p></div>
                                <button onClick={() => setSelectedTask(null)} className="text-white/60 hover:text-white text-xl font-bold ml-4 shrink-0">✕</button>
                            </div>
                            <div className="mt-3 bg-white/20 rounded-full h-2.5 overflow-hidden"><div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div></div>
                            <p className="text-white/60 text-xs mt-1">{progress}% completado</p>
                        </div>

                        <div className="p-6 md:p-8 space-y-8">
                            {/* STEP 1: Category */}
                            <section>
                                <div className="flex items-center gap-2 mb-4"><span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">PASO 1</span><h4 className="font-black text-gray-800">¿De qué tipo es este artículo?</h4></div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {(Object.keys(CATEGORY_CONFIGS) as ArticleCategory[]).map(cat => {
                                        const c = CATEGORY_CONFIGS[cat]; const isActive = category === cat;
                                        return (<button key={cat} type="button" onClick={() => { setCategory(cat); setPerlas({}); }}
                                            className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-lg ring-2 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 bg-white hover:shadow-sm'}`}>
                                            <div className="text-xl mb-1">{c.icon}</div>
                                            <div className={`text-[11px] font-bold leading-tight ${isActive ? 'text-indigo-800' : 'text-gray-600'}`}>{c.label}</div>
                                        </button>);
                                    })}
                                </div>
                            </section>
                            <hr className="border-gray-100" />

                            {/* STEP 2: Classification */}
                            <section>
                                <div className="flex items-center gap-2 mb-4"><span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">PASO 2</span><h4 className="font-black text-gray-800">Clasifica el artículo</h4></div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">{cfg.contextLabel} *</label><p className="text-[11px] text-gray-400 mb-1.5">{cfg.contextHelp}</p><input value={contextField} onChange={e => setContextField(e.target.value)} placeholder={cfg.contextPlaceholder} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" /></div>
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">Población / Deporte *</label><p className="text-[11px] text-gray-400 mb-1.5">¿En quién se hizo el estudio o a quién aplica?</p><input value={population} onChange={e => setPopulation(e.target.value)} placeholder="Ej: Deportistas jóvenes, Adultos mayores, Karatekas..." className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" /></div>
                                    </div>
                                    <div><label className="block text-xs font-bold text-gray-500 mb-1">Diseño del Estudio</label><select value={studyDesign} onChange={e => setStudyDesign(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white"><option value="">— Seleccionar tipo de estudio —</option>{cfg.studyDesigns.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                                </div>
                            </section>
                            <hr className="border-gray-100" />

                            {/* STEP 3: Content Analysis */}
                            <section>
                                <div className="flex items-center gap-2 mb-4"><span className="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">PASO 3</span><h4 className="font-black text-gray-800">Analiza el contenido</h4></div>
                                <div className="space-y-5">
                                    <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{cfg.summaryPrompt} *</label>
                                        <p className="text-[11px] text-gray-400 mb-2">Escribe con tus propias palabras, no copies y pegues del artículo.</p>
                                        <textarea value={resumen} onChange={e => setResumen(e.target.value)} rows={6} placeholder={cfg.summaryPlaceholder} className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none leading-relaxed" />
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{cfg.findingLabel} *</label>
                                        <p className="text-[11px] text-gray-400 mb-2">{cfg.findingHelp}</p>
                                        <textarea value={finding} onChange={e => setFinding(e.target.value)} rows={5} placeholder={cfg.findingPlaceholder} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none leading-relaxed" />
                                    </div>

                                    {/* DOSE FIELDS for Entrenamiento */}
                                    {cfg.hasDoseFields && (
                                        <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                            <label className="block text-sm font-bold text-orange-800 mb-3">📊 Detalle de DOSIS del protocolo</label>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                <div><label className="block text-[11px] font-bold text-orange-600 mb-1">Intensidad</label><input value={doseIntensidad} onChange={e => setDoseIntensidad(e.target.value)} placeholder="Ej: 80% 1RM, RPE 8" className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                                                <div><label className="block text-[11px] font-bold text-orange-600 mb-1">Volumen (series × reps)</label><input value={doseVolumen} onChange={e => setDoseVolumen(e.target.value)} placeholder="Ej: 4×6, 3×12" className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                                                <div><label className="block text-[11px] font-bold text-orange-600 mb-1">Frecuencia</label><input value={doseFrecuencia} onChange={e => setDoseFrecuencia(e.target.value)} placeholder="Ej: 3x/semana" className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                                                <div><label className="block text-[11px] font-bold text-orange-600 mb-1">Duración programa</label><input value={doseDuracion} onChange={e => setDoseDuracion(e.target.value)} placeholder="Ej: 8 semanas" className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                                                <div><label className="block text-[11px] font-bold text-orange-600 mb-1">Tipo contracción</label><input value={doseTipoContraccion} onChange={e => setDoseTipoContraccion(e.target.value)} placeholder="Ej: Excéntrico, Isométrico" className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-orange-400 outline-none" /></div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-gray-700 mb-1">{cfg.methodLabel}</label>
                                        <p className="text-[11px] text-gray-400 mb-2">Incluye datos numéricos si los hay (%, p-value, IC, tamaño del efecto).</p>
                                        <textarea value={methodology} onChange={e => setMethodology(e.target.value)} rows={5} placeholder={cfg.methodPlaceholder} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none leading-relaxed" />
                                    </div>
                                </div>
                            </section>
                            <hr className="border-gray-100" />

                            {/* STEP 4: PERLAS */}
                            <section>
                                <div className="flex items-center gap-2 mb-4"><span className="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">PASO 4</span><h4 className="font-black text-gray-800">💎 Tus Perlas de Aplicación</h4></div>
                                <p className="text-xs text-gray-500 mb-4 -mt-2">Aquí demuestras tu razonamiento profesional. No basta con resumir: explica <strong>qué harías y por qué</strong>.</p>
                                <div className="space-y-5">
                                    {cfg.perlas.map(p => (
                                        <div key={p.id} className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2"><span className="text-xl">{p.icon}</span><span className="font-black text-emerald-800 text-sm">{p.label} {p.required && <span className="text-red-400">*</span>}</span></div>
                                            <p className="text-xs text-emerald-700 mb-3">{p.prompt}</p>
                                            <textarea value={perlas[p.id] || ''} onChange={e => setPerlaValue(p.id, e.target.value)} rows={5} placeholder={p.placeholder} className="w-full border border-emerald-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-emerald-400 outline-none bg-white/80 leading-relaxed" />
                                        </div>
                                    ))}
                                </div>
                            </section>
                            <hr className="border-gray-100" />

                            {/* STEP 5: Critical Analysis */}
                            <section>
                                <div className="flex items-center gap-2 mb-4"><span className="bg-orange-600 text-white px-2.5 py-1 rounded-lg text-xs font-black">PASO 5</span><h4 className="font-black text-gray-800">⚠️ Análisis Crítico y Limitaciones</h4></div>
                                <p className="text-xs text-gray-500 mb-4 -mt-2">No basta con decir &quot;la muestra es pequeña&quot;. Analiza <strong>por qué</strong> importa y <strong>cómo</strong> afecta tu confianza.</p>
                                <div className="space-y-4">
                                    <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-orange-800 mb-1">🔬 Limitaciones METODOLÓGICAS *</label>
                                        <p className="text-[11px] text-orange-600 mb-2">¿Hay problemas con el diseño, la muestra, las mediciones o el análisis estadístico?</p>
                                        <textarea value={limitMetodo} onChange={e => setLimitMetodo(e.target.value)} rows={4} placeholder="Ej: Muestra de 15 personas (baja potencia), no hubo grupo control, no fue ciego, usaron cuestionario auto-reportado..." className="w-full border border-orange-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-orange-400 outline-none bg-white/80 leading-relaxed" />
                                    </div>
                                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-amber-800 mb-1">🔄 TRANSFERIBILIDAD a tu contexto</label>
                                        <p className="text-[11px] text-amber-600 mb-2">¿Los resultados aplican a TU población? ¿Qué diferencias hay?</p>
                                        <textarea value={limitTransfer} onChange={e => setLimitTransfer(e.target.value)} rows={4} placeholder="Ej: El estudio fue en elite masculinos de 25 años, yo trabajo con adolescentes karatekas de 14 años..." className="w-full border border-amber-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-amber-400 outline-none bg-white/80 leading-relaxed" />
                                    </div>
                                    <div className="bg-yellow-50 border border-yellow-200 p-5 rounded-xl">
                                        <label className="block text-sm font-bold text-yellow-800 mb-1">❓ ¿Qué FALTA por investigar?</label>
                                        <p className="text-[11px] text-yellow-700 mb-2">¿Qué preguntas quedan sin responder? ¿Qué investigación futura sería necesaria?</p>
                                        <textarea value={limitFalta} onChange={e => setLimitFalta(e.target.value)} rows={3} placeholder="Ej: No evaluaron efecto a largo plazo, falta comparar con otros protocolos, no midieron adherencia..." className="w-full border border-yellow-300 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-yellow-400 outline-none bg-white/80 leading-relaxed" />
                                    </div>
                                </div>
                            </section>

                            <button onClick={submitAnalysis} disabled={isSubmitting} className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-black py-5 rounded-xl shadow-lg transition-all disabled:opacity-50 text-lg">
                                {isSubmitting ? 'Enviando...' : `Enviar Análisis para Revisión → (${progress}%)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
