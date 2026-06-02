"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { generateDynamicPatientPrompt, getVoiceForPersona } from '@/utils/patientPrompts';
import type { SimCaseType, SimInterviewType, SimExamType, SimEvaluationType, SimCommissionType } from '@/lib/ai/simuladorSchemas';
import { guardarIntento, getTareaConfig, verificarCumplimiento } from '@/services/simuladorFirebase';
import { SimuladorHistorial } from './SimuladorHistorial';

// ─── Types ───
type SimPhase = 'SETUP' | 'INTERVIEW' | 'REASONING' | 'EXAM' | 'REASONING2' | 'INTERVENTION' | 'CONSTRUCTION' | 'REVIEW' | 'COMMISSION' | 'RESULTS';
type PracticeMode = 'completo' | 'entrevista' | 'examen' | 'intervencion' | 'escritura' | 'comision';

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
    INTERVIEW: 'Entrevista Clínica',
    REASONING: 'Razonamiento I',
    EXAM: 'Examen Físico',
    REASONING2: 'Razonamiento II',
    INTERVENTION: 'Intervención al Paciente',
    CONSTRUCTION: 'Escritura Clínica',
    REVIEW: 'Evaluación',
    COMMISSION: 'Comisión',
    RESULTS: 'Resultados',
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

// ─── Practice mode phase mapping ───
const PRACTICE_PHASES: Record<PracticeMode, SimPhase[]> = {
    completo: ['INTERVIEW', 'REASONING', 'EXAM', 'REASONING2', 'INTERVENTION', 'CONSTRUCTION', 'REVIEW', 'COMMISSION', 'RESULTS'],
    entrevista: ['INTERVIEW', 'REASONING', 'RESULTS'],
    examen: ['EXAM', 'REASONING2', 'RESULTS'],
    intervencion: ['INTERVENTION', 'CONSTRUCTION', 'RESULTS'],
    escritura: ['CONSTRUCTION', 'REVIEW', 'RESULTS'],
    comision: ['REVIEW', 'COMMISSION', 'RESULTS'],
};

// ─── Main Component ───
export function SimuladorExamenVoz() {
    const { user } = useAuth();
    const [phase, setPhase] = useState<SimPhase>('SETUP');
    const [reviewPhase, setReviewPhase] = useState<SimPhase | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const [showExitWarning, setShowExitWarning] = useState(false);
    const [showHistorial, setShowHistorial] = useState(false);

    // Task compliance
    const [tareaAlerta, setTareaAlerta] = useState<{ descripcion: string; mensaje: string; creditos: number; frecuencia: number } | null>(null);

    // AI Data
    const [caseData, setCaseData] = useState<SimCaseType | null>(null);
    const [interviewData, setInterviewData] = useState<SimInterviewType | null>(null);
    const [examData, setExamData] = useState<SimExamType | null>(null);
    const [evaluationData, setEvaluationData] = useState<SimEvaluationType | null>(null);
    const [commissionData, setCommissionData] = useState<SimCommissionType | null>(null);
    const [showInterviewAnalysis, setShowInterviewAnalysis] = useState(false);

    // Student Work
    const [setupForm, setSetupForm] = useState({ tipo: 'aleatorio', area: '', dificultad: 'intermedio', descripcion: '' });
    const [studentQuestions, setStudentQuestions] = useState('');
    const [reasoning, setReasoning] = useState({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
    const [examSelections, setExamSelections] = useState<Record<string, { selected: boolean; justificacion: string; pruebas: string }>>(() => {
        const init: Record<string, { selected: boolean; justificacion: string; pruebas: string }> = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        return init;
    });
    const [construction, setConstruction] = useState({ diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
    const [commissionAnswers, setCommissionAnswers] = useState<string[]>([]);
    // Razonamiento 2: Post-examen físico (integración de hallazgos)
    const [reasoning2, setReasoning2] = useState({ hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
    // Intervenciones al paciente (fase nueva)
    const [interventions, setInterventions] = useState([{ tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }]);
    // Practice mode
    const [practiceMode, setPracticeMode] = useState<PracticeMode>('completo');

    // ─── Practice mode helper: get next valid phase ───
    const getNextPhase = useCallback((currentPhase: SimPhase): SimPhase | null => {
        const allowed = PRACTICE_PHASES[practiceMode];
        const currentIdx = allowed.indexOf(currentPhase);
        if (currentIdx === -1 || currentIdx >= allowed.length - 1) return null;
        return allowed[currentIdx + 1];
    }, [practiceMode]);

    const getFirstPhase = useCallback((): SimPhase => {
        return PRACTICE_PHASES[practiceMode][0];
    }, [practiceMode]);

    const { connect, disconnect, connectionState, transcript, isSpeaking, volume, isMicOpen, toggleMic } = useGeminiLive({
        systemInstruction: caseData ? generateDynamicPatientPrompt(setupForm.area, setupForm.dificultad, '', caseData.ficha_visible) : '',
        voiceName: caseData ? getVoiceForPersona(caseData.ficha_visible.sexo || 'Mujer') : 'Aoede'
    });

    const formattedTranscript = transcript.map(t => `${t.role === 'user' ? 'Kinesiólogo' : 'Paciente'}: ${t.text}`).join('\n');

    // Timer
    const startTimer = useCallback((reset = true) => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (reset) setTimer(0);
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    }, []);
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const handleEndVoiceInterview = useCallback(async () => {
        if (!user || !caseData) return;
        disconnect();
        
        const finalTranscriptText = formattedTranscript || '(Sin interacción de voz)';
        setStudentQuestions(finalTranscriptText); // Guardamos la transcripción entera como las preguntas del alumno para el backend

        setLoading(true); setError('');
        try {
            // Mandamos el transcript al backend para que analice la entrevista
            const data = await simFetch('interview', {
                perfil_secreto: caseData.perfil_secreto,
                ficha_visible: caseData.ficha_visible,
                preguntas_estudiante: finalTranscriptText,
            }, user.uid);
            
            // Sobreescribimos la respuesta del paciente del backend con la transcripción real que ocurrió por voz
            data.respuestas_paciente = finalTranscriptText;
            setInterviewData(data);

            const next = getNextPhase('INTERVIEW');
            if (next) setPhase(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    }, [user, caseData, disconnect, formattedTranscript, getNextPhase]);

    useEffect(() => {
        if (phase === 'INTERVIEW' && timer >= 600 && connectionState === 'connected') {
            handleEndVoiceInterview();
        }
    }, [timer, phase, connectionState, handleEndVoiceInterview]);

    const persistAttempt = async (evalData = evaluationData, commData = commissionData) => {
        if (!user) return;
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.removeItem(STORAGE_KEY);
        try {
            await guardarIntento({
                userId: user.uid,
                userEmail: user.email || '',
                userName: user.displayName || user.email || 'Anónimo',
                area: setupForm.area || 'aleatoria',
                dificultad: setupForm.dificultad || 'intermedio',
                practiceMode,
                pacienteNombre: caseData?.ficha_visible?.nombre || '',
                motivoConsulta: caseData?.ficha_visible?.motivo_consulta || '',
                puntajeGlobal: evalData?.puntaje_global ?? 0,
                notaChilena: evalData?.nota_chilena ?? 0,
                nivel: evalData?.nivel ?? '—',
                puntajeComision: commData?.puntaje_comision_global ?? 0,
                notaComision: commData?.nota_chilena_comision ?? 0,
                scorecard: (evalData?.scorecard || {}) as Record<string, { puntaje: number; comentario: string }>,
                tiempoSegundos: timer,
                // Extra fields for rich export
                erroresCriticos: evalData?.errores_criticos || [],
                aciertosDestacados: evalData?.aciertos_destacados || [],
                areasMejora: evalData?.areas_mejora || [],
                perlaDocente: evalData?.perla_docente || '',
                commissionAnswers: commissionAnswers || [],
                preguntasComision: evalData?.preguntas_comision || [],
                // 100% complete session log
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
                    preguntasComision: evalData?.preguntas_comision || [],
                }
            });
        } catch (fbErr) {
            console.error('[Simulador] Error guardando en Firebase:', fbErr);
        }
    };

    // ═══ PROTECCIÓN ANTI-SALIDA (beforeunload + popstate + history sentinel) ═══
    const isActiveExam = phase !== 'SETUP' && phase !== 'RESULTS';
    const isReview = phase === 'RESULTS' && reviewPhase !== null;

    // ═══ localStorage AUTOSAVE ═══
    const STORAGE_KEY = 'simulador_autosave';
    useEffect(() => {
        if (phase === 'SETUP' || phase === 'RESULTS') return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                phase, timer, caseData, interviewData, examData, evaluationData, commissionData,
                studentQuestions, reasoning, reasoning2, interventions, construction,
                examSelections, commissionAnswers, practiceMode, showInterviewAnalysis,
                savedAt: Date.now(),
            }));
        } catch {}
    }, [phase, studentQuestions, reasoning, reasoning2, interventions, construction, examSelections, commissionAnswers, timer, caseData, commissionData, evaluationData, examData, interviewData, practiceMode, showInterviewAnalysis]);

    // Auto-restore on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (!saved) return;
            const data = JSON.parse(saved);
            if (Date.now() - data.savedAt > 4 * 60 * 60 * 1000) { localStorage.removeItem(STORAGE_KEY); return; } // Expire after 4h
            if (data.phase && data.caseData) {
                setCaseData(data.caseData);
                setInterviewData(data.interviewData || null);
                setExamData(data.examData || null);
                setEvaluationData(data.evaluationData || null);
                setCommissionData(data.commissionData || null);
                setStudentQuestions(data.studentQuestions || '');
                setReasoning(data.reasoning || { hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
                setReasoning2(data.reasoning2 || { hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
                setInterventions(data.interventions || [{ tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }]);
                setConstruction(data.construction || { diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
                if (data.examSelections) setExamSelections(data.examSelections);
                setCommissionAnswers(data.commissionAnswers || []);
                setPracticeMode(data.practiceMode || 'completo');
                setShowInterviewAnalysis(data.showInterviewAnalysis || false);
                setTimer(data.timer || 0);
                setPhase(data.phase);
                startTimer(false);
            }
        } catch {}
    }, [startTimer]);

    // Check task compliance on mount
    useEffect(() => {
        if (!user?.uid) return;
        getTareaConfig().then(async (cfg) => {
            if (!cfg || !cfg.activa) { setTareaAlerta(null); return; }
            const resultado = await verificarCumplimiento(user.uid, cfg);
            if (!resultado.cumple) {
                setTareaAlerta({
                    descripcion: resultado.descripcion,
                    mensaje: cfg.mensaje || `Debes completar al menos 1 simulación cada ${cfg.frecuenciaDias} días.`,
                    creditos: resultado.creditosExtraAcumulados,
                    frecuencia: cfg.frecuenciaDias,
                });
            } else {
                setTareaAlerta(null);
            }
        }).catch(console.error);
    }, [user?.uid]);
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (phase !== 'SETUP' && phase !== 'RESULTS') {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [phase]);

    // 2) popstate + history.pushState: protects against browser back button / iPad swipe-back
    useEffect(() => {
        if (!isActiveExam) return;

        // Push a sentinel state so pressing "back" lands on it instead of leaving
        // We do this every time phase changes to keep the sentinel fresh
        window.history.pushState({ simGuard: true }, '');

        const handlePopState = () => {
            if (isActiveExam) {
                // The user pressed back — re-push the sentinel and show warning
                window.history.pushState({ simGuard: true }, '');
                setShowExitWarning(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isActiveExam, phase]); // Re-run on phase change to refresh sentinel

    // (getNextPhase and getFirstPhase helpers are declared above)

    // ─── Phase Handlers ───
    const handleGenerate = async () => {
        if (!user) return;
        setLoading(true); setError('');
        try {
            const data = await simFetch('generate', setupForm, user.uid);
            setCaseData(data);
            
            const firstPhase = getFirstPhase();
            
            // Si el modo inicia directo en REVIEW o COMMISSION (ej: Solo Comisión),
            // auto-generamos la evaluación (vacía) para obtener las preguntas de la comisión
            if (firstPhase === 'REVIEW' || firstPhase === 'COMMISSION') {
                const evalData = await simFetch('evaluate', {
                    caso_resumen: { ficha: data.ficha_visible, hallazgos: data.hallazgos_todos_modulos },
                    rubrica_ideal: data.rubrica_ideal,
                    trabajo_estudiante: {}, // Trabajo vacío
                }, user.uid);
                setEvaluationData(evalData);
                setCommissionAnswers(new Array(evalData.preguntas_comision?.length || 0).fill(''));
            }
            
            setPhase(firstPhase);
            startTimer(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleReasoningSubmit = () => {
        setShowInterviewAnalysis(true);
    };
    const handleReasoningContinue = () => {
        const next = getNextPhase('REASONING');
        if (next) {
            setPhase(next);
            if (next === 'RESULTS') {
                persistAttempt();
            }
        }
    };

    const handleExamSubmit = async () => {
        if (!user || !caseData) return;
        const selected = EXAM_MODULES.filter(m => examSelections[m.key].selected);
        if (selected.length === 0) { setError('Selecciona al menos un módulo de examen.'); return; }
        setLoading(true); setError('');
        try {
            const data = await simFetch('exam', {
                hallazgos_todos_modulos: caseData.hallazgos_todos_modulos,
                rubrica_ideal: caseData.rubrica_ideal,
                modulos_seleccionados: selected.map(m => ({
                    modulo: m.label,
                    justificacion: examSelections[m.key].justificacion,
                    pruebas: examSelections[m.key].pruebas,
                })),
            }, user.uid);
            setExamData(data);
            const next = getNextPhase('EXAM');
            if (next) setPhase(next);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleEvaluate = async () => {
        if (!user || !caseData) return;
        if (!construction.diagnostico.trim()) { setError('Completa al menos el diagnóstico.'); return; }
        setLoading(true); setError('');
        try {
            const modulosTexto = EXAM_MODULES.filter(m => examSelections[m.key].selected)
                .map(m => `${m.label}: ${examSelections[m.key].justificacion}`).join('\n');
            const data = await simFetch('evaluate', {
                caso_resumen: { ficha: caseData.ficha_visible, hallazgos: caseData.hallazgos_todos_modulos },
                rubrica_ideal: caseData.rubrica_ideal,
                trabajo_estudiante: {
                    preguntas_entrevista: studentQuestions,
                    hipotesis_previas: reasoning.hipotesis.filter(h => h.trim()),
                    clasificacion_dolor_previa: reasoning.clasificacion_dolor,
                    irritabilidad_previa: reasoning.irritabilidad,
                    banderas: { rojas: reasoning.banderas_rojas, bps: reasoning.factores_bps },
                    // Razonamiento post-examen
                    hipotesis_confirmadas: reasoning2.hipotesis_confirmadas,
                    clasificacion_dolor_final: reasoning2.clasificacion_actualizada,
                    diagnostico_presuntivo: reasoning2.diagnostico_presuntivo,
                    hallazgos_clave_integrados: reasoning2.hallazgos_clave,
                    // Construcción
                    modulos_seleccionados: modulosTexto,
                    intervenciones: interventions.filter(i => i.tecnica.trim()).map((int, idx) =>
                        `Intervención ${idx + 1}: ${int.tecnica}\n  Objetivo: ${int.objetivo_tecnica}\n  Dosis: ${int.dosis}\n  Posición terapeuta: ${int.posicion_terapeuta}\n  Posición paciente: ${int.posicion_paciente}\n  Instrucciones al paciente: ${int.instrucciones_paciente}`
                    ).join('\n\n') || '(No completó)',
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
            const next = getNextPhase('CONSTRUCTION');
            if (next) {
                setPhase(next);
                if (next === 'RESULTS') {
                    persistAttempt(data);
                }
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
    };

    const handleCommission = async () => {
        if (!user || !evaluationData) return;
        const anyEmpty = commissionAnswers.some(a => !a.trim());
        if (anyEmpty) { setError('Responde todas las preguntas antes de enviar.'); return; }
        setLoading(true); setError('');
        try {
            const data = await simFetch('commission', {
                preguntas_con_respuesta_ideal: evaluationData.preguntas_comision,
                respuestas_estudiante: commissionAnswers,
            }, user.uid);
            setCommissionData(data);
            await persistAttempt(evaluationData, data);
            setPhase('RESULTS');
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Error desconocido');
        } finally {
            setLoading(false);
        }
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
        const erroresHTML = evaluationData.errores_criticos.map((e) =>
            `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:6px;"><strong style="color:#991b1b;">[${e.fase}]</strong> ${e.error}<br/><span style="font-size:12px;color:#64748b;">→ ${e.explicacion_docente}</span></div>`
        ).join('');
        const aciertosHTML = evaluationData.aciertos_destacados.map((a) =>
            `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;margin-bottom:6px;"><strong style="color:#166534;">[${a.fase}]</strong> ${a.acierto}<br/><span style="font-size:12px;color:#64748b;">→ ${a.por_que_importa}</span></div>`
        ).join('');
        const comisionHTML = commissionData ? evaluationData.preguntas_comision.map((q, i) => {
            const ev = commissionData.evaluacion_respuestas?.[i];
            return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;">
                <p style="font-weight:700;color:#1e293b;margin:0 0 4px;">P${i+1}: ${q.pregunta}</p>
                <p style="font-size:13px;color:#334155;margin:0 0 4px;">Mi respuesta: ${commissionAnswers[i] || '—'}</p>
                ${ev ? `<p style="font-size:12px;margin:2px 0;"><span style="color:${ev.puntaje >= 60 ? '#059669' : '#dc2626'};font-weight:800;">${ev.puntaje}/100</span> — ${ev.comentario}</p>` : ''}
            </div>`;
        }).join('') : '';
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Simulador</title>
        <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
        body{font-family:'Inter',sans-serif;max-width:800px;margin:0 auto;padding:40px 30px;color:#1e293b;line-height:1.5;}
        h1{font-size:22px;margin:0;} h2{font-size:16px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:28px;color:#334155;}
        .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;padding-bottom:16px;margin-bottom:24px;}
        .nota-box{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:12px;padding:16px 24px;text-align:center;}
        .nota-big{font-size:36px;font-weight:900;color:#92400e;} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        table{width:100%;border-collapse:collapse;} th{text-align:left;padding:8px 10px;background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;}
        @media print{body{padding:20px;} .no-print{display:none;}}
        </style></head><body>
        <div class="header"><div><h1>🎓 Simulador de Examen Clínico</h1><p style="margin:4px 0;font-size:13px;color:#64748b;">Reporte de Evaluación · ${new Date().toLocaleDateString('es-CL')}</p>
        <p style="margin:2px 0;font-size:13px;"><strong>Estudiante:</strong> ${user?.displayName || user?.email || 'N/A'} · <strong>Tiempo:</strong> ${formatTime(timer)}</p></div>
        <div class="nota-box"><div class="nota-big">${notaFinal}</div><div style="font-size:12px;font-weight:700;color:#92400e;">NOTA FINAL</div></div></div>
        <h2>📋 Caso Clínico</h2>
        <div class="grid2"><div><strong>Paciente:</strong> ${caseData.ficha_visible.nombre}</div><div><strong>Edad:</strong> ${caseData.ficha_visible.edad}</div>
        <div><strong>Ocupación:</strong> ${caseData.ficha_visible.ocupacion}</div><div><strong>Actividad:</strong> ${caseData.ficha_visible.deporte_actividad}</div></div>
        <p><strong>Motivo:</strong> ${caseData.ficha_visible.motivo_consulta}</p>
        <h2>📊 Scorecard por Competencia</h2>
        <table><thead><tr><th>Competencia</th><th>Puntaje</th><th>Comentario</th></tr></thead><tbody>${scorecardRows}</tbody></table>
        <div class="grid2" style="margin-top:16px;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#1e293b;">${evaluationData.puntaje_global}/100</div><div style="font-size:11px;color:#64748b;">Evaluación (70%)</div></div>
        ${commissionData ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;"><div style="font-size:24px;font-weight:900;color:#1e293b;">${commissionData.puntaje_comision_global}/100</div><div style="font-size:11px;color:#64748b;">Comisión (30%)</div></div>` : ''}
        </div>
        <h2>❌ Errores Críticos</h2>${erroresHTML || '<p style="color:#94a3b8;font-size:13px;">Ninguno detectado.</p>'}
        <h2>✅ Aciertos Destacados</h2>${aciertosHTML || '<p style="color:#94a3b8;font-size:13px;">—</p>'}
        ${evaluationData.areas_mejora?.length ? `<h2>📈 Áreas de Mejora</h2><ul>${evaluationData.areas_mejora.map((a: string) => `<li style="font-size:13px;margin-bottom:4px;">${a}</li>`).join('')}</ul>` : ''}
        <h2>💎 Perla Docente</h2><p style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;font-size:13px;color:#3730a3;font-style:italic;">${evaluationData.perla_docente}</p>
        ${commissionData ? `<h2>🎤 Defensa de Comisión</h2>${comisionHTML}<div style="background:#f8fafc;border-radius:10px;padding:14px;margin-top:8px;"><p style="font-size:13px;font-style:italic;color:#475569;">${commissionData.feedback_final}</p></div>` : ''}
        <div class="no-print" style="text-align:center;margin-top:32px;"><button onclick="window.print()" style="background:#0f172a;color:white;border:none;padding:12px 32px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">📄 Guardar como PDF</button></div>
        </body></html>`;
        const w = window.open('', '_blank');
        if (w) { w.document.write(html); w.document.close(); }
    };

    const handleReset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.removeItem(STORAGE_KEY);
        setPhase('SETUP'); setCaseData(null); setInterviewData(null); setExamData(null);
        setEvaluationData(null); setCommissionData(null); setShowInterviewAnalysis(false);
        setStudentQuestions(''); setTimer(0); setError('');
        setReasoning({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', factores_bps: '' });
        setReasoning2({ hipotesis_confirmadas: '', clasificacion_actualizada: '', diagnostico_presuntivo: '', hallazgos_clave: '' });
        setConstruction({ diagnostico: '', objetivo_general: '', objetivos_especificos: '', objetivos_operacionales: '', plan_fases: '', reevaluacion: '' });
        setInterventions([{ tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }]);
        setCommissionAnswers([]); setReviewPhase(null); setPracticeMode('completo'); setShowHistorial(false);
        const init: Record<string, { selected: boolean; justificacion: string; pruebas: string }> = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        setExamSelections(init);
    };

    // Progress bar - only show phases in current practice mode
    const activePhases = ['SETUP' as SimPhase, ...PRACTICE_PHASES[practiceMode]];
    const currentIdx = activePhases.indexOf(phase);

    // ─── RENDER ───
    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* ═══ EXIT WARNING MODAL ═══ */}
            {showExitWarning && (
                <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">⚠️</div>
                            <div>
                                <h3 className="font-black text-lg text-slate-900">¿Abandonar el examen?</h3>
                                <p className="text-sm text-slate-500">Perderás todo tu progreso actual.</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600">Llevas <strong>{formatTime(timer)}</strong> en este intento y estás en la fase <strong>{PHASE_LABELS[phase]}</strong>. Si sales, tendrás que empezar de cero.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowExitWarning(false)}
                                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all"
                            >
                                Seguir con el examen
                            </button>
                            <button
                                onClick={() => { setShowExitWarning(false); handleReset(); }}
                                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold py-3 rounded-xl transition-all"
                            >
                                Abandonar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900">🎓 Simulador de Examen Clínico</h1>
                    <p className="text-gray-500 text-sm mt-1">Practica tu examen final de Kinesiología MSK/Deportiva</p>
                </div>
                {phase !== 'SETUP' && (
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-900 text-white font-mono px-4 py-2 rounded-xl text-lg shadow">{formatTime(timer)}</div>
                        <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 font-bold">Reiniciar</button>
                    </div>
                )}
            </div>

            {/* Progress */}
            {phase !== 'SETUP' && (
                <div className="flex gap-1">
                    {activePhases.filter(p => p !== 'SETUP').map((p, i) => (
                        <div key={p} className={`h-2 flex-1 rounded-full transition-all ${(i + 1) <= currentIdx ? ((i + 1) === currentIdx ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} title={PHASE_LABELS[p]} />
                    ))}
                </div>
            )}

            {/* Error */}
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">{error}</div>}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
                        <p className="text-slate-500 font-medium text-sm animate-pulse">Procesando con IA...</p>
                    </div>
                </div>
            )}

            {/* ════════ TASK ALERT ════════ */}
            {phase === 'SETUP' && tareaAlerta && (
                <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 space-y-2">
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">🚨</div>
                        <div className="flex-1">
                            <h3 className="font-black text-red-800 text-sm">TAREA PENDIENTE</h3>
                            <p className="text-sm text-red-700 mt-0.5">{tareaAlerta.mensaje}</p>
                            <p className="text-xs text-red-500 mt-1">{tareaAlerta.descripcion}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 pl-9">
                        <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                            Requerimiento: 1 cada {tareaAlerta.frecuencia} días
                        </span>
                        {tareaAlerta.creditos > 0 && (
                            <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">
                                {tareaAlerta.creditos} crédito(s) acumulados
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* ════════ PHASE: SETUP ════════ */}
            {phase === 'SETUP' && !loading && !showHistorial && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">Configura tu caso clínico</h2>
                        <button onClick={() => setShowHistorial(true)} className="text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 hover:border-amber-300 transition-all">
                            📊 Mi Historial
                        </button>
                    </div>
                    {/* Practice Mode Selector */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-2">Modo de práctica</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {([
                                { key: 'completo', label: '🎓 Examen Completo', desc: 'Todas las fases (5 llamadas IA)' },
                                { key: 'entrevista', label: '🗣️ Solo Entrevista', desc: 'Entrevista + Razonamiento I (2 llamadas)' },
                                { key: 'examen', label: '🔬 Solo Examen Físico', desc: 'Examen + Razonamiento II (2 llamadas)' },
                                { key: 'intervencion', label: '💊 Solo Intervención', desc: 'Intervención + Escritura (1 llamada)' },
                                { key: 'escritura', label: '📝 Solo Escritura', desc: 'Diagnóstico, Objetivos, Plan (1 llamada)' },
                                { key: 'comision', label: '🎤 Solo Comisión', desc: 'Defensa oral (2 llamadas)' },
                            ] as { key: PracticeMode; label: string; desc: string }[]).map(mode => (
                                <button key={mode.key} onClick={() => setPracticeMode(mode.key)}
                                    className={`text-left p-3 rounded-xl border-2 transition-all ${practiceMode === mode.key ? 'border-amber-400 bg-amber-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="font-bold text-xs text-slate-800">{mode.label}</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">{mode.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Área corporal</label>
                            <select value={setupForm.area} onChange={e => setSetupForm(p => ({ ...p, area: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                <option value="">Aleatoria</option>
                                <option value="hombro">Hombro</option><option value="rodilla">Rodilla</option><option value="columna_lumbar">Columna Lumbar</option>
                                <option value="columna_cervical">Columna Cervical</option><option value="tobillo">Tobillo/Pie</option><option value="cadera">Cadera</option>
                                <option value="codo_muneca">Codo/Muñeca</option><option value="deportivo">Caso Deportivo</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Dificultad</label>
                            <select value={setupForm.dificultad} onChange={e => setSetupForm(p => ({ ...p, dificultad: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                <option value="basico">Básico</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-600 mb-1">Descripción del caso (opcional)</label>
                        <textarea value={setupForm.descripcion} onChange={e => setSetupForm(p => ({ ...p, descripcion: e.target.value }))} placeholder="Ej: Joven deportista con dolor de rodilla bilateral..." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                    </div>
                    <button onClick={handleGenerate} disabled={loading} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                        🎲 Generar Caso Aleatorio
                    </button>
                </div>
            )}

            {/* ════════ HISTORIAL ════════ */}
            {phase === 'SETUP' && showHistorial && (
                <SimuladorHistorial onClose={() => setShowHistorial(false)} />
            )}

            {/* ════════ PHASE: INTERVIEW ════════ */}
            {(phase === 'INTERVIEW' || reviewPhase === 'INTERVIEW') && !loading && caseData && (
                <div className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                        <h3 className="font-bold text-blue-800 mb-2">📋 Ficha del Paciente</h3>
                        <div className="grid grid-cols-2 gap-2 text-sm text-blue-900">
                            <div><span className="font-semibold">Nombre:</span> {caseData.ficha_visible.nombre}</div>
                            <div><span className="font-semibold">Edad:</span> {caseData.ficha_visible.edad}</div>
                            <div><span className="font-semibold">Sexo:</span> {caseData.ficha_visible.sexo}</div>
                            <div><span className="font-semibold">Ocupación:</span> {caseData.ficha_visible.ocupacion}</div>
                            <div className="col-span-2"><span className="font-semibold">Actividad:</span> {caseData.ficha_visible.deporte_actividad}</div>
                            <div className="col-span-2"><span className="font-semibold">Motivo:</span> {caseData.ficha_visible.motivo_consulta}</div>
                            <div className="col-span-2"><span className="font-semibold">Derivación:</span> {caseData.ficha_visible.derivacion}</div>
                            <div className="col-span-2"><span className="font-semibold">Evolución:</span> {caseData.ficha_visible.tiempo_evolucion}</div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-slate-800 text-xl">🎤 Entrevista por Voz</h3>
                                <p className="text-sm text-slate-500">Límite de tiempo: 10 minutos. Habla natural con el paciente.</p>
                            </div>
                            <div className={`px-4 py-2 rounded-xl font-bold font-mono text-lg ${timer >= 540 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
                                {Math.floor((600 - timer) / 60)}:{(600 - timer) % 60 < 10 ? '0' : ''}{(600 - timer) % 60} min restantes
                            </div>
                        </div>

                        {!isReview && connectionState === 'disconnected' && (
                            <button onClick={connect} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-md text-lg">
                                Iniciar Conexión de Voz
                            </button>
                        )}
                        {!isReview && connectionState === 'connecting' && (
                            <div className="w-full bg-blue-100 text-blue-700 font-bold py-4 rounded-xl text-center">
                                Conectando con el paciente...
                            </div>
                        )}
                        {!isReview && connectionState === 'error' && (
                            <div className="space-y-3">
                                <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-red-800 text-sm">
                                    <p className="font-bold mb-2">⚠️ Error al conectar con el simulador de voz</p>
                                    <p className="mb-2">Por favor verifica lo siguiente:</p>
                                    <ul className="list-disc list-inside space-y-1 ml-1">
                                        <li><strong>Reiniciar Servidor:</strong> Si acabas de agregar la API Key al archivo `.env.local`, debes detener tu terminal (`Ctrl + C`) y volver a ejecutar `npm run dev` para que Next.js la detecte.</li>
                                        <li><strong>Permisos del Navegador:</strong> Asegúrate de haber otorgado permisos de micrófono a la página en la barra de direcciones de tu navegador.</li>
                                        <li><strong>Conexión a Internet:</strong> Verifica que no tengas bloqueadores de WebSockets o proxies que impidan la conexión a los servidores de Google Gemini Live.</li>
                                    </ul>
                                </div>
                                <button onClick={connect} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-lg">
                                    Reintentar Conexión de Voz
                                </button>
                            </div>
                        )}
                        {!isReview && connectionState === 'connected' && (
                            <div className="space-y-4">
                                <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-slate-200 relative overflow-hidden">
                                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${isSpeaking ? 'bg-blue-100 shadow-[0_0_40px_rgba(59,130,246,0.6)] scale-110' : 'bg-slate-200'} ${volume > 0.05 ? 'scale-[1.05]' : ''}`}>
                                        <div className={`w-24 h-24 rounded-full transition-all duration-100 ${isSpeaking ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'} ${volume > 0.1 ? 'scale-[1.1]' : ''}`} />
                                    </div>
                                    <p className="mt-6 font-bold text-slate-600">
                                        {isSpeaking ? 'El paciente está hablando...' : 'Escuchando...'}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={toggleMic} className={`flex-1 font-bold py-3 rounded-xl transition-all ${isMicOpen ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}>
                                        {isMicOpen ? '🔇 Mutear Micrófono' : '🔊 Activar Micrófono'}
                                    </button>
                                    <button onClick={handleEndVoiceInterview} disabled={loading} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                        Terminar Entrevista →
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-900 rounded-xl p-4 h-64 overflow-y-auto font-mono text-sm shadow-inner mt-4">
                            {transcript.length === 0 ? (
                                <p className="text-slate-500 italic">La transcripción aparecerá aquí...</p>
                            ) : (
                                transcript.map((t, idx) => (
                                    <div key={idx} className={`mb-3 ${t.role === 'user' ? 'text-blue-300' : 'text-emerald-300'}`}>
                                        <span className="font-bold opacity-50 select-none">{t.role === 'user' ? 'KINE:' : 'PACIENTE:'}</span> {t.text}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════════ PHASE: REASONING ════════ */}
            {(phase === 'REASONING' || reviewPhase === 'REASONING') && !loading && interviewData && (
                <div className="space-y-4">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                        <h3 className="font-bold text-green-800 mb-2">💬 Respuestas del Paciente</h3>
                        <p className="text-sm text-green-900 whitespace-pre-wrap">{interviewData.respuestas_paciente}</p>
                    </div>

                    {!showInterviewAnalysis ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                            <h3 className="font-bold text-slate-800">🧠 Razonamiento Clínico</h3>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Hipótesis Orientativas (3)</label>
                                {reasoning.hipotesis.map((h, i) => (
                                    <input key={i} value={h} onChange={e => { const arr = [...reasoning.hipotesis]; arr[i] = e.target.value; setReasoning(r => ({ ...r, hipotesis: arr })); }}
                                        readOnly={isReview}
                                        placeholder={`Hipótesis ${i + 1}${i === 0 ? ' (más probable)' : i === 2 ? ' (menos probable)' : ''}`}
                                        className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-amber-200 outline-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Clasificación del Dolor</label>
                                    <select value={reasoning.clasificacion_dolor} onChange={e => setReasoning(r => ({ ...r, clasificacion_dolor: e.target.value }))} disabled={isReview} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none ${isReview ? 'bg-slate-50' : ''}`}>
                                        <option value="">Seleccionar...</option><option>Nociceptivo</option><option>Neuropático</option><option>Nociplástico</option><option>Mixto</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Irritabilidad Estimada</label>
                                    <select value={reasoning.irritabilidad} onChange={e => setReasoning(r => ({ ...r, irritabilidad: e.target.value }))} disabled={isReview} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none ${isReview ? 'bg-slate-50' : ''}`}>
                                        <option value="">Seleccionar...</option><option>Alta</option><option>Media</option><option>Baja</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Banderas Rojas Detectadas</label>
                                <textarea value={reasoning.banderas_rojas} onChange={e => setReasoning(r => ({ ...r, banderas_rojas: e.target.value }))} readOnly={isReview} placeholder="Ej: Pérdida de peso, dolor nocturno..." rows={2} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Factores BPS Relevantes</label>
                                <textarea value={reasoning.factores_bps} onChange={e => setReasoning(r => ({ ...r, factores_bps: e.target.value }))} readOnly={isReview} placeholder="Ej: Kinesiofobia, estrés laboral, mal sueño..." rows={2} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                            </div>
                            {!isReview && (
                                <button onClick={handleReasoningSubmit} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                    Confirmar Razonamiento →
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
                                <h3 className="font-bold text-amber-800 mb-3">💡 Análisis de tu Entrevista</h3>
                                {interviewData.analisis_oculto.preguntas_faltantes_criticas.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="font-semibold text-red-700 text-sm mb-2">❌ Preguntas que te faltaron:</h4>
                                        {interviewData.analisis_oculto.preguntas_faltantes_criticas.map((p, i) => (
                                            <div key={i} className="bg-white rounded-xl p-3 mb-2 border border-red-100">
                                                <p className="font-semibold text-sm text-red-800">{p.pregunta}</p>
                                                <p className="text-xs text-slate-600 mt-1"><strong>Importancia:</strong> {p.por_que_importa}</p>
                                                <p className="text-xs text-slate-600"><strong>Diferencial:</strong> {p.que_diferencial_afecta}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {interviewData.analisis_oculto.preguntas_bien_hechas.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-emerald-700 text-sm mb-2">✅ Preguntas bien hechas:</h4>
                                        {interviewData.analisis_oculto.preguntas_bien_hechas.map((p, i) => (
                                            <div key={i} className="bg-emerald-50 rounded-xl p-3 mb-2 border border-emerald-100">
                                                <p className="font-semibold text-sm text-emerald-800">{p.pregunta_detectada}</p>
                                                <p className="text-xs text-slate-600 mt-1">{p.por_que_importa}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {interviewData.analisis_oculto.preguntas_parcialmente_exploradas && interviewData.analisis_oculto.preguntas_parcialmente_exploradas.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-orange-700 text-sm mb-2 mt-3">⚠️ Preguntas cerradas o superficiales:</h4>
                                        {interviewData.analisis_oculto.preguntas_parcialmente_exploradas.map((p, i) => (
                                            <div key={i} className="bg-orange-50 rounded-xl p-3 mb-2 border border-orange-100">
                                                <p className="font-semibold text-sm text-orange-800">{p.pregunta}</p>
                                                <p className="text-xs text-slate-600 mt-1"><strong>Insuficiente porque:</strong> {p.porque_insuficiente}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.entries(interviewData.analisis_oculto.cobertura_entrevista).map(([k, v]) => (
                                        <div key={k} className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {v ? '✓' : '✗'} {k.replace(/_/g, ' ')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleReasoningContinue} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                {getNextPhase('REASONING') === 'RESULTS' ? 'Finalizar y Guardar Intento →' : 'Continuar al Examen Físico →'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ════════ PHASE: EXAM ════════ */}
            {(phase === 'EXAM' || reviewPhase === 'EXAM') && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <h3 className="font-bold text-slate-800">🔍 Planificación del Examen Físico</h3>
                    <p className="text-xs text-slate-500">Selecciona los módulos que incluirías, justifica cada uno, y especifica qué pruebas harías.</p>
                    {EXAM_MODULES.map(m => (
                        <div key={m.key} className={`border rounded-xl p-4 transition-all ${examSelections[m.key].selected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'}`}>
                            <label className={`flex items-center gap-2 ${isReview ? '' : 'cursor-pointer'}`}>
                                <input type="checkbox" checked={examSelections[m.key].selected} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], selected: e.target.checked } }))} disabled={isReview} className="w-4 h-4 rounded accent-blue-600" />
                                <span className="font-semibold text-sm text-slate-800">{m.label}</span>
                            </label>
                            {examSelections[m.key].selected && (
                                <div className="mt-3 space-y-2 pl-6">
                                    <input value={examSelections[m.key].justificacion} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], justificacion: e.target.value } }))} readOnly={isReview} placeholder="¿Por qué incluyes este módulo? (justificación clínica)" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                                    <input value={examSelections[m.key].pruebas} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], pruebas: e.target.value } }))} readOnly={isReview} placeholder={`Pruebas/tests específicos que harías (${m.ejemplo})`} className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                                </div>
                            )}
                        </div>
                    ))}
                    {!isReview && (
                        <button onClick={handleExamSubmit} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            Evaluar al Paciente →
                        </button>
                    )}
                </div>
            )}

            {/* ════════ PHASE: REASONING2 ════════ */}
            {(phase === 'REASONING2' || reviewPhase === 'REASONING2') && !loading && examData && (
                <div className="space-y-4">
                    {/* Header explicativo */}
                    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-5">
                        <h3 className="font-black text-violet-900 text-base mb-1">🔄 Razonamiento Clínico Integrador</h3>
                        <p className="text-sm text-violet-700">
                            Ya tienes los hallazgos del examen físico. Ahora debes <strong>integrarlos con tu razonamiento previo</strong>:
                            ¿se confirman tus hipótesis? ¿cambia tu clasificación de dolor? ¿qué datos del examen son clave para tu diagnóstico?
                        </p>
                        <p className="text-xs text-violet-500 mt-2 italic">
                            Este paso alimenta directamente tu diagnóstico final. No copies los hallazgos — interprétalos.
                        </p>
                    </div>

                    {/* Hallazgos como contexto */}
                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                        <h4 className="font-bold text-teal-800 mb-3 text-sm">📊 Hallazgos que obtuviste en el examen físico</h4>
                        {Object.entries(examData.hallazgos_revelados).map(([mod, findings]) => (
                            <div key={mod} className="mb-3">
                                <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">{mod}</span>
                                <p className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{findings as string}</p>
                            </div>
                        ))}
                        {examData.analisis_examen.modulos_omitidos_relevantes.length > 0 && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                                <p className="text-xs font-bold text-amber-800 mb-1">⚠️ Módulos omitidos (información que no tienes):</p>
                                {examData.analisis_examen.modulos_omitidos_relevantes.map((o, i) => (
                                    <p key={i} className="text-xs text-amber-700">• {o.modulo}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Formulario de integración */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                        <h3 className="font-bold text-slate-800">🧠 Tu Integración Clínica</h3>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">
                                1. Hipótesis confirmadas, descartadas o nuevas
                                <span className="font-normal text-slate-400 ml-1">(¿qué hipótesis persisten, cuáles caen, y aparece alguna nueva?)</span>
                            </label>
                            <textarea
                                value={reasoning2.hipotesis_confirmadas}
                                onChange={e => setReasoning2(r => ({ ...r, hipotesis_confirmadas: e.target.value }))}
                                readOnly={isReview}
                                placeholder="Ej: Se confirma Tendinopatía rotuliana (dolor en polo inferior +, deceleración +, Decline squat +). Se descarta rotura LCA (Lachman -). Nueva hipótesis: posible componente de control motor deficiente (single leg squat con valgo marcado)."
                                rows={4}
                                className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">
                                2. Clasificación del mecanismo de dolor actualizada
                                <span className="font-normal text-slate-400 ml-1">(¿cambia con los hallazgos físicos? ¿por qué?)</span>
                            </label>
                            <textarea
                                value={reasoning2.clasificacion_actualizada}
                                onChange={e => setReasoning2(r => ({ ...r, clasificacion_actualizada: e.target.value }))}
                                readOnly={isReview}
                                placeholder="Ej: Se mantiene predominantemente Nociceptivo (dolor mecánico con patrón de movimiento claro). Se suma componente Nociplástico leve por hiperalgesia a palpación difusa. Se descarta Neuropático (neuro-vascular sin alteraciones)."
                                rows={3}
                                className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">
                                3. Hallazgos clave que más pesan en tu diagnóstico
                                <span className="font-normal text-slate-400 ml-1">(los datos que dirigen tu razonamiento final)</span>
                            </label>
                            <textarea
                                value={reasoning2.hallazgos_clave}
                                onChange={e => setReasoning2(r => ({ ...r, hallazgos_clave: e.target.value }))}
                                readOnly={isReview}
                                placeholder="Ej: Dolor 7/10 en polo inferior rotuliano a palpación. Decline squat +++ (reproduce síntoma principal). ROM completo. Valgo dinámico marcado en single leg squat. MMT cuádriceps 4/5."
                                rows={3}
                                className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">
                                4. Diagnóstico presuntivo (borrador CIF)
                                <span className="font-normal text-slate-400 ml-1">(en 2-3 líneas; lo desarrollarás completamente en la siguiente etapa)</span>
                            </label>
                            <textarea
                                value={reasoning2.diagnostico_presuntivo}
                                onChange={e => setReasoning2(r => ({ ...r, diagnostico_presuntivo: e.target.value }))}
                                readOnly={isReview}
                                placeholder="Ej: Paciente con Tendinopatía rotuliana bilateral de predominio izquierdo (Nociceptivo + componente Nociplástico leve), con déficit de fuerza de cuádriceps y control motor en cadena cinética cerrada, que limita actividad deportiva y genera restricción en participación en competencias de voleibol."
                                rows={4}
                                className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`}
                            />
                        </div>

                        {phase === 'REASONING2' && (
                            <button
                                onClick={() => {
                                    if (!reasoning2.hipotesis_confirmadas.trim() || !reasoning2.hallazgos_clave.trim()) {
                                        setError('Completa al menos las hipótesis integradas y los hallazgos clave antes de continuar.');
                                        return;
                                    }
                                    setError('');
                                    const next = getNextPhase('REASONING2');
                                    if (next) {
                                        setPhase(next);
                                        if (next === 'RESULTS') {
                                            persistAttempt();
                                        }
                                    }
                                }}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm"
                            >
                                {getNextPhase('REASONING2') === 'RESULTS' ? 'Finalizar y Guardar Intento →' : 'Planificar Intervenciones →'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ════════ PHASE: INTERVENTION ════════ */}
            {(phase === 'INTERVENTION' || reviewPhase === 'INTERVENTION') && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                    <h3 className="font-bold text-slate-800">💊 Intervenciones Kinesiológicas al Paciente</h3>
                    <p className="text-xs text-slate-500">Describe 2-3 intervenciones que realizarías en esta sesión. Detalla como si le estuvieras explicando al paciente qué vas a hacer.</p>
                    {interventions.map((int, idx) => (
                        <div key={idx} className="border border-emerald-200 rounded-xl p-4 space-y-3 bg-emerald-50/30">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-sm text-emerald-800">Intervención {idx + 1}</span>
                                {idx > 0 && !isReview && (
                                    <button onClick={() => setInterventions(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700 font-bold">✕ Eliminar</button>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Técnica / Intervención</label>
                                <input value={int.tecnica} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], tecnica: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: Ejercicio isométrico de cuádriceps en cadena cerrada" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${isReview ? 'bg-slate-50' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Objetivo de esta técnica</label>
                                <input value={int.objetivo_tecnica} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], objetivo_tecnica: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: Activar cuádriceps sin aumentar irritabilidad articular" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${isReview ? 'bg-slate-50' : ''}`} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Dosificación (series, repeticiones, RPE, tiempo, etc.)</label>
                                <input value={int.dosis} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], dosis: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: 4 series x 30 seg mantenido, RPE 4/10, descanso 60 seg" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${isReview ? 'bg-slate-50' : ''}`} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Posición del terapeuta</label>
                                    <input value={int.posicion_terapeuta} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], posicion_terapeuta: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: Al lado del paciente, estabilizando la pelvis" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${isReview ? 'bg-slate-50' : ''}`} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Posición del paciente</label>
                                    <input value={int.posicion_paciente} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], posicion_paciente: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: Sentado, rodillas a 60° de flexión, pies apoyados" className={`w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none ${isReview ? 'bg-slate-50' : ''}`} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1">Instrucciones al paciente</label>
                                <textarea value={int.instrucciones_paciente} onChange={e => { const arr = [...interventions]; arr[idx] = { ...arr[idx], instrucciones_paciente: e.target.value }; setInterventions(arr); }} readOnly={isReview} placeholder="Ej: «Vamos a hacer un ejercicio para activar el músculo del muslo sin forzar la rodilla. Va a sentir tensión pero no dolor. Empuje contra el piso como si quisiera aplastarlo y mantenga 30 segundos...»" rows={3} className={`w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none resize-none ${isReview ? 'bg-slate-50' : ''}`} />
                            </div>
                        </div>
                    ))}
                    {!isReview && interventions.length < 4 && (
                        <button onClick={() => setInterventions(prev => [...prev, { tecnica: '', objetivo_tecnica: '', dosis: '', posicion_terapeuta: '', posicion_paciente: '', instrucciones_paciente: '' }])} className="w-full border-2 border-dashed border-emerald-300 text-emerald-600 font-bold py-2 rounded-xl hover:bg-emerald-50 transition-all text-sm">
                            + Agregar otra intervención
                        </button>
                    )}
                    {!isReview && (
                        <button onClick={() => {
                            if (interventions.filter(i => i.tecnica.trim()).length === 0) { setError('Agrega al menos una intervención.'); return; }
                            setError('');
                            const next = getNextPhase('INTERVENTION');
                            if (next) setPhase(next);
                        }} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                            Continuar a Escritura Clínica →
                        </button>
                    )}
                </div>
            )}

            {/* ════════ PHASE: CONSTRUCTION ════════ */}
            {(phase === 'CONSTRUCTION' || reviewPhase === 'CONSTRUCTION') && !loading && examData && (
                <div className="space-y-4">
                    {/* Resumen Clínico Previo */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                        <h3 className="font-bold text-slate-800">📚 Historial del Caso</h3>
                        
                        {interviewData && (
                            <div>
                                <h4 className="font-semibold text-sm text-slate-700 mb-1">Entrevista:</h4>
                                <p className="text-sm text-slate-600 bg-white p-3 rounded-xl border border-slate-200 whitespace-pre-wrap">
                                    {interviewData.respuestas_paciente}
                                </p>
                            </div>
                        )}

                        <div>
                            <h4 className="font-semibold text-sm text-slate-700 mb-2">Tu Razonamiento Previo:</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-3 rounded-xl border border-slate-200">
                                    <span className="font-semibold text-slate-500 block mb-1">Hipótesis Orientativas:</span>
                                    <ul className="list-disc pl-4 text-slate-700">
                                        {reasoning.hipotesis.filter(h => h.trim()).map((h, i) => <li key={i}>{h}</li>)}
                                        {reasoning.hipotesis.filter(h => h.trim()).length === 0 && <li>Ninguna registrada</li>}
                                    </ul>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                                    <p><span className="font-semibold text-slate-500">Mecanismo de Dolor:</span> {reasoning.clasificacion_dolor || 'No especificado'}</p>
                                    <p><span className="font-semibold text-slate-500">Irritabilidad:</span> {reasoning.irritabilidad || 'No especificado'}</p>
                                    <p><span className="font-semibold text-slate-500">Banderas Rojas:</span> {reasoning.banderas_rojas || 'Ninguna'}</p>
                                    <p><span className="font-semibold text-slate-500">Banderas Amarillas/BPS:</span> {reasoning.factores_bps || 'Ninguna'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Exam Results */}
                    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-5">
                        <h3 className="font-bold text-teal-800 mb-3">📊 Hallazgos del Examen Físico</h3>
                        {Object.entries(examData.hallazgos_revelados).map(([mod, findings]) => (
                            <div key={mod} className="mb-3">
                                <h4 className="font-semibold text-sm text-teal-700">{mod}</h4>
                                <p className="text-sm text-slate-700 whitespace-pre-wrap">{findings}</p>
                            </div>
                        ))}
                    </div>
                    {/* Exam Analysis */}
                    {(examData.analisis_examen.modulos_omitidos_relevantes.length > 0 || examData.analisis_examen.justificaciones_debiles.length > 0) && (
                        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5">
                            <h3 className="font-bold text-amber-800 mb-3">💡 Análisis de tu Examen</h3>
                            {examData.analisis_examen.modulos_omitidos_relevantes.map((o, i) => (
                                <div key={i} className="bg-white rounded-xl p-3 mb-2 border border-red-100">
                                    <p className="font-semibold text-sm text-red-800">Omitiste: {o.modulo}</p>
                                    <p className="text-xs text-slate-600">{o.por_que_era_necesario}</p>
                                </div>
                            ))}
                            {examData.analisis_examen.justificaciones_debiles.map((j, i) => (
                                <div key={i} className="bg-white rounded-xl p-3 mb-2 border border-amber-100">
                                    <p className="font-semibold text-sm text-amber-800">{j.modulo}: Justificación débil</p>
                                    <p className="text-xs text-slate-600">{j.critica}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Construction Form */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
                        <h3 className="font-bold text-slate-800">🏗️ Construcción Clínica</h3>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Diagnóstico Kinesiológico (párrafo CIF)</label>
                            <textarea value={construction.diagnostico} onChange={e => setConstruction(c => ({ ...c, diagnostico: e.target.value }))} readOnly={isReview} placeholder="[Nombre/edad/sexo], consulta por [motivo]. Presenta [alteraciones estructurales]. A nivel funcional [disfunciones]. Lo anterior genera limitaciones en [actividades]. Restringiendo su participación en [roles]. Factores personales..." rows={8} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Objetivo General</label>
                            <textarea value={construction.objetivo_general} onChange={e => setConstruction(c => ({ ...c, objetivo_general: e.target.value }))} readOnly={isReview} placeholder="Ej: Restaurar la capacidad funcional del complejo de rodilla para permitir la participación en actividades deportivas y de la vida diaria sin limitación." rows={2} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Objetivos Específicos <span className="font-normal text-slate-400">(1 variable alterada = 1 objetivo específico)</span></label>
                            <textarea value={construction.objetivos_especificos} onChange={e => setConstruction(c => ({ ...c, objetivos_especificos: e.target.value }))} readOnly={isReview} placeholder={"1. Disminuir dolor en región anterior de rodilla\n2. Aumentar rango de flexión de rodilla\n3. Mejorar fuerza de cuádriceps bilateral\n4. Restaurar control motor en cadena cinética cerrada"} rows={5} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Objetivos Operacionales <span className="font-normal text-slate-400">(granulares, medibles, varios por específico)</span></label>
                            <textarea value={construction.objetivos_operacionales} onChange={e => setConstruction(c => ({ ...c, objetivos_operacionales: e.target.value }))} readOnly={isReview} placeholder={"OE1.1: Reducir EVA de 7/10 a 3/10 en reposo, en 4 semanas\nOE1.2: Reducir EVA en Decline squat de 8/10 a 4/10 en 6 semanas\nOE2.1: Aumentar flexión de rodilla de 90° a 130° en 6 semanas\nOE3.1: Aumentar MMT cuádriceps de 4/5 a 5/5 en 8 semanas\nOE4.1: Lograr Single Leg Squat sin valgo en 6 semanas"} rows={7} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Plan de Intervención por Fases</label>
                            <textarea value={construction.plan_fases} onChange={e => setConstruction(c => ({ ...c, plan_fases: e.target.value }))} readOnly={isReview} placeholder="FASE 1 (Protección, sem 0-2): Educación en dolor, ejercicios isométricos RPE 3-4...&#10;FASE 2 (Recuperación, sem 2-6): Fortalecimiento concéntrico RPE 5-6...&#10;FASE 3 (Fortalecimiento, sem 6-10): ...&#10;FASE 4 (Reintegro, sem 10+): ..." rows={8} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Reevaluación y Pronóstico</label>
                            <textarea value={construction.reevaluacion} onChange={e => setConstruction(c => ({ ...c, reevaluacion: e.target.value }))} readOnly={isReview} placeholder="Signo comparable: ...&#10;Plan de reevaluación: Semana 2 evaluar..., Semana 6 evaluar...&#10;Pronóstico: Favorable / Reservado / Desfavorable — Justificación:..." rows={5} className={`w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none ${isReview ? 'bg-slate-50 cursor-default' : ''}`} />
                        </div>
                        {!isReview && (
                            <button onClick={handleEvaluate} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                                {getNextPhase('CONSTRUCTION') === 'RESULTS' ? 'Finalizar y Guardar Intento →' : '📤 Enviar a Comisión Evaluadora'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ════════ PHASE: REVIEW (Scorecard + Commission Questions) ════════ */}
            {(phase === 'REVIEW' || reviewPhase === 'REVIEW') && !loading && evaluationData && (
                <div className="space-y-4">
                    {/* Scorecard */}
                    {practiceMode !== 'comision' && (
                        <>
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800">📊 Scorecard</h3>
                            <div className="flex gap-2">
                                <div className={`px-4 py-2 rounded-xl font-black text-lg ${evaluationData.puntaje_global >= 85 ? 'bg-emerald-100 text-emerald-700' : evaluationData.puntaje_global >= 70 ? 'bg-yellow-100 text-yellow-700' : evaluationData.puntaje_global >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                    {evaluationData.puntaje_global}/100 — {evaluationData.nivel}
                                </div>
                                <div className={`px-4 py-2 rounded-xl font-black text-lg ${evaluationData.nota_chilena >= 6.0 ? 'bg-emerald-100 text-emerald-700' : evaluationData.nota_chilena >= 4.0 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                                    Nota {evaluationData.nota_chilena?.toFixed(1) || 'N/A'}
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2">
                            {Object.entries(evaluationData.scorecard).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-3">
                                    <span className="text-xs font-semibold text-slate-500 w-28 capitalize">{key.replace(/_/g, ' ')}</span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                        <div className={`h-full rounded-full transition-all ${val.puntaje >= 80 ? 'bg-emerald-500' : val.puntaje >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${val.puntaje}%` }} />
                                    </div>
                                    <span className="text-xs font-bold w-10 text-right">{val.puntaje}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Errors & Wins */}
                    {evaluationData.errores_criticos.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
                            <h4 className="font-bold text-red-800 mb-2">❌ Errores Críticos</h4>
                            {evaluationData.errores_criticos.map((e, i) => (
                                <div key={i} className="mb-2 text-sm"><strong className="text-red-700">[{e.fase}]</strong> {e.error} <span className="text-slate-600">— {e.explicacion_docente}</span></div>
                            ))}
                        </div>
                    )}
                    {evaluationData.aciertos_destacados.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                            <h4 className="font-bold text-emerald-800 mb-2">✅ Aciertos Destacados</h4>
                            {evaluationData.aciertos_destacados.map((a, i) => (
                                <div key={i} className="mb-2 text-sm"><strong className="text-emerald-700">[{a.fase}]</strong> {a.acierto} <span className="text-slate-600">— {a.por_que_importa}</span></div>
                            ))}
                        </div>
                    )}
                        </>
                    )}
                    {/* Commission Questions */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                        <h3 className="font-bold text-slate-800">🎤 Preguntas de la Comisión</h3>
                        <p className="text-xs text-slate-500">Responde cada pregunta como si estuvieras frente al tribunal. Luego envía para evaluación.</p>
                        {evaluationData.preguntas_comision.map((q, i) => (
                            <div key={i} className="border border-slate-200 rounded-xl p-4">
                                <p className="font-semibold text-sm text-slate-800 mb-2">Pregunta {i + 1}: {q.pregunta}</p>
                                <textarea value={commissionAnswers[i] || ''} onChange={e => { const arr = [...commissionAnswers]; arr[i] = e.target.value; setCommissionAnswers(arr); }} placeholder="Tu respuesta..." rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                            </div>
                        ))}
                        <button onClick={handleCommission} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            Enviar Respuestas de Comisión →
                        </button>
                    </div>
                </div>
            )}

            {/* ════════ PHASE: RESULTS (Review Tabs) ════════ */}
            {phase === 'RESULTS' && !loading && (
                <div className="bg-slate-100/50 p-1.5 rounded-2xl flex flex-wrap gap-1 border border-slate-200 mb-6">
                    {(['RESULTS', 'INTERVIEW', 'REASONING', 'EXAM', 'REASONING2', 'INTERVENTION', 'CONSTRUCTION', 'REVIEW'] as SimPhase[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setReviewPhase(p === 'RESULTS' ? null : p)}
                            className={`flex-1 min-w-[100px] text-xs font-bold px-3 py-2 rounded-xl transition-all ${
                                (p === 'RESULTS' && !reviewPhase) || reviewPhase === p
                                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:bg-white/50'
                            }`}
                        >
                            {p === 'RESULTS' ? '🏆 Resultados' : PHASE_LABELS[p]}
                        </button>
                    ))}
                </div>
            )}

            {/* ════════ PHASE: RESULTS (Content) ════════ */}
            {phase === 'RESULTS' && !reviewPhase && !loading && (
                <div className="space-y-4">
                    {commissionData && evaluationData ? (
                        <>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
                                <h3 className="font-black text-xl text-amber-900 mb-4">🏆 Resultado Final</h3>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm relative overflow-hidden">
                                <div className={`absolute top-0 w-full h-1 left-0 ${evaluationData.nota_chilena >= 4.0 ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                <div className="text-2xl font-black text-slate-800 mt-1">{evaluationData.puntaje_global}</div>
                                <div className="text-sm font-bold text-slate-600">Nota: {evaluationData.nota_chilena?.toFixed(1) || 'N/A'}</div>
                                <div className="text-xs text-slate-400 mt-1">Evaluación (70%)</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm relative overflow-hidden">
                                <div className={`absolute top-0 w-full h-1 left-0 ${commissionData.nota_chilena_comision >= 4.0 ? 'bg-blue-400' : 'bg-red-400'}`} />
                                <div className="text-2xl font-black text-slate-800 mt-1">{commissionData.puntaje_comision_global}</div>
                                <div className="text-sm font-bold text-slate-600">Nota: {commissionData.nota_chilena_comision?.toFixed(1) || 'N/A'}</div>
                                <div className="text-xs text-slate-400 mt-1">Comisión (30%)</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-100 to-orange-100 rounded-xl p-4 text-center shadow-sm relative overflow-hidden ring-2 ring-amber-300">
                                <div className={`absolute top-0 w-full h-1 left-0 ${((evaluationData.nota_chilena * 0.7) + (commissionData.nota_chilena_comision * 0.3)) >= 4.0 ? 'bg-amber-500' : 'bg-red-400'}`} />
                                <div className="text-2xl font-black text-amber-900 mt-1">{((evaluationData.nota_chilena * 0.7) + (commissionData.nota_chilena_comision * 0.3)).toFixed(1)}</div>
                                <div className="text-sm font-bold text-amber-800">NOTA FINAL</div>
                                <div className="text-xs text-amber-600 mt-1">Consolidada</div>
                            </div>
                        </div>
                        <div className="text-sm text-slate-700 mb-4">⏱️ Tiempo total: <strong>{formatTime(timer)}</strong></div>
                    </div>
                    {/* Commission Detail */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
                        <h4 className="font-bold text-slate-800">Evaluación de tus respuestas de Comisión</h4>
                        {commissionData.evaluacion_respuestas.map((r, i) => (
                            <div key={i} className="border border-slate-200 rounded-xl p-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-semibold text-sm">Pregunta {r.pregunta_numero}</span>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${r.puntaje >= 80 ? 'bg-emerald-100 text-emerald-700' : r.puntaje >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.puntaje}/100</span>
                                </div>
                                <p className="text-xs text-slate-600">{r.comentario}</p>
                                <div className="flex gap-2 mt-2 text-xs">
                                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded">✓ {r.aspecto_correcto}</span>
                                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded">△ {r.aspecto_a_mejorar}</span>
                                </div>
                            </div>
                        ))}
                        <div className="bg-slate-50 rounded-xl p-4 mt-3">
                            <p className="text-sm text-slate-700 italic">{commissionData.feedback_final}</p>
                        </div>
                    </div>
                    {/* Pearl + Improvements */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
                        <h4 className="font-bold text-indigo-800 mb-2">💎 Perla Docente</h4>
                        <p className="text-sm text-indigo-900">{evaluationData.perla_docente}</p>
                    </div>
                    {evaluationData.areas_mejora.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                            <h4 className="font-bold text-slate-800 mb-2">📈 Áreas de Mejora Priorizadas</h4>
                            <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
                                {evaluationData.areas_mejora.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                        </div>
                    )}
                    {/* Final Actions */}
                    <div className="flex gap-3 pt-4 border-t border-slate-200">
                        <button onClick={handleExportPDF} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2">
                            📄 Exportar PDF
                        </button>
                        <button onClick={handleReset} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg">
                            🎲 Nuevo Caso
                        </button>
                    </div>
                        </>
                    ) : (
                        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                            <div className="text-4xl mb-3">👏</div>
                            <h3 className="font-black text-xl text-blue-900 mb-2">Práctica Parcial Finalizada</h3>
                            <p className="text-blue-800 mb-4">Has completado el modo de práctica: <strong>{PRACTICE_PHASES[practiceMode].filter(p => p !== 'RESULTS').map(p => p === 'INTERVIEW' ? 'Entrevista' : p === 'REASONING' ? 'Razonamiento I' : p === 'EXAM' ? 'Examen Físico' : p === 'REASONING2' ? 'Razonamiento II' : p === 'INTERVENTION' ? 'Intervención' : p === 'CONSTRUCTION' ? 'Escritura' : p === 'REVIEW' ? 'Scorecard' : 'Comisión').join(' + ')}</strong></p>
                            <p className="text-sm text-blue-700">Puedes revisar las pestañas superiores para ver tu desempeño y respuestas en las fases que completaste.</p>
                            <div className="text-sm text-blue-700 mt-4">⏱️ Tiempo total de práctica: <strong>{formatTime(timer)}</strong></div>
                            <div className="mt-6 flex justify-center">
                                <button onClick={handleReset} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-sm">
                                    🎲 Practicar Nuevo Caso
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
