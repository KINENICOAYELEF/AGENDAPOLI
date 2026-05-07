"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getIntentosEstudiante } from '@/services/simuladorFirebase';
import type { SimuladorIntento } from '@/services/simuladorFirebase';

const SCORECARD_LABELS: Record<string, string> = {
    entrevista: 'Entrevista',
    razonamiento_previo: 'Razonamiento I',
    razonamiento_integrador: 'Razonamiento II',
    examen_fisico: 'Examen Físico',
    intervencion_paciente: 'Intervención',
    diagnostico: 'Diagnóstico',
    objetivos: 'Objetivos',
    plan_fases: 'Plan por Fases',
    reevaluacion: 'Reevaluación',
    // Legacy
    intervencion: 'Intervención (legado)',
};

function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

function getNivelColor(nivel: string) {
    if (nivel?.includes('Distinción')) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (nivel === 'Aprobado') return 'text-blue-700 bg-blue-50 border-blue-200';
    if (nivel?.includes('Recuperable')) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-red-700 bg-red-50 border-red-200';
}

export function SimuladorHistorial({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const [intentos, setIntentos] = useState<SimuladorIntento[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.uid) return;
        getIntentosEstudiante(user.uid, 30)
            .then(setIntentos)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user?.uid]);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">📊 Mi Historial de Simulaciones</h2>
                <button onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700 font-semibold">✕ Cerrar</button>
            </div>

            {loading && <p className="text-sm text-slate-400 py-4 text-center">Cargando historial...</p>}

            {!loading && intentos.length === 0 && (
                <p className="text-sm text-slate-400 py-8 text-center">Aún no tienes simulaciones completadas.</p>
            )}

            {!loading && intentos.length > 0 && (
                <div className="space-y-2">
                    {intentos.map((int) => {
                        const fecha = int.fecha?.toDate ? int.fecha.toDate() : new Date();
                        const isExpanded = expandedId === int.id;
                        const notaFinal = int.notaComision
                            ? (int.notaChilena * 0.7 + int.notaComision * 0.3).toFixed(1)
                            : int.notaChilena?.toFixed(1);

                        return (
                            <div key={int.id} className="border border-slate-200 rounded-xl overflow-hidden">
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : (int.id || null))}
                                    className="w-full text-left p-4 hover:bg-slate-50 transition-all flex items-center gap-4"
                                >
                                    <div className={`text-2xl font-black ${Number(notaFinal) >= 4.0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {notaFinal}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-sm text-slate-800 truncate">{int.pacienteNombre || 'Caso'}</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getNivelColor(int.nivel)}`}>{int.nivel}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            {fecha.toLocaleDateString('es-CL')} · {int.area || 'Aleatoria'} · ⏱ {formatTime(int.tiempoSegundos || 0)}
                                            {int.practiceMode && int.practiceMode !== 'completo' && (
                                                <span className="ml-1 text-amber-600 font-semibold">· Práctica: {int.practiceMode}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-slate-400 text-lg">{isExpanded ? '▲' : '▼'}</span>
                                </button>
                                {isExpanded && int.scorecard && (
                                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 bg-slate-50/50">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3">
                                            {Object.entries(int.scorecard).map(([k, v]) => (
                                                <div key={k} className="bg-white rounded-lg p-2 border border-slate-200">
                                                    <div className="text-[10px] text-slate-500 font-semibold">{SCORECARD_LABELS[k] || k}</div>
                                                    <div className={`text-lg font-black ${(v as any).puntaje >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                        {(v as any).puntaje}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className="bg-white rounded-lg p-2 border border-slate-200">
                                                <span className="text-slate-500">Evaluación:</span> <strong>{int.notaChilena?.toFixed(1)}</strong>
                                            </div>
                                            <div className="bg-white rounded-lg p-2 border border-slate-200">
                                                <span className="text-slate-500">Comisión:</span> <strong>{int.notaComision?.toFixed(1) || 'N/A'}</strong>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
