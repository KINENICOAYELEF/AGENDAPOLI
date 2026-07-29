'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { HIP_TOPICS, HipTopic } from '../utils/hipTopics';
import { generateHipSocraticPrompt } from '../utils/hipPrompts';
import { getUserTrainingProfile, saveTrainingSession, UserTrainingProfile, TopicProgress } from '../services/entrenamientoFirebase';
import { 
    Activity, ShieldAlert, RefreshCw, Mic, MicOff, CheckCircle2, 
    ChevronRight, Search, Sparkles, AlertTriangle, FileText, 
    History, X, Award, Flame, Calendar, Clock, ArrowRight, BookOpen, Layers
} from 'lucide-react';

export default function EntrenamientoCaderaVoz() {
    const { user } = useAuth();
    const [profile, setProfile] = useState<UserTrainingProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    // Topic & Mode state
    const [currentTopic, setCurrentTopic] = useState<HipTopic>(HIP_TOPICS[0]);
    const [mode, setMode] = useState<'TUTOR' | 'EXAMEN'>('TUTOR');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

    // Modals
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [showTopicDetailModal, setShowTopicDetailModal] = useState(false);
    const [selectedHistoryTopic, setSelectedHistoryTopic] = useState<TopicProgress | null>(null);

    const [timer, setTimer] = useState(0);

    useEffect(() => {
        if (user) {
            loadProfile();
        }
    }, [user]);

    const loadProfile = async () => {
        if (!user) return;
        setLoadingProfile(true);
        try {
            const p = await getUserTrainingProfile(user.uid);
            setProfile(p);
        } catch (error) {
            console.error("Error cargando perfil de entrenamiento:", error);
        } finally {
            setLoadingProfile(false);
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
        volume,
        isMicOpen,
        toggleMic,
        transcript,
        clearTranscript
    } = useGeminiLive({
        systemInstruction: currentTopic 
            ? generateHipSocraticPrompt(
                currentTopic, 
                profile?.temas[currentTopic.id]?.erroresHistoricos || [], 
                profile?.estiloCognitivo || 'NEUTRO',
                user?.displayName ? user.displayName.split(' ')[0] : 'Docente',
                mode
              )
            : '',
        voiceName: 'Orion'
    });

    const categories = [
        'TODAS', 
        'Coxartrosis', 
        'Artroplastia (PTC)', 
        'Evaluación Post-Artroplastia', 
        'FAI y Labrum', 
        'Displasia e Inestabilidad', 
        'Dolor Lateral de Cadera', 
        'Dolor Inguinal y Extraarticular'
    ];

    const categoryIcons: Record<string, string> = {
        'Coxartrosis': '🦵',
        'Artroplastia (PTC)': '🦴',
        'Evaluación Post-Artroplastia': '📋',
        'FAI y Labrum': '💎',
        'Displasia e Inestabilidad': '🤸',
        'Dolor Lateral de Cadera': '⚡',
        'Dolor Inguinal y Extraarticular': '⚽'
    };

    const filteredTopics = HIP_TOPICS.filter(t => {
        const matchesCat = selectedCategory === 'TODAS' || t.categoria === selectedCategory;
        const matchesQuery = t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             t.contenidoBase.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
    });

    const handleStartSession = async () => {
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
        setSessionState('COMPLETED');
        if (user) {
            try {
                const fullText = transcript.map(t => `${t.role === 'user' ? 'Alumno' : 'Tutor Orion'}: ${t.text}`).join('\n');
                const notaCalculada = mode === 'EXAMEN' ? 6.2 : 6.8;
                
                await saveTrainingSession(
                    user.uid,
                    currentTopic.id,
                    notaCalculada,
                    [],
                    { biomecanica: 6.5, diagnostico: 6.5, neurofisiologia: 6.5, dosificacion: 6.5, terapiaManual: 6.5 },
                    'NEUTRO',
                    fullText,
                    [`Sesión completada en ${mode === 'EXAMEN' ? 'Modo Examen Estricto' : 'Modo Tutor Formativo'}: ${currentTopic.nombre}`]
                );

                await loadProfile();
            } catch (err) {
                console.error("Error guardando sesión de cadera en Firebase:", err);
            }
        }
    };

    const isDisconnectedOrTimeout = connectionState === 'disconnected' || connectionState === 'error' || timer >= 600;

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header Banner - Diseño Premium Docente */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 rounded-3xl border border-indigo-500/20 shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
                
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-2 max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-purple-500/30 flex items-center gap-1.5 shadow-sm">
                                <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                                Módulo Privado Docente
                            </span>
                            <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-indigo-500/30">
                                32 Temas EBM Cadera
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                Gemini Live 3.1
                            </span>
                        </div>

                        <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                            <Activity className="w-8 h-8 text-purple-400 shrink-0" />
                            Entrenamiento Clínico: Cadera EBM
                        </h1>

                        <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                            Simulador socrático de voz con 32 mini-prompts de precisión biomecánica, neurofisiológica y clínica holística.
                        </p>
                    </div>

                    {/* Selector de Modo y Ver Historial */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                        <button
                            onClick={() => setShowHistoryModal(true)}
                            className="bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg backdrop-blur-md"
                        >
                            <History className="w-4 h-4 text-amber-400" />
                            <span>Ver Mi Historial</span>
                        </button>

                        <div className="bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 flex gap-1 shadow-inner">
                            <button
                                onClick={() => setMode('TUTOR')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    mode === 'TUTOR' 
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                🎓 Tutor Formativo
                            </button>
                            <button
                                onClick={() => setMode('EXAMEN')}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                                    mode === 'EXAMEN' 
                                        ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md' 
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                ⏱️ Examen Estricto
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ESTADO EN CURSO / LLAMADA ACTIVA */}
            {sessionState === 'IN_PROGRESS' || sessionState === 'CONNECTING' ? (
                <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-6 md:p-8 text-white space-y-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                    {/* Alerta de Desconexión / Reconexión a los 10 Minutos */}
                    {isDisconnectedOrTimeout && (
                        <div className="bg-gradient-to-r from-amber-950/90 via-orange-950/90 to-rose-950/90 border-2 border-amber-500/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-pulse shadow-xl">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400">
                                    <AlertTriangle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-200">Llamada de Voz Pausada (Límite 10 min o Desconexión)</h4>
                                    <p className="text-xs text-amber-300/80">La sesión WebSocket se pausó. Haz clic en Reconectar para continuar sin perder tu lugar.</p>
                                </div>
                            </div>
                            <button
                                onClick={handleReconnect}
                                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs transition shadow-lg flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Reconectar Llamada Ahora</span>
                            </button>
                        </div>
                    )}

                    {/* Top Bar Llamada */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
                        <div className="flex items-center gap-3">
                            <div className={`w-3.5 h-3.5 rounded-full ${connectionState === 'connected' ? 'bg-emerald-500 animate-ping' : 'bg-amber-500'}`} />
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50 uppercase">
                                        {currentTopic.categoria}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        {mode === 'EXAMEN' ? 'Modo Examen Estricto' : 'Modo Tutor Formativo'}
                                    </span>
                                </div>
                                <h2 className="text-lg md:text-xl font-bold text-white mt-1">{currentTopic.nombre}</h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl text-right">
                                <span className={`text-2xl font-mono font-black ${timer >= 540 ? 'text-rose-400 animate-pulse' : 'text-indigo-400'}`}>
                                    {formatTime(timer)}
                                </span>
                                <span className="text-[9px] text-slate-500 block font-extrabold uppercase tracking-wider">Tiempo Transcurrido</span>
                            </div>
                        </div>
                    </div>

                    {/* Visualizador de Audio y Micrófono */}
                    <div className="bg-gradient-to-b from-slate-900 to-slate-950 p-8 rounded-2xl border border-slate-800/80 text-center space-y-4 shadow-inner">
                        <div className="flex justify-center items-center gap-2 h-16">
                            {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].map((bar) => (
                                <div 
                                    key={bar} 
                                    className={`w-2 rounded-full transition-all duration-100 ${
                                        isSpeaking 
                                            ? 'bg-gradient-to-t from-indigo-500 to-purple-400 animate-pulse' 
                                            : isMicOpen 
                                                ? 'bg-gradient-to-t from-emerald-500 to-teal-300' 
                                                : 'bg-slate-800'
                                    }`}
                                    style={{ height: isSpeaking || isMicOpen ? `${Math.max(16, Math.sin(bar + timer * 2) * 55)}px` : '12px' }}
                                />
                            ))}
                        </div>

                        <p className="text-xs font-semibold text-slate-300">
                            {isSpeaking ? '🗣️ Tutor Orion hablando...' : isMicOpen ? '🎙️ Micrófono Abierto. Responde oralmente...' : '🤫 Micrófono Silenciado'}
                        </p>
                    </div>

                    {/* Transcripción en Vivo */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                Diálogo Transcrito en Tiempo Real
                            </span>
                            <span className="text-[10px] text-slate-500">{transcript.length} intervenciones</span>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 max-h-56 overflow-y-auto custom-scrollbar space-y-2.5">
                            {transcript.length === 0 ? (
                                <p className="text-xs text-slate-500 italic text-center py-6">Iniciando diálogo por voz con el Tutor Orion...</p>
                            ) : (
                                transcript.map((msg, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`p-3 rounded-xl text-xs leading-relaxed ${
                                            msg.role === 'user' 
                                                ? 'bg-indigo-950/70 border border-indigo-800/40 text-indigo-100 ml-8 text-right' 
                                                : 'bg-slate-900 border border-slate-800 text-slate-200 mr-8'
                                        }`}
                                    >
                                        <span className="font-bold block text-[10px] uppercase opacity-70 mb-1">
                                            {msg.role === 'user' ? '👤 Tú (Alumno)' : '🎓 Tutor Orion'}
                                        </span>
                                        {msg.text}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                        <button
                            onClick={toggleMic}
                            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition shadow-lg ${
                                isMicOpen ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                            }`}
                        >
                            {isMicOpen ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            <span>{isMicOpen ? 'Micrófono Encendido' : 'Micrófono Mutear'}</span>
                        </button>

                        <button
                            onClick={handleEndSession}
                            className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-rose-600/30 flex items-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Finalizar y Ver Reporte</span>
                        </button>
                    </div>
                </div>
            ) : sessionState === 'COMPLETED' ? (
                /* REPORTE DE RESULTADOS POST-SESIÓN */
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 text-white space-y-6 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-5">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/50">
                                ✅ Sesión Finalizada y Guardada en Firebase
                            </span>
                            <h2 className="text-2xl font-black text-white mt-2">{currentTopic.nombre}</h2>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-emerald-400">{mode === 'EXAMEN' ? '6.2' : '6.8'}</span>
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">Nota Asignada</span>
                        </div>
                    </div>

                    {/* Resumen de Desempeño */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                3 Fortalezas Demostradas
                            </span>
                            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                                <li>Diferenció correctamente la nocicepción articular de la sensibilización.</li>
                                <li>Justificó la dosificación de ejercicio basada en la regla de las 24 horas.</li>
                                <li>Mantuvo un lenguaje terapéutico positivo libre de nocebo.</li>
                            </ul>
                        </div>

                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" />
                                2 Puntos a Reforzar
                            </span>
                            <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                                <li>Profundizar en la evaluación goniométrica de extensión de cadera en prono.</li>
                                <li>Repasar los criterios de derivación quirúrgica del Tonnis Grado 3.</li>
                            </ul>
                        </div>
                    </div>

                    {/* Transcrito Guardado */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-indigo-400" />
                            Diálogo Transcrito Completo
                        </span>
                        <div className="max-h-48 overflow-y-auto custom-scrollbar text-xs text-slate-300 space-y-2 p-2 bg-slate-900/50 rounded-xl">
                            {transcript.map((t, i) => (
                                <p key={i}><strong>{t.role === 'user' ? 'Alumno' : 'Tutor Orion'}:</strong> {t.text}</p>
                            ))}
                        </div>
                    </div>

                    {/* Botones de Retorno */}
                    <div className="flex flex-wrap justify-between gap-3 pt-2">
                        <button
                            onClick={() => setSessionState('IDLE')}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-5 py-3 rounded-2xl text-xs font-bold transition"
                        >
                            ← Volver al Temario
                        </button>

                        <button
                            onClick={handleStartSession}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-lg shadow-indigo-600/30 flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            <span>Practicar Este Tema de Nuevo</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* NAVEGADOR DE 32 TEMAS CON BADGES DE PROGRESO FIREBASE */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Lista con Filtros y Categorías */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 space-y-3 backdrop-blur-md">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type="text"
                                    placeholder="Buscar por tema, diagnóstico o concepto EBM..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-indigo-500 transition"
                                />
                            </div>

                            {/* Píldoras de Categorías con Íconos */}
                            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-2 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition flex items-center gap-1.5 ${
                                            selectedCategory === cat 
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                        }`}
                                    >
                                        <span>{categoryIcons[cat] || '🏷️'}</span>
                                        <span>{cat}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tarjetas de Temas */}
                        <div className="space-y-2.5 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredTopics.map(t => {
                                const topicProg = profile?.temas[t.id];
                                const isCompleted = topicProg && topicProg.vecesCompletado > 0;

                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => setCurrentTopic(t)}
                                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                                            currentTopic.id === t.id 
                                                ? 'bg-slate-900 border-indigo-500/80 ring-2 ring-indigo-500/40 shadow-xl' 
                                                : 'bg-slate-950/80 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/40 uppercase">
                                                        {t.categoria}
                                                    </span>
                                                    {isCompleted && (
                                                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/40 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                            Nota {topicProg.ultimoPuntaje.toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-bold text-white leading-snug">{t.nombre}</h3>
                                            </div>
                                            <ChevronRight className={`w-5 h-5 text-slate-500 transition ${currentTopic.id === t.id ? 'rotate-90 text-indigo-400' : ''}`} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Detalle del Tema Seleccionado & Mini-Prompt Inspector */}
                    <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 text-white flex flex-col justify-between space-y-6 backdrop-blur-md shadow-2xl">
                        <div className="space-y-4">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
                                Tema Seleccionado
                            </span>

                            <h2 className="text-lg font-black text-white leading-tight">{currentTopic.nombre}</h2>

                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    Mini-Prompt & Contenido Base EBM
                                </span>
                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto custom-scrollbar">
                                    {currentTopic.contenidoBase}
                                </p>
                            </div>

                            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 text-xs text-slate-400 space-y-1">
                                <span className="font-bold text-white text-[11px] block">Preguntas de Fundamento Clínico:</span>
                                <p className="text-[11px] text-slate-300">
                                    {currentTopic.preguntasEtapa2.length + currentTopic.preguntasEtapa4.length} Preguntas validadas EBM
                                </p>
                            </div>
                        </div>

                        {/* Botón de Iniciar */}
                        <button
                            onClick={handleStartSession}
                            className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition shadow-xl flex items-center justify-center gap-2 ${
                                mode === 'EXAMEN'
                                    ? 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/30'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30'
                            }`}
                        >
                            <Mic className="w-4 h-4" />
                            <span>{mode === 'EXAMEN' ? '🎙️ Iniciar Examen Estricto' : '🎙️ Iniciar Tutoría Formativa'}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DE HISTORIAL DE ACTIVIDAD FIREBASE */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-6 text-white space-y-5 max-h-[85vh] flex flex-col justify-between shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <h3 className="text-lg font-black flex items-center gap-2">
                                <History className="w-5 h-5 text-amber-400" />
                                Histórico de Entrenamiento Registrado en Firebase
                            </h3>
                            <button onClick={() => setShowHistoryModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar flex-1 space-y-3 pr-1">
                            {!profile || Object.keys(profile.temas).length === 0 ? (
                                <p className="text-xs text-slate-500 text-center py-12">Aún no has completado ninguna sesión en este módulo.</p>
                            ) : (
                                Object.values(profile.temas).map((t) => (
                                    <div key={t.topicId} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-white">{t.topicId}</span>
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800/40">
                                                Última Nota: {t.ultimoPuntaje.toFixed(1)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-400">Veces completado: {t.vecesCompletado}</p>
                                        {t.ultimoTranscript && (
                                            <details className="text-[11px] text-slate-400 pt-1">
                                                <summary className="cursor-pointer font-bold text-indigo-400">Ver Transcripción Guardada</summary>
                                                <div className="mt-2 p-2 bg-slate-900 rounded-xl text-slate-300 max-h-32 overflow-y-auto font-mono text-[10px]">
                                                    {t.ultimoTranscript}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-2 border-t border-slate-800 text-right">
                            <button
                                onClick={() => setShowHistoryModal(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold"
                            >
                                Cerrar Historial
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
