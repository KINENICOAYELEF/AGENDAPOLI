import React, { useState, useEffect, useMemo } from "react";
import { Evaluacion, MotivoEvaluacion } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";

// Import UI Steps (V2)
import { M0_InicioRapido } from "./evaluacion-steps/M0_InicioRapido";
import { M1_TriageRedFlags } from "./evaluacion-steps/M1_TriageRedFlags";
import { M2_AnamnesisProxima } from "./evaluacion-steps/M2_AnamnesisProxima";
import { M4_FactoresBPS } from "./evaluacion-steps/M4_FactoresBPS";
import { M5_FuncionActividad } from "./evaluacion-steps/M5_FuncionActividad";
import { M6_ComparableSign } from "./evaluacion-steps/M6_ComparableSign";
import { M7_ExamenFisico } from "./evaluacion-steps/M7_ExamenFisico";
import { M8_EstructuralFuncional } from "./evaluacion-steps/M8_EstructuralFuncional";
import { M9_ClasificacionInteligente } from "./evaluacion-steps/M9_ClasificacionInteligente";
import { M10_EvaluadorMinimo } from "./evaluacion-steps/M10_EvaluadorMinimo";
import { M11_DiagnosticoKinesico } from "./evaluacion-steps/M11_DiagnosticoKinesico";
import { M12_ObjetivosSemaforo } from "./evaluacion-steps/M12_ObjetivosSemaforo";
import { M13_Cierre } from "./evaluacion-steps/M13_Cierre";
import { M_ReevalStart } from "./evaluacion-steps/M_ReevalStart";
import { M3_PerfilPermanente } from "./evaluacion-steps/M3_PerfilPermanente";

// V1 Legacy removed

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export interface EvaluacionFormProps {
    usuariaId: string;
    procesoId: string;
    type: 'INITIAL' | 'REEVALUATION' | 'NEW_MOTIVE_EVAL';
    initialData: Evaluacion | null;
    onClose: () => void;
    onSaveSuccess: (evaluacion: Evaluacion, isNew: boolean) => void;
}

export function EvaluacionForm({ usuariaId, procesoId, type, initialData, onClose, onSaveSuccess }: EvaluacionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    const isEditMode = !!initialData;
    const [isClosed, setIsClosed] = useState(initialData?.status === 'CLOSED');
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(type === 'REEVALUATION' ? -1 : 0); // V2 Empieza en M0 o M-1

    // AI Integration States
    const [aiLoading, setAiLoading] = useState<string | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);

    // TEMPORIZADOR CLINICO DOCENTE (Fase 2.2.1)
    const [secondsElapsed, setSecondsElapsed] = useState(initialData?.timer?.totalSeconds || initialData?.timeSpentSeconds || 0);

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
        if (secs < 1800) return 'text-emerald-700 bg-emerald-100 border-emerald-300';
        if (secs < 2700) return 'text-amber-700 bg-amber-100 border-amber-300';
        return 'text-rose-700 bg-rose-100 border-rose-300';
    };

    // FORM STATE
    const [formData, setFormData] = useState<Partial<Evaluacion>>({
        usuariaId,
        procesoId,
        type,
        status: 'DRAFT',
        sessionAt: initialData?.sessionAt || new Date().toISOString(),
        motivos: initialData?.motivos || [],
        clinicianResponsible: initialData?.clinicianResponsible || user?.email || '',
        timer: initialData?.timer || { startedAt: new Date().toISOString(), totalSeconds: 0, pauses: [] },
        ai: initialData?.ai || { enabled: true, errors: [] },
        dxKinesico: initialData?.dxKinesico || { primary: '', differentialList: [] },
        integration: initialData?.integration || { synthesis: '' },
        objectivesVersion: initialData?.objectivesVersion || { objectiveSetVersionId: '', isActiveForProcess: false, objectives: [] },
        operationalPlan: initialData?.operationalPlan || { interventionsPlanned: [], educationPlan: '', homePlan: '' },
        attendancePlan: initialData?.attendancePlan || { recommendedFrequencyWeekly: '', estimatedDurationWeeks: '', prognosisFunctional: '', dischargeCriteria: '' },
        ...initialData
    });

    // Auto-create first motivo if empty
    useEffect(() => {
        if (!isEditMode && (!formData.motivos || formData.motivos.length === 0)) {
            const newMotivo: MotivoEvaluacion = {
                id: generateId(),
                motivoLabel: `Motivo Principal`,
                region: '',
                lado: 'N/A',
                subjective: { mechanism: '', onsetDateOrDuration: '', irritability: 'Media', functionalLimitationPrimary: '' } as any,
                redFlagsChecklist: {},
                objectiveExam: {},
                impairmentSummary: {}
            };
            setFormData(prev => ({ ...prev, motivos: [newMotivo] }));
        }
    }, [isEditMode, formData.motivos]);

    const updateFormData = (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => {
        setFormData(prev => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch });
    };

    // --- Validations para Cierre ---
    const getValidationContext = useMemo(() => {
        const motivos = formData.motivos || [];
        const hasMotivos = motivos.length > 0;
        const validMotivoSubj = motivos.every(m => m.subjective?.mechanism?.trim() && m.subjective?.functionalLimitationPrimary?.trim());
        const validRedFlags = motivos.every(m => {
            const hasFlags = Object.values(m.redFlagsChecklist || {}).some(v => v === true);
            if (hasFlags) return !!m.redFlagsActionText?.trim();
            return true; // Si no hay banderas rojas marcadas o respondió todo ok
        });
        // Físico Mínimo (Rom o Fuerza o Tests)
        const validPhysical = motivos.every(m => {
            const ex = m.objectiveExam;
            if (!ex) return false;
            return (ex.rom && ex.rom.length > 0) || (ex.strength && ex.strength.length > 0) || (ex.specialTests && ex.specialTests.length > 0);
        });
        const hasDx = !!(formData.dxKinesico?.narrative?.trim() || formData.dxKinesico?.primary?.trim());
        const objArr = formData.objectivesVersion?.objectives || [];
        const validObjs = objArr.filter(o => o.tipo === 'General').length >= 1 && objArr.filter(o => o.tipo === 'Específico').length >= 2;
        const validPlan = !!formData.operationalPlan?.educationPlan?.trim() || !!formData.operationalPlan?.interventionsPlanned?.length;

        const allValid = hasMotivos && validMotivoSubj && validRedFlags && validPhysical && hasDx && validObjs && validPlan;

        return { hasMotivos, validMotivoSubj, validRedFlags, validPhysical, hasDx, validObjs, validPlan, allValid };
    }, [formData]);

    const handleSave = async (isClosing: boolean = false) => {
        if (!globalActiveYear || !user) return;

        if (isClosing && !getValidationContext.allValid) {
            alert("Existen Hitos Duros pendientes. Revisa el Semáforo de Cierre en el Panel Inteligente.");
            return;
        }
        if (isClosing && !window.confirm("¿Seguro que deseas Cerrar y Fijar esta evaluación? Generará el Set de Objetivos inmutable del Proceso.")) {
            return;
        }

        try {
            setLoading(true);
            const targetId = isEditMode ? initialData!.id! : generateId();

            const payload: Evaluacion = {
                ...formData as Evaluacion,
                id: targetId,
                status: isClosing ? 'CLOSED' : 'DRAFT',
                timer: {
                    ...(formData.timer || { totalSeconds: 0 }),
                    totalSeconds: secondsElapsed
                },
                // Construcción V2 Payload
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

            if (isClosing) {
                const versionId = `v_${Date.now()}`;
                const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
                await setDoc(procesoRef, {
                    activeEvaluationId: targetId,
                    activeObjectiveSetVersionId: versionId,
                    caseSnapshot: { // M13 Snapshot
                        summary: payload.integration?.synthesis?.slice(0, 100) + '...',
                        lastUpdated: new Date().toISOString(),
                        trafficLight: payload.loadTrafficLight || 'Verde'
                    },
                    activeObjectiveSet: {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: payload.objectivesVersion?.objectives?.map(o => ({
                            id: o.id,
                            label: o.texto,
                            status: 'activo'
                        })) || []
                    }
                }, { merge: true });
                await setDoc(docRef, { "objectivesVersion.objectiveSetVersionId": versionId, "objectivesVersion.isActiveForProcess": true }, { merge: true });
            }

            onSaveSuccess(payload, !isEditMode);
            if (isClosing) onClose();
        } catch (error) {
            console.error(error);
            alert("Error al guardar.");
        } finally {
            setLoading(false);
        }
    };

    const isExpress = formData.ai?.appliedFlags?.expressReeval === true;

    const M_STEPS = [
        ...(type === 'REEVALUATION' ? [{ id: -1, label: 'M-1: Reeval', icon: '🔄' }] : []),
        { id: 0, label: 'M0: Inicio', icon: '⚡' },
        { id: 1, label: 'M1: Triage/Red Flags', icon: '🚩', warning: !getValidationContext.validRedFlags },
        { id: 2, label: 'M2: Anamnesis', icon: '🗣️' },
        { id: 3, label: 'M3: Perfil Perm.', icon: '📇' },
        { id: 4, label: 'M4: Fac. BPS', icon: '🧠' },
        { id: 5, label: 'M5: Función (PSFS)', icon: '🏃' },
        { id: 6, label: 'M6: Comparable', icon: '⭐' },
        { id: 7, label: 'M7: Ex. Físico', icon: '🩺', warning: !getValidationContext.validPhysical },
        { id: 8, label: 'M8: Est. vs Func.', icon: '⚖️' },
        { id: 9, label: 'M9: Clasificación', icon: '🏷️' },
        { id: 10, label: 'M10: Eval Mínimo (IA)', icon: '🤖' },
        { id: 11, label: 'M11: Dx (IA)', icon: '📝', warning: !getValidationContext.hasDx },
        { id: 12, label: 'M12: Objetivos (IA)', icon: '🎯', warning: !getValidationContext.validObjs || !getValidationContext.validPlan },
        { id: 13, label: 'M13: Cierre', icon: '✅' },
    ].filter(s => {
        if (!isExpress) return true;
        // En Express Reevaluation conservamos solo lo esencial
        return [-1, 0, 5, 6, 7, 11, 12, 13].includes(s.id);
    });

    const [isPerfilDrawerOpen, setIsPerfilDrawerOpen] = useState(false);

    return (
        <div className="flex w-full h-full bg-slate-50 relative overflow-hidden">
            {/* DRAWER PERMANENTE (M3 Integrado globalmente) */}
            <div className={`fixed inset-y-0 right-0 z-[60] w-full md:w-[480px] bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 ease-in-out ${isPerfilDrawerOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><span className="text-xl">📇</span> Perfil Permanente Global</h3>
                    <button onClick={() => setIsPerfilDrawerOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                <div className="p-4 overflow-y-auto h-full pb-20 custom-scrollbar">
                    <M3_PerfilPermanente usuariaId={usuariaId} isDrawerMode={true} />
                </div>
            </div>
            {isPerfilDrawerOpen && <div className="fixed inset-0 bg-slate-900/20 z-[55] md:hidden" onClick={() => setIsPerfilDrawerOpen(false)} />}

            {/* CONTENEDOR PRINCIPAL */}
            <div className="flex flex-col flex-1 h-full relative">

                {/* TOP BAR MOBILE-FIRST STICKY (Ultraversátil V2) */}
                <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 gap-2">
                    <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-3">
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <h2 className="text-sm md:text-base font-black text-slate-800 leading-tight">
                                    {type === 'INITIAL' ? 'Eval. Inicial V2' : 'Reevaluación V2'}
                                </h2>
                                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 font-medium">
                                    <span>P: {procesoId.slice(0, 4)}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className={`${getValidationContext.allValid ? 'text-emerald-600 font-bold' : 'text-amber-500'}`}>
                                        {getValidationContext.allValid ? 'Hitos OK' : '1+ Hitos Pendientes'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Botón flotante M3 móvil */}
                        <button onClick={() => setIsPerfilDrawerOpen(true)} className="md:hidden text-indigo-600 font-bold text-xs flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                            <span>📇</span> Perfil
                        </button>
                    </div>

                    <div className="flex items-center gap-2 justify-between w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className="text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                                Módulo {step}/13
                            </div>
                            <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isClosed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isClosed ? 'Cerrada' : 'Borrador'}
                            </div>
                            {/* Semáforo Load Traffic Light */}
                            <div className="flex gap-0.5 items-center bg-slate-100 px-1.5 py-1 rounded-md border border-slate-200">
                                <span className={`w-2 h-2 rounded-full ${formData.loadTrafficLight === 'Verde' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-slate-300'} transition-all`} />
                                <span className={`w-2 h-2 rounded-full ${formData.loadTrafficLight === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.8)]' : 'bg-slate-300'} transition-all`} />
                                <span className={`w-2 h-2 rounded-full ${formData.loadTrafficLight === 'Rojo' ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]' : 'bg-slate-300'} transition-all`} />
                            </div>
                        </div>

                        {!isClosed && (
                            <div className={`flex items-center shrink-0 gap-1.5 text-xs font-mono font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg border shadow-inner cursor-pointer hover:opacity-80 transition-opacity ${getTimerColor(secondsElapsed)}`} title="Click para historial de pausas">
                                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {formatTime(secondsElapsed)}
                            </div>
                        )}
                        <button onClick={() => setIsPerfilDrawerOpen(true)} className="hidden md:flex shrink-0 text-white bg-slate-800 hover:bg-slate-900 font-bold text-xs items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                            <span>📇</span> Perfil Permanente (M3)
                        </button>
                    </div>
                </div>

                {/* STEPPER WIZARD HORIZONTAL M0 a M13 */}
                <div className="bg-white border-b border-slate-200 shadow-sm z-40 relative">
                    <div className="flex overflow-x-auto gap-2 px-3 md:px-6 py-2.5 items-center custom-scrollbar">
                        {M_STEPS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setStep(s.id)}
                                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border whitespace-nowrap ${step === s.id
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-[0_2px_10px_-2px_rgba(79,70,229,0.5)]'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <span className="opacity-90">{s.icon}</span>
                                {s.label}
                                {s.warning && !isClosed && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 ml-0.5 shadow-sm animate-pulse"></span>}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ERROR BANNER DE IA */}
                {aiError && (
                    <div className="bg-rose-50 border-b border-rose-200 px-4 py-2.5 flex items-start gap-3 z-30">
                        <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-rose-800">Error Gemini</h4>
                            <p className="text-xs text-rose-600 mt-0.5">{aiError}</p>
                        </div>
                        <button onClick={() => setAiError(null)} className="text-rose-400 hover:text-rose-600 transition-colors p-1">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {/* CONTENIDO PRINCIPAL SCROLL V2 */}
                <div className="flex-1 overflow-y-auto pb-32 pt-6 px-3 md:px-6 max-w-4xl mx-auto w-full">

                    {/* Renderizado Activo de Módulos */}
                    {step === -1 && <M_ReevalStart formData={formData} updateFormData={updateFormData} onProceed={() => setStep(0)} />}
                    {step === 0 && <M0_InicioRapido formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 1 && <M1_TriageRedFlags formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 2 && <M2_AnamnesisProxima formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}

                    {step === 3 && <M3_PerfilPermanente usuariaId={usuariaId} />}
                    {step === 4 && <M4_FactoresBPS formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 5 && <M5_FuncionActividad formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 6 && <M6_ComparableSign formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 7 && <M7_ExamenFisico formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 8 && <M8_EstructuralFuncional formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 9 && <M9_ClasificacionInteligente formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 10 && <M10_EvaluadorMinimo formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 11 && <M11_DiagnosticoKinesico formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 12 && <M12_ObjetivosSemaforo formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                    {step === 13 && <M13_Cierre formData={formData} updateFormData={updateFormData} isClosed={isClosed} validationContext={getValidationContext} onSaveAndClose={() => handleSave(true)} />}

                    {/* Placeholder router for M_STEPS pending implementation */}
                    {step > 13 && (
                        <div className="bg-white border text-center border-slate-200 p-8 rounded-2xl shadow-sm flex flex-col items-center justify-center min-h-[300px]">
                            <span className="text-4xl mb-3">{M_STEPS.find(s => s.id === step)?.icon}</span>
                            <h3 className="text-lg font-black text-slate-800 mb-2">{M_STEPS.find(s => s.id === step)?.label}</h3>
                            <p className="text-sm text-slate-500 max-w-sm">
                                El módulo está actualmente en desarrollo dentro de la FASE 2.2.1 V2.
                            </p>
                        </div>
                    )}

                    {/* V1 Legacy Render Exited */}

                </div>

                {/* BOTTOM BAR STICKY (Acciones Móvil-First) */}
                {!isClosed && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] md:pl-64">
                        <div className="max-w-4xl mx-auto flex flex-row gap-3">
                            <button
                                onClick={() => handleSave(false)}
                                disabled={loading}
                                className="flex-1 bg-white text-slate-700 font-bold border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 py-3.5 px-4 rounded-xl transition-all shadow-sm text-sm"
                            >
                                {loading ? 'Guardando...' : 'Guardar Borrador'}
                            </button>

                            <button
                                onClick={() => handleSave(true)}
                                disabled={loading}
                                className={`flex-[1.5] font-bold py-3.5 px-4 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2 ${getValidationContext.allValid
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                                    : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                    }`}
                            >
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {getValidationContext.allValid ? 'Fijar y Cerrar' : 'Completa los Módulos'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
