"use client";

import { useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { SimCaseType, SimInterviewType, SimExamType, SimEvaluationType, SimCommissionType } from '@/lib/ai/simuladorSchemas';

// ─── Types ───
type SimPhase = 'SETUP' | 'INTERVIEW' | 'REASONING' | 'EXAM' | 'CONSTRUCTION' | 'REVIEW' | 'COMMISSION' | 'RESULTS';

const EXAM_MODULES = [
    { key: 'observacion_movimiento_inicial', label: 'Observación / Movimiento Inicial' },
    { key: 'rango_movimiento_analitico', label: 'Rango de Movimiento Analítico' },
    { key: 'fuerza_tolerancia_carga', label: 'Fuerza / Tolerancia a la Carga' },
    { key: 'palpacion', label: 'Palpación' },
    { key: 'neuro_vascular', label: 'Neuro-Vascular / Somatosensorial' },
    { key: 'control_motor_sensoriomotor', label: 'Control Motor / Sensoriomotor' },
    { key: 'pruebas_ortopedicas', label: 'Pruebas Ortopédicas Dirigidas' },
    { key: 'pruebas_funcionales_reintegro', label: 'Pruebas Funcionales / Reintegro' },
];

const PHASE_LABELS: Record<SimPhase, string> = {
    SETUP: 'Configurar Caso',
    INTERVIEW: 'Entrevista Clínica',
    REASONING: 'Razonamiento Clínico',
    EXAM: 'Examen Físico',
    CONSTRUCTION: 'Construcción Clínica',
    REVIEW: 'Evaluación',
    COMMISSION: 'Comisión',
    RESULTS: 'Resultados',
};

const PHASE_ORDER: SimPhase[] = ['SETUP', 'INTERVIEW', 'REASONING', 'EXAM', 'CONSTRUCTION', 'REVIEW', 'COMMISSION', 'RESULTS'];

// ─── API helper ───
async function simFetch(action: string, payload: any, userId: string) {
    const res = await fetch('/api/ai/simulador', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload, userId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error en llamada al simulador');
    return data.data;
}

// ─── Main Component ───
export function SimuladorExamen() {
    const { user } = useAuth();
    const [phase, setPhase] = useState<SimPhase>('SETUP');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

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
    const [reasoning, setReasoning] = useState({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', banderas_amarillas: '', factores_bps: '' });
    const [examSelections, setExamSelections] = useState<Record<string, { selected: boolean; justificacion: string; pruebas: string }>>(() => {
        const init: any = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        return init;
    });
    const [construction, setConstruction] = useState({ diagnostico: '', objetivo_general: '', objetivos_smart: '', plan_fases: '', reevaluacion: '' });
    const [commissionAnswers, setCommissionAnswers] = useState<string[]>([]);

    // Timer
    const startTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimer(0);
        timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    };
    const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // ─── Phase Handlers ───
    const handleGenerate = async () => {
        if (!user) return;
        setLoading(true); setError('');
        try {
            const data = await simFetch('generate', setupForm, user.uid);
            setCaseData(data);
            setPhase('INTERVIEW');
            startTimer();
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleInterview = async () => {
        if (!user || !caseData) return;
        if (!studentQuestions.trim()) { setError('Escribe al menos una pregunta.'); return; }
        setLoading(true); setError('');
        try {
            const data = await simFetch('interview', {
                perfil_secreto: caseData.perfil_secreto,
                ficha_visible: caseData.ficha_visible,
                preguntas_estudiante: studentQuestions,
            }, user.uid);
            setInterviewData(data);
            setPhase('REASONING');
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleReasoningSubmit = () => {
        setShowInterviewAnalysis(true);
    };
    const handleReasoningContinue = () => {
        setPhase('EXAM');
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
            setPhase('CONSTRUCTION');
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
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
                    hipotesis: reasoning.hipotesis.filter(h => h.trim()),
                    clasificacion_dolor: reasoning.clasificacion_dolor,
                    irritabilidad: reasoning.irritabilidad,
                    banderas: { rojas: reasoning.banderas_rojas, amarillas: reasoning.banderas_amarillas, bps: reasoning.factores_bps },
                    modulos_seleccionados: modulosTexto,
                    diagnostico: construction.diagnostico,
                    objetivo_general: construction.objetivo_general,
                    objetivos_smart: construction.objetivos_smart,
                    plan_fases: construction.plan_fases,
                    reevaluacion: construction.reevaluacion,
                },
            }, user.uid);
            setEvaluationData(data);
            setCommissionAnswers(new Array(data.preguntas_comision?.length || 0).fill(''));
            setPhase('REVIEW');
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
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
            if (timerRef.current) clearInterval(timerRef.current);
            setPhase('RESULTS');
        } catch (e: any) { setError(e.message); }
        finally { setLoading(false); }
    };

    const handleExport = () => {
        if (!caseData || !evaluationData) return;
        const lines = [
            '═══════════════════════════════════════',
            'SIMULADOR DE EXAMEN CLÍNICO — REPORTE',
            '═══════════════════════════════════════',
            `Fecha: ${new Date().toLocaleDateString('es-CL')}`,
            `Tiempo: ${formatTime(timer)}`,
            `Estudiante: ${user?.displayName || user?.email || 'N/A'}`,
            '',
            '── CASO ──',
            `Paciente: ${caseData.ficha_visible.nombre}, ${caseData.ficha_visible.edad}, ${caseData.ficha_visible.sexo}`,
            `Motivo: ${caseData.ficha_visible.motivo_consulta}`,
            `Derivación: ${caseData.ficha_visible.derivacion}`,
            '',
            '── MIS PREGUNTAS DE ENTREVISTA ──',
            studentQuestions,
            '',
            '── MI RAZONAMIENTO ──',
            `Hipótesis: ${reasoning.hipotesis.filter(h => h).join(' | ')}`,
            `Clasificación dolor: ${reasoning.clasificacion_dolor}`,
            `Irritabilidad: ${reasoning.irritabilidad}`,
            '',
            '── MI DIAGNÓSTICO ──',
            construction.diagnostico,
            '',
            '── MIS OBJETIVOS ──',
            `General: ${construction.objetivo_general}`,
            `SMART: ${construction.objetivos_smart}`,
            '',
            '── MI PLAN ──',
            construction.plan_fases,
            '',
            '── MI REEVALUACIÓN ──',
            construction.reevaluacion,
            '',
            '═══════════════════════════════════════',
            'EVALUACIÓN DE LA COMISIÓN',
            '═══════════════════════════════════════',
            `Puntaje Global: ${evaluationData.puntaje_global}/100 — ${evaluationData.nivel}`,
            '',
            '── Scorecard ──',
            ...Object.entries(evaluationData.scorecard).map(([k, v]) => `${k}: ${v.puntaje}/100 — ${v.comentario}`),
            '',
            '── Errores Críticos ──',
            ...evaluationData.errores_criticos.map(e => `[${e.fase}] ${e.error}: ${e.explicacion_docente}`),
            '',
            '── Aciertos ──',
            ...evaluationData.aciertos_destacados.map(a => `[${a.fase}] ${a.acierto}: ${a.por_que_importa}`),
            '',
            '── Perla Docente ──',
            evaluationData.perla_docente,
        ];
        if (commissionData) {
            lines.push('', '── Comisión ──', `Puntaje: ${commissionData.puntaje_comision_global}/100`, commissionData.feedback_final);
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `simulador_${new Date().toISOString().slice(0, 10)}_${caseData.ficha_visible.nombre.replace(/\s/g, '_')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleReset = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('SETUP'); setCaseData(null); setInterviewData(null); setExamData(null);
        setEvaluationData(null); setCommissionData(null); setShowInterviewAnalysis(false);
        setStudentQuestions(''); setTimer(0); setError('');
        setReasoning({ hipotesis: ['', '', ''], clasificacion_dolor: '', irritabilidad: '', banderas_rojas: '', banderas_amarillas: '', factores_bps: '' });
        setConstruction({ diagnostico: '', objetivo_general: '', objetivos_smart: '', plan_fases: '', reevaluacion: '' });
        setCommissionAnswers([]);
        const init: any = {};
        EXAM_MODULES.forEach(m => { init[m.key] = { selected: false, justificacion: '', pruebas: '' }; });
        setExamSelections(init);
    };

    // Progress bar
    const currentIdx = PHASE_ORDER.indexOf(phase);

    // ─── RENDER ───
    return (
        <div className="max-w-4xl mx-auto space-y-6">
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
                    {PHASE_ORDER.map((p, i) => (
                        <div key={p} className={`h-2 flex-1 rounded-full transition-all ${i <= currentIdx ? (i === currentIdx ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'}`} title={PHASE_LABELS[p]} />
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

            {/* ════════ PHASE: SETUP ════════ */}
            {phase === 'SETUP' && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
                    <h2 className="text-lg font-bold text-slate-800">Configura tu caso clínico</h2>
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

            {/* ════════ PHASE: INTERVIEW ════════ */}
            {phase === 'INTERVIEW' && !loading && caseData && (
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
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
                        <h3 className="font-bold text-slate-800">🗣️ ¿Qué le preguntarías a este paciente?</h3>
                        <p className="text-xs text-slate-500">Escribe TODAS tus preguntas. No podrás volver a preguntar después. Como en un examen real.</p>
                        <textarea value={studentQuestions} onChange={e => setStudentQuestions(e.target.value)} placeholder="Ej: ¿Desde cuándo tiene el dolor? ¿Qué actividades lo provocan? ¿Ha tenido esto antes?..." rows={8} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        <button onClick={handleInterview} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            Entrevistar al Paciente →
                        </button>
                    </div>
                </div>
            )}

            {/* ════════ PHASE: REASONING ════════ */}
            {phase === 'REASONING' && !loading && interviewData && (
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
                                        placeholder={`Hipótesis ${i + 1}${i === 0 ? ' (más probable)' : i === 2 ? ' (menos probable)' : ''}`}
                                        className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-amber-200 outline-none" />
                                ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Clasificación del Dolor</label>
                                    <select value={reasoning.clasificacion_dolor} onChange={e => setReasoning(r => ({ ...r, clasificacion_dolor: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                        <option value="">Seleccionar...</option><option>Nociceptivo</option><option>Neuropático</option><option>Nociplástico</option><option>Mixto</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-600 mb-1">Irritabilidad Estimada</label>
                                    <select value={reasoning.irritabilidad} onChange={e => setReasoning(r => ({ ...r, irritabilidad: e.target.value }))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none">
                                        <option value="">Seleccionar...</option><option>Alta</option><option>Media</option><option>Baja</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Banderas Rojas Detectadas</label>
                                <textarea value={reasoning.banderas_rojas} onChange={e => setReasoning(r => ({ ...r, banderas_rojas: e.target.value }))} placeholder="Ej: Pérdida de peso, dolor nocturno..." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-600 mb-1">Factores BPS Relevantes</label>
                                <textarea value={reasoning.factores_bps} onChange={e => setReasoning(r => ({ ...r, factores_bps: e.target.value }))} placeholder="Ej: Kinesiofobia, estrés laboral, mal sueño..." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                            </div>
                            <button onClick={handleReasoningSubmit} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                Confirmar Razonamiento →
                            </button>
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
                                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {Object.entries(interviewData.analisis_oculto.cobertura_entrevista).map(([k, v]) => (
                                        <div key={k} className={`text-xs px-3 py-1.5 rounded-lg font-semibold ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                            {v ? '✓' : '✗'} {k.replace(/_/g, ' ')}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleReasoningContinue} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                                Continuar al Examen Físico →
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ════════ PHASE: EXAM ════════ */}
            {phase === 'EXAM' && !loading && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-4">
                    <h3 className="font-bold text-slate-800">🔍 Planificación del Examen Físico</h3>
                    <p className="text-xs text-slate-500">Selecciona los módulos que incluirías, justifica cada uno, y especifica qué pruebas harías.</p>
                    {EXAM_MODULES.map(m => (
                        <div key={m.key} className={`border rounded-xl p-4 transition-all ${examSelections[m.key].selected ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'}`}>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={examSelections[m.key].selected} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], selected: e.target.checked } }))} className="w-4 h-4 rounded accent-blue-600" />
                                <span className="font-semibold text-sm text-slate-800">{m.label}</span>
                            </label>
                            {examSelections[m.key].selected && (
                                <div className="mt-3 space-y-2 pl-6">
                                    <input value={examSelections[m.key].justificacion} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], justificacion: e.target.value } }))} placeholder="¿Por qué incluyes este módulo? (justificación clínica)" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                                    <input value={examSelections[m.key].pruebas} onChange={e => setExamSelections(p => ({ ...p, [m.key]: { ...p[m.key], pruebas: e.target.value } }))} placeholder="Pruebas/tests específicos que harías (ej: Lachman, Cajón Anterior)" className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-200 outline-none" />
                                </div>
                            )}
                        </div>
                    ))}
                    <button onClick={handleExamSubmit} disabled={loading} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                        Evaluar al Paciente →
                    </button>
                </div>
            )}

            {/* ════════ PHASE: CONSTRUCTION ════════ */}
            {phase === 'CONSTRUCTION' && !loading && examData && (
                <div className="space-y-4">
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
                            <textarea value={construction.diagnostico} onChange={e => setConstruction(c => ({ ...c, diagnostico: e.target.value }))} placeholder="[Nombre/edad/sexo], consulta por [motivo]. Presenta [alteraciones estructurales]. A nivel funcional [disfunciones]. Lo anterior genera limitaciones en [actividades]. Restringiendo su participación en [roles]. Factores personales..." rows={8} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Objetivo General</label>
                            <textarea value={construction.objetivo_general} onChange={e => setConstruction(c => ({ ...c, objetivo_general: e.target.value }))} placeholder="Ej: Restaurar la capacidad funcional del complejo de rodilla para permitir la participación en actividades deportivas y de la vida diaria sin limitación." rows={2} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Objetivos SMART (1 variable = 1 SMART)</label>
                            <textarea value={construction.objetivos_smart} onChange={e => setConstruction(c => ({ ...c, objetivos_smart: e.target.value }))} placeholder="1. Disminuir dolor de 7/10 a 3/10 en 4 semanas (Dolor, Alta)&#10;2. Aumentar flexión de rodilla de 90° a 130° en 6 semanas (ROM, Media)&#10;3. ..." rows={6} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Plan de Intervención por Fases</label>
                            <textarea value={construction.plan_fases} onChange={e => setConstruction(c => ({ ...c, plan_fases: e.target.value }))} placeholder="FASE 1 (Protección, sem 0-2): Educación en dolor, ejercicios isométricos RPE 3-4...&#10;FASE 2 (Recuperación, sem 2-6): Fortalecimiento concéntrico RPE 5-6...&#10;FASE 3 (Fortalecimiento, sem 6-10): ...&#10;FASE 4 (Reintegro, sem 10+): ..." rows={8} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-600 mb-1">Reevaluación y Pronóstico</label>
                            <textarea value={construction.reevaluacion} onChange={e => setConstruction(c => ({ ...c, reevaluacion: e.target.value }))} placeholder="Signo comparable: ...&#10;Plan de reevaluación: Semana 2 evaluar..., Semana 6 evaluar...&#10;Pronóstico: Favorable / Reservado / Desfavorable — Justificación:..." rows={5} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-amber-200 outline-none resize-none" />
                        </div>
                        <button onClick={handleEvaluate} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm disabled:opacity-50">
                            📤 Enviar a Comisión Evaluadora
                        </button>
                    </div>
                </div>
            )}

            {/* ════════ PHASE: REVIEW (Scorecard + Commission Questions) ════════ */}
            {phase === 'REVIEW' && !loading && evaluationData && (
                <div className="space-y-4">
                    {/* Scorecard */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-slate-800">📊 Scorecard</h3>
                            <div className={`px-4 py-2 rounded-xl font-black text-lg ${evaluationData.puntaje_global >= 85 ? 'bg-emerald-100 text-emerald-700' : evaluationData.puntaje_global >= 65 ? 'bg-yellow-100 text-yellow-700' : evaluationData.puntaje_global >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                {evaluationData.puntaje_global}/100 — {evaluationData.nivel}
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

            {/* ════════ PHASE: RESULTS ════════ */}
            {phase === 'RESULTS' && !loading && commissionData && evaluationData && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
                        <h3 className="font-black text-xl text-amber-900 mb-4">🏆 Resultado Final</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="text-3xl font-black text-slate-800">{evaluationData.puntaje_global}</div>
                                <div className="text-xs text-slate-500 font-semibold">Evaluación Clínica</div>
                            </div>
                            <div className="bg-white rounded-xl p-4 text-center shadow-sm">
                                <div className="text-3xl font-black text-slate-800">{commissionData.puntaje_comision_global}</div>
                                <div className="text-xs text-slate-500 font-semibold">Defensa Comisión</div>
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
                    {/* Actions */}
                    <div className="flex gap-3">
                        <button onClick={handleExport} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                            📄 Exportar Reporte
                        </button>
                        <button onClick={handleReset} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all shadow-sm">
                            🎲 Nuevo Caso
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
