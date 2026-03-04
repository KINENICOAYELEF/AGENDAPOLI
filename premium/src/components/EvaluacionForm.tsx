import React, { useState, useEffect, useMemo } from "react";
import { Evaluacion, KineFocusArea, EvaluacionInicial, EvaluacionReevaluacion, Proceso } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { OutcomesService } from "@/services/outcomes";

// Nuevas 5 Pantallas Integrales
import { Screen1_Entrevista } from "./evaluacion-steps/Screen1_Entrevista";
import { Screen2_Examen } from "./evaluacion-steps/Screen2_Examen";
import { Screen3_Sintesis } from "./evaluacion-steps/Screen3_Sintesis";
import { Screen4_Diagnostico } from "./evaluacion-steps/Screen4_Diagnostico";
import { Screen5_Reevaluacion } from "./evaluacion-steps/Screen5_Reevaluacion";
// Perfil permanente (ahora es un drawer asíncrono, no una pantalla bloqueante)
import { M3_PerfilPermanente } from "./evaluacion-steps/M3_PerfilPermanente";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

export interface EvaluacionFormProps {
    usuariaId: string;
    procesoId: string;
    type: 'INITIAL' | 'REEVALUATION';
    initialData: Evaluacion | null;
    procesoContext?: Proceso; // FASE 2.2.5
    onClose: () => void;
    onSaveSuccess: (evaluacion: Evaluacion, isNew: boolean) => void;
}

export function EvaluacionForm({ usuariaId, procesoId, type, initialData, procesoContext, onClose, onSaveSuccess }: EvaluacionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    const isEditMode = !!initialData;
    const [isClosed, setIsClosed] = useState(initialData?.status === 'CLOSED');
    const [loading, setLoading] = useState(false);

    // Si es reevaluación empezamos en Pantalla 5, si no en Pantalla 1
    const [screen, setScreen] = useState<number>(type === 'REEVALUATION' ? 5 : 1);

    // AI Integration States
    const [aiError, setAiError] = useState<string | null>(null);

    // TEMPORIZADOR CLINICO DOCENTE (Pill)
    const [secondsElapsed, setSecondsElapsed] = useState(initialData?.timer?.totalSeconds || 0);

    useEffect(() => {
        if (isClosed) return;
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
            setFormData((prev: any) => {
                const currentTimer = prev.timer || { screen1Seconds: 0, screen2Seconds: 0, screen3Seconds: 0, screen4Seconds: 0, screen5Seconds: 0, totalSeconds: 0 };
                const updatedTimer = { ...currentTimer, totalSeconds: currentTimer.totalSeconds + 1 };
                if (screen === 1) updatedTimer.screen1Seconds += 1;
                else if (screen === 2) updatedTimer.screen2Seconds += 1;
                else if (screen === 3) updatedTimer.screen3Seconds += 1;
                else if (screen === 4) updatedTimer.screen4Seconds += 1;
                else if (screen === 5) updatedTimer.screen5Seconds += 1;
                return { ...prev, timer: updatedTimer };
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [isClosed, screen]);

    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const getTimerColor = (secs: number) => {
        if (secs < 600) return 'text-emerald-700 bg-emerald-100 border-emerald-300'; // 0-10 min
        if (secs < 1200) return 'text-amber-700 bg-amber-100 border-amber-300'; // 10-20 min
        return 'text-rose-700 bg-rose-100 border-rose-300'; // 20-30+ min
    };

    // FORM STATE
    const [formData, setFormData] = useState<any>({
        usuariaId,
        procesoId,
        type,
        status: 'DRAFT',
        sessionAt: initialData?.sessionAt || new Date().toISOString(),
        clinicianResponsible: initialData?.clinicianResponsible || user?.email || '',
        timer: initialData?.timer || { screen1Seconds: 0, screen2Seconds: 0, screen3Seconds: 0, screen4Seconds: 0, screen5Seconds: 0, totalSeconds: 0, startedAt: new Date().toISOString() },
        interview: (initialData as any)?.interview || { focos: [], psfs: [] },
        guidedExam: (initialData as any)?.guidedExam || {},
        autoSynthesis: (initialData as any)?.autoSynthesis || {},
        geminiDiagnostic: (initialData as any)?.geminiDiagnostic || {},
        reevaluation: (initialData as any)?.reevaluation || {},
        ...initialData
    });

    // Auto-create first focus if empty
    useEffect(() => {
        if (!isEditMode && (!formData.interview?.focos || formData.interview.focos.length === 0)) {
            const newFoco = {
                id: generateId(),
                isPrincipal: true,
                region: '',
                side: 'N/A',
                onsetType: '',
                onsetDuration: '',
                course2w: '',
                mainLimitation: '',
                freeNarrative: '',
                painScaleId: 'EVA',
                painCurrent: '',
                painWorst24h: '',
                painBest24h: '',
                pattern24h: '',
                morningStiffness: '',
                wakesAtNight: false,
                afterEffectFreq: 'Nunca',
                settlingTime: '',
                provocationEase: 'Media',
                symptomNature: [],
                symptomRadiates: 'Local',
                symptomAssociated: [],
                psfs: [],
                fastIcfActivities: [],
                sportContextActive: false,
                prevTreatmentsTags: []
            } as unknown as KineFocusArea;
            setFormData((prev: any) => ({
                ...prev,
                interview: {
                    ...prev.interview,
                    focos: [newFoco],
                    psfs: []
                }
            }));
        }
    }, [isEditMode, formData.interview?.focos]);

    const updateFormData = (patch: Partial<Evaluacion> | ((prev: Partial<Evaluacion>) => Partial<Evaluacion>)) => {
        setFormData((prev: any) => typeof patch === 'function' ? patch(prev) : { ...prev, ...patch });
    };

    const getValidationContext = useMemo(() => {
        const missing: string[] = [];

        if (type === 'INITIAL') {
            const fd = formData as EvaluacionInicial;
            const hasFocos = (fd.interview?.focos?.length || 0) > 0;
            if (!hasFocos) missing.push("Foco Principal de Consulta");

            // PSFS may be inside the new `focos` array or in the legacy `interview.psfs` array
            const hasPsfsParams = ((fd as any).interview?.psfs?.length || 0) > 0;
            const hasFocosPsfs = fd.interview?.focos?.some(f => f.psfs && f.psfs.length > 0) || false;
            const hasPsfs = hasPsfsParams || hasFocosPsfs;
            if (!hasPsfs) missing.push("Al menos 1 PSFS (Escala Funcional)");

            // Comparable sign may be inside new `primaryComparable` or legacy fields
            const hasComparableV2 = (fd.guidedExam?.comparableRetest?.length || 0) > 0 || !!((fd as any).comparableSign?.name);
            const hasComparableFoco = fd.interview?.focos?.some(f => f.primaryComparable && f.primaryComparable.name) || false;
            const hasComparable = hasComparableV2 || hasComparableFoco;

            if (!hasComparable) missing.push("Signo Comparable (Asterisco)");

            const hasSx = (fd.autoSynthesis?.structuralSuspicions?.length || 0) > 0;
            if (!hasSx) missing.push("Sospecha Estructural (P3)");

            const hasTraffic = !!(fd.autoSynthesis?.trafficLight);
            if (!hasTraffic) missing.push("Semáforo de Carga");

            const hasDx = !!(fd.geminiDiagnostic?.kinesiologicalDxNarrative?.trim());
            if (!hasDx) missing.push("Diagnóstico Narrativo");

            const hasSmartObs = (fd.geminiDiagnostic?.objectivesSmart?.length || 0) > 0;
            if (!hasSmartObs) missing.push("Objetivos SMART");

            return {
                allValid: missing.length === 0,
                missing,
                hasFocos, hasDx, hasSmartObs // legacy retrocompatibilidad visual tabs
            };
        } else {
            const fd = formData as EvaluacionReevaluacion;
            const hasProgress = !!(fd.reevaluation?.progressSummary?.trim());
            if (!hasProgress) missing.push("Resumen del Retest y Progreso");

            const hasMods = !!(fd.reevaluation?.planModifications?.trim());
            if (!hasMods) missing.push("Modificaciones al Plan Activo");

            return {
                allValid: missing.length === 0,
                missing,
                hasFocos: true, hasDx: true, hasSmartObs: true // fake legacy
            };
        }
    }, [formData, type]);

    const handleSave = async (isClosing: boolean = false) => {
        if (!globalActiveYear || !user) return;

        if (isClosing && !getValidationContext.allValid) {
            alert("⚠️ EXISTEN HITOS CLÍNICOS PENDIENTES\\n\\nFalta completar:\\n - " + getValidationContext.missing.join('\\n - ') + "\\n\\nNo puedes cerrar la evaluación hasta completarlos.");
            return;
        }
        if (isClosing && !window.confirm("¿Seguro que deseas Cerrar y Fijar esta evaluación? Generará el Set de Objetivos inmutable del Proceso.")) {
            return;
        }

        if (isClosing && secondsElapsed > 1800) {
            window.alert(`Sugerencia de Eficiencia: Has tomado ${formatTime(secondsElapsed)} minutos en evaluar. Considera enfocar la entrevista y delegar el examen detallado en la próxima sesión (Time-Box ideal: < 30 min)`);
        }

        try {
            setLoading(true);
            const targetId = isEditMode ? initialData!.id! : generateId();

            const payload: Evaluacion = {
                ...formData as Evaluacion,
                id: targetId,
                status: isClosing ? 'CLOSED' : 'DRAFT',
                timer: {
                    ...(formData.timer || { totalSeconds: 0 } as any),
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

            if (isClosing && type === 'INITIAL') {
                const fd = payload as EvaluacionInicial;
                const versionId = `v_${Date.now()}`;
                const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
                await setDoc(procesoRef, {
                    estado: 'ACTIVO',
                    activeEvaluationId: targetId,
                    activeEvaluationIndexId: targetId,
                    activeObjectiveSetVersionId: versionId,
                    diagnosisVigente: fd.geminiDiagnostic?.kinesiologicalDxNarrative || '',
                    flags: {
                        redFlagsSummary: (fd as any).interview?.redFlagsAction || '',
                        consideracionesClinicas: fd.geminiDiagnostic?.clinicalConsiderations || []
                    },
                    loadManagementVigente: {
                        trafficLight: fd.autoSynthesis?.trafficLight || 'Verde',
                        rules: []
                    },
                    caseSnapshot: { // M13 Snapshot equivalente mejorado
                        summary: fd.geminiDiagnostic?.kinesiologicalDxNarrative || '',
                        lastUpdated: new Date().toISOString(),
                        trafficLight: fd.autoSynthesis?.trafficLight || 'Verde',
                        baselineComparable: (fd.guidedExam?.comparableRetest && fd.guidedExam.comparableRetest.length > 0)
                            ? fd.guidedExam.comparableRetest[0]
                            : ((fd as any).comparableSign || null),
                        psfsBaseline: (fd as any).interview?.psfs || [],
                        topDeficits: fd.autoSynthesis?.functionalDeficits || []
                    },
                    activeObjectiveSet: {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: fd.geminiDiagnostic?.objectivesSmart?.map(o => ({
                            id: generateId(),
                            label: o.text,
                            status: 'activo'
                        })) || []
                    }
                }, { merge: true });
                await setDoc(docRef, { activeObjectiveSetVersionId: versionId }, { merge: true });

                // FASE 2.2.6: Despachar Outcomes iniciales (PSFS y SANE opcional)
                if ((fd as any).interview?.psfs && (fd as any).interview.psfs.length > 0) {
                    const outcomeId = `psfs_${Date.now()}`;
                    await OutcomesService.save(globalActiveYear, procesoId, {
                        id: outcomeId,
                        procesoId,
                        usuariaId,
                        type: 'PSFS',
                        capturedAt: new Date().toISOString(),
                        context: 'EVALUACION_INICIAL',
                        values: { items: (fd as any).interview.psfs },
                        createdByUid: user.uid,
                        createdAt: new Date().toISOString()
                    }).catch(err => console.error("Error saving PSFS outcome:", err));
                }

                if (fd.interview?.sane !== undefined && fd.interview.sane > 0) {
                    const outcomeId = `sane_${Date.now()}`;
                    await OutcomesService.save(globalActiveYear, procesoId, {
                        id: outcomeId,
                        procesoId,
                        usuariaId,
                        type: 'SANE',
                        capturedAt: new Date().toISOString(),
                        context: 'EVALUACION_INICIAL',
                        values: { score: fd.interview.sane },
                        createdByUid: user.uid,
                        createdAt: new Date().toISOString()
                    }).catch(err => console.error("Error saving SANE outcome:", err));
                }

            } else if (isClosing && type === 'REEVALUATION') {
                const fd = payload as EvaluacionReevaluacion;
                const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);

                const updatePayload: Record<string, any> = {
                    "caseSnapshot.lastUpdated": new Date().toISOString(),
                    "caseSnapshot.lastProgressSummary": fd.reevaluation?.progressSummary || '',
                    // FASE 2.2.5 Guardar retrospectiva
                    "caseSnapshot.lastRetest": typeof fd.reevaluation?.retest === 'string' ? fd.reevaluation.retest : JSON.stringify(fd.reevaluation?.retest || '')
                };

                if (typeof fd.reevaluation?.retest === 'object' && fd.reevaluation.retest?.psfsScores) {
                    updatePayload["caseSnapshot.psfsLast"] = fd.reevaluation.retest.psfsScores;
                }

                // FASE 2.2.4: Actualizar dx vigente si fue modificado
                if ((fd as any).geminiDiagnostic?.kinesiologicalDxNarrative) {
                    updatePayload.diagnosisVigente = (fd as any).geminiDiagnostic.kinesiologicalDxNarrative;
                }

                // FASE 2.2.4: Actualizar semáforo si fue modificado
                if ((fd as any).autoSynthesis?.trafficLight) {
                    updatePayload["loadManagementVigente.trafficLight"] = (fd as any).autoSynthesis.trafficLight;
                }

                // FASE 2.2.4: Crear nueva versión de objetivos si hay nuevos
                // FASE 2.2.4 / 2.2.5: Crear nueva versión de objetivos si hay nuevos
                let versionId = null;
                // Intentar leer targets de objetivos editados en reevaluación (Screen5)
                const newObjectives = (fd as any).geminiDiagnostic?.objectivesSmart || (fd.reevaluation as any)?.updatedObjectives;
                if (newObjectives && newObjectives.length > 0) {
                    versionId = `v_${Date.now()}`;
                    updatePayload.activeObjectiveSetVersionId = versionId;
                    updatePayload.activeObjectiveSet = {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: newObjectives.map((o: any) => ({
                            id: o.id || generateId(),
                            label: o.text || o.label,
                            status: o.status || 'activo'
                        }))
                    };
                }

                await setDoc(procesoRef, updatePayload, { merge: true });
                if (versionId) {
                    await setDoc(docRef, { activeObjectiveSetVersionId: versionId }, { merge: true });
                }

                // FASE 2.2.6: Despachar Outcomes de Reevaluación (PSFS, SANE, GROC opcionales)
                const rTest = fd.reevaluation?.retest;
                if (rTest && typeof rTest === 'object') {
                    if (rTest.psfsScores && rTest.psfsScores.length > 0) {
                        await OutcomesService.save(globalActiveYear, procesoId, {
                            id: `psfs_re_${Date.now()}`,
                            procesoId,
                            usuariaId,
                            type: 'PSFS',
                            capturedAt: new Date().toISOString(),
                            context: 'REEVALUACION',
                            values: { items: rTest.psfsScores },
                            createdByUid: user.uid,
                            createdAt: new Date().toISOString()
                        }).catch(err => console.error("Error saving PSFS outcome in reeval:", err));
                    }
                    if (rTest.saneScore !== undefined && rTest.saneScore > 0) {
                        await OutcomesService.save(globalActiveYear, procesoId, {
                            id: `sane_re_${Date.now()}`,
                            procesoId,
                            usuariaId,
                            type: 'SANE',
                            capturedAt: new Date().toISOString(),
                            context: 'REEVALUACION',
                            values: { score: rTest.saneScore },
                            createdByUid: user.uid,
                            createdAt: new Date().toISOString()
                        }).catch(err => console.error("Error saving SANE outcome in reeval:", err));
                    }
                    if (rTest.grocScore !== undefined && rTest.grocScore !== 0) {
                        await OutcomesService.save(globalActiveYear, procesoId, {
                            id: `groc_re_${Date.now()}`,
                            procesoId,
                            usuariaId,
                            type: 'GROC',
                            capturedAt: new Date().toISOString(),
                            context: 'REEVALUACION',
                            values: { score: rTest.grocScore },
                            createdByUid: user.uid,
                            createdAt: new Date().toISOString()
                        }).catch(err => console.error("Error saving GROC outcome in reeval:", err));
                    }
                }
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

    const SCREENS = type === 'INITIAL' ? [
        { id: 1, label: 'P1: Entrevista', icon: '🗣️' },
        { id: 2, label: 'P2: Examen Físico', icon: '🩺' },
        { id: 3, label: 'P3: Síntesis / Clasific.', icon: '⚖️' },
        { id: 4, label: 'P4: IA Gemini + Metas', icon: '🤖', warning: !getValidationContext.hasDx || !getValidationContext.hasSmartObs }
    ] : [
        { id: 5, label: 'Retest y Reevaluación', icon: '🔄' }
    ];

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

                {/* TOP BAR MOBILE-FIRST STICKY */}
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
                            <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isClosed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isClosed ? 'Cerrada' : 'Borrador'}
                            </div>
                            {/* Semáforo Load Traffic Light Solo en INITIAL o si existe */}
                            {type === 'INITIAL' && (
                                <div className="flex gap-0.5 items-center bg-slate-100 px-1.5 py-1 rounded-md border border-slate-200">
                                    <span className={`w-2 h-2 rounded-full ${(formData as EvaluacionInicial).autoSynthesis?.trafficLight === 'Verde' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-slate-300'} transition-all`} />
                                    <span className={`w-2 h-2 rounded-full ${(formData as EvaluacionInicial).autoSynthesis?.trafficLight === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.8)]' : 'bg-slate-300'} transition-all`} />
                                    <span className={`w-2 h-2 rounded-full ${(formData as EvaluacionInicial).autoSynthesis?.trafficLight === 'Rojo' ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]' : 'bg-slate-300'} transition-all`} />
                                </div>
                            )}
                        </div>

                        {/* PILL CRONÓMETRO */}
                        {!isClosed && (
                            <div className={`flex items-center shrink-0 gap-1.5 text-xs font-mono font-bold px-2 md:px-3 py-1 md:py-1.5 rounded-lg border shadow-inner cursor-pointer hover:opacity-80 transition-opacity ${getTimerColor(secondsElapsed)}`} title="Tiempo Global de Evaluación">
                                <svg className="w-3.5 h-3.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {formatTime(secondsElapsed)}
                            </div>
                        )}
                        <button onClick={() => setIsPerfilDrawerOpen(true)} className="hidden md:flex shrink-0 text-white bg-slate-800 hover:bg-slate-900 font-bold text-xs items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                            <span>📇</span> Perfil Permanente (Remoto)
                        </button>
                    </div>
                </div>

                {/* NAVEGACION HORIZONTAL ENTRE PANTALLAS */}
                <div className="bg-white border-b border-slate-200 shadow-sm z-40 relative">
                    <div className="flex overflow-x-auto gap-2 px-3 md:px-6 py-2.5 items-center custom-scrollbar">
                        {SCREENS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setScreen(s.id)}
                                className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-bold transition-all border whitespace-nowrap ${screen === s.id
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

                    {screen === 5 && type === 'REEVALUATION' && <Screen5_Reevaluacion procesoContext={procesoContext} formData={formData} updateFormData={updateFormData as any} isClosed={isClosed} onProceed={() => setScreen(1)} onCreateNewInitial={() => {
                        handleSave(false);
                        alert("Borrador de Reevaluación guardado. Por favor, crea una 'Nueva Evaluación Inicial' desde el Panel del Proceso Clínico.");
                        onClose();
                    }} />}
                    {screen === 1 && type === 'INITIAL' && <Screen1_Entrevista formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 2 && type === 'INITIAL' && <Screen2_Examen formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 3 && type === 'INITIAL' && <Screen3_Sintesis formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 4 && type === 'INITIAL' && <Screen4_Diagnostico formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}

                </div>

                {/* BOTTOM BAR STICKY */}
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
                                {getValidationContext.allValid ? 'Fijar y Cerrar' : 'Revisar Cierre'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
