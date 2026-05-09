import React, { useState, useEffect } from "react";
import { Evaluacion, EvaluacionInicial } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";

export interface EvaluacionExpressFormProps {
    usuariaId: string;
    procesoId: string;
    initialData: Evaluacion | null;
    onClose: () => void;
    onSaveSuccess: (evaluacion: Evaluacion, isNew: boolean) => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export function EvaluacionExpressForm({ usuariaId, procesoId, initialData, onClose, onSaveSuccess }: EvaluacionExpressFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();
    
    const isEditMode = !!initialData;
    const [loading, setLoading] = useState(false);
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isGrounding, setIsGrounding] = useState(false);

    const initialDataAny = initialData as any;

    // State for the text areas
    const [notasSubjetivas, setNotasSubjetivas] = useState(initialDataAny?.expressDraft?.notasSubjetivas || '');
    const [notasObjetivas, setNotasObjetivas] = useState(initialDataAny?.expressDraft?.notasObjetivas || '');
    const [groundingQuery, setGroundingQuery] = useState('');
    const [groundingResult, setGroundingResult] = useState<any>(null);

    // Draft local de la IA estructurada
    const [structuredResult, setStructuredResult] = useState<any>(initialDataAny?.expressDraft?.structuredResult || null);

    const handleSave = async (silent = false) => {
        if (!globalActiveYear || !user) return;
        try {
            if (!silent) setLoading(true);
            const targetId = initialData?.id || generateId();

            const basePayload: any = initialData || {
                id: targetId,
                usuariaId,
                procesoId,
                type: 'INITIAL',
                status: 'DRAFT',
                sessionAt: new Date().toISOString(),
                clinicianResponsible: user.email || '',
                audit: { createdBy: user.uid, createdAt: new Date().toISOString() }
            };

            basePayload.expressDraft = { notasSubjetivas, notasObjetivas, structuredResult };

            // Inyectar a la evaluación regular si hay estructuración para que puedan continuar
            if (structuredResult) {
                if (!basePayload.interview) basePayload.interview = { v4: { focos: [] } };
                if (!basePayload.interview.v4) basePayload.interview.v4 = { focos: [] };
                if (basePayload.interview.v4.focos.length === 0) {
                    basePayload.interview.v4.focos.push({
                        id: generateId(),
                        isPrincipal: true,
                        region: structuredResult.focoPrincipal,
                        notaRapida: structuredResult.relatoEstructurado
                    });
                } else {
                    basePayload.interview.v4.focos[0].notaRapida = structuredResult.relatoEstructurado;
                }
                
                // Examen fisico
                if (!basePayload.guidedExam) basePayload.guidedExam = {};
                basePayload.guidedExam.observation = structuredResult.examenFisico; // guardamos en uno de los campos libres
            }

            const docRef = doc(db, "programs", globalActiveYear, "evaluaciones", targetId);
            await setDoc(docRef, sanitizeForFirestoreDeep(basePayload), { merge: true });

            if (!silent) {
                if (onSaveSuccess) onSaveSuccess(basePayload, !isEditMode);
            }
        } catch (error: any) {
            console.error("Error saving Express Evaluation:", error);
            if (!silent) alert("Error al guardar: " + error.message);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Auto-save
    useEffect(() => {
        const timer = setTimeout(() => {
            if (notasSubjetivas || notasObjetivas) handleSave(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [notasSubjetivas, notasObjetivas, structuredResult]);

    const handleAIEstructurar = async () => {
        if (!notasSubjetivas && !notasObjetivas) return alert("Escribe algo primero en las notas.");
        setIsAiProcessing(true);
        try {
            const res = await fetch('/api/ai/express-structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notasSubjetivas, notasObjetivas, userId: user?.uid })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error AI');
            setStructuredResult(data.data);
        } catch (e: any) {
            alert("Error procesando IA: " + e.message);
        } finally {
            setIsAiProcessing(false);
        }
    };

    const handleAIGrounding = async () => {
        if (!groundingQuery) return alert("Ingresa un término para consultar (ej: Síndrome Cruzado, Pregabalina)");
        setIsGrounding(true);
        setGroundingResult(null);
        try {
            const res = await fetch('/api/ai/grounding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: groundingQuery, userId: user?.uid })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error AI');
            setGroundingResult(data.data);
        } catch (e: any) {
            alert("Error consultando Web: " + e.message);
        } finally {
            setIsGrounding(false);
        }
    };

    const [activeFullscreen, setActiveFullscreen] = useState<'subjetivas' | 'objetivas' | null>(null);
    const [showHelp, setShowHelp] = useState<'subjetivas' | 'objetivas' | null>(null);

    const plantillas = {
        subjetivas: `[PERFIL Y DEPORTE]
• Deporte/Nivel: [escribir]
• Momento temporada: [pre/competencia/descanso]

[HISTORIA DE LA CONDICIÓN]
• Motivo de consulta principal: [escribir]
• Mapa de síntomas / Tipo de dolor: [nociceptivo / neuropático / nociplástico]
• Mecanismo (Cinemática): [agudo / sobreuso]
• Comportamiento 24h: [AM / PM / Nocturno / Actividad / Reposo]
• Agravantes (Mec/No mecánicos): [escribir]
• Mitigantes: [escribir]

[BANDERAS Y FACTORES]
• Banderas Rojas: [descartadas / presentes - escribir]
• Banderas Amarillas (Miedo/Creencias): [escribir]
• Sueño y estrés: [escribir]

[ANAMNESIS REMOTA]
• Lesiones previas: [escribir]
• Cirugías/Fármacos: [escribir]
• Expectativas (RTP/RTS): [escribir]`,
        objetivas: `[INSPECCIÓN GLOBAL]
• Postura/Atrofias: [escribir]
• Patrón de marcha/carrera: [escribir]

[SCREENING FUNCIONAL BASE]
• Movimientos globales (Sentadilla/Drop Jump/Y-Balance): [escribir]

[EVALUACIÓN ARTICULAR Y MUSCULAR]
• ROM (Dolor/Restricciones/End-feel): [escribir]
• Fuerza (MVIC/Dinamometría/LSI%): [escribir]
• Resistencia/Tolerancia carga: [escribir]
• Control neuromuscular: [escribir]

[PRUEBAS ESPECIALES (Clústers)]
• Test 1: [resultado]
• Test 2: [resultado]

[NEUROLÓGICA Y NEURODINAMIA]
• Miotomas/Dermatomas/Reflejos: [escribir]
• Neurodinamia (Slump/SLR/ULNT): [escribir]

[PALPACIÓN]
• Sensibilidad/Puntos Gatillo: [escribir]`
    };

    const handleInsertTemplate = (type: 'subjetivas' | 'objetivas') => {
        if (type === 'subjetivas') {
            setNotasSubjetivas((prev: string) => prev ? prev + '\n\n' + plantillas.subjetivas : plantillas.subjetivas);
        } else {
            setNotasObjetivas((prev: string) => prev ? prev + '\n\n' + plantillas.objetivas : plantillas.objetivas);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-end md:items-center">
            {activeFullscreen && (
                <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            {activeFullscreen === 'subjetivas' ? (
                                <><span className="text-blue-500">💬</span> Notas de Entrevista</>
                            ) : (
                                <><span className="text-emerald-500">🩺</span> Notas de Examen Físico</>
                            )}
                        </h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleInsertTemplate(activeFullscreen)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1">
                                📋 Plantilla
                            </button>
                            <button onClick={() => setActiveFullscreen(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm">
                                Listo
                            </button>
                        </div>
                    </div>
                    <textarea 
                        autoFocus
                        className="flex-1 w-full p-6 text-base resize-none focus:outline-none bg-white"
                        placeholder={activeFullscreen === 'subjetivas' ? "Anota libremente lo que el paciente te cuenta..." : "Anota libremente tus hallazgos de evaluación..."}
                        value={activeFullscreen === 'subjetivas' ? notasSubjetivas : notasObjetivas}
                        onChange={e => activeFullscreen === 'subjetivas' ? setNotasSubjetivas(e.target.value) : setNotasObjetivas(e.target.value)}
                    />
                </div>
            )}

            <div className="bg-white w-full md:max-w-5xl md:h-[90vh] h-[95vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                            <span>⚡</span> Evaluación Inicial (Modo Express)
                        </h2>
                        <p className="text-xs text-indigo-600 font-medium mt-1">Toma notas libres y deja que la IA las ordene. Posterior a la evaluación, en otro momento, realiza el diagnóstico completo.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => handleSave()} disabled={loading} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors">
                            {loading ? 'Guardando...' : 'Guardar y Cerrar'}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-indigo-100 text-indigo-400 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
                    <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-10">
                        
                        {/* Box de Entrada de Datos */}
                        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60">
                            <h3 className="font-black text-slate-800 text-lg mb-6 text-center">Apuntes Clínicos</h3>
                            
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <span className="text-blue-500">💬</span> Entrevista (Subjetivo)
                                            </label>
                                            <div className="relative">
                                                <button onClick={() => setShowHelp(showHelp === 'subjetivas' ? null : 'subjetivas')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">?</button>
                                                {showHelp === 'subjetivas' && (
                                                    <div className="absolute left-0 mt-2 w-72 p-4 bg-slate-800 text-slate-100 text-xs rounded-xl shadow-xl z-10 border border-slate-700 animate-in fade-in zoom-in-95 leading-relaxed">
                                                        <strong className="text-white block mb-2 text-sm border-b border-slate-600 pb-1">💡 Tips Basados en Evidencia (Subjetivo):</strong>
                                                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                                            <li>Identifica banderas rojas (dolor nocturno, pérdida de peso, síntomas neurológicos bilaterales).</li>
                                                            <li>Identifica banderas amarillas (Cuestionarios STarT Back, OREBRO, Kinesiofobia).</li>
                                                            <li>Analiza mecanismo lesional: Cinemática del trauma o patrón de sobreuso.</li>
                                                            <li>Clasifica el dolor: Nociceptivo vs Neuropático vs Nociplástico.</li>
                                                            <li>Determina S.I.N.S.S: Severidad, Irritabilidad, Naturaleza, Estadio y Estabilidad.</li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleInsertTemplate('subjetivas')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors">
                                                📋 Plantilla
                                            </button>
                                            <button onClick={() => setActiveFullscreen('subjetivas')} className="text-xs text-indigo-500 font-bold hover:text-indigo-700 md:hidden flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all shadow-inner"
                                        placeholder="Anota libremente lo que el paciente te cuenta..."
                                        rows={6}
                                        value={notasSubjetivas}
                                        onChange={e => setNotasSubjetivas(e.target.value)}
                                        onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('subjetivas') }}
                                    />
                                </div>

                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <span className="text-emerald-500">🩺</span> Examen Físico (Objetivo)
                                            </label>
                                            <div className="relative">
                                                <button onClick={() => setShowHelp(showHelp === 'objetivas' ? null : 'objetivas')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">?</button>
                                                {showHelp === 'objetivas' && (
                                                    <div className="absolute left-0 mt-2 w-72 p-4 bg-slate-800 text-slate-100 text-xs rounded-xl shadow-xl z-10 border border-slate-700 animate-in fade-in zoom-in-95 leading-relaxed">
                                                        <strong className="text-white block mb-2 text-sm border-b border-slate-600 pb-1">💡 Tips Basados en Evidencia (Objetivo):</strong>
                                                        <ul className="list-disc pl-4 space-y-1 text-slate-300">
                                                            <li>Prioriza Clústers de pruebas (ej. Laslett, Hawkins+Neer) sobre tests aislados por baja especificidad.</li>
                                                            <li>Dinamometría: Evalúa fuerza isométrica máxima y calcula Simetría (LSI %).</li>
                                                            <li>Neurodinamia: Considera diferenciación estructural (Slump, ULNT, SLR).</li>
                                                            <li>Cuantifica el dolor y rango: Evalúa modificación de síntomas tras intervenciones de prueba.</li>
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleInsertTemplate('objetivas')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors">
                                                📋 Plantilla
                                            </button>
                                            <button onClick={() => setActiveFullscreen('objetivas')} className="text-xs text-emerald-500 font-bold hover:text-emerald-700 md:hidden flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-300 transition-all shadow-inner"
                                        placeholder="Anota libremente tus hallazgos de evaluación..."
                                        rows={6}
                                        value={notasObjetivas}
                                        onChange={e => setNotasObjetivas(e.target.value)}
                                        onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('objetivas') }}
                                    />
                                </div>
                            </div>

                            <div className="mt-8">
                                <button 
                                    onClick={handleAIEstructurar} 
                                    disabled={isAiProcessing || (!notasSubjetivas && !notasObjetivas)}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                                >
                                    {isAiProcessing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Procesando con Inteligencia Clínica...
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl">✨</span> Generar Análisis Clínico y Estructura
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* IA Feedback / Dashboard */}
                        {structuredResult && (
                            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/60 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center mb-8">
                                    <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full mb-3">
                                        Resultados Estructurados
                                    </span>
                                    <h3 className="font-black text-slate-900 text-2xl">Síntesis Clínica</h3>
                                </div>

                                <div className="space-y-6">
                                    {/* 1. Alertas Docentes (Coach) */}
                                    {structuredResult.sugerenciasFaltantes && structuredResult.sugerenciasFaltantes.length > 0 && (
                                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-2xl p-6 shadow-sm">
                                            <h4 className="text-amber-900 font-black text-base flex items-center gap-2 mb-4">
                                                <span>💡</span> Coach Clínico: Evaluaciones Faltantes
                                            </h4>
                                            <div className="grid gap-3">
                                                {structuredResult.sugerenciasFaltantes.map((sug: any, i: number) => (
                                                    <div key={i} className="bg-white/60 p-4 rounded-xl border border-amber-200/50">
                                                        <div className="font-black text-amber-900 text-sm mb-1">{sug.pregunta}</div>
                                                        <div className="text-amber-700 text-sm leading-relaxed">{sug.por_que}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. SINS y Foco */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                                            <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Foco Principal Detectado</h4>
                                            <div className="text-base font-black text-slate-800 flex items-center gap-2">
                                                <span className="text-blue-500">📍</span> {structuredResult.focoPrincipal}
                                            </div>
                                        </div>
                                        
                                        {structuredResult.sins && (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5">
                                                <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-3">Análisis S.I.N.S</h4>
                                                <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                                                    <div><span className="text-slate-400 font-medium block text-xs">Severidad</span> <strong className="text-slate-800">{structuredResult.sins.severidad}</strong></div>
                                                    <div><span className="text-slate-400 font-medium block text-xs">Irritabilidad</span> <strong className="text-slate-800">{structuredResult.sins.irritabilidad}</strong></div>
                                                    <div><span className="text-slate-400 font-medium block text-xs">Naturaleza</span> <strong className="text-slate-800">{structuredResult.sins.naturaleza}</strong></div>
                                                    <div><span className="text-slate-400 font-medium block text-xs">Estadio</span> <strong className="text-slate-800">{structuredResult.sins.estadio}</strong></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Hipótesis */}
                                    {structuredResult.hipotesis_orientativas && structuredResult.hipotesis_orientativas.length > 0 && (
                                        <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-6">
                                            <h4 className="text-indigo-900 font-black text-base flex items-center gap-2 mb-4">
                                                <span>🎯</span> Hipótesis Orientativas
                                            </h4>
                                            <div className="grid gap-4">
                                                {structuredResult.hipotesis_orientativas.map((hip: any, i: number) => (
                                                    <div key={i} className="flex gap-4 bg-white p-4 rounded-xl shadow-sm border border-indigo-50">
                                                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-black shrink-0">{i+1}</div>
                                                        <div>
                                                            <div className="font-black text-slate-800 text-sm mb-1">{hip.titulo}</div>
                                                            <div className="text-slate-600 text-sm leading-relaxed">{hip.fundamento}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Resumen Limpio */}
                                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                                        <h4 className="text-slate-800 font-black text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                                            <span>📝</span> Apuntes Estructurados
                                        </h4>
                                        <div>
                                            <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Entrevista (Subjetivo)</h4>
                                            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                                {structuredResult.relatoEstructurado}
                                            </div>
                                        </div>
                                        {structuredResult.anamnesisRemota && structuredResult.anamnesisRemota !== "Sin datos registrados" && (
                                            <div className="pt-4 border-t border-slate-100">
                                                <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Antecedentes</h4>
                                                <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                                    {structuredResult.anamnesisRemota}
                                                </div>
                                            </div>
                                        )}
                                        <div className="pt-4 border-t border-slate-100">
                                            <h4 className="text-emerald-500 font-bold text-[10px] uppercase tracking-wider mb-2">Examen Físico (Objetivo)</h4>
                                            <div className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                                {structuredResult.examenFisico}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Box de Grounding */}
                        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-6 md:p-8 shadow-xl text-white">
                            <h3 className="font-black text-white text-lg mb-2 flex items-center gap-2">🔍 Grounding Clínico</h3>
                            <p className="text-indigo-200 text-sm mb-6">Consulta patologías, test especiales o fármacos. Todo validado mediante Google Search.</p>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="Ej: Signos de alerta en dolor lumbar..."
                                    value={groundingQuery}
                                    onChange={e => setGroundingQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAIGrounding()}
                                />
                                <button 
                                    onClick={handleAIGrounding} 
                                    disabled={isGrounding || !groundingQuery}
                                    className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-indigo-500/20"
                                >
                                    {isGrounding ? 'Buscando...' : 'Consultar'}
                                </button>
                            </div>

                            {groundingResult && (
                                <div className="mt-6 bg-white/5 backdrop-blur-sm p-5 rounded-2xl border border-white/10 text-sm animate-in fade-in slide-in-from-top-4">
                                    <p className="text-indigo-50 font-medium whitespace-pre-line leading-relaxed">{groundingResult.respuesta}</p>
                                    {groundingResult.fuentes_utilizadas && groundingResult.fuentes_utilizadas.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-indigo-300 font-medium flex flex-wrap gap-2 items-center">
                                            <span>Fuentes:</span>
                                            {groundingResult.fuentes_utilizadas.map((f: string, i: number) => (
                                                <span key={i} className="bg-white/10 px-2 py-1 rounded-md">{f}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
