"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getTareaConfig, verificarCumplimiento } from '@/services/simuladorFirebase';
import type { CumplimientoResult } from '@/services/simuladorFirebase';
import { useRouter } from 'next/navigation';

/**
 * SimuladorAlertaModal
 * 
 * This modal appears on every page when the student has not met
 * the simulation frequency requirement. It cannot be permanently dismissed —
 * it will reappear on the next session. The student can only "snooze" it for
 * the current session (it won't show again until they refresh/relogin).
 */
export function SimuladorAlertaModal() {
    const { user } = useAuth();
    const router = useRouter();
    const [show, setShow] = useState(false);
    const [resultado, setResultado] = useState<CumplimientoResult | null>(null);
    const [config, setConfig] = useState<{ frecuenciaDias: number; mensaje?: string } | null>(null);
    const [dismissed, setDismissed] = useState(false); // Only for current session

    useEffect(() => {
        if (!user?.uid || user?.role === 'DOCENTE') return;

        const sessionKey = `sim_alert_dismissed_${user.uid}`;
        // If user already dismissed in this browser session, don't show again
        if (sessionStorage.getItem(sessionKey)) return;

        getTareaConfig().then(async (cfg) => {
            if (!cfg || !cfg.activa) return;
            setConfig({ frecuenciaDias: cfg.frecuenciaDias, mensaje: cfg.mensaje });
            const res = await verificarCumplimiento(user.uid, cfg);
            if (!res.cumple) {
                setResultado(res);
                setShow(true);
            }
        }).catch(console.error);
    }, [user?.uid, user?.role]);

    const handleGoSimulator = () => {
        setShow(false);
        router.push('/app/simulador');
    };

    const handleDismiss = () => {
        // Save dismissal in sessionStorage (cleared when browser closes)
        if (user?.uid) {
            sessionStorage.setItem(`sim_alert_dismissed_${user.uid}`, '1');
        }
        setDismissed(true);
        setShow(false);
    };

    if (!show || dismissed) return null;

    const diasVencido = resultado?.diasDesdeUltimo !== undefined && resultado.diasDesdeUltimo < 999
        ? resultado.diasDesdeUltimo
        : null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-red-600 to-orange-600 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="text-4xl animate-bounce">⚠️</div>
                        <div>
                            <h2 className="text-white font-black text-lg">TAREA PENDIENTE</h2>
                            <p className="text-red-100 text-sm">Simulador de Examen Clínico</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    {/* Main message from docente */}
                    {config?.mensaje && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <p className="text-sm text-amber-800 font-medium">📋 {config.mensaje}</p>
                        </div>
                    )}

                    {/* Status */}
                    <div className="space-y-2">
                        <p className="text-slate-700 text-sm font-semibold">Estado de tu tarea:</p>
                        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                            <p className="text-sm text-red-800">{resultado?.descripcion}</p>
                        </div>

                        {diasVencido !== null && (
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 bg-slate-100 rounded-full px-4 py-1.5">
                                    <span className="text-xs text-slate-500">Requerimiento:</span>
                                    <span className="text-xs font-bold text-slate-800">
                                        1 simulación cada {config?.frecuenciaDias} días
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Impact note */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500 leading-relaxed">
                        💡 <strong>Recuerda:</strong> Completar las simulaciones a tiempo te permite ir preparado para el examen real. Si acumulas varias en un día, cuentan como créditos para los días siguientes.
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 flex flex-col gap-2">
                    <button
                        onClick={handleGoSimulator}
                        className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-200 text-sm"
                    >
                        🎓 Ir al Simulador Ahora
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
