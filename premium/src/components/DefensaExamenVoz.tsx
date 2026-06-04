"use client";

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { generateCommissionPrompt } from '@/utils/patientPrompts';
import type { SimCaseType } from '@/lib/ai/simuladorSchemas';

// ─── Types ───
type SimPhase = 'SETUP' | 'CONSTRUCTION' | 'COMMISSION_VOICE' | 'RESULTS';

// ─── API helper ───
async function simFetch(action: string, payload: unknown, userId: string) {
    const res = await fetch('/api/ai/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error en llamada al simulador');
    return data.data;
}

export function DefensaExamenVoz() {
    const { user } = useAuth();
    const [phase, setPhase] = useState<SimPhase>('SETUP');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // AI Data
    const [caseData, setCaseData] = useState<SimCaseType | null>(null);
    const [evaluationData, setEvaluationData] = useState<any | null>(null);

    // Student Work
    const [setupForm, setSetupForm] = useState({ tipo: 'aleatorio', area: '', dificultad: 'avanzado', descripcion: '' });
    const [construction, setConstruction] = useState({ problema_principal: '', diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });

    // Voice connection for Commission
    const { connect, disconnect, connectionState, isMicOpen, toggleMic, isSpeaking, volume, transcript } = useGeminiLive({
        systemInstruction: caseData ? generateCommissionPrompt(
            caseData.ficha_visible,
            caseData.perfil_secreto,
            caseData.hallazgos_todos_modulos,
            construction
        ) : '',
        voiceName: 'Orion' // Serious professor voice
    });

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleGenerate = async () => {
        if (!user) return;
        setLoading(true); setError('');
        try {
            const data = await simFetch('generate', setupForm, user.uid);
            setCaseData(data);
            setPhase('CONSTRUCTION');
            setTimer(0);
            timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleStartCommission = () => {
        if (!construction.diagnostico.trim() || !construction.objetivo_general.trim()) {
            setError('Debes completar al menos el diagnóstico y objetivo general.');
            return;
        }
        setError('');
        setPhase('COMMISSION_VOICE');
    };

    const handleEndDefense = async () => {
        if (!user || !caseData) return;
        disconnect(); // end call
        if (timerRef.current) clearInterval(timerRef.current);
        
        setLoading(true); setError('');
        try {
            const transcriptText = transcript.map(t => `${t.role === 'user' ? 'ESTUDIANTE' : 'COMISIÓN'}: ${t.text}`).join('\n');
            const data = await simFetch('evaluate-defense', {
                caso_resumen: { ficha: caseData.ficha_visible, hallazgos: caseData.hallazgos_todos_modulos },
                construccion: construction,
                transcripcion_defensa: transcriptText
            }, user.uid);
            
            setEvaluationData(data);
            setPhase('RESULTS');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        disconnect();
        setPhase('SETUP'); setCaseData(null); setEvaluationData(null);
        setTimer(0); setError('');
        setConstruction({ problema_principal: '', diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900">🎤 Simulador de Defensa de Grado</h1>
                    <p className="text-gray-500 text-sm mt-1">Practica tu razonamiento oral frente a la comisión (Voz)</p>
                </div>
                {phase !== 'SETUP' && (
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 text-white font-mono px-4 py-2 rounded-xl text-lg shadow">{formatTime(timer)}</div>
                        <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 font-bold">Abandonar</button>
                    </div>
                )}
            </div>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}

            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                        <p className="text-slate-500 font-medium text-sm animate-pulse">Procesando con IA...</p>
                    </div>
                </div>
            )}

            {/* SETUP */}
            {phase === 'SETUP' && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                    <h2 className="text-lg font-bold text-slate-800">Generar Caso Clínico (Resuelto)</h2>
                    <p className="text-sm text-slate-500">Recibirás un caso con la historia completa y el examen físico ya realizado. Tu deber será formular el plan y defenderlo oralmente.</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Área corporal principal</label>
                            <select value={setupForm.area} onChange={e => setSetupForm(p => ({ ...p, area: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                <option value="">Aleatoria</option>
                                <option value="columna_cervical">Columna Cervical</option>
                                <option value="hombro">Hombro</option>
                                <option value="codo">Codo</option>
                                <option value="muneca_mano">Muñeca / Mano</option>
                                <option value="columna_toracica">Columna Torácica</option>
                                <option value="columna_lumbar">Columna Lumbar</option>
                                <option value="cadera_pelvis">Cadera / Pelvis</option>
                                <option value="rodilla">Rodilla</option>
                                <option value="tobillo_pie">Tobillo / Pie</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Nivel de Exigencia</label>
                            <select value={setupForm.dificultad} onChange={e => setSetupForm(p => ({ ...p, dificultad: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                <option value="avanzado">Examen de Grado (Complejo, comorbilidades)</option>
                                <option value="intermedio">Pre-clínica (Enfocado en 1 sola articulación)</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Temática Específica (Opcional)</label>
                            <input type="text" value={setupForm.descripcion} onChange={e => setSetupForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Deportista de fin de semana con lesión de LCA, o Adulto mayor con artrosis de rodilla..." className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none" />
                            <p className="text-xs text-slate-400 mt-1">Si dejas esto en blanco, la IA inventará la historia clínica basada en el área y la dificultad.</p>
                        </div>
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all">
                        📄 Recibir Caso Resuelto
                    </button>
                </div>
            )}

            {/* CASE CONTEXT (Visible in Construction & Commission) */}
            {caseData && phase !== 'RESULTS' && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-4 space-y-4 text-sm">
                    <h3 className="font-bold text-blue-900 text-lg">📋 Ficha Clínica del Paciente</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <p><strong>Nombre:</strong> {caseData.ficha_visible.nombre} ({caseData.ficha_visible.edad})</p>
                            <p><strong>Ocupación/Deporte:</strong> {caseData.ficha_visible.ocupacion} / {caseData.ficha_visible.deporte_actividad}</p>
                            <p><strong>Motivo de consulta:</strong> {caseData.ficha_visible.motivo_consulta}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-700">
                                <strong>Anamnesis Próxima:</strong> {caseData.perfil_secreto.historia_completa}<br />
                                <strong>Anamnesis Remota:</strong> {caseData.perfil_secreto.antecedentes_relevantes?.join(', ') || 'Ninguno'}
                            </p>
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold text-blue-800 mt-2">🔍 Hallazgos del Examen Físico:</h4>
                        <ul className="list-disc list-inside text-blue-900">
                            {Object.entries(caseData.hallazgos_todos_modulos).map(([k, v]) => (
                                v && v !== 'Normal' ? <li key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {v as string}</li> : null
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* CONSTRUCTION */}
            {phase === 'CONSTRUCTION' && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <h3 className="font-bold text-slate-800 text-xl">🏗️ Construcción Clínica</h3>
                    <p className="text-sm text-slate-500">En base al caso clínico superior, redacta tu propuesta. Una vez listo, pasarás a la defensa oral.</p>
                    
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                        <label className="block text-sm font-bold text-amber-900 mb-1">Problema Kinesiológico Principal</label>
                        <p className="text-xs text-amber-700 mb-2">💡 El problema principal NO es solo "dolor". Es la disfunción o limitación clave que impide al paciente realizar su actividad. Ej: <em>Incapacidad para lanzar el balón por debilidad glútea y dolor</em>.</p>
                        <textarea value={construction.problema_principal} onChange={e => setConstruction(c => ({...c, problema_principal: e.target.value}))} rows={2} className="w-full border-amber-200 focus:border-amber-400 focus:ring-amber-400 rounded-lg px-3 py-2 text-sm" placeholder="Escribe el problema principal aquí..." />
                    </div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Diagnóstico Kinesiológico (CIF)</label><textarea value={construction.diagnostico} onChange={e => setConstruction(c => ({...c, diagnostico: e.target.value}))} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Diagnóstico detallado basado en CIF..." /></div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Objetivo General</label><textarea value={construction.objetivo_general} onChange={e => setConstruction(c => ({...c, objetivo_general: e.target.value}))} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Objetivos Específicos</label><textarea value={construction.objetivos_especificos} onChange={e => setConstruction(c => ({...c, objetivos_especificos: e.target.value}))} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Objetivos Operacionales</label><textarea value={construction.objetivos_operacionales} onChange={e => setConstruction(c => ({...c, objetivos_operacionales: e.target.value}))} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Plan de Fases de Intervención</label><textarea value={construction.plan_fases} onChange={e => setConstruction(c => ({...c, plan_fases: e.target.value}))} rows={3} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="block text-sm font-semibold text-slate-600 mb-1">Reevaluación y Pronóstico</label><textarea value={construction.reevaluacion} onChange={e => setConstruction(c => ({...c, reevaluacion: e.target.value}))} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" /></div>
                    
                    <button onClick={handleStartCommission} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-md text-lg mt-4">
                        Ir a Defensa Oral de Comisión →
                    </button>
                </div>
            )}

            {/* COMMISSION VOICE */}
            {phase === 'COMMISSION_VOICE' && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-xl">🎤 Comisión de Defensa</h3>
                        <div className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-sm">Responde 10 preguntas</div>
                    </div>

                    {connectionState === 'disconnected' && (
                        <button onClick={connect} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg">
                            Iniciar Defensa (Conectar Micrófono)
                        </button>
                    )}
                    {connectionState === 'connecting' && (
                        <div className="w-full bg-blue-100 text-blue-700 font-bold py-4 rounded-xl text-center">
                            Conectando con la Comisión Evaluadora...
                        </div>
                    )}
                    {connectionState === 'error' && (
                        <div className="w-full bg-red-100 text-red-700 font-bold py-4 rounded-xl text-center">
                            Error de conexión o fallo de red. Por favor, reintenta.
                            <button onClick={connect} className="ml-4 underline hover:text-red-900">Reintentar</button>
                        </div>
                    )}
                    {connectionState === 'connected' && (
                        <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-slate-200 relative overflow-hidden">
                                <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeaking ? 'bg-amber-100 shadow-[0_0_40px_rgba(251,191,36,0.6)] scale-110' : 'bg-slate-200'} ${volume > 0.05 ? 'scale-[1.05]' : ''}`}>
                                    <div className={`w-24 h-24 rounded-full transition-all duration-100 ${isSpeaking ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'} ${volume > 0.1 ? 'scale-[1.1]' : ''}`} />
                                </div>
                                <p className="mt-6 font-bold text-slate-600">
                                    {isSpeaking ? 'El Profesor está hablando...' : 'Escuchando tu defensa...'}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={toggleMic} className={`flex-1 font-bold py-3 rounded-xl transition-all ${isMicOpen ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
                                    {isMicOpen ? '🔇 Mutear Micrófono' : '🔊 Activar Micrófono'}
                                </button>
                                <button onClick={handleEndDefense} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                    Terminar Examen →
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-slate-900 rounded-xl p-4 h-64 overflow-y-auto font-mono text-sm shadow-inner mt-4">
                        {transcript.length === 0 ? (
                            <p className="text-slate-500 italic">La transcripción del examen aparecerá aquí...</p>
                        ) : (
                            transcript.map((t, idx) => (
                                <div key={idx} className={`mb-3 ${t.role === 'user' ? 'text-blue-300' : 'text-amber-300'}`}>
                                    <span className="font-bold opacity-50 select-none">{t.role === 'user' ? 'ALUMNO:' : 'COMISIÓN:'}</span> {t.text}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* RESULTS */}
            {phase === 'RESULTS' && evaluationData && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <div className="text-center pb-6 border-b">
                        <div className="text-5xl mb-4">🏆</div>
                        <h2 className="text-3xl font-black text-slate-900">Resultado Final: {evaluationData.puntaje_global}/100</h2>
                        <p className="text-slate-500 font-medium">Defensa de Grado</p>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-bold text-xl text-slate-800">Feedback de la Comisión</h3>
                        <p className="text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-200">{evaluationData.feedback_final}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                            <h4 className="font-bold text-emerald-800 mb-2">✅ Aciertos</h4>
                            <ul className="list-disc list-inside text-sm text-emerald-700 space-y-1">
                                {evaluationData.aciertos?.map((a: string, i: number) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                            <h4 className="font-bold text-red-800 mb-2">❌ Errores</h4>
                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                {evaluationData.errores?.map((e: string, i: number) => <li key={i}>{e}</li>)}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
