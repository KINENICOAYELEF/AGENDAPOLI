"use client";

import { useState, useEffect } from "react";
import { getEvidenceArticles, addContributionToArticle } from "@/services/evidence";
import { EvidenceArticle, ArticleCategory } from "@/types/evidence";
import { CATEGORY_CONFIGS } from "./EvidenceFormConfig";

interface Props {
    currentUserId: string;
    currentUserName: string;
    currentUserRole: string;
}

export function EvidenceLibrary({ currentUserId, currentUserName, currentUserRole }: Props) {
    const [articles, setArticles] = useState<EvidenceArticle[]>([]);
    const [filteredArticles, setFilteredArticles] = useState<EvidenceArticle[]>([]);
    const [loading, setLoading] = useState(true);

    // Search & Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("TODAS");

    // Add Contribution Modal
    const [addingToArticle, setAddingToArticle] = useState<EvidenceArticle | null>(null);
    const [perla, setPerla] = useState("");
    const [limitaciones, setLimitaciones] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Add Free Article Modal
    const [isAddingFree, setIsAddingFree] = useState(false);
    const [freeTitle, setFreeTitle] = useState("");
    const [freeUrl, setFreeUrl] = useState("");
    const [freeCategory, setFreeCategory] = useState<ArticleCategory>("Clínica");
    const [freePopulation, setFreePopulation] = useState("");
    const [freeCif, setFreeCif] = useState("");
    const [freeSummary, setFreeSummary] = useState("");
    const [freeFinding, setFreeFinding] = useState("");
    const [freeMethodology, setFreeMethodology] = useState("");

    // Add Tags Logic
    const [addingTagsTo, setAddingTagsTo] = useState<string | null>(null);
    const [newTagStr, setNewTagStr] = useState("");
    
    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterData();
    }, [searchTerm, categoryFilter, articles]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getEvidenceArticles();
            setArticles(data);
        } catch (e: any) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filterData = () => {
        let result = [...articles];
        if (categoryFilter !== "TODAS") {
            result = result.filter(a => a.category === categoryFilter);
        }
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(a => 
                a.title.toLowerCase().includes(q) || 
                a.cif.toLowerCase().includes(q) || 
                a.population.toLowerCase().includes(q) || 
                a.summary.toLowerCase().includes(q) ||
                a.category.toLowerCase().includes(q) ||
                a.tags.some(t => t.toLowerCase().includes(q))
            );
        }
        setFilteredArticles(result);
    };

    const submitContribution = async () => {
        if (!addingToArticle || !perla.trim()) {
            alert("Completa tu aplicación práctica (perla clínica).");
            return;
        }
        setIsSubmitting(true);
        try {
            const contrib = {
                id: `contrib_${Date.now()}`,
                studentId: currentUserId,
                studentName: currentUserName,
                perlaClinica: perla,
                limitaciones,
                status: 'REVISION' as const,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            await addContributionToArticle(addingToArticle.id!, contrib);
            alert("Aporte enviado correctamente. Está pendiente de revisión docente.");
            setAddingToArticle(null);
            setPerla("");
            setLimitaciones("");
            loadData();
        } catch (e: any) {
            alert("Error al enviar aporte: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitFreeArticle = async () => {
        const freeCfg = CATEGORY_CONFIGS[freeCategory];
        if (!freeTitle.trim() || !perla.trim() || !freePopulation.trim() || !freeCif.trim() || !freeFinding.trim()) {
            alert("Por favor completa todos los campos obligatorios.");
            return;
        }

        setIsSubmitting(true);
        try {
            const contrib = {
                id: `contrib_${Date.now()}`,
                studentId: currentUserId,
                studentName: currentUserName,
                perlaClinica: perla,
                limitaciones,
                status: currentUserRole === 'DOCENTE' ? ('APPROVED' as const) : ('REVISION' as const),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const newArticle: EvidenceArticle = {
                title: freeTitle,
                url: freeUrl,
                category: freeCategory,
                cif: freeCif,
                population: freePopulation,
                tags: [],
                summary: freeSummary || `Artículo sobre ${freeCfg.label}`,
                finding: freeFinding,
                methodology: freeMethodology,
                contributions: [contrib],
                createdAt: Date.now(),
                createdBy: currentUserName,
            };

            await import('@/services/evidence').then(m => m.saveEvidenceArticle(newArticle));
            alert(currentUserRole === 'DOCENTE' ? "Artículo publicado exitosamente." : "Aporte enviado correctamente. Está en revisión.");
            
            setIsAddingFree(false);
            setFreeTitle(""); setFreeUrl(""); setFreeSummary(""); setFreePopulation("");
            setFreeCif(""); setFreeFinding(""); setFreeMethodology("");
            setPerla(""); setLimitaciones("");
            
            loadData();
        } catch (e: any) {
            alert("Error al enviar aporte libre: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddTags = async (article: EvidenceArticle) => {
        if (!newTagStr.trim()) {
            setAddingTagsTo(null);
            return;
        }
        
        setIsSubmitting(true);
        try {
            const tagsToAdd = newTagStr.split(',').map(t => t.trim()).filter(t => t);
            if (tagsToAdd.length > 0) {
                // To keep it simple, we use saveEvidenceArticle which does an updateDoc
                const updatedTags = Array.from(new Set([...article.tags, ...tagsToAdd]));
                await import('@/services/evidence').then(m => m.saveEvidenceArticle({ ...article, tags: updatedTags }));
                loadData();
            }
            setNewTagStr("");
            setAddingTagsTo(null);
        } catch (e: any) {
            alert("Error al guardar etiquetas: " + e.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="text-center py-10">Cargando biblioteca...</div>;

    const categories = ["TODAS", "Clínica", "Biomecánica", "Fisiología", "Entrenamiento", "Anatomía", "Otro"];

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            
            {/* Buscador y Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="flex-1">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Buscador Global</label>
                        <input 
                            type="text" 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            placeholder="Buscar por patología, título, intervención..." 
                            className="w-full border border-slate-300 rounded-lg px-4 py-2"
                        />
                    </div>
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Categoría</label>
                        <select 
                            value={categoryFilter} 
                            onChange={e => setCategoryFilter(e.target.value)} 
                            className="w-full border border-slate-300 rounded-lg px-4 py-2"
                        >
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                
                <button 
                    onClick={() => {
                        setFreeTitle(""); setFreeUrl(""); setFreeSummary(""); setFreePopulation(""); setFreeCif(""); setPerla(""); setLimitaciones("");
                        setIsAddingFree(true);
                    }} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-colors"
                >
                    + Aportar Artículo Libre
                </button>
            </div>

            {/* Lista de Artículos */}
            <div className="space-y-8">
                {filteredArticles.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">📚</div>
                        <p className="text-gray-400 font-medium">No se encontraron artículos con esos filtros.</p>
                        <p className="text-gray-300 text-sm mt-1">Intenta con otra búsqueda o aporta el primer artículo.</p>
                    </div>
                ) : (
                    filteredArticles.map(article => {
                        const approvedContribs = article.contributions.filter(c => c.status === 'APPROVED');
                        const allContribs = article.contributions;
                        if (approvedContribs.length === 0 && currentUserRole !== 'DOCENTE') return null;

                        const categoryColors: Record<string, string> = {
                            'Clínica': 'from-emerald-600 to-teal-700',
                            'Biomecánica': 'from-blue-600 to-cyan-700',
                            'Fisiología': 'from-violet-600 to-purple-700',
                            'Entrenamiento': 'from-orange-500 to-red-600',
                            'Anatomía': 'from-pink-600 to-rose-700',
                            'Otro': 'from-slate-600 to-gray-700'
                        };
                        const gradientClass = categoryColors[article.category] || categoryColors['Otro'];

                        return (
                            <div key={article.id} className="rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
                                {/* Header Gradient */}
                                <div className={`bg-gradient-to-r ${gradientClass} p-6 text-white relative`}>
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="relative z-10">
                                        {/* Tags Row */}
                                        <div className="flex flex-wrap gap-1.5 mb-3">
                                            <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-bold">{article.category}</span>
                                            <span className="bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-semibold">👥 {article.population}</span>
                                            <span className="bg-white/15 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-xs font-semibold">🏥 {article.cif}</span>
                                            {article.tags.map(t => <span key={t} className="bg-white/10 px-2 py-0.5 rounded-full text-xs">{t}</span>)}
                                            {currentUserRole === 'DOCENTE' && (
                                                <button onClick={() => setAddingTagsTo(article.id!)} className="bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full text-xs transition-colors">+ Tag</button>
                                            )}
                                        </div>
                                        
                                        {addingTagsTo === article.id && (
                                            <div className="mb-3 flex gap-2">
                                                <input value={newTagStr} onChange={e => setNewTagStr(e.target.value)} placeholder="Ej: FNP, Cuádriceps (separados por coma)" className="flex-1 bg-white/15 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/50 outline-none" autoFocus />
                                                <button onClick={() => handleAddTags(article)} disabled={isSubmitting} className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50 transition-colors">Guardar</button>
                                                <button onClick={() => setAddingTagsTo(null)} className="text-white/60 hover:text-white px-2 text-sm">✕</button>
                                            </div>
                                        )}
                                        
                                        <h3 className="text-xl font-black leading-tight mb-2">{article.title}</h3>
                                        <div className="flex items-center gap-4 text-sm text-white/70">
                                            <span className="flex items-center gap-1">✏️ {article.createdBy}</span>
                                            <span className="flex items-center gap-1">💬 {approvedContribs.length} aporte{approvedContribs.length !== 1 ? 's' : ''}</span>
                                            {article.url && (
                                                <a href={article.url} target="_blank" rel="noreferrer" className="text-white/90 hover:text-white flex items-center gap-1 underline underline-offset-2">🔗 Ver documento</a>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Body */}
                                <div className="bg-white p-6">
                                    {/* Summary Section */}
                                    <div className="mb-6">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1 h-5 bg-gradient-to-b from-gray-400 to-gray-200 rounded-full"></div>
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest">Resumen del Estudio</h4>
                                        </div>
                                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap pl-3 border-l-2 border-gray-100">{article.summary}</p>
                                    </div>

                                    {/* Contributions */}
                                    {approvedContribs.length > 0 && (
                                        <div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-1 h-5 bg-gradient-to-b from-emerald-500 to-emerald-200 rounded-full"></div>
                                                <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest">Perlas Clínicas y Aplicaciones</h4>
                                            </div>
                                            <div className="space-y-4">
                                                {approvedContribs.map(c => (
                                                    <div key={c.id} className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 relative overflow-hidden">
                                                        <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-100/50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                                                        <div className="relative z-10">
                                                            <div className="flex justify-between items-start mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-black">{(c.studentName || '?').charAt(0).toUpperCase()}</div>
                                                                    <div>
                                                                        <span className="font-bold text-emerald-900 text-sm">{c.studentName}</span>
                                                                        <div className="text-[10px] text-emerald-600">{new Date(c.createdAt).toLocaleDateString()}</div>
                                                                    </div>
                                                                </div>
                                                                {c.nota && <div className="bg-white px-3 py-1.5 rounded-xl text-sm font-black text-emerald-700 border border-emerald-200 shadow-sm">{c.nota.toFixed(1)}</div>}
                                                            </div>
                                                            <div className="mb-3">
                                                                <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">💎 APLICACIÓN PRÁCTICA</div>
                                                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{c.perlaClinica}</p>
                                                            </div>
                                                            {c.limitaciones && (
                                                                <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg mt-3">
                                                                    <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">⚠️ LIMITACIONES</div>
                                                                    <p className="text-xs text-gray-700 leading-relaxed">{c.limitaciones}</p>
                                                                </div>
                                                            )}
                                                            {c.feedbackDocente && (
                                                                <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg mt-3">
                                                                    <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">🎓 FEEDBACK DOCENTE</div>
                                                                    <p className="text-xs text-gray-700 leading-relaxed italic">{c.feedbackDocente}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {currentUserRole === 'INTERNO' && !article.contributions.some(c => c.studentId === currentUserId) && (
                                        <button onClick={() => setAddingToArticle(article)} className="mt-5 w-full bg-gradient-to-r from-slate-100 to-gray-100 hover:from-slate-200 hover:to-gray-200 text-slate-700 font-bold py-3 rounded-xl text-sm transition-all border border-slate-200 shadow-sm">
                                            + Añadir mi propio análisis / perla clínica
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ADD PERLA MODAL */}
            {addingToArticle && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="bg-slate-900 p-4 sticky top-0 flex justify-between items-center text-white z-10">
                            <h3 className="font-bold">Añadir Análisis a Artículo Existente</h3>
                            <button onClick={() => setAddingToArticle(null)} className="text-slate-400 hover:text-white">✕ Cancelar</button>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
                                Estás añadiendo un aporte a: <strong>{addingToArticle.title}</strong>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                                <label className="block text-sm font-bold mb-1 text-emerald-800">💎 Aplicación Práctica (La Perla Clínica)</label>
                                <p className="text-xs text-emerald-600 mb-2">¿Cómo aplicarías esta información con tus usuarios/pacientes en la práctica real?</p>
                                <textarea value={perla} onChange={e => setPerla(e.target.value)} rows={4} className="w-full border border-emerald-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-emerald-400 outline-none" placeholder="Mañana en el Polideportivo yo usaría esto para..." />
                            </div>

                            <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl">
                                <label className="block text-sm font-bold mb-1 text-orange-800">⚠️ Limitaciones / Cuidados</label>
                                <textarea value={limitaciones} onChange={e => setLimitaciones(e.target.value)} rows={3} className="w-full border border-orange-300 rounded-lg px-3 py-2 resize-none focus:ring-2 focus:ring-orange-400 outline-none" placeholder="El estudio fue en sedentarios, así que ojo con..." />
                            </div>

                            <button onClick={submitContribution} disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 text-lg">
                                Enviar Aporte para Revisión →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD FREE ARTICLE MODAL */}
            {isAddingFree && (() => {
                const freeCfg = CATEGORY_CONFIGS[freeCategory];
                const colorMap: Record<string, string> = {
                    emerald: 'from-emerald-600 to-teal-700', blue: 'from-blue-600 to-cyan-700',
                    violet: 'from-violet-600 to-purple-700', orange: 'from-orange-500 to-red-600',
                    pink: 'from-pink-600 to-rose-700', slate: 'from-slate-600 to-gray-700'
                };
                return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className={`bg-gradient-to-r ${colorMap[freeCfg.color] || colorMap.slate} p-5 sticky top-0 z-10`}>
                            <div className="flex justify-between items-start text-white">
                                <div>
                                    <h3 className="font-black text-lg">Aportar Nuevo Artículo a la Biblioteca</h3>
                                    <p className="text-white/70 text-sm">{freeCfg.icon} {freeCfg.label}</p>
                                </div>
                                <button onClick={() => setIsAddingFree(false)} className="text-white/60 hover:text-white text-lg font-bold">✕</button>
                            </div>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Category selector */}
                            <div>
                                <label className="block text-sm font-black text-gray-700 mb-2">1️⃣ ¿De qué tipo es este artículo?</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {(Object.keys(CATEGORY_CONFIGS) as ArticleCategory[]).map(cat => {
                                        const c = CATEGORY_CONFIGS[cat];
                                        const isActive = freeCategory === cat;
                                        return (
                                            <button key={cat} type="button" onClick={() => setFreeCategory(cat)}
                                                className={`p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'border-indigo-500 bg-indigo-50 shadow-md' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                                                <div className="text-lg">{c.icon}</div>
                                                <div className={`text-xs font-bold mt-1 ${isActive ? 'text-indigo-800' : 'text-gray-600'}`}>{c.label}</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Title & URL */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Título del Artículo / Tema *</label>
                                    <input value={freeTitle} onChange={e => setFreeTitle(e.target.value)} placeholder="Ej: Effectiveness of heavy slow resistance training..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Enlace al Artículo (Opcional)</label>
                                    <input value={freeUrl} onChange={e => setFreeUrl(e.target.value)} placeholder="https://..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                            </div>

                            {/* Adaptive Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">{freeCfg.contextLabel} *</label>
                                    <p className="text-[10px] text-gray-400 mb-1">{freeCfg.contextHelp}</p>
                                    <input value={freeCif} onChange={e => setFreeCif(e.target.value)} placeholder={freeCfg.contextPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Población / Deporte *</label>
                                    <input value={freePopulation} onChange={e => setFreePopulation(e.target.value)} placeholder="Ej: Corredores, Población General..." className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                            </div>

                            {/* Adaptive Content Fields */}
                            <div className="space-y-4">
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">{freeCfg.findingLabel} *</label>
                                    <p className="text-[10px] text-gray-400 mb-2">{freeCfg.findingHelp}</p>
                                    <textarea value={freeFinding} onChange={e => setFreeFinding(e.target.value)} rows={3} placeholder={freeCfg.findingPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                                <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
                                    <label className="block text-xs font-bold text-gray-600 mb-1">{freeCfg.methodLabel}</label>
                                    <textarea value={freeMethodology} onChange={e => setFreeMethodology(e.target.value)} rows={3} placeholder={freeCfg.methodPlaceholder} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Resumen Libre (Opcional)</label>
                                    <textarea value={freeSummary} onChange={e => setFreeSummary(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-indigo-400 outline-none" placeholder="Notas adicionales..." />
                                </div>
                            </div>

                            {/* Perla */}
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 p-5 rounded-xl">
                                <label className="block text-sm font-black text-emerald-800 mb-1">💎 {freeCfg.perlaPrompt}</label>
                                <textarea value={perla} onChange={e => setPerla(e.target.value)} rows={4} placeholder={freeCfg.perlaPlaceholder} className="w-full border border-emerald-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-emerald-400 outline-none bg-white/80" />
                            </div>

                            {/* Limitations */}
                            <div className="bg-orange-50 border border-orange-200 p-5 rounded-xl">
                                <label className="block text-sm font-bold text-orange-800 mb-1">⚠️ {freeCfg.limitPrompt}</label>
                                <textarea value={limitaciones} onChange={e => setLimitaciones(e.target.value)} rows={3} placeholder={freeCfg.limitPlaceholder} className="w-full border border-orange-300 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-400 outline-none bg-white/80" />
                            </div>

                            <button onClick={submitFreeArticle} disabled={isSubmitting} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 text-base">
                                {isSubmitting ? 'Enviando...' : 'Enviar Aporte →'}
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}

        </div>
    );
}
