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

    const [activeTab, setActiveTab] = useState<'TASKS' | 'CREATE_TASK'>('TASKS');

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
    // Admin tag editing for the article under review
    const [reviewExtraTags, setReviewExtraTags] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        setError("");
        // Load each independently so one failure doesn't kill the others
        const [internsResult, tasksResult, articlesResult] = await Promise.allSettled([
            UsersService.getInterns(),
            getAllEvidenceTasks(),
            getEvidenceArticles()
        ]);

        if (internsResult.status === 'fulfilled') setInterns(internsResult.value);
        else console.warn("No se pudieron cargar internos:", internsResult.reason);

        if (tasksResult.status === 'fulfilled') setTasks(tasksResult.value);
        else console.warn("No se pudieron cargar tareas:", tasksResult.reason);

        if (articlesResult.status === 'fulfilled') setArticles(articlesResult.value);
        else console.warn("No se pudieron cargar artículos:", articlesResult.reason);

        setLoading(false);
    };

    const handleCreateTasks = async () => {
        if (!articleTitle.trim()) {
            alert("Escribe el título del artículo o tema.");
            return;
        }
        if (!dueDate) {
            alert("Selecciona una fecha límite.");
            return;
        }
        if (selectedStudents.length === 0) {
            alert("Selecciona al menos un estudiante.");
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
            alert(`✅ ${selectedStudents.length} tarea(s) creada(s) con éxito.`);
            setArticleTitle("");
            setArticleUrl("");
            setDueDate("");
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

    const selectAllStudents = () => {
        if (selectedStudents.length === interns.length) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(interns.map(i => i.uid));
        }
    };

    const openReviewModal = (task: EvidenceTask) => {
        setReviewTask(task);
        setReviewExtraTags("");
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
                    return { ...c, status: newStatus, nota: reviewNota, feedbackDocente: reviewFeedback, updatedAt: Date.now() };
                }
                return c;
            });

            // If admin added extra tags during review, merge them
            let updatedTags = [...(reviewArticle.tags || [])];
            if (reviewExtraTags.trim()) {
                const newTags = reviewExtraTags.split(',').map(t => t.trim()).filter(Boolean);
                updatedTags = Array.from(new Set([...updatedTags, ...newTags]));
            }

            await updateContributionInArticle(reviewArticle.id!, updatedContributions);
            if (updatedTags.length !== (reviewArticle.tags || []).length) {
                await saveEvidenceArticle({ ...reviewArticle, tags: updatedTags, contributions: updatedContributions });
            }
            
            // Update Task Status
            await updateTaskStatus(reviewTask.id!, { status: newStatus === 'REJECTED' ? 'PENDING' : 'APPROVED' });
            
            alert(newStatus === 'APPROVED' ? "✅ Análisis aprobado y publicado en la biblioteca." : "❌ Análisis rechazado. El estudiante deberá rehacerlo.");
            setReviewTask(null);
            setReviewArticle(null);
            setReviewContribution(null);
            loadData();
        } catch (e: any) {
            alert("Error al guardar revisión: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleHide = async () => {
        if (!reviewArticle || !reviewContribution) return;
        setIsSubmitting(true);
        try {
            const newHiddenStatus = !reviewContribution.isHidden;
            const updatedContribs = reviewArticle.contributions.map(c => 
                c.id === reviewContribution.id ? { ...c, isHidden: newHiddenStatus } : c
            );
            await updateContributionInArticle(reviewArticle.id!, updatedContribs);
            setReviewContribution({ ...reviewContribution, isHidden: newHiddenStatus });
            alert(newHiddenStatus ? "👁️ Aporte ocultado de la biblioteca." : "👁️ Aporte ahora es visible.");
            loadData();
        } catch (e: any) {
            alert("Error: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!reviewTask || !reviewArticle || !reviewContribution) return;
        if (!confirm("⚠️ ¿Estás seguro? Se eliminará este aporte permanentemente tanto de la biblioteca como del historial del alumno.")) return;
        
        setIsSubmitting(true);
        try {
            // Eliminar aporte del artículo
            const updatedContribs = reviewArticle.contributions.filter(c => c.id !== reviewContribution.id);
            await updateContributionInArticle(reviewArticle.id!, updatedContribs);
            
            // Eliminar la tarea
            const { deleteEvidenceTask } = await import("@/services/evidence");
            await deleteEvidenceTask(reviewTask.id!);

            alert("🗑️ Aporte eliminado correctamente.");
            setReviewTask(null);
            setReviewArticle(null);
            setReviewContribution(null);
            loadData();
        } catch (e: any) {
            alert("Error al eliminar: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDownloadAnalysis = () => {
        if (!reviewArticle || !reviewContribution) return;

        const text = `--- INFORME DE ANÁLISIS DE EVIDENCIA (IA READY) ---
FECHA EXPORTACIÓN: ${new Date().toLocaleString()}

[ARTÍCULO]
Título: ${reviewArticle.title}
URL: ${reviewArticle.url || 'No especificada'}
Categoría: ${reviewArticle.category}
Población: ${reviewArticle.population}
CIF/Condición: ${reviewArticle.cif}
Etiquetas: ${reviewArticle.tags?.join(', ') || 'Sin etiquetas'}
Diseño del Estudio: ${reviewContribution.studyDesign || 'No especificado'}

[RESUMEN ESTRUCTURADO (FASE 3)]
${reviewArticle.summary}

[HALLAZGO CLAVE]
${reviewArticle.finding}

[METODOLOGÍA]
${reviewArticle.methodology}

--------------------------------------------------
[ANÁLISIS DEL ESTUDIANTE: ${reviewContribution.studentName.toUpperCase()}]
--------------------------------------------------

[RESUMEN PERSONAL DEL ESTUDIANTE]
${reviewContribution.resumenEstudiante}

[PERLAS CLÍNICAS Y APLICACIÓN PRÁCTICA]
${Object.entries(reviewContribution.perlas || {}).map(([key, val]) => `### ${key.toUpperCase()}:\n${val}`).join('\n\n')}

[DOSIFICACIÓN / PARÁMETROS ESTRUCTURADOS]
${reviewContribution.dosis ? Object.entries(reviewContribution.dosis).filter(([_,v]) => !!v).map(([k, v]) => `- ${k.toUpperCase()}: ${v}`).join('\n') : 'No aplica o no especificado'}

[ANÁLISIS CRÍTICO Y LIMITACIONES]
${reviewContribution.limitaciones}

[EVALUACIÓN DOCENTE]
Nota: ${reviewContribution.nota || 'Pendiente'}
Feedback: ${reviewContribution.feedbackDocente || 'Sin feedback todavía'}

--- FIN DEL INFORME ---`;

        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = reviewArticle.title.substring(0, 30).replace(/[^a-z0-9]/gi, '_');
        a.download = `Analisis_IA_${reviewContribution.studentName.replace(/\s+/g, '_')}_${safeName}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const pendingReviews = tasks.filter(t => t.status === 'REVISION');
    const pendingTasks = tasks.filter(t => t.status === 'PENDING');
    const completedTasks = tasks.filter(t => t.status === 'APPROVED');

    const statusLabel: Record<string, string> = {
        PENDING: 'Pendiente',
        REVISION: 'En Revisión',
        APPROVED: 'Aprobado',
        REJECTED: 'Rechazado'
    };

    return (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 backdrop-blur rounded-xl flex items-center justify-center text-xl">📋</div>
                    <div>
                        <h3 className="text-lg font-black text-white tracking-tight">Gestor de Tareas de Lectura</h3>
                        <p className="text-indigo-200 text-sm">Asigna artículos y revisa los análisis de tus estudiantes.</p>
                    </div>
                </div>
                {/* Stats */}
                <div className="flex gap-6 mt-4">
                    <div className="text-center">
                        <div className="text-2xl font-black text-white">{pendingReviews.length}</div>
                        <div className="text-xs text-indigo-300 font-medium">Por Revisar</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-white">{pendingTasks.length}</div>
                        <div className="text-xs text-indigo-300 font-medium">Pendientes</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-white">{completedTasks.length}</div>
                        <div className="text-xs text-indigo-300 font-medium">Aprobados</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-white">{interns.length}</div>
                        <div className="text-xs text-indigo-300 font-medium">Estudiantes</div>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
                <button onClick={() => setActiveTab('TASKS')} className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-colors ${activeTab === 'TASKS' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Tareas y Revisiones {pendingReviews.length > 0 && <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingReviews.length}</span>}
                </button>
                <button onClick={() => setActiveTab('CREATE_TASK')} className={`px-5 py-2.5 font-bold text-sm border-b-2 transition-colors ${activeTab === 'CREATE_TASK' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    + Asignar Nueva Lectura
                </button>
            </div>

            <div className="p-6">
                {/* ─── CREATE TASK ─── */}
                {activeTab === 'CREATE_TASK' && (
                    <div className="space-y-5 max-w-3xl mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-gray-700 mb-1">Título del Artículo o Tema</label>
                                <input value={articleTitle} onChange={e => setArticleTitle(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="Ej. Isometric exercises for patellar tendinopathy..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Enlace al Artículo (Opcional)</label>
                                <input value={articleUrl} onChange={e => setArticleUrl(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="https://drive.google.com/..." />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Fecha Límite de Entrega</label>
                                <input type="datetime-local" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-400 outline-none" />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="text-sm font-bold text-gray-700">Asignar a Estudiantes:</label>
                                <button onClick={selectAllStudents} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                                    {selectedStudents.length === interns.length ? '✕ Deseleccionar Todos' : '✓ Seleccionar Todos'}
                                </button>
                            </div>
                            
                            {loading ? (
                                <div className="text-center py-4 text-gray-500">Cargando estudiantes...</div>
                            ) : interns.length === 0 ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                                    <strong>⚠️ No se encontraron estudiantes.</strong> Asegúrate de haber aprobado al menos un usuario como INTERNO en el Admin Docente.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {interns.map(i => {
                                        const isSelected = selectedStudents.includes(i.uid);
                                        return (
                                            <button
                                                key={i.uid}
                                                type="button"
                                                onClick={() => toggleStudent(i.uid)}
                                                className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                                                    isSelected 
                                                        ? 'border-indigo-500 bg-indigo-50 shadow-md ring-1 ring-indigo-200' 
                                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
                                                    isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {isSelected ? '✓' : (i.displayName || i.email || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <span className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-800' : 'text-gray-700'}`}>
                                                    {i.displayName || i.email}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        
                        {selectedStudents.length > 0 && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 text-sm text-indigo-700 font-medium">
                                📌 Se creará la tarea para <strong>{selectedStudents.length}</strong> estudiante(s).
                            </div>
                        )}

                        <button onClick={handleCreateTasks} disabled={isSubmitting || selectedStudents.length === 0} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm">
                            {isSubmitting ? 'Creando...' : `Crear ${selectedStudents.length > 0 ? selectedStudents.length : ''} Tarea(s)`}
                        </button>
                    </div>
                )}

                {/* ─── TASKS LIST ─── */}
                {activeTab === 'TASKS' && (
                    <div className="space-y-6">
                        {/* Pending Reviews */}
                        {pendingReviews.length > 0 && (
                            <div>
                                <h4 className="font-black text-red-600 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span></span>
                                    Pendientes de tu Revisión
                                </h4>
                                <div className="space-y-2">
                                    {pendingReviews.map(t => (
                                        <div key={t.id} className="border-2 border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                                            <div>
                                                <div className="font-bold text-gray-900">{t.studentName}</div>
                                                <div className="text-sm text-gray-600 mt-0.5">📄 {t.articleTitle}</div>
                                            </div>
                                            <button onClick={() => openReviewModal(t)} className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-sm transition-colors">
                                                Revisar y Calificar
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Full History Table */}
                        <div>
                            <h4 className="font-bold text-gray-800 mb-3 text-sm">Historial Completo de Tareas ({tasks.length})</h4>
                            {tasks.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">Aún no has asignado tareas. Haz clic en "+ Asignar Nueva Lectura" para comenzar.</div>
                            ) : (
                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-200">
                                            <tr>
                                                <th className="p-3">Estudiante</th>
                                                <th className="p-3">Artículo</th>
                                                <th className="p-3">Límite</th>
                                                <th className="p-3">Estado</th>
                                                <th className="p-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {tasks.map(t => {
                                                const isOverdue = t.status === 'PENDING' && t.dueDate < Date.now();
                                                const hasAnalysis = t.status !== 'PENDING';
                                                return (
                                                    <tr key={t.id} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/50' : ''}`}>
                                                        <td className="p-3 font-semibold text-gray-900">{t.studentName}</td>
                                                        <td className="p-3 text-gray-700 max-w-[200px] truncate">{t.articleTitle}</td>
                                                        <td className="p-3">
                                                            <span className={isOverdue ? 'text-red-600 font-bold' : 'text-gray-600'}>{new Date(t.dueDate).toLocaleDateString()}</span>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                                                t.status === 'PENDING' ? (isOverdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600') :
                                                                t.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                                {isOverdue && t.status === 'PENDING' ? '⏰ Atrasado' : statusLabel[t.status] || t.status}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            {hasAnalysis ? (
                                                                <button onClick={() => openReviewModal(t)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                                                                    🔍 Re-revisar
                                                                </button>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 italic">Sin entrega</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ─── REVIEW MODAL ─── */}
            {reviewTask && reviewArticle && reviewContribution && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="bg-gradient-to-r from-indigo-900 to-violet-900 p-5 sticky top-0 flex justify-between items-center text-white z-10">
                            <div>
                                <div className="flex items-center gap-3">
                                    <h3 className="font-black text-lg">Revisión de Análisis</h3>
                                    {reviewContribution.status === 'APPROVED' && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${reviewContribution.isHidden ? 'bg-amber-400 text-amber-900' : 'bg-emerald-400 text-emerald-900'}`}>
                                            {reviewContribution.isHidden ? 'Aprobado (Oculto)' : 'Aprobado (Visible)'}
                                        </span>
                                    )}
                                    {reviewContribution.status === 'REJECTED' && (
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-400 text-red-900">
                                            Rechazado
                                        </span>
                                    )}
                                </div>
                                <p className="text-indigo-200 text-sm">{reviewTask.studentName} — {reviewTask.articleTitle}</p>
                            </div>
                            <button onClick={() => { setReviewTask(null); setReviewArticle(null); setReviewContribution(null); }} className="text-indigo-200 hover:text-white text-lg font-bold">✕</button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Metadata */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Categoría', value: reviewArticle.category, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                    { label: 'Población', value: reviewArticle.population, color: 'bg-violet-50 text-violet-700 border-violet-200' },
                                    { label: 'Condición / CIF', value: reviewArticle.cif, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                                    { label: 'Etiquetas', value: reviewArticle.tags?.join(', ') || 'Sin etiquetas', color: 'bg-slate-50 text-slate-700 border-slate-200' }
                                ].map(m => (
                                    <div key={m.label} className={`p-3 rounded-xl border ${m.color} break-words`}>
                                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-60">{m.label}</div>
                                        <div className="text-xs sm:text-sm font-semibold mt-0.5 line-clamp-3" title={m.value}>{m.value || '—'}</div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Actions / Export */}
                            <div className="flex justify-end">
                                <button 
                                    onClick={handleDownloadAnalysis} 
                                    className="group flex items-center gap-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white px-4 py-2 rounded-xl text-xs font-black border border-indigo-100 hover:border-indigo-600 transition-all shadow-sm"
                                >
                                    <span className="text-lg group-hover:scale-110 transition-transform">⬇️</span>
                                    DESCARGAR INFORME ESTRUCTURADO (PRO IA)
                                </button>
                            </div>
                            
                            {/* Summary */}
                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                                <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider mb-2">Resumen del Estudio</h4>
                                <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed break-words">{reviewArticle.summary}</p>
                            </div>

                            {/* Student's own summary */}
                            {reviewContribution.resumenEstudiante && (
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                                    <h4 className="font-bold text-slate-700 text-sm mb-2">📝 Resumen del Estudiante</h4>
                                    <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed break-words">{reviewContribution.resumenEstudiante}</p>
                                </div>
                            )}

                            {/* Study design */}
                            {reviewContribution.studyDesign && (
                                <div className="inline-block bg-indigo-50 border border-indigo-200 px-4 py-2 rounded-lg text-sm text-indigo-700">
                                    <span className="font-bold">Diseño:</span> {reviewContribution.studyDesign}
                                </div>
                            )}

                            {/* Dose data for training */}
                            {reviewContribution.dosis && Object.values(reviewContribution.dosis).some(v => v) && (
                                <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                                    <h4 className="font-bold text-orange-800 text-sm mb-2">📊 Dosis del Protocolo</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                                        {reviewContribution.dosis.intensidad && <div className="bg-white p-2 rounded-lg border border-orange-100 break-words"><span className="text-[10px] font-bold text-orange-500 block">Intensidad</span><div className="text-xs mt-0.5">{reviewContribution.dosis.intensidad}</div></div>}
                                        {reviewContribution.dosis.volumen && <div className="bg-white p-2 rounded-lg border border-orange-100 break-words"><span className="text-[10px] font-bold text-orange-500 block">Volumen</span><div className="text-xs mt-0.5">{reviewContribution.dosis.volumen}</div></div>}
                                        {reviewContribution.dosis.frecuencia && <div className="bg-white p-2 rounded-lg border border-orange-100 break-words"><span className="text-[10px] font-bold text-orange-500 block">Frecuencia</span><div className="text-xs mt-0.5">{reviewContribution.dosis.frecuencia}</div></div>}
                                        {reviewContribution.dosis.duracion && <div className="bg-white p-2 rounded-lg border border-orange-100 break-words"><span className="text-[10px] font-bold text-orange-500 block">Duración</span><div className="text-xs mt-0.5">{reviewContribution.dosis.duracion}</div></div>}
                                        {reviewContribution.dosis.tipoContraccion && <div className="bg-white p-2 rounded-lg border border-orange-100 break-words"><span className="text-[10px] font-bold text-orange-500 block">Contracción</span><div className="text-xs mt-0.5">{reviewContribution.dosis.tipoContraccion}</div></div>}
                                    </div>
                                </div>
                            )}

                            {/* Individual Perlas */}
                            {reviewContribution.perlas && Object.keys(reviewContribution.perlas).length > 0 ? (
                                <div className="space-y-3">
                                    <h4 className="font-black text-emerald-800 text-sm">💎 PERLAS DE APLICACIÓN</h4>
                                    {Object.entries(reviewContribution.perlas).map(([perlaId, content]) => (
                                        <div key={perlaId} className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">{perlaId.replace('perla_', '').replace(/_/g, ' ')}</div>
                                            <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{content}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : reviewContribution.perlaClinica && (
                                <div className="bg-emerald-50 border-2 border-emerald-200 p-5 rounded-xl">
                                    <h4 className="font-black text-emerald-800 text-sm mb-2">💎 APLICACIÓN PRÁCTICA</h4>
                                    <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{reviewContribution.perlaClinica}</p>
                                </div>
                            )}

                            {/* Limitations */}
                            {reviewContribution.limitaciones && (
                                <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                    <h4 className="font-bold text-orange-800 text-sm mb-2">⚠️ Análisis Crítico y Limitaciones</h4>
                                    <p className="text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">{reviewContribution.limitaciones}</p>
                                </div>
                            )}

                            <hr className="border-gray-200" />

                            {/* Admin Evaluation */}
                            <div className="space-y-4">
                                <h4 className="font-black text-gray-900 text-sm uppercase tracking-wider">Tu Evaluación Docente</h4>
                                
                                <div className="flex gap-4">
                                    <div className="w-28">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nota (1-7)</label>
                                        <input type="number" step="0.1" min="1.0" max="7.0" value={reviewNota} onChange={e => setReviewNota(parseFloat(e.target.value))} className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 text-xl font-black text-center focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Retroalimentación para el estudiante</label>
                                        <textarea value={reviewFeedback} onChange={e => setReviewFeedback(e.target.value)} rows={3} placeholder="Buen razonamiento, pero ten cuidado con..." className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none"></textarea>
                                    </div>
                                </div>
                                
                                {/* Extra Tags during Review */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Agregar Etiquetas Extra (separadas por coma)</label>
                                    <input value={reviewExtraTags} onChange={e => setReviewExtraTags(e.target.value)} placeholder="Ej: Isométricos, Cuádriceps, Dolor Anterior" className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                    {/* Current tags */}
                                    {reviewArticle.tags?.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            <span className="text-[10px] text-gray-400 font-bold">TAGS ACTUALES:</span>
                                            {reviewArticle.tags.map(t => <span key={t} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-medium">{t}</span>)}
                                        </div>
                                    )}
                                    {/* Autocomplete suggestions */}
                                    {reviewExtraTags.trim() && (() => {
                                        const currentInput = reviewExtraTags.split(',').pop()?.trim().toLowerCase() || '';
                                        if (!currentInput || currentInput.length < 2) return null;
                                        const allTags = Array.from(new Set(articles.flatMap(a => a.tags || [])));
                                        const suggestions = allTags.filter(t => t.toLowerCase().includes(currentInput) && !(reviewArticle.tags || []).includes(t)).slice(0, 6);
                                        if (suggestions.length === 0) return null;
                                        return (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                <span className="text-[10px] text-indigo-400 font-bold">SUGERENCIAS:</span>
                                                {suggestions.map(s => <button key={s} type="button" onClick={() => { const parts = reviewExtraTags.split(','); parts[parts.length - 1] = ` ${s}`; setReviewExtraTags(parts.join(',') + ', '); }} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px] font-medium hover:bg-indigo-200 transition-colors cursor-pointer">{s}</button>)}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="flex gap-3">
                                    <button onClick={() => submitReview('APPROVED')} disabled={isSubmitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-sm disabled:opacity-50 transition-colors">
                                        ✅ {reviewContribution.status === 'APPROVED' ? 'Actualizar Aprobación' : 'Aprobar y Publicar'}
                                    </button>
                                    <button onClick={() => submitReview('REJECTED')} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl shadow-sm disabled:opacity-50 transition-colors">
                                        ❌ {reviewContribution.status === 'REJECTED' ? 'Mantener Rechazo' : 'Rechazar (Rehacer)'}
                                    </button>
                                </div>

                                {/* Danger Zone / Extra Actions */}
                                <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3">
                                    <button 
                                        onClick={toggleHide} 
                                        disabled={isSubmitting || reviewContribution.status !== 'APPROVED'} 
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all border ${
                                            reviewContribution.isHidden 
                                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                        } disabled:opacity-30`}
                                    >
                                        {reviewContribution.isHidden ? '👁️ Mostrar en Biblioteca' : '👁️ Ocultar en Biblioteca'}
                                    </button>
                                    
                                    <button 
                                        onClick={handleDelete} 
                                        disabled={isSubmitting} 
                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-30"
                                    >
                                        🗑️ Eliminar Aporte
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
