"use client";

import { useState, useEffect } from "react";
import { getStudentTasks, updateTaskStatus, getEvidenceArticles, saveEvidenceArticle, addContributionToArticle } from "@/services/evidence";
import { EvidenceTask, EvidenceArticle, ArticleCategory } from "@/types/evidence";

interface Props {
    studentId: string;
    studentName: string;
}

export function StudentEvidenceTasks({ studentId, studentName }: Props) {
    const [tasks, setTasks] = useState<EvidenceTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Form Modal
    const [selectedTask, setSelectedTask] = useState<EvidenceTask | null>(null);
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState<ArticleCategory>("Clínica");
    const [population, setPopulation] = useState("");
    const [cif, setCif] = useState("");
    const [summary, setSummary] = useState("");
    const [perla, setPerla] = useState("");
    const [limitaciones, setLimitaciones] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadTasks();
    }, [studentId]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const data = await getStudentTasks(studentId);
            setTasks(data);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const openTask = (task: EvidenceTask) => {
        setSelectedTask(task);
        setTitle(task.articleTitle);
        setCategory("Clínica");
        setPopulation("");
        setCif("");
        setSummary("");
        setPerla("");
        setLimitaciones("");
    };

    const submitAnalysis = async () => {
        if (!selectedTask || !summary.trim() || !perla.trim() || !population.trim() || !cif.trim()) {
            alert("Por favor completa todos los campos.");
            return;
        }

        setIsSubmitting(true);
        try {
            // 1. Create Contribution Object
            const contribId = `contrib_${Date.now()}`;
            const contribution = {
                id: contribId,
                studentId,
                studentName,
                perlaClinica: perla,
                limitaciones,
                status: 'REVISION' as const,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            let articleId = selectedTask.articleId;

            // 2. Si no tiene articleId, creamos un nuevo EvidenceArticle
            if (!articleId) {
                const newArticle: EvidenceArticle = {
                    title: selectedTask.articleTitle,
                    url: selectedTask.articleUrl,
                    category,
                    cif,
                    population,
                    tags: [], // IA or Docente can add later
                    summary,
                    contributions: [contribution],
                    createdAt: Date.now(),
                    createdBy: studentName,
                };
                articleId = await saveEvidenceArticle(newArticle);
            } else {
                // Si la tarea estaba ligada a un artículo existente, añadimos la contribución
                await addContributionToArticle(articleId, contribution);
            }

            // 3. Update task status
            await updateTaskStatus(selectedTask.id!, {
                status: 'REVISION',
                articleId,
                contributionId: contribId
            });

            alert("Análisis enviado correctamente. Está en revisión.");
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

    if (pendingOrRejected.length === 0) return null; // No mostrar nada si no hay tareas pendientes

    return (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm mb-8">
            <h3 className="font-bold text-orange-800 text-lg mb-4 flex items-center gap-2">
                <span className="text-2xl">⚠️</span> Tareas de Lectura Pendientes
            </h3>
            <div className="grid gap-4">
                {pendingOrRejected.map(t => {
                    const isOverdue = t.status === 'PENDING' && t.dueDate < Date.now();
                    return (
                        <div key={t.id} className={`bg-white border p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isOverdue ? 'border-red-400 shadow-md ring-2 ring-red-100' : 'border-orange-200'}`}>
                            <div>
                                <h4 className="font-bold text-gray-900">{t.articleTitle}</h4>
                                <div className="text-sm text-gray-500 mt-1">
                                    Vencimiento: <span className={isOverdue ? 'text-red-600 font-bold' : ''}>{new Date(t.dueDate).toLocaleString()}</span>
                                </div>
                                {t.status === 'REJECTED' && (
                                    <div className="mt-2 text-xs font-bold bg-red-100 text-red-700 inline-block px-2 py-1 rounded">Rechazado - Requiere corrección</div>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {t.articleUrl && (
                                    <a href={t.articleUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                                        📄 Ver Artículo
                                    </a>
                                )}
                                <button onClick={() => openTask(t)} className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors shadow-sm">
                                    Subir Análisis
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* FORM MODAL */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-orange-500 p-4 sticky top-0 flex justify-between items-center text-white z-10">
                            <h3 className="font-bold">Análisis Científico</h3>
                            <button onClick={() => setSelectedTask(null)} className="text-orange-100 hover:text-white">✕ Cancelar</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm mb-2">
                                Estás analizando: <strong>{selectedTask.articleTitle}</strong>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Categoría Principal</label>
                                    <select value={category} onChange={e => setCategory(e.target.value as ArticleCategory)} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                                        <option value="Clínica">Clínica (Tto/Eval)</option>
                                        <option value="Biomecánica">Biomecánica</option>
                                        <option value="Fisiología">Fisiología</option>
                                        <option value="Entrenamiento">Entrenamiento</option>
                                        <option value="Anatomía">Anatomía</option>
                                        <option value="Otro">Otro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Población / Deporte</label>
                                    <input value={population} onChange={e => setPopulation(e.target.value)} placeholder="Ej: Deportistas jóvenes, Básquetbol..." className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Patología o Condición (CIF)</label>
                                    <input value={cif} onChange={e => setCif(e.target.value)} placeholder="Ej: Tendinopatía Rotuliana, Déficit fuerza cuadricipital..." className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1 text-gray-700">Resumen Clave (3-5 líneas)</label>
                                <p className="text-xs text-gray-500 mb-2">¿Qué hicieron en el estudio y qué descubrieron? Sé conciso.</p>
                                <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 resize-none" placeholder="El estudio comparó... y encontró que..." />
                            </div>

                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                <label className="block text-sm font-bold mb-1 text-emerald-800">💎 Aplicación Práctica (La Perla Clínica)</label>
                                <p className="text-xs text-emerald-600 mb-2">¿Cómo aplicarías esta información con tus usuarios/pacientes en la práctica real?</p>
                                <textarea value={perla} onChange={e => setPerla(e.target.value)} rows={4} className="w-full border border-emerald-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="Mañana en el Polideportivo yo usaría esto para..." />
                            </div>

                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                                <label className="block text-sm font-bold mb-1 text-orange-800">⚠️ Limitaciones / Cuidados</label>
                                <p className="text-xs text-orange-600 mb-2">¿En qué casos NO usarías esto o qué debilidad tiene el artículo?</p>
                                <textarea value={limitaciones} onChange={e => setLimitaciones(e.target.value)} rows={3} className="w-full border border-orange-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-orange-400 outline-none" placeholder="El estudio fue en sedentarios, así que ojo con..." />
                            </div>

                            <button onClick={submitAnalysis} disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 text-lg">
                                Enviar Análisis para Revisión →
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
