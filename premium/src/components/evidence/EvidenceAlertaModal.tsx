"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getStudentTasks } from '@/services/evidence';
import { useRouter } from 'next/navigation';

export function EvidenceAlertaModal() {
    const { user } = useAuth();
    const router = useRouter();
    const [overdueTaskCount, setOverdueTaskCount] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (!user?.uid || user?.role !== 'INTERNO') return;

        const sessionKey = `evidence_alert_dismissed_${user.uid}`;
        if (sessionStorage.getItem(sessionKey)) return;

        getStudentTasks(user.uid).then(tasks => {
            const overdue = tasks.filter(t => t.status === 'PENDING' && t.dueDate < Date.now());
            if (overdue.length > 0) {
                setOverdueTaskCount(overdue.length);
            }
        }).catch(console.error);
    }, [user?.uid, user?.role]);

    const handleGoToTasks = () => {
        setOverdueTaskCount(0);
        router.push('/app/evidencia');
    };

    const handleDismiss = () => {
        if (user?.uid) sessionStorage.setItem(`evidence_alert_dismissed_${user.uid}`, '1');
        setDismissed(true);
    };

    if (overdueTaskCount === 0 || dismissed) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-orange-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl animate-bounce">📚</div>
                        <div>
                            <h2 className="text-white font-black text-lg">LECTURA ATRASADA</h2>
                            <p className="text-orange-100 text-sm">Biblioteca de Evidencia</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div className="space-y-2">
                        <p className="text-slate-700 text-sm font-semibold">Estado de tus tareas:</p>
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <p className="text-sm text-red-800">Tienes <strong>{overdueTaskCount}</strong> análisis de artículos pendientes y la fecha límite ya expiró.</p>
                        </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 leading-relaxed">
                        💡 <strong>Aviso:</strong> Para mantener la plataforma al día, te pedimos completar tu lectura a la brevedad. Tu análisis es clave para la biblioteca colaborativa.
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex flex-col gap-2">
                    <button
                        onClick={handleGoToTasks}
                        className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-black py-3.5 rounded-xl transition-all shadow-lg text-sm"
                    >
                        📝 Ir a Completar Mis Tareas
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="w-full text-slate-400 hover:text-slate-600 text-xs py-2 transition-colors"
                    >
                        Cerrar por ahora (volverá a aparecer)
                    </button>
                </div>
            </div>
        </div>
    );
}
