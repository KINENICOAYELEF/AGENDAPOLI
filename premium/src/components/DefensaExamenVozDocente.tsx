"use client";

import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGeminiLive, getAudioDevices } from '@/hooks/useGeminiLive';
import { generateCommissionPrompt } from '@/utils/patientPrompts';
import type { SimCaseType } from '@/lib/ai/simuladorSchemas';
import { saveVoiceDefense, exportarDefensaVozPDF } from '@/services/simuladorFirebase';
import { DefensaVozHistorial } from './DefensaVozHistorial';

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

// ─── Competency level badge colors ───
const COMP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'Logrado': { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200' },
    'En desarrollo': { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200' },
    'No demostrado': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },
};

const COMP_LABELS: Record<string, string> = {
    razonamiento_clinico: '🧠 Razonamiento Clínico',
    comunicacion_profesional: '🗣️ Comunicación Profesional',
    evidencia_cientifica: '📖 Evidencia Científica',
    integracion_biopsicosocial: '🌐 Integración BPS',
    dosificacion_prescripcion: '💊 Dosificación y Prescripción',
};

export function DefensaExamenVozDocente() {
    const { user } = useAuth();
    const [phase, setPhase] = useState<SimPhase>('SETUP');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const [showHistorial, setShowHistorial] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    // ─── Docente config state ───
    const [cantidadPreguntas, setCantidadPreguntas] = useState(15);
    const [estiloComision, setEstiloComision] = useState<'individual' | 'comision_2'>('individual');
    const [tiempoLimiteMin, setTiempoLimiteMin] = useState(0); // 0 = sin límite
    const [instruccionesDocente, setInstruccionesDocente] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    useEffect(() => {
        getAudioDevices().then(setAudioDevices).catch(() => {});
    }, []);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    // ─── Auto-end when time limit reached ───
    const tiempoLimiteSec = tiempoLimiteMin * 60;
    const timeExpiredRef = useRef(false);
    useEffect(() => {
        if (tiempoLimiteSec > 0 && timer >= tiempoLimiteSec && phase === 'COMMISSION_VOICE' && !timeExpiredRef.current) {
            timeExpiredRef.current = true;
            handleEndDefense();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timer, tiempoLimiteSec, phase]);

    // AI Data
    const [caseData, setCaseData] = useState<SimCaseType | null>(null);
    const [evaluationData, setEvaluationData] = useState<any | null>(null);

    // Student Work
    const [setupForm, setSetupForm] = useState({ tipo: 'aleatorio', area: '', dificultad: 'avanzado', descripcion: '' });
    const [construction, setConstruction] = useState({ problema_principal: '', diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });

    // ─── Commission config for prompt ───
    const commissionConfig = useMemo(() => ({
        cantidadPreguntas,
        estiloComision,
        tiempoLimiteMin: tiempoLimiteMin || undefined,
        instruccionesDocente: instruccionesDocente.trim() || undefined,
    }), [cantidadPreguntas, estiloComision, tiempoLimiteMin, instruccionesDocente]);

    // Voice connection for Commission
    const { connect, disconnect, connectionState, isMicOpen, toggleMic, isSpeaking, volume, transcript } = useGeminiLive({
        systemInstruction: caseData ? generateCommissionPrompt(
            caseData.ficha_visible,
            caseData.perfil_secreto,
            caseData.hallazgos_todos_modulos,
            construction,
            commissionConfig
        ) : '',
        voiceName: 'Orion',
        audioDeviceId: selectedDeviceId || undefined
    });

    // ─── Progress indicator: parse transcript for question numbers ───
    const currentQuestion = useMemo(() => {
        let lastQ = 0;
        for (const t of transcript) {
            if (t.role === 'model') {
                // Match patterns like "Pregunta 5 de 15" or "[Klgo. Reyes] Pregunta 5 de 15"
                const match = t.text.match(/Pregunta\s+(\d+)\s+de\s+(\d+)/i);
                if (match) {
                    const qNum = parseInt(match[1], 10);
                    if (qNum > lastQ) lastQ = qNum;
                }
            }
        }
        return lastQ;
    }, [transcript]);

    // ─── Determine current phase label ───
    const currentPhaseLabel = useMemo(() => {
        if (currentQuestion === 0) return '';
        const totalFases = 5;
        const base = Math.floor(cantidadPreguntas / totalFases);
        const resto = cantidadPreguntas % totalFases;
        const faseSizes: number[] = [];
        for (let i = 0; i < totalFases; i++) {
            faseSizes.push(base + (i < resto ? 1 : 0));
        }
        let cursor = 1;
        const faseNames = ['Ataque a Propuesta', 'Ciencias Básicas', 'Dosificación', 'Comorbilidades', 'Pronóstico'];
        for (let i = 0; i < totalFases; i++) {
            const end = cursor + faseSizes[i] - 1;
            if (currentQuestion >= cursor && currentQuestion <= end) {
                return faseNames[i];
            }
            cursor = end + 1;
        }
        return faseNames[4];
    }, [currentQuestion, cantidadPreguntas]);

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
            timeExpiredRef.current = false;
            timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleStartCommission = () => {
        if (!construction.problema_principal.trim() || !construction.diagnostico.trim() || !construction.objetivo_general.trim()) {
            setError('Debes completar al menos el problema principal, diagnóstico y objetivo general.');
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
            
            try {
                await saveVoiceDefense({
                    userId: user.uid,
                    userEmail: user.email || '',
                    userName: user.displayName || user.email?.split('@')[0] || 'Estudiante',
                    pacienteNombre: caseData.ficha_visible.nombre,
                    motivoConsulta: caseData.ficha_visible.motivo_consulta,
                    area: setupForm.area || 'Aleatoria',
                    dificultad: setupForm.dificultad,
                    construccion: construction,
                    transcripcion: transcriptText,
                    puntajeGlobal: data.puntaje_global,
                    notaChilena: data.nota_chilena,
                    feedbackFinal: data.feedback_final,
                    aciertos: data.aciertos || [],
                    errores: data.errores || [],
                    temasAEstudiar: data.temas_a_estudiar || [],
                    rubricaDetallada: data.rubrica_detallada || {},
                    competencias: data.competencias || undefined,
                    tiempoSegundos: timer,
                    // Guardar caso clínico completo para registro docente
                    casoClinico: {
                        fichaVisible: caseData.ficha_visible,
                        perfilSecreto: caseData.perfil_secreto,
                        hallazgos: caseData.hallazgos_todos_modulos,
                    }
                });
            } catch (err) {
                console.error("Error guardando defensa en firebase:", err);
                setError('⚠️ Tus resultados se muestran abajo, pero hubo un problema al guardarlos en el historial. Toma una captura de pantalla por seguridad.');
            }

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
        timeExpiredRef.current = false;
        setConstruction({ problema_principal: '', diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
    };

    // ─── Time remaining for countdown ───
    const timeRemaining = tiempoLimiteSec > 0 ? Math.max(0, tiempoLimiteSec - timer) : null;
    const timeWarning = timeRemaining !== null && timeRemaining <= 120; // last 2 minutes

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900">🎤 Simulador de Defensa de Grado</h1>
                    <p className="text-gray-500 text-sm mt-1">Versión Docente — Practica tu razonamiento oral frente a la comisión (Voz)</p>
                </div>
                {phase !== 'SETUP' && phase !== 'RESULTS' && (
                    <div className="flex items-center gap-3">
                        {/* Timer / Countdown */}
                        {timeRemaining !== null ? (
                            <div className={`font-mono px-4 py-2 rounded-xl text-lg shadow ${timeWarning ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-900 text-white'}`}>
                                ⏱️ {formatTime(timeRemaining)}
                            </div>
                        ) : (
                            <div className="bg-slate-900 text-white font-mono px-4 py-2 rounded-xl text-lg shadow">{formatTime(timer)}</div>
                        )}
                        <button onClick={() => { if (confirm('¿Estás seguro de abandonar? Se perderá todo el progreso de esta sesión.')) handleReset(); }} className="text-xs text-red-500 hover:text-red-700 font-bold">Abandonar</button>
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
            {phase === 'SETUP' && !loading && !showHistorial && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">Generar Caso Clínico (Resuelto)</h2>
                            <p className="text-sm text-slate-500">Recibirás un caso con la historia completa y el examen físico ya realizado. Tu deber será formular el plan y defenderlo oralmente.</p>
                        </div>
                        <button onClick={() => setShowHistorial(true)} className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 hover:border-amber-300 transition-all">
                            📊 Historial
                        </button>
                    </div>
                    
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

                    {/* Micrófono */}
                    {audioDevices.length > 1 && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">🎤 Micrófono</label>
                            <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                <option value="">Predeterminado del sistema</option>
                                {audioDevices.map(d => (
                                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Micrófono ${d.deviceId.slice(0,8)}`}</option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-400 mt-1">Selecciona el micrófono que quieres usar para la defensa oral.</p>
                        </div>
                    )}

                    {/* ─── DOCENTE: Configuración avanzada ─── */}
                    <div className="border-t border-slate-200 pt-4">
                        <button 
                            onClick={() => setShowAdvanced(!showAdvanced)} 
                            className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
                        >
                            <span className={`transform transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>▶</span>
                            ⚙️ Configuración Docente (Avanzada)
                        </button>
                        
                        {showAdvanced && (
                            <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Cantidad de preguntas */}
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-800 mb-1">Cantidad de Preguntas</label>
                                        <select value={cantidadPreguntas} onChange={e => setCantidadPreguntas(Number(e.target.value))} className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none bg-white">
                                            <option value={5}>5 (Rápida)</option>
                                            <option value={10}>10 (Media)</option>
                                            <option value={15}>15 (Estándar)</option>
                                            <option value={20}>20 (Extensa)</option>
                                            <option value={25}>25 (Intensiva)</option>
                                        </select>
                                    </div>

                                    {/* Estilo de comisión */}
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-800 mb-1">Estilo de Comisión</label>
                                        <select value={estiloComision} onChange={e => setEstiloComision(e.target.value as 'individual' | 'comision_2')} className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none bg-white">
                                            <option value="individual">1 Evaluador (estricto)</option>
                                            <option value="comision_2">2 Kinesiólogos (Klgo. Reyes + Klga. Muñoz)</option>
                                        </select>
                                    </div>

                                    {/* Límite de tiempo */}
                                    <div>
                                        <label className="block text-sm font-semibold text-indigo-800 mb-1">Límite de Tiempo</label>
                                        <select value={tiempoLimiteMin} onChange={e => setTiempoLimiteMin(Number(e.target.value))} className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none bg-white">
                                            <option value={0}>Sin límite</option>
                                            <option value={10}>10 minutos</option>
                                            <option value={15}>15 minutos</option>
                                            <option value={20}>20 minutos</option>
                                            <option value={25}>25 minutos</option>
                                            <option value={30}>30 minutos</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Instrucciones docente */}
                                <div>
                                    <label className="block text-sm font-semibold text-indigo-800 mb-1">📝 Instrucciones adicionales al evaluador</label>
                                    <textarea 
                                        value={instruccionesDocente} 
                                        onChange={e => setInstruccionesDocente(e.target.value)} 
                                        rows={2} 
                                        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-200 outline-none bg-white" 
                                        placeholder='Ej: "Enfócate en el modelo biopsicosocial", "Penaliza si menciona posturología", "Pregunta sobre biomecánica del hombro"...'
                                    />
                                    <p className="text-xs text-indigo-600 mt-1">Estas instrucciones se inyectan directamente al prompt del evaluador.</p>
                                </div>

                                {/* Summary */}
                                <div className="bg-white rounded-lg p-3 border border-indigo-200 text-xs text-indigo-700">
                                    <strong>Resumen:</strong> {cantidadPreguntas} preguntas · {estiloComision === 'comision_2' ? '2 Kinesiólogos' : '1 Evaluador'} · {tiempoLimiteMin ? `${tiempoLimiteMin} min` : 'Sin límite'} {instruccionesDocente.trim() ? '· Con instrucciones extra' : ''}
                                </div>
                            </div>
                        )}
                    </div>

                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all font-sans text-sm">
                        📄 Recibir Caso Resuelto
                    </button>
                </div>
            )}

            {/* HISTORIAL */}
            {showHistorial && (
                <DefensaVozHistorial onClose={() => setShowHistorial(false)} />
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
                        <p className="text-xs text-amber-700 mb-2">💡 El problema principal NO es solo &quot;dolor&quot;. Es la disfunción o limitación clave que impide al paciente realizar su actividad. Ej: <em>Incapacidad para lanzar el balón por debilidad glútea y dolor</em>.</p>
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
                        <div className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg text-sm">
                            {estiloComision === 'comision_2' ? '2 Kinesiólogos' : '1 Evaluador'} · {cantidadPreguntas} preguntas
                        </div>
                    </div>

                    {/* ─── Progress Bar ─── */}
                    {currentQuestion > 0 && (
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm font-bold text-slate-700">
                                    Pregunta {currentQuestion} de {cantidadPreguntas}
                                </span>
                                {currentPhaseLabel && (
                                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                                        {currentPhaseLabel}
                                    </span>
                                )}
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2.5">
                                <div 
                                    className="bg-gradient-to-r from-amber-400 to-amber-600 h-2.5 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, (currentQuestion / cantidadPreguntas) * 100)}%` }}
                                />
                            </div>
                        </div>
                    )}

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
                                    {isSpeaking ? (estiloComision === 'comision_2' ? 'La comisión está hablando...' : 'El evaluador está hablando...') : 'Escuchando tu defensa...'}
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
                <div className="bg-white rounded-2xl p-8 border max-w-4xl mx-auto shadow-sm animate-fade-in">
                    <div className="text-center mb-10">
                        <div className="text-6xl mb-4">{evaluationData.puntaje_global >= 60 ? '🏆' : '📚'}</div>
                        <h2 className="text-3xl font-black text-slate-800">
                            Nota: {evaluationData.nota_chilena?.toFixed(1) || 'N/A'} 
                            <span className="text-lg text-slate-500 block font-normal mt-1">({evaluationData.puntaje_global}/100 Puntos)</span>
                        </h2>
                        <p className="text-slate-500 font-medium">Defensa de Grado</p>
                    </div>

                    <div className="mb-8 p-6 bg-slate-50 rounded-xl border">
                        <h3 className="font-bold text-slate-800 text-xl mb-3">Feedback General de la Comisión</h3>
                        <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{evaluationData.feedback_final}</p>
                    </div>

                    {evaluationData.rubrica_detallada && (
                        <div className="mb-8">
                            <h3 className="font-bold text-slate-800 text-xl mb-4">Desglose de Evaluación</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {Object.entries(evaluationData.rubrica_detallada).map(([key, data]: [string, any]) => (
                                    <div key={key} className="bg-white border p-4 rounded-xl shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-slate-800 capitalize">{key.replace(/_/g, ' ')}</h4>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${data.puntaje >= 60 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {data.puntaje}/100
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-600">{data.comentario}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ─── COMPETENCIAS (#12) ─── */}
                    {evaluationData.competencias && (
                        <div className="mb-8">
                            <h3 className="font-bold text-slate-800 text-xl mb-4">🏷️ Evaluación por Competencias</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {Object.entries(evaluationData.competencias).map(([key, data]: [string, any]) => {
                                    const colors = COMP_COLORS[data.nivel] || COMP_COLORS['No demostrado'];
                                    return (
                                        <div key={key} className={`${colors.bg} border ${colors.border} rounded-xl p-4`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-slate-800 text-sm">{COMP_LABELS[key] || key.replace(/_/g, ' ')}</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                                                    {data.nivel}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 leading-relaxed">{data.comentario}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">
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

                    {evaluationData.temas_a_estudiar && evaluationData.temas_a_estudiar.length > 0 && (
                        <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-100">
                            <h3 className="font-bold text-blue-900 text-lg mb-3 flex items-center gap-2">
                                <span>📚</span> Temas Recomendados para Estudiar
                            </h3>
                            <p className="text-sm text-blue-800 mb-4">Basado en tu desempeño en la defensa, la comisión te recomienda repasar fuertemente los siguientes temas:</p>
                            <ul className="list-disc list-inside text-blue-900 space-y-2">
                                {evaluationData.temas_a_estudiar.map((tema: string, idx: number) => (
                                    <li key={idx} className="font-medium">{tema}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="mt-8 flex flex-col sm:flex-row gap-4 border-t pt-6">
                        <button
                            onClick={() => {
                                if (!user || !caseData || !evaluationData) return;
                                const transcriptText = transcript.map(t => `${t.role === 'user' ? 'ESTUDIANTE' : 'COMISIÓN'}: ${t.text}`).join('\n');
                                exportarDefensaVozPDF({
                                    userId: user.uid,
                                    userEmail: user.email || '',
                                    userName: user.displayName || user.email?.split('@')[0] || 'Estudiante',
                                    pacienteNombre: caseData.ficha_visible.nombre,
                                    motivoConsulta: caseData.ficha_visible.motivo_consulta,
                                    area: setupForm.area || 'Aleatoria',
                                    dificultad: setupForm.dificultad,
                                    construccion: construction,
                                    transcripcion: transcriptText,
                                    puntajeGlobal: evaluationData.puntaje_global,
                                    notaChilena: evaluationData.nota_chilena,
                                    feedbackFinal: evaluationData.feedback_final,
                                    aciertos: evaluationData.aciertos || [],
                                    errores: evaluationData.errores || [],
                                    temasAEstudiar: evaluationData.temas_a_estudiar || [],
                                    rubricaDetallada: evaluationData.rubrica_detallada || {},
                                    tiempoSegundos: timer,
                                    casoClinico: {
                                        fichaVisible: caseData.ficha_visible,
                                        perfilSecreto: caseData.perfil_secreto,
                                        hallazgos: caseData.hallazgos_todos_modulos,
                                    }
                                });
                            }}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            📄 Exportar Reporte Completo (PDF)
                        </button>
                        
                        <button
                            onClick={handleReset}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2"
                        >
                            🔄 Volver al Inicio
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
