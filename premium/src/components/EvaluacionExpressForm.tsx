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

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-end md:items-center">
            <div className="bg-white w-full md:max-w-5xl md:h-[90vh] h-[95vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                            <span>⚡</span> Evaluación Inicial (Modo Express)
                        </h2>
                        <p className="text-xs text-indigo-600 font-medium mt-1">Toma notas libres y deja que la IA las ordene. Luego finaliza P3 y P4 en casa.</p>
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
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50 flex flex-col lg:flex-row gap-6">
                    
                    {/* Columna Izquierda: Input */}
                    <div className="flex-1 flex flex-col gap-6">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1">
                            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><span className="text-blue-500">💬</span> Notas de Entrevista (Subjetivo)</h3>
                            <textarea 
                                className="w-full flex-1 bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all mb-4"
                                placeholder="Anota libremente lo que el paciente te cuenta..."
                                value={notasSubjetivas}
                                onChange={e => setNotasSubjetivas(e.target.value)}
                            />

                            <h3 className="font-black text-slate-800 mb-2 flex items-center gap-2"><span className="text-emerald-500">🩺</span> Notas de Examen Físico (Objetivo)</h3>
                            <textarea 
                                className="w-full flex-1 bg-slate-50/50 border border-slate-200 rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-300 transition-all"
                                placeholder="Anota libremente tus hallazgos de evaluación..."
                                value={notasObjetivas}
                                onChange={e => setNotasObjetivas(e.target.value)}
                            />

                            <div className="mt-6 flex justify-center">
                                <button 
                                    onClick={handleAIEstructurar} 
                                    disabled={isAiProcessing || (!notasSubjetivas && !notasObjetivas)}
                                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl shadow-md w-full flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                >
                                    {isAiProcessing ? 'Procesando con IA...' : '✨ Estructurar Notas con IA'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Columna Derecha: IA Feedback */}
                    <div className="flex-1 flex flex-col gap-6">
                        
                        {/* Box de Grounding */}
                        <div className="bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl border border-indigo-100 shadow-sm shrink-0">
                            <h3 className="font-black text-indigo-900 mb-2 flex items-center gap-2">🔍 Consultar Web (Google Grounding)</h3>
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Fármaco, patología, escala..."
                                    value={groundingQuery}
                                    onChange={e => setGroundingQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAIGrounding()}
                                />
                                <button 
                                    onClick={handleAIGrounding} 
                                    disabled={isGrounding || !groundingQuery}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 rounded-lg disabled:opacity-50"
                                >
                                    Buscar
                                </button>
                            </div>
                            {groundingResult && (
                                <div className="mt-4 bg-white p-3 rounded-xl border border-indigo-100 text-sm">
                                    <p className="text-slate-700 font-medium whitespace-pre-line">{groundingResult.respuesta}</p>
                                    {groundingResult.fuentes_utilizadas && groundingResult.fuentes_utilizadas.length > 0 && (
                                        <div className="mt-2 text-xs text-indigo-400">
                                            Fuentes: {groundingResult.fuentes_utilizadas.join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Box de Estructuración (Coach) */}
                        <div className="bg-slate-100 p-1 md:p-5 rounded-2xl flex-1 overflow-y-auto">
                            {!structuredResult && !isAiProcessing && (
                                <div className="h-full flex items-center justify-center text-slate-400 text-sm font-medium text-center bg-white rounded-xl border border-dashed border-slate-300 p-8">
                                    Presiona "Estructurar Notas con IA" para limpiar tus apuntes y recibir tu Análisis Clínico (SINS, Hipótesis y Preguntas Faltantes).
                                </div>
                            )}
                            
                            {isAiProcessing && (
                                <div className="h-full flex flex-col items-center justify-center text-indigo-500 font-bold bg-white rounded-xl border border-indigo-100 p-8 shadow-sm">
                                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                                    Analizando clínicamente tus apuntes...
                                </div>
                            )}
                            
                            {structuredResult && (
                                <div className="space-y-4">
                                    {/* 1. Alertas Docentes (Coach) */}
                                    {structuredResult.sugerenciasFaltantes && structuredResult.sugerenciasFaltantes.length > 0 && (
                                        <div className="bg-white border-l-4 border-amber-500 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-amber-800 font-black text-sm flex items-center gap-2 mb-3">
                                                <span>💡</span> Coach Clínico: Evaluaciones Faltantes
                                            </h4>
                                            <div className="space-y-3">
                                                {structuredResult.sugerenciasFaltantes.map((sug: any, i: number) => (
                                                    <div key={i} className="bg-amber-50/50 p-3 rounded-lg">
                                                        <div className="font-bold text-amber-900 text-xs mb-1">Falta: {sug.pregunta}</div>
                                                        <div className="text-amber-700 text-xs">{sug.por_que}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. SINS y Foco */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Foco Principal</h4>
                                            <div className="text-sm font-black text-slate-800 flex items-center gap-2">
                                                <span className="text-blue-500">📍</span> {structuredResult.focoPrincipal}
                                            </div>
                                        </div>
                                        
                                        {structuredResult.sins && (
                                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                                <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-2">Análisis S.I.N.S</h4>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    <div><span className="text-slate-400 font-medium">Severidad:</span> <strong className="text-slate-700">{structuredResult.sins.severidad}</strong></div>
                                                    <div><span className="text-slate-400 font-medium">Irritabilidad:</span> <strong className="text-slate-700">{structuredResult.sins.irritabilidad}</strong></div>
                                                    <div><span className="text-slate-400 font-medium">Naturaleza:</span> <strong className="text-slate-700">{structuredResult.sins.naturaleza}</strong></div>
                                                    <div><span className="text-slate-400 font-medium">Estadio:</span> <strong className="text-slate-700">{structuredResult.sins.estadio}</strong></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 3. Hipótesis */}
                                    {structuredResult.hipotesis_orientativas && structuredResult.hipotesis_orientativas.length > 0 && (
                                        <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                                            <h4 className="text-indigo-800 font-black text-sm flex items-center gap-2 mb-3">
                                                <span>🎯</span> Hipótesis Orientativas
                                            </h4>
                                            <div className="space-y-3">
                                                {structuredResult.hipotesis_orientativas.map((hip: any, i: number) => (
                                                    <div key={i} className="flex gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black shrink-0">{i+1}</div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-xs mb-0.5">{hip.titulo}</div>
                                                            <div className="text-slate-600 text-[11px] leading-relaxed">{hip.fundamento}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 4. Resumen Limpio */}
                                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
                                        <div>
                                            <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">Entrevista (Subjetivo)</h4>
                                            <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                                {structuredResult.relatoEstructurado}
                                            </div>
                                        </div>
                                        {structuredResult.anamnesisRemota && structuredResult.anamnesisRemota !== "Sin datos registrados" && (
                                            <div className="pt-3 border-t border-slate-100">
                                                <h4 className="text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-1">Antecedentes</h4>
                                                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                                    {structuredResult.anamnesisRemota}
                                                </div>
                                            </div>
                                        )}
                                        <div className="pt-3 border-t border-slate-100">
                                            <h4 className="text-emerald-500 font-bold text-[10px] uppercase tracking-wider mb-1">Examen Físico (Objetivo)</h4>
                                            <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                                {structuredResult.examenFisico}
                                            </div>
                                        </div>
                                    </div>
                                    
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
