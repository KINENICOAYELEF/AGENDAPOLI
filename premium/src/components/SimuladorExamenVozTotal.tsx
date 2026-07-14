"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGeminiLive, getAudioDevices } from '@/hooks/useGeminiLive';
import { generateDynamicPatientPrompt, getVoiceForPersona } from '@/utils/patientPrompts';
import type { SimCaseType, SimInterviewType, SimInterviewFeedbackType, SimExamType, SimEvaluationType, SimCommissionType } from '@/lib/ai/simuladorSchemas';
import { guardarIntento, getTareaConfig, verificarCumplimiento } from '@/services/simuladorFirebase';
import { SimuladorHistorial } from './SimuladorHistorial';

// ─── Types ───
type SimPhase = 'SETUP' | 'INTERVIEW' | 'REASONING' | 'EXAM' | 'REASONING2' | 'INTERVENTION' | 'CONSTRUCTION' | 'EXPOSITION' | 'COMMISSION' | 'RESULTS';

const EXAM_MODULES = [
    { key: 'observacion_movimiento_inicial', label: 'Observación / Movimiento Inicial', ejemplo: 'Ej: Marcha, postura asimétrica, patrón de movimiento' },
    { key: 'rango_movimiento_analitico', label: 'Rango de Movimiento Analítico', ejemplo: 'Ej: Flexión pasiva 90°, rotación interna activa reducida' },
    { key: 'fuerza_tolerancia_carga', label: 'Fuerza / Tolerancia a la Carga', ejemplo: 'Ej: Evaluación MMT, Heel raise test, dinamometría' },
    { key: 'palpacion', label: 'Palpación', ejemplo: 'Ej: Línea articular, inserción tendinosa, trigger points' },
    { key: 'neuro_vascular', label: 'Neuro-Vascular / Somatosensorial', ejemplo: 'Ej: Reflejos, dermatomas L4-S1, pulsos distales' },
    { key: 'control_motor_sensoriomotor', label: 'Control Motor / Sensoriomotor', ejemplo: 'Ej: Single leg stance, control pélvico, step down' },
    { key: 'pruebas_ortopedicas', label: 'Pruebas Ortopédicas Dirigidas', ejemplo: 'Ej: Lachman, Neer, Slump test, FADIR' },
    { key: 'pruebas_funcionales_reintegro', label: 'Pruebas Funcionales / Reintegro', ejemplo: 'Ej: Y-Balance test, Single leg hop, sentadilla' },
];

const PHASE_LABELS: Record<SimPhase, string> = {
    SETUP: 'Configurar Caso',
    INTERVIEW: 'Estación 1: Entrevista Clínica',
    REASONING: 'Estación 2: Razonamiento I',
    EXAM: 'Estación 3: Examen Físico',
    REASONING2: 'Estación 4: Razonamiento II',
    INTERVENTION: 'Estación 5: Intervención Clínica',
    CONSTRUCTION: 'Estación 6: Escritura Kinesiológica',
    EXPOSITION: 'Estación 7: Exposición de Caso',
    COMMISSION: 'Estación 8: Defensa de Comisión',
    RESULTS: 'Resultados y Nota',
};

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

const OSCE_PHASES: SimPhase[] = [
    'INTERVIEW',
    'REASONING',
    'EXAM',
    'REASONING2',
    'INTERVENTION',
    'CONSTRUCTION',
    'EXPOSITION',
    'COMMISSION',
    'RESULTS'
];

export function SimuladorExamenVozTotal() {
    const { user } = useAuth();
    const [phase, setPhase] = useState<SimPhase>('SETUP');
    const [loading, setLoading] = useState(false);
    const [loadingTranscription, setLoadingTranscription] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [showExitWarning, setShowExitWarning] = useState(false);
    const [showHistorial, setShowHistorial] = useState(false);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

    // Local recording refs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const localStreamRef = useRef<MediaStream | null>(null);

    const stopLocalStream = useCallback(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current = null;
        }
    }, []);

    useEffect(() => {
        getAudioDevices().then(setAudioDevices).catch(() => {});
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopLocalStream();
        };
    }, [stopLocalStream]);

    // AI Data
    const [caseData, setCaseData] = useState<SimCaseType | null>(null);
    const [interviewData, setInterviewData] = useState<SimInterviewType | null>(null);
    const [examData, setExamData] = useState<SimExamType | null>(null);
    const [evaluationData, setEvaluationData] = useState<SimEvaluationType | null>(null);
    const [commissionData, setCommissionData] = useState<any | null>(null);
    const [interviewFeedbackData, setInterviewFeedbackData] = useState<SimInterviewFeedbackType | null>(null);
    
    // UI state
    const [showInterviewAnalysis, setShowInterviewAnalysis] = useState(false);
    const [showCommunicationFeedback, setShowCommunicationFeedback] = useState(false);

    // Student Work
    const [setupForm, setSetupForm] = useState({ tipo: 'aleatorio', area: '', dificultad: 'intermedio', descripcion: '', personalidad: 'colaborador', modoDemo: false });
    const [studentQuestions, setStudentQuestions] = useState('');
    const [reasoning, setReasoning] = useState({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
    const [examSelections, setExamSelections] = useState<Record<string, { selected: boolean; justificacion: string; pruebas: string }>>(() => {
        const init: Record<string, { selected: boolean; justificacion: string; pruebas: string }> = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        return init;
    });
    const [construction, setConstruction] = useState({ diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
    const [commissionAnswers, setCommissionAnswers] = useState<string[]>([]);
    const [reasoning2, setReasoning2] = useState({ hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
    const [interventions, setInterventions] = useState([
        { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' },
        { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }
    ]);

    // Clean voice transcripts per phase
    const [phaseTranscripts, setPhaseTranscripts] = useState<Record<string, string>>({
        interview: '',
        reasoning: '',
        exam: '',
        reasoning2: '',
        intervention: '',
        exposition: '',
        commission: ''
    });

    // ─── Audio Chime Synthesizer (Native Web Audio API) ───
    const playChime = (type: 'beep' | 'bell') => {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            
            if (type === 'beep') {
                // Short warning double-beep
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(800, ctx.currentTime);
                gain1.gain.setValueAtTime(0.08, ctx.currentTime);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start();
                osc1.stop(ctx.currentTime + 0.12);
                
                setTimeout(() => {
                    const osc2 = ctx.createOscillator();
                    const gain2 = ctx.createGain();
                    osc2.type = 'sine';
                    osc2.frequency.setValueAtTime(800, ctx.currentTime);
                    gain2.gain.setValueAtTime(0.08, ctx.currentTime);
                    osc2.connect(gain2);
                    gain2.connect(ctx.destination);
                    osc2.start();
                    osc2.stop(ctx.currentTime + 0.12);
                }, 200);
            } else {
                // Long metalloid bell chord representing station chime
                const freqs = [329.63, 392.00, 523.25, 659.25]; // E minor / C major chords
                freqs.forEach((f, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, ctx.currentTime);
                    gain.gain.setValueAtTime(0.12, ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start(ctx.currentTime + idx * 0.06);
                    osc.stop(ctx.currentTime + 2.5);
                });
            }
        } catch (e) {
            console.error("Audio Context failed to play chime:", e);
        }
    };

    // ─── Local browser audio recording helpers ───
    const startLocalRecording = async () => {
        try {
            chunksRef.current = [];
            const stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined } });
            localStreamRef.current = stream;
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };
            recorder.start(250);
            console.log("[REC] Local recording started.");
        } catch (err) {
            console.error("[REC] Error starting recorder:", err);
        }
    };

    const stopLocalRecording = (): Promise<{ blob: Blob; base64: string } | null> => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                stopLocalStream();
                resolve(null);
                return;
            }
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                stopLocalStream();
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64String = (reader.result as string).split(',')[1];
                    resolve({ blob, base64: base64String });
                };
            };
            recorder.stop();
            console.log("[REC] Local recording stopped.");
        });
    };

    // ─── OSCE Station Timing Config ───
    const getPhaseDuration = (p: SimPhase): number => {
        if (setupForm.modoDemo) return 30; // 30 segundos en modo demo para pruebas rápidas
        switch (p) {
            case 'INTERVIEW': return 480;   // 8 min
            case 'REASONING': return 180;   // 3 min
            case 'EXAM': return 360;        // 6 min
            case 'REASONING2': return 180;  // 3 min
            case 'INTERVENTION': return 300;// 5 min
            case 'CONSTRUCTION': return 480;// 8 min
            case 'EXPOSITION': return 300;  // 5 min
            case 'COMMISSION': return 360;  // 6 min
            default: return 0;
        }
    };

    const startCountdown = useCallback((seconds: number) => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimer(seconds);
        timerRef.current = setInterval(() => {
            setTimer(t => {
                if (t <= 1) {
                    clearInterval(timerRef.current!);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
    }, []);

    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // ─── Dynamic Prompts & Voices for Live API ───
    const getSystemInstructionForPhase = (currentPhase: SimPhase, currentCaseData: SimCaseType | null, form: any) => {
        if (!currentCaseData) return '';
        switch (currentPhase) {
            case 'INTERVIEW': {
                const personality = form.personalidad || 'colaborador';
                let personalityPrompt = '';
                if (personality === 'catastrofista') {
                    personalityPrompt = '\n\nATENCIÓN: Tu personalidad es CATASTROFISTA y ANSIOSA. Te duele muchísimo, tienes mucho miedo a moverte (kinesiofobia), preguntas frecuentemente si vas a volver a jugar o caminar normal, exageras tus quejas y estás muy sensible emocionalmente. Expresa frustración o temor.';
                } else if (personality === 'reticente') {
                    personalityPrompt = '\n\nATENCIÓN: Tu personalidad es RETICENTE, SECA y CORTANTE. Respondes con pocas palabras (ej: "sí", "no", "hace dos semanas"), no das detalles de forma voluntaria. El alumno debe esforzarse mucho haciendo preguntas abiertas específicas para obtener la historia y mecanismo de lesión.';
                } else {
                    personalityPrompt = '\n\nATENCIÓN: Tu personalidad es COLABORADORA y TRANQUILA. Respondes con honestidad y de forma normal a las preguntas del estudiante.';
                }
                return generateDynamicPatientPrompt(form.area, form.dificultad, '', currentCaseData.ficha_visible) + personalityPrompt;
            }
            case 'REASONING':
                return `Actúas como un Docente Evaluador del Examen Clínico de Kinesiología. El alumno acaba de terminar la entrevista con el paciente.
                Interrógale verbalmente sobre su análisis clínico inicial de forma muy seria y rigurosa.
                Pregúntale cuáles son sus 3 hipótesis diagnósticas preliminares, su clasificación de dolor (nociceptivo, neuropático, nociplástico, mixto), irritabilidad estimada (alta/media/baja) y factores biopsicosociales (banderas rojas/amarillas).
                Sé profesional, académico y formal. Pregúntale una cosa a la vez si responde largo.
                Comienza diciendo exactamente: 'Kinesiólogo, el paciente ha salido del box. Por favor, dígame cuáles son sus hipótesis diagnósticas y qué factores biopsicosociales o banderas rojas identificó'.`;
            case 'EXAM':
                return `Actúas en doble rol en este Examen Físico. Eres el Paciente (${currentCaseData.ficha_visible.nombre}) y el Evaluador Técnico del Box.
                Si el estudiante se dirige a ti por el nombre del paciente (ej: 'Juan' o 'Paciente'), responde de forma coloquial como el paciente describiendo dolor o sensaciones de acuerdo a estos hallazgos exactos: ${JSON.stringify(currentCaseData.hallazgos_todos_modulos)}.
                Si el estudiante se dirige a ti como el evaluador (ej: 'Comisión', 'Colega', 'Docente') solicitando medir o realizar una prueba (ej: 'Mido flexión pasiva de rodilla' o 'Prueba de Lachman'), responde con seriedad indicando la medición exacta de los hallazgos: ${JSON.stringify(currentCaseData.hallazgos_todos_modulos)}.
                No inventes hallazgos que no estén en la lista. Mantén tus intervenciones cortas y precisas.
                Comienza diciendo: 'Kinesiólogo, estamos en el examen físico. Puede indicarme qué pruebas desea realizar en el paciente o qué mediciones me solicita'.`;
            case 'REASONING2':
                return `Actúas como el Docente Evaluador de Kinesiología. El alumno ya tiene los hallazgos del examen físico.
                Interrógale verbalmente: ¿qué hipótesis confirma con los hallazgos obtenidos, cuáles descarta, y cuál es su diagnóstico clínico presuntivo actual?
                Sé riguroso, formal y socrático.
                Comienza diciendo: 'Kinesiólogo, con los hallazgos del examen sobre la mesa, dígame cómo cambia su razonamiento inicial y cuál es su diagnóstico presuntivo actual'.`;
            case 'INTERVENTION':
                return `Actúas en doble rol durante la planificación de intervenciones clínicas.
                Si el estudiante te explica el ejercicio o te educa (ej: 'Juan, vas a hacer esto...'), responde como el Paciente de forma colaborativa o con dudas típicas de paciente (ej: '¿Cuánto peso uso?', '¿Me va a doler?').
                Si el estudiante justifica biomecánicamente la técnica o dosificación a la comisión (ej: 'Docente, elijo esto por...'), responde como el Evaluador validando su lógica o haciendo una pregunta aclaratoria corta.
                Ficha del Paciente: ${JSON.stringify(currentCaseData.ficha_visible)}.
                Hallazgos: ${JSON.stringify(currentCaseData.hallazgos_todos_modulos)}.
                Comienza diciendo: 'Kinesiólogo, planifiquemos las intervenciones. Explíquele la primera técnica a su paciente y justifíquemela clínicamente a la comisión'.`;
            case 'EXPOSITION':
                return `Actúas como un miembro silencioso de la Comisión Evaluadora de Kinesiología.
                El estudiante va a exponer su caso clínico completo (anamnesis, examen físico, diagnóstico CIF, metas y fases de rehabilitación) sin interrupciones por un máximo de 5 minutos.
                REGLA DE ORO DE SILENCIO: Debes permanecer en SILENCIO ABSOLUTO. NO respondas, NO interrumpas, NO comentes ni hagas sonidos de audio bajo ninguna circunstancia mientras el alumno expone. Solo escucha y registra todo lo que expone.
                Solo si el alumno dice directamente que ha terminado o finaliza formalmente (ej: 'Esta es mi presentación', 'He terminado', 'Comisión, quedo atento'), responde de forma muy breve: 'Muchas gracias por su exposición. Puede finalizar la conexión para dar inicio al interrogatorio'.`;
            case 'COMMISSION':
                return `Actúas como la Comisión Evaluadora (2 docentes expertos) en un examen de título de kinesiología.
                Vas a realizar un interrogatorio socrático exigente al alumno basado en su trabajo completo.
                Formula 2 o 3 preguntas críticas desafiantes sobre su plan de intervención, su diagnóstico CIF o sus metas operacionales basándote en la información general.
                Haz una sola pregunta a la vez. Cuando responda, repregúntale o cuestiona su justificación científica para obligarlo a defender su decisión clínica en vivo.
                Comienza saludando formalmente y formulando la primera pregunta crítica sobre su diagnóstico CIF o sus objetivos.`;
            default:
                return 'Eres un asistente clínico de kinesiología.';
        }
    };

    const getVoiceForPhase = (currentPhase: SimPhase, currentCaseData: SimCaseType | null) => {
        if (!currentCaseData) return 'Aoede';
        if (currentPhase === 'INTERVIEW' || currentPhase === 'EXAM' || currentPhase === 'INTERVENTION') {
            return getVoiceForPersona(currentCaseData.ficha_visible.sexo || 'Mujer');
        }
        return 'Puck'; // Serious academic/docente voice
    };

    // ─── useGeminiLive Instantiation ───
    const { connect, disconnect, connectionState, transcript, clearTranscript, isSpeaking, volume, isMicOpen, toggleMic } = useGeminiLive({
        systemInstruction: getSystemInstructionForPhase(phase, caseData, setupForm),
        voiceName: getVoiceForPhase(phase, caseData),
        audioDeviceId: selectedDeviceId || undefined
    });

    const formattedTranscript = transcript.map(t => `${t.role === 'user' ? 'Kinesiólogo' : 'Paciente/Tutor'}: ${t.text}`).join('\n');

    // Generic handler to end a voice connection, stop local recording and fetch clean transcript
    const processVoicePhaseEnd = async (): Promise<string> => {
        disconnect();
        setLoadingTranscription(true);
        try {
            const recordingResult = await stopLocalRecording();
            if (recordingResult && recordingResult.base64) {
                const res = await simFetch('transcribe', {
                    audioBase64: recordingResult.base64,
                    mimeType: 'audio/webm'
                }, user?.uid || '');
                return res.text || '(Sin transcripción)';
            }
        } catch (err) {
            console.error("Transcription error:", err);
            setError("Error al transcribir el audio. Usando registro de WebSocket alternativo.");
        } finally {
            setLoadingTranscription(false);
        }
        return formattedTranscript || '(Sin interacción de voz)';
    };

    // Estación 1: Entrevista
    const handleEndVoiceInterview = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setStudentQuestions(transcriptText);
        setPhaseTranscripts(prev => ({ ...prev, interview: transcriptText }));

        setLoading(true); setError('');
        try {
            const data = await simFetch('interview', {
                perfil_secreto: caseData.perfil_secreto,
                ficha_visible: caseData.ficha_visible,
                preguntas_estudiante: transcriptText,
            }, user.uid);
            data.respuestas_paciente = transcriptText;
            setInterviewData(data);

            try {
                const feedbackData = await simFetch('interview_feedback', {
                    perfil_secreto: caseData.perfil_secreto,
                    preguntas_estudiante: transcriptText,
                }, user.uid);
                setInterviewFeedbackData(feedbackData);
                setShowCommunicationFeedback(true);
            } catch (err) {
                console.error("Feedback error:", err);
            }

            const next: SimPhase = 'REASONING';
            setPhase(next);
            startCountdown(getPhaseDuration(next));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    // Estación 2: Razonamiento I
    const handleEndReasoningVoice = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, reasoning: transcriptText }));

        const next: SimPhase = 'EXAM';
        setPhase(next);
        startCountdown(getPhaseDuration(next));
    };

    // Estación 3: Examen Físico
    const handleEndExamVoice = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, exam: transcriptText }));

        setLoading(true); setError('');
        try {
            const data = await simFetch('exam', {
                hallazgos_todos_modulos: caseData.hallazgos_todos_modulos,
                rubrica_ideal: caseData.rubrica_ideal,
                transcripcion_examen: transcriptText
            }, user.uid);
            setExamData(data);

            const next: SimPhase = 'REASONING2';
            setPhase(next);
            startCountdown(getPhaseDuration(next));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    // Estación 4: Razonamiento II
    const handleEndReasoning2Voice = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, reasoning2: transcriptText }));

        const next: SimPhase = 'INTERVENTION';
        setPhase(next);
        startCountdown(getPhaseDuration(next));
    };

    // Estación 5: Intervención
    const handleEndInterventionVoice = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, intervention: transcriptText }));

        const next: SimPhase = 'CONSTRUCTION';
        setPhase(next);
        startCountdown(getPhaseDuration(next));
    };

    // Estación 6: Construcción CIF (Escrito)
    const handleConstructionSubmit = async () => {
        if (!user || !caseData) return;
        if (!construction.diagnostico.trim()) { setError('Completa al menos el diagnóstico.'); return; }
        
        const next: SimPhase = 'EXPOSITION';
        setPhase(next);
        startCountdown(getPhaseDuration(next));
    };

    // Estación 7: Exposición del caso
    const handleEndExpositionVoice = async () => {
        if (!user || !caseData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, exposition: transcriptText }));

        setLoading(true); setError('');
        try {
            const data = await simFetch('evaluate', {
                caso_resumen: { ficha: caseData.ficha_visible, hallazgos: caseData.hallazgos_todos_modulos },
                rubrica_ideal: caseData.rubrica_ideal,
                trabajo_estudiante: {
                    preguntas_entrevista: studentQuestions,
                    razonamiento1_voz: phaseTranscripts.reasoning,
                    examen_fisico_voz: phaseTranscripts.exam,
                    razonamiento2_voz: phaseTranscripts.reasoning2,
                    intervenciones_voz: phaseTranscripts.intervention,
                    exposicion_caso_voz: transcriptText,
                    hipotesis_previas: reasoning.hipotesis.filter(h => h.trim()),
                    clasificacion_dolor_previa: reasoning.clasificacion_dolor,
                    irritabilidad_previa: reasoning.irritabilidad,
                    banderas: { rojas: reasoning.banderas_rojas, bps: reasoning.factores_bps },
                    hipotesis_confirmadas: reasoning2.hipotesis_confirmadas,
                    clasificacion_dolor_final: reasoning2.clasificacion_actualizada,
                    diagnostico_presuntivo: reasoning2.diagnostico_presuntivo,
                    hallazgos_clave_integrados: reasoning2.hallazgos_clave,
                    diagnostico: construction.diagnostico,
                    objetivo_general: construction.objetivo_general,
                    objetivos_especificos: construction.objetivos_especificos,
                    objetivos_operacionales: construction.objetivos_operacionales,
                    plan_fases: construction.plan_fases,
                    reevaluacion: construction.reevaluacion,
                },
            }, user.uid);
            setEvaluationData(data);
            setCommissionAnswers(new Array(data.preguntas_comision?.length || 0).fill(''));

            const next: SimPhase = 'COMMISSION';
            setPhase(next);
            startCountdown(getPhaseDuration(next));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al evaluar el caso');
        } finally {
            setLoading(false);
        }
    };

    // Estación 8: Defensa de Comisión
    const handleEndCommissionVoice = async () => {
        if (!user || !caseData || !evaluationData) return;
        const transcriptText = await processVoicePhaseEnd();
        setPhaseTranscripts(prev => ({ ...prev, commission: transcriptText }));

        setLoading(true); setError('');
        try {
            const data = await simFetch('commission', {
                preguntas_con_respuesta_ideal: evaluationData.preguntas_comision,
                respuestas_estudiante: new Array(evaluationData.preguntas_comision.length).fill(transcriptText),
            }, user.uid);
            setCommissionData(data);
            
            await persistAttempt(evaluationData, data, transcriptText);
            setPhase('RESULTS');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error en la evaluación de la comisión');
        } finally {
            setLoading(false);
        }
    };

    const handleAutoAdvance = useCallback(() => {
        switch (phase) {
            case 'INTERVIEW':
                handleEndVoiceInterview();
                break;
            case 'REASONING':
                handleEndReasoningVoice();
                break;
            case 'EXAM':
                handleEndExamVoice();
                break;
            case 'REASONING2':
                handleEndReasoning2Voice();
                break;
            case 'INTERVENTION':
                handleEndInterventionVoice();
                break;
            case 'CONSTRUCTION':
                handleConstructionSubmit();
                break;
            case 'EXPOSITION':
                handleEndExpositionVoice();
                break;
            case 'COMMISSION':
                handleEndCommissionVoice();
                break;
        }
    }, [phase, studentQuestions, reasoning, reasoning2, construction, interventions, phaseTranscripts, evaluationData]);

    const autoAdvanceRef = useRef<() => void>(handleAutoAdvance);
    useEffect(() => {
        autoAdvanceRef.current = handleAutoAdvance;
    });

    useEffect(() => {
        if (phase === 'SETUP' || phase === 'RESULTS') return;
        if (timer === 120) {
            playChime('beep');
        }
        if (timer === 0 && !loading && !loadingTranscription) {
            playChime('bell');
            autoAdvanceRef.current();
        }
    }, [timer, phase, loading, loadingTranscription]);

    const persistAttempt = async (evalData = evaluationData, commData = commissionData, finalDefenseText = '') => {
        if (!user) return;
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.removeItem(STORAGE_KEY);
        try {
            await guardarIntento({
                userId: user.uid,
                userEmail: user.email || '',
                userName: user.displayName || user.email || 'Docente Admin',
                area: setupForm.area || 'aleatoria',
                dificultad: setupForm.dificultad || 'intermedio',
                practiceMode: 'completo',
                pacienteNombre: caseData?.ficha_visible?.nombre || '',
                motivoConsulta: caseData?.ficha_visible?.motivo_consulta || '',
                puntajeGlobal: evalData?.puntaje_global ?? 0,
                notaChilena: evalData?.nota_chilena ?? 0,
                nivel: evalData?.nivel ?? '—',
                puntajeComision: commData?.puntaje_comision_global ?? 0,
                notaComision: commData?.nota_chilena_comision ?? 0,
                scorecard: (evalData?.scorecard || {}) as Record<string, { puntaje: number; comentario: string }>,
                tiempoSegundos: 0,
                erroresCriticos: evalData?.errores_criticos || [],
                aciertosDestacados: evalData?.aciertos_destacados || [],
                areasMejora: evalData?.areas_mejora || [],
                perlaDocente: evalData?.perla_docente || '',
                commissionAnswers: [finalDefenseText],
                preguntasComision: evalData?.preguntas_comision || [],
                fullSessionData: {
                    setupForm,
                    studentQuestions,
                    respuestasPaciente: interviewData?.respuestas_paciente || '',
                    reasoning,
                    examSelections,
                    hallazgosRevelados: examData?.hallazgos_revelados || null,
                    reasoning2,
                    interventions,
                    construction,
                    commissionAnswers,
                    phaseTranscripts
                },
                interviewFeedbackData: interviewFeedbackData || null,
            });
        } catch (fbErr) {
            console.error('[Simulador] Firebase Save Error:', fbErr);
        }
    };

    const STORAGE_KEY = 'simulador_voz_total_autosave';
    useEffect(() => {
        if (phase === 'SETUP' || phase === 'RESULTS') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                phase, timer, caseData, interviewData, interviewFeedbackData, examData, evaluationData, commissionData,
                studentQuestions, reasoning, reasoning2, interventions, construction,
                examSelections, commissionAnswers, phaseTranscripts, showInterviewAnalysis, showCommunicationFeedback,
                savedAt: Date.now(),
            }));
        } catch {}
    }, [phase, studentQuestions, reasoning, reasoning2, interventions, construction, examSelections, commissionAnswers, timer, caseData, commissionData, evaluationData, examData, interviewData, interviewFeedbackData, phaseTranscripts, showInterviewAnalysis, showCommunicationFeedback]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const data = JSON.parse(saved);
            if (Date.now() - data.savedAt > 4 * 60 * 60 * 1000) { localStorage.removeItem(STORAGE_KEY); return; }
            if (data.phase && data.caseData) {
                setCaseData(data.caseData);
                setInterviewData(data.interviewData || null);
                setInterviewFeedbackData(data.interviewFeedbackData || null);
                setExamData(data.examData || null);
                setEvaluationData(data.evaluationData || null);
                setCommissionData(data.commissionData || null);
                setStudentQuestions(data.studentQuestions || '');
                setReasoning(data.reasoning || { hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
                setReasoning2(data.reasoning2 || { hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
                setInterventions(data.interventions || [
                    { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' },
                    { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }
                ]);
                setConstruction(data.construction || { diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
                if (data.examSelections) setExamSelections(data.examSelections);
                setCommissionAnswers(data.commissionAnswers || []);
                setPhaseTranscripts(data.phaseTranscripts || {});
                setTimer(data.timer || 0);
                setPhase(data.phase);
                startCountdown(data.timer || getPhaseDuration(data.phase));
            }
        } catch {}
    }, [startCountdown]);

    const isActiveExam = phase !== 'SETUP' && phase !== 'RESULTS';
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isActiveExam) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isActiveExam]);

    useEffect(() => {
        if (!isActiveExam) return;
        window.history.pushState({ simGuard: true }, '');
        const handlePopState = () => {
            if (isActiveExam) {
                window.history.pushState({ simGuard: true }, '');
                setShowExitWarning(true);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isActiveExam, phase]);

    const handleGenerate = async () => {
        if (!user) return;
        setLoading(true); setError('');
        try {
            const data = await simFetch('generate', setupForm, user.uid);
            setCaseData(data);
            
            const firstPhase: SimPhase = 'INTERVIEW';
            setPhase(firstPhase);
            startCountdown(getPhaseDuration(firstPhase));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error al generar el caso.');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        stopLocalStream();
        localStorage.removeItem(STORAGE_KEY);
        setPhase('SETUP'); setCaseData(null); setInterviewData(null); setInterviewFeedbackData(null); setExamData(null);
        setEvaluationData(null); setCommissionData(null); setShowInterviewAnalysis(false); setShowCommunicationFeedback(false);
        setStudentQuestions(''); setTimer(0); setError('');
        setReasoning({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
        setReasoning2({ hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
        setConstruction({ diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
        setInterventions([{ tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }, { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }]);
        setCommissionAnswers([]); setShowHistorial(false);
        setPhaseTranscripts({
            interview: '',
            reasoning: '',
            exam: '',
            reasoning2: '',
            intervention: '',
            exposition: '',
            commission: ''
        });
        const init: Record<string, { selected: boolean; justificacion: string; pruebas: string }> = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        setExamSelections(init);
    };

    const handleExportPDF = () => {
        if (!caseData || !evaluationData) return;
        const notaFinal = commissionData
            ? ((evaluationData.nota_chilena * 0.7) + (commissionData.nota_chilena_comision * 0.3)).toFixed(1)
            : evaluationData.nota_chilena?.toFixed(1);
        
        const scorecardRows = Object.entries(evaluationData.scorecard).map(([k, val]) => {
            const v = val as { puntaje: number; comentario: string };
            return `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;">${k.replace(/_/g, ' ').toUpperCase()}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;font-size:15px;color:${v.puntaje >= 60 ? '#059669' : '#dc2626'}">${v.puntaje}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;">${v.comentario}</td></tr>`;
        }).join('');
        
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Examen OSCE</title>
        <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        body{font-family:'Inter',sans-serif;max-width:800px;margin:0 auto;padding:40px 30px;color:#1e293b;line-height:1.5;}
        h1{font-size:22px;margin:0;} h2{font-size:16px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:28px;color:#334155;}
        .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;padding-bottom:16px;margin-bottom:24px;}
        .nota-box{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:12px;padding:16px 24px;text-align:center;}
        .nota-big{font-size:36px;font-weight:900;color:#92400e;} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        table{width:100%;border-collapse:collapse;} th{text-align:left;padding:8px 10px;background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;}
        @media print{body{padding:20px;} .no-print{display:none;}}
        .page-break { page-break-before: always; }
        </style></head><body>
        <div class="header"><div><h1>🎓 Reporte de Examen OSCE por Voz</h1><p style="margin:4px 0;font-size:13px;color:#64748b;">Evaluación de Caso Clínico Completo · ${new Date().toLocaleDateString('es-CL')}</p>
        <p style="margin:2px 0;font-size:13px;"><strong>Estudiante:</strong> ${user?.displayName || user?.email || 'N/A'}</p></div>
        <div class="nota-box"><div class="nota-big">${notaFinal}</div><div style="font-size:12px;font-weight:700;color:#92400e;">NOTA CONSOLIDADA</div></div></div>
        
        <h2>📋 Ficha del Paciente</h2>
        <div class="grid2"><div><strong>Paciente:</strong> ${caseData.ficha_visible.nombre}</div><div><strong>Edad:</strong> ${caseData.ficha_visible.edad}</div>
        <div><strong>Ocupación:</strong> ${caseData.ficha_visible.ocupacion}</div><div><strong>Actividad:</strong> ${caseData.ficha_visible.deporte_actividad}</div></div>
        <p><strong>Motivo:</strong> ${caseData.ficha_visible.motivo_consulta}</p>
        
        <h2>📊 Scorecard de Competencias</h2>
        <table><thead><tr><th>Competencia</th><th>Puntaje</th><th>Comentario</th></tr></thead><tbody>${scorecardRows}</tbody></table>
        
        <h2>❌ Errores Críticos Detectados</h2>
        ${evaluationData.errores_criticos.map((e) => `<div style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:8px;margin-bottom:6px;"><strong style="color:#991b1b;">[${e.fase}]</strong> ${e.error}<br/><span style="font-size:12px;color:#64748b;">→ ${e.explicacion_docente}</span></div>`).join('') || '<p>Ninguno detectado.</p>'}
        
        <h2>💎 Perla Docente</h2><p style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;font-size:13px;color:#3730a3;font-style:italic;">${evaluationData.perla_docente}</p>
        
        <div class="page-break"></div>
        <h2>🗣️ Transcripciones Clínicas (Alta Fidelidad)</h2>
        <h3>Entrevista Subjetiva:</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;">${phaseTranscripts.interview || 'No registrada'}</pre>
        <h3>Razonamiento I (Oral):</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;">${phaseTranscripts.reasoning || 'No registrado'}</pre>
        <h3>Examen Físico (Oral):</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;">${phaseTranscripts.exam || 'No registrado'}</pre>
        <h3>Exposición del Caso (Oral):</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;">${phaseTranscripts.exposition || 'No registrada'}</pre>
        <h3>Defensa ante la Comisión (Oral):</h3>
        <pre style="white-space:pre-wrap;font-family:inherit;font-size:12px;background:#f8fafc;padding:10px;border-radius:8px;">${phaseTranscripts.commission || 'No registrada'}</pre>
        
        <div class="no-print" style="text-align:center;margin-top:32px;"><button onclick="window.print()" style="background:#0f172a;color:white;border:none;padding:12px 32px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">📄 Imprimir Reporte</button></div>
        </body></html>`;
        
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const currentIdx = OSCE_PHASES.indexOf(phase);

    const handleVoiceConnect = async () => {
        await startLocalRecording();
        connect();
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* ═══ EXIT WARNING MODAL ═══ */}
            {showExitWarning && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">⚠️</div>
                            <div>
                                <h3 className="font-black text-lg text-slate-900">¿Abandonar Examen OSCE?</h3>
                                <p className="text-sm text-slate-500">Perderás todo tu progreso actual de la simulación.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowExitWarning(false)} className="flex-1 bg-slate-900 text-white font-bold py-3 rounded-xl">Seguir</button>
                            <button onClick={() => { setShowExitWarning(false); handleReset(); }} className="flex-1 bg-red-100 text-red-700 font-bold py-3 rounded-xl">Abandonar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ════════ LOADING TRANSCRIPTION OVERLAY ════════ */}
            {loadingTranscription && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-4 animate-pulse">
                        <div className="mx-auto w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        <h3 className="text-lg font-black text-slate-800">Transcribiendo Audio de Alta Fidelidad</h3>
                        <p className="text-sm text-slate-500">
                            Gemini está procesando la grabación de tu micrófono para corregir términos clínicos de kinesiología y formatear los diálogos con precisión.
                        </p>
                    </div>
                </div>
            )}

            {/* ════════ INTERVIEW COMMUNICATION FEEDBACK MODAL ════════ */}
            {showCommunicationFeedback && interviewFeedbackData && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
                        <div className="flex items-center gap-3 border-b pb-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-2xl">🎓</div>
                            <div>
                                <h3 className="font-black text-xl text-slate-900">Desempeño Comunicacional</h3>
                                <p className="text-sm text-slate-500">Evaluación de Habilidades Blandas en la Entrevista (Dimensión 1)</p>
                            </div>
                            <div className="ml-auto text-right">
                                <div className="text-2xl font-black text-purple-600">
                                    {interviewFeedbackData.comunicacion_avanzada.puntaje}/100
                                </div>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 italic">"{interviewFeedbackData.comunicacion_avanzada.comentario_general_comunicacion}"</p>
                        <div className="space-y-3">
                            {[
                                { key: 'resumenes_reflexivos', label: 'Resúmenes Reflexivos', icon: '🔄', data: interviewFeedbackData.comunicacion_avanzada.resumenes_reflexivos },
                                { key: 'senalizacion_signposting', label: 'Señalización (Signposting)', icon: '🚦', data: interviewFeedbackData.comunicacion_avanzada.senalizacion_signposting },
                                { key: 'efecto_nocebo', label: 'Cero Efecto Nocebo', icon: '🛡️', data: interviewFeedbackData.comunicacion_avanzada.efecto_nocebo },
                                { key: 'empatia_manejo_incertidumbre', label: 'Empatía y Manejo de Incertidumbre', icon: '🤝', data: interviewFeedbackData.comunicacion_avanzada.empatia_manejo_incertidumbre },
                                { key: 'ritmo_embudo', label: 'Ritmo y Embudo', icon: '⏳', data: interviewFeedbackData.comunicacion_avanzada.ritmo_embudo },
                            ].map(item => (
                                <div key={item.key} className={`border rounded-xl p-3 flex gap-3 ${item.data.logrado ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                                    <div className="text-xl">{item.icon}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-sm text-slate-800">{item.label}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.data.logrado ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                                                {item.data.logrado ? 'LOGRADO' : 'FALLIDO'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600">{item.data.feedback}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowCommunicationFeedback(false)} className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl transition-all">
                            Continuar a la Estación de Razonamiento
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-purple-950 flex items-center gap-2">
                        <span>🎓 Simulador de Examen OSCE por Voz</span>
                        <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">DOCENTE TEST</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Simulación completa hablada bajo presión de tiempo real</p>
                </div>
                {phase !== 'SETUP' && (
                    <div className="flex items-center gap-3">
                        <div className={`font-mono px-4 py-2 rounded-xl text-lg font-black shadow border ${timer <= 120 ? 'bg-red-500 text-white border-red-600 animate-pulse' : 'bg-slate-900 text-white border-slate-950'}`}>
                            ⏱️ {formatTime(timer)}
                        </div>
                        <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 font-bold">Salir del Examen</button>
                    </div>
                )}
            </div>

            {/* Progress bar */}
            {phase !== 'SETUP' && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                        <span>Estación {currentIdx + 1} de {OSCE_PHASES.length - 1}</span>
                        <span>{PHASE_LABELS[phase]}</span>
                    </div>
                    <div className="flex gap-1">
                        {OSCE_PHASES.filter(p => p !== 'RESULTS').map((p, i) => (
                            <div key={p} className={`h-2.5 flex-1 rounded-full transition-all ${(i) <= currentIdx ? ((i) === currentIdx ? 'bg-purple-600 scale-y-110' : 'bg-emerald-500') : 'bg-slate-200'}`} title={PHASE_LABELS[p]} />
                        ))}
                    </div>
                </div>
            )}

            {/* Error notifications */}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}

            {/* Loading generic overlay */}
            {loading && (
                <div className="flex items-center justify-center p-12 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-500 text-sm font-medium">Cargando evaluación y parámetros del caso clínico...</p>
                    </div>
                </div>
            )}

            {/* ════════ PHASE: SETUP ════════ */}
            {phase === 'SETUP' && !loading && !showHistorial && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                    <div className="flex justify-between items-center border-b pb-4">
                        <h2 className="text-lg font-bold text-slate-800">Parámetros del Examen OSCE</h2>
                        <button onClick={() => setShowHistorial(true)} className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100 transition-all">
                            📊 Ver Historial de Intentos
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Área Corporal a Interrogar</label>
                            <select value={setupForm.area} onChange={e => setSetupForm(p => ({ ...p, area: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none">
                                <option value="">Aleatoria</option>
                                <option value="hombro">Hombro</option>
                                <option value="rodilla">Rodilla</option>
                                <option value="columna_lumbar">Columna Lumbar</option>
                                <option value="columna_cervical">Columna Cervical</option>
                                <option value="tobillo">Tobillo/Pie</option>
                                <option value="cadera">Cadera</option>
                                <option value="codo_muneca">Codo/Muñeca</option>
                                <option value="deportivo">Caso Deportivo / Gesto Lesional</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Dificultad del Caso</label>
                            <select value={setupForm.dificultad} onChange={e => setSetupForm(p => ({ ...p, dificultad: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none">
                                <option value="basico">Básico (Cuadro agudo, biomecánico simple)</option>
                                <option value="intermedio">Intermedio (Insidioso, carga progresiva)</option>
                                <option value="avanzado">Avanzado (Dolor persistente, nociplástico, BPS marcado)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Personalidad Oculta del Paciente (Estación 1)</label>
                            <select value={setupForm.personalidad} onChange={e => setSetupForm(p => ({ ...p, personalidad: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none">
                                <option value="colaborador">Paciente Colaborador (Estándar)</option>
                                <option value="catastrofista">Paciente Catastrofista (Ansioso, kinesiofobia)</option>
                                <option value="reticente">Paciente Reticente (De pocas palabras, cortante)</option>
                            </select>
                        </div>
                        {audioDevices.length > 1 && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">🎙️ Dispositivo de Micrófono</label>
                                <select value={selectedDeviceId} onChange={e => setSelectedDeviceId(e.target.value)} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none">
                                    <option value="">Predeterminado del sistema</option>
                                    {audioDevices.map(d => (
                                        <option key={d.deviceId} value={d.deviceId}>{d.label || `Micrófono ${d.deviceId.slice(0,8)}`}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Descripción o Patología Específica (Opcional)</label>
                        <textarea value={setupForm.descripcion} onChange={e => setSetupForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Paciente con diagnóstico médico de rotura parcial de tendón patelar hace 3 meses..." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                    </div>
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                        <input 
                            type="checkbox" 
                            id="modoDemo" 
                            checked={setupForm.modoDemo} 
                            onChange={e => setSetupForm(p => ({ ...p, modoDemo: e.target.checked }))} 
                            className="rounded text-purple-600 focus:ring-purple-200"
                        />
                        <label htmlFor="modoDemo" className="font-bold cursor-pointer select-none">
                            ⚡ Activar Modo Demo (Tiempos cortos de 30s por estación para pruebas rápidas)
                        </label>
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50 text-base">
                        🏁 Iniciar Examen OSCE por Voz
                    </button>
                </div>
            )}

            {/* ════════ HISTORIAL ════════ */}
            {phase === 'SETUP' && showHistorial && (
                <SimuladorHistorial onClose={() => setShowHistorial(false)} />
            )}

            {/* ════════ STATIONS VIEW CONTAINER ════════ */}
            {isActiveExam && !loading && caseData && (
                <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex justify-between items-center">
                        <div className="space-y-1">
                            <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                                {PHASE_LABELS[phase]}
                            </span>
                            <h3 className="font-bold text-slate-800 text-sm">
                                {phase === 'INTERVIEW' && "Habla con el paciente simulado para recopilar antecedentes."}
                                {phase === 'REASONING' && "Responde las preguntas de diagnóstico preliminar de la comisión."}
                                {phase === 'EXAM' && "Pídele pruebas al paciente o solicita mediciones técnicas a la comisión."}
                                {phase === 'REASONING2' && "Indica a la comisión cómo cambiaron tus sospechas con las pruebas."}
                                {phase === 'INTERVENTION' && "Guía al paciente en su ejercicio y justifica biomecánicamente la dosis."}
                                {phase === 'CONSTRUCTION' && "Escribe formalmente el diagnóstico CIF y los objetivos del tratamiento."}
                                {phase === 'EXPOSITION' && "Expón verbalmente toda la ficha y plan clínico sin interrupciones."}
                                {phase === 'COMMISSION' && "Defiende verbalmente tu toma de decisiones clínicas ante el tribunal."}
                            </h3>
                        </div>
                    </div>

                    {phase !== 'INTERVIEW' && phase !== 'CONSTRUCTION' && (
                        <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-4 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div><strong className="text-purple-900">Paciente:</strong> {caseData.ficha_visible.nombre} ({caseData.ficha_visible.edad})</div>
                            <div><strong className="text-purple-900">Motivo:</strong> {caseData.ficha_visible.motivo_consulta}</div>
                            <div><strong className="text-purple-900">Derivación:</strong> {caseData.ficha_visible.derivacion}</div>
                            <div><strong className="text-purple-900">Evolución:</strong> {caseData.ficha_visible.tiempo_evolucion}</div>
                        </div>
                    )}

                    {/* 🎙️ VOICE PANEL */}
                    {phase !== 'CONSTRUCTION' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        {connectionState === 'connected' && (
                                            <>
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                            </>
                                        )}
                                        {connectionState === 'connecting' && <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 animate-pulse"></span>}
                                        {connectionState === 'disconnected' && <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300"></span>}
                                    </span>
                                    <span>Canal de Voz en Vivo</span>
                                </h3>
                                <div className="text-xs font-semibold text-slate-400">
                                    {connectionState === 'connected' ? 'Transmisión cifrada de audio activa' : 'Conexión de audio inactiva'}
                                </div>
                            </div>

                            {connectionState === 'disconnected' && (
                                <button onClick={handleVoiceConnect} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-xl text-lg transition-all shadow-md">
                                    🎙️ Iniciar Conexión de Voz con la Estación
                                </button>
                            )}

                            {connectionState === 'connecting' && (
                                <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 font-bold py-4 rounded-xl text-center flex items-center justify-center gap-2">
                                    <div className="w-5 h-5 border-2 border-amber-800 border-t-transparent rounded-full animate-spin"></div>
                                    Conectando micrófono y cargando perfil del evaluador/paciente...
                                </div>
                            )}

                            {connectionState === 'connected' && (
                                <div className="space-y-6">
                                    <div className="flex flex-col items-center justify-center p-6 bg-slate-900 rounded-2xl border border-slate-950 relative overflow-hidden h-32">
                                        <div className="flex items-center gap-1.5 justify-center h-16 w-full">
                                            {[...Array(15)].map((_, i) => {
                                                const factor = 1 - Math.abs(i - 7) / 8;
                                                const height = Math.max(8, Math.min(100, volume * 350 * factor));
                                                return (
                                                    <div 
                                                        key={i} 
                                                        className={`w-2.5 rounded-full transition-all duration-75 ${isSpeaking ? 'bg-indigo-400' : 'bg-emerald-400'}`}
                                                        style={{ height: `${height}%` }}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <p className="mt-4 text-xs font-mono tracking-wider uppercase text-slate-400">
                                            {isSpeaking ? 'El evaluador/paciente está hablando...' : 'Micrófono abierto · Escuchando...'}
                                        </p>
                                    </div>

                                    <div className="flex gap-4">
                                        <button onClick={toggleMic} className={`flex-1 font-bold py-3.5 rounded-xl transition-all border text-sm ${isMicOpen ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'}`}>
                                            {isMicOpen ? '🔇 Mute Micrófono' : '🔊 Activar Micrófono'}
                                        </button>
                                        <button 
                                            onClick={() => {
                                                if (phase === 'INTERVIEW') handleEndVoiceInterview();
                                                else if (phase === 'REASONING') handleEndReasoningVoice();
                                                else if (phase === 'EXAM') handleEndExamVoice();
                                                else if (phase === 'REASONING2') handleEndReasoning2Voice();
                                                else if (phase === 'INTERVENTION') handleEndInterventionVoice();
                                                else if (phase === 'EXPOSITION') handleEndExpositionVoice();
                                                else if (phase === 'COMMISSION') handleEndCommissionVoice();
                                            }}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl transition-all shadow text-sm"
                                        >
                                            Finalizar Estación y Transcribir →
                                        </button>
                                    </div>
                                </div>
                            )}

                            {transcript.length > 0 && (
                                <details className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                                    <summary className="cursor-pointer font-bold text-slate-500">Ver registro técnico de WebSocket en tiempo real</summary>
                                    <div className="mt-2 space-y-1 font-mono max-h-32 overflow-y-auto">
                                        {transcript.map((t, idx) => (
                                            <div key={idx} className={t.role === 'user' ? 'text-blue-600' : 'text-slate-600'}>
                                                <strong>{t.role === 'user' ? 'USER:' : 'LIVE:'}</strong> {t.text}
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    )}

                    {phase === 'REASONING' && interviewData && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-4">
                            <h4 className="font-bold text-amber-800">💡 Resumen de la Ficha Clínica obtenida:</h4>
                            <p className="text-xs text-slate-700 whitespace-pre-wrap bg-white p-3 rounded-lg border border-amber-100">{interviewData.respuestas_paciente}</p>
                        </div>
                    )}

                    {phase === 'REASONING2' && examData && (
                        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5 space-y-3">
                            <h4 className="font-bold text-teal-800 text-sm">📊 Hallazgos revelados en el Examen Físico:</h4>
                            {Object.entries(examData.hallazgos_revelados).map(([k, v]) => (
                                <div key={k} className="text-xs text-slate-700">
                                    <strong>{k}:</strong> {v as string}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* STATION 6: CONSTRUCTION WRITTEN FORM */}
                    {phase === 'CONSTRUCTION' && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                            <div className="border-b pb-3">
                                <h3 className="font-bold text-slate-800 text-lg">Ficha Kinesiológica Formal</h3>
                                <p className="text-xs text-slate-500">Ingresa de forma estructurada el diagnóstico funcional y el plan de tratamiento.</p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Diagnóstico Kinesiológico (Modelo CIF)</label>
                                    <textarea value={construction.diagnostico} onChange={e => setConstruction(c => ({ ...c, diagnostico: e.target.value }))} placeholder="Paciente masculino/femenino de X años... presenta alteraciones en [estructura] limitando su actividad en [función] y restringiendo su participación en [roles]..." rows={4} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Objetivo General</label>
                                    <textarea value={construction.objetivo_general} onChange={e => setConstruction(c => ({ ...c, objetivo_general: e.target.value }))} placeholder="Ej: Restaurar la funcionalidad de la rodilla..." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Objetivos Específicos (OE)</label>
                                    <textarea value={construction.objetivos_especificos} onChange={e => setConstruction(c => ({ ...c, objetivos_especificos: e.target.value }))} placeholder="1. Disminuir dolor... 2. Flexibilizar..." rows={3} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Objetivos Operacionales (OO) · Clínicamente Medibles</label>
                                    <textarea value={construction.objetivos_operacionales} onChange={e => setConstruction(c => ({ ...c, objetivos_operacionales: e.target.value }))} placeholder="OO1.1: Reducir dolor a EVA 2/10 en 3 semanas..." rows={3} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Plan de Rehabilitación por Fases (Progresión de Carga)</label>
                                    <textarea value={construction.plan_fases} onChange={e => setConstruction(c => ({ ...c, plan_fases: e.target.value }))} placeholder="Fase 1 (Protección): ... Fase 2 (Fortalecimiento): ..." rows={4} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">Reevaluación y Criterios de Alta</label>
                                    <textarea value={construction.reevaluacion} onChange={e => setConstruction(c => ({ ...c, reevaluacion: e.target.value }))} placeholder="Signo comparable: ... Pronóstico: ..." rows={3} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none" />
                                </div>
                            </div>

                            <button onClick={handleConstructionSubmit} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                Registrar Ficha y Pasar a la Estación de Exposición →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* RESULTS VIEW */}
            {phase === 'RESULTS' && !loading && evaluationData && (
                <div className="space-y-6 animate-in fade-in zoom-in duration-200">
                    <div className="bg-gradient-to-br from-purple-900 to-indigo-900 rounded-3xl p-8 text-white shadow-xl space-y-6 relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                        
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/20 pb-6 gap-4">
                            <div>
                                <span className="bg-white/20 text-white font-bold text-xs uppercase tracking-wide px-3 py-1 rounded-full">Examen Finalizado</span>
                                <h2 className="text-2xl font-black mt-2">Reporte de Evaluación OSCE</h2>
                                <p className="text-white/70 text-xs mt-1">Tiempo de rotación de estaciones completado</p>
                            </div>
                            
                            <div className="flex gap-4">
                                <div className="bg-white/10 rounded-2xl px-5 py-3 text-center border border-white/10">
                                    <div className="text-3xl font-black">{evaluationData.puntaje_global}/100</div>
                                    <div className="text-[10px] text-white/75 mt-1 font-bold">Puntaje Global</div>
                                </div>
                                <div className="bg-amber-400 text-slate-900 rounded-2xl px-5 py-3 text-center border border-amber-300 font-bold shadow-md">
                                    <div className="text-3xl font-black">
                                        {commissionData ? ((evaluationData.nota_chilena * 0.7) + (commissionData.nota_chilena_comision * 0.3)).toFixed(1) : evaluationData.nota_chilena.toFixed(1)}
                                    </div>
                                    <div className="text-[10px] mt-1 uppercase tracking-wider">Nota Final</div>
                                </div>
                            </div>
                        </div>

                        <div className="text-sm leading-relaxed text-white/90">
                            <strong>Nivel Alcanzado:</strong> {evaluationData.nivel}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                        <h3 className="font-bold text-slate-800 border-b pb-3">📈 Desglose por Competencias Clínicas</h3>
                        <div className="space-y-4">
                            {Object.entries(evaluationData.scorecard).map(([key, val]) => (
                                <div key={key} className="space-y-1">
                                    <div className="flex justify-between text-xs font-bold text-slate-700">
                                        <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                        <span>{val.puntaje}/100</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${val.puntaje >= 80 ? 'bg-emerald-500' : val.puntaje >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${val.puntaje}%` }} />
                                    </div>
                                    <p className="text-[11px] text-slate-500 leading-relaxed italic">"{val.comentario}"</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {evaluationData.errores_criticos.length > 0 && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 space-y-3">
                                <h4 className="font-bold text-red-800 text-sm">❌ Errores Críticos (Penalizaciones)</h4>
                                <div className="space-y-2">
                                    {evaluationData.errores_criticos.map((e, i) => (
                                        <div key={i} className="text-xs text-red-700 border-b border-red-200/50 pb-2 last:border-0">
                                            <strong>[{e.fase}]</strong> {e.error}
                                            <p className="text-slate-600 mt-1">{e.explicacion_docente}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {evaluationData.aciertos_destacados.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                                <h4 className="font-bold text-emerald-800 text-sm">✅ Aciertos Clínicos Destacados</h4>
                                <div className="space-y-2">
                                    {evaluationData.aciertos_destacados.map((a, i) => (
                                        <div key={i} className="text-xs text-emerald-700 border-b border-emerald-200/50 pb-2 last:border-0">
                                            <strong>[{a.fase}]</strong> {a.acierto}
                                            <p className="text-slate-600 mt-1">{a.por_que_importa}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 space-y-2">
                        <h4 className="font-bold text-indigo-800 text-sm">💎 Perla Docente (Conclusión Clínica)</h4>
                        <p className="text-xs text-slate-700 leading-relaxed italic">"{evaluationData.perla_docente}"</p>
                    </div>

                    <div className="flex gap-4 border-t pt-5">
                        <button onClick={handleExportPDF} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow text-sm">
                            📄 Exportar Reporte PDF Completo
                        </button>
                        <button onClick={handleReset} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3.5 rounded-xl transition-all shadow text-sm">
                            🎲 Practicar Nuevo Caso
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
