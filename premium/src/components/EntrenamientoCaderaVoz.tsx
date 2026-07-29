'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGeminiLive } from '../hooks/useGeminiLive';
import { HIP_TOPICS, HipTopic } from '../utils/hipTopics';
import { generateHipSocraticPrompt } from '../utils/hipPrompts';
import { saveTrainingSession } from '../services/entrenamientoFirebase';
import { Activity, BookOpen, ShieldAlert, Award, RefreshCw, Volume2, Mic, MicOff, CheckCircle2, ChevronRight, Search, Sparkles } from 'lucide-react';

export default function EntrenamientoCaderaVoz() {
    const { user } = useAuth();
    const [sessionState, setSessionState] = useState<'IDLE' | 'CONNECTING' | 'IN_PROGRESS' | 'COMPLETED'>('IDLE');
    
    // Topic & Mode state
    const [currentTopic, setCurrentTopic] = useState<HipTopic>(HIP_TOPICS[0]);
    const [mode, setMode] = useState<'TUTOR' | 'EXAMEN'>('TUTOR');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('TODAS');

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
                [], 
                'NEUTRO',
                user?.displayName ? user.displayName.split(' ')[0] : 'Docente',
                mode
              )
            : '',
        voiceName: 'Orion'
    });

    const categories = ['TODAS', 'Coxartrosis', 'Artroplastia (PTC)', 'Evaluación Post-Artroplastia', 'FAI y Labrum', 'Displasia e Inestabilidad', 'Dolor Lateral de Cadera', 'Dolor Inguinal y Extraarticular'];

    const filteredTopics = HIP_TOPICS.filter(t => {
        const matchesCat = selectedCategory === 'TODAS' || t.categoria === selectedCategory;
        const matchesQuery = t.nombre.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             t.contenidoBase.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCat && matchesQuery;
    });

    const handleStartSession = async () => {
        setSessionState('CONNECTING');
        clearTranscript();
        try {
            await connect();
            setSessionState('IN_PROGRESS');
        } catch (error) {
            console.error("Error al conectar Gemini Live:", error);
            setSessionState('IDLE');
        }
    };

    const handleEndSession = async () => {
        disconnect();
        setSessionState('COMPLETED');
        if (user) {
            try {
                const fullText = transcript.map(t => `${t.role === 'user' ? 'Alumno' : 'IA'}: ${t.text}`).join('\n');
                await saveTrainingSession(
                    user.uid,
                    currentTopic.id,
                    6.0,
                    [],
                    { biomecanica: 6.0, diagnostico: 6.0, neurofisiologia: 6.0, dosificacion: 6.0, terapiaManual: 6.0 },
                    'NEUTRO',
                    fullText,
                    [`Completó tema de cadera: ${currentTopic.nombre}`]
                );
            } catch (err) {
                console.error("Error guardando sesión de cadera en Firebase:", err);
            }
        }
    };

    return (
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
            {/* Header Banner - Solo Docente */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 rounded-2xl border border-indigo-800/40 text-white shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-purple-500/20 text-purple-300 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-purple-500/30 flex items-center gap-1">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Vista Docente Privada EBM
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-emerald-500/30">
                                32 Temas Esenciales
                            </span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                            <Activity className="w-7 h-7 text-purple-400" />
                            Módulo de Entrenamiento Clínico: Cadera EBM
                        </h1>
                        <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                            Simulador socrático de voz con 32 mini-prompts de precisión, basado en ciencia cognitiva y guías internacionales.
                        </p>
                    </div>

                    {/* Selector de Modo */}
                    <div className="bg-slate-950/80 p-1.5 rounded-xl border border-slate-800 flex gap-1">
                        <button
                            onClick={() => setMode('TUTOR')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                mode === 'TUTOR' 
                                    ? 'bg-indigo-600 text-white shadow' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            🎓 Modo A: Tutor Formativo
                        </button>
                        <button
                            onClick={() => setMode('EXAMEN')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                mode === 'EXAMEN' 
                                    ? 'bg-rose-600 text-white shadow' 
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            ⏱️ Modo B: Examen Estricto
                        </button>
                    </div>
                </div>
            </div>

            {/* Layout Principal */}
            {sessionState === 'IN_PROGRESS' ? (
                /* Interfaz de Llamada Activa */
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white space-y-6 shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                            <div>
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                                    {mode === 'TUTOR' ? 'Sesión Tutoriada Activa' : 'Examen Estricto en Curso (10 min max)'}
                                </span>
                                <h2 className="text-lg font-bold text-white">{currentTopic.nombre}</h2>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-mono font-bold text-indigo-400">{formatTime(timer)}</span>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold">Tiempo Transcurrido</span>
                        </div>
                    </div>

                    {/* Visualizador de Onda de Voz */}
                    <div className="bg-slate-950 p-8 rounded-xl border border-slate-800 text-center space-y-4">
                        <div className="flex justify-center items-center gap-1.5 h-12">
                            {[1,2,3,4,5,6,7,8,9,10].map((bar) => (
                                <div 
                                    key={bar} 
                                    className={`w-1.5 rounded-full transition-all duration-75 ${
                                        isSpeaking 
                                            ? 'bg-indigo-500 animate-pulse' 
                                            : isMicOpen 
                                                ? 'bg-emerald-500' 
                                                : 'bg-slate-700'
                                    }`}
                                    style={{ height: isSpeaking || isMicOpen ? `${Math.max(15, Math.sin(bar + timer) * 45)}px` : '12px' }}
                                />
                            ))}
                        </div>
                        <p className="text-xs font-medium text-slate-400">
                            {isSpeaking ? '🗣️ Tutor Orion hablando...' : isMicOpen ? '🎙️ Tu micrófono está activo. Habla ahora...' : '🤫 Micrófono silenciado'}
                        </p>
                    </div>

                    {/* Transcripción en vivo */}
                    <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80 max-h-48 overflow-y-auto custom-scrollbar space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Transcripción Diálogo en Vivo</span>
                        {transcript.length === 0 ? (
                            <p className="text-xs text-slate-600 italic">Iniciando diálogo por audio con el examinador...</p>
                        ) : (
                            transcript.map((msg, idx) => (
                                <div key={idx} className={`text-xs p-2 rounded-lg ${msg.role === 'user' ? 'bg-indigo-950/60 text-indigo-200 text-right' : 'bg-slate-800 text-slate-200'}`}>
                                    <span className="font-bold block text-[10px] opacity-60 mb-0.5">{msg.role === 'user' ? 'Tú' : 'Tutor Orion'}</span>
                                    {msg.text}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Botones de Control */}
                    <div className="flex justify-between items-center pt-2">
                        <button
                            onClick={toggleMic}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition ${
                                isMicOpen ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            {isMicOpen ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            <span>{isMicOpen ? 'Micrófono Encendido' : 'Micrófono Mutear'}</span>
                        </button>

                        <button
                            onClick={handleEndSession}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-lg shadow-rose-600/20"
                        >
                            Finalizar Evaluación
                        </button>
                    </div>
                </div>
            ) : (
                /* Vista de Selección de Temas (Navegador de 32 Temas) */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Lista de Categorías y Temas */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Filtros */}
                        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    placeholder="Buscar por tema, patología o concepto EBM..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-9 pr-4 py-2.5 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedCategory(cat)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition ${
                                            selectedCategory === cat 
                                                ? 'bg-indigo-600 text-white' 
                                                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tarjetas de Temas */}
                        <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-1">
                            {filteredTopics.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => setCurrentTopic(t)}
                                    className={`p-4 rounded-xl border transition cursor-pointer ${
                                        currentTopic.id === t.id 
                                            ? 'bg-slate-900 border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                                            : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900/60 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/40 uppercase">
                                                {t.categoria}
                                            </span>
                                            <h3 className="text-sm font-bold text-white mt-1.5">{t.nombre}</h3>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-slate-500 transition ${currentTopic.id === t.id ? 'rotate-90 text-indigo-400' : ''}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Detalle del Tema Seleccionado & Mini-Prompt Inspector */}
                    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 space-y-4 text-white flex flex-col justify-between">
                        <div className="space-y-3">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 block">
                                Detalle del Tema Seleccionado
                            </span>
                            <h2 className="text-base font-bold text-white leading-snug">{currentTopic.nombre}</h2>
                            
                            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-amber-400" />
                                    Contenido Base (Mini-Prompt de la IA)
                                </span>
                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line max-h-44 overflow-y-auto custom-scrollbar">
                                    {currentTopic.contenidoBase}
                                </p>
                            </div>

                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                                <span className="font-bold text-white text-[11px] block">Banco de Preguntas EBM:</span>
                                <p className="text-[11px]">{currentTopic.preguntasEtapa2.length + currentTopic.preguntasEtapa4.length} Preguntas de alta exigencia</p>
                            </div>
                        </div>

                        {/* Botón de Iniciar */}
                        <button
                            onClick={handleStartSession}
                            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 ${
                                mode === 'EXAMEN'
                                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                            }`}
                        >
                            <Mic className="w-4 h-4" />
                            <span>{mode === 'EXAMEN' ? '🎙️ Iniciar Examen de Cadera (Modo B)' : '🎙️ Iniciar Tutoría de Cadera (Modo A)'}</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
