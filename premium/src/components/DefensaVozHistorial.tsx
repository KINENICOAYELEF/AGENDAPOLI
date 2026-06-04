"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getVoiceDefenses, DefensaVozIntento } from '@/services/simuladorFirebase';

export function DefensaVozHistorial({ onClose }: { onClose: () => void }) {
    const { user } = useAuth();
    const [history, setHistory] = useState<DefensaVozIntento[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAttempt, setSelectedAttempt] = useState<DefensaVozIntento | null>(null);

    useEffect(() => {
        if (!user) return;
        const load = async () => {
            // DOCENTE can see all history, normal user sees only their own
            const userId = user.role === 'DOCENTE' ? undefined : user.uid;
            const data = await getVoiceDefenses(userId);
            setHistory(data);
            setLoading(false);
        };
        load();
    }, [user]);

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">🗣️ Historial de Defensas de Voz</h2>
                        <p className="text-sm text-slate-500">
                            {user?.role === 'DOCENTE' ? 'Viendo intentos de todos los estudiantes' : 'Tus intentos previos'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-semibold transition">
                        Cerrar Historial
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    
                    {/* List */}
                    <div className="w-1/3 border-r border-slate-100 overflow-y-auto bg-slate-50/50 p-4 space-y-3">
                        {loading && <p className="text-sm text-slate-400 text-center py-4">Cargando historial...</p>}
                        {!loading && history.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Aún no hay defensas registradas.</p>}
                        
                        {history.map(attempt => (
                            <button
                                key={attempt.id}
                                onClick={() => setSelectedAttempt(attempt)}
                                className={`w-full text-left p-4 rounded-xl border transition-all ${selectedAttempt?.id === attempt.id ? 'bg-rose-50 border-rose-200 ring-2 ring-rose-200/50 shadow-sm' : 'bg-white border-slate-200 hover:border-rose-300 hover:shadow-sm'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-slate-500">{attempt.fecha?.toDate().toLocaleDateString()}</span>
                                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${attempt.notaChilena >= 4.0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        Nota: {attempt.notaChilena?.toFixed(1)}
                                    </span>
                                </div>
                                <h3 className="font-bold text-slate-800 text-sm truncate">{attempt.pacienteNombre} - {attempt.motivoConsulta}</h3>
                                <div className="mt-2 text-xs text-slate-500 flex justify-between">
                                    <span>{user?.role === 'DOCENTE' ? attempt.userName : attempt.area}</span>
                                    <span>⏱️ {Math.floor(attempt.tiempoSegundos / 60)}:{(attempt.tiempoSegundos % 60).toString().padStart(2, '0')}</span>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Detail Panel */}
                    <div className="w-2/3 overflow-y-auto p-6 bg-white">
                        {selectedAttempt ? (
                            <div className="space-y-8 animate-fade-in pb-12">
                                
                                {/* Resumen del Paciente */}
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 mb-2 border-b pb-2">📋 Datos Clínicos</h3>
                                    <div className="grid grid-cols-2 gap-4 text-sm mt-3">
                                        <p><span className="font-semibold text-slate-500">Paciente:</span> {selectedAttempt.pacienteNombre}</p>
                                        <p><span className="font-semibold text-slate-500">Motivo:</span> {selectedAttempt.motivoConsulta}</p>
                                        <p><span className="font-semibold text-slate-500">Área:</span> {selectedAttempt.area} ({selectedAttempt.dificultad})</p>
                                        <p><span className="font-semibold text-slate-500">Estudiante:</span> {selectedAttempt.userName}</p>
                                    </div>
                                </div>

                                {/* Construcción */}
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 mb-2 border-b pb-2">📝 Propuesta Escrita</h3>
                                    <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-4">
                                        <div>
                                            <span className="font-bold text-indigo-700">Diagnóstico:</span>
                                            <p className="mt-1 text-slate-700">{selectedAttempt.construccion?.diagnostico}</p>
                                        </div>
                                        <div>
                                            <span className="font-bold text-indigo-700">Objetivo General:</span>
                                            <p className="mt-1 text-slate-700">{selectedAttempt.construccion?.objetivo_general}</p>
                                        </div>
                                        <div>
                                            <span className="font-bold text-indigo-700">Plan de Fases:</span>
                                            <p className="mt-1 text-slate-700 whitespace-pre-wrap">{selectedAttempt.construccion?.plan_fases}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Resultados y Rúbrica */}
                                <div>
                                    <h3 className="text-lg font-black text-slate-800 mb-2 border-b pb-2">🎯 Desempeño y Rúbrica</h3>
                                    <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-xl mb-6">
                                        <div className="flex justify-between items-center mb-4">
                                            <span className="font-bold text-indigo-900">Nota Final</span>
                                            <span className={`text-2xl font-black px-4 py-1 rounded-lg ${selectedAttempt.notaChilena >= 4.0 ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                                                {selectedAttempt.notaChilena?.toFixed(1)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-indigo-900/80">{selectedAttempt.feedbackFinal}</p>
                                    </div>

                                    {selectedAttempt.aciertos?.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-bold text-emerald-700 mb-2 text-sm">✅ Aciertos</h4>
                                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                                {selectedAttempt.aciertos.map((a, i) => <li key={i}>{a}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {selectedAttempt.errores?.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-bold text-rose-700 mb-2 text-sm">❌ Errores Críticos</h4>
                                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                                {selectedAttempt.errores.map((e, i) => <li key={i}>{e}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {selectedAttempt.temasAEstudiar?.length > 0 && (
                                        <div className="mb-4">
                                            <h4 className="font-bold text-amber-700 mb-2 text-sm">📖 Temas que debe Repasar</h4>
                                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                                {selectedAttempt.temasAEstudiar.map((t, i) => <li key={i}>{t}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Transcripción (The "Ver Absolutamente todo") */}
                                {selectedAttempt.transcripcion && (
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 mb-2 border-b pb-2 flex justify-between items-center">
                                            <span>🎤 Transcripción de la Llamada</span>
                                            <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded">Raw Audio Data</span>
                                        </h3>
                                        <div className="bg-slate-900 text-slate-300 p-4 rounded-xl font-mono text-xs overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed">
                                            {selectedAttempt.transcripcion}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <span className="text-4xl mb-3 opacity-50">📂</span>
                                <p>Selecciona un intento del panel izquierdo para ver "absolutamente todo".</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
