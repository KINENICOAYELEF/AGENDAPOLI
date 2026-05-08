"use client";

import { useState, useEffect } from "react";
import { getStudentTasks, updateTaskStatus, getEvidenceArticles, saveEvidenceArticle, addContributionToArticle } from "@/services/evidence";
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
    const [contextField, setContextField] = useState(""); // CIF / System / Movement etc.
    const [finding, setFinding] = useState("");
    const [methodology, setMethodology] = useState("");
    const [perla, setPerla] = useState("");
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
        setPopulation(""); setContextField(""); setFinding("");
        setMethodology(""); setPerla(""); setLimitaciones("");
    };

    const cfg = CATEGORY_CONFIGS[category];

    const submitAnalysis = async () => {
        if (!selectedTask || !contextField.trim() || !finding.trim() || !methodology.trim() || !perla.trim() || !population.trim()) {
            alert("Por favor completa todos los campos obligatorios.");
            return;
        }

        setIsSubmitting(true);
        try {
            const contribId = `contrib_${Date.now()}`;
            const contribution = {
                id: contribId, studentId, studentName,
                perlaClinica: perla, limitaciones,
                status: 'REVISION' as const,
                createdAt: Date.now(), updatedAt: Date.now()
            };

            let articleId = selectedTask.articleId;

            if (!articleId) {
                const newArticle: EvidenceArticle = {
                    title: selectedTask.articleTitle,
                    url: selectedTask.articleUrl,
                    category, cif: contextField, population, tags: [],
                    summary: `[${cfg.contextLabel}]: ${contextField}`,
                    finding, methodology,
                    contributions: [contribution],
                    createdAt: Date.now(), createdBy: studentName,
                };
                articleId = await saveEvidenceArticle(newArticle);
            } else {
                await addContributionToArticle(articleId, contribution);
            }

            await updateTaskStatus(selectedTask.id!, { status: 'REVISION', articleId, contributionId: contribId });
            alert("✅ Análisis enviado correctamente. Está en revisión.");
            setSelectedTask(null);
            loadTasks();
        } catch (e: any) {
            alert("Error al enviar: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div>Cargando tus tareas...</div>;

    const pendingOrRejected = tasks.filter(t => t.status === 'PENDING' || t.status === 'REJECTED');
    if (pendingOrRejected.length === 0) return null;

    const colorMap: Record<string, string> = {
        emerald: 'from-emerald-600 to-teal-700', blue: 'from-blue-600 to-cyan-700',
        violet: 'from-violet-600 to-purple-700', orange: 'from-orange-500 to-red-600',
        pink: 'from-pink-600 to-rose-700', slate: 'from-slate-600 to-gray-700'
    };

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

            {/* ADAPTIVE FORM MODAL */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        {/* Header */}
                        <div className={`bg-gradient-to-r ${colorMap[cfg.color] || colorMap.slate} p-5 sticky top-0 z-10`}>
                            <div className="flex justify-between items-start text-white">
                                <div>
                                    <h3 className="font-black text-lg">Ficha de Análisis Científico</h3>
                                    <p className="text-white/70 text-sm mt-0.5">📄 {selectedTask.articleTitle}</p>
                                </div>
                                <button onClick={() => setSelectedTask(null)} className="text-white/60 hover:text-white text-lg font-bold">✕</button>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Step 1: Category Selector */}
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-2">1️⃣ ¿De qué tipo es este artículo?</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(Object.keys(CATEGORY_CONFIGS) as ArticleCategory[]).map(cat => {
                                        const c = CATEGORY_CONFIGS[cat];
                                        const isActive = category === cat;
                                        return (
                                            <button key={cat} type="button" onClick={() => setCategory(cat)}
                                                className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <div className="text-lg">{c.icon}</div>
                                                <div className={`text-xs font-bold mt-1 ${isActive ? 'text-indigo-800' : 'text-gray-600'}`}>{c.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Step 2: Metadata */}
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-3">2️⃣ Clasifica el artículo</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">{cfg.contextLabel} *</label>
                                        <p className="text-[10px] text-gray-400 mb-1">{cfg.contextHelp}</p>
                                        <input value={contextField} onChange={e => setContextField(e.target.value)} placeholder={cfg.contextPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Población / Deporte *</label>
                                        <p className="text-[10px] text-gray-400 mb-1">¿En quién se hizo el estudio o a quién aplica?</p>
                                        <input value={population} onChange={e => setPopulation(e.target.value)} placeholder="Ej: Deportistas jóvenes, Básquetbol, Adultos mayores..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Step 3: Content Analysis */}
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-3">3️⃣ Analiza el contenido</label>
                                <div className="space-y-4">
                                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">{cfg.findingLabel} *</label>
                                        <p className="text-[10px] text-gray-400 mb-2">{cfg.findingHelp}</p>
                                        <textarea value={finding} onChange={e => setFinding(e.target.value)} rows={3} placeholder={cfg.findingPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">{cfg.methodLabel} *</label>
                                        <textarea value={methodology} onChange={e => setMethodology(e.target.value)} rows={3} placeholder={cfg.methodPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                </div>
                            </div>

                            {/* Step 4: The Pearl */}
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-3">4️⃣ Tu aporte profesional</label>
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 rounded-xl">
                                    <label className="block text-sm font-black text-emerald-800 mb-1">💎 {cfg.perlaPrompt}</label>
                                    <textarea value={perla} onChange={e => setPerla(e.target.value)} rows={4} placeholder={cfg.perlaPlaceholder} className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-400 outline-none bg-white/80" />
                                </div>
                            </div>

                            {/* Step 5: Limitations */}
                            <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                <label className="block text-sm font-bold text-orange-800 mb-1">⚠️ {cfg.limitPrompt}</label>
                                <textarea value={limitaciones} onChange={e => setLimitaciones(e.target.value)} rows={3} placeholder={cfg.limitPlaceholder} className="w-full border border-orange-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-400 outline-none bg-white/80" />
                            </div>

                            <button onClick={submitAnalysis} disabled={isSubmitting} className="w-full bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-900 hover:to-black text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 text-base">
                                {isSubmitting ? 'Enviando...' : 'Enviar Análisis para Revisión →'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
