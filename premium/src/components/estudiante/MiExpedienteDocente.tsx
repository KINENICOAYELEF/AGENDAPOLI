"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Award, CheckCircle2, MessageSquare, BookOpen, Clock } from 'lucide-react';

interface ApprovedFeedbackItem {
    id: string;
    lastApprovedFeedback?: string;
    lastApprovedAt?: string;
    feedbackHistory?: {
        date: string;
        text: string;
        section?: string;
    }[];
}

export function MiExpedienteDocente() {
    const { user } = useAuth();
    const [expediente, setExpediente] = useState<ApprovedFeedbackItem | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.uid) return;

        const loadStudentExpediente = async () => {
            setLoading(true);
            try {
                // Leer del expediente privado del alumno (solo lo aprobado por el docente)
                const docRef = doc(db, 'intern_expedientes', user.uid);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setExpediente(docSnap.data() as ApprovedFeedbackItem);
                }
            } catch (e) {
                console.error("Error al cargar expediente del alumno:", e);
            } finally {
                setLoading(false);
            }
        };

        loadStudentExpediente();
    }, [user?.uid]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
                Cargando tu expediente de retroalimentación docente...
            </div>
        );
    }

    if (!expediente || (!expediente.lastApprovedFeedback && (!expediente.feedbackHistory || expediente.feedbackHistory.length === 0))) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-indigo-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">Sin retroalimentación docente registrada aún</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Cuando tu docente de supervisión revise y apruebe observaciones sobre tus fichas clínicas, las verás reflejadas aquí.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-base font-black text-slate-900">Mi Expediente de Retroalimentación Docente</h2>
                </div>
                <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Verificado por Docente
                </span>
            </div>

            {/* Último Feedback Aprobado */}
            {expediente.lastApprovedFeedback && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                            Última Retroalimentación Oficial
                        </span>
                        {expediente.lastApprovedAt && (
                            <span className="text-[10px] text-indigo-500 flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {new Date(expediente.lastApprovedAt).toLocaleDateString('es-CL')}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-800 leading-relaxed font-medium bg-white p-3 rounded-lg border border-indigo-100/80 whitespace-pre-line">
                        "{expediente.lastApprovedFeedback}"
                    </p>
                </div>
            )}

            {/* Historial de Feedback Aprobado */}
            {expediente.feedbackHistory && expediente.feedbackHistory.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Historial de Observaciones Aprobadas</h3>
                    <div className="space-y-2">
                        {expediente.feedbackHistory.map((item, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                    <span>{item.section || 'Supervisión General'}</span>
                                    <span>{new Date(item.date).toLocaleDateString('es-CL')}</span>
                                </div>
                                <p className="text-slate-700 leading-relaxed">{item.text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
