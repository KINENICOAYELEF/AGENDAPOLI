import React, { useState, useEffect, useMemo, useRef } from "react";
import { Evaluacion, KineFocusArea, EvaluacionInicial, EvaluacionReevaluacion, Proceso } from "@/types/clinica";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { OutcomesService } from "@/services/outcomes";
import { normalizeEvaluationState, buildCompactPhysicalForAI, buildCompactInterviewForAI } from "@/lib/state-normalizer";
import { sanitizeForFirestoreDeep, resolveSafeAudit } from "@/lib/firebase-utils";

// Nuevas 5 Pantallas Integrales
import { Screen1_Entrevista } from "./evaluacion-steps/Screen1_Entrevista";
import { Screen2_Examen } from "./evaluacion-steps/Screen2_Examen";
import { Screen3_Sintesis } from "./evaluacion-steps/Screen3_Sintesis";
import { Screen4_Diagnostico } from "./evaluacion-steps/Screen4_Diagnostico";
import { Screen5_Reevaluacion } from "./evaluacion-steps/Screen5_Reevaluacion";
// P1.5 Anamnesis Remota Integrada
import { Screen15_AnamnesisRemota } from "./evaluacion-steps/Screen15_AnamnesisRemota";
// Perfil permanente (Fase 37 - Ya deprecado su uso lateral, mantenido archivo por ref local si acaso)
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

    // Save Feedback State
    const [saveFeedback, setSaveFeedback] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);
    const [lastSaveError, setLastSaveError] = useState<string | null>(null);
    const isSavingRef = useRef(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // TEMPORIZADOR CLINICO DOCENTE (Pill)
    const [secondsElapsed, setSecondsElapsed] = useState(initialData?.timer?.totalSeconds || 0);

    // KEYBOARD AWARE STATE (PROMPT 3)
    const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

    useEffect(() => {
        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                setIsKeyboardOpen(true);
            }
        };
        const handleFocusOut = () => {
            setIsKeyboardOpen(false);
        };
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    }, []);

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
    const handleExportJSON = () => {
        try {
            const exportPayload = {
                meta: {
                    app: "Polideportivo",
                    exportedAt: new Date().toISOString(),
                    patientId: usuariaId,
                    episodeId: procesoId,
                    evaluationStatus: formData?.status || 'DRAFT',
                    schemaVersion: "2.5"
                },
                payload: formData
            };

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", `eval_${usuariaId}_${Date.now()}.json`);
            document.body.appendChild(dlAnchorElem);
            dlAnchorElem.click();
            document.body.removeChild(dlAnchorElem);
            
            setSaveFeedback({ message: "JSON descargado correctamente", type: 'success' });
            setTimeout(() => setSaveFeedback(null), 3000);
        } catch (error) {
            console.error(error);
            setSaveFeedback({ message: "Error al exportar JSON", type: 'error' });
            setTimeout(() => setSaveFeedback(null), 3000);
        }
    };

    const [importKey, setImportKey] = useState(0);

    const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result as string;
                const parsed = JSON.parse(result);
                
                if (!parsed.payload) {
                    throw new Error("Formato inválido: falta la llave 'payload'.");
                }

                if (window.confirm("Cargar este archivo JSON reemplazará el estado actual de toda la evaluación en pantalla. ¿Deseas continuar?")) {
                    setFormData(parsed.payload);
                    setImportKey(prev => prev + 1); // Force remount of current screen
                    setSaveFeedback({ message: "JSON cargado correctamente", type: 'success' });
                    setTimeout(() => setSaveFeedback(null), 3000);
                }
            } catch (error) {
                console.error("Error importando JSON:", error);
                setSaveFeedback({ message: "No se pudo cargar el archivo JSON. Formato inválido.", type: 'error' });
                setTimeout(() => setSaveFeedback(null), 4000);
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleLogAdminPayloads = () => {
        const nc = normalizeEvaluationState(formData);
        const pi = buildCompactInterviewForAI(nc, formData.interview);
        const pp = buildCompactPhysicalForAI(nc);
        console.group("📡 [ADMIN TELEMETRY] - Payload Inspection");
        console.log("🟦 Normalized Case Tree:", nc);
        console.log("🟧 Compact Interview (P1):", pi);
        console.log("🟩 Compact Physical Exam (P2):", pp);
        console.groupEnd();
        alert("Payloads estructurados impresos en la consola del navegador.");
    };

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
        p4_plan_structured: (initialData as any)?.p4_plan_structured || {},
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
        setFormData((prev: any) => {
            const updates = typeof patch === 'function' ? patch(prev) : patch;
            return { ...prev, ...updates };
        });
    };

    // FASE 28: Global debounced auto-save para prevenir pérdida de datos en Refresh (P3, P4)
    useEffect(() => {
        if (!formData.id || !globalActiveYear || isClosed || isSavingRef.current) return;
        
        // Si hubo un error crítico de guardado (como inconsistencia de tipos), detenemos el autoguardado 
        // hasta que haya un cambio manual que resetee el error o se intente manual.
        if (lastSaveError) return;

        const timer = setTimeout(() => {
            handleSave(false, true).catch(err => {
                console.error("Silent auto-save failed", err);
                setLastSaveError(err.message || String(err));
            });
        }, 8000); // 8 segundos para evitar saturación
        
        return () => clearTimeout(timer);
    }, [formData, isClosed, globalActiveYear, lastSaveError]);

    const getValidationContext = useMemo(() => {
        const missing: string[] = [];
        const warnings: string[] = [];

        if (type === 'INITIAL') {
            const normalizedCase = normalizeEvaluationState(formData);
            const fd = formData as EvaluacionInicial;

            const hasFocosV4 = (fd.interview?.v4?.focos?.length || 0) > 0;
            const hasFocosV3 = (fd.interview?.v3?.focos?.length || 0) > 0;
            const hasFocos = hasFocosV4 || hasFocosV3;
            if (!hasFocos) missing.push("Foco Principal de Consulta");

            // PSFS may be inside the new `v4.psfsGlobal`, `focos` array or in the legacy `interview.psfs` array
            const hasPsfsV4 = (fd.interview?.v4?.psfsGlobal?.length || 0) > 0;
            const hasPsfsParams = ((fd as any).interview?.psfs?.length || 0) > 0;
            const hasFocosPsfs = fd.interview?.v3?.focos?.some(f => f.funcionMeta?.psfsItems?.length > 0) || false;
            const hasPsfs = hasPsfsV4 || hasPsfsParams || hasFocosPsfs;
            if (!hasPsfs) missing.push("Al menos 1 PSFS (Escala Funcional)");

            // Comparable sign through Normalized State
            const hasComparable = !!normalizedCase.tareaIndice;

            if (!hasComparable) {
                warnings.push("Signo Comparable/Tarea Índice no definida (Sugerido)");
                // Strict block ONLY if there are absolutely no findings
                const physicalFindings = buildCompactPhysicalForAI(normalizedCase);
                const hasAnyFinding = Object.keys(physicalFindings).some(key => key !== 'tareaIndiceTarget' && key !== 'indiciosGlobales');
                
                if (!hasAnyFinding) {
                    missing.push("Debe registrar al menos un hallazgo clínico (Observación, ROM, etc.) o una Tarea Índice en Examen Físico (P2).");
                }
            }

            const hasSx = (fd.autoSynthesis?.alteraciones_detectadas?.estructurales?.length || (fd.autoSynthesis as any)?.alterations?.structural?.length || 0) > 0;
            if (!hasSx) missing.push("Clasificación Estructuras (P3)");

            const hasTraffic = !!(fd.autoSynthesis?.trafficLight);
            if (!hasTraffic) missing.push("Semáforo de Carga");

            const hasDx = !!(fd.p4_plan_structured?.diagnostico_kinesiologico_narrativo?.trim() || fd.geminiDiagnostic?.narrativeDiagnosis?.trim() || fd.geminiDiagnostic?.kinesiologicalDxNarrative?.trim());
            if (!hasDx) missing.push("Diagnóstico Narrativo");

            const hasSmartObs = (fd.p4_plan_structured?.objetivos_smart?.length || fd.geminiDiagnostic?.smartGoals?.length || fd.geminiDiagnostic?.objectivesSmart?.length || 0) > 0;
            if (!hasSmartObs) missing.push("Objetivos SMART");

            // Validación FASE 45: P1.5 Anamnesis Remota Mínima
            const rh = fd.remoteHistorySnapshot;
            const hasCondRelevante = (rh?.medicalHistory?.condicionesClinicasRelevantes?.length || 0) > 0;
            const hasMsk = (rh?.mskHistory?.relevantInjuries?.length || 0) > 0 || !!rh?.mskHistory?.mskSurgeries?.length || !!rh?.mskHistory?.persistentSequelae?.trim();
            const hasBaseActivity = !!rh?.baseActivity?.primarySport?.trim() || !!rh?.baseActivity?.categoria?.trim();
            const hasOcupacion = !!rh?.occupationalContext?.mainRole?.trim();

            const hasRemoteMinimo = hasCondRelevante || hasMsk || hasBaseActivity || hasOcupacion;
            if (!hasRemoteMinimo) missing.push("P1.5 Remota: Completar al menos Ocupación, Actividad Física, Cond. Clínica o MSK Previo");

            return {
                allValid: missing.length === 0,
                missing,
                warnings,
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
                warnings,
                hasFocos: true, hasDx: true, hasSmartObs: true // fake legacy
            };
        }
    }, [formData, type]);

    const handleSave = async (isClosing: boolean = false, isSilent: boolean = false) => {
        if (!globalActiveYear || !user) return;
        if (isSavingRef.current) return; // Prevent concurrent saves

        if (isClosing && !getValidationContext.allValid) {
            const warnMsg = (getValidationContext as any).warnings && (getValidationContext as any).warnings.length > 0 
                ? `\n\n⚠️ ADVERTENCIAS:\n - ${(getValidationContext as any).warnings.join('\n - ')}` 
                : '';
            const confirmSave = window.confirm("🛑 EXISTEN HITOS CLÍNICOS PENDIENTES\n\nFalta completar:\n - " + getValidationContext.missing.join('\n - ') + warnMsg + "\n\n¿Deseas forzar el guardado definitivo de todas maneras?");
            if (!confirmSave) return;
        }
        if (isClosing && !window.confirm("¿Seguro que deseas Cerrar y Fijar esta evaluación? Generará el Set de Objetivos inmutable del Proceso.")) {
            return;
        }

        if (isClosing && secondsElapsed > 1800) {
            window.alert(`Sugerencia de Eficiencia: Has tomado ${formatTime(secondsElapsed)} minutos en evaluar. Considera enfocar la entrevista y delegar el examen detallado en la próxima sesión (Time-Box ideal: < 30 min)`);
        }

        try {
            isSavingRef.current = true;
            if (!isSilent) setLoading(true);
            const targetId = formData.id || (isEditMode ? initialData!.id! : generateId());

            if (!formData.id) {
                // FASE 1.3: Si es primer guardado de nuevo registro, refrescar el timestamp para evitar colisiones 
                // con otras evaluaciones abiertas al mismo tiempo.
                const freshSessionAt = new Date().toISOString();
                updateFormData({ id: targetId, sessionAt: freshSessionAt });
                formData.id = targetId;
                formData.sessionAt = freshSessionAt;
            }

            const payload: Evaluacion = {
                ...formData as Evaluacion,
                id: targetId,
                status: isClosing ? 'CLOSED' : 'DRAFT',
                timer: {
                    ...(formData.timer || { totalSeconds: 0 } as any),
                    totalSeconds: secondsElapsed
                },
                audit: resolveSafeAudit(initialData?.audit, formData.audit, user.uid, isClosing)
            };
            
            const sanitizedPayload = sanitizeForFirestoreDeep(payload);

            const docRef = doc(db, "programs", globalActiveYear, "evaluaciones", targetId);
            await setDoc(docRef, sanitizedPayload, { merge: true });

            setLastSaveError(null); // Reset error on success

            // FASE 39: Automatización de Guardado Remoto Basal
            if (payload.remoteHistorySnapshot && usuariaId) {
                const personaRef = doc(db, "programs", globalActiveYear, "usuarias", usuariaId);
                const sanitizedPersona = sanitizeForFirestoreDeep({
                    remoteHistory: {
                        ...(payload.remoteHistorySnapshot as any),
                        lastUpdated: new Date().toISOString(),
                        updatedByClinician: user.email || 'Desconocido'
                    }
                });
                await setDoc(personaRef, sanitizedPersona, { merge: true }).catch(err => console.error("Error auto-guardando anamnesis remota en persona:", err));
            }

            if (isClosing && type === 'INITIAL') {
                const fd = payload as EvaluacionInicial;
                const versionId = `v_${Date.now()}`;
                const procesoRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
                
                // FASE 2.2.4: Master Traffic Light (Agregado de Seguridad, Irritabilidad y Carga)
                const getMasterTL = (f: any) => {
                    const s = f.autoSynthesis?.trafficLight || 'Verde';
                    const i = f.autoSynthesis?.snapshot_clinico?.irritabilidad_sugerida === 'Alta' ? 'Rojo' : 
                              f.autoSynthesis?.snapshot_clinico?.irritabilidad_sugerida === 'Media' ? 'Amarillo' : 'Verde';
                    const c = (f.autoSynthesis?.snapshot_clinico?.tolerancia_carga?.nivel === 'Baja') ? 'Rojo' :
                              (f.autoSynthesis?.snapshot_clinico?.tolerancia_carga?.nivel === 'Media') ? 'Amarillo' : 'Verde';
                    const w: Record<string, number> = { 'Rojo': 3, 'Amarillo': 2, 'Verde': 1 };
                    return [s, i, c].sort((a, b) => w[b] - w[a])[0] as 'Verde' | 'Amarillo' | 'Rojo';
                };
                const finalTL = getMasterTL(fd);

                // 1. Sincronizar estado del Proceso
                const updatePayload = sanitizeForFirestoreDeep({
                    estado: 'ACTIVO',
                    activeEvaluationId: targetId,
                    activeEvaluationIndexId: targetId,
                    activeObjectiveSetVersionId: versionId,
                    diagnosisVigente: fd.p4_plan_structured?.diagnostico_kinesiologico_narrativo || fd.geminiDiagnostic?.narrativeDiagnosis || fd.geminiDiagnostic?.kinesiologicalDxNarrative || '',
                    flags: {
                        redFlagsSummary: fd.interview?.v4?.seguridad?.detalleBanderas || '',
                        consideracionesClinicas: fd.p4_plan_structured?.pronostico_biopsicosocial?.justificacion_clinica_integral || []
                    },
                    loadManagementVigente: {
                        trafficLight: finalTL,
                        rules: []
                    },
                    caseSnapshot: { 
                        summary: fd.p4_plan_structured?.diagnostico_kinesiologico_narrativo || fd.geminiDiagnostic?.narrativeDiagnosis || fd.geminiDiagnostic?.kinesiologicalDxNarrative || '',
                        diagnosticoNarrativo: fd.p4_plan_structured?.diagnostico_kinesiologico_narrativo || fd.geminiDiagnostic?.narrativeDiagnosis || fd.geminiDiagnostic?.kinesiologicalDxNarrative || '',
                        lastUpdated: new Date().toISOString(),
                        trafficLight: finalTL,
                        baselineComparable: (fd.guidedExam?.comparableRetest && fd.guidedExam.comparableRetest.length > 0)
                            ? fd.guidedExam.comparableRetest[0]
                            : ((fd as any).comparableSign || null),
                        psfsBaseline: (fd as any).interview?.v4?.psfsGlobal || [],
                        topDeficits: fd.autoSynthesis?.alteraciones_detectadas?.funcionales?.map(a => a.funcion_disfuncion) || []
                    },
                    activeObjectiveSet: {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: (fd.p4_plan_structured?.objetivos_smart || fd.geminiDiagnostic?.smartGoals || fd.geminiDiagnostic?.objectivesSmart)?.map((o: any) => ({
                            id: o.id || generateId(),
                            label: o.texto || o.description || o.text || '',
                            status: o.status || 'activo'
                        })) || []
                    },
                    updatedAt: new Date().toISOString()
                });
                
                await setDoc(procesoRef, sanitizeForFirestoreDeep(updatePayload), { merge: true });

                // 2. Marcar la versión en la evaluación
                const sanitizedVersion = sanitizeForFirestoreDeep({ activeObjectiveSetVersionId: versionId });
                await setDoc(docRef, sanitizedVersion, { merge: true });

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

                if ((fd as any).interview?.sane !== undefined && (fd as any).interview.sane > 0) {
                    const outcomeId = `sane_${Date.now()}`;
                    await OutcomesService.save(globalActiveYear, procesoId, {
                        id: outcomeId,
                        procesoId,
                        usuariaId,
                        type: 'SANE',
                        capturedAt: new Date().toISOString(),
                        context: 'EVALUACION_INICIAL',
                        values: { score: (fd as any).interview.sane },
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
                if ((fd as any).p4_plan_structured?.diagnostico_kinesiologico_narrativo || (fd as any).geminiDiagnostic?.narrativeDiagnosis || (fd as any).geminiDiagnostic?.kinesiologicalDxNarrative) {
                    updatePayload.diagnosisVigente = (fd as any).p4_plan_structured?.diagnostico_kinesiologico_narrativo || (fd as any).geminiDiagnostic?.narrativeDiagnosis || (fd as any).geminiDiagnostic?.kinesiologicalDxNarrative;
                }

                // FASE 2.2.4: Actualizar semáforo si fue modificado (Master Traffic Light)
                const getMasterTL = (f: any) => {
                    const s = f.autoSynthesis?.trafficLight || 'Verde';
                    const i = f.autoSynthesis?.snapshot_clinico?.irritabilidad_sugerida === 'Alta' ? 'Rojo' : 
                              f.autoSynthesis?.snapshot_clinico?.irritabilidad_sugerida === 'Media' ? 'Amarillo' : 'Verde';
                    const c = (f.autoSynthesis?.snapshot_clinico?.tolerancia_carga?.nivel === 'Baja') ? 'Rojo' :
                              (f.autoSynthesis?.snapshot_clinico?.tolerancia_carga?.nivel === 'Media') ? 'Amarillo' : 'Verde';
                    const w: Record<string, number> = { 'Rojo': 3, 'Amarillo': 2, 'Verde': 1 };
                    return [s, i, c].sort((a, b) => w[b] - w[a])[0];
                };

                const finalTL = getMasterTL(fd);
                updatePayload["loadManagementVigente.trafficLight"] = finalTL;
                updatePayload["caseSnapshot.trafficLight"] = finalTL;

                // FASE 2.2.4.1: Actualizar baseline si el clínico marcó que cambió el signo comparable
                if (fd.reevaluation?.changedComparable && fd.reevaluation?.retest?.comparableSignResult) {
                    updatePayload["caseSnapshot.baselineComparable"] = fd.reevaluation.retest.comparableSignResult;
                }

                // FASE 2.2.4: Crear nueva versión de objetivos si hay nuevos
                // FASE 2.2.4 / 2.2.5: Crear nueva versión de objetivos si hay nuevos
                let versionId = null;
                // Intentar leer targets de objetivos editados en reevaluación (Screen5)
                const newObjectives = (fd as any).p4_plan_structured?.objetivos_smart || (fd as any).geminiDiagnostic?.smartGoals || (fd as any).geminiDiagnostic?.objectivesSmart || (fd.reevaluation as any)?.updatedObjectives;
                if (newObjectives && newObjectives.length > 0) {
                    versionId = `v_${Date.now()}`;
                    updatePayload.activeObjectiveSetVersionId = versionId;
                    updatePayload.activeObjectiveSet = {
                        versionId,
                        updatedAt: new Date().toISOString(),
                        objectives: newObjectives.map((o: any) => ({
                            id: o.id || generateId(),
                            label: o.texto || o.text || o.label || o.description,
                            status: o.status || 'activo'
                        }))
                    };
                }

                await setDoc(procesoRef, sanitizeForFirestoreDeep(updatePayload), { merge: true });
                if (versionId) {
                    const sanitizedVersion = sanitizeForFirestoreDeep({ activeObjectiveSetVersionId: versionId });
                    await setDoc(docRef, sanitizedVersion, { merge: true });
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

            if (isClosing) {
                if (onSaveSuccess) onSaveSuccess(payload, !isEditMode && formData.id !== targetId); 
            }
        } catch (error: any) {
            console.error("Error guardando evaluación:", error);
            setLastSaveError(error.message || String(error));
            if (!isSilent) {
                setSaveFeedback({ message: 'Error al persistir', type: 'error' });
                alert(`Hubo un error al guardar la evaluación: ${error.message || "Revisa tu conexión"}`);
            }
        } finally {
            isSavingRef.current = false;
            if (!isSilent) {
                setLoading(false);
                setSaveFeedback({ message: isClosing ? 'Cerrada y Fijada' : 'Borrador persistido al 100%', type: 'success' });
                setTimeout(() => setSaveFeedback(null), 3500);
            } else {
                setSaveFeedback({ message: 'Autoguardado', type: 'success' });
                setTimeout(() => setSaveFeedback(null), 1500);
            }
        }
    };

    const handleTabChange = (targetScreenId: number) => {
        if (!isClosed) {
            handleSave(false, true).catch(e => console.error("Error auto-saving on tab change", e));
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setScreen(targetScreenId);
    };

    const SCREENS = type === 'INITIAL' ? [
        { id: 1, label: 'P1: Entrevista', icon: '🗣️' },
        { id: 15, label: 'P1.5: Anam. Remota', icon: '📇' },
        { id: 2, label: 'P2: Examen Físico', icon: '🩺' },
        { id: 3, label: 'P3: Síntesis / Clasific.', icon: '⚖️' },
        { id: 4, label: 'P4: IA Gemini + Metas', icon: '🤖', warning: !getValidationContext.hasDx || !getValidationContext.hasSmartObs }
    ] : [
        { id: 15, label: 'Anamnesis Remota', icon: '📇' },
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
            <div className="flex flex-col flex-1 h-[100dvh] relative w-full overflow-hidden">

                {/* TOP BAR MOBILE-FIRST STICKY */}
                <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2 md:py-3 gap-2 w-full max-w-5xl mx-auto">
                    <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-3">
                        <div className="flex items-center gap-3">
                            <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors shrink-0">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                            <div>
                                <h2 className="text-sm md:text-base font-black text-slate-800 leading-tight">
                                    {type === 'INITIAL' ? 'Eval. Inicial V2' : 'Reevaluación V2'}
                                </h2>
                                <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 font-medium whitespace-nowrap">
                                    <span>P: {procesoId.slice(0, 4)}</span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className={`${getValidationContext.allValid ? 'text-emerald-600 font-bold' : 'text-amber-500'}`}>
                                        {getValidationContext.allValid ? 'Hitos OK' : '1+ Hitos Pendientes'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Botón flotante M3 móvil DEPRECADO 
                        <button onClick={() => setIsPerfilDrawerOpen(true)} className="md:hidden text-indigo-600 font-bold text-xs flex items-center gap-1 bg-indigo-50 px-2.5 py-1.5 rounded-lg border border-indigo-100">
                            <span>📇</span> Perfil
                        </button>
                        */}
                    </div>

                    <div className="flex items-center gap-2 justify-between w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
                        <div className="flex items-center gap-1.5 shrink-0">
                            <div className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${isClosed ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                {isClosed ? 'Cerrada' : 'Borrador'}
                            </div>
                            {/* Semáforo Load Traffic Light Solo en INITIAL, REEVALUATION o si existe */}
                            {(type === 'INITIAL' || type === 'REEVALUATION') && (
                                <div className="flex gap-0.5 items-center bg-slate-100 px-1.5 py-1 rounded-md border border-slate-200" title="Semáforo de Irritabilidad / Manejo de Carga">
                                    <span className={`w-2 h-2 rounded-full ${(formData as any).autoSynthesis?.trafficLight === 'Verde' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]' : 'bg-slate-300'} transition-all`} />
                                    <span className={`w-2 h-2 rounded-full ${(formData as any).autoSynthesis?.trafficLight === 'Amarillo' ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.8)]' : 'bg-slate-300'} transition-all`} />
                                    <span className={`w-2 h-2 rounded-full ${(formData as any).autoSynthesis?.trafficLight === 'Rojo' ? 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.8)]' : 'bg-slate-300'} transition-all`} />
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
                        {/* Botón Perfil Permanente DEPRECADO Desktop
                        <button onClick={() => setIsPerfilDrawerOpen(true)} className="hidden md:flex shrink-0 text-white bg-slate-800 hover:bg-slate-900 font-bold text-xs items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                            <span>📇</span> Perfil Permanente (Remoto)
                        </button>
                        */}
                    </div>
                </div>

                {/* NAVEGACION HORIZONTAL ENTRE PANTALLAS (TABS) */}
                <div className="bg-white px-2 sm:px-6 py-3 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-40 shadow-sm gap-3">

                    <div className="flex overflow-x-auto gap-2 px-3 md:px-6 py-2.5 items-center w-full max-w-5xl mx-auto custom-scrollbar hide-scrollbar scroll-smooth">
                        {SCREENS.map(s => (
                            <button
                                key={s.id}
                                onClick={() => handleTabChange(s.id)}
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

                {/* PANEL DE ADMINISTRADOR: IMPORT/EXPORT JSON */}
                {((user?.role as string) === 'ADMIN' || user?.role === 'DOCENTE') && (
                    <div className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-col sm:flex-row shadow-sm gap-3 z-30">
                        <div className="flex items-center gap-3 text-amber-900 flex-1">
                            <span className="text-2xl">🛠️</span>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider">Herramientas de respaldo y prueba</h4>
                                <p className="text-[11px] opacity-80 leading-tight">Módulo Admin/Docente. Exporta/Importa la evaluación completa.</p>
                            </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button onClick={handleExportJSON} className="flex-1 sm:flex-none bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Descargar JSON
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                Cargar JSON
                            </button>
                            <button onClick={handleLogAdminPayloads} className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                Imprimir Tokens
                            </button>
                            <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportJSON} className="hidden" />
                        </div>
                    </div>
                )}

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
                <div key={importKey} className={`flex-1 overflow-y-auto ${isKeyboardOpen ? 'pb-40' : 'pb-32'} pt-4 sm:pt-6 px-0 sm:px-6 max-w-5xl mx-auto w-full transition-all duration-300`}>

                    {screen === 5 && type === 'REEVALUATION' && <Screen5_Reevaluacion procesoContext={procesoContext} formData={formData} updateFormData={updateFormData as any} isClosed={isClosed} onProceed={() => setScreen(1)} onCreateNewInitial={() => {
                        handleSave(false);
                        alert("Borrador de Reevaluación guardado. Por favor, crea una 'Nueva Evaluación Inicial' desde el Panel del Proceso Clínico.");
                        onClose();
                    }} />}

                    {/* VISTA 1.5 ANAMNESIS REMOTA - PARA AMBOS MODOS */}
                    {screen === 15 && <Screen15_AnamnesisRemota usuariaId={usuariaId} formData={formData as any} updateFormData={updateFormData as any} isClosed={isClosed} />}

                    {screen === 1 && type === 'INITIAL' && <Screen1_Entrevista formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 2 && type === 'INITIAL' && <Screen2_Examen formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 3 && type === 'INITIAL' && <Screen3_Sintesis formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}
                    {screen === 4 && type === 'INITIAL' && <Screen4_Diagnostico formData={formData as Partial<EvaluacionInicial>} updateFormData={updateFormData as any} isClosed={isClosed} />}

                </div>

                {/* BOTTOM BAR STICKY (GUARDADO) */}
                {!isClosed && (
                    <div className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-10px_30px_-15px_rgba(0,0,0,0.1)] transition-transform duration-300 ease-in-out pb-safe p-3 ${isKeyboardOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
                        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-3 items-center justify-between">
                            
                            {/* ESTADO DE GUARDADO */}
                            <div className="flex items-center gap-2 text-sm md:w-1/3">
                                {saveFeedback ? (
                                    <span className={`px-3 py-1.5 rounded-md font-bold text-xs ${saveFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-800' : saveFeedback.type === 'error' ? 'bg-rose-100 text-rose-800' : 'bg-blue-100 text-blue-800'}`}>
                                        {saveFeedback.message}
                                    </span>
                                ) : (
                                    <span className="text-slate-500 font-medium text-xs px-2">Cambios sin guardar</span>
                                )}
                            </div>

                            {/* BOTONES */}
                            <div className="flex w-full md:w-2/3 md:justify-end gap-3">
                                <button
                                    onClick={() => handleSave(false)}
                                    disabled={loading}
                                    className="flex-1 md:flex-none md:w-48 bg-white text-slate-700 font-black border-2 border-slate-300 hover:border-slate-400 hover:bg-slate-50 py-3.5 px-4 rounded-xl transition-all shadow-sm text-sm"
                                >
                                    {loading ? 'Guardando...' : 'Guardar borrador'}
                                </button>

                                <button
                                    onClick={() => handleSave(true)}
                                    disabled={loading}
                                    className={`flex-1 md:flex-none md:w-56 font-black py-3.5 px-4 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2 ${getValidationContext.allValid
                                        ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                                        : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                        }`}
                                >
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Guardar definitivo
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
}
