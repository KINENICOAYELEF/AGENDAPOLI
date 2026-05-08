"use client";

import { useState, useEffect } from "react";
import { getStudentTasks, updateTaskStatus, saveEvidenceArticle, addContributionToArticle } from "@/services/evidence";
import { EvidenceTask, EvidenceArticle, ArticleCategory } from "@/types/evidence";
import { CATEGORY_CONFIGS } from "./EvidenceFormConfig";

interface Props {
    studentId: string;
    studentName: string;
}

export function StudentEvidenceTasks({ studentId, studentName }: Props) {
    const [tasks, setTasks] = useState<EvidenceTask[]>([]);
    const [loading, setLoading] = useState(true);

    // Form Modal
    const [selectedTask, setSelectedTask] = useState<EvidenceTask | null>(null);
    const [category, setCategory] = useState<ArticleCategory>("Clínica");
    const [population, setPopulation] = useState("");
    const [contextField, setContextField] = useState("");
    const [studyDesign, setStudyDesign] = useState("");
    const [finding, setFinding] = useState("");
    const [methodology, setMethodology] = useState("");
    const [resumen, setResumen] = useState("");
    const [perlas, setPerlas] = useState<Record<string, string>>({});
    const [limitaciones, setLimitaciones] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { loadTasks(); }, [studentId]);

    const loadTasks = async () => {
        setLoading(true);
        try { setTasks(await getStudentTasks(studentId)); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const openTask = (task: EvidenceTask) => {
        setSelectedTask(task);
        setCategory("Clínica");
        setPopulation(""); setContextField(""); setStudyDesign("");
        setFinding(""); setMethodology(""); setResumen("");
        setPerlas({}); setLimitaciones("");
    };

    const cfg = CATEGORY_CONFIGS[category];

    const setPerlaValue = (perlaId: string, value: string) => {
        setPerlas(prev => ({ ...prev, [perlaId]: value }));
    };

    const submitAnalysis = async () => {
        if (!selectedTask) return;
        
        // Validate required fields
        const requiredPerlas = cfg.perlas.filter(p => p.required);
        const missingPerlas = requiredPerlas.filter(p => !(perlas[p.id] || '').trim());
        
        if (!contextField.trim() || !finding.trim() || !resumen.trim() || !population.trim()) {
            alert("Por favor completa todos los campos obligatorios (marcados con *).");
            return;
        }
        if (missingPerlas.length > 0) {
            alert(`Completa las perlas obligatorias: ${missingPerlas.map(p => p.label).join(', ')}`);
            return;
        }

        setIsSubmitting(true);
        try {
            const contribId = `contrib_${Date.now()}`;
            const contribution = {
                id: contribId, studentId, studentName,
                resumenEstudiante: resumen,
                studyDesign,
                perlas,
                perlaClinica: Object.values(perlas).join(' | '), // backward compat
                limitaciones,
                status: 'REVISION' as const,
                createdAt: Date.now(), updatedAt: Date.now()
            };

            let articleId = selectedTask.articleId;

            if (!articleId) {
                const newArticle: EvidenceArticle = {
                    title: selectedTask.articleTitle,
                    url: selectedTask.articleUrl,
                    category, cif: contextField, population, tags: [],
                    summary: resumen,
                    finding, methodology,
                    contributions: [contribution],
                    createdAt: Date.now(), createdBy: studentName,
                };
                articleId = await saveEvidenceArticle(newArticle);
            } else {
                await addContributionToArticle(articleId, contribution);
            }

            await updateTaskStatus(selectedTask.id!, { status: 'REVISION', articleId, contributionId: contribId });
            alert("✅ Análisis enviado correctamente. Está en revisión docente.");
            setSelectedTask(null);
            loadTasks();
        } catch (e: any) {
            alert("Error al enviar: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-6 text-gray-500">Cargando tus tareas...</div>;

    const pendingOrRejected = tasks.filter(t => t.status === 'PENDING' || t.status === 'REJECTED');
    if (pendingOrRejected.length === 0) return null;

    const colorMap: Record<string, string> = {
        emerald: 'from-emerald-600 to-teal-700', blue: 'from-blue-600 to-cyan-700',
        violet: 'from-violet-600 to-purple-700', orange: 'from-orange-500 to-red-600',
        pink: 'from-pink-600 to-rose-700', slate: 'from-slate-600 to-gray-700'
    };

    // Count filled fields for progress
    const totalSteps = 5 + cfg.perlas.filter(p => p.required).length;
    const filledSteps = [contextField, population, finding, resumen, limitaciones]
        .filter(v => v.trim()).length
        + cfg.perlas.filter(p => p.required && (perlas[p.id] || '').trim()).length;
    const progress = selectedTask ? Math.round((filledSteps / totalSteps) * 100) : 0;

    return (
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6 shadow-lg mb-8">
            <h3 className="font-black text-orange-800 text-lg mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Tareas de Lectura Pendientes
            </h3>
            <div className="grid gap-4">
                {pendingOrRejected.map(t => {
                    const isOverdue = t.status === 'PENDING' && t.dueDate < Date.now();
                    return (
                        <div key={t.id} className={`bg-white border-2 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isOverdue ? 'border-red-400 shadow-md ring-2 ring-red-100' : 'border-orange-200'}`}>
                            <div>
                                <h4 className="font-bold text-gray-900">{t.articleTitle}</h4>
                                <div className="text-sm text-gray-500 mt-1">
                                    Vencimiento: <span className={isOverdue ? 'text-red-600 font-bold' : ''}>{new Date(t.dueDate).toLocaleString()}</span>
                                </div>
                                {t.status === 'REJECTED' && (
                                    <div className="mt-2 text-xs font-bold bg-red-100 text-red-700 inline-block px-3 py-1 rounded-full">❌ Rechazado — Requiere corrección</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {t.articleUrl && (
                                    <a href={t.articleUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-xl transition-colors">📄 Ver Artículo</a>
                                )}
                                <button onClick={() => openTask(t)} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-black px-5 py-2.5 rounded-xl transition-all shadow-sm">
                                    📝 Completar Análisis
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ─── ADAPTIVE ANALYSIS FORM MODAL ─── */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className={`bg-gradient-to-r ${colorMap[cfg.color] || colorMap.slate} p-5 sticky top-0 z-10`}>
                            <div className="flex justify-between items-start text-white">
                                <div className="flex-1">
                                    <h3 className="font-black text-lg">📋 Ficha de Análisis Científico</h3>
                                    <p className="text-white/70 text-sm mt-0.5">{selectedTask.articleTitle}</p>
                                </div>
                                <button onClick={() => setSelectedTask(null)} className="text-white/60 hover:text-white text-lg font-bold ml-4">✕</button>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
                                <div className="bg-white h-full rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-white/60 text-xs mt-1">{progress}% completado</p>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* ──── STEP 1: Category ──── */}
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-2">
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-xs mr-2">PASO 1</span>
                                    ¿De qué tipo es este artículo?
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(Object.keys(CATEGORY_CONFIGS) as ArticleCategory[]).map(cat => {
                                        const c = CATEGORY_CONFIGS[cat];
                                        const isActive = category === cat;
                                        return (
                                            <button key={cat} type="button" onClick={() => { setCategory(cat); setPerlas({}); }}
                                                className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <div className="text-xl">{c.icon}</div>
                                                <div className={`text-xs font-bold mt-1 ${isActive ? 'text-indigo-800' : 'text-gray-600'}`}>{c.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* ──── STEP 2: Classification ──── */}
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-3">
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-xs mr-2">PASO 2</span>
                                    Clasifica el artículo
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{cfg.contextLabel} *</label>
                                        <p className="text-[10px] text-gray-400 mb-1">{cfg.contextHelp}</p>
                                        <input value={contextField} onChange={e => setContextField(e.target.value)} placeholder={cfg.contextPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Población / Deporte *</label>
                                        <p className="text-[10px] text-gray-400 mb-1">¿En quién se hizo el estudio?</p>
                                        <input value={population} onChange={e => setPopulation(e.target.value)} placeholder="Ej: Deportistas jóvenes, Adultos mayores..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Diseño del Estudio</label>
                                        <p className="text-[10px] text-gray-400 mb-1">¿Qué tipo de estudio es?</p>
                                        <select value={studyDesign} onChange={e => setStudyDesign(e.target.value)} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none bg-white">
                                            <option value="">— Seleccionar —</option>
                                            {cfg.studyDesigns.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ──── STEP 3: Content Analysis ──── */}
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-3">
                                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-xs mr-2">PASO 3</span>
                                    Analiza el contenido
                                </label>
                                <div className="space-y-4">
                                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                                        <label className="block text-xs font-bold text-slate-600 mb-1">{cfg.summaryPrompt} *</label>
                                        <textarea value={resumen} onChange={e => setResumen(e.target.value)} rows={4} placeholder={cfg.summaryPlaceholder} className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">{cfg.findingLabel} *</label>
                                            <p className="text-[10px] text-gray-400 mb-2">{cfg.findingHelp}</p>
                                            <textarea value={finding} onChange={e => setFinding(e.target.value)} rows={3} placeholder={cfg.findingPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                        </div>
                                        <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                            <label className="block text-xs font-bold text-gray-600 mb-1">{cfg.methodLabel}</label>
                                            <textarea value={methodology} onChange={e => setMethodology(e.target.value)} rows={3} placeholder={cfg.methodPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ──── STEP 4: PERLAS ──── */}
                            <div>
                                <label className="block text-sm font-black text-gray-800 mb-3">
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-xs mr-2">PASO 4</span>
                                    💎 Tus Perlas de Aplicación
                                </label>
                                <div className="space-y-4">
                                    {cfg.perlas.map((p, i) => (
                                        <div key={p.id} className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 rounded-xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-100/50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                            <div className="relative z-10">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xl">{p.icon}</span>
                                                    <span className="font-black text-emerald-800 text-sm">{p.label} {p.required && <span className="text-red-400">*</span>}</span>
                                                </div>
                                                <p className="text-xs text-emerald-600 mb-2">{p.prompt}</p>
                                                <textarea 
                                                    value={perlas[p.id] || ''} 
                                                    onChange={e => setPerlaValue(p.id, e.target.value)} 
                                                    rows={3} 
                                                    placeholder={p.placeholder} 
                                                    className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-400 outline-none bg-white/80" 
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ──── STEP 5: Limitations ──── */}
                            <div className="bg-orange-50 border-2 border-orange-200 p-5 rounded-xl">
                                <label className="block text-sm font-black text-orange-800 mb-1">
                                    <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-lg text-xs mr-2">PASO 5</span>
                                    ⚠️ {cfg.limitPrompt} *
                                </label>
                                <textarea value={limitaciones} onChange={e => setLimitaciones(e.target.value)} rows={3} placeholder={cfg.limitPlaceholder} className="w-full border border-orange-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-400 outline-none bg-white/80 mt-2" />
                            </div>

                            {/* Submit */}
                            <button onClick={submitAnalysis} disabled={isSubmitting} className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 text-base">
                                {isSubmitting ? 'Enviando...' : `Enviar Análisis para Revisión → (${progress}%)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
