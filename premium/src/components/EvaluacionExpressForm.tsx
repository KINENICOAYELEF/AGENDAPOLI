import React, { useState, useEffect } from "react";
import { Evaluacion, EvaluacionInicial } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";
import { ClinicalPlanningSection } from "./ClinicalPlanningSection";

export interface EvaluacionExpressFormProps {
    usuariaId: string;
    procesoId: string;
    initialData: Evaluacion | null;
    onClose: () => void;
    onSaveSuccess: (evaluacion: Evaluacion, isNew: boolean) => void;
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export function BeautifulClinicalMarkdown({ text }: { text: string }) {
    if (!text) return null;

    const sections: { title: string; contentLines: string[] }[] = [];
    let currentSection: { title: string; contentLines: string[] } | null = null;

    text.split('\n').forEach(line => {
        if (line.startsWith('## ')) {
            currentSection = {
                title: line.replace('## ', '').trim(),
                contentLines: []
            };
            sections.push(currentSection);
        } else if (currentSection) {
            currentSection.contentLines.push(line);
        } else {
            if (line.trim()) {
                currentSection = {
                    title: 'Orientación General',
                    contentLines: [line]
                };
                sections.push(currentSection);
            }
        }
    });

    const getBorderColor = (title: string) => {
        const t = title.toLowerCase();
        if (t.includes('feedback') || t.includes('entrevista')) return 'border-t-blue-500';
        if (t.includes('análisis') || t.includes('fenotipificación')) return 'border-t-indigo-600';
        if (t.includes('plan de evaluación') || t.includes('densidad')) return 'border-t-emerald-600';
        if (t.includes('seguridad') || t.includes('banderas rojas')) return 'border-t-amber-500';
        if (t.includes('evaluación integral') || t.includes('coexistentes')) return 'border-t-purple-600';
        if (t.includes('escalas') || t.includes('cuestionarios') || t.includes('proms')) return 'border-t-teal-600';
        if (t.includes('indicadores') || t.includes('sesión') || t.includes('sesiones')) return 'border-t-emerald-500';
        return 'border-t-slate-600';
    };

    return (
        <div className="space-y-6 text-slate-700">
            {sections.map((sec, sIdx) => {
                const isPlanSection = sec.title.toLowerCase().includes('plan de evaluación') || sec.title.toLowerCase().includes('alta densidad');
                
                let contentNode: React.ReactNode = null;

                if (isPlanSection) {
                    const pasos: any[] = [];
                    let currentPaso: any = null;
                    let lastAttribute: string | null = null;

                    sec.contentLines.forEach(line => {
                        const trimmed = line.trim();
                        if (trimmed.startsWith('- Paso ')) {
                            if (currentPaso) pasos.push(currentPaso);
                            currentPaso = {
                                header: trimmed.replace(/^- /, ''),
                                bateria: '',
                                justificacion: '',
                                interdependencia: '',
                                interpretacion: '',
                                otherLines: []
                            };
                            lastAttribute = null;
                        } else if (currentPaso) {
                            if (trimmed.startsWith('- Batería:') || trimmed.startsWith('Batería:')) {
                                currentPaso.bateria = trimmed.replace(/^-? ?Batería:/, '').trim();
                                lastAttribute = 'bateria';
                            } else if (trimmed.startsWith('- Justificación:') || trimmed.startsWith('Justificación:')) {
                                currentPaso.justificacion = trimmed.replace(/^-? ?Justificación:/, '').trim();
                                lastAttribute = 'justificacion';
                            } else if (trimmed.startsWith('- Interdependencia Regional:') || trimmed.startsWith('Interdependencia Regional:') || trimmed.startsWith('- Interdependencia:') || trimmed.startsWith('Interdependencia:')) {
                                currentPaso.interdependencia = trimmed.replace(/^-? ?Interdependencia( Regional)?:/, '').trim();
                                lastAttribute = 'interdependencia';
                            } else if (trimmed.startsWith('- Interpretación:') || trimmed.startsWith('Interpretación:')) {
                                currentPaso.interpretacion = trimmed.replace(/^-? ?Interpretación:/, '').trim();
                                lastAttribute = 'interpretacion';
                            } else if (trimmed) {
                                if (lastAttribute === 'bateria') currentPaso.bateria += ' ' + trimmed;
                                else if (lastAttribute === 'justificacion') currentPaso.justificacion += ' ' + trimmed;
                                else if (lastAttribute === 'interdependencia') currentPaso.interdependencia += ' ' + trimmed;
                                else if (lastAttribute === 'interpretacion') currentPaso.interpretacion += ' ' + trimmed;
                                else currentPaso.otherLines.push(line);
                            }
                        }
                    });
                    if (currentPaso) pasos.push(currentPaso);

                    contentNode = (
                        <div className="mt-4 space-y-4">
                            {pasos.map((paso, pIdx) => (
                                <div key={pIdx} className="bg-white border border-slate-200/80 rounded-xl p-4 transition-all hover:shadow-xs shadow-2xs">
                                    <div className="font-bold text-slate-900 text-xs border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0"></span>
                                        <span>{paso.header}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {paso.bateria && (
                                            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100/80">
                                                <span className="font-black text-[10px] uppercase tracking-wider text-indigo-600 block mb-1">Batería de Pruebas</span>
                                                <span className="text-xs text-slate-700 leading-relaxed font-medium">{paso.bateria}</span>
                                            </div>
                                        )}
                                        {paso.justificacion && (
                                            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100/80">
                                                <span className="font-black text-[10px] uppercase tracking-wider text-emerald-600 block mb-1">Justificación</span>
                                                <span className="text-xs text-slate-700 leading-relaxed">{paso.justificacion}</span>
                                            </div>
                                        )}
                                        {paso.interdependencia && (
                                            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100/80">
                                                <span className="font-black text-[10px] uppercase tracking-wider text-amber-600 block mb-1">Interdependencia Regional</span>
                                                <span className="text-xs text-slate-700 leading-relaxed">{paso.interdependencia}</span>
                                            </div>
                                        )}
                                        {paso.interpretacion && (
                                            <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-100/80">
                                                <span className="font-black text-[10px] uppercase tracking-wider text-purple-600 block mb-1">Interpretación</span>
                                                <span className="text-xs text-slate-700 leading-relaxed">{paso.interpretacion}</span>
                                            </div>
                                        )}
                                    </div>
                                    {paso.otherLines && paso.otherLines.length > 0 && (
                                        <div className="mt-2 text-[11px] text-slate-500">
                                            {paso.otherLines.map((ol: string, oIdx: number) => <p key={oIdx}>{ol}</p>)}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    );
                } else {
                    contentNode = (
                        <div className="mt-2 text-slate-700 leading-relaxed space-y-2">
                            {sec.contentLines.map((line, idx) => {
                                const trimmed = line.trim();
                                if (!trimmed) return <div key={idx} className="h-1" />;
                                if (trimmed.startsWith('### ')) {
                                    return <h4 key={idx} className="text-xs font-black text-slate-900 mt-5 mb-2 uppercase tracking-wider border-b border-slate-100 pb-1.5">{trimmed.replace('### ', '')}</h4>;
                                }
                                if (trimmed.startsWith('- Fenotipo de Dolor Dominante:')) {
                                    return (
                                        <div key={idx} className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 my-2.5">
                                            <span className="font-black text-indigo-900 block text-[10px] uppercase tracking-wider mb-0.5">Fenotipo de Dolor Dominante</span>
                                            <span className="text-indigo-950 font-bold text-xs">{trimmed.replace('- Fenotipo de Dolor Dominante:', '').trim()}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Breve justificación:')) {
                                    return (
                                        <div key={idx} className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border-l-2 border-slate-300 mb-3 font-medium">
                                            <span className="font-bold text-slate-800 block text-[10px] uppercase tracking-wider mb-0.5">Justificación del Fenotipo</span>
                                            {trimmed.replace('- Breve justificación:', '').trim()}
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Hallazgo en Anamnesis Remota/Contexto:')) {
                                    return (
                                        <div key={idx} className="bg-purple-50/50 border border-purple-100 rounded-t-xl p-3 mt-3 text-xs">
                                            <span className="font-black text-purple-900 block text-[10px] uppercase tracking-wider mb-0.5">Hallazgo de Contexto</span>
                                            <span className="text-slate-800 font-bold">{trimmed.replace('- Hallazgo en Anamnesis Remota/Contexto:', '').trim()}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Riesgo Clínico Subyacente:')) {
                                    return (
                                        <div key={idx} className="bg-purple-50/30 border-x border-purple-100 px-3 py-2 text-xs">
                                            <span className="font-black text-purple-800 block text-[10px] uppercase tracking-wider mb-0.5">Riesgo Subyacente</span>
                                            <span className="text-slate-700">{trimmed.replace('- Riesgo Clínico Subyacente:', '').trim()}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Recomendación de Evaluación Extra:')) {
                                    return (
                                        <div key={idx} className="bg-purple-50/50 border border-purple-100 rounded-b-xl p-3 mb-3 text-xs">
                                            <span className="font-black text-purple-900 block text-[10px] uppercase tracking-wider mb-0.5">Evaluación Complementaria Recomendada</span>
                                            <span className="text-slate-800 font-medium">{trimmed.replace('- Recomendación de Evaluación Extra:', '').trim()}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.match(/^[0-9]+\./)) {
                                    const match = trimmed.match(/^([0-9]+\.)(.*)/);
                                    const num = match ? match[1] : '';
                                    const rest = match ? match[2] : trimmed;
                                    return (
                                        <div key={idx} className="flex gap-2.5 mt-3.5 mb-1.5 items-start">
                                            <span className="bg-slate-200 text-slate-800 font-black text-[10px] px-1.5 py-0.5 rounded shrink-0 mt-0.5">{num}</span>
                                            <span className="text-xs font-bold text-slate-800">{rest.trim()}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Fundamento:') || trimmed.startsWith('- Justificación:')) {
                                    const prefixMatch = trimmed.match(/^- (Fundamento:|Justificación:)(.*)/);
                                    const label = prefixMatch ? prefixMatch[1] : '';
                                    const content = prefixMatch ? prefixMatch[2] : trimmed;
                                    return (
                                        <div key={idx} className="ml-6 pl-3 border-l-2 border-indigo-400 text-xs text-slate-600 py-1.5 my-1.5 bg-slate-50/50 rounded-r font-medium">
                                            <strong className="text-slate-700 font-bold">{label} </strong>
                                            {content.trim()}
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Corto Plazo')) {
                                    const content = trimmed.replace(/^- Corto Plazo[^:]*:/, '').trim();
                                    return (
                                        <div key={idx} className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-3.5 my-2.5">
                                            <span className="font-black text-emerald-800 block text-[10px] uppercase tracking-wider mb-1">Corto Plazo (1 a 3 sesiones)</span>
                                            <span className="text-slate-700 text-xs font-medium leading-relaxed">{content}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- Mediano Plazo')) {
                                    const content = trimmed.replace(/^- Mediano Plazo[^:]*:/, '').trim();
                                    return (
                                        <div key={idx} className="bg-blue-50/40 border border-blue-100 rounded-xl p-3.5 my-2.5">
                                            <span className="font-black text-blue-800 block text-[10px] uppercase tracking-wider mb-1">Mediano Plazo (3 a 6 semanas)</span>
                                            <span className="text-slate-700 text-xs font-medium leading-relaxed">{content}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('- ')) {
                                    return (
                                        <div key={idx} className="flex gap-2 mb-1.5 ml-2 text-xs items-start">
                                            <span className="w-1 h-1 rounded-full bg-indigo-500 shrink-0 mt-2"></span>
                                            <span className="text-slate-600 font-medium">{trimmed.replace(/^- /, '')}</span>
                                        </div>
                                    );
                                }
                                if (trimmed.startsWith('“') || trimmed.startsWith('"')) {
                                    return <p key={idx} className="italic text-slate-500 text-xs mt-3 border-l-2 border-slate-300 pl-3 py-0.5">{trimmed}</p>;
                                }
                                return <p key={idx} className="text-xs text-slate-700 mb-1 leading-relaxed font-medium">{line}</p>;
                            })}
                        </div>
                    );
                }

                return (
                    <div key={sIdx} className={`bg-white rounded-2xl shadow-xs border border-slate-200/60 overflow-hidden border-t-4 ${getBorderColor(sec.title)}`}>
                        <div className="bg-slate-50/50 px-5 py-3 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{sec.title}</h3>
                        </div>
                        <div className="p-5">
                            {contentNode}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}


export function EvaluacionExpressForm({ usuariaId, procesoId, initialData, onClose, onSaveSuccess }: EvaluacionExpressFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();
    
    const isEditMode = !!initialData;
    const [loading, setLoading] = useState(false);
    const [savingDraft, setSavingDraft] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    const [isPlannerLoading, setIsPlannerLoading] = useState(false);
    const [plannerResult, setPlannerResult] = useState<string | null>(null);
    const [isGrounding, setIsGrounding] = useState(false);
    const [isEditingIA, setIsEditingIA] = useState(false);

    const initialDataAny = initialData as any;

    // State for the 3 text areas and AI output
    const [anamnesisProxima, setAnamnesisProxima] = useState(initialDataAny?.expressDraft?.anamnesisProxima || initialDataAny?.expressDraft?.notasSubjetivas || '');
    const [anamnesisRemota, setAnamnesisRemota] = useState(initialDataAny?.expressDraft?.anamnesisRemota || '');
    const [evaluacionFisica, setEvaluacionFisica] = useState(initialDataAny?.expressDraft?.evaluacionFisica || initialDataAny?.expressDraft?.notasObjetivas || '');
    const [razonamientoIA, setRazonamientoIA] = useState(initialDataAny?.expressDraft?.razonamientoIA || initialDataAny?.expressDraft?.structuredResult || '');

    const [groundingQuery, setGroundingQuery] = useState('');
    const [groundingResult, setGroundingResult] = useState<any>(null);

    const [persistentDocId] = useState(() => initialData?.id || generateId());

    // ===== P3/P4 CLINICAL PLANNING STATE =====
    const initP4 = initialDataAny?.expressDraft?.p4_plan || {};
    const [diagnosticoNarrativo, setDiagnosticoNarrativo] = useState(initP4.diagnostico_narrativo || '');
    const [objetivoGeneral, setObjetivoGeneral] = useState<any>(initP4.objetivo_general || { problema_principal_caso: '', opciones_sugeridas: [], seleccionado: '' });
    const [objetivosSmart, setObjetivosSmart] = useState<Array<{id: string, texto: string, plazo: string, prioridad: string, variable_base: string, basal: string, meta: string}>>(
        initP4.objetivos_smart || []
    );
    const [pronostico, setPronostico] = useState<{
        corto_plazo: string; mediano_plazo: string; largo_plazo: string;
        factores_a_favor: string[]; factores_en_contra: string[];
        historia_natural: string; comparativa_adherencia: string;
        categoria: string; justificacion: string;
    }>(initP4.pronostico || {
        corto_plazo: '', mediano_plazo: '', largo_plazo: '',
        factores_a_favor: [], factores_en_contra: [],
        historia_natural: '', comparativa_adherencia: '',
        categoria: '', justificacion: ''
    });
    const [fases, setFases] = useState<any[]>(initP4.fases_rehabilitacion || []);
    const [reglasReeval, setReglasReeval] = useState<any>(initP4.reglas_reevaluacion || {
        metrica_subjetiva: '', metrica_objetiva: '',
        metrica_funcional_participacion: '', criterio_estancamiento: ''
    });
    const [clasificacionDolor, setClasificacionDolor] = useState<any>(
        initP4.clasificacion_dolor || { categoria: '', subtipo: '', fundamento: '', confianza: '', duda_y_descarte: '' }
    );
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishSuccess, setPublishSuccess] = useState(false);
    const [p4Collapsed, setP4Collapsed] = useState<Record<string, boolean>>({});

    const handleSave = async (silent = false, isDraft = false) => {
        if (!globalActiveYear || !user) return;
        try {
            if (isDraft) setSavingDraft('saving');
            else if (!silent) setLoading(true);
            const targetId = persistentDocId;

            const basePayload: any = initialData ? { ...initialData } : {
                id: targetId,
                usuariaId,
                procesoId,
                type: 'INITIAL',
                status: 'DRAFT',
                sessionAt: new Date().toISOString(),
                clinicianResponsible: user.email || '',
                audit: { createdBy: user.uid, createdAt: new Date().toISOString() }
            };

            basePayload.expressDraft = { 
                anamnesisProxima, 
                anamnesisRemota, 
                evaluacionFisica, 
                razonamientoIA,
                p4_plan: {
                    diagnostico_narrativo: diagnosticoNarrativo,
                    objetivo_general: objetivoGeneral,
                    objetivos_smart: objetivosSmart,
                    pronostico,
                    fases_rehabilitacion: fases,
                    reglas_reevaluacion: reglasReeval,
                    clasificacion_dolor: clasificacionDolor
                }
            };

            // Inject to regular evaluation so they can continue later
            if (razonamientoIA) {
                if (!basePayload.interview) basePayload.interview = { v4: { focos: [] } };
                if (!basePayload.interview.v4) basePayload.interview.v4 = { focos: [] };
                if (basePayload.interview.v4.focos.length === 0) {
                    basePayload.interview.v4.focos.push({
                        id: generateId(),
                        isPrincipal: true,
                        region: "Definido por IA",
                        notaRapida: razonamientoIA
                    });
                } else {
                    basePayload.interview.v4.focos[0].notaRapida = razonamientoIA;
                }
            }

            const docRef = doc(db, "programs", globalActiveYear, "evaluaciones", targetId);
            await setDoc(docRef, sanitizeForFirestoreDeep(basePayload), { merge: true });

            if (isDraft) {
                setSavingDraft('saved');
                setTimeout(() => setSavingDraft('idle'), 2000);
            } else if (!silent) {
                if (onSaveSuccess) onSaveSuccess(basePayload, !isEditMode);
            }
        } catch (error: any) {
            console.error("Error saving Express Evaluation:", error);
            if (!silent && !isDraft) alert("Error al guardar: " + error.message);
            if (isDraft) setSavingDraft('idle');
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Auto-save (includes P4 data)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (anamnesisProxima || anamnesisRemota || evaluacionFisica || razonamientoIA || diagnosticoNarrativo || objetivosSmart.length > 0) handleSave(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [anamnesisProxima, anamnesisRemota, evaluacionFisica, razonamientoIA, diagnosticoNarrativo, objetivoGeneral, objetivosSmart, pronostico, fases, reglasReeval, clasificacionDolor]);

    // Publish objectives to Proceso.activeObjectiveSet
    const handlePublishObjectives = async () => {
        if (!globalActiveYear || !user || !procesoId) return;
        if (objetivosSmart.length === 0) return alert("Agrega al menos un objetivo SMART antes de publicar.");
        setIsPublishing(true);
        try {
            // First save current state
            await handleSave(true);
            const versionId = `v2_${Date.now().toString(36)}`;
            const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
            const updatePayload = sanitizeForFirestoreDeep({
                estado: 'ACTIVO',
                activeEvaluationId: persistentDocId,
                activeEvaluationIndexId: persistentDocId,
                activeObjectiveSetVersionId: versionId,
                diagnosisVigente: diagnosticoNarrativo,
                caseSnapshot: {
                    summary: diagnosticoNarrativo,
                    diagnosticoNarrativo: diagnosticoNarrativo,
                    lastUpdated: new Date().toISOString(),
                },
                activeObjectiveSet: {
                    versionId,
                    updatedAt: new Date().toISOString(),
                    objectives: objetivosSmart.map(o => ({
                        id: o.id || generateId(),
                        label: o.texto,
                        status: 'activo' as const
                    }))
                },
                updatedAt: new Date().toISOString()
            });
            await setDoc(procesoRef, updatePayload, { merge: true });
            setPublishSuccess(true);
            setTimeout(() => setPublishSuccess(false), 4000);
        } catch (err: any) {
            alert("Error publicando objetivos: " + err.message);
        } finally {
            setIsPublishing(false);
        }
    };

    const handleRazonarIA = async () => {
        if (!anamnesisProxima && !anamnesisRemota && !evaluacionFisica) return alert("Escribe algo primero en las notas.");
        setIsAiProcessing(true);
        try {
            const res = await fetch('/api/ai/express-structure', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ anamnesisProxima, anamnesisRemota, evaluacionFisica, userId: user?.uid })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error AI');
            // The API now returns standard markdown text
            setRazonamientoIA(data.data);
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

    const handlePlanEval = async () => {
        if (!anamnesisProxima && !anamnesisRemota) return alert("Registra la anamnesis primero para planificar la evaluación.");
        setIsPlannerLoading(true);
        setPlannerResult(null);
        try {
            const res = await fetch('/api/ai/eval-planner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ anamnesisProxima, anamnesisRemota })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Error AI Planner');
            setPlannerResult(data.data);
        } catch (e: any) {
            alert("Error en Planificador: " + e.message);
        } finally {
            setIsPlannerLoading(false);
        }
    };

    const [activeFullscreen, setActiveFullscreen] = useState<'anamnesisProxima' | 'anamnesisRemota' | 'evaluacionFisica' | 'razonamientoIA' | 'plannerResult' | null>(null);
    const [showHelp, setShowHelp] = useState<'anamnesisProxima' | 'anamnesisRemota' | 'evaluacionFisica' | null>(null);

    const plantillas = {
        anamnesisProxima: `■ MOTIVO DE CONSULTA
[Registrar palabras textuales de la persona. Qué le molesta, qué le preocupa y por qué consulta ahora]

■ OBJETIVO / EXPECTATIVA
[Qué quiere lograr, en qué plazo, qué actividad quiere recuperar y qué espera del tratamiento]

■ CONTEXTO ACTUAL
[Edad, ocupación, deporte/actividad física, nivel de actividad, demandas laborales, familiares o deportivas actuales]

■ INICIO Y EVOLUCIÓN
[Desde cuándo, cómo empezó, si fue traumático/progresivo, si mejora, empeora, fluctúa o está en meseta]

■ MECANISMO O CAMBIO DE CARGA
[Caída, golpe, torsión, sobrecarga, cambio de entrenamiento, aumento de volumen/intensidad, retorno a actividad, cambio laboral o inicio sin causa clara]

■ LOCALIZACIÓN Y EXTENSIÓN
[Zona principal, zonas secundarias, puntual/difuso, superficial/profundo, unilateral/bilateral]

■ IRRADIACIÓN / SÍNTOMAS NEUROLÓGICOS
[Si corre a otra zona, hormigueo, adormecimiento, corriente, pérdida de fuerza, cambios de sensibilidad o sensación extraña]

■ CARÁCTER DEL SÍNTOMA
[Punzante, quemante, eléctrico, opresivo, tirantez, rigidez, pesadez, bloqueo, inestabilidad, fatiga, debilidad]

■ INTENSIDAD
[Actual / peor 24 h / mejor 24 h / durante la actividad más limitante]

■ COMPORTAMIENTO MECÁNICO
[Qué movimientos, posiciones, cargas, gestos o repeticiones lo aumentan, reducen o reproducen]

■ ATENUANTES Y AGRAVANTES
[Qué lo mejora y qué lo empeora: reposo, movimiento, carga, calor/frío, sueño, estrés, medicamentos, entrenamiento]

■ COMPORTAMIENTO 24 HORAS
[Mañana, tarde/noche, después de actividad, al día siguiente, rigidez matinal, despertar nocturno, sueño reparador/no reparador]

■ SEVERIDAD FUNCIONAL
[Qué no puede hacer o evita: AVD, trabajo, deporte, entrenamiento, sueño, vida social, participación familiar]

■ IRRITABILIDAD
[Qué tan fácil se gatilla, cuánto demora en calmarse, si deja “rastro” después y cuánto dura]

■ MANEJO PREVIO Y RESPUESTA
[Medicamentos, reposo, kinesiterapia previa, ejercicios, infiltraciones, imágenes, automanejo y respuesta]

■ CREENCIAS / PREOCUPACIONES
[Qué cree que tiene, qué cree que lo causó, qué teme, qué cree que pasaría si se mueve o carga]

■ SEGURIDAD CLÍNICA
[Trauma importante, fiebre, baja de peso, dolor nocturno no mecánico, síntomas neurológicos progresivos, alteración esfinteriana, antecedentes oncológicos, infección, mareos severos, síntomas vasculares u otros signos de alerta]

■ NOTAS RELEVANTES
[Información libre que no calza en los campos anteriores]`,
        anamnesisRemota: `■ ANTECEDENTES MÉDICOS
[Enfermedades relevantes, condiciones crónicas, cardiovasculares, metabólicas, reumatológicas, neurológicas, hormonales u otras]

■ ANTECEDENTES MUSCULOESQUELÉTICOS
[Lesiones previas, dolores recurrentes, cirugías, fracturas, esguinces, luxaciones, episodios similares y recuperación]

■ MEDICAMENTOS Y PRECAUCIONES
[Medicamentos actuales, anticoagulantes, corticoides, analgésicos, antiinflamatorios, automedicación, osteoporosis, embarazo, prótesis, hiperlaxitud u otras precauciones]

■ EXÁMENES / IMÁGENES / DIAGNÓSTICOS PREVIOS
[Rx, RM, ecografía, TAC, laboratorio, EMG, diagnóstico médico, fecha y relación clínica con el problema actual]

■ HISTORIA DE TRATAMIENTOS
[Qué tratamientos tuvo, qué funcionó, qué no funcionó, adherencia, experiencias negativas o positivas]

■ PERFIL DE ACTIVIDAD FÍSICA / DEPORTE
[Deporte, frecuencia, volumen, intensidad, años de práctica, nivel, superficie, calzado, temporada, competencia cercana, cambios recientes]

■ CONTEXTO LABORAL / ACADÉMICO
[Tipo de trabajo, posturas, carga física, horas, turnos, pausas, estrés laboral, licencia, posibilidad de modificar tareas]

■ SUEÑO Y RECUPERACIÓN
[Horas, calidad, despertares, descanso percibido, fatiga, recuperación post entrenamiento o post jornada]

■ HÁBITOS GENERALES
[Actividad física fuera del deporte, sedentarismo, alimentación general, hidratación, tabaco, alcohol u otros factores relevantes]

■ ESTADO EMOCIONAL Y ESTRÉS
[Estrés sostenido, ansiedad, ánimo bajo, frustración, miedo, preocupación, eventos vitales relevantes]

■ RED DE APOYO Y CONTEXTO SOCIAL
[Con quién vive, quién lo ayuda, cuidador principal si aplica, apoyo familiar, aislamiento, responsabilidades de cuidado, barreras económicas, traslado, tiempo disponible]

■ ADULTO MAYOR / FRAGILIDAD SI APLICA
[Caídas previas, miedo a caer, uso de bastón/andador, independencia en AVD, independencia instrumental, vive solo/a, cuidador, polifarmacia, mareos, pérdida de peso, deterioro cognitivo sospechado]

■ FACTORES CONTEXTUALES RELEVANTES
[Barreras de acceso, distancia, transporte, adherencia probable, apoyo del entorno, presión laboral/deportiva/familiar]

■ NOTAS REMOTAS RELEVANTES
[Información libre relevante para interpretar el caso]`,
        evaluacionFisica: `■ SÍNTOMA BASE PREVIO
[Dolor/síntoma actual, ubicación, intensidad, fatiga, confianza, irritabilidad antes de evaluar]

■ OBSERVACIÓN GENERAL
[Postura, marcha, protección, actitud frente al movimiento, asimetrías, edema, cambios de color, cicatrices, atrofia]

■ TAREA FUNCIONAL PRINCIPAL
[Sentarse/pararse, caminar, escaleras, agacharse, levantar carga, correr, saltar, lanzar, patear, gesto laboral o deportivo relevante]

■ MOVIMIENTO ACTIVO
[Rango, calidad, dolor, rigidez, compensaciones, miedo, velocidad, control, reproducción del síntoma]

■ MOVIMIENTO PASIVO
[Rango, dolor, resistencia, sensación terminal, diferencia lado a lado, reproducción del síntoma]

■ MOVIMIENTOS REPETIDOS / SOSTENIDOS
[Respuesta con repetición, acumulación, centralización/periferización si aplica, fatiga, recuperación]

■ FUERZA ISOMÉTRICA
[Músculo/gesto evaluado, ángulo, dolor, fuerza percibida/medida, inhibición, diferencia lado a lado]

■ FUERZA DINÁMICA / CAPACIDAD
[Carga, repeticiones, control, velocidad, fatiga, dolor durante, dolor después, tolerancia al volumen]

■ CONTROL MOTOR
[Coordinación, estrategia de movimiento, rigidez protectora, control lumbopélvico, escapular, cadera, rodilla, pie u otra región]

■ PALPACIÓN / SENSIBILIDAD
[Zona sensible, temperatura, edema, tono, dolor a presión, sensibilidad local/difusa, relación con síntoma principal]

■ SCREENING NEUROLÓGICO
[Sensibilidad, fuerza por miotomas, reflejos, coordinación, signos de déficit neurológico o progresión]

■ PRUEBAS NEURODINÁMICAS SI APLICA
[Test usado, respuesta, diferenciación estructural, comparación lado a lado, reproducción del síntoma]

■ TESTS ORTOPÉDICOS / CLUSTERS
[Test usados solo según hipótesis, resultado, si reproduce el síntoma, si cambia o no la toma de decisiones]

■ CONTRIBUYENTES REGIONALES
[Regiones vecinas que podrían influir: columna, cadera, tobillo, pie, tórax, hombro, cuello, etc.]

■ PRUEBAS FUNCIONALES / DEPORTIVAS
[Prueba usada, rendimiento, dolor, asimetría, confianza, tolerancia, limitante principal]

■ MEDIDAS DE RESULTADO
[PSFS, NRS/EVA, LEFS, QuickDASH, NDI, ODI, VISA, KOOS u otra escala usada]

■ RESPUESTA POST EVALUACIÓN
[Cambio del síntoma, fatiga, irritabilidad posterior, tolerancia general, signos de alerta durante/después]

■ HALLAZGOS PRINCIPALES
[Qué hallazgos sí explican el problema, qué hallazgos no calzan, qué falta evaluar]`
    };

    const handleInsertTemplate = (type: 'anamnesisProxima' | 'anamnesisRemota' | 'evaluacionFisica') => {
        if (type === 'anamnesisProxima') {
            setAnamnesisProxima((prev: string) => prev ? prev + '\n\n' + plantillas.anamnesisProxima : plantillas.anamnesisProxima);
        } else if (type === 'anamnesisRemota') {
            setAnamnesisRemota((prev: string) => prev ? prev + '\n\n' + plantillas.anamnesisRemota : plantillas.anamnesisRemota);
        } else {
            setEvaluacionFisica((prev: string) => prev ? prev + '\n\n' + plantillas.evaluacionFisica : plantillas.evaluacionFisica);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-center items-end md:items-center">
            {activeFullscreen && (
                <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in slide-in-from-bottom-5">
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
                        <h3 className="font-black text-slate-800 flex items-center gap-2">
                            {activeFullscreen === 'anamnesisProxima' && <><span className="text-blue-500">💬</span> Anamnesis Próxima</>}
                            {activeFullscreen === 'anamnesisRemota' && <><span className="text-purple-500">📚</span> Anamnesis Remota / Contexto</>}
                            {activeFullscreen === 'evaluacionFisica' && <><span className="text-emerald-500">🩺</span> Evaluación Física</>}
                            {activeFullscreen === 'razonamientoIA' && <><span className="text-indigo-500">🤖</span> Razonamiento sugerido por IA</>}
                            {activeFullscreen === 'plannerResult' && <><span className="text-amber-500">💡</span> Recomendación de Evaluación</>}
                        </h3>
                        <div className="flex items-center gap-2">
                            {activeFullscreen !== 'razonamientoIA' && activeFullscreen !== 'plannerResult' && (
                                <button onClick={() => handleInsertTemplate(activeFullscreen)} className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1">
                                    📋 Plantilla
                                </button>
                            )}
                            <button onClick={() => setActiveFullscreen(null)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm">
                                Listo
                            </button>
                        </div>
                    </div>
                    {activeFullscreen === 'plannerResult' ? (
                        <div className="flex-1 w-full overflow-y-auto p-4 md:p-8 bg-slate-50/60">
                            <div className="max-w-4xl mx-auto">
                                <BeautifulClinicalMarkdown text={plannerResult || ''} />
                            </div>
                        </div>
                    ) : (
                        <textarea 
                            autoFocus
                            className="flex-1 w-full p-6 text-base resize-none focus:outline-none bg-white leading-relaxed text-slate-700"
                            placeholder="Anota libremente..."
                            value={
                                activeFullscreen === 'anamnesisProxima' ? anamnesisProxima :
                                activeFullscreen === 'anamnesisRemota' ? anamnesisRemota :
                                activeFullscreen === 'evaluacionFisica' ? evaluacionFisica :
                                razonamientoIA || ''
                            }
                            onChange={e => {
                                if (activeFullscreen === 'anamnesisProxima') setAnamnesisProxima(e.target.value);
                                else if (activeFullscreen === 'anamnesisRemota') setAnamnesisRemota(e.target.value);
                                else if (activeFullscreen === 'evaluacionFisica') setEvaluacionFisica(e.target.value);
                                else if (activeFullscreen === 'razonamientoIA') setRazonamientoIA(e.target.value);
                            }}
                        />
                    )}
                </div>
            )}

            <div className="bg-white w-full md:max-w-5xl md:h-[90vh] h-[95vh] md:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-indigo-900 flex items-center gap-2">
                            <span>⚡</span> Evaluación Inicial v2
                        </h2>
                        <p className="text-xs text-indigo-600 font-medium mt-1">Toma notas libres y deja que la IA razone las hipótesis.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button onClick={() => handleSave(false, true)} disabled={savingDraft === 'saving'} className={`px-3 py-2 border rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 ${savingDraft === 'saved' ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-indigo-200 hover:bg-indigo-50 text-indigo-700'}`}>
                            {savingDraft === 'saving' ? (<><div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> Guardando...</>) : savingDraft === 'saved' ? (<><span>✅</span> Guardado</>) : (<><span>💾</span> Guardar Borrador</>)}
                        </button>
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
                                {/* Anamnesis Próxima */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <span className="text-blue-500">💬</span> Anamnesis Próxima
                                            </label>
                                            <div className="relative">
                                                <button onClick={() => setShowHelp(showHelp === 'anamnesisProxima' ? null : 'anamnesisProxima')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">?</button>
                                                {showHelp === 'anamnesisProxima' && (
                                                    <div className="absolute z-50 mt-2 w-[85vw] max-w-sm -left-4 md:left-auto md:-right-2 p-4 bg-slate-800 text-slate-100 text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 leading-relaxed">
                                                        <strong className="text-white block mb-2 text-sm border-b border-slate-600 pb-1">💡 Tips Clínicos:</strong>
                                                        <p className="text-slate-300">Registra motivo de consulta, S.I.N.S.S, comportamiento del síntoma 24h, mapa de dolor y factores agravantes/mitigantes.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleInsertTemplate('anamnesisProxima')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors">
                                                📋 Plantilla
                                            </button>
                                            <button onClick={() => setActiveFullscreen('anamnesisProxima')} className="text-xs text-indigo-500 font-bold hover:text-indigo-700 md:hidden flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-300 transition-all shadow-inner"
                                        placeholder="Anota libremente la historia del paciente..."
                                        rows={5}
                                        value={anamnesisProxima}
                                        onChange={e => setAnamnesisProxima(e.target.value)}
                                        onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('anamnesisProxima') }}
                                    />
                                </div>

                                {/* Anamnesis Remota */}
                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <span className="text-purple-500">📚</span> Anamnesis Remota / Contexto
                                            </label>
                                            <div className="relative">
                                                <button onClick={() => setShowHelp(showHelp === 'anamnesisRemota' ? null : 'anamnesisRemota')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">?</button>
                                                {showHelp === 'anamnesisRemota' && (
                                                    <div className="absolute z-50 mt-2 w-[85vw] max-w-sm -left-4 md:left-auto md:-right-2 p-4 bg-slate-800 text-slate-100 text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 leading-relaxed">
                                                        <strong className="text-white block mb-2 text-sm border-b border-slate-600 pb-1">💡 Tips Clínicos:</strong>
                                                        <p className="text-slate-300">Antecedentes médicos, cirugías, fármacos, nivel de actividad física, sueño, estrés, red de apoyo y banderas rojas/amarillas.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleInsertTemplate('anamnesisRemota')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors">
                                                📋 Plantilla
                                            </button>
                                            <button onClick={() => setActiveFullscreen('anamnesisRemota')} className="text-xs text-purple-500 font-bold hover:text-purple-700 md:hidden flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-purple-50 focus:border-purple-300 transition-all shadow-inner"
                                        placeholder="Antecedentes médicos, deporte, estilo de vida..."
                                        rows={4}
                                        value={anamnesisRemota}
                                        onChange={e => setAnamnesisRemota(e.target.value)}
                                        onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('anamnesisRemota') }}
                                    />
                                </div>
                                
                                {/* AI Planner Button and Result */}
                                <div className="pt-4 pb-2">
                                    {!plannerResult ? (
                                        <button 
                                            onClick={handlePlanEval}
                                            disabled={isPlannerLoading || (!anamnesisProxima && !anamnesisRemota)}
                                            className="w-full py-4 border-2 border-dashed border-indigo-200 rounded-2xl text-indigo-600 font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                                        >
                                            {isPlannerLoading ? (
                                                <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
                                            ) : (
                                                <span>💡 Planificar Evaluación con IA (Basado en Anamnesis)</span>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="bg-white border-2 border-indigo-100 rounded-2xl overflow-hidden shadow-sm animate-in zoom-in-95 duration-200">
                                            <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                                                <h4 className="text-xs font-black text-indigo-900 flex items-center gap-2 uppercase tracking-wider">
                                                    <span className="text-base">💡</span> Recomendación de Evaluación
                                                </h4>
                                                <div className="flex gap-2">
                                                    <button onClick={handlePlanEval} className="text-[10px] text-indigo-600 font-bold hover:underline">Recalcular</button>
                                                    <button onClick={() => setPlannerResult(null)} className="text-[10px] text-slate-400 font-bold hover:text-slate-600">Ocultar</button>
                                                </div>
                                            </div>
                                            <div className="p-4 md:p-5 max-h-[500px] overflow-y-auto bg-slate-50/60 backdrop-blur-sm">
                                                <BeautifulClinicalMarkdown text={plannerResult} />
                                            </div>
                                            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex justify-end">
                                                <button onClick={() => setActiveFullscreen('plannerResult')} className="text-[10px] text-indigo-500 font-bold flex items-center gap-1 hover:text-indigo-700">
                                                    Ver en Pantalla Completa
                                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Evaluación Física */}
                                <div className="pt-2">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                                                <span className="text-emerald-500">🩺</span> Evaluación Física
                                            </label>
                                            <div className="relative">
                                                <button onClick={() => setShowHelp(showHelp === 'evaluacionFisica' ? null : 'evaluacionFisica')} className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 flex items-center justify-center text-xs font-bold transition-colors">?</button>
                                                {showHelp === 'evaluacionFisica' && (
                                                    <div className="absolute z-50 mt-2 w-[85vw] max-w-sm -left-4 md:left-auto md:-right-2 p-4 bg-slate-800 text-slate-100 text-xs rounded-xl shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 leading-relaxed">
                                                        <strong className="text-white block mb-2 text-sm border-b border-slate-600 pb-1">💡 Tips Clínicos:</strong>
                                                        <p className="text-slate-300">Prioriza clústers ortopédicos, ROM pasivo/activo, control motor, fuerza (MMT/Dinamometría), neurodinamia y evaluación funcional.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleInsertTemplate('evaluacionFisica')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-1 px-3 rounded-lg flex items-center gap-1 transition-colors">
                                                📋 Plantilla
                                            </button>
                                            <button onClick={() => setActiveFullscreen('evaluacionFisica')} className="text-xs text-emerald-500 font-bold hover:text-emerald-700 md:hidden flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <textarea 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-emerald-50 focus:border-emerald-300 transition-all shadow-inner"
                                        placeholder="Anota libremente tus hallazgos de evaluación..."
                                        rows={5}
                                        value={evaluacionFisica}
                                        onChange={e => setEvaluacionFisica(e.target.value)}
                                        onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('evaluacionFisica') }}
                                    />
                                </div>
                            </div>

                            <div className="mt-8">
                                <button 
                                    onClick={handleRazonarIA} 
                                    disabled={isAiProcessing || (!anamnesisProxima && !anamnesisRemota && !evaluacionFisica)}
                                    className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 px-6 rounded-2xl shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:transform-none disabled:shadow-none"
                                >
                                    {isAiProcessing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Razonando con IA Clínica...
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xl">✨</span> Razonar con IA
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Razonamiento Sugerido por IA */}
                            {razonamientoIA && (
                                <div className="mt-8 pt-8 border-t border-slate-200">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-black text-indigo-900 text-lg flex items-center gap-2">
                                            <span className="text-indigo-500">🤖</span> Razonamiento sugerido por IA
                                        </h4>
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsEditingIA(!isEditingIA)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-xs flex items-center transition-colors">
                                                {isEditingIA ? '👁️ Ver Lectura' : '✏️ Editar'}
                                            </button>
                                            <button onClick={() => setActiveFullscreen('razonamientoIA')} className="text-xs text-indigo-500 font-bold hover:text-indigo-700 md:hidden flex items-center gap-1">
                                                Ampliar
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex gap-3 text-amber-800 text-sm">
                                        <span className="text-xl">⚠️</span>
                                        <p><strong>Aviso:</strong> El razonamiento de IA es solo una orientación clínica y debe ser confirmado, ajustado o descartado por el profesional tratante. <strong>Puedes editar este texto antes de guardar.</strong></p>
                                    </div>

                                    {isEditingIA ? (
                                        <textarea 
                                            className="w-full bg-white border border-indigo-200 rounded-2xl p-6 text-sm resize-none focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 transition-all shadow-inner leading-relaxed text-slate-700"
                                            rows={20}
                                            value={razonamientoIA}
                                            onChange={e => setRazonamientoIA(e.target.value)}
                                            onFocus={() => { if(window.innerWidth < 768) setActiveFullscreen('razonamientoIA') }}
                                        />
                                    ) : (
                                        <div className="w-full bg-slate-50/60 rounded-2xl p-4 md:p-5 text-sm max-h-[600px] overflow-y-auto border border-slate-100">
                                            <BeautifulClinicalMarkdown text={String(razonamientoIA)} />
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>

                        {/* Clinical Planning P3/P4 Section */}
                        <ClinicalPlanningSection
                            clasificacionDolor={clasificacionDolor} setClasificacionDolor={setClasificacionDolor}
                            diagnosticoNarrativo={diagnosticoNarrativo} setDiagnosticoNarrativo={setDiagnosticoNarrativo}
                            objetivoGeneral={objetivoGeneral} setObjetivoGeneral={setObjetivoGeneral}
                            objetivosSmart={objetivosSmart} setObjetivosSmart={setObjetivosSmart}
                            pronostico={pronostico} setPronostico={setPronostico}
                            fases={fases} setFases={setFases}
                            reglasReeval={reglasReeval} setReglasReeval={setReglasReeval}
                            collapsed={p4Collapsed} setCollapsed={setP4Collapsed}
                            onPublish={handlePublishObjectives} isPublishing={isPublishing} publishSuccess={publishSuccess}
                            razonamientoIA={razonamientoIA}
                            anamnesisProxima={anamnesisProxima}
                            anamnesisRemota={anamnesisRemota}
                            evaluacionFisica={evaluacionFisica}
                        />

                    </div>
                </div>
            </div>
        </div>
    );
}
