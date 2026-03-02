import React, { useState, useEffect, useMemo } from "react";
import { Evaluacion, MotivoEvaluacion } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";

// Import UI Steps (a crear pronto)
import { Step1Entrevista } from "./evaluacion-steps/Step1Entrevista";
import { Step2RedFlags } from "./evaluacion-steps/Step2RedFlags";
import { Step3ExamenFisico } from "./evaluacion-steps/Step3ExamenFisico";
import { Step4IntegracionDx } from "./evaluacion-steps/Step4IntegracionDx";
import { Step5PlanObjetivos } from "./evaluacion-steps/Step5PlanObjetivos";

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
    const [step, setStep] = useState(1);

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
                subjective: { mechanism: '', onsetDateOrDuration: '', irritability: 'Media', functionaLimitationPrimary: '' } as any,
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
        const hasDx = !!formData.dxKinesico?.primary?.trim();
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

    const stepsInfo = [
        { id: 1, label: 'Entrevista', icon: '👤' },
        { id: 2, label: 'Red Flags', icon: '🚩', warning: !getValidationContext.validRedFlags },
        { id: 3, label: 'Ex. Físico', icon: '🩺', warning: !getValidationContext.validPhysical },
        { id: 4, label: 'Biopsicosocial', icon: '🧠', warning: !getValidationContext.hasDx },
        { id: 5, label: 'Plan y Metas', icon: '📋', warning: !getValidationContext.validObjs || !getValidationContext.validPlan }
    ];

    return (
        <div className="flex flex-col h-full w-full bg-slate-50 relative">

            {/* TOP BAR MOBILE-FIRST STICKY */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between px-3 md:px-6 py-3">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-sm md:text-base font-black text-slate-800 leading-tight">
                            {type === 'INITIAL' ? 'Eval. Inicial' : 'Reevaluación'}
                        </h2>
                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 font-medium">
                            <span>ID: {procesoId.slice(0, 5)}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className={`${getValidationContext.allValid ? 'text-emerald-600 font-bold' : 'text-amber-500'}`}>
                                {getValidationContext.allValid ? 'Hitos OK' : 'Faltan Hitos'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className={`hidden md:flex text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider ${isClosed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {isClosed ? 'Cerrada' : 'Borrador'}
                    </div>
                    {!isClosed && (
                        <div className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border shadow-inner ${getTimerColor(secondsElapsed)}`}>
                            <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {formatTime(secondsElapsed)}
                        </div>
                    )}
                </div>
            </div>

            {/* STEPPER HEADER (Scrollable en móvil) */}
            <div className="bg-white border-b border-slate-200">
                <div className="flex overflow-x-auto hide-scrollbar gap-2 px-3 md:px-6 py-3 items-center">
                    {stepsInfo.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setStep(s.id)}
                            className={`flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${step === s.id
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                        >
                            <span>{s.icon}</span>
                            {s.label}
                            {s.warning && !isClosed && <span className="w-2 h-2 rounded-full bg-rose-500 ml-1 shadow-sm"></span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* ERROR BANNER DE IA */}
            {aiError && (
                <div className="bg-rose-50 border-y border-rose-200 px-4 py-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-800">Error de Asistente IA</h4>
                        <p className="text-xs text-rose-600 mt-0.5">{aiError}</p>
                    </div>
                    <button onClick={() => setAiError(null)} className="text-rose-400 hover:text-rose-600 transition-colors p-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL SCROLL */}
            <div className="flex-1 overflow-y-auto pb-32 pt-6 px-3 md:px-6 max-w-5xl mx-auto w-full">
                {step === 1 && <Step1Entrevista formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                {step === 2 && <Step2RedFlags formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                {step === 3 && <Step3ExamenFisico formData={formData} updateFormData={updateFormData} isClosed={isClosed} />}
                {step === 4 && <Step4IntegracionDx formData={formData} updateFormData={updateFormData} isClosed={isClosed} setAiLoading={setAiLoading} setAiError={setAiError} aiLoading={aiLoading} />}
                {step === 5 && <Step5PlanObjetivos formData={formData} updateFormData={updateFormData} isClosed={isClosed} setAiLoading={setAiLoading} setAiError={setAiError} aiLoading={aiLoading} />}
            </div>

            {/* BOTTOM BAR STICKY (Acciones) */}
            {!isClosed && (
                <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 p-3 md:p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
                    <div className="max-w-5xl mx-auto flex flex-row gap-3">
                        <button
                            onClick={() => handleSave(false)}
                            disabled={loading}
                            className="flex-1 bg-white text-slate-700 font-bold border border-slate-300 hover:bg-slate-50 py-3.5 px-4 rounded-xl transition-all shadow-sm text-sm"
                        >
                            {loading ? 'Guardando...' : 'Guardar Borrador'}
                        </button>

                        <button
                            onClick={() => handleSave(true)}
                            disabled={loading}
                            className={`flex-1 font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm text-sm flex justify-center items-center gap-2 ${getValidationContext.allValid
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                            Fijar y Cerrar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
