"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Mock list of notebooks retrieved from the NotebookLM account list
const NOTEBOOKS_MOCK = [
    { id: "84fa48f3-7dda-49a3-92d4-0cefb5d8b703", title: "Detección y Diagnóstico Diferencial del Cuadrante Inferior", sources: 1 },
    { id: "b3e74b9c-3457-471c-9488-48f01eb47e06", title: "Rehabilitación y Retorno al Rendimiento del Hombro Atlético", sources: 40 },
    { id: "076bb635-8225-4246-b435-d45b06147b78", title: "Manejo Clínico del Dolor Anterior de Rodilla", sources: 6 },
    { id: "e09af32c-ba13-4e21-bc17-9ab6a6527ccb", title: "Manejo Clínico de la Tendinopatía de Aquiles en Atletas", sources: 1 },
    { id: "01761f27-67ee-4482-baee-d76311493d84", title: "Ciencia y Aplicación de la Fuerza Muscular", sources: 1 },
    { id: "bd30d5ec-86c6-4698-8d9e-8f17fa9c8e11", title: "Poli - Neurodinámica en la Práctica Clínica", sources: 47 },
    { id: "878c4fa1-5962-425d-a19c-b249d4cfd97e", title: "Tratamiento y Diagnóstico de Patologías de Cadera y Ingle", sources: 30 },
    { id: "2b5d4ceb-24af-4e35-9502-e93b11981661", title: "sindrome de dolor patelofemoral", sources: 47 },
    { id: "e67ac5ea-4b1a-47b7-a7c4-2b62c61cc00f", title: "Tratamiento del Dolor Lumbar: Guías para Fisioterapeutas", sources: 7 }
];

interface Question {
    text: string;
    options: string[];
    correctIndex: number;
}

interface Concept {
    id: string;
    name: string;
    questionA: Question;
    questionB: Question;
    summary: string;
}

// 3 Real Kinesiology Musculoskeletal concepts with A/B parallel questions
const SAMPLE_CONCEPTS: Concept[] = [
    {
        id: "concept-1",
        name: "Banderas Rojas del Cuadrante Inferior",
        questionA: {
            text: "Mateo, maratonista de 28 años, consulta por dolor lumbar sordo e insidioso de 1 mes de evolución. Refiere que el dolor empeora significativamente durante la noche al acostarse, impidiéndole conciliar el sueño, y no cede con ninguna postura de alivio. A la palpación no hay dolor mecánico evidente. ¿Cuál es la conducta clínica más adecuada?",
            options: [
                "Iniciar terapia manual y movilizaciones lumbares para reducir la rigidez mecánica.",
                "Derivar de inmediato a evaluación médica/especialista por sospecha de patología de origen no mecánico (bandera roja).",
                "Indicar reposo absoluto por 2 semanas y prescribir calor local por las noches."
            ],
            correctIndex: 1
        },
        questionB: {
            text: "Sofía, de 34 años, presenta un dolor profundo en el glúteo y zona sacroilíaca izquierda sin antecedentes de trauma. Refiere que el dolor es constante, aumenta notablemente durante el reposo nocturno y no varía ante cambios posicionales ni con reposo en el día. ¿Qué principio clínico describe mejor esta situación?",
            options: [
                "Representa un síndrome piriforme clásico que debe tratarse con estiramientos intensivos.",
                "Es un dolor referido visceral o neoplásico (bandera roja) que exige derivación médica directa para diagnóstico.",
                "Se trata de una disfunción biomecánica sacroilíaca que se resolverá con manipulación articular de alta velocidad."
            ],
            correctIndex: 1
        },
        summary: "El dolor lumbar de tipo no mecánico, caracterizado por ser sordo, constante, que no se modifica con las posturas y que empeora de forma severa por las noches (impidiendo el sueño), es una bandera roja crítica de patología sistémica o tumoral en el cuadrante inferior, exigiendo derivación médica inmediata."
    },
    {
        id: "concept-2",
        name: "Diagnóstico Diferencial: Radiculopatía vs Atrapamiento Periférico",
        questionA: {
            text: "Un paciente acude por dolor irradiado en la cara posterior del muslo y pantorrilla derecha. En la evaluación física presenta un test de Elevación de la Pierna Recta (Lasegue) positivo a 30 grados, disminución de fuerza en la eversión del tobillo y abolición del reflejo calcáneo (aquiliano). ¿Cuál es el origen fisiopatológico más probable?",
            options: [
                "Síndrome del piriforme con compresión del nervio ciático en su salida de la pelvis.",
                "Compromiso radicular lumbar (L5-S1) debido a signos neurológicos duros y alta sensibilidad neural.",
                "Acortamiento adaptativo del bíceps femoral con entesitis insercional proximal."
            ],
            correctIndex: 1
        },
        questionB: {
            text: "Durante el examen de un interno a un paciente con dolor glúteo irradiado al pie, este indica que el dolor aumenta drásticamente al toser o realizar un esfuerzo de defecación (maniobra de Valsalva). Además, se constata hipoestesia en el borde lateral del pie. ¿Qué factor diferencia este cuadro de un atrapamiento periférico puro?",
            options: [
                "La exacerbación con maniobras que aumentan la presión intradiscal (Valsalva) e hipoestesia dermatómica apuntan a una radiculopatía y no a un atrapamiento periférico.",
                "Los atrapamientos del nervio ciático en el espacio subglúteo profundo se caracterizan típicamente por empeorar con la maniobra de Valsalva.",
                "La hipoestesia en el pie solo ocurre cuando hay una tendinopatía de Aquiles concurrente."
            ],
            correctIndex: 0
        },
        summary: "La radiculopatía lumbar se diferencia de un atrapamiento periférico del ciático (como el piriforme) por la presencia de signos neurológicos duros (alteración dermatómica de sensibilidad, reflejos osteotendinosos abolidos o disminuidos, debilidad de miotomas) y por el aumento de dolor ante incrementos de presión intratecal (tos, estornudo, Valsalva)."
    },
    {
        id: "concept-3",
        name: "Dosificación de Ejercicios en Tendinopatía Reactiva",
        questionA: {
            text: "Carlos, voleibolista de 21 años, presenta tendinopatía rotuliana en fase reactiva/irritable con EVA 7/10 durante el salto. Su tendón se encuentra engrosado y muy sensible al tacto, sin signos inflamatorios sistémicos. ¿Qué tipo de estímulo mecánico se recomienda para modular el dolor en esta fase?",
            options: [
                "Contracciones isométricas de alta carga sostenidas (ej. 5 repeticiones de 45 segundos al 70% MVIC) para generar analgesia cortical.",
                "Ejercicios pliométricos de rebote rápido para readaptar inmediatamente el tendón al ciclo de estiramiento-acortamiento.",
                "Reposo absoluto de la extremidad con rodillera estabilizadora por 21 días para desinflamar el colágeno."
            ],
            correctIndex: 0
        },
        questionB: {
            text: "Un maratonista con tendinitis de Aquiles en fase altamente reactiva presenta rigidez matutina dolorosa severa. Deseas programar una sesión inicial para reducir el dolor sin irritar mecánicamente las células tendinosas. ¿Cuál es el parámetro de dosificación de carga más respaldado?",
            options: [
                "Estiramiento estático del sóleo y gastrocnemio mantenido por 3 minutos seguidos en rango máximo.",
                "Ejercicios isométricos pesados (ej. elevación de talón sostenida sobre escalón) manteniendo la contracción por 45 segundos, repetido 4-5 veces.",
                "Ejercicios de saltos explosivos a una pierna (drop jumps) regulando el dolor hasta un máximo de 5/10."
            ],
            correctIndex: 1
        },
        summary: "En la fase reactiva o irritable de una tendinopatía, se debe evitar el reposo absoluto (que debilita el tendón) y las cargas de alta velocidad o estiramiento compresivo. Las contracciones isométricas pesadas sostenidas (45 segundos) inducen un potente efecto analgésico local y cortical, permitiendo modular el dolor y mantener el estímulo de carga seguro."
    }
];

export function CuestionariosAdmin() {
    const [activeTab, setActiveTab] = useState<'admin' | 'simulador' | 'bitacora' | 'warmup'>('admin');

    // Admin State
    const [selectedNotebook, setSelectedNotebook] = useState(NOTEBOOKS_MOCK[0].id);
    const [units, setUnits] = useState([
        { id: "u-1", title: "Unidad 1: Diagnóstico Diferencial del Cuadrante Inferior", notebook: "Detección y Diagnóstico Diferencial del Cuadrante Inferior", conceptsCount: 10, status: "Activo" },
        { id: "u-2", title: "Unidad 2: Biomecánica del Hombro Atlético", notebook: "Rehabilitación y Retorno al Rendimiento del Hombro Atlético", conceptsCount: 8, status: "Borrador" }
    ]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationLog, setGenerationLog] = useState<string[]>([]);

    // Simulator State (Concept Queue)
    const [queue, setQueue] = useState<Concept[]>([]);
    const [completedCount, setCompletedCount] = useState(0);
    const [totalInitialCount, setTotalInitialCount] = useState(0);
    const [currentConcept, setCurrentConcept] = useState<Concept | null>(null);
    const [confidence, setConfidence] = useState<'seguro' | 'duda' | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [feedback, setFeedback] = useState<{
        isCorrect: boolean;
        message: string;
        summary: string;
        isCritical: boolean;
    } | null>(null);
    const [clinicalStars, setClinicalStars] = useState(5); // Reputación clínica (5 estrellas)
    const [errorLog, setErrorLog] = useState<Concept[]>([]);
    const [quizStarted, setQuizStarted] = useState(false);
    const [showNextButton, setShowNextButton] = useState(false);
    
    // Concept attempt tracking (whether we show Question A or B next time it appears)
    const [conceptAttempts, setConceptAttempts] = useState<Record<string, 'A' | 'B'>>({});

    // Daily Warmup State
    const [warmupScore, setWarmupScore] = useState(0);
    const [warmupStep, setWarmupStep] = useState(0);
    const [warmupAnswered, setWarmupAnswered] = useState(false);
    const [warmupSelected, setWarmupSelected] = useState<number | null>(null);

    // Leaderboard Sim
    const leaderboard = [
        { name: "Constanza Muñoz", stars: "⭐⭐⭐⭐⭐", rating: "4.9", rank: 1, streak: "5 semanas 🔥" },
        { name: "Juan Pablo Soto", stars: "⭐⭐⭐⭐", rating: "4.7", rank: 2, streak: "3 semanas 🔥" },
        { name: "Felipe Oyarzún", stars: "⭐⭐⭐⭐", rating: "4.5", rank: 3, streak: "2 semanas 🔥" }
    ];

    // Initialize Simulator
    const startSimulator = () => {
        const initialConcepts = JSON.parse(JSON.stringify(SAMPLE_CONCEPTS));
        setQueue(initialConcepts);
        setTotalInitialCount(initialConcepts.length);
        setCompletedCount(0);
        setCurrentConcept(initialConcepts[0]);
        setClinicalStars(5);
        setConfidence(null);
        setSelectedOption(null);
        setFeedback(null);
        setShowNextButton(false);
        setQuizStarted(true);
        setErrorLog([]);
        
        // Reset attempt types
        const initialAttempts: Record<string, 'A' | 'B'> = {};
        initialConcepts.forEach((c: Concept) => {
            initialAttempts[c.id] = 'A';
        });
        setConceptAttempts(initialAttempts);
    };

    // Handle Generation Action
    const handleGenerate = () => {
        setIsGenerating(true);
        setGenerationLog([]);
        
        const logs = [
            "Conectando con el MCP de NotebookLM...",
            "Sesión autenticada para nicolas.ayelef@gmail.com",
            "Leyendo el contenido del cuaderno seleccionado...",
            "Analizando capítulos y fuentes bibliográficas...",
            "Identificando conceptos clave del Cuadrante Inferior...",
            "Estructurando pares de preguntas paralelas (Esquema A/B)...",
            "Generando micro-resúmenes de justificación basados en la evidencia...",
            "Validando concordancia clínica y flags de seguridad...",
            "¡Unidad de Cuestionario generada exitosamente en base de datos Firestore!"
        ];

        logs.forEach((log, index) => {
            setTimeout(() => {
                setGenerationLog(prev => [...prev, log]);
                if (index === logs.length - 1) {
                    setIsGenerating(false);
                    const nbName = NOTEBOOKS_MOCK.find(n => n.id === selectedNotebook)?.title || "Cuaderno Seleccionado";
                    setUnits(prev => [
                        ...prev,
                        {
                            id: `u-${Date.now()}`,
                            title: `Unidad: ${nbName}`,
                            notebook: nbName,
                            conceptsCount: 8,
                            status: "Borrador"
                        }
                    ]);
                }
            }, (index + 1) * 800);
        });
    };

    // Handle Answer Submission
    const handleAnswerSubmit = (optionIndex: number) => {
        if (!currentConcept || confidence === null) return;
        
        setSelectedOption(optionIndex);
        const attemptType = conceptAttempts[currentConcept.id] || 'A';
        const activeQuestion = attemptType === 'A' ? currentConcept.questionA : currentConcept.questionB;
        const isCorrect = optionIndex === activeQuestion.correctIndex;
        
        let starsChange = 0;
        let isCritical = false;
        let msg = "";

        if (isCorrect) {
            if (confidence === 'seguro') {
                msg = "¡Excelente diagnóstico! Respuesta correcta y seguridad clínica demostrada.";
            } else {
                msg = "Acierto correcto, pero indicaste inseguridad. Para asegurar el aprendizaje, este concepto se repetirá más tarde con un caso alternativo (Pregunta B).";
            }
        } else {
            if (confidence === 'seguro') {
                isCritical = true;
                starsChange = -1.5;
                msg = "🚨 ¡PELIGRO CLÍNICO! Diste un diagnóstico erróneo estando 100% seguro. En clínica real esto pone en riesgo al paciente. Tu reputación clínica sufre una penalización mayor.";
            } else {
                starsChange = -0.5;
                msg = "Respuesta incorrecta. No te preocupes, errar es el inicio del aprendizaje. Lee el resumen y vuelve a intentarlo.";
            }
        }

        // Apply health stars change
        setClinicalStars(prev => Math.max(1, Math.min(5, prev + starsChange)));

        setFeedback({
            isCorrect,
            message: msg,
            summary: currentConcept.summary,
            isCritical
        });
        setShowNextButton(true);

        // Update Error Log if wrong (and not already in there)
        if (!isCorrect) {
            if (!errorLog.some(e => e.id === currentConcept.id)) {
                setErrorLog(prev => [...prev, currentConcept]);
            }
        }
    };

    // Go to next item in the queue
    const handleNext = () => {
        if (!currentConcept) return;

        const attemptType = conceptAttempts[currentConcept.id] || 'A';
        const activeQuestion = attemptType === 'A' ? currentConcept.questionA : currentConcept.questionB;
        const isCorrect = selectedOption === activeQuestion.correctIndex;

        let nextQueue = [...queue];
        // Remove current from head
        nextQueue.shift();

        if (isCorrect && confidence === 'seguro') {
            // Mastered! Remove completely.
            setCompletedCount(prev => prev + 1);
        } else {
            // Re-queue
            // Switch to Question B for next attempt if they failed or were unsure
            setConceptAttempts(prev => ({
                ...prev,
                [currentConcept.id]: attemptType === 'A' ? 'B' : 'A' // Toggle A <-> B
            }));
            nextQueue.push(currentConcept);
        }

        setQueue(nextQueue);
        setConfidence(null);
        setSelectedOption(null);
        setFeedback(null);
        setShowNextButton(false);

        if (nextQueue.length > 0) {
            setCurrentConcept(nextQueue[0]);
        } else {
            setCurrentConcept(null);
        }
    };

    // Warmup Questions Mock
    const WARMUP_QUESTIONS = [
        {
            q: "¿A qué distancia por encima de la inserción suele localizarse la lesión por tendinopatía de porción media del tendón de Aquiles?",
            opts: ["0 - 1 cm", "2 - 6 cm", "8 - 10 cm"],
            correct: 1,
            rationale: "La tendinopatía de la porción media del tendón de Aquiles se presenta clásicamente entre 2 y 6 cm proximal a la inserción en el calcáneo."
        },
        {
            q: "El test de Elevación de la Pierna Recta (Lasegue) positivo a 30 grados es un signo de alta especificidad para:",
            opts: ["Tensión neural por compromiso de raíz nerviosa lumbar", "Espasmo protector de los isquiotibiales", "Inestabilidad sacroilíaca anterior"],
            correct: 0,
            rationale: "Un Lasegue positivo temprano (antes de los 35-40°) indica compresión o tensión severa de la raíz nerviosa lumbar (L4-S1)."
        }
    ];

    const handleWarmupAnswer = (idx: number) => {
        setWarmupSelected(idx);
        setWarmupAnswered(true);
        if (idx === WARMUP_QUESTIONS[warmupStep].correct) {
            setWarmupScore(prev => prev + 1);
        }
    };

    const nextWarmup = () => {
        setWarmupStep(prev => prev + 1);
        setWarmupAnswered(false);
        setWarmupSelected(null);
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-10">
            {/* Header Area */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
                
                <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="bg-purple-500/20 text-purple-300 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full border border-purple-500/30">
                                Docente Admin Portal (Beta)
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-2">
                            Gestión de Cuestionarios Activos
                        </h1>
                        <p className="text-slate-400 font-medium max-w-2xl text-sm md:text-base">
                            Diseña cuestionarios autoevaluables que obliguen a tus internos a estudiar. Basado en el método de "Conceptos en Cola" con repetición adaptativa automática.
                        </p>
                    </div>

                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700 w-full md:w-auto flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-2xl font-black text-white shadow-lg">
                            10
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Internos Activos</div>
                            <div className="text-sm font-bold text-slate-200">5to Año Kinesiología</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
                <button
                    onClick={() => setActiveTab('admin')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'admin' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    ⚙️ Gestión de Unidades
                </button>
                <button
                    onClick={() => {
                        setActiveTab('simulador');
                        if (!quizStarted) startSimulator();
                    }}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'simulador' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    🎓 Simulador Alumno (Cola)
                </button>
                <button
                    onClick={() => setActiveTab('bitacora')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'bitacora' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    📖 Bitácora de Errores ({errorLog.length})
                </button>
                <button
                    onClick={() => setActiveTab('warmup')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold transition ${activeTab === 'warmup' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                >
                    🔥 Calentamiento Diario
                </button>
            </div>

            {/* Content Area */}
            <div className="min-h-[500px]">
                {/* 1. ADMIN TAB */}
                {activeTab === 'admin' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Units list and Creator */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Generator Card */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">Generar Nueva Unidad con IA</h3>
                                    <p className="text-slate-500 text-sm">Selecciona tu cuaderno de NotebookLM para generar cuestionarios de Conceptos en Cola automáticamente.</p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase text-slate-500 tracking-wider mb-2">Cuaderno de NotebookLM</label>
                                        <select
                                            value={selectedNotebook}
                                            onChange={(e) => setSelectedNotebook(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-medium focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                            disabled={isGenerating}
                                        >
                                            {NOTEBOOKS_MOCK.map((notebook) => (
                                                <option key={notebook.id} value={notebook.id}>
                                                    📚 {notebook.title} ({notebook.sources} fuentes)
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating}
                                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isGenerating ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span>Generando Unidad...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>🧠 Generar Estructura con NotebookLM</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Log output console */}
                                {generationLog.length > 0 && (
                                    <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs text-green-400 space-y-1.5 max-h-48 overflow-y-auto border border-slate-800">
                                        {generationLog.map((log, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <span className="text-slate-500">[{idx+1}]</span>
                                                <span>{log}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Active Units */}
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-lg font-bold text-slate-800">Unidades de Evaluación Actuales</h3>
                                <div className="space-y-3">
                                    {units.map((unit) => (
                                        <div key={unit.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:bg-slate-50 transition">
                                            <div className="space-y-1">
                                                <h4 className="font-bold text-slate-800 text-sm md:text-base">{unit.title}</h4>
                                                <div className="flex gap-4 text-xs text-slate-500 font-medium">
                                                    <span>Origen: 📖 {unit.notebook}</span>
                                                    <span>•</span>
                                                    <span>Conceptos: 🧠 {unit.conceptsCount}</span>
                                                </div>
                                            </div>
                                            <span className={`px-2.5 py-1 text-xs font-black rounded-full uppercase tracking-wider ${unit.status === 'Activo' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                                {unit.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Leaderboard panel (Top 3) */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Cuadro de Honor (Top 3)</h3>
                                    <p className="text-slate-500 text-xs">Visibilidad reducida para resguardar la autoestima del grupo.</p>
                                </div>

                                <div className="space-y-4">
                                    {leaderboard.map((user) => (
                                        <div key={user.rank} className="flex items-center gap-4 p-3 border border-slate-100 rounded-2xl bg-gradient-to-r from-slate-50 to-white">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black ${
                                                user.rank === 1 ? 'bg-amber-100 text-amber-700' :
                                                user.rank === 2 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                #{user.rank}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-slate-800 text-sm truncate">{user.name}</div>
                                                <div className="text-xs text-purple-600 font-black">{user.streak}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-700">Rendimiento</div>
                                                <div className="text-sm font-black text-slate-900">{user.rating} ★</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100 text-xs font-medium text-purple-800 leading-relaxed">
                                    💡 Los alumnos en puestos inferiores solo pueden ver sus estadísticas personales y puesto actual de forma privada (ej: *"Tu posición actual: #7. Racha: 1 semana"*).
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. SIMULATOR TAB */}
                {activeTab === 'simulador' && (
                    <div className="max-w-3xl mx-auto">
                        {!quizStarted ? (
                            <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-6">
                                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto text-4xl">
                                    🎓
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-800">Prueba el Simulador de Alumno</h3>
                                    <p className="text-slate-500 max-w-md mx-auto">
                                        Experimenta la dinámica de "Conceptos en Cola" con un cuestionario demo de 3 conceptos de Kinesiología y sus tres complementos activos.
                                    </p>
                                </div>
                                <button
                                    onClick={startSimulator}
                                    className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 transition"
                                >
                                    Comenzar Simulación
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Queue Status Bar */}
                                <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="w-full md:w-auto">
                                        <div className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">
                                            Conceptos Dominados
                                        </div>
                                        <div className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            <span>{completedCount} de {totalInitialCount}</span>
                                            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-500">
                                                En cola: {queue.length} restantes
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stars Bar (Clinical Reputation) */}
                                    <div className="w-full md:w-auto flex items-center gap-2 justify-end">
                                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Reputación Clínica:</span>
                                        <div className="flex gap-0.5 text-lg">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <span key={i} className={i < Math.round(clinicalStars) ? 'text-amber-400' : 'text-slate-200'}>
                                                    ★
                                                </span>
                                            ))}
                                        </div>
                                        <span className="text-sm font-black text-slate-800">({clinicalStars.toFixed(1)}/5)</span>
                                    </div>
                                </div>

                                {currentConcept ? (
                                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                        {/* Card Header (Concept name) */}
                                        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                                            <div>
                                                <span className="text-xs font-black uppercase text-purple-400 tracking-wider">Concepto Evaluado</span>
                                                <h4 className="font-bold text-lg">{currentConcept.name}</h4>
                                            </div>
                                            <span className="bg-slate-800 px-3 py-1 rounded-full text-xs font-bold text-slate-300">
                                                Variante de Pregunta: {conceptAttempts[currentConcept.id] || 'A'}
                                            </span>
                                        </div>

                                        <div className="p-6 space-y-6">
                                            {/* Step 1: Confidence Gauge */}
                                            {confidence === null ? (
                                                <div className="space-y-4 text-center py-6">
                                                    <h5 className="font-bold text-slate-800 text-lg">¿Qué tan seguro estás de dominar este concepto clínico?</h5>
                                                    <p className="text-slate-500 text-sm max-w-md mx-auto">
                                                        Tu nivel de confianza determinará el impacto en tu reputación y la reiteración de la pregunta si te equivocas.
                                                    </p>
                                                    <div className="flex gap-4 justify-center pt-2">
                                                        <button
                                                            onClick={() => setConfidence('seguro')}
                                                            className="px-6 py-3.5 bg-gradient-to-b from-green-50 to-green-100/50 hover:from-green-100 hover:to-green-200 text-green-700 font-bold border-2 border-green-200 rounded-2xl transition flex flex-col items-center gap-1 w-44 shadow-sm"
                                                        >
                                                            <span className="text-xl">💪 seguro</span>
                                                            <span className="text-[10px] uppercase font-black tracking-wider text-green-600">Alta Penalización</span>
                                                        </button>
                                                        <button
                                                            onClick={() => setConfidence('duda')}
                                                            className="px-6 py-3.5 bg-gradient-to-b from-amber-50 to-amber-100/50 hover:from-amber-100 hover:to-amber-200 text-amber-700 font-bold border-2 border-amber-200 rounded-2xl transition flex flex-col items-center gap-1 w-44 shadow-sm"
                                                        >
                                                            <span className="text-xl">🤔 Tengo Dudas</span>
                                                            <span className="text-[10px] uppercase font-black tracking-wider text-amber-600">Cero Penalización</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                /* Step 2: The Question */
                                                <div className="space-y-6">
                                                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                                            Confianza declarada: {confidence === 'seguro' ? '🟢 SEGURO' : '🟡 DUDOSO'}
                                                        </span>
                                                        <button
                                                            onClick={() => {
                                                                setConfidence(null);
                                                                setSelectedOption(null);
                                                                setFeedback(null);
                                                            }}
                                                            className="text-xs text-purple-600 hover:text-purple-800 font-bold"
                                                            disabled={showNextButton}
                                                        >
                                                            Cambiar Confianza
                                                        </button>
                                                    </div>

                                                    <p className="text-slate-800 font-semibold leading-relaxed text-base">
                                                        {conceptAttempts[currentConcept.id] === 'B' ? currentConcept.questionB.text : currentConcept.questionA.text}
                                                    </p>

                                                    <div className="space-y-3">
                                                        {(conceptAttempts[currentConcept.id] === 'B' ? currentConcept.questionB.options : currentConcept.questionA.options).map((option, idx) => {
                                                            const isSelected = selectedOption === idx;
                                                            const activeQ = conceptAttempts[currentConcept.id] === 'B' ? currentConcept.questionB : currentConcept.questionA;
                                                            const isCorrectOption = idx === activeQ.correctIndex;
                                                            
                                                            let btnStyle = "border-slate-200 hover:bg-slate-50 text-slate-700 bg-white";
                                                            if (selectedOption !== null) {
                                                                if (isCorrectOption) {
                                                                    btnStyle = "border-green-500 bg-green-50 text-green-800";
                                                                } else if (isSelected) {
                                                                    btnStyle = "border-red-500 bg-red-50 text-red-800";
                                                                } else {
                                                                    btnStyle = "border-slate-100 opacity-60 text-slate-400 bg-white";
                                                                }
                                                            } else {
                                                                btnStyle = "border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 text-slate-700 bg-white cursor-pointer";
                                                            }

                                                            return (
                                                                <button
                                                                    key={idx}
                                                                    onClick={() => selectedOption === null && handleAnswerSubmit(idx)}
                                                                    className={`w-full text-left p-4 border-2 rounded-2xl text-sm font-medium transition flex justify-between items-center ${btnStyle}`}
                                                                    disabled={selectedOption !== null}
                                                                >
                                                                    <span>{option}</span>
                                                                    {selectedOption !== null && isCorrectOption && (
                                                                        <span className="text-green-600 font-bold text-lg">✓</span>
                                                                    )}
                                                                    {selectedOption !== null && isSelected && !isCorrectOption && (
                                                                        <span className="text-red-600 font-bold text-lg">✗</span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Step 3: Pedago Feedback (Micro-resumen if wrong or correct with doubts) */}
                                            <AnimatePresence>
                                                {feedback && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 15 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 15 }}
                                                        className="space-y-4 border-t border-slate-100 pt-6"
                                                    >
                                                        <div className={`p-4 rounded-2xl border text-sm font-medium leading-relaxed ${
                                                            feedback.isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                                                        }`}>
                                                            <div className="font-bold mb-1">{feedback.isCorrect ? '✓ Correcto' : '✗ Incorrecto'}</div>
                                                            {feedback.message}
                                                        </div>

                                                        {/* The learning capsule */}
                                                        {(!feedback.isCorrect || confidence === 'duda') && (
                                                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 space-y-3 shadow-inner">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-lg">📖</span>
                                                                    <span className="text-xs font-black uppercase text-purple-700 tracking-wider">Concepto Científico (Evidencia)</span>
                                                                </div>
                                                                <p className="text-slate-700 text-sm font-medium italic leading-relaxed">
                                                                    "{feedback.summary}"
                                                                </p>
                                                                <p className="text-[10px] text-purple-500 font-bold">
                                                                    * Extraído del cuaderno: Detección y Diagnóstico Diferencial del Cuadrante Inferior.
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={handleNext}
                                                                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition"
                                                            >
                                                                Avanzar Cola de Estudio →
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                ) : (
                                    /* Finished Simulator State */
                                    <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-6">
                                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl text-green-600">
                                            🎉
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black text-slate-800">¡Cuestionario Completado!</h3>
                                            <p className="text-slate-500 max-w-md mx-auto">
                                                Has superado todos los conceptos demostrando un dominio clínico correcto. Tu reputación final se consolidó en <strong className="text-slate-900">{clinicalStars.toFixed(1)} estrellas</strong>.
                                            </p>
                                        </div>

                                        {errorLog.length > 0 && (
                                            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-600 text-sm text-left max-w-md mx-auto space-y-2">
                                                <div className="font-bold text-slate-800 flex items-center gap-2">
                                                    <span>📝 Bitácora Actualizada:</span>
                                                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black">
                                                        +{errorLog.length} apuntes
                                                    </span>
                                                </div>
                                                <p className="text-xs leading-relaxed">
                                                    Los conceptos que fallaste fueron añadidos automáticamente a tu Bitácora. Podrás repasarlos cuando quieras.
                                                </p>
                                            </div>
                                        )}

                                        <button
                                            onClick={startSimulator}
                                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition"
                                        >
                                            Reiniciar Simulación
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. BITACORA TAB */}
                {activeTab === 'bitacora' && (
                    <div className="max-w-3xl mx-auto space-y-6">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Mi Bitácora de Errores</h3>
                            <p className="text-slate-500 text-sm">
                                Este es tu resumen de estudio personalizado. Muestra únicamente la base teórica de los conceptos clínicos que fallaste durante el cuestionario.
                            </p>
                        </div>

                        {errorLog.length === 0 ? (
                            <div className="bg-slate-50 rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
                                <span className="text-4xl">📖</span>
                                <h4 className="font-bold text-slate-700 mt-4">Bitácora Vacía</h4>
                                <p className="text-slate-500 text-sm mt-1 max-w-xs mx-auto">
                                    ¡Excelente! No tienes fallas guardadas. Para poblar la bitácora, inicia el simulador clínico y comete algunos errores.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {errorLog.map((concept) => (
                                    <div key={concept.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                                            <span className="font-bold text-slate-800 text-sm md:text-base">🧠 {concept.name}</span>
                                            <span className="bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">
                                                Corregido
                                            </span>
                                        </div>
                                        <p className="text-slate-700 text-sm italic font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            "{concept.summary}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 4. DAILY WARMUP TAB */}
                {activeTab === 'warmup' && (
                    <div className="max-w-xl mx-auto">
                        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">Calentamiento de Guardia</h3>
                                    <p className="text-slate-500 text-xs">Mantén frescos los conceptos aprobados de semanas anteriores.</p>
                                </div>
                                <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-black uppercase tracking-wider">
                                    3 Preguntas
                                </span>
                            </div>

                            {warmupStep < WARMUP_QUESTIONS.length ? (
                                <div className="space-y-5">
                                    <div className="text-xs font-black text-slate-400 uppercase tracking-wider">
                                        Pregunta {warmupStep + 1} de {WARMUP_QUESTIONS.length}
                                    </div>

                                    <p className="text-slate-800 font-semibold text-sm md:text-base leading-relaxed">
                                        {WARMUP_QUESTIONS[warmupStep].q}
                                    </p>

                                    <div className="space-y-3">
                                        {WARMUP_QUESTIONS[warmupStep].opts.map((option, idx) => {
                                            const isSelected = warmupSelected === idx;
                                            const isCorrect = idx === WARMUP_QUESTIONS[warmupStep].correct;

                                            let btnStyle = "border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer";
                                            if (warmupAnswered) {
                                                if (isCorrect) {
                                                    btnStyle = "border-green-500 bg-green-50 text-green-800";
                                                } else if (isSelected) {
                                                    btnStyle = "border-red-500 bg-red-50 text-red-800";
                                                } else {
                                                    btnStyle = "border-slate-100 opacity-60 text-slate-400 bg-white";
                                                }
                                            }

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => !warmupAnswered && handleWarmupAnswer(idx)}
                                                    className={`w-full text-left p-4 border-2 rounded-2xl text-xs md:text-sm font-medium transition ${btnStyle}`}
                                                    disabled={warmupAnswered}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {warmupAnswered && (
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-2">
                                            <div className="text-xs font-black uppercase text-slate-500">Fundamento Clínico:</div>
                                            <p className="text-slate-600 text-xs md:text-sm leading-relaxed">
                                                {WARMUP_QUESTIONS[warmupStep].rationale}
                                            </p>
                                            <div className="flex justify-end pt-2">
                                                <button
                                                    onClick={nextWarmup}
                                                    className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition"
                                                >
                                                    {warmupStep + 1 === WARMUP_QUESTIONS.length ? 'Finalizar Calentamiento' : 'Siguiente Pregunta →'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-6 space-y-4">
                                    <div className="text-4xl">⚡</div>
                                    <h4 className="font-bold text-slate-800 text-lg">¡Calentamiento de Guardia Finalizado!</h4>
                                    <p className="text-slate-500 text-sm max-w-xs mx-auto">
                                        Acertaste {warmupScore} de {WARMUP_QUESTIONS.length} preguntas. ¡Has activado tu bono diario de Racha!
                                    </p>
                                    <button
                                        onClick={() => {
                                            setWarmupStep(0);
                                            setWarmupScore(0);
                                            setWarmupAnswered(false);
                                            setWarmupSelected(null);
                                        }}
                                        className="px-5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
                                    >
                                        Repetir Guardia
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
