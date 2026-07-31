'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { getUserTrainingProfile, saveTrainingSession, UserTrainingProfile } from '../services/entrenamientoFirebase';
import { KNEE_TOPICS, KneeTopic } from '../utils/kneeTopics';
import { generateKneeSocraticPrompt } from '../utils/kneePrompts';
import { ResponsiveRadar } from '@nivo/radar';

export default function EntrenamientoRodillaVoz() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserTrainingProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    const [currentTopic, setCurrentTopic] = useState<KneeTopic | null>(null);
    const [historicalErrors, setHistoricalErrors] = useState<string[]>([]);
    
    const [evaluating, setEvaluating] = useState(false);
    const [evaluationResult, setEvaluationResult] = useState<any>(null);
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (sessionState === 'IN_PROGRESS') {
            setTimer(0);
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
        } else {
            if (interval) clearInterval(interval);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [sessionState]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Accordion and modal states for selectable Topic Bank
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const [selectedTopic, setSelectedTopic] = useState<KneeTopic | null>(null);
    const [showTopicModal, setShowTopicModal] = useState(false);

    const {
        connect,
        disconnect,
        connectionState,
        isSpeaking,
        volume,
        isMicOpen,
        toggleMic,
        transcript,
        clearTranscript
    } = useGeminiLive({
        systemInstruction: currentTopic 
            ? generateKneeSocraticPrompt(
                currentTopic, 
                historicalErrors, 
                profile?.estiloCognitivo || 'NEUTRO',
                user?.displayName ? user.displayName.split(' ')[0] : 'Estudiante'
              )
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

    // select optimal knee topic for espaced repetition
    const selectOptimalKneeTopic = (): { topic: KneeTopic, historicalErrors: string[] } => {
        if (!profile) return { topic: KNEE_TOPICS[0], historicalErrors: [] };
        
        const seenTopicIds = Object.keys(profile.temas);
        const unseenTopics = KNEE_TOPICS.filter(t => !seenTopicIds.includes(t.id));

        if (unseenTopics.length > 0) {
            const randomIndex = Math.floor(Math.random() * unseenTopics.length);
            return { topic: unseenTopics[randomIndex], historicalErrors: [] };
        }

        const weakTopics = Object.values(profile.temas)
            .filter(t => KNEE_TOPICS.map(kt => kt.id).includes(t.topicId))
            .filter(t => t.ultimoPuntaje < 4.0 || t.puntajePromedio < 4.0);
        
        if (weakTopics.length > 0) {
            weakTopics.sort((a, b) => a.ultimoPuntaje - b.ultimoPuntaje);
            const worstTopicProgress = weakTopics[Math.floor(Math.random() * Math.min(3, weakTopics.length))];
            const topic = KNEE_TOPICS.find(t => t.id === worstTopicProgress.topicId)!;
            return { topic, historicalErrors: worstTopicProgress.erroresHistoricos };
        }

        const kneeProgress = Object.values(profile.temas)
            .filter(t => KNEE_TOPICS.map(kt => kt.id).includes(t.topicId));

        if (kneeProgress.length > 0) {
            kneeProgress.sort((a, b) => {
                const timeA = a.ultimoRepaso ? a.ultimoRepaso.toMillis() : 0;
                const timeB = b.ultimoRepaso ? b.ultimoRepaso.toMillis() : 0;
                return timeA - timeB; 
            });
            const oldestTopicProgress = kneeProgress[0];
            const topic = KNEE_TOPICS.find(t => t.id === oldestTopicProgress.topicId)!;
            return { topic, historicalErrors: oldestTopicProgress.erroresHistoricos };
        }

        const fallback = KNEE_TOPICS[Math.floor(Math.random() * KNEE_TOPICS.length)];
        return { topic: fallback, historicalErrors: [] };
    };

    // Auto-selected recommended challenge
    const handleStartSession = async () => {
        if (!user) return;
        setSessionState('CONNECTING');
        setEvaluationResult(null);
        clearTranscript();
        try {
            const { topic, historicalErrors: errors } = selectOptimalKneeTopic();
            setCurrentTopic(topic);
            setHistoricalErrors(errors);
        } catch (error) {
            console.error(error);
            setSessionState('IDLE');
        }
    };

    // Selected specific topic challenge
    const handleStartTopicSession = async (topic: KneeTopic) => {
        if (!user) return;
        setShowTopicModal(false);
        setCurrentTopic(topic);
        setSessionState('CONNECTING');
        setEvaluationResult(null);
        clearTranscript();
        
        const histProgress = profile?.temas[topic.id];
        const errors = histProgress?.erroresHistoricos || [];
        setHistoricalErrors(errors);
    };

    // Connection hook side effect
    useEffect(() => {
        if (sessionState === 'CONNECTING' && currentTopic && connectionState === 'disconnected') {
            connect();
        }
    }, [sessionState, currentTopic, connectionState, connect]);

    // Connection state observer
    useEffect(() => {
        if (connectionState === 'connected' && sessionState === 'CONNECTING') {
            setSessionState('IN_PROGRESS');
        } else if (connectionState === 'error' && sessionState === 'CONNECTING') {
            setSessionState('IDLE');
            alert('Error al conectar con el tutor.');
        }
    }, [connectionState, sessionState]);

    const handleEndSession = async () => {
        disconnect();
        setSessionState('COMPLETED');
        
        if (user && currentTopic) {
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
                        evalData.cleanedTranscript || transcriptText,
                        evalData.feedback
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

    // Filter sessions completed this week that belong ONLY to knee topics
    const kneeTopicIds = KNEE_TOPICS.map(t => t.id);
    const retosCompletados = Object.values(profile.temas)
        .filter(t => kneeTopicIds.includes(t.topicId) && t.ultimoRepaso)
        .length;

    // Calculate cumulative radar for knee topics
    const computeCumulativeRadar = (temas: Record<string, any>) => {
        const totals = {
            biomecanica: 0,
            diagnostico: 0,
            neurofisiologia: 0,
            dosificacion: 0,
            terapiaManual: 0,
        };
        const counts = {
            biomecanica: 0,
            diagnostico: 0,
            neurofisiologia: 0,
            dosificacion: 0,
            terapiaManual: 0,
        };

        Object.keys(temas).forEach((topicId) => {
            if (kneeTopicIds.includes(topicId)) {
                const t = temas[topicId];
                if (t.radarUltimo) {
                    (Object.keys(totals) as Array<keyof typeof totals>).forEach((key) => {
                        const score = t.radarUltimo[key];
                        if (score !== undefined && score !== null && score !== -1) {
                            totals[key] += score;
                            counts[key] += 1;
                        }
                    });
                }
            }
        });

        const hasAnyData = Object.values(counts).some(c => c > 0);

        return {
            scores: {
                biomecanica: counts.biomecanica > 0 ? Math.round(totals.biomecanica / counts.biomecanica) : 0,
                diagnostico: counts.diagnostico > 0 ? Math.round(totals.diagnostico / counts.diagnostico) : 0,
                neurofisiologia: counts.neurofisiologia > 0 ? Math.round(totals.neurofisiologia / counts.neurofisiologia) : 0,
                dosificacion: counts.dosificacion > 0 ? Math.round(totals.dosificacion / counts.dosificacion) : 0,
                terapiaManual: counts.terapiaManual > 0 ? Math.round(totals.terapiaManual / counts.terapiaManual) : 0,
            },
            hasAnyData
        };
    };

    const histRadar = computeCumulativeRadar(profile.temas);

    // Determine weakest competence in knee topics
    let weakestArea = null;
    if (histRadar.hasAnyData) {
        const subjects = [
            { key: 'biomecanica', label: 'Biomecánica', categoryName: 'Gonartrosis' },
            { key: 'diagnostico', label: 'Diagnóstico', categoryName: 'Evaluación y Reevaluación' },
            { key: 'neurofisiologia', label: 'Neurofisiología', categoryName: 'Gonartrosis' },
            { key: 'dosificacion', label: 'Dosificación', categoryName: 'Artroplastia (PTR)' },
        ];
        
        let minScore = 101;
        let minSubj: any = null;
        for (const subj of subjects) {
            const val = histRadar.scores[subj.key as keyof typeof histRadar.scores];
            if (val < minScore) {
                minScore = val;
                minSubj = subj;
            }
        }
        
        if (minSubj && minScore < 85) {
            weakestArea = {
                key: minSubj.key,
                label: minSubj.label,
                categoryName: minSubj.categoryName,
                score: minScore
            };
        }
    }

    const radarData = evaluationResult ? [
        { subject: 'Biomecánica', score: evaluationResult.radarScores.biomecanica === -1 ? 0 : evaluationResult.radarScores.biomecanica },
        { subject: 'Diagnóstico', score: evaluationResult.radarScores.diagnostico === -1 ? 0 : evaluationResult.radarScores.diagnostico },
        { subject: 'Neurofisiología', score: evaluationResult.radarScores.neurofisiologia === -1 ? 0 : evaluationResult.radarScores.neurofisiologia },
        { subject: 'Dosificación', score: evaluationResult.radarScores.dosificacion === -1 ? 0 : evaluationResult.radarScores.dosificacion },
        { subject: 'Terapia Manual', score: evaluationResult.radarScores.terapiaManual === -1 ? 0 : evaluationResult.radarScores.terapiaManual },
    ] : [];

    const cumulativeRadarData = [
        { subject: 'Biomecánica', score: histRadar.scores.biomecanica },
        { subject: 'Diagnóstico', score: histRadar.scores.diagnostico },
        { subject: 'Neurofisiología', score: histRadar.scores.neurofisiologia },
        { subject: 'Dosificación', score: histRadar.scores.dosificacion },
        { subject: 'Terapia Manual', score: histRadar.scores.terapiaManual },
    ];

    const categoriesList = [
        { id: 'gonartrosis', name: 'Gonartrosis', label: '1. Gonartrosis (Fisiopatología y Ejercicio)' },
        { id: 'artroplastia', name: 'Artroplastia (PTR)', label: '2. Artroplastia Total de Rodilla (Fases)' },
        { id: 'evaluacion', name: 'Evaluación y Reevaluación', label: '3. Reevaluación Especial (Cicatriz, Marcha y SLR)' },
        { id: 'dpf', name: 'Dolor Patelofemoral', label: '4. Dolor Patelofemoral (Razonamiento y carga)' },
        { id: 'lca', name: 'LCA y retorno al deporte', label: '5. LCA y retorno al deporte (decisiones y progresión)' },
    ];

    const getCategoryProgress = (categoryName: string) => {
        const topics = KNEE_TOPICS.filter(t => t.categoria === categoryName);
        const completed = topics.filter(t => profile.temas[t.id] !== undefined);
        return {
            total: topics.length,
            completed: completed.length
        };
    };

    const getTopicsByCategory = (categoryName: string) => {
        return KNEE_TOPICS.filter(t => t.categoria === categoryName);
    };

    const toggleCategory = (catId: string) => {
        setExpandedCategory(expandedCategory === catId ? null : catId);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header de Progreso */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">Módulo Clínico: Rodilla</h2>
                        <p className="text-slate-600">
                            Práctica de razonamiento clínico: entrevista, hipótesis, diferenciales, examen, dosis de carga y decisiones de derivación.
                        </p>
                    </div>
                    <div className="bg-cyan-50 border border-cyan-100 px-4 py-2 rounded-xl text-center">
                        <p className="text-xs font-bold text-cyan-500 uppercase tracking-wider">Interna</p>
                        <p className="text-cyan-700 font-bold">{user?.displayName || 'Estudiante'}</p>
                    </div>
                </div>

                <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900">
                    <strong>Razonamiento clínico en cada práctica:</strong> hipótesis → dato de entrevista o examen que la fortalece/debilita → diferencial relevante → disfunción kinesiológica modificable → decisión segura.
                </div>
                
                <div className="flex gap-4">
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                        <span className="text-xs text-slate-400 block font-bold uppercase">Temas del Módulo</span>
                        <span className="text-2xl font-bold text-slate-800 mt-1 block">
                            {Object.keys(profile.temas).filter(id => kneeTopicIds.includes(id)).length} / {KNEE_TOPICS.length}
                        </span>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 p-4 rounded-xl text-center">
                        <span className="text-xs text-slate-400 block font-bold uppercase">Estilo de Aprendizaje</span>
                        <span className="text-lg font-bold text-indigo-700 mt-2 block">{profile.estiloCognitivo}</span>
                    </div>
                </div>
            </div>

            {/* Main Action Area */}
            {sessionState === 'IDLE' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Topic Bank */}
                    <div className="lg:col-span-2 space-y-6">
                        
                        {/* Weakest Area Alerter */}
                        {weakestArea && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-5 rounded-2xl shadow-sm">
                                <div className="flex gap-3">
                                    <span className="text-2xl">⚠️</span>
                                    <div>
                                        <h4 className="text-sm font-bold text-amber-800">Sugerencia de Refuerzo de Rodilla</h4>
                                        <p className="mt-1 text-sm text-amber-700">
                                            Tu área con menor promedio en este módulo es <strong className="font-bold text-amber-900">{weakestArea.label}</strong> ({weakestArea.score}%). 
                                            Te sugerimos priorizar la práctica de temas en la categoría <strong className="font-bold text-amber-900">{weakestArea.categoryName}</strong>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Interactive Topic Bank */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Banco de Temas Rodilla</h3>
                                    <p className="text-slate-500 text-sm">Selecciona la subunidad o tema para iniciar tu interrogación oral.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {categoriesList.map(cat => {
                                    const progress = getCategoryProgress(cat.name);
                                    const isExpanded = expandedCategory === cat.id;
                                    const catTopics = getTopicsByCategory(cat.name);

                                    return (
                                        <div key={cat.id} className="border border-slate-100 rounded-2xl overflow-hidden transition-all duration-200">
                                            {/* Header */}
                                            <button 
                                                onClick={() => toggleCategory(cat.id)}
                                                className={`w-full flex justify-between items-center p-4 text-left transition-all ${isExpanded ? 'bg-slate-50 border-b border-slate-100' : 'hover:bg-slate-50/55 bg-white'}`}
                                            >
                                                <div>
                                                    <span className="font-bold text-slate-800 text-sm md:text-base">{cat.label}</span>
                                                    <span className="ml-2 text-xs text-slate-500 font-medium">({progress.completed} / {progress.total} completados)</span>
                                                </div>
                                                <span className={`text-slate-400 font-bold text-lg transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                                                    ▶
                                                </span>
                                            </button>

                                            {/* Body */}
                                            {isExpanded && (
                                                <div className="bg-white p-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
                                                    {catTopics.map(topic => {
                                                        const attempt = profile.temas[topic.id];
                                                        const isCompleted = attempt !== undefined;
                                                        return (
                                                            <div 
                                                                key={topic.id}
                                                                onClick={() => {
                                                                    setSelectedTopic(topic);
                                                                    setShowTopicModal(true);
                                                                }}
                                                                className="flex justify-between items-center py-3 px-2 hover:bg-cyan-50/40 rounded-xl cursor-pointer group transition-all duration-150"
                                                            >
                                                                <div className="pr-4 flex-1">
                                                                    <div className="font-semibold text-slate-700 text-sm group-hover:text-cyan-700 transition-colors">
                                                                        {topic.nombre}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-shrink-0">
                                                                    {isCompleted ? (
                                                                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${attempt.ultimoPuntaje >= 4.0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                            Nota: {attempt.ultimoPuntaje.toFixed(1)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-2.5 py-1 text-xs font-semibold rounded-lg border bg-slate-50 text-slate-400 border-slate-200">
                                                                            Pendiente
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Cumulative Radar & Quick Recommendation Button */}
                    <div className="space-y-6">
                        {/* Suggested / Auto Challenge card */}
                        <div className="bg-gradient-to-br from-cyan-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                            <div>
                                <div className="text-3xl mb-3">🦵</div>
                                <h3 className="text-xl font-bold mb-1">Camino de Práctica Inteligente</h3>
                                <p className="text-cyan-200 text-xs leading-relaxed">
                                    Inicia interrogaciones socráticas enfocadas de forma inteligente en tus debilidades actuales en patología de rodilla.
                                </p>
                            </div>
                            <div className="mt-4">
                                <button 
                                    onClick={handleStartSession} 
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-[1.02] active:scale-[0.98] text-sm"
                                >
                                    Iniciar Próximo Reto
                                </button>
                            </div>
                        </div>

                        {/* Cumulative Radar Chart */}
                        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <h4 className="font-bold text-slate-800 text-base mb-1 text-center">Radar de Especialidad</h4>
                            <p className="text-slate-500 text-xs text-center mb-4">Promedio general acumulado del Módulo de Rodilla</p>
                            
                            {histRadar.hasAnyData ? (
                                <div className="h-[280px]">
                                    <ResponsiveRadar
                                        data={cumulativeRadarData}
                                        keys={['score']}
                                        indexBy="subject"
                                        maxValue={100}
                                        margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                                        curve="linearClosed"
                                        borderWidth={2}
                                        borderColor={{ from: 'color' }}
                                        gridLevels={5}
                                        gridShape="circular"
                                        gridLabelOffset={12}
                                        enableDots={true}
                                        dotSize={6}
                                        dotColor={{ theme: 'background' }}
                                        dotBorderWidth={1.5}
                                        dotBorderColor={{ from: 'color' }}
                                        enableDotLabel={true}
                                        dotLabel="value"
                                        dotLabelYOffset={-10}
                                        colors={['#06b6d4']}
                                        fillOpacity={0.25}
                                        blendMode="multiply"
                                        animate={true}
                                    />
                                </div>
                            ) : (
                                <div className="py-12 px-4 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                    <div className="text-3xl mb-2">📊</div>
                                    <p className="text-xs font-medium">Tu radar de rodilla aparecerá aquí una vez que completes tu primera sesión.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Sesión en progreso */}
            {sessionState === 'CONNECTING' && (
                <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-200">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <h3 className="text-xl font-bold text-slate-800">Conectando con el Tutor Académico Especialista...</h3>
                    <p className="text-slate-500">Analizando tu perfil cognitivo y estructurando las 4 etapas clínicas.</p>
                </div>
            )}

            {sessionState === 'IN_PROGRESS' && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-8">
                    <div className="text-center">
                        <div className="flex justify-center gap-3 mb-4">
                            <div className="inline-block px-4 py-1 bg-cyan-100 text-cyan-900 font-bold rounded-full text-sm">
                                Reevaluación de Rodilla Activa
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-4 py-1 bg-slate-100 text-slate-700 font-bold rounded-full text-sm animate-pulse">
                                ⏱️ {formatTime(timer)}
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800 text-xl mb-1">Tema: {currentTopic?.nombre}</h3>
                        <p className="text-slate-500 text-sm">
                            El tutor te guiará. Recuerda que puedes consultarle directamente si te trabas o tienes dudas.
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center py-10">
                        <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeaking ? 'bg-cyan-100 shadow-[0_0_50px_rgba(6,182,212,0.5)] scale-110' : 'bg-slate-100'} ${volume > 0.05 ? 'scale-[1.05]' : ''}`}>
                            <div className={`w-32 h-32 rounded-full transition-all duration-100 flex items-center justify-center text-4xl ${isSpeaking ? 'bg-cyan-500 text-white animate-pulse' : 'bg-slate-200 text-slate-400'} ${volume > 0.1 ? 'scale-[1.1]' : ''}`}>
                                👨‍🏫
                            </div>
                        </div>
                        <p className="mt-8 font-bold text-lg text-slate-700">
                            {connectionState === 'connecting' ? 'Reconectando con el Tutor...' :
                             connectionState === 'error' ? 'Error al reconectar. Intenta nuevamente.' :
                             connectionState === 'disconnected' ? 'Conexión con el tutor perdida.' :
                             isSpeaking ? 'El tutor clínico te está respondiendo...' : 'El tutor te escucha. Plantea tu respuesta o duda.'}
                        </p>
                    </div>

                    <div className="flex gap-4">
                        {connectionState === 'disconnected' ? (
                            <button onClick={connect} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg flex items-center justify-center gap-2">
                                📶 Conexión Perdida: Reconectar y Continuar
                            </button>
                        ) : (
                            <button onClick={toggleMic} className={`flex-1 font-bold py-4 rounded-xl transition-all text-lg ${isMicOpen ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
                                {isMicOpen ? '🔇 Silenciar Micrófono' : '🔊 Hablar'}
                            </button>
                        )}
                        <button onClick={handleEndSession} className="flex-1 bg-cyan-650 hover:bg-cyan-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg">
                            Finalizar y Evaluar
                        </button>
                    </div>

                    {/* Caja de Transcripción */}
                    {transcript.length > 0 && (
                        <div className="mt-8 bg-slate-50 p-6 rounded-2xl border border-slate-200 max-h-80 overflow-y-auto shadow-inner">
                            <h4 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-wider font-mono">Transcripción del Diálogo</h4>
                            <div className="space-y-4">
                                {transcript.map((msg, idx) => (
                                    <div key={idx} className={`p-4 rounded-xl text-sm ${msg.role === 'user' ? 'bg-cyan-50 text-cyan-900 ml-12 shadow-sm border border-cyan-100' : 'bg-white text-slate-800 border border-slate-200 mr-12 shadow-sm'}`}>
                                        <strong className="block text-xs mb-1 opacity-55 uppercase tracking-wide font-bold">{msg.role === 'user' ? 'Tú (Interna)' : 'Tutor Clínico'}</strong>
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
                            <h3 className="text-xl font-bold text-slate-800">Evaluando tu razonamiento clínico...</h3>
                            <p className="text-slate-500">Analizando respuestas y actualizando rúbrica.</p>
                        </div>
                    ) : evaluationResult ? (
                        <div className="space-y-8">
                            <div className="text-center">
                                <h3 className="text-3xl font-bold text-slate-800 mb-2">Evaluación del Módulo</h3>
                                <p className="text-slate-500">Tema: {currentTopic?.nombre}</p>
                                <div className="mt-4 inline-flex items-center justify-center bg-cyan-50 px-6 py-3 rounded-2xl border border-cyan-100">
                                    <span className="text-sm text-cyan-600 font-bold uppercase tracking-widest mr-4">Calificación</span>
                                    <span className="text-4xl font-extrabold text-cyan-700">{evaluationResult.puntaje.toFixed(1)}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="h-[300px]">
                                    <h4 className="font-bold text-center text-slate-700 mb-4">Ejes del Radar</h4>
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
                                        colors={['#06b6d4']}
                                        fillOpacity={0.4}
                                        blendMode="multiply"
                                        animate={true}
                                    />
                                </div>
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="font-bold text-emerald-700 flex items-center gap-2 mb-2">
                                            <span className="text-xl">✅</span> Fortalezas del razonamiento
                                        </h4>
                                        <ul className="list-disc pl-5 text-slate-600 space-y-1 text-sm">
                                            {evaluationResult.feedback.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-red-650 flex items-center gap-2 mb-2">
                                            <span className="text-xl">⚠️</span> Errores y debilidades clínicas
                                        </h4>
                                        {evaluationResult.errores.length > 0 ? (
                                            <ul className="list-disc pl-5 text-slate-600 space-y-1 text-sm">
                                                {evaluationResult.errores.map((e: string, i: number) => <li key={i}>{e}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-slate-500 italic">No se detectaron errores graves en las 4 etapas. ¡Gran desempeño!</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="text-center pt-6 border-t border-slate-100">
                                <button onClick={() => setSessionState('IDLE')} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-md">
                                    Guardar y Finalizar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p>No se pudo procesar la rúbrica.</p>
                            <button onClick={() => setSessionState('IDLE')} className="mt-4 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-6 rounded-lg">
                                Volver
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Detalle de Tema */}
            {showTopicModal && selectedTopic && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
                            <div>
                                <span className="px-2.5 py-0.5 bg-cyan-50 border border-cyan-100 text-cyan-700 font-bold rounded-lg text-xs">
                                    {selectedTopic.categoria}
                                </span>
                                <h3 className="text-lg font-bold text-slate-800 mt-2">{selectedTopic.nombre}</h3>
                            </div>
                            <button 
                                onClick={() => setShowTopicModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 font-mono">Foco de Evaluación</h4>
                                <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                                    {selectedTopic.contenidoBase}
                                </p>
                            </div>

                            {/* Historial de Errores */}
                            {profile.temas[selectedTopic.id]?.erroresHistoricos && profile.temas[selectedTopic.id].erroresHistoricos.length > 0 && (
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                    <h4 className="text-xs font-bold text-red-800 flex items-center gap-1.5 mb-1.5">
                                        <span>⚠️</span> Historial de Errores Previos:
                                    </h4>
                                    <ul className="list-disc pl-5 text-red-700 text-xs space-y-1">
                                        {profile.temas[selectedTopic.id].erroresHistoricos.map((err, i) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Estadísticas de Intentos */}
                            {profile.temas[selectedTopic.id] && (
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Intentos Realizados</span>
                                        <span className="text-lg font-bold text-slate-700 mt-0.5 block">{profile.temas[selectedTopic.id].vecesCompletado}</span>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nota Promedio</span>
                                        <span className="text-lg font-bold text-slate-700 mt-0.5 block">{profile.temas[selectedTopic.id].puntajePromedio.toFixed(1)}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                            <button 
                                onClick={() => setShowTopicModal(false)}
                                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-all text-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleStartTopicSession(selectedTopic)}
                                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] text-sm"
                            >
                                Iniciar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
