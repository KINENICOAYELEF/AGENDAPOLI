'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { HIP_TOPICS, HipTopic } from '../utils/hipTopics';
import { generateHipSocraticPrompt } from '../utils/hipPrompts';
import { 
    getUserTrainingProfile, 
    getDetailedStudentTrainingProfiles, 
    saveTrainingSession, 
    UserTrainingProfile, 
    StudentTrainingView,
    TopicProgress 
} from '../services/entrenamientoFirebase';
import { getSuperProfile, getAllSuperProfiles } from '../services/superProfileService';
import { SuperProfile } from '../types/superProfile';
import { 
    Activity, ShieldAlert, RefreshCw, Mic, MicOff, CheckCircle2, 
    ChevronRight, ChevronDown, Search, Sparkles, AlertTriangle, FileText, 
    History, X, Award, Calendar, Clock, ArrowRight, ArrowLeft, BookOpen, Layers, Users, ShieldCheck, Filter, User
} from 'lucide-react';

export default function EntrenamientoClinicoVoz() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'TEMARIO' | 'MI_HISTORIAL' | 'SUPERVISION' | 'ANTIGRAVITY_AGENT'>('TEMARIO');

    // Profiles & Firebase data
    const [myProfile, setMyProfile] = useState<UserTrainingProfile | null>(null);
    const [superProfile, setSuperProfile] = useState<SuperProfile | null>(null);
    const [allSuperProfiles, setAllSuperProfiles] = useState<SuperProfile[]>([]);
    const [studentViews, setStudentViews] = useState<StudentTrainingView[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [loadingData, setLoadingData] = useState(true);

    // Session state
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    // Topic & Mode selection
    const [currentTopic, setCurrentTopic] = useState<HipTopic>(HIP_TOPICS[0]);
    const [mode, setMode] = useState<'TUTOR' | 'EXAMEN'>('TUTOR');

    // UI Accordion States - Todos colapsados por defecto para una vista limpia
    const [openZone, setOpenZone] = useState<string>('');
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'Coxartrosis': false,
        'Artroplastia (PTC)': false,
        'Evaluación Post-Artroplastia': false,
        'FAI y Labrum': false,
        'Displasia e Inestabilidad': false,
        'Dolor Lateral de Cadera': false,
        'Dolor Inguinal y Extraarticular': false,
        'Geriatría y Fractura de Cadera': false,
        'Cadera Pediátrica y Deportiva': false,
        'Neuropatías Periféricas': false,
        'Criterios Avanzados de RTP': false
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [timer, setTimer] = useState(0);

    // Real AI Evaluation State
    const [evaluating, setEvaluating] = useState(false);
    const [evalResult, setEvalResult] = useState<{
        topicId: string;
        topicNombre: string;
        puntaje: number;
        feedback: string[];
        errores: string[];
        transcriptText: string;
    } | null>(null);

    useEffect(() => {
        if (user) {
            loadInitialData();
        }
    }, [user]);

    const loadInitialData = async () => {
        if (!user) return;
        setLoadingData(true);
        try {
            const profileData = await getUserTrainingProfile(user.uid);
            setMyProfile(profileData);

            const sp = await getSuperProfile(user.uid, user.displayName || 'Interno');
            setSuperProfile(sp);

            const allSp = await getAllSuperProfiles();
            setAllSuperProfiles(allSp);

            if (user.role === 'DOCENTE') {
                const students = await getDetailedStudentTrainingProfiles();
                setStudentViews(students);
                if (students.length > 0) {
                    setSelectedStudentId(students[0].profile.userId);
                }
            }
        } catch (error) {
            console.error("Error cargando datos de entrenamiento:", error);
        } finally {
            setLoadingData(false);
        }
    };

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (sessionState === 'IN_PROGRESS') {
            interval = setInterval(() => {
                setTimer(prev => prev + 1);
            }, 1000);
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

    const {
        connect,
        disconnect,
        connectionState,
        isSpeaking,
        isMicOpen,
        toggleMic,
        transcript,
        clearTranscript
    } = useGeminiLive({
        systemInstruction: currentTopic 
            ? generateHipSocraticPrompt(
                currentTopic, 
                myProfile?.temas[currentTopic.id]?.erroresHistoricos || [], 
                myProfile?.estiloCognitivo || 'NEUTRO',
                user?.displayName ? user.displayName.split(' ')[0] : 'Docente',
                mode,
                superProfile?.miniPromptDinamico
              )
            : '',
        voiceName: 'Puck'
    });

    const bodyZones = [
        { name: 'Cadera', active: true, topicCount: 32, badge: 'Disponible' },
        { name: 'Rodilla', active: false, topicCount: 0, badge: 'Próximamente' },
        { name: 'Hombro', active: false, topicCount: 0, badge: 'Próximamente' },
        { name: 'Columna Lumbar', active: false, topicCount: 0, badge: 'Próximamente' },
        { name: 'Columna Cervical', active: false, topicCount: 0, badge: 'Próximamente' },
        { name: 'Tobillo y Pie', active: false, topicCount: 0, badge: 'Próximamente' },
        { name: 'Codo y Muñeca', active: false, topicCount: 0, badge: 'Próximamente' }
    ];

    const categories = [
        'Coxartrosis', 
        'Artroplastia (PTC)', 
        'Evaluación Post-Artroplastia', 
        'FAI y Labrum', 
        'Displasia e Inestabilidad', 
        'Dolor Lateral de Cadera', 
        'Dolor Inguinal y Extraarticular'
    ];

    const toggleCategory = (cat: string) => {
        setOpenCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
    };

    const handleStartSession = async (topic: HipTopic) => {
        setCurrentTopic(topic);
        setSessionState('CONNECTING');
        setTimer(0);
        clearTranscript();
        try {
            await connect();
            setSessionState('IN_PROGRESS');
        } catch (error) {
            console.error("Error al conectar Gemini Live:", error);
            setSessionState('IDLE');
        }
    };

    const handleReconnect = async () => {
        setSessionState('CONNECTING');
        try {
            await connect();
            setSessionState('IN_PROGRESS');
        } catch (error) {
            console.error("Error al reconectar Gemini Live:", error);
        }
    };

    const handleEndSession = async () => {
        disconnect();
        setEvaluating(true);
        setSessionState('COMPLETED');

        const activeTopic = currentTopic;
        const fullText = transcript.map(t => `${t.role === 'user' ? 'Alumno' : 'Tutor Orion'}: ${t.text}`).join('\n');

        let notaCalculada = 4.0;
        let fortalezas: string[] = [];
        let aspectosReforzar: string[] = [];
        let cleanedTranscriptText = fullText;
        let radarObj = { biomecanica: 50, diagnostico: 50, neurofisiologia: 50, dosificacion: 50, terapiaManual: 50 };
        let estiloCognitivo = 'NEUTRO';

        try {
            if (fullText.trim().length > 20) {
                const response = await fetch('/api/ai/simulador', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'evaluate-training',
                        userId: user?.uid || 'guest',
                        payload: { transcript: fullText }
                    })
                });

                if (response.ok) {
                    const json = await response.json();
                    if (json.success && json.data) {
                        const d = json.data;
                        notaCalculada = typeof d.puntaje === 'number' ? d.puntaje : 4.0;
                        fortalezas = Array.isArray(d.feedback) ? d.feedback : [];
                        aspectosReforzar = Array.isArray(d.errores) ? d.errores : [];
                        cleanedTranscriptText = d.cleanedTranscript || fullText;
                        if (d.radarScores) radarObj = d.radarScores;
                        if (d.estiloCognitivoSugerido) estiloCognitivo = d.estiloCognitivoSugerido;
                    }
                }
            }

            setEvalResult({
                topicId: activeTopic.id,
                topicNombre: activeTopic.nombre,
                puntaje: notaCalculada,
                feedback: fortalezas,
                errores: aspectosReforzar,
                transcriptText: cleanedTranscriptText
            });

            if (user) {
                await saveTrainingSession(
                    user.uid,
                    activeTopic.id,
                    notaCalculada,
                    aspectosReforzar,
                    radarObj,
                    estiloCognitivo,
                    cleanedTranscriptText,
                    fortalezas
                );

                // Disparo de síntesis del Super Perfil Longitudinal en segundo plano
                fetch('/api/ai/super-profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'SYNTHESIZE',
                        userId: user.uid,
                        estudianteNombre: user.displayName || 'Interno',
                        recentTranscript: cleanedTranscriptText,
                        recentErrors: aspectosReforzar
                    })
                }).catch(e => console.error("Error en síntesis background de SuperProfile:", e));

                await loadInitialData();
            }
        } catch (err) {
            console.error("Error evaluando sesión con IA:", err);
            setEvalResult({
                topicId: activeTopic.id,
                topicNombre: activeTopic.nombre,
                puntaje: 4.0,
                feedback: ["Sesión finalizada y registrada."],
                errores: ["Revisar transcripción para detalles."],
                transcriptText: fullText
            });
        } finally {
            setEvaluating(false);
        }
    };

    const handleCancelSession = () => {
        const confirmExit = window.confirm(
            "¿Estás seguro de que deseas salir de la sesión de práctica activa?\n\nAl salir regresarás al temario de temas EBM."
        );
        if (confirmExit) {
            disconnect();
            setSessionState('IDLE');
        }
    };

    // Manejo de Intercepción del Botón Atrás del Navegador y Cierre Accidental
    useEffect(() => {
        if (sessionState === 'IN_PROGRESS' || sessionState === 'CONNECTING') {
            // Insertar estado ficticio para atrapar el botón atrás del navegador
            window.history.pushState({ inSimulationSession: true }, '', window.location.href);

            const handlePopState = () => {
                const confirmExit = window.confirm(
                    "¿Estás seguro de que deseas salir de la práctica en curso?\n\nAl salir regresarás al temario de temas EBM sin perderte en el Dashboard."
                );

                if (confirmExit) {
                    disconnect();
                    setSessionState('IDLE');
                } else {
                    // Si cancela, re-insertamos la trampa para mantener protegido el botón atrás
                    window.history.pushState({ inSimulationSession: true }, '', window.location.href);
                }
            };

            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                e.preventDefault();
                e.returnValue = '';
            };

            window.addEventListener('popstate', handlePopState);
            window.addEventListener('beforeunload', handleBeforeUnload);

            return () => {
                window.removeEventListener('popstate', handlePopState);
                window.removeEventListener('beforeunload', handleBeforeUnload);
            };
        }
    }, [sessionState, disconnect]);

    const isDisconnectedOrTimeout = connectionState === 'disconnected' || connectionState === 'error' || timer >= 600;

    // Active student view for Docente tab
    const selectedStudentView = studentViews.find(s => s.profile?.userId === selectedStudentId) || studentViews[0];

    // Helper: Filtrar ÚNICAMENTE temas EBM de este módulo y agruparlos por Categoría
    const ebmTopicSet = new Set(HIP_TOPICS.map(t => t.id));
    const groupTemasByCategory = (temasObj?: Record<string, TopicProgress>) => {
        if (!temasObj) return {};
        const ebmTemas = Object.values(temasObj).filter(t => ebmTopicSet.has(t.topicId));
        const grouped: Record<string, { topicProg: TopicProgress; topicInfo: HipTopic }[]> = {};
        
        ebmTemas.forEach((t) => {
            const topicInfo = HIP_TOPICS.find(ht => ht.id === t.topicId);
            if (topicInfo) {
                const cat = topicInfo.categoria;
                if (!grouped[cat]) grouped[cat] = [];
                grouped[cat].push({ topicProg: t, topicInfo });
            }
        });
        return grouped;
    };

    const myTemasGrouped = groupTemasByCategory(myProfile?.temas);
    const myEbmTemasFlat = Object.values(myTemasGrouped).flat();
    const completedTopicsCount = myEbmTemasFlat.length;
    const avgGrade = completedTopicsCount > 0 
        ? (myEbmTemasFlat.reduce((acc, item) => acc + (item.topicProg.ultimoPuntaje ?? 0), 0) / completedTopicsCount).toFixed(1)
        : 'N/A';

    return (
        <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6">
            {/* Header Principal de Plataforma (Tema Claro Coherente) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase tracking-wider flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Módulo de Simulación Clínica EBM
                        </span>
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wider">
                            32 Temas EBM Activos
                        </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Activity className="w-7 h-7 text-indigo-600 shrink-0" />
                        Entrenamiento Clínico por Voz
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                        Práctica interactiva socrática de razonamiento clínico basada en evidencia científica y guías internacionales.
                    </p>
                </div>

                {/* Navegación por Pestañas */}
                <div className="bg-slate-100 p-1.5 rounded-xl border border-slate-200 flex flex-wrap gap-1 w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab('TEMARIO')}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'TEMARIO' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>Temario y Práctica</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('MI_HISTORIAL')}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'MI_HISTORIAL' ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <History className="w-4 h-4 text-amber-600" />
                        <span>Mi Historial</span>
                    </button>

                    {user?.role === 'DOCENTE' && (
                        <button
                            onClick={() => setActiveTab('SUPERVISION')}
                            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === 'SUPERVISION' ? 'bg-white text-purple-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Users className="w-4 h-4 text-purple-600" />
                            <span>Supervisión Docente</span>
                        </button>
                    )}

                    <button
                        onClick={async () => {
                            setActiveTab('ANTIGRAVITY_AGENT');
                            const allSp = await getAllSuperProfiles();
                            setAllSuperProfiles(allSp);
                        }}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === 'ANTIGRAVITY_AGENT' ? 'bg-indigo-600 text-white shadow-md ring-1 ring-indigo-500' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                        }`}
                    >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>Agente Antigravity EBM</span>
                    </button>
                </div>
            </div>

            {/* SESIÓN EN CURSO / LLAMADA ACTIVA */}
            {sessionState === 'IN_PROGRESS' || sessionState === 'CONNECTING' ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 sm:p-8 text-white space-y-6 shadow-xl">
                    {/* Alerta de Desconexión a los 10 Minutos */}
                    {isDisconnectedOrTimeout && (
                        <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 text-red-900 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-sm text-red-900">Llamada de voz pausada o tiempo límite alcanzado</h4>
                                    <p className="text-xs text-red-700">Haz clic en reconectar para continuar sin perder tu avance en este tema.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleReconnect}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shadow-sm flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Reconectar Llamada Ahora</span>
                            </button>
                        </div>
                    )}

                    {/* Top Bar Llamada */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleCancelSession}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 shadow-sm shrink-0"
                                title="Volver a la selección de temas EBM"
                            >
                                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                                <span>Volver al Temario</span>
                            </button>

                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800 uppercase">
                                        {currentTopic.categoria}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {mode === 'EXAMEN' ? 'Modo Examen Estricto' : 'Modo Tutor Formativo'}
                                    </span>
                                </div>
                                <h2 className="text-xl font-bold text-white mt-1">{currentTopic.nombre}</h2>
                            </div>
                        </div>

                        <div className="bg-slate-950 border border-slate-800 px-4 py-2 rounded-xl text-right">
                            <span className={`text-2xl font-mono font-black ${timer >= 540 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`}>
                                {formatTime(timer)}
                            </span>
                            <span className="text-[10px] text-slate-500 block font-bold uppercase">Tiempo Transcurrido</span>
                        </div>
                    </div>

                    {/* Audio Visualizer */}
                    <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center space-y-3">
                        <div className="flex justify-center items-center gap-2 h-16">
                            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((bar) => (
                                <div 
                                    key={bar} 
                                    className={`w-2 rounded-full transition-all duration-100 ${
                                        isSpeaking 
                                            ? 'bg-indigo-500 animate-pulse' 
                                            : isMicOpen 
                                                ? 'bg-emerald-500' 
                                                : 'bg-slate-800'
                                    }`}
                                    style={{ height: isSpeaking || isMicOpen ? `${Math.max(16, Math.sin(bar + timer * 2) * 50)}px` : '12px' }}
                                />
                            ))}
                        </div>

                        <p className="text-xs font-semibold text-slate-300">
                            {isSpeaking ? 'Tutor Orion hablando...' : isMicOpen ? 'Micrófono abierto. Responde oralmente...' : 'Micrófono silenciado'}
                        </p>
                    </div>

                    {/* Transcripción en Vivo */}
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            Diálogo Transcrito en Tiempo Real
                        </span>

                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 max-h-56 overflow-y-auto custom-scrollbar space-y-2">
                            {transcript.length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center py-6">Iniciando diálogo por voz con el Tutor Orion...</p>
                            ) : (
                                transcript.map((msg, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                                            msg.role === 'user' 
                                                ? 'bg-indigo-950 border border-indigo-800 text-indigo-100 ml-8 text-right' 
                                                : 'bg-slate-900 border border-slate-800 text-slate-200 mr-8'
                                        }`}
                                    >
                                        <span className="font-bold block text-[10px] uppercase opacity-70 mb-1">
                                            {msg.role === 'user' ? 'Estudiante' : 'Tutor Orion'}
                                        </span>
                                        {msg.text}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Banner de Examen Concluido en Vivo */}
                    {transcript.some(t => t.text.toLowerCase().includes('examen finalizado') || t.text.toLowerCase().includes('ha concluido')) && (
                        <div className="bg-gradient-to-r from-emerald-600 to-indigo-600 text-white p-4 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg border border-emerald-400 animate-pulse">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-200 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider">¡Evaluación Concluida! La IA ha cerrado el examen por voz.</span>
                            </div>
                            <button 
                                onClick={handleEndSession} 
                                className="bg-white text-emerald-950 px-5 py-2 rounded-lg text-xs font-black hover:bg-emerald-50 uppercase tracking-wider shadow-sm transition transform hover:scale-105"
                            >
                                Ver Dictamen y Nota Final
                            </button>
                        </div>
                    )}

                    {/* Botones */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <button
                            onClick={toggleMic}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                                isMicOpen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            }`}
                        >
                            {isMicOpen ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            <span>{isMicOpen ? 'Micrófono Encendido' : 'Micrófono Mutear'}</span>
                        </button>

                        <button
                            onClick={handleEndSession}
                            className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition flex items-center gap-2 shadow-sm"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Finalizar Evaluación</span>
                        </button>
                    </div>
                </div>
            ) : sessionState === 'COMPLETED' ? (
                /* REPORTE DE RESULTADOS DE EVALUACIÓN CON IA */
                evaluating ? (
                    <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                        <h3 className="text-lg font-bold text-slate-900">Analizando desempeño clínico con IA...</h3>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            La Inteligencia Artificial está evaluando la transcripción completa de tu diálogo socrático, calculando tu nota (1.0 a 7.0) y generando tus fortalezas y errores conceptuales.
                        </p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                            <div>
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-200 uppercase">
                                    Sesión Finalizada y Almacenada en Registro Clínico
                                </span>
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                                    {evalResult?.topicNombre || currentTopic.nombre}
                                </h2>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                                <span className={`text-3xl font-black ${
                                    (evalResult?.puntaje ?? 4.0) >= 4.0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}>
                                    {(evalResult?.puntaje ?? 4.0).toFixed(1)}
                                </span>
                                <span className="text-[10px] text-slate-500 block font-bold uppercase">Nota Obtenida (Escala 1.0 - 7.0)</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2">
                                <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Fortalezas Demostradas
                                </span>
                                {(!evalResult?.feedback || evalResult.feedback.length === 0) ? (
                                    <p className="text-xs text-slate-600 italic">No se registraron fortalezas destacadas en este intento.</p>
                                ) : (
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                        {evalResult.feedback.map((f, i) => (
                                            <li key={i}>{f}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-2">
                                <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    Aspectos a Reforzar
                                </span>
                                {(!evalResult?.errores || evalResult.errores.length === 0) ? (
                                    <p className="text-xs text-slate-600 italic">No se registraron errores conceptuales severos.</p>
                                ) : (
                                    <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                                        {evalResult.errores.map((e, i) => (
                                            <li key={i}>{e}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-indigo-600" />
                                Diálogo Transcrito Completo (Procesado por IA)
                            </span>
                            <div className="max-h-48 overflow-y-auto custom-scrollbar text-xs text-slate-700 space-y-2 p-3 bg-white rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                                {evalResult?.transcriptText || transcript.map(t => `${t.role === 'user' ? 'Estudiante' : 'Tutor Orion'}: ${t.text}`).join('\n')}
                            </div>
                        </div>

                        <div className="flex justify-between gap-3 pt-2">
                            <button
                                onClick={() => setSessionState('IDLE')}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-xs font-bold transition border border-slate-200"
                            >
                                Volver al Temario
                            </button>

                            <button
                                onClick={() => handleStartSession(currentTopic)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold uppercase transition shadow-sm flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span>Practicar Este Tema de Nuevo</span>
                            </button>
                        </div>
                    </div>
                )
            ) : (
                /* VISTAS DE PESTAÑAS */
                <>
                    {/* TAB 1: TEMARIO Y PRÁCTICA (HUB MULTI-ZONA) */}
                    {activeTab === 'TEMARIO' && (
                        <div className="space-y-6">
                            {/* Selector de Modo Tutor / Examen */}
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-slate-900">Modo de Práctica Activo</h3>
                                    <p className="text-xs text-slate-500">Selecciona cómo deseas que el Tutor Orion interactúe durante la llamada.</p>
                                </div>

                                <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 flex gap-1">
                                    <button
                                        onClick={() => setMode('TUTOR')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            mode === 'TUTOR' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600'
                                        }`}
                                    >
                                        Modo A: Tutor Formativo
                                    </button>
                                    <button
                                        onClick={() => setMode('EXAMEN')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                            mode === 'EXAMEN' ? 'bg-white text-rose-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-600'
                                        }`}
                                    >
                                        Modo B: Examen Estricto
                                    </button>
                                </div>
                            </div>

                            {/* Acordeón de Zonas Corporales */}
                            <div className="space-y-3">
                                {bodyZones.map((zone) => (
                                    <div 
                                        key={zone.name} 
                                        className={`rounded-2xl border transition-all overflow-hidden ${
                                            zone.active 
                                                ? 'bg-white border-indigo-200 shadow-sm' 
                                                : 'bg-slate-50/70 border-slate-200 opacity-75'
                                        }`}
                                    >
                                        {/* Header de Zona */}
                                        <div 
                                            onClick={() => zone.active && setOpenZone(openZone === zone.name ? '' : zone.name)}
                                            className={`p-4 flex items-center justify-between cursor-pointer select-none ${
                                                zone.active ? 'hover:bg-slate-50' : 'cursor-not-allowed'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl ${zone.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-400'}`}>
                                                    <Activity className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="text-base font-bold text-slate-900">{zone.name}</h3>
                                                    <p className="text-xs text-slate-500">
                                                        {zone.active ? `${zone.topicCount} Temas Estructurados EBM` : 'Estaciones de evaluación en preparación'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase border ${
                                                    zone.active 
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                        : 'bg-slate-200 text-slate-600 border-slate-300'
                                                }`}>
                                                    {zone.badge}
                                                </span>
                                                {zone.active && (
                                                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openZone === zone.name ? 'rotate-180' : ''}`} />
                                                )}
                                            </div>
                                        </div>

                                        {/* Contenido de Zona Activa (Cadera) */}
                                        {zone.active && openZone === zone.name && (
                                            <div className="p-4 pt-0 border-t border-slate-100 space-y-4">
                                                {/* Buscador de temas dentro de la zona */}
                                                <div className="relative pt-3">
                                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-6" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar por concepto EBM o diagnóstico..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-xs rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-100 outline-none"
                                                    />
                                                </div>

                                                {/* Sub-acordeones por Categoría */}
                                                <div className="space-y-3">
                                                    {categories.map((cat) => {
                                                        const catTopics = HIP_TOPICS.filter(t => 
                                                            t.categoria === cat &&
                                                            (searchQuery === '' || t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || t.contenidoBase.toLowerCase().includes(searchQuery.toLowerCase()))
                                                        );

                                                        if (catTopics.length === 0) return null;

                                                        const isOpen = openCategories[cat];

                                                        return (
                                                            <div key={cat} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
                                                                <button
                                                                    onClick={() => toggleCategory(cat)}
                                                                    className="w-full text-left p-3.5 bg-white hover:bg-slate-50 transition flex items-center justify-between border-b border-slate-200"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-bold text-slate-800">{cat}</span>
                                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                                            {catTopics.length} temas
                                                                        </span>
                                                                    </div>
                                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                                </button>

                                                                {isOpen && (
                                                                    <div className="p-3 space-y-3 bg-white">
                                                                        {catTopics.map((t) => {
                                                                            const topicProg = myProfile?.temas[t.id];
                                                                            const isCompleted = topicProg && topicProg.vecesCompletado > 0;
                                                                            const isSelected = currentTopic.id === t.id;

                                                                            return (
                                                                                <div 
                                                                                    key={t.id} 
                                                                                    className={`p-4 rounded-xl border transition-all ${
                                                                                        isSelected 
                                                                                            ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-200' 
                                                                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                                                                    }`}
                                                                                >
                                                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                                                        <div>
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className="text-[10px] font-bold text-slate-500 uppercase">{t.id}</span>
                                                                                                {isCompleted && (
                                                                                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                                                                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                                                        Nota {topicProg.ultimoPuntaje.toFixed(1)} ({topicProg.vecesCompletado} intentos)
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                            <h4 className="text-sm font-bold text-slate-900 mt-1">{t.nombre}</h4>
                                                                                        </div>

                                                                                        <button
                                                                                            onClick={() => handleStartSession(t)}
                                                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                                                                                        >
                                                                                            <Mic className="w-3.5 h-3.5" />
                                                                                            <span>Iniciar Práctica</span>
                                                                                        </button>
                                                                                    </div>

                                                                                    {/* Contenido Base Desplegable */}
                                                                                    <details className="mt-3 text-xs text-slate-600">
                                                                                        <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-700 select-none">
                                                                                            Ver Mini-Prompt y Contenido Base EBM
                                                                                        </summary>
                                                                                        <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200 whitespace-pre-line text-[11px] leading-relaxed">
                                                                                            {t.contenidoBase}
                                                                                        </div>
                                                                                    </details>
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
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: MI HISTORIAL PERSONAL */}
                    {activeTab === 'MI_HISTORIAL' && (
                        <div className="space-y-6">
                            {/* KPI Summary Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Temas Completados</span>
                                        <span className="text-xl font-black text-slate-900 block leading-tight">{completedTopicsCount} / 32</span>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Nota Promedio Global</span>
                                        <span className="text-xl font-black text-slate-900 block leading-tight">{avgGrade}</span>
                                    </div>
                                </div>

                                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                                        <Clock className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sesiones esta Semana</span>
                                        <span className="text-xl font-black text-slate-900 block leading-tight">{myProfile?.sesionesCompletadasEstaSemana || 0}</span>
                                    </div>
                                </div>
                            </div>

                             {/* Lista de Historial Organizado por Módulo */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <History className="w-5 h-5 text-amber-600" />
                                    <span>Registro Personal de Intentos Guardados en Entrenamiento Clínico EBM</span>
                                </h3>

                                {Object.keys(myTemasGrouped).length === 0 ? (
                                    <p className="text-xs text-slate-500 py-8 text-center">Aún no has completado ninguna sesión de práctica en este módulo.</p>
                                ) : (
                                    <div className="space-y-6">
                                        {Object.entries(myTemasGrouped).map(([catName, items]) => (
                                            <div key={catName} className="space-y-3">
                                                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                                                    <BookOpen className="w-4 h-4 text-indigo-600" />
                                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">{catName}</h4>
                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold ml-auto">{items.length} temas</span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    {items.map(({ topicProg: t, topicInfo }) => {
                                                        const puntajeFmt = typeof t.ultimoPuntaje === 'number' ? t.ultimoPuntaje.toFixed(1) : 'N/A';

                                                        return (
                                                            <div key={t.topicId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                                <div className="flex items-center justify-between">
                                                                    <div>
                                                                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 uppercase">
                                                                            {t.topicId}
                                                                        </span>
                                                                        <h5 className="text-xs font-bold text-slate-900 mt-1">{topicInfo.nombre}</h5>
                                                                    </div>

                                                                    <div className="text-right shrink-0 ml-4">
                                                                        <span className="text-base font-black text-emerald-600">{puntajeFmt}</span>
                                                                        <span className="text-[10px] text-slate-400 block">{t.vecesCompletado ?? 1} intentos</span>
                                                                    </div>
                                                                </div>

                                                                {t.ultimoTranscript && (
                                                                    <details className="text-xs text-slate-600 pt-1">
                                                                        <summary className="cursor-pointer font-bold text-indigo-600 hover:text-indigo-700 select-none">
                                                                            Ver Transcripción Completa del Diálogo por Voz
                                                                        </summary>
                                                                        <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 font-mono text-[11px] max-h-40 overflow-y-auto">
                                                                            {t.ultimoTranscript}
                                                                        </div>
                                                                    </details>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 3: SUPERVISIÓN DOCENTE (DOCENTE ONLY) */}
                    {activeTab === 'SUPERVISION' && user?.role === 'DOCENTE' && (
                        <div className="space-y-6">
                            {/* Selector de Estudiante */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                            <ShieldCheck className="w-5 h-5 text-purple-600" />
                                            <span>Panel de Auditoría y Desempeño de Estudiantes</span>
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1">Supervisa los avances, notas e transcripciones de voz registradas en Firestore (Módulo EBM Cadera).</p>
                                    </div>

                                    <select
                                        value={selectedStudentId}
                                        onChange={(e) => setSelectedStudentId(e.target.value)}
                                        className="bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-purple-200 outline-none cursor-pointer w-full sm:w-auto"
                                    >
                                        {studentViews.map(sv => {
                                            const studentGrouped = groupTemasByCategory(sv.profile?.temas);
                                            const studentEbmCount = Object.values(studentGrouped).flat().length;
                                            return (
                                                <option key={sv.profile?.userId || sv.email} value={sv.profile?.userId}>
                                                    {sv.displayName} ({sv.email}) — {studentEbmCount} temas EBM
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Detalle del Estudiante Seleccionado Organizado por Módulo */}
                                {selectedStudentView && (() => {
                                    const studentGrouped = groupTemasByCategory(selectedStudentView.profile?.temas);
                                    const studentEbmTemasFlat = Object.values(studentGrouped).flat();
                                    const nameInitials = (selectedStudentView.displayName || 'US').substring(0, 2).toUpperCase();

                                    return (
                                        <div className="space-y-6 pt-2">
                                            <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200 flex flex-wrap items-center justify-between gap-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-purple-200 text-purple-800 flex items-center justify-center font-bold text-sm">
                                                        {nameInitials}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-purple-950">{selectedStudentView.displayName}</h4>
                                                        <p className="text-xs text-purple-700">{selectedStudentView.email} • Rol: {selectedStudentView.role}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 text-right">
                                                    <div>
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">Temas EBM Practicados</span>
                                                        <span className="text-lg font-black text-purple-950">{studentEbmTemasFlat.length} / 32</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lista de temas del estudiante agrupados por módulo */}
                                            {Object.keys(studentGrouped).length === 0 ? (
                                                <p className="text-xs text-slate-500 py-8 text-center">Este estudiante aún no ha completado sesiones en este módulo EBM.</p>
                                            ) : (
                                                <div className="space-y-6">
                                                    {Object.entries(studentGrouped).map(([catName, items]) => (
                                                        <div key={catName} className="space-y-3">
                                                            <div className="flex items-center gap-2 border-b border-purple-200 pb-2">
                                                                <BookOpen className="w-4 h-4 text-purple-700" />
                                                                <h5 className="text-xs font-black text-purple-950 uppercase tracking-wider">{catName}</h5>
                                                                <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-semibold ml-auto">{items.length} temas</span>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-3">
                                                                {items.map(({ topicProg: t, topicInfo }) => {
                                                                    const puntajeFmt = typeof t.ultimoPuntaje === 'number' ? t.ultimoPuntaje.toFixed(1) : 'N/A';

                                                                    return (
                                                                        <div key={t.topicId} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                                                                            <div className="flex items-center justify-between">
                                                                                <div>
                                                                                    <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 uppercase">
                                                                                        {t.topicId}
                                                                                    </span>
                                                                                    <h6 className="text-xs font-bold text-slate-900 mt-1">{topicInfo.nombre}</h6>
                                                                                </div>

                                                                                <div className="text-right shrink-0 ml-4">
                                                                                    <span className="text-base font-black text-emerald-600">{puntajeFmt}</span>
                                                                                    <span className="text-[10px] text-slate-400 block">{t.vecesCompletado ?? 1} intentos</span>
                                                                                </div>
                                                                            </div>

                                                                            {t.ultimoTranscript && (
                                                                                <details className="text-xs text-slate-600 pt-1">
                                                                                    <summary className="cursor-pointer font-bold text-purple-700 hover:text-purple-800 select-none">
                                                                                        Ver Transcripción Completa del Estudiante
                                                                                    </summary>
                                                                                    <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200 font-mono text-[11px] max-h-40 overflow-y-auto">
                                                                                        {t.ultimoTranscript}
                                                                                    </div>
                                                                                </details>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* PESTAÑA 4: AGENTE ANTIGRAVITY EBM (TELEMETRÍA, SUPER PERFILES Y LOGS) */}
                    {activeTab === 'ANTIGRAVITY_AGENT' && (
                        <div className="space-y-6">
                            {/* Card de Estado del Agente Antigravity */}
                            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl border border-indigo-500/30 p-6 text-white shadow-xl space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-800/50 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-black tracking-tight text-white">Google Antigravity Managed Agent Engine</h3>
                                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                                                    ACTIVE / MONITORING
                                                </span>
                                            </div>
                                            <p className="text-xs text-indigo-200/80 font-mono mt-0.5">
                                                Agent Identifier: <code className="text-amber-300 font-bold">agents/antigravity-clinical-evaluator</code> • Endpoint: <code className="text-indigo-300 font-bold">v1beta/agents</code>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 bg-indigo-900/40 border border-indigo-700/40 px-3 py-1.5 rounded-lg text-xs font-mono text-indigo-200">
                                        <Activity className="w-4 h-4 text-emerald-400" />
                                        <span>Quota Bucket: Free Tier Google AI (100 req/day)</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-medium">
                                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Agent Identifier</span>
                                        <span className="text-sm font-bold text-amber-300 font-mono">antigravity-preview-05-2026</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">REST Endpoint</span>
                                        <span className="text-sm font-bold text-indigo-300 font-mono">/v1beta/interactions</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Deep Research & Skills</span>
                                        <span className="text-sm font-bold text-emerald-400 font-mono">4 Active Skills</span>
                                    </div>
                                    <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Alumnos en Supervisión</span>
                                        <span className="text-sm font-bold text-white font-mono">{allSuperProfiles.length} Registrados</span>
                                    </div>
                                </div>

                                {/* Inspección de Payload REST HTTP nativo */}
                                <div className="bg-slate-950 p-4 rounded-xl border border-indigo-900/60 font-mono text-xs space-y-2">
                                    <div className="flex items-center justify-between text-indigo-300 font-bold">
                                        <span className="flex items-center gap-1.5 text-[11px] text-amber-300 uppercase tracking-wider">
                                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                            Google Antigravity REST HTTP Interaction Protocol
                                        </span>
                                        <span className="text-[10px] text-slate-400">Header: x-goog-api-key</span>
                                    </div>
                                    <pre className="text-[11px] text-indigo-200/90 overflow-x-auto p-2.5 bg-slate-900/90 rounded border border-slate-800">
{`POST https://generativelanguage.googleapis.com/v1beta/interactions
Headers: { "Content-Type": "application/json", "x-goog-api-key": "process.env.GEMINI_API_KEY" }
Body: {
  "agent": "antigravity-preview-05-2026",
  "input": [{ "type": "text", "text": prompt }],
  "environment": { "type": "remote" }
}`}
                                    </pre>
                                </div>
                            </div>

                            {/* EXPLICACIÓN VISUAL: ¿CÓMO OPERA EL SERVICIO DE ANTIGRAVITY EN ESTA PLATAFORMA? */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Layers className="w-5 h-5 text-indigo-600" />
                                    ¿Cómo opera el servicio de Antigravity en esta Plataforma?
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center">1</div>
                                        <h4 className="text-xs font-bold text-slate-900">Captura Multimódulo</h4>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">
                                            Recopila transcripciones de Voz socrática, Examen Escrito, OSCE y Defensa de Comisión.
                                        </p>
                                    </div>

                                    <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-purple-600 text-white font-black text-xs flex items-center justify-center">2</div>
                                        <h4 className="text-xs font-bold text-slate-900">Llamada REST a Antigravity</h4>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">
                                            Envía el historial al endpoint <code className="text-purple-700 font-mono">/v1beta/interactions</code> usando el agente <code className="text-purple-700 font-mono">antigravity-preview-05-2026</code>.
                                        </p>
                                    </div>

                                    <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center">3</div>
                                        <h4 className="text-xs font-bold text-slate-900">Síntesis de 3 Pilares & EPAs</h4>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">
                                            Calcula los puntajes de Entrevista, Examen e Intervención, detecta sesgos y actualiza el Super Perfil.
                                        </p>
                                    </div>

                                    <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 space-y-2">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">4</div>
                                        <h4 className="text-xs font-bold text-slate-900">Inyección Dinámica Live</h4>
                                        <p className="text-[11px] text-slate-600 leading-relaxed">
                                            Inyecta el <code className="text-emerald-700 font-mono">miniPromptDinamico</code> en tiempo real en la siguiente llamada por voz.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* OTRAS FUNCIONES EN LAS QUE ANTIGRAVITY PUEDE AYUDAR EN LA PLATAFORMA */}
                            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 text-white space-y-4 shadow-md">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                    <h3 className="text-base font-black text-white">Nuevas Funciones Extensibles del Agente Antigravity en Polideportivo</h3>
                                </div>
                                <p className="text-xs text-slate-300">
                                    Basado en los módulos activos de tu barra lateral (Atención Clínica, Gestión Docente y Simulación), Antigravity puede expandirse a las siguientes áreas:
                                </p>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-2">
                                        <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded border border-amber-400/30 uppercase">1. Anatomía Extendida</span>
                                        <h4 className="font-bold text-white text-sm">Generación de Nuevas Regiones (Rodilla, Hombro, Columna)</h4>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">
                                            Reemplazar las etiquetas "PRÓXIMAMENTE" generando automáticamente temarios y casos clínicos EBM estructurados para Rodilla, Hombro, Lumbar y Tobillo.
                                        </p>
                                    </div>

                                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-2">
                                        <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded border border-indigo-400/30 uppercase">2. Auditoría Clínica</span>
                                        <h4 className="font-bold text-white text-sm">Auditoría de Fichas Reales (Bandeja Auditoría & Pasantía)</h4>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">
                                            Auditar las fichas clínicas reales redactadas por los internos en "Personas Usuarias" verificando lenguaje BPS, banderas rojas y criterios EBM.
                                        </p>
                                    </div>

                                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/70 space-y-2">
                                        <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-400/30 uppercase">3. Tutoría Metodológica</span>
                                        <h4 className="font-bold text-white text-sm">Asesoría Metodológica en Tesis (PFG Dashboard)</h4>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">
                                            Revisión de proyectos de título de los alumnos: metodología, cálculo muestral, consistencia del problema de investigación y citación EBM.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Cohorte de Super Perfiles Longitudinarios */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                        <Award className="w-5 h-5 text-indigo-600" />
                                        Super Perfiles Longitudinarios de la Cohorte
                                    </h3>
                                    <button
                                        onClick={async () => {
                                            const allSp = await getAllSuperProfiles();
                                            setAllSuperProfiles(allSp);
                                        }}
                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" />
                                        <span>Actualizar Perfiles</span>
                                    </button>
                                </div>

                                {allSuperProfiles.length === 0 ? (
                                    <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
                                        <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                                        <p className="text-sm font-bold text-slate-700">Sin Super Perfiles sintetizados aún.</p>
                                        <p className="text-xs text-slate-500">Al completar la primera sesión en cualquier simulador, el Agente Antigravity generará el perfil automático.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {allSuperProfiles.map((sp) => {
                                            const badgeColor = 
                                                sp.nivelCognitivo === 'RESIDENTE' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                                sp.nivelCognitivo === 'INTERMEDIO' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                                'bg-amber-100 text-amber-800 border-amber-300';

                                            return (
                                                <div key={sp.userId} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 hover:border-indigo-300 transition-all">
                                                    {/* Header de Alumno */}
                                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700">
                                                                {sp.estudianteNombre ? sp.estudianteNombre.charAt(0) : 'I'}
                                                            </div>
                                                            <div>
                                                                <h4 className="text-base font-bold text-slate-900">{sp.estudianteNombre}</h4>
                                                                <p className="text-xs text-slate-400 font-mono">UID: {sp.userId} • Última síntesis: {sp.fechaUltimaSintesis ? new Date(sp.fechaUltimaSintesis).toLocaleString('es-CL') : 'Reciente'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                                                                Nivel: {sp.nivelCognitivo || 'NOVATO'}
                                                            </span>
                                                            <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full border border-slate-200">
                                                                {sp.totalSimulacionesCompletadas || 1} Simulaciones
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Los 3 Pilares del Razonamiento Clínico */}
                                                    <div>
                                                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">Desempeño en los 3 Pilares del Razonamiento Clínico</h5>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="flex justify-between text-xs font-bold">
                                                                    <span className="text-slate-700">Pilar A: Entrevista BPS</span>
                                                                    <span className="text-indigo-600">{sp.pilares?.pilarA_entrevista ?? 50}%</span>
                                                                </div>
                                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                                    <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${sp.pilares?.pilarA_entrevista ?? 50}%` }}></div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="flex justify-between text-xs font-bold">
                                                                    <span className="text-slate-700">Pilar B: Examen Dirigido</span>
                                                                    <span className="text-purple-600">{sp.pilares?.pilarB_examen ?? 50}%</span>
                                                                </div>
                                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                                    <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${sp.pilares?.pilarB_examen ?? 50}%` }}></div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="flex justify-between text-xs font-bold">
                                                                    <span className="text-slate-700">Pilar C: Intervención EBM</span>
                                                                    <span className="text-emerald-600">{sp.pilares?.pilarC_intervencion ?? 50}%</span>
                                                                </div>
                                                                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                                                                    <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${sp.pilares?.pilarC_intervencion ?? 50}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* EPAs Acreditadas */}
                                                    <div>
                                                        <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2">Estado de Actividades Profesionales Confiables (EPAs)</h5>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(sp.epas || []).map((epa) => {
                                                                const stColor = epa.estado === 'ACREDITADA' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                    epa.estado === 'EN_DESARROLLO' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                    'bg-slate-100 text-slate-600 border-slate-200';

                                                                return (
                                                                    <span key={epa.id} className={`text-xs font-bold px-2.5 py-1 rounded-lg border flex items-center gap-1.5 ${stColor}`}>
                                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                                        <span>{epa.id}: {epa.nombre}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Mini-Prompt Dinámico Generado por Antigravity */}
                                                    <div className="bg-indigo-950 text-indigo-100 p-4 rounded-xl border border-indigo-800 space-y-1.5 font-mono text-xs shadow-inner">
                                                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[10px] tracking-wider">
                                                            <Sparkles className="w-3.5 h-3.5" />
                                                            <span>Mini-Prompt Dinámico Inyectado por Antigravity Agent</span>
                                                        </div>
                                                        <p className="whitespace-pre-wrap leading-relaxed text-indigo-200/90">
                                                            {sp.miniPromptDinamico}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
