"use client";

import { useState, useEffect } from 'react';
import { Sparkles, CheckCircle2, XCircle, Edit3, MessageSquare, AlertTriangle, Send, RefreshCw, UserCheck, Award, BookOpen, Layers } from 'lucide-react';
import { AgentReview, StudentLearningProfile } from '@/types/agentDataFoundation';
import { collection, getDocs, doc, updateDoc, setDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';

export function BandejaDocenteInteligente() {
    const { user } = useAuth();
    const [reviews, setReviews] = useState<AgentReview[]>([]);
    const [profiles, setProfiles] = useState<Record<string, StudentLearningProfile>>({});
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [editingReview, setEditingReview] = useState<AgentReview | null>(null);
    const [editText, setEditText] = useState('');
    const [isTriggeringRun, setIsTriggeringRun] = useState(false);

    useEffect(() => {
        loadBandejaData();
    }, []);

    const loadBandejaData = async () => {
        setLoading(true);
        try {
            // 1. Cargar revisiones privadas del agente
            const reviewsSnap = await getDocs(collection(db, 'agent_reviews'));
            const revList: AgentReview[] = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AgentReview));
            setReviews(revList.filter(r => r.status === 'PENDIENTE'));

            // 2. Cargar perfiles longitudinales
            const profilesSnap = await getDocs(collection(db, 'student_learning_profiles'));
            const profMap: Record<string, StudentLearningProfile> = {};
            profilesSnap.docs.forEach(d => {
                profMap[d.id] = d.data() as StudentLearningProfile;
            });
            setProfiles(profMap);
        } catch (e) {
            console.error("Error cargando Bandeja Docente:", e);
        } finally {
            setLoading(false);
        }
    };

    // Aprobar Feedback y publicar para el alumno
    const handleApprove = async (review: AgentReview) => {
        if (!review.id) return;
        setProcessingId(review.id);
        try {
            const finalFeedback = editingReview?.id === review.id ? editText : review.feedbackDraft;

            // Actualizar revisión como APROBADA
            await updateDoc(doc(db, 'agent_reviews', review.id), {
                status: 'APROBADO_ENVIADO',
                feedbackDraft: finalFeedback,
                teacherDecision: 'accepted',
                reviewedAt: new Date().toISOString()
            });

            // Guardar borrador aprobado en el expediente del alumno
            await setDoc(doc(db, 'intern_expedientes', review.studentId), {
                studentId: review.studentId,
                lastApprovedFeedback: finalFeedback,
                lastApprovedAt: new Date().toISOString(),
                status: 'APPROVED_BY_TEACHER'
            }, { merge: true });

            // Registrar decisión docente para bucle de aprendizaje
            await setDoc(doc(db, 'teacher_decisions', `${review.id}_decision`), {
                reviewId: review.id,
                originalDraft: review.feedbackDraft,
                finalText: finalFeedback,
                decision: 'accepted',
                createdAt: new Date().toISOString()
            });

            setReviews(prev => prev.filter(r => r.id !== review.id));
            setEditingReview(null);
        } catch (e) {
            console.error("Error al aprobar feedback:", e);
        } finally {
            setProcessingId(null);
        }
    };

    // Descartar Observación
    const handleDiscard = async (review: AgentReview) => {
        if (!review.id) return;
        setProcessingId(review.id);
        try {
            await updateDoc(doc(db, 'agent_reviews', review.id), {
                status: 'DESCARTADO',
                teacherDecision: 'rejected_irrelevant',
                reviewedAt: new Date().toISOString()
            });

            setReviews(prev => prev.filter(r => r.id !== review.id));
        } catch (e) {
            console.error("Error al descartar revisión:", e);
        } finally {
            setProcessingId(null);
        }
    };

    // Disparar revisión manual del Agente Antigravity
    const handleTriggerAgentRun = async () => {
        setIsTriggeringRun(true);
        try {
            await fetch('/api/ai/super-profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'SYNTHESIZE',
                    userId: user?.uid || 'docente_runner',
                    estudianteNombre: 'Revisión Manual Docente'
                })
            });
            await loadBandejaData();
        } catch (e) {
            console.error("Error al ejecutar agente:", e);
        } finally {
            setIsTriggeringRun(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-700">Cargando observaciones docentes del Agente Antigravity...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header y Acción Principal */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/30 p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                        <h2 className="text-lg font-black tracking-tight text-white">Bandeja Docente Autónomo Antigravity</h2>
                    </div>
                    <p className="text-xs text-indigo-200/80 mt-1">
                        Revisiones privadas generadas automáticamente con evidencia exacta. Ningún borrador se envía al alumno sin tu aprobación.
                    </p>
                </div>

                <button
                    onClick={handleTriggerAgentRun}
                    disabled={isTriggeringRun}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shrink-0"
                >
                    <RefreshCw className={`w-4 h-4 ${isTriggeringRun ? 'animate-spin' : ''}`} />
                    <span>{isTriggeringRun ? 'Ejecutando Agente...' : 'Revisar Ahora con IA'}</span>
                </button>
            </div>

            {/* Listado de Observaciones Pendientes */}
            {reviews.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                    <h3 className="text-base font-bold text-slate-900">¡Al día! No hay revisiones pendientes de aprobación</h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Todas las observaciones clínicas han sido revisadas. El agente Antigravity ejecutará el próximo censo nocturno a las 21:30 PM.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-indigo-600" />
                        Observaciones Clínicas Pendientes de Tu Aprobación ({reviews.length})
                    </h3>

                    {reviews.map(review => {
                        const isEditing = editingReview?.id === review.id;
                        return (
                            <div key={review.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition hover:shadow-md">
                                {/* Encabezado de la Tarjeta */}
                                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                                            review.severity === 'ALTA' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                            review.severity === 'MEDIA' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            Severidad {review.severity}
                                        </span>
                                        <span className="text-xs font-bold text-slate-900">Estudiante ID: {review.studentId}</span>
                                        <span className="text-[11px] text-slate-400 font-mono">• Registro: {review.recordType}</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">Confianza IA: {Math.round(review.confidence * 100)}%</span>
                                </div>

                                <div className="p-5 space-y-4">
                                    {/* CITA TEXTUAL EXACTA (Estilo Comentario de Google Docs) */}
                                    {review.sourceReferences && review.sourceReferences.length > 0 && (
                                        <div className="bg-amber-50/70 border-l-4 border-amber-400 p-3 rounded-r-xl space-y-1">
                                            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                                                Cita Textual del Registro del Alumno:
                                            </span>
                                            <p className="text-xs text-amber-950 font-medium italic">
                                                "{review.sourceReferences[0].exactExcerpt}"
                                            </p>
                                        </div>
                                    )}

                                    {/* OBSERVACIÓN Y RAZONAMIENTO DEL AGENTE */}
                                    <div className="space-y-1">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider text-indigo-700">Observación del Agente:</h4>
                                        <p className="text-xs text-slate-800 leading-relaxed font-medium">{review.observation}</p>
                                        <p className="text-[11px] text-slate-500 leading-relaxed"><strong className="text-slate-700">Por qué importa:</strong> {review.whyItMatters}</p>
                                    </div>

                                    {/* BORRADOR DE FEEDBACK PARA EL ESTUDIANTE */}
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                                                Borrador de Feedback Propuesto (Editable antes de enviar)
                                            </span>
                                            {!isEditing && (
                                                <button
                                                    onClick={() => {
                                                        setEditingReview(review);
                                                        setEditText(review.feedbackDraft);
                                                    }}
                                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                                                >
                                                    Editar Texto
                                                </button>
                                            )}
                                        </div>

                                        {isEditing ? (
                                            <div className="space-y-2">
                                                <textarea
                                                    value={editText}
                                                    onChange={e => setEditText(e.target.value)}
                                                    rows={3}
                                                    className="w-full text-xs p-3 rounded-lg border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 bg-white"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => setEditingReview(null)}
                                                        className="text-xs text-slate-500 hover:text-slate-700 font-bold px-2 py-1"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed italic bg-white p-3 rounded-lg border border-slate-200">
                                                "{review.feedbackDraft}"
                                            </p>
                                        )}
                                    </div>

                                    {/* BOTONES DE ACCIÓN DOCENTE (1 CLIC) */}
                                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                                        <button
                                            onClick={() => handleDiscard(review)}
                                            disabled={processingId === review.id}
                                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition flex items-center gap-1.5"
                                        >
                                            <XCircle className="w-4 h-4 text-slate-400" />
                                            <span>Descartar</span>
                                        </button>

                                        <button
                                            onClick={() => handleApprove(review)}
                                            disabled={processingId === review.id}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition flex items-center gap-2 shadow-sm"
                                        >
                                            <Send className="w-3.5 h-3.5" />
                                            <span>Aprobar y Entregar al Alumno</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
