'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { getUserTrainingProfile, selectOptimalTopicForUser, saveTrainingSession, UserTrainingProfile } from '../services/entrenamientoFirebase';
import { generateSocraticTutorPrompt } from '../utils/patientPrompts';
import { ClinicalTopic } from '../utils/clinicalTopics';
import { ResponsiveRadar } from '@nivo/radar';

export default function EntrenamientoDiarioVoz() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserTrainingProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    const [currentTopic, setCurrentTopic] = useState<ClinicalTopic | null>(null);
    const [historicalErrors, setHistoricalErrors] = useState<string[]>([]);
    
    const [evaluating, setEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<any>(null);

    const {
        connect,
        disconnect,
        connectionState,
        isSpeaking,
        volume,
        isMicOpen,
        toggleMic,
        transcript
    } = useGeminiLive({
        systemInstruction: currentTopic 
            ? generateSocraticTutorPrompt(currentTopic.nombre, currentTopic.focoPrincipal, historicalErrors, profile?.estiloCognitivo || 'NEUTRO')
            : '',
        voiceName: 'Orion' // Tutor
    });

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const p = await getUserTrainingProfile(user.uid);
            setProfile(p);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleStartSession = async () => {
        if (!user) return;
        setSessionState('CONNECTING');
        setEvaluationResult(null);
        try {
            const { topic, historicalErrors: errors } = await selectOptimalTopicForUser(user.uid);
            setCurrentTopic(topic);
            setHistoricalErrors(errors);
        } catch (error) {
            console.error(error);
            setSessionState('IDLE');
        }
    };

    // Escuchar el estado para conectar el mic cuando currentTopic ya esté en el estado de React
    useEffect(() => {
        if (sessionState === 'CONNECTING' && currentTopic && connectionState === 'disconnected') {
            connect();
        }
    }, [sessionState, currentTopic, connectionState, connect]);

    // Escuchar el estado de conexión para cambiar a IN_PROGRESS
    useEffect(() => {
        if (connectionState === 'connected' && sessionState === 'CONNECTING') {
            setSessionState('IN_PROGRESS');
        } else if (connectionState === 'error') {
            setSessionState('IDLE');
            alert('Error al conectar con el tutor.');
        }
    }, [connectionState, sessionState]);

    const handleEndSession = async () => {
        disconnect();
        setSessionState('COMPLETED');
        
        if (user && currentTopic) {
            // Formatear la transcripción a texto
            const transcriptText = transcript.map(t => `${t.role === 'user' ? 'Estudiante' : 'Tutor'}: ${t.text}`).join('\n');

            if (transcriptText.length < 50) {
                alert("La sesión fue muy corta para ser evaluada correctamente.");
                setSessionState('IDLE');
                return;
            }

            setEvaluating(true);
            try {
                const response = await fetch('/api/ai/simulador', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'evaluate-training',
                        payload: { transcript: transcriptText },
                        userId: user.uid
                    })
                });

                if (!response.ok) throw new Error("Error en la evaluación");
                const resData = await response.json();
                
                if (resData.success && resData.data) {
                    const evalData = resData.data;
                    setEvaluationResult(evalData);
                    
                    await saveTrainingSession(
                        user.uid, 
                        currentTopic.id, 
                        evalData.puntaje, 
                        evalData.errores,
                        evalData.radarScores,
                        evalData.estiloCognitivoSugerido,
                        transcriptText
                    );
                    await loadProfile(); 
                }
            } catch (err) {
                console.error(err);
                alert("Hubo un problema evaluando la sesión.");
            } finally {
                setEvaluating(false);
            }
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 font-medium">Cargando tu progreso...</div>;
    }

    if (!profile) return null;

    const retosCompletados = profile.sesionesCompletadasEstaSemana;
    const metaSemanal = 5;
    const retosPendientes = Math.max(0, metaSemanal - retosCompletados);
    const mostrarAlertaPersistente = retosPendientes > 3;

    // Preparar data del Radar
    const radarData = evaluationResult ? [
        { subject: 'Biomecánica', score: evaluationResult.radarScores.biomecanica },
        { subject: 'Diagnóstico', score: evaluationResult.radarScores.diagnostico },
        { subject: 'Neurofisiología', score: evaluationResult.radarScores.neurofisiologia },
        { subject: 'Dosificación', score: evaluationResult.radarScores.dosificacion },
        { subject: 'Terapia Manual', score: evaluationResult.radarScores.terapiaManual },
    ] : [];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Alerta Persistente */}
            {mostrarAlertaPersistente && sessionState === 'IDLE' && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                    <div className="flex">
                        <div className="flex-shrink-0 text-red-500 text-xl">⚠️</div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-red-800">Atención: Retraso Crítico</h3>
                            <div className="mt-1 text-sm text-red-700">
                                Tienes {retosPendientes} interrogaciones pendientes esta semana. Recuerda que la consistencia es clave para fijar el conocimiento clínico.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header de Progreso */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">Entrenamiento Socrático</h2>
                        <p className="text-slate-600">Completa al menos {metaSemanal} interrogaciones semanales. Total acumulado: {profile.retosCompletadosTotal || 0} retos.</p>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-center">
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Perfil Cognitivo</p>
                        <p className="text-indigo-700 font-bold">{profile.estiloCognitivo}</p>
                    </div>
                </div>
                
                <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map(dia => {
                        const completado = dia <= retosCompletados;
                        return (
                            <div key={dia} className="flex-1 flex flex-col items-center">
                                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-2 transition-all ${completado ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 border-2 border-dashed border-slate-300'}`}>
                                    {completado ? '✓' : dia}
                                </div>
                                <span className={`text-xs font-bold ${completado ? 'text-emerald-600' : 'text-slate-400'}`}>
                                    Reto {dia}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Main Action Area */}
            {sessionState === 'IDLE' && (
                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-10 text-center text-white shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                    
                    {retosCompletados >= metaSemanal ? (
                        <>
                            <div className="text-5xl mb-4">🏆</div>
                            <h3 className="text-2xl font-bold mb-2">¡Meta Semanal Alcanzada!</h3>
                            <p className="text-indigo-200 mb-6 max-w-lg mx-auto">Has completado tus {metaSemanal} retos semanales de razonamiento clínico. Tu cerebro está en forma.</p>
                            <button onClick={handleStartSession} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-xl transition-all border border-white/20">
                                Seguir practicando (Opcional)
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-5xl mb-4">🧠</div>
                            <h3 className="text-3xl font-bold mb-2">Interrogatorio del Día</h3>
                            <p className="text-indigo-200 mb-8 max-w-lg mx-auto">El algoritmo te asignará uno de los 40 temas clínicos (o reforzará uno débil). El tutor te exigirá fundamentar con evidencia y razonamiento.</p>
                            <button onClick={handleStartSession} className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-4 px-10 rounded-2xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] text-lg hover:scale-105 active:scale-95">
                                ▶ Iniciar Reto {retosCompletados + 1}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* Sesión en progreso */}
            {sessionState === 'CONNECTING' && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <h3 className="text-xl font-bold text-slate-800">Conectando con el Tutor Académico...</h3>
                    <p className="text-slate-500">Analizando tu perfil cognitivo y generando el caso clínico.</p>
                </div>
            )}

            {sessionState === 'IN_PROGRESS' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    <div className="text-center">
                        <div className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-full text-sm mb-4">
                            Interrogatorio Activo
                        </div>
                        <h3 className="font-bold text-slate-800 text-xl mb-1">Tema: {currentTopic?.nombre}</h3>
                        <p className="text-slate-500 text-sm">Escucha el caso que planteará el tutor y defiéndelo.</p>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10">
                        <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeaking ? 'bg-indigo-100 shadow-[0_0_50px_rgba(79,70,229,0.5)] scale-110' : 'bg-slate-100'} ${volume > 0.05 ? 'scale-[1.05]' : ''}`}>
                            <div className={`w-32 h-32 rounded-full transition-all duration-100 flex items-center justify-center text-4xl ${isSpeaking ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'} ${volume > 0.1 ? 'scale-[1.1]' : ''}`}>
                                👨‍🏫
                            </div>
                        </div>
                        <p className="mt-8 font-bold text-lg text-slate-700">
                            {isSpeaking ? 'El tutor está evaluando tu respuesta...' : 'El tutor te escucha, defiende tu postura...'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={toggleMic} className={`flex-1 font-bold py-4 rounded-xl transition-all text-lg ${isMicOpen ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
                            {isMicOpen ? '🔇 Silenciar Micrófono' : '🔊 Hablar'}
                        </button>
                        <button onClick={handleEndSession} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg">
                            Finalizar y Evaluar
                        </button>
                    </div>

                    {/* Caja de Transcripción */}
                    {transcript.length > 0 && (
                        <div className="mt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 max-h-80 overflow-y-auto shadow-inner">
                            <h4 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider">Transcripción en vivo</h4>
                            <div className="space-y-4">
                                {transcript.map((msg, idx) => (
                                    <div key={idx} className={`p-4 rounded-xl text-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-900 ml-12 shadow-sm' : 'bg-white text-slate-800 border border-slate-200 mr-12 shadow-sm'}`}>
                                        <strong className="block text-xs mb-1 opacity-50 uppercase tracking-wide">{msg.role === 'user' ? 'Tú (Estudiante)' : 'Tutor Clínico'}</strong>
                                        {msg.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Resultado */}
            {sessionState === 'COMPLETED' && (
                <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
                    {evaluating ? (
                        <div className="text-center py-12">
                            <div className="animate-spin text-4xl mb-4">🧠</div>
                            <h3 className="text-xl font-bold text-slate-800">El sistema está evaluando tu defensa...</h3>
                            <p className="text-slate-500">Calculando puntajes en radar de competencias.</p>
                        </div>
                    ) : evaluationResult ? (
                        <div className="space-y-8">
                            <div className="text-center">
                                <h3 className="text-3xl font-bold text-slate-800 mb-2">Evaluación Final</h3>
                                <p className="text-slate-500">Tema: {currentTopic?.nombre}</p>
                                <div className="mt-4 inline-flex items-center justify-center bg-indigo-50 px-6 py-3 rounded-2xl border border-indigo-100">
                                    <span className="text-sm text-indigo-500 font-bold uppercase tracking-widest mr-4">Nota Final</span>
                                    <span className="text-4xl font-extrabold text-indigo-700">{evaluationResult.puntaje.toFixed(1)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="h-[300px]">
                                    <h4 className="font-bold text-center text-slate-700 mb-4">Radar de Competencias</h4>
                                    <ResponsiveRadar
                                        data={radarData}
                                        keys={['score']}
                                        indexBy="subject"
                                        maxValue={100}
                                        margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                                        curve="linearClosed"
                                        borderWidth={2}
                                        borderColor={{ from: 'color' }}
                                        gridLevels={5}
                                        gridShape="circular"
                                        gridLabelOffset={16}
                                        enableDots={true}
                                        dotSize={8}
                                        dotColor={{ theme: 'background' }}
                                        dotBorderWidth={2}
                                        dotBorderColor={{ from: 'color' }}
                                        enableDotLabel={true}
                                        dotLabel="value"
                                        dotLabelYOffset={-12}
                                        colors={{ scheme: 'set2' }}
                                        fillOpacity={0.4}
                                        blendMode="multiply"
                                        animate={true}
                                    />
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-bold text-emerald-700 flex items-center gap-2 mb-2">
                                            <span className="text-xl">✅</span> Lo que hiciste bien
                                        </h4>
                                        <ul className="list-disc pl-5 text-slate-600 space-y-1 text-sm">
                                            {evaluationResult.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-red-600 flex items-center gap-2 mb-2">
                                            <span className="text-xl">⚠️</span> Errores Conceptuales
                                        </h4>
                                        {evaluationResult.errores.length > 0 ? (
                                            <ul className="list-disc pl-5 text-slate-600 space-y-1 text-sm">
                                                {evaluationResult.errores.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No se detectaron errores graves. ¡Excelente trabajo!</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center pt-6 border-t border-slate-100">
                                <button onClick={() => setSessionState('IDLE')} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md">
                                    Finalizar y Guardar Progreso
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p>No se pudo obtener la evaluación.</p>
                            <button onClick={() => setSessionState('IDLE')} className="mt-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg">
                                Volver
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
