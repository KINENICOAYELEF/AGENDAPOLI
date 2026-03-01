import React, { useState, useEffect } from "react";
import { Evaluacion, MotivoEvaluacion, Proceso } from "@/types/clinica";
import { doc, getDoc, collection, addDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// RENDER HELPERS PARA ACORDEÓN
const AccordionSection = ({
    title,
    children,
    defaultOpen = false,
    theme = "indigo"
}: {
    title: string,
    children: React.ReactNode,
    defaultOpen?: boolean
    theme?: "indigo" | "emerald" | "amber" | "rose" | "slate"
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={`border rounded-xl mb-4 overflow-hidden bg-white shadow-sm transition-all duration-300`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-5 py-4 font-bold text-left transition-colors bg-slate-50 hover:bg-slate-100 text-slate-800 border-b border-slate-100`}
            >
                <div className="flex items-center gap-2">
                    {title}
                </div>
                <svg className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-5">
                    {children}
                </div>
            </div>
        </div>
    );
};

export interface EvaluacionFormProps {
    usuariaId: string;
    procesoId: string;
    type: 'INITIAL' | 'REEVALUATION';
    initialData: Evaluacion | null;
    onClose: () => void;
    onSaveSuccess: (evaluacion: Evaluacion, isNew: boolean) => void;
}

export function EvaluacionForm({ usuariaId, procesoId, type, initialData, onClose, onSaveSuccess }: EvaluacionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    const isEditMode = !!initialData;
    const [isClosed, setIsClosed] = useState(initialData?.status === 'CLOSED');

    // AI Integration States
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // TEMPORIZADOR CLINICO DOCENTE (Fase 2.2)
    const [secondsElapsed, setSecondsElapsed] = useState(initialData?.timeSpentSeconds || 0);

    useEffect(() => {
        if (isClosed) return;
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isClosed]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const getTimerColor = (secs: number) => {
        if (secs < 1800) return 'text-emerald-600 bg-emerald-50 border-emerald-200'; // Menos de 30 mins
        if (secs < 2700) return 'text-amber-600 bg-amber-50 border-amber-200'; // 30-45 mins
        return 'text-rose-600 bg-rose-50 border-rose-200'; // +45 mins
    };

    // FORM STATE
    const [formData, setFormData] = useState<Partial<Evaluacion>>({
        usuariaId,
        procesoId,
        type,
        status: 'DRAFT',
        sessionAt: new Date().toISOString(),
        motivos: [],
        clinicianResponsible: user?.email || '',
        ...initialData
    });

    const addMotivo = () => {
        const newMotivo: MotivoEvaluacion = {
            id: generateId(),
            motivoLabel: `Motivo ${formData.motivos?.length ? formData.motivos.length + 1 : 1}`,
            region: '',
            lado: 'N/A',
            subjective: {
                mecanismo: '', tiempoEvolucion: '', irritabilidad: 'Media', agravantes: '', alivios: '', limitacionFuncional: '', metasPersonaUsuaria: ''
            },
            redFlagsChecklist: {},
            objectiveMeasures: {
                rom: '', fuerza: '', pruebasEspeciales: '', dolorConPruebas: '', controlMotor: '', textoLibre: ''
            }
        };
        setFormData(prev => ({ ...prev, motivos: [...(prev.motivos || []), newMotivo] }));
    };

    const updateMotivo = (id: string, fieldPath: string, value: any) => {
        setFormData(prev => {
            const nuevos = [...(prev.motivos || [])];
            const idx = nuevos.findIndex(m => m.id === id);
            if (idx === -1) return prev;

            const motivo = { ...nuevos[idx] };
            const keys = fieldPath.split('.');
            if (keys.length === 1) {
                (motivo as any)[keys[0]] = value;
            } else if (keys.length === 2) {
                (motivo as any)[keys[0]] = { ...(motivo as any)[keys[0]], [keys[1]]: value };
            }

            nuevos[idx] = motivo;
            return { ...prev, motivos: nuevos };
        });
    };

    const removeMotivo = (id: string) => {
        if (confirm("¿Eliminar zona a evaluar?")) {
            setFormData(prev => ({ ...prev, motivos: prev.motivos?.filter(m => m.id !== id) }));
        }
    };

    // --- GEMINI AI ASSISTANT ---
    const handleGeminiSuggestEvaluacion = async (actionType: 'generarSintesisEvaluacion' | 'generarDxKinesiologico' | 'generarPlanPronostico') => {
        try {
            setAiLoading(actionType);
            setAiError(null);

            const payloadContext = {
                tipo: type,
                motivosEvaluados: formData.motivos || [],
                // Si es reevaluación podríamos pasar el procesoId para traer contexto histórico,
                // Pero por ahora le pasamos la data actual capturada en los motivos.
            };

            const response = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: actionType, context: payloadContext })
            });

            if (!response.ok) throw new Error("Error en API de Gemini");

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            if (data.result) {
                // Mapear accion a campo state
                if (actionType === 'generarSintesisEvaluacion') setFormData(prev => ({ ...prev, clinicalSynthesis: data.result }));
                if (actionType === 'generarDxKinesiologico') setFormData(prev => ({ ...prev, dxKinesiologico: data.result }));
                if (actionType === 'generarPlanPronostico') setFormData(prev => ({ ...prev, planPronostico: { ...(prev.planPronostico || {} as any), pronosticoTexto: data.result } }));
            }
        } catch (error: any) {
            console.error(error);
            setAiError("La magia falló. Revisa tu conexión u omitamos la sugerencia por ahora.");
        } finally {
            setAiLoading(null);
        }
    };

    const getAiButton = (actionTarget: 'generarSintesisEvaluacion' | 'generarDxKinesiologico' | 'generarPlanPronostico', label: string) => {
        if (isClosed) return null;
        const isLoading = aiLoading === actionTarget;
        return (
            <button
                onClick={(e) => { e.preventDefault(); handleGeminiSuggestEvaluacion(actionTarget); }}
                disabled={isLoading || !!aiLoading}
                className="mt-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm w-fit"
            >
                {isLoading ? (
                    <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                    <span className="text-xl leading-none">✨</span>
                )}
                {label}
            </button>
        );
    };

    // --- OBJECTIVES CRUD ---
    const addObjective = () => {
        const newObj = {
            id: generateId(),
            texto: '',
            tipo: 'Específico' as const,
            medidaAsociada: '',
            criterioExito: ''
        };
        setFormData(prev => {
            const ov = prev.objectivesVersion || { objectiveSetVersionId: '', objectives: [] };
            return {
                ...prev,
                objectivesVersion: {
                    ...ov,
                    objectives: [...(ov.objectives || []), newObj]
                }
            };
        });
    };

    const updateObjective = (idx: number, field: string, value: any) => {
        setFormData(prev => {
            if (!prev.objectivesVersion?.objectives) return prev;
            const newObjs = [...prev.objectivesVersion.objectives];
            (newObjs[idx] as any)[field] = value;
            return {
                ...prev,
                objectivesVersion: {
                    ...prev.objectivesVersion,
                    objectives: newObjs
                }
            };
        });
    };

    const removeObjective = (idx: number) => {
        setFormData(prev => {
            if (!prev.objectivesVersion?.objectives) return prev;
            const newObjs = prev.objectivesVersion.objectives.filter((_, i) => i !== idx);
            return {
                ...prev,
                objectivesVersion: {
                    ...prev.objectivesVersion,
                    objectives: newObjs
                }
            };
        });
    };

    // Auto-create first motivo if INITIAL and empty
    useEffect(() => {
        if (!isEditMode && type === 'INITIAL' && (!formData.motivos || formData.motivos.length === 0)) {
            addMotivo();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = async (isClosing: boolean = false) => {
        if (!globalActiveYear || !user) return;

        try {
            setLoading(true);
            const targetId = isEditMode ? initialData!.id! : generateId();

            const payload: Evaluacion = {
                ...formData as Evaluacion,
                id: targetId,
                status: isClosing ? 'CLOSED' : 'DRAFT',
                timeSpentSeconds: secondsElapsed,
                audit: {
                    ...(formData.audit || {}),
                    createdAt: isEditMode ? formData.audit!.createdAt : new Date().toISOString(),
                    createdBy: isEditMode ? formData.audit!.createdBy : user.uid,
                    lastEditedAt: new Date().toISOString(),
                    updatedBy: user.uid,
                    ...(isClosing ? { closedAt: new Date().toISOString(), closedBy: user.uid } : {})
                }
            };

            const docRef = doc(db, "programs", globalActiveYear, "evaluaciones", targetId);
            await setDoc(docRef, payload, { merge: true });

            // Si cierra, generar ObjectiveSet Version y atarlo al proceso maestro
            if (isClosing) {
                // Generar UUID version
                const versionId = `v_${Date.now()}`;

                // Extraer objetivos de payload.objectivesVersion?
                // Y guardarlo atomicamente en el proceso
                const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
                await setDoc(procesoRef, {
                    activeEvaluationId: targetId,
                    activeObjectiveSetVersionId: versionId,
                    activeObjectiveSet: {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: payload.objectivesVersion?.objectives?.map(o => ({
                            id: o.id,
                            label: o.texto, // mapeo de texto -> label para compatibilidad con EvolucionForm Fase 2.1
                            status: 'activo'
                        })) || []
                    }
                }, { merge: true });

                // Y guardamos este puntero dentro de la evaluación misma
                await setDoc(docRef, { "objectivesVersion.objectiveSetVersionId": versionId, "objectivesVersion.isActiveForProcess": true }, { merge: true });
            }

            onSaveSuccess(payload, !isEditMode);
            if (isClosing) onClose();

        } catch (error) {
            console.error("Error saving Eval", error);
            alert("Error al guardar la evaluación.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full w-full gap-6">

            {/* PANEL PRINCIPAL FORMULARIO */}
            <div className="flex-1 overflow-y-auto space-y-6 pb-20 md:pr-4 custom-scrollbar">

                {/* HEADER */}
                <div className="pb-4 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10 p-4 shadow-sm rounded-xl mb-6 mt-2">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                            {type === 'INITIAL' ? 'Evaluación Kinésica Inicial' : 'Re-Evaluación de Progreso'}
                        </h2>
                        <p className="text-sm text-slate-500 font-medium">Proceso ID: {procesoId.substring(0, 8)}... | {new Date(formData.sessionAt as string).toLocaleString()}</p>
                    </div>
                    {isClosed && (
                        <div className="bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                            CERRADA
                        </div>
                    )}
                </div>

                {/* MOTIVOS DE CONSULTA */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold text-slate-800">1. Entrevista y Motivos (Zonas Corporales)</h3>
                        {!isClosed && (
                            <button onClick={addMotivo} className="text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                Agregar Zona
                            </button>
                        )}
                    </div>

                    {formData.motivos?.map((motivo, index) => (
                        <AccordionSection key={motivo.id} title={`${motivo.motivoLabel}: ${motivo.region || 'Nueva Región'} ${motivo.lado !== 'N/A' ? `(${motivo.lado})` : ''}`} defaultOpen={index === 0}>
                            <div className="space-y-6">
                                {/* CABECERA MOTIVO */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-4 border-b border-slate-100">
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Nombre</label>
                                        <input type="text" value={motivo.motivoLabel} onChange={e => updateMotivo(motivo.id, 'motivoLabel', e.target.value)} disabled={isClosed} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:bg-white outline-none" />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Región Corporal</label>
                                        <input type="text" value={motivo.region} onChange={e => updateMotivo(motivo.id, 'region', e.target.value)} disabled={isClosed} placeholder="Ej. Rodilla, Hombro" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white outline-none" />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Lateralidad</label>
                                        <select value={motivo.lado} onChange={e => updateMotivo(motivo.id, 'lado', e.target.value)} disabled={isClosed} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:bg-white outline-none">
                                            <option value="N/A">N/A</option>
                                            <option value="Derecho">Derecho</option>
                                            <option value="Izquierdo">Izquierdo</option>
                                            <option value="Bilateral">Bilateral</option>
                                        </select>
                                    </div>
                                </div>

                                {/* SECCION SUBJETIVA */}
                                <div>
                                    <h4 className="text-sm font-bold text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg inline-block mb-3">A. Entrevista / Anamnesis Subjetiva</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Mecanismo de Lesión / Inicio</label>
                                            <textarea rows={2} value={motivo.subjective.mecanismo} onChange={e => updateMotivo(motivo.id, 'subjective.mecanismo', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Tiempo de Evolución (Días/Meses)</label>
                                            <input type="text" value={motivo.subjective.tiempoEvolucion} onChange={e => updateMotivo(motivo.id, 'subjective.tiempoEvolucion', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Irritabilidad (Umbral)</label>
                                            <select value={motivo.subjective.irritabilidad} onChange={e => updateMotivo(motivo.id, 'subjective.irritabilidad', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none bg-slate-50">
                                                <option value="Baja">Baja</option>
                                                <option value="Media">Media</option>
                                                <option value="Alta">Alta</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Factores Agravantes</label>
                                                <textarea rows={2} value={motivo.subjective.agravantes} onChange={e => updateMotivo(motivo.id, 'subjective.agravantes', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-700 mb-1">Factores Aliviadores</label>
                                                <textarea rows={2} value={motivo.subjective.alivios} onChange={e => updateMotivo(motivo.id, 'subjective.alivios', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Limitación Funcional Principal</label>
                                            <textarea rows={2} value={motivo.subjective.limitacionFuncional} onChange={e => updateMotivo(motivo.id, 'subjective.limitacionFuncional', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Metas de la Persona Usuaria</label>
                                            <textarea rows={2} value={motivo.subjective.metasPersonaUsuaria} onChange={e => updateMotivo(motivo.id, 'subjective.metasPersonaUsuaria', e.target.value)} disabled={isClosed} className="w-full border border-emerald-200 bg-emerald-50 rounded-xl px-3 py-2 text-sm focus:border-emerald-400 outline-none resize-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* SECCION RED FLAGS */}
                                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                                    <h4 className="text-sm font-bold text-rose-800 flex items-center gap-2 mb-3">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                        B. Screening de Red Flags
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                                        {['Pérdida de peso inexplicable', 'Fiebre persistente/Sudores nocturnos', 'Dolor nocturno que no cede al cambio de pos.', 'Alteraciones sensitivas en silla de montar', 'Cambios agudos en continencia esfinteriana', 'Déficits neurológicos progresivos', 'Trauma agudo de alta energía', 'Síntomas constitucionales atípicos'].map(flag => (
                                            <label key={flag} className="flex flex-row items-center gap-2 text-sm text-slate-700 bg-white px-3 py-2 rounded-lg border border-rose-100 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={!!motivo.redFlagsChecklist?.[flag]}
                                                    disabled={isClosed}
                                                    onChange={e => updateMotivo(motivo.id, 'redFlagsChecklist', { ...motivo.redFlagsChecklist, [flag]: e.target.checked })}
                                                    className="w-4 h-4 text-rose-500 border-slate-300 rounded focus:ring-rose-400"
                                                />
                                                <span className="flex-1">{flag}</span>
                                            </label>
                                        ))}
                                    </div>
                                    {Object.values(motivo.redFlagsChecklist || {}).some(v => v === true) && (
                                        <div className="bg-white p-3 rounded-lg border border-rose-300 animate-in fade-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold text-rose-800 mb-1">Acción / Conducta Derivativa (Obligatorio) <span className="text-rose-500">*</span></label>
                                            <textarea rows={2} placeholder="Describa la derivación médica u observación..." value={motivo.redFlagsActionText || ''} onChange={e => updateMotivo(motivo.id, 'redFlagsActionText', e.target.value)} disabled={isClosed} className="w-full border border-rose-200 rounded-lg px-3 py-2 text-sm focus:border-rose-400 focus:ring-1 focus:ring-rose-100 outline-none resize-none" />
                                        </div>
                                    )}
                                </div>

                                {/* SECCION OBJETIVA */}
                                <div>
                                    <h4 className="text-sm font-bold text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg inline-block mb-3">C. Examen Físico Objetivo</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Rango de Movimiento (ROM)</label>
                                            <textarea rows={2} value={motivo.objectiveMeasures.rom} onChange={e => updateMotivo(motivo.id, 'objectiveMeasures.rom', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Fuerza / Desempeño Muscular</label>
                                            <textarea rows={2} value={motivo.objectiveMeasures.fuerza} onChange={e => updateMotivo(motivo.id, 'objectiveMeasures.fuerza', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Pruebas Especiales / Ortopédicas</label>
                                            <textarea rows={2} value={motivo.objectiveMeasures.pruebasEspeciales} onChange={e => updateMotivo(motivo.id, 'objectiveMeasures.pruebasEspeciales', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Reproductor del Dolor (Al evaluar)</label>
                                            <textarea rows={2} value={motivo.objectiveMeasures.dolorConPruebas} onChange={e => updateMotivo(motivo.id, 'objectiveMeasures.dolorConPruebas', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-bold text-slate-700 mb-1">Control Motor / Biomecánica / Palpación</label>
                                            <textarea rows={3} value={motivo.objectiveMeasures.controlMotor} onChange={e => updateMotivo(motivo.id, 'objectiveMeasures.controlMotor', e.target.value)} disabled={isClosed} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:border-sky-400 outline-none resize-none bg-slate-50" />
                                        </div>
                                    </div>
                                </div>

                                {/* ELIMINAR MOTIVO */}
                                {!isClosed && (
                                    <div className="flex justify-end pt-4 border-t border-slate-100">
                                        <button onClick={() => removeMotivo(motivo.id)} className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors">
                                            Eliminar este Motivo
                                        </button>
                                    </div>
                                )}
                            </div>
                        </AccordionSection>
                    ))}
                    {(!formData.motivos || formData.motivos.length === 0) && (
                        <div className="text-slate-500 text-sm p-8 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                            No hay motivos creados. Haz clic en "Agregar Zona".
                        </div>
                    )}
                </div>

                {/* Síntesis y Diagnóstico (Macro) */}
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">2. Integración y Diagnóstico (Macro)</h3>
                    <AccordionSection title="Síntesis Biopsicosocial y Dx Kinesiológico">
                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Síntesis Clínica y Análisis BPS <span className="text-indigo-400 font-normal text-xs ml-2">(OpcionalIA)</span></label>
                                <textarea
                                    rows={4}
                                    value={formData.clinicalSynthesis || ''}
                                    onChange={e => setFormData(p => ({ ...p, clinicalSynthesis: e.target.value }))}
                                    disabled={isClosed}
                                    placeholder="Redacte la integración de los hallazgos objetivos y el relato subjetivo..."
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50"
                                />
                                {getAiButton('generarSintesisEvaluacion', 'Auto-Redactar Integración (Gemini)')}
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Diagnóstico Kinesiológico <span className="text-slate-400 font-normal text-xs ml-2">(Definitivo)</span></label>
                                <textarea
                                    rows={3}
                                    value={formData.dxKinesiologico || ''}
                                    onChange={e => setFormData(p => ({ ...p, dxKinesiologico: e.target.value }))}
                                    disabled={isClosed}
                                    placeholder="Ej. Disfunción patelofemoral derecha secundaria a valgo dinámico alterado..."
                                    className="w-full border border-sky-200 rounded-xl px-4 py-3 text-sm focus:border-sky-400 focus:ring-1 focus:ring-sky-100 outline-none resize-none bg-sky-50/30"
                                />
                                {getAiButton('generarDxKinesiologico', 'Inferir Dx Kinesiológico Estructural (Gemini)')}
                            </div>

                            {aiError && (
                                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-lg mt-2 border border-red-100 animate-in fade-in">
                                    {aiError}
                                </div>
                            )}
                        </div>
                    </AccordionSection>
                </div>

                {/* Formulación de Objetivos (Versionados) y Plan */}
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">3. Planificación y Pronóstico</h3>
                    <AccordionSection title="Plan de Asistencia y Metas Generales">
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Frecuencia Semanal Asignada</label>
                                    <select
                                        value={formData.planPronostico?.frecuenciaSemanal || ''}
                                        onChange={e => setFormData(p => ({ ...p, planPronostico: { ...(p.planPronostico || {} as any), frecuenciaSemanal: e.target.value } }))}
                                        disabled={isClosed}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white outline-none"
                                    >
                                        <option value="">Seleccione Frecuencia...</option>
                                        <option value="1 vez por semana">1 vez por semana</option>
                                        <option value="2 veces por semana">2 veces por semana</option>
                                        <option value="3 veces por semana">3 veces por semana</option>
                                        <option value="Sos (Agendamiento Manual)">SOS (Agendamiento Manual / Control libre)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Duración Estimada (Semanas/Meses)</label>
                                    <input
                                        type="text"
                                        value={formData.planPronostico?.duracionEstimadaSemanas || ''}
                                        onChange={e => setFormData(p => ({ ...p, planPronostico: { ...(p.planPronostico || {} as any), duracionEstimadaSemanas: e.target.value } }))}
                                        disabled={isClosed}
                                        placeholder="Ej. 12 Semanas"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:bg-white outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Pronóstico Funcional al Alta</label>
                                    <textarea
                                        rows={2}
                                        value={formData.planPronostico?.pronosticoTexto || ''}
                                        onChange={e => setFormData(p => ({ ...p, planPronostico: { ...(p.planPronostico || {} as any), pronosticoTexto: e.target.value } }))}
                                        disabled={isClosed}
                                        placeholder="Expectativa razonable de recuperación..."
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-400 outline-none resize-none bg-slate-50"
                                    />
                                    {getAiButton('generarPlanPronostico', 'Evaluar e Inferir Pronóstico (IA)')}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-emerald-800 mb-1 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Criterios de Alta / Metas Resolutivas
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={formData.planPronostico?.criteriosAlta || ''}
                                        onChange={e => setFormData(p => ({ ...p, planPronostico: { ...(p.planPronostico || {} as any), criteriosAlta: e.target.value } }))}
                                        disabled={isClosed}
                                        placeholder="Ej. PASS > 80, ROM completo sin dolor, Tolera Salto Unipodal..."
                                        className="w-full border border-emerald-200 rounded-xl px-4 py-3 text-sm focus:border-emerald-400 focus:ring-1 focus:ring-emerald-100 outline-none resize-none bg-emerald-50/30"
                                    />
                                </div>
                            </div>

                            {/* CRUD de Objetivos Múltiples Específicos/Generales que se inyectan en objectivesVersion */}
                            <div className="pt-4 border-t border-slate-100 mt-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-sm font-bold text-slate-800">Objetivos SMART (Versionables)</h4>
                                    {!isClosed && (
                                        <button onClick={addObjective} className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                                            Inyectar Objetivo
                                        </button>
                                    )}
                                </div>

                                {(!formData.objectivesVersion?.objectives || formData.objectivesVersion.objectives.length === 0) ? (
                                    <div className="text-slate-500 text-sm p-6 text-center bg-slate-50 rounded-xl border border-slate-200 border-dashed">
                                        No hay objetivos definidos. El estándar requiere al menos 1 General y 2 Específicos.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {formData.objectivesVersion.objectives.map((obj, i) => (
                                            <div key={obj.id} className="bg-white border text-sm border-slate-200 rounded-xl p-4 shadow-sm relative group overflow-hidden">
                                                <div className={`absolute top-0 left-0 w-1 h-full ${obj.tipo === 'General' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
                                                <div className="pl-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">

                                                    <div className="md:col-span-2">
                                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Jerarquía</label>
                                                        <select
                                                            value={obj.tipo}
                                                            onChange={(e) => updateObjective(i, 'tipo', e.target.value)}
                                                            disabled={isClosed}
                                                            className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold outline-none ${obj.tipo === 'General' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}
                                                        >
                                                            <option value="General">General</option>
                                                            <option value="Específico">Específico</option>
                                                        </select>
                                                    </div>

                                                    <div className="md:col-span-10 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="md:col-span-2">
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Redacción Funcional (Evita el 'Disminuir Dolor')</label>
                                                            <input
                                                                type="text"
                                                                value={obj.texto}
                                                                onChange={(e) => updateObjective(i, 'texto', e.target.value)}
                                                                disabled={isClosed}
                                                                placeholder="Ej. Caminar 10 min sin dolor (EVA <3)..."
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:bg-white focus:border-indigo-400 outline-none font-medium"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Medida/KPI Analógica (Opcional)</label>
                                                            <input
                                                                type="text"
                                                                value={obj.medidaAsociada || ''}
                                                                onChange={(e) => updateObjective(i, 'medidaAsociada', e.target.value)}
                                                                disabled={isClosed}
                                                                placeholder="Ej. ROM Flexión / Fuerza Din..."
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:bg-white outline-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Criterio de Éxito / Regla de Alta</label>
                                                            <input
                                                                type="text"
                                                                value={obj.criterioExito || ''}
                                                                onChange={(e) => updateObjective(i, 'criterioExito', e.target.value)}
                                                                disabled={isClosed}
                                                                placeholder="Ej. > 110 Grados sin limitación..."
                                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:bg-white focus:border-emerald-400 outline-none font-medium"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {!isClosed && (
                                                    <button onClick={() => removeObjective(i)} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 transition-colors bg-white rounded-full p-1 opacity-0 group-hover:opacity-100">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </AccordionSection>
                </div>

            </div>

            {/* PANEL LATERAL DE CONTROL (Sticky Side) */}
            <div className="w-full md:w-80 shrink-0 flex flex-col gap-4">
                {/* Timer Docente */}
                <div className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center transition-colors shadow-sm ${getTimerColor(secondsElapsed)}`}>
                    <p className="text-xs uppercase font-bold tracking-widest opacity-80 mb-1">Crono Evaluación</p>
                    <div className="text-4xl font-black font-mono tracking-tighter">
                        {formatTime(secondsElapsed)}
                    </div>
                    {secondsElapsed >= 1800 && (
                        <p className="text-xs font-semibold mt-2 px-3 py-1 bg-white/50 rounded-lg">Se recomienda sintetizar hallazgos (meta &lt;30 min)</p>
                    )}
                </div>

                {/* Acciones de Guardado */}
                {!isClosed && (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 shadow-sm">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={loading}
                            className="w-full bg-white text-slate-700 font-bold border border-slate-200 hover:border-slate-300 hover:bg-slate-100 py-3 px-4 rounded-xl transition-all shadow-sm"
                        >
                            {loading ? 'Guardando...' : 'Guardar Borrador'}
                        </button>

                        <div className="relative my-2">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-300"></div></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-50 px-2 text-slate-400 font-bold">Cierre Definitivo</span></div>
                        </div>

                        <button
                            onClick={() => {
                                // Add Validations here
                                const invalidMotivoFlags = formData.motivos?.find(m =>
                                    Object.values(m.redFlagsChecklist || {}).some(v => v === true) && !m.redFlagsActionText?.trim()
                                );
                                if (invalidMotivoFlags) {
                                    alert(`La zona "${invalidMotivoFlags.motivoLabel}" tiene Banderas Rojas marcadas pero falta documentar la Acción a seguir.`);
                                    return;
                                }

                                if (!formData.planPronostico?.frecuenciaSemanal || !formData.planPronostico?.duracionEstimadaSemanas) {
                                    alert("Debe proveer una frecuencia semanal y duración estimada antes de cerrar.");
                                    return;
                                }

                                const objetivosArr = formData.objectivesVersion?.objectives || [];
                                const totalGen = objetivosArr.filter(o => o.tipo === 'General').length;
                                const totalEsp = objetivosArr.filter(o => o.tipo === 'Específico').length;

                                if (totalGen < 1 || totalEsp < 2) {
                                    alert(`Para cerrar la evaluación, el Set Biopsicosocial exige mínimo 1 Objetivo General y 2 Específicos. Actualmente hay ${totalGen} Genelales y ${totalEsp} Específicos.`);
                                    return;
                                }

                                const incompObs = objetivosArr.find(o => !o.texto.trim() || !o.criterioExito?.trim());
                                if (incompObs) {
                                    alert("Todos los objetivos deben tener el Texto y el Criterio de Éxito documentados.");
                                    return;
                                }

                                if (window.confirm("¿Estás seguro de cerrar la evaluación? Esto generará los Objetivos Maestros del Proceso y sellará el documento.")) {
                                    handleSave(true);
                                }
                            }}
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white font-bold hover:bg-indigo-700 py-3 px-4 rounded-xl transition-all shadow-sm flex justify-center items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Fijar y Cerrar
                        </button>

                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full mt-auto bg-slate-100 text-slate-500 font-bold hover:text-slate-700 hover:bg-slate-200 py-3 px-4 rounded-xl transition-all"
                >
                    Volver al Expediente
                </button>
            </div>

        </div>
    );
}
