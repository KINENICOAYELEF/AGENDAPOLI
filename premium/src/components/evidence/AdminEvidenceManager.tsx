"use client";

import { useState, useEffect } from "react";
import { getEvidenceArticles, saveEvidenceArticle, createEvidenceTask, getAllEvidenceTasks, updateTaskStatus, updateContributionInArticle } from "@/services/evidence";
import { EvidenceArticle, EvidenceTask, EvidenceContribution, ArticleCategory } from "@/types/evidence";
import { useAuth } from "@/context/AuthContext";
import { UsersService } from "@/services/users";

export function AdminEvidenceManager() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<EvidenceTask[]>([]);
    const [articles, setArticles] = useState<EvidenceArticle[]>([]);
    const [interns, setInterns] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [activeTab, setActiveTab] = useState<'TASKS' | 'CREATE_TASK' | 'ARTICLES'>('TASKS');

    // CREATE TASK FORM
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [articleTitle, setArticleTitle] = useState("");
    const [articleUrl, setArticleUrl] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // REVIEW MODAL
    const [reviewTask, setReviewTask] = useState<EvidenceTask | null>(null);
    const [reviewContribution, setReviewContribution] = useState<EvidenceContribution | null>(null);
    const [reviewArticle, setReviewArticle] = useState<EvidenceArticle | null>(null);
    const [reviewNota, setReviewNota] = useState(4.0);
    const [reviewFeedback, setReviewFeedback] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [t, a, u] = await Promise.all([
                getAllEvidenceTasks(),
                getEvidenceArticles(),
                UsersService.getInterns()
            ]);
            setTasks(t);
            setArticles(a);
            setInterns(u);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTasks = async () => {
        if (!articleTitle || !dueDate || selectedStudents.length === 0) {
            alert("Rellena el título, fecha y selecciona al menos un estudiante.");
            return;
        }
        setIsSubmitting(true);
        try {
            const dateParsed = new Date(dueDate).getTime();
            for (const studentId of selectedStudents) {
                const student = interns.find(i => i.uid === studentId);
                if (!student) continue;
                await createEvidenceTask({
                    studentId: student.uid,
                    studentName: student.displayName || student.email,
                    articleTitle,
                    articleUrl,
                    dueDate: dateParsed,
                    status: 'PENDING',
                    assignedBy: user?.displayName || 'Docente',
                    createdAt: Date.now()
                });
            }
            alert("Tareas creadas con éxito");
            setArticleTitle("");
            setArticleUrl("");
            setSelectedStudents([]);
            loadData();
            setActiveTab('TASKS');
        } catch (e: any) {
            alert("Error al crear tareas: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleStudent = (id: string) => {
        setSelectedStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const openReviewModal = (task: EvidenceTask) => {
        setReviewTask(task);
        if (task.articleId && task.contributionId) {
            const article = articles.find(a => a.id === task.articleId);
            if (article) {
                setReviewArticle(article);
                const contrib = article.contributions.find(c => c.id === task.contributionId);
                if (contrib) {
                    setReviewContribution(contrib);
                    setReviewNota(contrib.nota || 4.0);
                    setReviewFeedback(contrib.feedbackDocente || "");
                }
            }
        }
    };

    const submitReview = async (newStatus: 'APPROVED' | 'REJECTED') => {
        if (!reviewTask || !reviewArticle || !reviewContribution) return;
        setIsSubmitting(true);
        try {
            // Update Contribution
            const updatedContributions = reviewArticle.contributions.map(c => {
                if (c.id === reviewContribution.id) {
                    return { ...c, status: newStatus, nota: reviewNota, feedbackDocente: reviewFeedback };
                }
                return c;
            });
            await updateContributionInArticle(reviewArticle.id!, updatedContributions);
            
            // Update Task Status
            await updateTaskStatus(reviewTask.id!, { status: newStatus === 'REJECTED' ? 'PENDING' : 'APPROVED' });
            
            alert(newStatus === 'APPROVED' ? "Análisis aprobado y publicado." : "Análisis rechazado. El estudiante deberá rehacerlo.");
            setReviewTask(null);
            loadData();
        } catch (e: any) {
            alert("Error al guardar revisión: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="p-4 text-center">Cargando biblioteca de evidencia...</div>;

    const pendingReviews = tasks.filter(t => t.status === 'REVISION');

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
            <div className="bg-indigo-900 px-6 py-4 flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-white">📖 Gestor de Tareas y Biblioteca de Evidencia</h3>
                    <p className="text-indigo-200 text-sm">Asigna lecturas y revisa los análisis de los estudiantes.</p>
                </div>
            </div>

            <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
                <button onClick={() => setActiveTab('TASKS')} className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'TASKS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Tareas y Revisiones ({pendingReviews.length})</button>
                <button onClick={() => setActiveTab('CREATE_TASK')} className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${activeTab === 'CREATE_TASK' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>+ Asignar Lectura</button>
            </div>

            <div className="p-6">
                {activeTab === 'CREATE_TASK' && (
                    <div className="space-y-4 max-w-2xl">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Título del Artículo o Tema</label>
                            <input value={articleTitle} onChange={e => setArticleTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="Ej. Isometric exercises for patellar tendinopathy..." />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Enlace al Artículo (Opcional - Google Drive, Pubmed)</label>
                            <input value={articleUrl} onChange={e => setArticleUrl(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://drive.google.com/..." />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">Fecha Límite</label>
                            <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Asignar a Estudiantes Específicos:</label>
                            <div className="grid grid-cols-2 gap-2">
                                {interns.map(i => (
                                    <label key={i.uid} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                        <input type="checkbox" checked={selectedStudents.includes(i.uid)} onChange={() => toggleStudent(i.uid)} />
                                        <span className="text-sm">{i.displayName || i.email}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button onClick={handleCreateTasks} disabled={isSubmitting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-lg mt-4 disabled:opacity-50">
                            Crear Tareas
                        </button>
                    </div>
                )}

                {activeTab === 'TASKS' && (
                    <div>
                        {pendingReviews.length > 0 && (
                            <div className="mb-8">
                                <h4 className="font-bold text-red-600 mb-3 flex items-center gap-2">
                                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                                    Pendientes de Revisión Docente
                                </h4>
                                <div className="space-y-3">
                                    {pendingReviews.map(t => (
                                        <div key={t.id} className="border border-red-200 bg-red-50 p-4 rounded-xl flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-gray-900">{t.studentName}</div>
                                                <div className="text-sm text-gray-600">Artículo: {t.articleTitle}</div>
                                            </div>
                                            <button onClick={() => openReviewModal(t)} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold">
                                                Revisar y Calificar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <h4 className="font-bold text-gray-800 mb-3">Historial de Tareas</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                                    <tr>
                                        <th className="p-3">Estudiante</th>
                                        <th className="p-3">Artículo</th>
                                        <th className="p-3">Límite</th>
                                        <th className="p-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {tasks.map(t => (
                                        <tr key={t.id}>
                                            <td className="p-3 font-medium">{t.studentName}</td>
                                            <td className="p-3">{t.articleTitle}</td>
                                            <td className="p-3">{new Date(t.dueDate).toLocaleDateString()}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                                    t.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                                    t.status === 'PENDING' ? 'bg-gray-100 text-gray-700' :
                                                    t.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                    {t.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* REVIEW MODAL */}
            {reviewTask && reviewArticle && reviewContribution && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-indigo-900 p-4 sticky top-0 flex justify-between items-center text-white">
                            <h3 className="font-bold">Revisión de Análisis Clínico</h3>
                            <button onClick={() => setReviewTask(null)} className="text-indigo-200 hover:text-white">✕ Cerrar</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div><span className="font-semibold text-gray-500">Estudiante:</span> {reviewTask.studentName}</div>
                                <div><span className="font-semibold text-gray-500">Categoría:</span> {reviewArticle.category}</div>
                                <div><span className="font-semibold text-gray-500">Población:</span> {reviewArticle.population}</div>
                                <div><span className="font-semibold text-gray-500">Condición/CIF:</span> {reviewArticle.cif}</div>
                                <div className="col-span-2"><span className="font-semibold text-gray-500">Etiquetas Extraídas:</span> {reviewArticle.tags?.join(', ')}</div>
                            </div>
                            
                            <div>
                                <h4 className="font-bold text-gray-800 border-b pb-2 mb-3">Resumen del Estudio</h4>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap">{reviewArticle.summary}</p>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl">
                                <h4 className="font-bold text-emerald-800 border-b border-emerald-200 pb-2 mb-3">💎 Perla Clínica: Aplicación Práctica</h4>
                                <p className="text-gray-800 text-sm whitespace-pre-wrap">{reviewContribution.perlaClinica}</p>
                            </div>

                            <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                <h4 className="font-bold text-orange-800 border-b border-orange-200 pb-2 mb-3">⚠️ Limitaciones y Cuidados</h4>
                                <p className="text-gray-800 text-sm whitespace-pre-wrap">{reviewContribution.limitaciones}</p>
                            </div>

                            <hr className="border-gray-200" />

                            <div>
                                <h4 className="font-bold text-gray-900 mb-3">Evaluación Docente</h4>
                                <div className="flex gap-4 mb-4">
                                    <div className="w-32">
                                        <label className="block text-sm font-semibold mb-1">Nota (1.0 - 7.0)</label>
                                        <input type="number" step="0.1" min="1.0" max="7.0" value={reviewNota} onChange={e => setReviewNota(parseFloat(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-lg font-bold text-center" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold mb-1">Retroalimentación para el estudiante</label>
                                        <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} rows={3} placeholder="Buen razonamiento, pero ten cuidado con..." className="w-full border rounded-lg px-3 py-2 text-sm resize-none"></textarea>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={() => submitReview('APPROVED')} disabled={isSubmitting} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                                        ✅ Aprobar y Publicar en Biblioteca
                                    </button>
                                    <button onClick={() => submitReview('REJECTED')} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl disabled:opacity-50">
                                        ❌ Rechazar (Debe Rehacer)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
