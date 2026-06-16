'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { getUserTrainingProfile, selectOptimalTopicForUser, saveTrainingSession, UserTrainingProfile } from '../services/entrenamientoFirebase';
import { generateSocraticTutorPrompt } from '../utils/patientPrompts';
import { ClinicalTopic } from '../utils/clinicalTopics';

export default function EntrenamientoDiarioVoz() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserTrainingProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    const [currentTopic, setCurrentTopic] = useState<ClinicalTopic | null>(null);
    const [historicalErrors, setHistoricalErrors] = useState<string[]>([]);

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
            ? generateSocraticTutorPrompt(currentTopic.nombre, currentTopic.focoPrincipal, historicalErrors)
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
        try {
            const { topic, historicalErrors: errors } = await selectOptimalTopicForUser(user.uid);
            setCurrentTopic(topic);
            setHistoricalErrors(errors);
            
            // Esperar un momento a que el state de systemInstruction se actualice
            setTimeout(() => {
                connect();
            }, 500);
        } catch (error) {
            console.error(error);
            setSessionState('IDLE');
        }
    };

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
        
        // Simular guardado de sesión
        // En un entorno real, enviaríamos el 'transcript' a una Cloud Function para extraer 'aciertos' y 'errores' reales.
        if (user && currentTopic) {
            // Puntaje simulado basado en longitud de la interacción por ahora
            const mockScore = Math.min(100, Math.max(40, transcript.length * 5));
            const mockErrores = transcript.length < 5 ? ["Respuestas muy breves o falta de profundidad"] : [];
            
            await saveTrainingSession(user.uid, currentTopic.id, mockScore, mockErrores);
            await loadProfile(); // Recargar el progreso
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 font-medium">Cargando tu progreso...</div>;
    }

    if (!profile) return null;

    const retosCompletados = profile.sesionesCompletadasEstaSemana;
    const metaSemanal = 5;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header de Progreso */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Tu Entrenamiento Semanal</h2>
                <p className="text-slate-600 mb-6">Completa tus 5 retos de razonamiento clínico para mantener tus habilidades agudas.</p>
                
                <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map(dia => {
                        const completado = dia <= retosCompletados;
                        return (
                            <div key={dia} className="flex-1 flex flex-col items-center">
                                <div className={\`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-2 transition-all \${completado ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-slate-100 text-slate-400 border-2 border-dashed border-slate-300'}\`}>
                                    {completado ? '✓' : dia}
                                </div>
                                <span className={\`text-xs font-bold \${completado ? 'text-emerald-600' : 'text-slate-400'}\`}>
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
                            <p className="text-indigo-200 mb-6 max-w-lg mx-auto">Has completado tus 5 retos semanales de razonamiento clínico. Tu cerebro está en forma.</p>
                            <button onClick={handleStartSession} className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-xl transition-all border border-white/20">
                                Seguir practicando (Opcional)
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-5xl mb-4">🧠</div>
                            <h3 className="text-3xl font-bold mb-2">Reto Clínico del Día</h3>
                            <p className="text-indigo-200 mb-8 max-w-lg mx-auto">El algoritmo ha seleccionado un caso específico para ti basado en tu historial de fortalezas y debilidades. La IA actuará como tu tutor.</p>
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
                    <h3 className="text-xl font-bold text-slate-800">Conectando con el Tutor...</h3>
                    <p className="text-slate-500">Analizando tu historial y preparando el caso clínico.</p>
                </div>
            )}

            {sessionState === 'IN_PROGRESS' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    <div className="text-center">
                        <div className="inline-block px-4 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-full text-sm mb-4">
                            Tutoría Socrática Activa
                        </div>
                        <h3 className="font-bold text-slate-800 text-xl mb-1">Tema: {currentTopic?.nombre}</h3>
                        <p className="text-slate-500 text-sm">Escucha atentamente el caso que planteará el tutor y prepárate para razonar.</p>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10">
                        <div className={\`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 \${isSpeaking ? 'bg-indigo-100 shadow-[0_0_50px_rgba(79,70,229,0.5)] scale-110' : 'bg-slate-100'} \${volume > 0.05 ? 'scale-[1.05]' : ''}\`}>
                            <div className={\`w-32 h-32 rounded-full transition-all duration-100 flex items-center justify-center text-4xl \${isSpeaking ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'} \${volume > 0.1 ? 'scale-[1.1]' : ''}\`}>
                                👨‍🏫
                            </div>
                        </div>
                        <p className="mt-8 font-bold text-lg text-slate-700">
                            {isSpeaking ? 'El tutor está hablando...' : 'El tutor te escucha...'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={toggleMic} className={\`flex-1 font-bold py-4 rounded-xl transition-all text-lg \${isMicOpen ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-red-100 hover:bg-red-200 text-red-700'}\`}>
                            {isMicOpen ? '🔇 Mutear Micrófono' : '🔊 Activar Micrófono'}
                        </button>
                        <button onClick={handleEndSession} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg">
                            Finalizar Entrenamiento
                        </button>
                    </div>
                </div>
            )}

            {sessionState === 'COMPLETED' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-10 text-center shadow-sm">
                    <div className="text-6xl mb-4">✅</div>
                    <h3 className="text-3xl font-bold text-emerald-900 mb-2">¡Entrenamiento Completado!</h3>
                    <p className="text-emerald-700 mb-8 max-w-lg mx-auto">Has sumado un nuevo reto a tu progreso semanal. Tu desempeño ha sido registrado para ajustar tu próximo desafío.</p>
                    
                    <button onClick={() => setSessionState('IDLE')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md">
                        Volver al Inicio
                    </button>
                </div>
            )}
        </div>
    );
}
