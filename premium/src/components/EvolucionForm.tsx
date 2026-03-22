import React, { useState, useEffect, useMemo } from "react";
import { Evolucion, ExercisePrescription, Evaluacion, TreatmentObjective } from "@/types/clinica";
import { doc, getDoc, collection, addDoc, query, where, orderBy, getDocs, limit, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { OutcomesService } from "@/services/outcomes";
import { AgendaService } from "@/services/agenda";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
import { sanitizeForFirestoreDeep, resolveSafeAudit } from "@/lib/firebase-utils";
import { Disclosure, Transition } from '@headlessui/react';
import {
    ChevronUpIcon,
    ChevronLeftIcon,
    PlusIcon,
    TrashIcon,
    DocumentDuplicateIcon,
    ChevronDownIcon,
    ExclamationCircleIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    LightBulbIcon,
    ClockIcon,
    SparklesIcon,
    XMarkIcon
} from '@heroicons/react/20/solid';
import { EvaSlider } from "./ui/EvaSlider";
import { NumericStepper } from "./ui/NumericStepper";
import { ExerciseRow } from "./ui/ExerciseRow";
import { InterventionPanel } from "./ui/InterventionPanel";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// CACHÉ EN MEMORIA (FASE 2.1.9) PARA EVITAR RE-LECTURAS DE OBJETIVOS
const globalEvalCache: Record<string, { objectives: { id: string, label: string, status?: string }[], versionId: string, timestamp: number }> = {};

function mapLegacyToPro(data: any, defaultUsuariaId: string): Partial<Evolucion> {
    if (!data) return {
        usuariaId: defaultUsuariaId,
        status: 'DRAFT',
        sessionAt: new Date().toISOString(),
        pain: { evaStart: "", evaEnd: "" },
        sessionGoal: "",
        interventions: { categories: [], notes: "" },
        exercises: [],
        nextPlan: "",
        audit: {
            draftCreatedAt: new Date().toISOString(), // FASE 2.1.23
            createdAt: new Date().toISOString()
        }
    };

    // Migración Legacy -> Pro
    const legacyData = data as any;
    const isLegacy = legacyData.estado !== undefined || legacyData.dolorInicio !== undefined;

    // Tratamiento para "interventions" que venían como objeto { categories, notes }
    let interventionsArray: any[] = [];
    if (Array.isArray(data.interventions)) {
        interventionsArray = data.interventions;
    }

    let notesLegacy = legacyData.notesLegacy || "";

    if (isLegacy) {
        const legacyDump = [
            legacyData.intervenciones ? `[INTERVENCIONES ANTIGUAS]: ${legacyData.intervenciones}` : "",
            legacyData.ejerciciosPrescritos ? `[EJERCICIOS ANTIGUOS]: ${legacyData.ejerciciosPrescritos}` : "",
        ].filter(Boolean).join("\\n");
        if (legacyDump && !notesLegacy.includes(legacyDump)) {
            notesLegacy = notesLegacy ? `${notesLegacy}\\n---\\n${legacyDump}` : legacyDump;
        }
    }

    return {
        ...data,
        status: data.status || (legacyData.estado === 'CERRADA' ? 'CLOSED' : 'DRAFT'),
        sessionStatus: data.sessionStatus || 'Realizada',
        vitalSigns: data.vitalSigns || { acuteSymptoms: [] },
        suspensionDetails: data.suspensionDetails || { reason: '', action: '' },
        sessionAt: data.sessionAt || legacyData.fechaHoraAtencion || new Date().toISOString(),
        pain: data.pain || {
            evaStart: legacyData.dolorInicio ?? "",
            evaEnd: legacyData.dolorSalida ?? ""
        },
        sessionGoal: data.sessionGoal || legacyData.objetivoSesion || "",
        interventions: interventionsArray, // Now directly an array
        exercises: data.exercises || [],
        nextPlan: data.nextPlan || legacyData.planProximaSesion || "",
        audit: data.audit || {
            draftCreatedAt: legacyData.createdAt || new Date().toISOString(), // FASE 2.1.23 fallback
            firstSavedAt: legacyData.createdAt || undefined, // Si viene de legacy, asumiremos que se creó en ese momento
            createdAt: legacyData.createdAt,
            createdBy: legacyData.autorUid,
            closedAt: legacyData.closedAt,
            lateReason: legacyData.lateCloseReason
        },
        notesLegacy: notesLegacy || undefined
    };
};

// Calcula la diferencia en horas
const getDifferenceInHours = (date1Str: string, date2Str: string) => {
    const d1 = new Date(date1Str).getTime();
    const d2 = new Date(date2Str).getTime();
    return Math.abs(d2 - d1) / (1000 * 60 * 60);
};

// Formatea ISO string a Date-Time Local HTML compatible
const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        // Ajuste zona horaria local para formato YYYY-MM-DDTHH:mm
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
        return "";
    }
};

interface EvolucionFormProps {
    usuariaId: string;
    procesoId?: string;
    citaId?: string;
    internoAtendioId?: string;
    initialData: Evolucion | null;
    evolucionesAnteriores?: Evolucion[];
    onClose: () => void;
    onSaveSuccess: (evolucion: Evolucion, isNew: boolean, willClose?: boolean) => void;
}

// --- RENDER HELPERS PARA ACORDEÓN EXTRAÍDO (FASE 2.1.15) ---
const AccordionSection = ({
    id,
    title,
    icon,
    children,
    defaultOpen = false,
    theme = "indigo"
}: {
    id: string,
    title: string,
    icon: React.ReactNode,
    children: React.ReactNode,
    defaultOpen?: boolean
    theme?: "indigo" | "emerald" | "amber" | "rose" | "slate"
}) => {

    const themes = {
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        rose: "text-rose-600 bg-rose-50 border-rose-100",
        slate: "text-slate-600 bg-slate-50 border-slate-100",
    };

    const activeTheme = themes[theme] || themes.indigo;

    return (
        <Disclosure defaultOpen={defaultOpen} as="div" id={id} className="scroll-mt-32">
            {({ open }: { open: boolean }) => (
                <div className={`bg-white rounded-2xl border ${open ? 'border-slate-300 shadow-md ring-1 ring-slate-100' : 'border-slate-200 shadow-sm'} transition-all overflow-hidden mb-4`}>
                    <Disclosure.Button className={`w-full px-5 py-4 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}>
                        <div className="flex items-center gap-3">
                            <span className={`p-2 rounded-xl ${activeTheme} shadow-sm border`}>
                                {icon}
                            </span>
                            <h3 className="font-extrabold text-slate-800 text-sm tracking-wide">{title}</h3>
                        </div>
                        <ChevronUpIcon
                            className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 text-slate-400 transition-transform duration-300`}
                        />
                    </Disclosure.Button>
                    <Transition
                        enter="transition duration-200 ease-out"
                        enterFrom="transform scale-95 opacity-0 -translate-y-4"
                        enterTo="transform scale-100 opacity-100 translate-y-0"
                        leave="transition duration-150 ease-in"
                        leaveFrom="transform scale-100 opacity-100 translate-y-0"
                        leaveTo="transform scale-95 opacity-0 -translate-y-4"
                    >
                        <Disclosure.Panel className="px-5 pb-6 pt-2 bg-slate-50/50 border-t border-slate-100">
                            {children}
                        </Disclosure.Panel>
                    </Transition>
                </div>
            )}
        </Disclosure>
    );
};

export function EvolucionForm({ usuariaId, procesoId, citaId, internoAtendioId, initialData, evolucionesAnteriores, onClose, onSaveSuccess }: EvolucionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Si viene `initialData`, significa que estamos en modo EDIT.
    const isEditMode = !!initialData;
    const isClosed = initialData?.status === "CLOSED" || initialData?.estado === "CERRADA";

    const [loading, setLoading] = useState(false);

    // FASE 2.1.15: Clave Única de Borrador Local (Agregado procesoId para evitar colisiones entre sesiones nuevas)
    const draftKey = `evoDraft_${initialData?.id || 'new_' + (procesoId || '') + '_' + usuariaId}`;

    // Estado interno del formulario (Copia Inicial mode Pro + LocalStorage recovery)
    const [formData, setFormData] = useState<Partial<Evolucion>>(() => {
        const basePro = mapLegacyToPro(initialData, usuariaId);
        if (!initialData || (initialData.status !== "CLOSED" && initialData.estado !== "CERRADA")) {
            try {
                const localDraft = localStorage.getItem(draftKey);
                if (localDraft) {
                    const parsed = JSON.parse(localDraft);
                    // FASE 9: Limpieza de "Borrador Fantasma" para sesiones nuevas
                    // Si el borrador no tiene ID y nosotros tampoco, es un residuo de la sesión anterior
                    if (!initialData?.id && !parsed.id) {
                        return { 
                            ...basePro, 
                            sessionNumber: basePro.sessionNumber, // Mantener el calculado por el map
                            selectedObjectiveIds: [],
                            selectedObjectivesSnapshot: [],
                            outcomesSnapshot: { groc: 0, sane: 0 },
                            exercises: [],
                            interventions: { ...basePro.interventions, techniques: [] }
                        };
                    }
                    return { ...basePro, ...parsed };
                }
            } catch (e) {
                console.warn("No se pudo cargar el borrador local", e);
            }
        }
        return basePro;
    });

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Control para la regla de las 36 Horas
    const [requiresLateReason, setRequiresLateReason] = useState(false);
    const [isAttemptingClose, setIsAttemptingClose] = useState(false);
    const [isLateDraft, setIsLateDraft] = useState(false);

    // UI Layout States
    const [activeSection, setActiveSection] = useState("admin"); // "admin", "soap", "interventions", "results"

    // FASE 2.1.21: Continuidad
    const [lastClosedEvol, setLastClosedEvol] = useState<Evolucion | null>(null);
    const [isLoadingContinuity, setIsLoadingContinuity] = useState(false);

    // FASE 2.2.6: Últimos Outcomes
    const [recentOutcomes, setRecentOutcomes] = useState<any[]>([]);

    useEffect(() => {
        if (procesoId && globalActiveYear) {
            OutcomesService.getByProceso(globalActiveYear, procesoId)
                .then(outcomes => {
                    setRecentOutcomes(outcomes.reverse().slice(0, 3));
                })
                .catch(console.error);
        }
    }, [procesoId, globalActiveYear]);

    // Dropdown + Texto para justificación
    const [lateCategory, setLateCategory] = useState("");
    const [lateText, setLateText] = useState("");

    // Ref para evitar loops de autoguardado (FASE 2.1.15)
    const lastSavedDataRef = React.useRef<string>("");

    // FASE 2.1.26: Quick Add Ejercicios por Consola
    const [quickAddText, setQuickAddText] = useState("");

    useEffect(() => {
        if (initialData) {
            setFormData(mapLegacyToPro(initialData, usuariaId));
        }
    }, [initialData, usuariaId]);

    // Calcular permanentemente si la ficha lleva más de 36h en borrador desde la fecha indicada
    useEffect(() => {
        if (!isClosed && formData.sessionAt) {
            const h = getDifferenceInHours(formData.sessionAt, new Date().toISOString());
            setIsLateDraft(h > 36);
        } else {
            setIsLateDraft(false);
        }
    }, [isClosed, formData.sessionAt]);

    // FASE 2.1.21: Obtener Última Evolución Cerrada (Continuidad) + FASE 2.1.22: Cálculo SessionNumber
    // FASE 11: Usa evolucionesAnteriores prop cuando disponible + acepta legacy estado='CERRADA'
    useEffect(() => {
        const fetchContinuityAndNumber = async () => {
            if (!globalActiveYear || isClosed) return;
            setIsLoadingContinuity(true);
            try {
                // FASE 11: Si tenemos evolucionesAnteriores del ProcesoTimeline, usarlas directamente
                if (evolucionesAnteriores && evolucionesAnteriores.length > 0) {
                    // Calcular correlativo
                    if (!formData.sessionNumber || !initialData?.id) {
                        setFormData(prev => ({ ...prev, sessionNumber: evolucionesAnteriores.length + (initialData?.id ? 0 : 1) }));
                    }
                    // Buscar última cerrada (aceptar ambos formatos de status)
                    const closedEvols = evolucionesAnteriores
                        .filter(d => d.status === 'CLOSED' || (d as any).estado === 'CERRADA')
                        .sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());
                    const last = closedEvols.find(d => d.id !== initialData?.id) || closedEvols[0];
                    if (last && last.id !== initialData?.id) {
                        setLastClosedEvol(last);
                    }
                    setIsLoadingContinuity(false);
                    return;
                }

                const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");
                // 1. Contar sesiones totales del proceso para asignar el Correlativo actual
                if (procesoId && (!formData.sessionNumber || !initialData?.id)) {
                    const countQuery = query(evolsRef, where("procesoId", "==", procesoId));
                    const countSnap = await getDocs(countQuery);
                    setFormData(prev => ({ ...prev, sessionNumber: countSnap.size + (initialData?.id ? 0 : 1) }));
                }

                // 2. Traer la última cerrada del usuario o proceso para Handoff Continuidad
                let qQuery;
                if (procesoId) {
                    qQuery = query(evolsRef, where("procesoId", "==", procesoId));
                } else {
                    qQuery = query(evolsRef, where("usuariaId", "==", usuariaId));
                }
                const snap = await getDocs(qQuery);
                if (!snap.empty) {
                    // FASE 11: Filtrar aceptando AMBOS formatos de status (moderno y legacy)
                    const sortedDocs = snap.docs
                        .map(d => ({ id: d.id, ...d.data() } as Evolucion))
                        .filter(d => d.status === 'CLOSED' || (d as any).estado === 'CERRADA')
                        .sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());

                    const data = sortedDocs[0];
                    if (data && data.id !== initialData?.id) {
                        setLastClosedEvol(data);
                    }
                }
            } catch (err) {
                console.error("No se pudo cargar la continuidad histórica ni el correlativo", err);
            } finally {
                setIsLoadingContinuity(false);
            }
        };
        fetchContinuityAndNumber();
    }, [globalActiveYear, procesoId, usuariaId, isClosed, initialData?.id, evolucionesAnteriores]);

    // FASE 2.1.15: DEBOUNCED AUTOSAVE (1200ms) Anti-Loop
    useEffect(() => {
        if (isClosed || loading || isAttemptingClose || !formData.usuariaId) return;

        // Omitimos 'audit' e 'id' para evitar bucles de autoguardado generados por el mismo save (inyección de fechas)
        const { audit, id, _migratedFromLegacy, ...dataToCompare } = formData as any;
        const currentDataStr = JSON.stringify(dataToCompare);

        // Si el contenido vital no ha mutado respecto a lo que se guardó, abortar debounce
        if (currentDataStr === lastSavedDataRef.current) return;

        const timer = setTimeout(() => {
            // Ignoramos auto-save si ya hay un guardado en curso para prevenir cuellos de botella
            if (saveStatus !== 'saving') {
                lastSavedDataRef.current = currentDataStr; // Actualizar snapshot
                executeSave(false, undefined, true);
            }
        }, 1200);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, isClosed, loading, isAttemptingClose, saveStatus]); // Ejecutar re-evaluación EXCLUSIVAMENTE cuando muta el contenido real

    // FASE 2.1.15: PERSISTENCIA LOCAL LIGERA (Inmediata y en caché físico)
    useEffect(() => {
        if (!isClosed && formData && formData.usuariaId) {
            try {
                localStorage.setItem(draftKey, JSON.stringify(formData));
            } catch (e) {
                console.warn("Error guardando progreso en localStorage", e);
            }
        }
    }, [formData, isClosed, draftKey]);

    // FASE 2.1.15: OPTIMIZACIÓN TECLADO MÓVIL
    useEffect(() => {
        const container = document.getElementById('evo-scroll-container');
        if (!container) return;

        const handleFocus = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                setTimeout(() => {
                    // Mover scroll con suavidad para evitar que el input quede techado por el teclado
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            }
        };

        container.addEventListener('focusin', handleFocus);
        return () => {
            container.removeEventListener('focusin', handleFocus);
        };
    }, []);

    const handleNestedChange = <
        T extends "vitalSigns" | "suspensionDetails" | "pain" | "interventions" | "outcomesSnapshot" | "readiness",
        K extends keyof NonNullable<Evolucion[T]>
    >(
        parentKey: T,
        childKey: K,
        value: NonNullable<Evolucion[T]>[K]
    ) => {
        setFormData((prev: any) => ({
            ...prev,
            [parentKey]: {
                ...(prev[parentKey] || {}),
                [childKey]: value
            }
        }));
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val) return;
        const newVal = new Date(val).toISOString();

        // FASE 2.1.23: Auditoría de corrección de fecha/hora de atención en BD
        const initialSessionAt = initialData?.sessionAt;
        if (isEditMode && initialSessionAt && Math.abs(new Date(initialSessionAt).getTime() - new Date(newVal).getTime()) > 60000) {
            const reason = window.prompt("AUDITORÍA DE FECHA/HORA:\n\nEstá alterando la hora oficial de la atención.\nIngrese un motivo obligatorio (mínimo 5 caracteres):");
            if (!reason || reason.trim().length < 5) {
                alert("Cambio cancelado. Motivo inválido o insuficiente.");
                return;
            }
            const logEntry = {
                before: initialSessionAt,
                after: newVal,
                reason: reason.trim(),
                changedAt: new Date().toISOString(),
                changedByUid: user?.uid || "unknown",
                changedByName: user?.displayName || user?.email || "unknown"
            };
            setFormData((prev: any) => ({
                ...prev,
                sessionAt: newVal,
                sessionAtChangeReason: reason.trim(),
                sessionAtHistory: [...(prev.sessionAtHistory || []), logEntry]
            }));
        } else {
            setFormData((prev: any) => ({ ...prev, sessionAt: newVal }));
        }
    };

    // --- MANEJO DE OBJETIVOS VIGENTES Y CONTEXTO PROCESO (FASE 2.1.18 y 2.1.30) ---
    const [availableObjectives, setAvailableObjectives] = useState<any[]>([]);
    const [objectivesSource, setObjectivesSource] = useState<string>("");
    const [currentVersionId, setCurrentVersionId] = useState<string | undefined>(undefined);
    const [procesoContext, setProcesoContext] = useState<{ motivoIngresoLibre?: string, evaluacionesStr?: string, caseSnapshot?: any, flags?: any }>({});
    const [loadingObjectives, setLoadingObjectives] = useState(false);

    // --- MANEJO DE COPIA SELECTIVA (FASE 2.1.25) ---
    const [showCopyModal, setShowCopyModal] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [copyCandidates, setCopyCandidates] = useState<{ exercises: any[], interventions: any[], evolutionId: string, oldGoal: string, oldEffortMode: string } | null>(null);
    const [selectedExercisesToCopy, setSelectedExercisesToCopy] = useState<Set<string>>(new Set());
    const [selectedInterventionsToCopy, setSelectedInterventionsToCopy] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!procesoId || !globalActiveYear) return;

        const fetchObjectiveSet = async () => {
            const cacheKey = `objSet_${globalActiveYear}_${procesoId}`;
            const timeNow = Date.now();

            // Cache local para SPA
            if (globalEvalCache[cacheKey] && (timeNow - globalEvalCache[cacheKey].timestamp < 600000)) {
                const cached = globalEvalCache[cacheKey];
                // Evitamos pisar si estamos en Edit Mode de una sesión con una versión anterior
                const isOldVersion = formData.objectiveSetVersionId && formData.objectiveSetVersionId !== cached.versionId;
                if (isOldVersion && isClosed) return;

                setAvailableObjectives(cached.objectives);
                setCurrentVersionId(cached.versionId);
                return;
            }

            setLoadingObjectives(true);
            try {
                // FASE 2.1.18 y 2.1.30: Leer DESDE el Proceso + Evaluaciones
                const docRef = doc(db, "programs", globalActiveYear, "procesos", procesoId);
                const docSnap = await getDoc(docRef);

                let evalsStr = "";
                try {
                    const evalsQ = query(collection(db, "programs", globalActiveYear, "evaluaciones"), where("procesoId", "==", procesoId));
                    const evalsSnap = await getDocs(evalsQ);

                    const evalLines: string[] = [];
                    evalsSnap.forEach(doc => {
                        const dat = doc.data();
                        if (dat.type) {
                            evalLines.push(`Evaluación ${dat.type} (${dat.sessionAt}): ${dat.objectives?.map((o: any) => o.description).join(', ') || 'Sin notas'}`);
                        }
                    });
                    if (evalLines.length > 0) evalsStr = evalLines.join(" | ");
                } catch (e) { console.error("Error trayendo evaluaciones", e); }

                if (docSnap.exists()) {
                    const procesoData = docSnap.data();
                    const activeSet = procesoData.activeObjectiveSet;

                    setProcesoContext({
                        motivoIngresoLibre: procesoData.motivoIngresoLibre,
                        evaluacionesStr: evalsStr,
                        caseSnapshot: procesoData.caseSnapshot,
                        flags: procesoData.flags
                    });

                    // FASE 2.2.4: Inyección automática de pre-requisitos si es Evolución Nueva
                    if (!isClosed && !isEditMode) {
                        const rawConsiderations = procesoData.flags?.consideracionesClinicas;
                        const considerationsArray = Array.isArray(rawConsiderations) 
                            ? rawConsiderations 
                            : (typeof rawConsiderations === 'string' ? [rawConsiderations] : []);

                        setFormData((prev: any) => ({
                            ...prev,
                            evaluationIndexId: prev.evaluationIndexId || procesoData.activeEvaluationIndexId,
                            loadTrafficLightAtSession: prev.loadTrafficLightAtSession || procesoData.loadManagementVigente?.trafficLight,
                            considerationsAtSession: prev.considerationsAtSession?.length ? prev.considerationsAtSession : considerationsArray
                        }));
                    }

                    if (activeSet && activeSet.objectives) {
                        const actives = activeSet.objectives.filter((o: any) => o.status !== 'logrado' && o.status !== 'pausado');

                        globalEvalCache[cacheKey] = {
                            objectives: actives,
                            versionId: activeSet.versionId,
                            timestamp: timeNow
                        };

                        const isOldVersion = formData.objectiveSetVersionId && formData.objectiveSetVersionId !== activeSet.versionId;
                        if (isOldVersion && isClosed) return;

                        setAvailableObjectives(actives);
                        setCurrentVersionId(activeSet.versionId);
                    } else {
                        // El proceso no tiene un set
                        // PASO 3.1: Fallback a Evaluación última
                        let fallbackActives: any[] = [];
                        let fallbackVersionId: string | undefined = undefined;
                        try {
                            const evalsRef = collection(db, "programs", globalActiveYear, "evaluaciones");
                            const lastEvalQ = query(evalsRef, where("procesoId", "==", procesoId), where("status", "==", "CLOSED"));
                            const lastEvalSnap = await getDocs(lastEvalQ);
                            if (!lastEvalSnap.empty) {
                                const sorted = lastEvalSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());
                                const lastEval = sorted[0] as any;
                                const evalObjectives = lastEval?.p4?.planMaestro?.fases?.flatMap((f: any) => (f.intervenciones || []).map((iv: any) => ({
                                    id: `eval_${lastEval.id}_${iv.id || Math.random()}`,
                                    label: iv.descripcion || iv.objetivo || iv.texto || '',
                                    status: 'activo',
                                    source: 'evaluacion'
                                })).filter((ov: any) => ov.label)) || lastEval?.objectives?.map((o: any) => ({
                                    id: o.id || `eval_${lastEval.id}_${o.description}`,
                                    label: o.description || o.label,
                                    status: o.status || 'activo'
                                })) || [];
                                if (evalObjectives.length > 0) {
                                    fallbackActives = evalObjectives;
                                    fallbackVersionId = `eval_${lastEval.id}`;
                                    setObjectivesSource(`Evaluación ${lastEval.type || ''} del ${new Date(lastEval.sessionAt).toLocaleDateString('es-CL')}`);
                                }
                            }
                        } catch (e) {
                            console.error("Error buscando última evaluación para objetivos", e);
                        }

                        setAvailableObjectives(fallbackActives);
                        setCurrentVersionId(fallbackVersionId);
                    }
                }
            } catch (err) {
                console.error("Error cargando el Set de Objetivos desde el Proceso", err);
            } finally {
                setLoadingObjectives(false);
            }
        };

        fetchObjectiveSet();
    }, [procesoId, globalActiveYear, formData.objectiveSetVersionId, isClosed]);

    const toggleObjective = (objId: string, customStatus?: 'trabajado' | 'avanzó' | 'sin cambio' | 'empeoró') => {
        if (isClosed) return;

        setFormData(prev => {
            const currentWork = Array.isArray(prev.objectiveWork) ? [...prev.objectiveWork] : [];
            const existingIndex = currentWork.findIndex(w => w.id === objId);

            if (existingIndex >= 0) {
                if (!customStatus) {
                    // Clic estándar: removerlo
                    currentWork.splice(existingIndex, 1);
                } else {
                    // Updatear el status asegurando tipo estricto
                    currentWork[existingIndex].sessionStatus = customStatus as any; // Cast inofensivo interno para evadir la mutabilidad array de TS.
                }
            } else {
                // Agregar nuevo
                currentWork.push({ id: objId, sessionStatus: (customStatus as any) || 'trabajado' });
            }

            // Sync legacy arrays para retrocompatibilidad
            const currentIds = currentWork.map(w => w.id);

            // Snapshot para inmutabilidad del registro
            const snapshot = availableObjectives
                .filter(o => currentIds.includes(o.id))
                .map(o => ({ id: o.id, label: o.label }));

            return {
                ...prev,
                objectiveWork: currentWork,
                selectedObjectiveIds: currentIds,
                selectedObjectivesSnapshot: snapshot,
                objectiveSetVersionId: currentVersionId,
                // Mantener legacy hidratado preventivamente
                objectivesWorked: {
                    objectiveIds: currentIds,
                    objectiveSetVersionId: currentVersionId
                }
            };
        });
    };

    // --- MANEJO DE EJERCICIOS DINÁMICOS ---
    const processQuickAdd = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!quickAddText.trim()) return;

        let text = quickAddText;
        let name = text;
        let sets: number | undefined;
        let reps: string | undefined;
        let loadKg: number | undefined;
        let effort: number | undefined;
        let rest: string | undefined;

        // Extract sets x reps (ej: 3x10, 4xMax)
        const setsRepsMatch = text.match(/\b(\d+)\s*[xX*]\s*([a-zA-Z0-9]+)\b/);
        if (setsRepsMatch) {
            sets = parseInt(setsRepsMatch[1], 10);
            reps = setsRepsMatch[2];
            name = name.replace(setsRepsMatch[0], '');
        }

        // Extract load (ej: 20kg, 15.5kilos)
        const loadMatch = text.match(/\b(\d+(?:\.\d+)?)\s*(kg|kilos|k)\b/i);
        if (loadMatch) {
            loadKg = parseFloat(loadMatch[1]);
            name = name.replace(loadMatch[0], '');
        }

        // Extract effort (ej: esfuerzo 8, rir 2, rpe 7.5)
        const effortMatch = text.match(/\b(?:esfuerzo|rir|rpe)\s*(\d+(?:\.\d+)?)\b/i);
        if (effortMatch) {
            effort = parseFloat(effortMatch[1]);
            name = name.replace(effortMatch[0], '');
        }

        // Extract rest (ej: descanso 90, pausa 60s)
        const restMatch = text.match(/\b(?:descanso|pausa|rest)\s*(\d+)(?:s|m|)\b/i);
        if (restMatch) {
            rest = restMatch[1];
            name = name.replace(restMatch[0], '');
        }

        const isRir = formData.perceptionMode === 'RIR';

        const newEx: ExercisePrescription = {
            id: generateId(),
            name: name.trim().replace(/\s+/g, ' ').replace(/^-\s*|-$/g, ''), // Limpiar espacios y guiones sueltos
            sets: sets ? String(sets) : "",
            repsOrTime: reps ? String(reps) : "",
            loadKg: loadKg !== undefined ? String(loadKg) : null,
            rir: isRir && effort !== undefined ? String(effort) : null,
            rpe: !isRir && effort !== undefined ? String(effort) : null,
            rest: rest ? String(rest) : null,
        };

        setFormData((prev: any) => ({
            ...prev,
            exercises: [...(prev.exercises || []), newEx]
        }));
        setQuickAddText("");
    };

    const addExercise = () => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: [
                ...(prev.exercises || []),
                { id: generateId(), name: "", sets: "", repsOrTime: "", loadKg: "", rpeOrRir: "", notes: "" }
            ]
        }));
    };

    const updateExercise = (id: string, field: keyof ExercisePrescription, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: prev.exercises?.map((ex: ExercisePrescription) => ex.id === id ? { ...ex, [field]: value } : ex)
        }));
    };

    const updateExerciseFull = (updatedEx: ExercisePrescription) => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: prev.exercises?.map((ex: ExercisePrescription) => ex.id === updatedEx.id ? updatedEx : ex)
        }));
    };

    const removeExercise = (id: string) => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: prev.exercises?.filter((ex: ExercisePrescription) => ex.id !== id)
        }));
    };

    const moveExercise = (index: number, direction: 'up' | 'down') => {
        if (isClosed) return;
        setFormData((prev: any) => {
            if (!prev.exercises) return prev;
            const newExercises = [...prev.exercises];
            if (direction === 'up' && index > 0) {
                [newExercises[index - 1], newExercises[index]] = [newExercises[index], newExercises[index - 1]];
            } else if (direction === 'down' && index < newExercises.length - 1) {
                [newExercises[index + 1], newExercises[index]] = [newExercises[index], newExercises[index + 1]];
            }
            return { ...prev, exercises: newExercises };
        });
    };

    const duplicatePreviousExercises = async () => {
        if (!globalActiveYear) {
            alert("Seleccione el año de operación actual para duplicar.");
            return;
        }
        if (isClosed || !user) return;
        try {
            // Busca la última evolución cerrada de este proceso (o usuario globalmente)
            const evolsRef = collection(db, "programs", globalActiveYear, "evoluciones");
            let q;
            if (procesoId) {
                q = query(evolsRef, where("procesoId", "==", procesoId));
            } else {
                q = query(evolsRef, where("usuariaId", "==", usuariaId));
            }
            const querySnapshot = await getDocs(q);

            // FASE 11: Filtrar aceptando AMBOS formatos de status (moderno y legacy)
            const candidates = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as any))
                .filter(d => d.status === 'CLOSED' || d.estado === 'CERRADA')
                .sort((a, b) => new Date(b.sessionAt).getTime() - new Date(a.sessionAt).getTime());

            let lastEvol: any = null;
            if (candidates.length > 0) {
                // El primer candidato que no sea el actual
                lastEvol = candidates.find(d => d.id !== initialData?.id) || candidates[0];
            }

            // Compatibilidad Transversal Fase 2.1.19 / 2.1.20
            const oldExercises = lastEvol?.exerciseRx?.rows || lastEvol?.exercises || [];
            const oldInterventions = Array.isArray(lastEvol?.interventions) ? lastEvol.interventions : [];
            const oldEffortMode = lastEvol?.exerciseRx?.effortMode || lastEvol?.perceptionMode;

            if (oldExercises.length === 0 && oldInterventions.length === 0) {
                alert("No se encontró una evolución médica previa con ejercicios o intervenciones válidas para duplicar.");
                return;
            }

            // Preparar modal (FASE 2.1.25)
            // Llenar sets con todos por defecto para agilizar UX
            setSelectedExercisesToCopy(new Set(oldExercises.map((e: any, i: number) => e.id || `ex-${i}`)));
            setSelectedInterventionsToCopy(new Set(oldInterventions.map((i: any, j: number) => i.id || `int-${j}`)));

            setCopyCandidates({
                // Re-mapear IDs temporales por si acaso, para los que no tienen ID
                exercises: oldExercises.map((e: any, i: number) => ({ ...e, _tempId: e.id || `ex-${i}` })),
                interventions: oldInterventions.map((i: any, j: number) => ({ ...i, _tempId: i.id || `int-${j}` })),
                evolutionId: lastEvol.id,
                oldGoal: lastEvol.nextPlan || "",
                oldEffortMode: oldEffortMode || 'RIR'
            });

            setShowCopyModal(true);

        } catch (error) {
            console.error("Error al buscar evolución para duplicar:", error);
            alert("Hubo un error al intentar acceder a los registros previos.");
        }
    };

    const confirmDuplicate = () => {
        if (!copyCandidates) return;

        // Filtrar y regenerar IDs reales
        const duplicatedExercises = copyCandidates.exercises
            .filter(ex => selectedExercisesToCopy.has(ex._tempId))
            .map((ex: any) => ({
                ...ex,
                id: generateId()
            }));

        const duplicatedInterventions = copyCandidates.interventions
            .filter(int => selectedInterventionsToCopy.has(int._tempId))
            .map((int: any) => ({
                ...int,
                id: generateId(),
                copiedFromEvolutionId: copyCandidates.evolutionId // Tracking estricto FASE 2.1.25
            }));

        setFormData((prev: any) => ({
            ...prev,
            exercises: [
                ...(prev.exercises || []),
                ...duplicatedExercises
            ],
            interventions: [
                ...(Array.isArray(prev.interventions) ? prev.interventions : []),
                ...duplicatedInterventions
            ],
            // Heredar el "NextPlan" previo como la meta de la sesión de hoy
            sessionGoal: copyCandidates.oldGoal || prev.sessionGoal || "",

            // Limpiar EVAs y CheckIn (Condición Clínica Estricta: Se miden de 0 en la sesión de Hoy)
            pain: {
                ...prev.pain,
                evaStart: "",
                evaEnd: ""
            },
            readiness: undefined,

            // Si el anterior tenía un effort mode forzado explícitamente, heredarlo
            perceptionMode: copyCandidates.oldEffortMode || prev.perceptionMode,

            audit: {
                ...(prev.audit || {}),
                copiedFromEvolutionId: copyCandidates.evolutionId
            }
        }));

        alert(`✅ Se reciclaron ${duplicatedExercises.length} ejercicios y ${duplicatedInterventions.length} intervenciones específicas.`);
        setShowCopyModal(false);
        setCopyCandidates(null);
    };

    // Método universal de Guardado para Borrador o Cierre
    const executeSave = async (willClose: boolean, overrideReason?: string, isAutoSave = false, extraProps?: Partial<Evolucion>) => {
        if (!globalActiveYear || !user) {
            if (!isAutoSave) alert("No hay un Año de Programa activo seleccionado o sesión inválida.");
            return;
        }

        try {
            if (!isAutoSave) setLoading(true);
            setSaveStatus('saving');
            const targetId = formData.id || (isEditMode && initialData?.id ? initialData.id : generateId());

            const finalAudit = resolveSafeAudit(initialData?.audit, formData.audit, user.uid, willClose);
            // Asegurar campos específicos de EvolucionForm
            if (!finalAudit.draftCreatedAt) {
                finalAudit.draftCreatedAt = (formData.audit as any)?.draftCreatedAt || finalAudit.createdAt;
            }
            if (!finalAudit.firstSavedAt) {
                finalAudit.firstSavedAt = (formData.audit as any)?.firstSavedAt || new Date().toISOString();
            }
            if (overrideReason) finalAudit.lateReason = overrideReason;

            const payload: Partial<Evolucion> = {
                id: targetId,
                usuariaId,
                procesoId: procesoId || formData.procesoId || null,
                casoId: formData.casoId || null,
                sesionId: formData.sesionId || null,

                status: willClose ? 'CLOSED' : 'DRAFT',
                sessionAt: formData.sessionAt!,
                sessionAtChangeReason: formData.sessionAtChangeReason || null,
                sessionAtHistory: formData.sessionAtHistory || null,
                clinicianResponsible: user.uid,

                sessionStatus: formData.sessionStatus || 'Realizada',
                vitalSigns: formData.vitalSigns || null,
                suspensionDetails: formData.suspensionDetails || null,

                pain: formData.pain || null,
                sessionGoal: formData.sessionGoal || '',
                interventions: formData.interventions || [],

                // Métrica Relevante 2.1.22
                sessionNumber: formData.sessionNumber || null,
                readiness: formData.readiness || null,
                // Mapeo FASE 2.1.20
                exerciseRx: {
                    effortMode: formData.perceptionMode || 'RIR',
                    rows: formData.exercises || []
                },

                nextPlan: formData.nextPlan || '',
                educationNotes: formData.educationNotes || "",

                // Mapeo Objetivos Activos (Fase 2.1.24)
                objectiveSetVersionId: formData.objectiveSetVersionId || null,
                objectiveWork: formData.objectiveWork || [],
                selectedObjectiveIds: formData.selectedObjectiveIds || [],
                selectedObjectivesSnapshot: formData.selectedObjectivesSnapshot || [],
                objectiveSelectionReason: formData.objectiveSelectionReason || null,
                objectivesWorked: formData.objectivesWorked, // Legacy

                ...extraProps,

                outcomesSnapshot: formData.outcomesSnapshot,

                // FASE 4.1: Guardar Metadatos de Trazabilidad para Análisis Docente
                _analytics: {
                    sessionDurationMinutes: (formData as any).durationMinutes || null, // Depende si existe
                    objectivesWorkedCount: formData.selectedObjectiveIds?.length || 0,
                    objectivesAvailableCount: availableObjectives.length,
                    objectiveComplianceRate: availableObjectives.length > 0 
                        ? ((formData.selectedObjectiveIds?.length || 0) / availableObjectives.length * 100).toFixed(0) + '%'
                        : null,
                    evaReduction: (formData.pain?.evaStart !== '' && formData.pain?.evaStart !== undefined && formData.pain?.evaEnd !== '' && formData.pain?.evaEnd !== undefined) 
                        ? Number(formData.pain?.evaStart) - Number(formData.pain?.evaEnd) 
                        : null,
                    hasInterventions: Array.isArray(formData.interventions) && formData.interventions.length > 0,
                    interventionCount: Array.isArray(formData.interventions) ? formData.interventions.length : 0,
                    interventionCategories: Array.isArray(formData.interventions) 
                        ? [...new Set(formData.interventions.map((i: any) => i.category))] 
                        : [],
                    hasExercises: Array.isArray(formData.exercises) && formData.exercises.length > 0,
                    exerciseCount: formData.exercises?.length || 0,
                    registrationDelayHours: formData.sessionAt 
                        ? getDifferenceInHours(formData.sessionAt, new Date().toISOString()).toFixed(1) 
                        : null,
                    isLateRegistration: isLateDraft,
                    readinessSnapshot: formData.readiness || null,
                },

                audit: finalAudit,
                notesLegacy: formData.notesLegacy
            };

            const docRef = doc(db, "programs", globalActiveYear, "evoluciones", targetId);

            await setDocCounted(docRef, payload, { merge: true });

            setFormData(prev => ({
                ...prev,
                id: targetId,
                audit: finalAudit
            }));

            // FASE 2.1.15: Purgar borrador local en cache si fue firmada/cerrada.
            if (willClose) {
                try {
                    localStorage.removeItem(draftKey);
                    // Limpieza legacy y de emergencia para evitar fugas entre procesos
                    localStorage.removeItem(`evoDraft_new_${usuariaId}`);
                    if (procesoId) localStorage.removeItem(`evoDraft_new_${procesoId}_${usuariaId}`);
                } catch (e) { }

                // FASE 2.2.6: Despachar Outcomes "on-the-fly" a subcolección dedicada
                if (procesoId && formData.outcomesSnapshot) {
                    if (formData.outcomesSnapshot.sane !== undefined && formData.outcomesSnapshot.sane > 0) {
                        await OutcomesService.save(globalActiveYear, procesoId, {
                            id: `sane_evo_${Date.now()}`,
                            procesoId, usuariaId,
                            type: 'SANE',
                            capturedAt: formData.sessionAt || new Date().toISOString(),
                            context: 'EVOLUCION',
                            values: { score: formData.outcomesSnapshot.sane },
                            createdByUid: user.uid,
                            createdAt: new Date().toISOString()
                        }).catch(err => console.error("Error saving SANE outcome evo:", err));
                    }
                    if (formData.outcomesSnapshot.groc !== undefined && formData.outcomesSnapshot.groc !== 0) {
                        await OutcomesService.save(globalActiveYear, procesoId, {
                            id: `groc_evo_${Date.now()}`,
                            procesoId, usuariaId,
                            type: 'GROC',
                            capturedAt: formData.sessionAt || new Date().toISOString(),
                            context: 'EVOLUCION',
                            values: { score: formData.outcomesSnapshot.groc },
                            createdByUid: user.uid,
                            createdAt: new Date().toISOString()
                        }).catch(err => console.error("Error saving GROC outcome evo:", err));
                    }
                }

                // FASE 2.3.2: Auto Asistencia (Completar cita ligada automáticamente cuando la evolución se FIRMA)
                if (citaId) {
                    try {
                        await AgendaService.markCitaAsCompleted(globalActiveYear, citaId, targetId, user.uid);
                    } catch (e) {
                        console.error("Error auto-completando cita ligada transaccional", e);
                    }
                }
            }


            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);

            // Solo notificamos success si es un guardado explícito.
            if (!isAutoSave) onSaveSuccess(payload as Evolucion, (!isEditMode && !formData.id), willClose);

        } catch (error) {
            console.error("Error al guardar Evolución", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
            if (!isAutoSave) alert("Ha ocurrido un error al conectar con la base de datos.");
        } finally {
            if (!isAutoSave) {
                setLoading(false);
                setIsAttemptingClose(false);
            }
        }
    };

    // Handler para apretar "Guardar Borrador"
    const handleSaveDraft = (e: React.FormEvent) => {
        e.preventDefault();
        executeSave(false);
    };

    // Handler SECRETO PARA DOCENTES: Reabrir una Ficha
    const handleReopen = async () => {
        if (!globalActiveYear) {
            alert("No hay programa activo configurado en este momento.");
            return;
        }
        if (user?.role !== "DOCENTE") {
            alert("Solo Rol DOCENTE o Coordinador puede reabrir evoluciones firmadas.");
            return;
        }

        const override = prompt("AUDITORÍA DE REAPERTURA:\n\nIngrese motivo clínico o de docencia (min. 10 chars) para romper el sello de firma:");
        if (!override || override.length < 10) {
            alert("Operación cancelada. El motivo debe ser extenso y explícito por razones médico-legales.");
            return;
        }

        if (!initialData?.id) {
            alert("Error crítico: La evolución no tiene un ID válido para reabrir.");
            return;
        }

        try {
            setLoading(true);
            const docRef = doc(db, "programs", globalActiveYear, "evoluciones", initialData.id);
            const auditPayload = {
                ...formData.audit,
                updatedAt: new Date().toISOString(),
                updatedBy: user.uid,
                reopenReason: override,
                reopenedAt: new Date().toISOString(),
                reopenedBy: user.uid
            };

            await setDocCounted(docRef, { status: "DRAFT", audit: auditPayload }, { merge: true });

            alert("Ficha reabierta exitosamente bajo la responsabilidad y huella de DOCENTE. Actualice la vista.");
            onClose(); // Forzamos al usuario a recargar la UI descartándola
        } catch (error) {
            console.error(error);
            alert("Hubo un error de base de datos reabriendo la evolución.");
        } finally {
            setLoading(false);
        }
    };

    // Handler para apretar "Cerrar Evolución"
    const handleAttemptClose = () => {
        if (isClosed) return;

        // Validación 1: Campos mínimos y asistentes (Lógica unificada)
        if (missingFields.length > 0) {
            alert(`Para CERRAR la evolución debe corregir los siguientes requisitos clínicos:\n\n- ${missingFields.join("\n- ")}`);
            return;
        }

        // Validación 1.5 (FASE 2.1.24): Ya no bloquea con Modal. Se asume como "No trabajado en esta sesión" si viene vacío.

        // Validación 1.6 (FASE 2.1.25): Sesiones "Realizadas" obligatorias
        if (formData.sessionStatus === 'Realizada') {
            const hasInterventions = Array.isArray(formData.interventions)
                ? formData.interventions.length > 0
                : !!(formData.interventions?.categories && formData.interventions.categories.length > 0);
            const hasExercises = formData.exercises && formData.exercises.length > 0;

            if (!hasInterventions && !hasExercises) {
                alert("Para cerrar la sesión como 'Realizada', debe registrar al menos 1 Intervención Médica o 1 Ejercicio Prescrito.");
                return;
            }
        }


        // Validación 2: Regla Estricta 36 Horas
        const hoursPassed = getDifferenceInHours(formData.sessionAt!, new Date().toISOString());

        if (hoursPassed > 36) {
            setRequiresLateReason(true);
            
            // PASO 3.2: Ya no hay modal. Si faltan datos, bloqueamos y hacemos scroll
            if (!lateCategory || lateText.trim().length < 20) {
                alert("Debes completar OBLIGATORIAMENTE la justificación de auditoría por cierre tardío (mínimo 20 caracteres) en la sección de 'Datos Administrativos'.");
                scrollToSection('sec-admin');
                return;
            }
            // Si tiene datos válidos, los pasamos
            const finalReason = `[${lateCategory}] ${lateText}`;
            const extraProps: Partial<Evolucion> = {};
            executeSave(true, finalReason, false, extraProps);
            return;
        }

        const extraProps: Partial<Evolucion> = {};

        executeSave(true, undefined, false, extraProps);
    };

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Scroll Spy Nativo 2.1.10
    useEffect(() => {
        const container = document.getElementById('evo-scroll-container');
        if (!container) return;

        const observerOptions = {
            root: container,
            rootMargin: "-20% 0px -70% 0px",
            threshold: 0
        };

        const observerCallback: IntersectionObserverCallback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                    // Centrar el chip en la barra de scroll horizontal móvil
                    const chipBtn = document.getElementById(`chip-${entry.target.id}`);
                    if (chipBtn) chipBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        // Pequeño delay para asegurar que el DOM pintó tras el primer render
        setTimeout(() => {
            ['sec-esencial', 'sec-interv', 'sec-ejerc', 'sec-result'].forEach(id => {
                const el = document.getElementById(id);
                if (el) observer.observe(el);
            });
        }, 100);

        return () => observer.disconnect();
    }, [isAttemptingClose, loading]);

    // --- CÁLCULO DEL ASISTENTE INTELIGENTE (FASE 2.1.7) ---
    const assistantCards: any[] = [];
    const missingFields: string[] = [];

    if (!isClosed) {
        const hasValidStart = formData.pain?.evaStart !== undefined && formData.pain?.evaStart !== "";
        const hasValidEnd = formData.pain?.evaEnd !== undefined && formData.pain?.evaEnd !== "";

        if (formData.sessionStatus === 'Realizada') {
            // Faltantes de cierre normal
            if (!hasValidStart) missingFields.push("EVA Inicio");
            if (!hasValidEnd) missingFields.push("EVA Salida");
            if (!formData.sessionGoal?.trim()) missingFields.push("Molestia o meta para hoy");
            if (!formData.nextPlan?.trim()) missingFields.push("Plan Próximo");

            const hasEmptyNames = formData.exercises?.some((ex: any) => !ex.name.trim());
            if (hasEmptyNames) missingFields.push("Nombre en Fila de Ejercicio");

            const hasIntervenciones = Array.isArray(formData.interventions)
                ? formData.interventions.length > 0
                : !!(formData.interventions && 'notes' in formData.interventions && formData.interventions.notes?.trim());

            const hasEjercicios = formData.exercises && formData.exercises.length > 0;
            if (!hasIntervenciones && !hasEjercicios) {
                missingFields.push("Intervenciones Manuales o al menos 1 Ejercicio");
            }
        } else {
            // Validaciones si la sesión no se realiza efectivamente
            if (!formData.suspensionDetails?.reason?.trim()) missingFields.push("Auditoría: Motivo Principal");
            if (!formData.suspensionDetails?.action?.trim()) missingFields.push("Auditoría: Acción Tomada");
        }

        if (missingFields.length > 0) {
            assistantCards.push({
                id: 'missing_fields',
                type: 'error',
                title: 'Bloqueo de Cierre Clínico',
                message: `Faltan campos mínimos para firmar: ${missingFields.join(", ")}.`,
                icon: <ExclamationCircleIcon className="w-5 h-5 text-rose-500" />,
                style: "bg-rose-50 border-rose-200 text-rose-800"
            });
        } else {
            assistantCards.push({
                id: 'ready_to_close',
                type: 'success',
                title: 'Ficha Lista para Firma',
                message: 'Los requisitos clínicos mínimos están completos. Autorizado para cerrar.',
                icon: <CheckCircleIcon className="w-5 h-5 text-emerald-500" />,
                style: "bg-emerald-50 border-emerald-200 text-emerald-800"
            });
        }

        // Contradicción Clínica (Ej. Dolor Sube + Texto Positivo)
        if (hasValidStart && hasValidEnd) {
            const evaIn = Number(formData.pain?.evaStart);
            const evaOut = Number(formData.pain?.evaEnd);
            if (evaOut > evaIn) {
                const txt = (formData.nextPlan || "").toLowerCase();
                const progWords = ["mejor", "alivio", "disminuy", "baj", "positivo", "excelent", "exito", "buen", "favorable", "progreso", "progres", "aument", "subir carga"];

                if (progWords.some(w => txt.includes(w))) {
                    const justification = formData.pain?.contradictionReason || "";
                    if (justification.trim().length < 5) {
                        missingFields.push("Justificación de Agudización (El Dolor aumentó pero el Plan sugiere progreso)");
                    }
                    assistantCards.push({
                        id: 'contradiction',
                        type: 'error',
                        title: 'Alerta de Coherencia Clínica',
                        message: `El EVA reporta un aumento de dolor (${evaIn} a ${evaOut}), pero la narrativa sugiere mejoría o progresión. Ajuste su plan o brinde una justificación inferior obligatoria.`,
                        icon: <ExclamationCircleIcon className="w-5 h-5 text-rose-500" />,
                        style: "bg-rose-50 border-rose-200 text-rose-800",
                        requiresAction: true,
                        actionType: 'contradictionReason'
                    });
                }
            }
        }

        // Objetivos No Marcados
        if (availableObjectives.length > 0 && (!formData.selectedObjectiveIds || formData.selectedObjectiveIds.length === 0)) {
            assistantCards.push({
                id: 'objectives_missing',
                type: 'info',
                title: 'Objetivos del Proceso Aislados',
                message: "Existen objetivos trazados para este proceso clínico. Te recomendamos marcar cuáles trabajaste hoy.",
                icon: <LightBulbIcon className="w-5 h-5 text-sky-500" />,
                style: "bg-sky-50 border-sky-200 text-sky-800"
            });
        }

        // Fuera de Plazo
        if (formData.sessionAt) {
            const hoursPassed = getDifferenceInHours(formData.sessionAt, new Date().toISOString());
            if (hoursPassed > 36) {
                assistantCards.push({
                    id: 'late_closure',
                    type: 'alert',
                    title: 'Excedido Plazo Bioético (>36h)',
                    message: `Han pasado ${hoursPassed.toFixed(1)} horas. Se exigirá causal de auditoría al cerrar.`,
                    icon: <ClockIcon className="w-5 h-5 text-orange-500" />,
                    style: "bg-orange-50 border-orange-200 text-orange-800"
                });
            }
        }
    }

    const canClose = missingFields.length === 0;

    // FASE 3.3: CHIPS DE NAVEGACIÓN Y COMPLETITUD
    const sectionStatus = useMemo(() => ({
        esencial: {
            complete: !!formData.sessionStatus && 
                      (formData.sessionStatus !== 'Realizada' || 
                       (formData.pain?.evaStart !== '' && formData.pain?.evaStart !== undefined)),
            label: 'Esencial'
        },
        interv: {
            complete: Array.isArray(formData.interventions) && formData.interventions.length > 0,
            label: 'Intervenciones'
        },
        ejerc: {
            complete: Array.isArray(formData.exercises) && formData.exercises.length > 0,
            label: 'Ejercicios'
        },
        result: {
            complete: !!formData.nextPlan?.trim() && 
                      formData.pain?.evaEnd !== '' && formData.pain?.evaEnd !== undefined,
            label: 'Cierre'
        }
    }), [formData]);

    return (
        <form onSubmit={handleSaveDraft} className="flex flex-col h-full w-full mx-auto overflow-hidden bg-slate-50/50 md:bg-transparent" id="evolution-form">

            {/* ERROR DE TIEMPO LEGAL (36hr Rule) */}
            {isLateDraft && !requiresLateReason && (
                <div className="bg-rose-50 border-l-4 border-rose-500 p-4 mb-4 rounded-r-xl sticky top-4 z-50 shadow-md flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
                    <ExclamationTriangleIcon className="w-8 h-8 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-rose-800 font-bold text-sm tracking-wide">Ficha Expirada Legalmente (&gt;36 Hrs)</h4>
                        <p className="text-rose-700/80 text-xs mt-1 leading-relaxed">Esta evolución clínica lleva configurada con una fecha de sesión mayor a 36 horas en el pasado. Su cierre requerirá una justificación administrativa formal (AuditTrail) que quedará visible permanentemente.</p>
                    </div>
                </div>
            )}

            {/* TOP BAR FIJA (Mobile First) */}
            <div className="bg-white border-b border-slate-200 shadow-sm z-40 shrink-0">
                <div className="flex items-center justify-between p-4 md:px-6">
                    <div className="flex items-center gap-3">
                        {/* Botón Volver solo en versión Móvil Total */}
                        <button onClick={onClose} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>

                        <div>
                            <h2 className="text-sm font-bold text-slate-800 truncate max-w-[200px] md:max-w-xs flex items-center gap-1.5">
                                {isEditMode ? "Evolución Clínica" : "Nueva Evolución"}
                                {formData.sessionNumber && (
                                    <span className="text-slate-400 font-medium text-xs">N° {formData.sessionNumber}</span>
                                )}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                <span className={`flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border shrink-0 ${isClosed ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-rose-500' : 'bg-blue-500 animate-pulse'}`}></span>
                                    {isClosed ? 'Cerrada' : 'Borrador'}
                                </span>
                                {isLateDraft && (
                                    <span className="flex items-center gap-1 text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border shrink-0 bg-orange-50 text-orange-700 border-orange-200">
                                        ATRASADA
                                    </span>
                                )}
                                {(saveStatus === 'saving' || loading) && <span className="text-[10px] text-slate-400 font-bold ml-1 shrink-0">Guardando...</span>}
                                {saveStatus === 'saved' && <span className="text-[10px] text-emerald-500 font-bold ml-1 shrink-0">Guardado ✓</span>}
                                {saveStatus === 'error' && <span className="text-[10px] text-rose-500 font-bold ml-1 shrink-0">Error ✗</span>}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isClosed && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (window.confirm("¿Estás seguro de que quieres borrar todos los datos ingresados hasta ahora? Se vaciarán los campos de este borrador.")) {
                                        setFormData({
                                            procesoId: procesoId || "",
                                            sessionAt: new Date().toISOString(),
                                            durationMinutes: 45,
                                            professionalName: user?.displayName || user?.email || "",
                                            sessionGoal: "",
                                            pain: { evaStart: "" as any, evaEnd: "" as any },
                                            readiness: { sleepQuality: undefined, stressLevel: undefined, energy: undefined, homeTasksCompleted: undefined },
                                            outcomesSnapshot: { groc: undefined, sane: undefined },
                                            audit: { createdAt: new Date().toISOString() } as any,
                                            exercises: [],
                                            interventions: [],
                                            selectedObjectiveIds: [],
                                            objectiveWork: [],
                                            isDraft: true,
                                            isClosed: false,
                                            nextPlan: "",
                                            sessionStatus: "Realizada"
                                        } as any);
                                    }
                                }}
                                className="flex text-xs font-bold text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 md:py-2 rounded-xl transition-colors items-center gap-1.5 border border-rose-200"
                            >
                                <svg className="w-4 h-4 md:w-3.5 md:h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                <span className="hidden md:inline">Limpiar Borrador</span>
                            </button>
                        )}
                        {/* Botón Volver Mobile/Desktop */}
                        <button onClick={onClose} className="flex items-center justify-center w-8 h-8 md:w-auto md:h-auto bg-slate-100 hover:bg-slate-200 md:bg-transparent md:hover:bg-transparent rounded-full md:rounded-none gap-1.5 text-slate-500 hover:text-slate-800 transition-colors">
                            <svg className="w-5 h-5 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            <span className="hidden md:inline text-sm font-semibold">Descartar / Volver</span>
                        </button>
                    </div>
                </div>

                <div className="px-4 md:px-6 pb-2 pt-1 overflow-x-auto hide-scrollbar flex gap-2 snap-x bg-white relative z-10 border-b border-slate-100 shadow-sm mb-2 shrink-0">
                    {[
                        { id: 'sec-esencial', key: 'esencial' },
                        { id: 'sec-interv', key: 'interv' },
                        { id: 'sec-ejerc', key: 'ejerc' },
                        { id: 'sec-result', key: 'result' }
                    ].map(chip => {
                        const status = sectionStatus[chip.key as keyof typeof sectionStatus];
                        return (
                            <button
                                key={chip.id}
                                id={`chip-${chip.id}`}
                                type="button"
                                onClick={() => scrollToSection(chip.id)}
                                className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all border flex items-center gap-1.5 ${activeSection === chip.id
                                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105'
                                    : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.complete ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {status.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL SCROLLEABLE (Optimizado 2.1.15) */}
            <div id="evo-scroll-container" className="flex-1 overflow-y-auto overscroll-none md:overscroll-auto touch-pan-y md:touch-auto w-full mx-auto relative px-4 md:px-6 pb-40 md:pb-24 scroll-smooth hide-scrollbar bg-transparent">
                <div className="max-w-4xl mx-auto mt-4 space-y-6">

                    {/* FASE 2.1.16 y 2.1.23: BANNER DE TIEMPOS DUALES Y AUDITORÍA PRO */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 shadow-sm flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="text-[11px] text-slate-600 space-y-1">
                            <div><span className="font-bold">Hora real de atención:</span> <span className="text-indigo-700 font-semibold">{formData.sessionAt ? new Date(formData.sessionAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '---'}</span></div>
                            <div><span className="font-bold">Apertura del borrador:</span> <span className="text-slate-900">{formData.audit?.draftCreatedAt ? new Date(formData.audit.draftCreatedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : (formData.audit?.createdAt ? new Date(formData.audit.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '---')}</span></div>
                            <div><span className="font-bold">Primer guardado:</span> <span className="text-slate-900">{formData.audit?.firstSavedAt ? new Date(formData.audit.firstSavedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Aún no en BD'}</span></div>
                            <div><span className="font-bold">Última edición:</span> <span className="text-slate-900">{formData.audit?.lastEditedAt || formData.audit?.updatedAt ? new Date((formData.audit?.lastEditedAt || formData.audit?.updatedAt)!).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Aún no guardado'}</span></div>
                            {isClosed && formData.audit?.closedAt && (
                                <div><span className="font-bold text-slate-800">Cierre total:</span> <span className="text-slate-900">{new Date(formData.audit.closedAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                            )}
                        </div>
                        {formData.sessionAt && formData.audit?.firstSavedAt && getDifferenceInHours(formData.sessionAt, formData.audit.firstSavedAt) > 0.5 && (
                            <div className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg text-[10px] font-bold text-center shrink-0 shadow-sm flex flex-col justify-center">
                                <span>Demora de Registro</span>
                                <span className="text-xs">{getDifferenceInHours(formData.sessionAt, formData.audit.firstSavedAt).toFixed(1)} hrs</span>
                            </div>
                        )}
                    </div>

                    <div id="evolution-form-content" className="space-y-4">

                        {/* --- FASE 4.2: PANEL DOCENTE EN READONLY --- */}
                        {isClosed && user?.role === 'DOCENTE' && (
                            <div className="bg-gradient-to-br from-purple-950 to-indigo-950 p-5 rounded-2xl border border-purple-700/30 shadow-md mb-2 animate-in fade-in slide-in-from-top-4">
                                <h3 className="text-sm font-black text-purple-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    🎓 Panel de Revisión Docente
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    {/* Indicador 1: Objetivos */}
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                        <span className="block text-purple-300 text-[10px] uppercase font-bold mb-1">Objetivos Registrados</span>
                                        <span className={`text-lg font-black ${formData._analytics?.objectivesWorkedCount && formData._analytics.objectivesWorkedCount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {formData._analytics?.objectivesWorkedCount || 0} / {formData._analytics?.objectivesAvailableCount || '?'}
                                        </span>
                                        <span className="block text-purple-400 text-[9px] mt-0.5">Cumplimiento: {formData._analytics?.objectiveComplianceRate || 'N/D'}</span>
                                    </div>
                                    {/* Indicador 2: EVA */}
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                        <span className="block text-purple-300 text-[10px] uppercase font-bold mb-1">Variación Dolor (EVA)</span>
                                        <span className={`text-lg font-black ${(formData._analytics?.evaReduction ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {formData._analytics?.evaReduction !== null && formData._analytics?.evaReduction !== undefined ? (formData._analytics.evaReduction > 0 ? `-${formData._analytics.evaReduction}` : `+${Math.abs(formData._analytics.evaReduction)}`) : 'N/D'}
                                        </span>
                                        <span className="block text-purple-400 text-[9px] mt-0.5">
                                            {formData.pain?.evaStart} → {formData.pain?.evaEnd}
                                        </span>
                                    </div>
                                    {/* Indicador 3: Intervenciones */}
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                        <span className="block text-purple-300 text-[10px] uppercase font-bold mb-1">Procedimientos</span>
                                        <span className={`text-lg font-black ${formData._analytics?.interventionCount && formData._analytics.interventionCount > 0 ? 'text-white' : 'text-amber-400'}`}>
                                            {formData._analytics?.interventionCount || 0}
                                        </span>
                                        <span className="block text-purple-400 text-[9px] mt-0.5 truncate border-t border-purple-800/50 pt-1 mt-1" title={formData._analytics?.interventionCategories?.join(', ')}>
                                            {formData._analytics?.interventionCategories?.join(', ') || 'Sin registro'}
                                        </span>
                                    </div>
                                    {/* Indicador 4: Puntualidad */}
                                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                                        <span className="block text-purple-300 text-[10px] uppercase font-bold mb-1">Demora de Registro</span>
                                        <span className={`text-lg font-black ${formData._analytics?.isLateRegistration ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {formData._analytics?.registrationDelayHours || '?'}h
                                        </span>
                                        <span className="block text-purple-400 text-[9px] mt-0.5 border-t border-purple-800/50 pt-1 mt-1">
                                            {formData._analytics?.isLateRegistration ? '⚠ Excedió 36h' : '✓ En plazo normativo'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}                        {/* --- FASE 2.1.29: BANNER DE CONTINUIDAD --- */}
                        {lastClosedEvol ? (
                            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-5 rounded-2xl border border-indigo-500/30 shadow-md animate-in fade-in slide-in-from-top-4 duration-500 relative overflow-hidden">
                                {/* Decoración de fondo */}
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
                                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

                                <div className="flex items-center gap-2 mb-4 relative z-10">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 font-black text-xs border border-indigo-400/30">
                                        <ClockIcon className="w-3.5 h-3.5" />
                                    </span>
                                    <h3 className="text-sm font-black text-white uppercase tracking-widest">Última Sesión Cerrada</h3>
                                    <span className="ml-auto text-xs font-medium text-indigo-300">
                                        hace {Math.floor(getDifferenceInHours(lastClosedEvol.sessionAt, new Date().toISOString()) / 24)} días
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs relative z-10">
                                    <div className="bg-slate-900/50 p-3 rounded-xl border border-indigo-800/40">
                                        <h4 className="text-[10px] font-bold text-indigo-400 mb-1.5 uppercase">Plan y Objetivos Previos</h4>
                                        <p className="text-slate-200 line-clamp-2">{lastClosedEvol.sessionGoal || "Sin objetivo declarado"}</p>
                                        <p className="text-indigo-200 mt-1 italic line-clamp-1">{lastClosedEvol.nextPlan || "Sin plan pautado"}</p>
                                    </div>
                                    <div className="bg-slate-900/50 p-3 rounded-xl border border-indigo-800/40">
                                        <h4 className="text-[10px] font-bold text-rose-400 mb-1.5 uppercase">Métricas Clínicas (EVA)</h4>
                                        <div className="flex justify-between items-center text-slate-200">
                                            <span>Inicio: <strong className="text-white">{lastClosedEvol.pain?.evaStart || "-"}</strong></span>
                                            <svg className="w-3 h-3 text-slate-500 mx-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                            <span>Salida: <strong className="text-white">{lastClosedEvol.pain?.evaEnd || "-"}</strong></span>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 bg-slate-900/50 p-3 rounded-xl border border-indigo-800/40">
                                        <h4 className="text-[10px] font-bold text-amber-400 mb-1.5 uppercase">Hand-off (Traspaso Colega)</h4>
                                        <p className="text-slate-200 whitespace-pre-wrap">{lastClosedEvol.handoffText || "No dejó notas de traspaso."}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center flex items-center justify-center gap-2">
                                <LightBulbIcon className="w-5 h-5 text-amber-400" />
                                <span className="text-sm text-slate-500 font-medium">Primera sesión clínica. No hay evoluciones cerradas previas en este proceso.</span>
                            </div>
                        )}

                        {/* --- MODO COBERTURA: Alerta si el profesional cambió --- */}
                        {lastClosedEvol && user?.uid !== lastClosedEvol.audit?.createdBy && (
                            <div className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg mb-4 flex items-center gap-4 animate-in fade-in zoom-in duration-500">
                                <div className="bg-white/20 p-2 rounded-full">
                                    <SparklesIcon className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xs font-black uppercase tracking-widest mb-0.5">Modo Cobertura Activo</h4>
                                    <p className="text-sm font-medium opacity-90">
                                        Hola, parece que estás cubriendo a un colega. Hemos priorizado las <b>Notas de Traspaso</b> y el <b>Contexto del Caso</b> para ayudarte.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* --- NOTAS DE TRASPASO DIRECTAS (IMPERDIBLES) --- */}
                        {lastClosedEvol?.handoffText && lastClosedEvol.handoffText.length > 5 && (
                            <div className="bg-amber-500 text-slate-900 p-5 rounded-2xl shadow-xl mb-4 border-2 border-amber-600 animate-pulse-subtle">
                                <div className="flex items-center gap-2 mb-2">
                                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-900" />
                                    <h4 className="text-[11px] font-black uppercase tracking-tighter text-amber-900">Mensaje Crítico del Colega Anterior</h4>
                                </div>
                                <p className="text-sm font-bold italic leading-relaxed">
                                    "{lastClosedEvol.handoffText}"
                                </p>
                            </div>
                        )}

                        {/* --- FASE 2.2.4: BANNER PROCESO ACTIVO (Semaforo, Consideraciones, Baselines) --- */}
                        {procesoContext.caseSnapshot ? (
                            <div className="bg-white p-4 lg:p-5 rounded-2xl border-l-4 border-l-indigo-500 border-y border-r border-slate-200 shadow-sm relative mb-2 animate-in fade-in slide-in-from-bottom-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-lg">📋</span>
                                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Contexto del Caso Activo</h3>
                                    {(procesoContext.caseSnapshot.trafficLight || (procesoContext.caseSnapshot as any).irritabilidadTexto) && (
                                        <div className="ml-auto flex flex-col items-end">
                                            <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider font-extrabold ${procesoContext.caseSnapshot.trafficLight === 'Rojo' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                                                procesoContext.caseSnapshot.trafficLight === 'Amarillo' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                    'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                }`}>
                                                Semáforo: {procesoContext.caseSnapshot.trafficLight}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">
                                                {(procesoContext.caseSnapshot as any).irritabilidadTexto 
                                                    ? `Irrit: ${(procesoContext.caseSnapshot as any).irritabilidadTexto} | Carga: ${(procesoContext.caseSnapshot as any).toleranciaCargaTexto || 'N/A'}`
                                                    : procesoContext.caseSnapshot.trafficLight === 'Rojo' ? 'Alta irritabilidad (Precaución)' :
                                                      procesoContext.caseSnapshot.trafficLight === 'Amarillo' ? 'Irritabilidad media (Cautela)' :
                                                      'Baja irritabilidad (Carga progresiva)'}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                    {procesoContext.caseSnapshot.baselineComparable && (
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="block font-black text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">Signo Comparable (Baseline)</span>
                                            <span className="text-slate-700 font-medium">
                                                {typeof procesoContext.caseSnapshot.baselineComparable === 'string'
                                                    ? procesoContext.caseSnapshot.baselineComparable
                                                    : (procesoContext.caseSnapshot.baselineComparable.name || procesoContext.caseSnapshot.baselineComparable.result || 'Sin dato registrado')}
                                            </span>
                                        </div>
                                    )}
                                    {procesoContext.caseSnapshot.lastRetest && (
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                            <span className="block font-black text-slate-500 text-[10px] uppercase tracking-wider mb-1.5">Último Retest (Reevaluación)</span>
                                            <span className="text-slate-700 font-medium">{procesoContext.caseSnapshot.lastRetest}</span>
                                        </div>
                                    )}
                                    {(procesoContext.caseSnapshot.diagnosticoNarrativo || procesoContext.caseSnapshot.summary || procesoContext.caseSnapshot.p4?.narrativeDiagnosis) && (
                                        <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-200/50 md:col-span-2">
                                            <span className="block font-black text-orange-600 text-[10px] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                                <ExclamationCircleIcon className="w-4 h-4" />
                                                Diagnóstico y Resumen Clínico
                                            </span>
                                            <p className="text-orange-950/80 font-medium ml-5">{procesoContext.caseSnapshot.diagnosticoNarrativo || procesoContext.caseSnapshot.summary || procesoContext.caseSnapshot.p4?.narrativeDiagnosis}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center gap-2 mb-4">
                                <div className="bg-slate-200 p-3 rounded-full">
                                    <ExclamationCircleIcon className="w-6 h-6 text-slate-400" />
                                </div>
                                <p className="text-xs text-slate-500 font-bold max-w-xs">
                                    📌 No hay resumen de diagnóstico o signo comparable registrado en la Evaluación Inicial de este proceso. Asegúrese de completar la síntesis en la evaluación.
                                </p>
                            </div>
                        )}

                        {/* GRUPO ESENCIAL DEL PACIENTE (Scroll Spy agrupa estos acórdeones) */}
                        <div id="sec-esencial" className="space-y-4 scroll-mt-6">

                            {/* 1. SECCIÓN ADMINISTRATIVA Y ESTADO (REORGANIZADO 3.4) */}
                            <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border-y border-r border-slate-200 shadow-sm relative mb-2 animate-in fade-in slide-in-from-top-4">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    Asistencia y Objetivos
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {/* Módulo de Asistencia Movido Arriba */}
{/* ESTADO DE SESIÓN (FASE 2.1.14) */}
                                    <div className="md:col-span-2 mt-1 pt-4 border-t border-slate-200">
                                        <label className="block text-[11px] font-bold text-slate-600 mb-2 uppercase tracking-wide">Estado de la Sesión <span className="text-rose-500">*</span></label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Realizada', 'No asiste', 'Cancelada', 'Suspendida por mal estado'].map(status => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    disabled={isClosed}
                                                    onClick={() => setFormData(prev => ({ ...prev, sessionStatus: status as any }))}
                                                    className={`px-4 py-2.5 rounded-xl text-[11px] tracking-wide uppercase font-black transition-all border ${formData.sessionStatus === status
                                                        ? (status === 'Realizada' ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-1 ring-emerald-400 ring-offset-1' : 'bg-rose-600 text-white border-rose-500 shadow-md ring-1 ring-rose-400 ring-offset-1')
                                                        : 'bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100 hover:border-slate-400 hover:text-slate-800'
                                                        }`}
                                                >
                                                    {status}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MÓDULO DE SUSPENSIÓN (Condicional) */}
                                    {formData.sessionStatus && formData.sessionStatus !== 'Realizada' && (
                                        <div className="md:col-span-2 mt-1 p-5 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-inner">
                                            <h4 className="text-[11px] uppercase tracking-wider font-black text-rose-800 mb-3 flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                                Auditoría de Sesión {formData.sessionStatus}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-rose-700/80 mb-1.5 uppercase">Motivo Principal <span className="text-rose-600">*</span></label>
                                                    <select
                                                        disabled={isClosed}
                                                        value={formData.suspensionDetails?.reason || ""}
                                                        onChange={(e) => handleNestedChange("suspensionDetails", "reason", e.target.value)}
                                                        className="w-full border border-rose-200/80 bg-white rounded-xl px-3 py-3 text-xs font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 text-rose-900 shadow-sm transition-all"
                                                    >
                                                        <option value="">Seleccionar motivo...</option>
                                                        <option value="Enfermedad aguda sistémica">Enfermedad aguda sistémica (Fiebre, viral...)</option>
                                                        <option value="Dolor incapacitante">Dolor elevado limitante al movimiento</option>
                                                        <option value="Problemas personales/laborales">Conflicto laboral o personal</option>
                                                        <option value="Olvido o Confusión">Olvido o Confusión de horario</option>
                                                        <option value="Falta de transporte">Ausencia de locomoción para asistir</option>
                                                        <option value="Criterio clínico kinésico">Suspendido por Criterio Clínico intensesión</option>
                                                        <option value="Otro justificativo">Otro justificativo</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-rose-700/80 mb-1.5 uppercase">Acción Tomada <span className="text-rose-600">*</span></label>
                                                    <select
                                                        disabled={isClosed}
                                                        value={formData.suspensionDetails?.action || ""}
                                                        onChange={(e) => handleNestedChange("suspensionDetails", "action", e.target.value)}
                                                        className="w-full border border-rose-200/80 bg-white rounded-xl px-3 py-3 text-xs font-bold outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 text-rose-900 shadow-sm transition-all"
                                                    >
                                                        <option value="">Decisión clínica u operativa...</option>
                                                        <option value="Educación y Auto-manejo">Entregar pautas de Auto-manejo</option>
                                                        <option value="Derivación médica">Indicar Reposo y Derivar a médico general</option>
                                                        <option value="Derivación a Urgencia">Derivación inminente a Urgencia Hospitalaria</option>
                                                        <option value="Reagendamiento y Cobro">Registrar atención, cobrar y Reagendar</option>
                                                        <option value="Solo Reagendamiento">Reagendar flexibilidad operativa (Sin cobro)</option>
                                                        <option value="Otra acción">Otra acción clínica/administrativa</option>
                                                    </select>
                                                </div>
                                                <div className="md:col-span-2">
                                                    <label className="block text-[10px] font-bold text-rose-700/80 mb-1.5 uppercase">Nota Aclaratoria Extra</label>
                                                    <input
                                                        type="text"
                                                        disabled={isClosed}
                                                        value={formData.suspensionDetails?.note || ""}
                                                        onChange={(e) => handleNestedChange("suspensionDetails", "note", e.target.value)}
                                                        placeholder="Detalles sobre por qué se canceló y quién avisó..."
                                                        className="w-full border border-rose-200/80 bg-white rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-200 text-rose-900 shadow-sm"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    

                                    {/* Módulo de Objetivos Movido Arriba */}
                                    <div className="md:col-span-2">
{/* FASE 2.1.24: OBJETIVOS VIGENTES DEL PROCESO */}
                                            {availableObjectives.length > 0 && (
                                                <div className="col-span-1 bg-sky-50/50 p-4 rounded-xl border border-sky-100 shadow-sm">
                                                    <div className="mb-3">
                                                        <label className="block text-[11px] font-bold text-sky-700 uppercase tracking-wide flex items-center justify-between">
                                                            <span>Objetivos Vigentes del Proceso</span>
                                                            <span className="text-[9px] bg-sky-100 text-sky-600 px-2 py-0.5 rounded-full border border-sky-200">Requerido</span>
                                                        </label>
                                                        {objectivesSource && (
                                                            <span className="text-[9px] text-sky-600 font-medium italic mt-0.5 block">Origen: {objectivesSource}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col gap-3">
                                                        {availableObjectives.map(obj => {
                                                            const isSelected = formData.selectedObjectiveIds?.includes(obj.id);
                                                            const workObj = formData.objectiveWork?.find(w => w.id === obj.id);

                                                            return (
                                                                <div key={obj.id} className={`p-3 rounded-xl border transition-all ${isSelected ? 'bg-white border-sky-300 shadow-sm ring-1 ring-sky-100' : 'bg-white/60 border-slate-200 hover:border-sky-200'}`}>
                                                                    <div className="flex items-start gap-3">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isClosed}
                                                                            onClick={() => toggleObjective(obj.id)}
                                                                            className={`mt-0.5 shrink-0 w-5 h-5 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-sky-500 border-sky-600 text-white' : 'bg-slate-100 border-slate-300'}`}
                                                                        >
                                                                            {isSelected && <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                                                                        </button>
                                                                        <div className="flex-1">
                                                                            <p className={`text-xs font-medium leading-relaxed ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>{obj.label}</p>

                                                                            {/* Mini-estado si está seleccionado */}
                                                                            {isSelected && (
                                                                                <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                                                    {(['trabajado', 'avanzó', 'sin cambio', 'empeoró'] as const).map(status => (
                                                                                        <button
                                                                                            key={status}
                                                                                            type="button"
                                                                                            disabled={isClosed}
                                                                                            onClick={() => toggleObjective(obj.id, status)}
                                                                                            className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all border ${workObj?.sessionStatus === status ?
                                                                                                (status === 'avanzó' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                                                                                    status === 'empeoró' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                                                                                                        status === 'sin cambio' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                                                                                            'bg-sky-100 text-sky-800 border-sky-300') :
                                                                                                'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                                                                                }`}
                                                                                        >
                                                                                            {status}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div>

                            {/* 2. CHECK-IN Y EVA (REORGANIZADO 3.4) */}
                            <AccordionSection
                                id="sec-checkin"
                                title="Check-In Clínico del Paciente"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                                defaultOpen={true}
                                theme="emerald"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                                    {/* EVA INITIAL */}
<div className="col-span-1">
                                                <EvaSlider
                                                    label="Dolor al Ingresar (EVA)"
                                                    value={formData.pain?.evaStart !== "" && formData.pain?.evaStart !== undefined ? Number(formData.pain.evaStart) : undefined}
                                                    onChange={(val) => handleNestedChange("pain", "evaStart", val !== undefined ? String(val) : "")}
                                                    disabled={isClosed}
                                                />
                                            </div>
                                    
                                    {/* META PARA HOY */}
<div className="col-span-1">
                                                <div className="flex justify-between items-end mb-1.5">
                                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                                        Principal molestia o meta para hoy
                                                        {availableObjectives.length === 0 && <span className="text-slate-400 font-medium normal-case ml-1">(Objetivo temporal)</span>}
                                                        <span className="text-emerald-600 ml-1">*</span>
                                                    </label>
                                                </div>

                                    {/* SIGNOS VITALES OPTATIVOS */}
{/* SIGNOS VITALES OPTATIVOS (TRIAJE) */}
                                    <div className="md:col-span-2 mt-1">
                                        <Disclosure as="div" className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                            {({ open }) => (
                                                <>
                                                    <Disclosure.Button className="w-full px-4 py-3 flex justify-between items-center hover:bg-slate-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                                                        <div className="flex items-center gap-2 text-emerald-600">
                                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Triaje y Signos Vitales al Llegar</span>
                                                            <span className="text-[9px] font-medium text-slate-400 ml-1">(Opcional)</span>
                                                        </div>
                                                        <ChevronDownIcon className={`${open ? 'rotate-180 transform' : ''} h-5 w-5 text-slate-400 transition-transform`} />
                                                    </Disclosure.Button>
                                                    <Transition
                                                        enter="transition duration-100 ease-out"
                                                        enterFrom="transform scale-95 opacity-0"
                                                        enterTo="transform scale-100 opacity-100"
                                                        leave="transition duration-75 ease-out"
                                                        leaveFrom="transform scale-100 opacity-100"
                                                        leaveTo="transform scale-95 opacity-0"
                                                    >
                                                        <Disclosure.Panel className="p-4 border-t border-slate-200 bg-white gap-4 grid grid-cols-2 md:grid-cols-4">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">PA Sistólica</label>
                                                                <div className="relative">
                                                                    <input type="number" disabled={isClosed} value={formData.vitalSigns?.bloodPressureSys || ""} onChange={(e) => handleNestedChange("vitalSigns", "bloodPressureSys", e.target.value === "" ? "" : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-inner hover:border-slate-300" />
                                                                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">SYS</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">PA Diastólica</label>
                                                                <div className="relative">
                                                                    <input type="number" disabled={isClosed} value={formData.vitalSigns?.bloodPressureDia || ""} onChange={(e) => handleNestedChange("vitalSigns", "bloodPressureDia", e.target.value === "" ? "" : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-inner hover:border-slate-300" />
                                                                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">DIA</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Frec. Cardíaca</label>
                                                                <div className="relative">
                                                                    <input type="number" disabled={isClosed} value={formData.vitalSigns?.heartRate || ""} onChange={(e) => handleNestedChange("vitalSigns", "heartRate", e.target.value === "" ? "" : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-inner hover:border-slate-300" />
                                                                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">BPM</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Saturación SpO2</label>
                                                                <div className="relative">
                                                                    <input type="number" step="0.1" disabled={isClosed} value={formData.vitalSigns?.spO2 || ""} onChange={(e) => handleNestedChange("vitalSigns", "spO2", e.target.value === "" ? "" : Number(e.target.value))} className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 shadow-inner hover:border-slate-300" />
                                                                    <span className="absolute right-3 top-2.5 text-xs font-semibold text-slate-400">%</span>
                                                                </div>
                                                            </div>

                                                            <div className="col-span-2 md:col-span-4 mt-2 border-t border-slate-100 pt-3">
                                                                <label className="block text-[10px] font-bold text-slate-500 mb-2 uppercase">Monitor de Síntomas Referidos Clínicamente</label>
                                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                                    {['Fiebre', 'Mareos', 'Náuseas', 'Vómitos', 'Fatiga Extrema', 'Cefalea Severa', 'Disnea', 'Sudoración fría'].map(sint => {
                                                                        const isSelected = formData.vitalSigns?.acuteSymptoms?.includes(sint);
                                                                        return (
                                                                            <button
                                                                                key={sint}
                                                                                type="button"
                                                                                disabled={isClosed}
                                                                                onClick={() => {
                                                                                    const current = formData.vitalSigns?.acuteSymptoms || [];
                                                                                    const newVal = isSelected ? current.filter(s => s !== sint) : [...current, sint];
                                                                                    handleNestedChange("vitalSigns", "acuteSymptoms", newVal);
                                                                                }}
                                                                                className={`px-3 py-1.5 text-[10px] uppercase tracking-wider rounded-lg font-bold transition-all ${isSelected ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm hover:bg-amber-200' : 'bg-white text-slate-500 hover:text-slate-800 border border-slate-300 hover:bg-slate-50'}`}
                                                                            >
                                                                                {sint}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    disabled={isClosed}
                                                                    onClick={() => {
                                                                        handleNestedChange("vitalSigns", "acuteSymptoms", ["Asintomático"]);
                                                                        handleNestedChange("vitalSigns", "symptomNote", "N/A" as any);
                                                                    }}
                                                                    className="py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                                                >
                                                                    Marcar como "Asintomático"
                                                                </button>
                                                                <input type="text" placeholder="Observaciones extras de Triaje..." disabled={isClosed} value={formData.vitalSigns?.symptomNote || ""} onChange={(e) => handleNestedChange("vitalSigns", "symptomNote", e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium outline-none focus:border-emerald-500 text-slate-700 shadow-inner hover:border-slate-300" />
                                                            </div>
                                                        </Disclosure.Panel>
                                                    </Transition>
                                                </>
                                            )}
                                        </Disclosure>
                                    </div>
                                </div>
                            </div>
                            </AccordionSection>

                            {/* 3. DATOS ADMINISTRATIVOS MENORES */}
<AccordionSection
                                id="sec-admin"
                                title="Datos Administrativos de Sesión"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                defaultOpen={false}
                                theme="slate"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Fecha y Hora Real <span className="text-rose-500">*</span></label>
                                        <input
                                            type="datetime-local"
                                            value={toDateTimeLocal(formData.sessionAt as string)}
                                            onChange={handleDateChange}
                                            disabled={isClosed}
                                            max={toDateTimeLocal(new Date().toISOString())}
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 transition-all font-medium text-slate-700 shadow-inner"
                                            required
                                        />
                                        <p className="text-[10px] text-slate-500 mt-2 font-medium leading-relaxed">Registro bioético. Un atraso al digitalizar mayor a 36hrs exige justificación de auditoría.</p>
                                        
                                        {/* PASO 3.2: Panel 36h Inline */}
                                        {isLateDraft && !isClosed && (
                                            <div className="mt-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl animate-in fade-in slide-in-from-top-2">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <ClockIcon className="w-5 h-5 text-amber-600" />
                                                    <span className="text-sm font-black text-amber-800 uppercase tracking-wide">Registro Extemporáneo — Requiere Justificación</span>
                                                </div>
                                                <p className="text-[10px] text-amber-700 mb-3 font-medium">
                                                    Esta sesión fue registrada con más de 36 horas de diferencia a la hora real de atención.
                                                    El motivo quedará permanentemente en el historial.
                                                </p>
                                                <select value={lateCategory} onChange={e => setLateCategory(e.target.value)}
                                                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs mb-2 bg-white text-slate-800 font-semibold focus:ring-2 focus:ring-amber-400 outline-none">
                                                    <option value="">-- Seleccionar causal --</option>
                                                    <option value="Fallo infraestructura">Fallo de Infraestructura (Luz/Internet)</option>
                                                    <option value="Traspaso desde papel">Digitalización desde registro en papel</option>
                                                    <option value="Emergencia clínica">Emergencia médica durante el turno</option>
                                                    <option value="Olvido administrativo">Reconocimiento: Olvido Administrativo</option>
                                                    <option value="Otro">Otro motivo — Detallar abajo</option>
                                                </select>
                                                <textarea value={lateText} onChange={e => setLateText(e.target.value)} rows={2}
                                                    placeholder="Explicación detallada (mínimo 20 caracteres)..."
                                                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-xs resize-none bg-white text-slate-800 font-medium focus:ring-2 focus:ring-amber-400 outline-none" />
                                                <div className="text-right text-[10px] text-amber-600 font-bold mt-1">
                                                    {lateText.length}/20 caracteres mínimos
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Clínico / Interno</label>
                                        <input
                                            type="text"
                                            disabled
                                            value={initialData?.autorName || user?.email || "Cargando..."}
                                            className="w-full border border-slate-200 bg-slate-100 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-not-allowed font-medium shadow-inner"
                                        />
                                    </div>
                                </div>
                            </AccordionSection>

                            {/* 1. SECCIÓN ADMINISTRATIVA */}
                            



                            
                        </div> {/* Fin Envoltura Esencial A */}

                        {/* BLOQUE B: QUÉ SE HIZO (Intervenciones + Ejercicios) */}
                        <div id="sec-interv" className="scroll-mt-6">
                            <AccordionSection
                                id="interv-pass"
                                title="B. Qué se Ejecutó (Procedimientos)"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>}
                                theme="amber"
                            >
                                <div className="mt-2">
                                    <div className="flex justify-end mb-3">
                                        <button
                                            type="button"
                                            onClick={duplicatePreviousExercises}
                                            disabled={isClosed}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                            Copiar de sesión anterior
                                        </button>
                                    </div>
                                    <InterventionPanel
                                        interventions={formData.interventions || []}
                                        onChange={(newInterventions) => setFormData(prev => ({ ...prev, interventions: newInterventions as any }))}
                                        activeObjectives={availableObjectives.filter(obj => formData.selectedObjectiveIds?.includes(obj.id))}
                                        disabled={isClosed}
                                    />
                                </div>
                            </AccordionSection>
                        </div>

                        {/* 4. SECCIÓN EJERCICIOS (Módulo Premium) */}
                        <div id="sec-ejerc" className="scroll-mt-6">
                            <div className="bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-800 p-6 md:p-8 rounded-3xl border border-indigo-950 shadow-xl relative overflow-hidden group mb-4">
                                {/* Visual Noise & Glow */}
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>

                                <div className="relative z-10">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-indigo-700/50 pb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 backdrop-blur-sm">
                                                <svg className="w-6 h-6 text-indigo-300" fill="currentColor" viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z" /></svg>
                                            </div>
                                            <div>
                                                <h3 className="text-base font-black text-white uppercase tracking-widest">
                                                    Prescripción de Ejercicio
                                                </h3>
                                                <p className="text-xs text-indigo-200/80 font-medium mt-1">Estructura clínica con variables biomédicas.</p>
                                            </div>
                                        </div>

                                        {/* PERCEPTION MODE SELECTOR GLOBAL */}
                                        <div className="flex items-center gap-1 bg-indigo-950/70 p-1 rounded-xl border border-indigo-800/60 shadow-inner">
                                            <button
                                                type="button"
                                                disabled={isClosed}
                                                onClick={() => setFormData(prev => ({ ...prev, perceptionMode: 'RIR' }))}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${(!formData.perceptionMode || formData.perceptionMode === 'RIR') ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-400 hover:text-indigo-200'}`}
                                            >
                                                Usar RIR
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isClosed}
                                                onClick={() => setFormData(prev => ({ ...prev, perceptionMode: 'RPE' }))}
                                                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${formData.perceptionMode === 'RPE' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-400 hover:text-indigo-200'}`}
                                            >
                                                Usar RPE
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-end justify-between mb-3">
                                        <label className="block text-[11px] font-bold text-indigo-300 uppercase tracking-wide ml-1">Planilla Dinámica de Ejercicios</label>
                                        <span className="text-[10px] text-indigo-400 font-medium">{formData.exercises?.length || 0} cargados</span>
                                    </div>

                                    {formData.exercises?.map((ex, index) => {
                                        const currentPerception = formData.perceptionMode || 'RIR';

                                        return (
                                            <ExerciseRow
                                                key={ex.id}
                                                exercise={ex}
                                                index={index}
                                                effortMode={currentPerception as 'RIR' | 'RPE'}
                                                isClosed={isClosed}
                                                isFirst={index === 0}
                                                isLast={index === (formData.exercises?.length || 0) - 1}
                                                activeObjectives={availableObjectives.filter(obj => formData.selectedObjectiveIds?.includes(obj.id))}
                                                onChange={(updatedEx) => updateExerciseFull(updatedEx)}
                                                onRemove={() => removeExercise(ex.id)}
                                                onMoveUp={() => moveExercise(index, 'up')}
                                                onMoveDown={() => moveExercise(index, 'down')}
                                                onDuplicateFromAbove={index > 0 ? () => {
                                                    const prevEx = formData.exercises![index - 1];
                                                    const duplicated = { ...prevEx, id: generateId() };
                                                    const newList = [...formData.exercises!];
                                                    newList.splice(index, 1, duplicated);
                                                    setFormData(prev => ({ ...prev, exercises: newList }));
                                                } : undefined}
                                            />
                                        );
                                    })}

                                    {/* CONTROLES DE AÑADIR EJERCICIO (FASE 2.1.26) */}
                                    {!isClosed && (
                                        <div className="mt-4 flex flex-col gap-3">
                                            {/* Quick Add por línea */}
                                            <div className="flex flex-col md:flex-row gap-2 w-full bg-slate-900/50 p-2 md:p-1 rounded-2xl border border-indigo-900/40 focus-within:border-indigo-500/80 transition-all shadow-inner" role="group">
                                                <div className="flex-1 relative flex items-center">
                                                    <SparklesIcon className="w-5 h-5 text-indigo-400 absolute left-3" />
                                                    <input
                                                        type="text"
                                                        value={quickAddText}
                                                        onChange={e => setQuickAddText(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (quickAddText.trim()) processQuickAdd();
                                                            }
                                                        }}
                                                        placeholder="Pega o escribe. Ej: Sentadilla Búlgara 3x10 20kg RIR 2 descanso 90"
                                                        className="w-full bg-transparent border-none pl-10 pr-4 h-12 text-[13px] md:text-sm font-medium text-white outline-none placeholder:text-indigo-400/50"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={processQuickAdd}
                                                    disabled={!quickAddText.trim()}
                                                    className="md:w-36 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 text-white font-bold h-10 md:h-12 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md border border-indigo-500"
                                                >
                                                    <PlusIcon className="w-4 h-4" /> Inteligente
                                                </button>
                                            </div>

                                            {/* Opciones clásicas */}
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <button type="button" onClick={addExercise} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white shadow-md font-bold py-3 md:py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs md:text-sm">
                                                    <PlusIcon className="w-5 h-5" />
                                                    Añadir Ejercicio en Blanco
                                                </button>
                                                <button type="button" onClick={duplicatePreviousExercises} className="md:w-auto w-full border border-indigo-600 bg-indigo-800/40 hover:bg-indigo-700/60 text-indigo-100 font-bold py-3 md:py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs md:text-sm shadow-sm backdrop-blur-sm group">
                                                    <DocumentDuplicateIcon className="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors" />
                                                    Duplicar Evolución Anterior
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- BLOQUE C: TRAZABILIDAD Y CIERRE --- */}
                        <div id="sec-result" className="scroll-mt-24 space-y-5">
                            <div className="flex items-center gap-2 mb-6 p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-200 text-amber-800 font-black text-xs">C</span>
                                <h3 className="text-sm font-black text-amber-900 uppercase tracking-widest">Cierre y Planificación</h3>
                            </div>



                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-100">

                                <div className="col-span-1 md:col-span-12 border-b border-slate-100 pb-5 mb-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-3">EVA Salida (0-10) al terminar <span className="text-rose-600">*</span></label>
                                    <div className="w-full">
                                        <EvaSlider
                                            label=""
                                            value={formData.pain?.evaEnd !== "" && formData.pain?.evaEnd !== undefined ? Number(formData.pain.evaEnd) : undefined}
                                            onChange={(val) => handleNestedChange("pain", "evaEnd", val !== undefined ? String(val) : "")}
                                            disabled={isClosed}
                                        />
                                    </div>
                                    {Number(formData.pain?.evaEnd) > Number(formData.pain?.evaStart) && formData.pain?.evaEnd !== "" && formData.pain?.evaStart !== "" && formData.pain?.evaEnd !== undefined && formData.pain?.evaStart !== undefined && (
                                        <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-full flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                            Dolor aumentó
                                        </span>
                                    )}
                                </div>

                                <div className="col-span-1 md:col-span-12">
                                    <div className="flex justify-between items-end mb-1.5">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">Hito Logrado y Plan Próxima Sesión <span className="text-rose-600">*</span></label>
                                    </div>
                                    <textarea
                                        name="nextPlan"
                                        value={formData.nextPlan || ""}
                                        disabled={isClosed}
                                        onChange={handleChange}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[100px]"
                                        placeholder="Planifique la dosis o las metas de la siguiente sesión para alertar al próximo colega..."
                                    />
                                </div>

                                <div className="col-span-1 md:col-span-12 mt-2">
                                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-2 mb-1.5">
                                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                            Resumen de Traspaso (Handoff) Inter-Colegas
                                        </label>
                                    </div>
                                    <textarea
                                        name="handoffText"
                                        value={formData.handoffText || ""}
                                        disabled={isClosed}
                                        onChange={handleChange}
                                        className="w-full border border-indigo-100 bg-indigo-50/20 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[80px] placeholder:text-slate-400"
                                        placeholder="Si alguien te debe cubrir la próxima sesión, ¿Qué le aconsejas revisar o continuar?"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1 italic">
                                        Evita re-escribir los ejercicios aquí. Enfócate en la tolerancia y red-flags.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* FASE 2.2.6: MINI-PANEL ÚLTIMOS OUTCOMES */}
                        {recentOutcomes.length > 0 && (
                            <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm mt-4 mb-2">
                                <h4 className="text-[10px] font-black uppercase text-indigo-700 tracking-wider mb-2 flex items-center gap-1">
                                    <SparklesIcon className="w-3 h-3" /> Últimos Resultados Clínicos
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {recentOutcomes.map(o => (
                                        <div key={o.id} className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 px-3 text-xs w-fit flex items-center gap-2">
                                            <span className="font-bold text-indigo-900 bg-white px-1.5 py-0.5 rounded shadow-sm">{o.type}</span>
                                            <span className="text-indigo-800 font-bold">
                                                {o.type === 'SANE' ? `${o.values.score}%` : o.type === 'GROC' ? (o.values.score > 0 ? `+${o.values.score}` : o.values.score) : 'Test'}
                                            </span>
                                            <span className="text-[10px] text-slate-500 border-l border-indigo-200 pl-2">Hace {Math.floor((new Date().getTime() - new Date(o.capturedAt).getTime()) / (1000 * 3600 * 24))}d</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* MANTENIDO: Herramientas GROC y SANE */}
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 mt-2">
                            <h4 className="text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 pb-2 mb-3">Métricas Optativas Formales</h4>
                            <div className="col-span-1 md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                {/* GROC */}
                                <div>
                                    {formData.outcomesSnapshot?.groc !== undefined ? (
                                        <div className="bg-rose-50/30 border border-rose-100 p-4 rounded-2xl">
                                            <div className="flex justify-between items-start mb-3">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                                    GROC <span className="text-[9px] text-slate-400 font-medium normal-case ml-1">(Cambio Global)</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!isClosed && (
                                                        <button type="button" onClick={() => handleNestedChange("outcomesSnapshot", "groc", undefined)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded-full hover:bg-rose-100 transition-colors bg-white shadow-sm border border-rose-100">Cerrar ✕</button>
                                                    )}
                                                    <span className="text-sm font-black px-2.5 py-0.5 rounded-full border text-rose-600 bg-rose-100 border-rose-200">
                                                        {formData.outcomesSnapshot?.groc !== null ? (Number(formData.outcomesSnapshot.groc) > 0 ? `+${formData.outcomesSnapshot.groc}` : String(formData.outcomesSnapshot.groc)) : "0"}
                                                    </span>
                                                </div>
                                            </div>
                                            <input
                                                type="range"
                                                min="-7" max="7" step="1"
                                                disabled={isClosed}
                                                value={formData.outcomesSnapshot?.groc || 0}
                                                onChange={(e) => handleNestedChange("outcomesSnapshot", "groc", Number(e.target.value))}
                                                className="w-full accent-rose-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                                                <span>Mucho Peor (-7)</span>
                                                <span>Igual (0)</span>
                                                <span>Mucho Mejor (+7)</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" disabled={isClosed} onClick={() => handleNestedChange("outcomesSnapshot", "groc", 0)} className="w-full h-full min-h-[50px] bg-slate-50 border-2 border-dashed border-slate-200 hover:border-rose-300 text-slate-400 font-bold text-xs rounded-2xl hover:text-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                            <span className="text-lg leading-none">+</span> Registrar GROC <span className="text-[10px] font-medium normal-case">(Opcional)</span>
                                        </button>
                                    )}
                                </div>

                                {/* SANE */}
                                <div>
                                    {formData.outcomesSnapshot?.sane !== undefined ? (
                                        <div className="bg-blue-50/30 border border-blue-100 p-4 rounded-2xl">
                                            <div className="flex justify-between items-start mb-3">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                                    SANE <span className="text-[9px] text-slate-400 font-medium normal-case ml-1">(Eval. Numérica)</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {!isClosed && (
                                                        <button type="button" onClick={() => handleNestedChange("outcomesSnapshot", "sane", undefined)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors bg-white shadow-sm border border-blue-100">Cerrar ✕</button>
                                                    )}
                                                    <span className="text-sm font-black px-2.5 py-0.5 rounded-full border text-blue-600 bg-blue-100 border-blue-200">
                                                        {formData.outcomesSnapshot?.sane !== null ? `${String(formData.outcomesSnapshot.sane)}%` : "0%"}
                                                    </span>
                                                </div>
                                            </div>
                                            <input
                                                type="range"
                                                min="0" max="100" step="5"
                                                disabled={isClosed}
                                                value={formData.outcomesSnapshot?.sane || 0}
                                                onChange={(e) => handleNestedChange("outcomesSnapshot", "sane", Number(e.target.value))}
                                                className="w-full accent-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                            />
                                            <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2">
                                                <span>0%</span>
                                                <span className="text-center">50%</span>
                                                <span className="text-right">100%</span>
                                            </div>
                                            <div className="flex justify-between text-[8.5px] font-medium text-slate-400 uppercase tracking-tighter">
                                                <span>Pésimo</span>
                                                <span>Normal</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <button type="button" disabled={isClosed} onClick={() => handleNestedChange("outcomesSnapshot", "sane", 0)} className="w-full h-full min-h-[50px] bg-slate-50 border-2 border-dashed border-slate-200 hover:border-blue-300 text-slate-400 font-bold text-xs rounded-2xl hover:text-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                            <span className="text-lg leading-none">+</span> Registrar SANE <span className="text-[10px] font-medium normal-case">(Opcional)</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ALERTA: AUDITORÍA CIERRE TARDÍO PREEXISTENTE */}
                        {isClosed && formData.audit?.lateReason && (
                            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 mt-6 flex items-start gap-4 shadow-sm mb-8">
                                <div className="bg-amber-100 p-2.5 rounded-full mt-1 shrink-0">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                </div>
                                <div>
                                    <h4 className="text-[11px] font-black text-amber-900 uppercase tracking-widest border-b border-amber-200/50 pb-2 mb-2">Auditoría: Cierre Extemporáneo Registrado</h4>
                                    <p className="text-sm text-amber-800 font-medium bg-amber-100/50 p-4 rounded-xl border border-amber-200/50 italic leading-relaxed hover:bg-amber-100 transition-colors">"{formData.audit.lateReason}"</p>
                                </div>
                            </div>
                        )}

                        {/* DUMP LEGACY (Si la evolución migrada contiene texto antiguo rescatado) */}
                        {formData.notesLegacy && (
                            <div className="bg-slate-100 p-5 rounded-2xl border border-slate-300 mt-4 shadow-sm">
                                <h4 className="text-[11px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-200 pb-2 mb-3">
                                    Notas Históricas (Antes de actualización)
                                </h4>
                                <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap">
                                    {formData.notesLegacy}
                                </pre>
                            </div>
                        )}

                        {/* TARJETAS DEL ASISTENTE CLÍNICO */}
                        {!isClosed && (
                            <div className="mt-8 mb-4 border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-3xl p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <SparklesIcon className="w-5 h-5 text-indigo-500" />
                                    <h3 className="text-sm font-black text-indigo-900 uppercase tracking-wider">Análisis Inteligente Clínico</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {assistantCards.map(card => (
                                        <div key={card.id} className={`flex items-start gap-3 p-4 rounded-2xl border shadow-sm ${card.style} transition-all`}>
                                            <div className="shrink-0 mt-0.5 bg-white p-1 rounded-full shadow-sm">
                                                {card.icon}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider mb-1">{card.title}</h4>
                                                <p className="text-xs font-medium leading-relaxed opacity-90">{card.message}</p>
                                                {card.requiresAction && card.actionType === 'contradictionReason' && (
                                                    <div className="mt-3">
                                                        <input
                                                            type="text"
                                                            placeholder="Ingrese aquí una justificación clínica breve (>5 carácteres)..."
                                                            value={formData.pain?.contradictionReason || ""}
                                                            disabled={isClosed}
                                                            onChange={(e) => handleNestedChange("pain", "contradictionReason", e.target.value)}
                                                            className="w-full border border-rose-300 bg-white rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-rose-500 transition-all font-medium text-slate-700 shadow-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>{/* Fin Div espaciador Accordiones principales */}
                </div>{/* Fin padding body */}
            </div>{/* Fin scroll container */}


            {/* MODAL COPIA SELECTIVA (FASE 2.1.25) */}
            {showCopyModal && copyCandidates && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh]">
                        {/* HEADER MODAL */}
                        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-800/50 rounded-t-2xl">
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <DocumentDuplicateIcon className="w-6 h-6 text-indigo-400" />
                                Importador Selectivo Clínico
                            </h3>
                            <button onClick={() => setShowCopyModal(false)} className="text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-700 p-1.5 rounded-lg transition-colors">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>

                        {/* BODY MODAL */}
                        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-6">
                            <p className="text-sm text-slate-300">Seleccione qué registros de la <b>sesión anterior</b> desea rescatar a la sesión actual. Se mantendrá trazabilidad de clonación.</p>

                            {/* BLOQUE INTERVENCIONES */}
                            {copyCandidates.interventions.length > 0 && (
                                <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[11px] font-black tracking-widest text-indigo-300 uppercase">Intervenciones ({copyCandidates.interventions.length})</h4>
                                        <button
                                            onClick={() => {
                                                if (selectedInterventionsToCopy.size === copyCandidates.interventions.length) {
                                                    setSelectedInterventionsToCopy(new Set());
                                                } else {
                                                    setSelectedInterventionsToCopy(new Set(copyCandidates.interventions.map(i => i._tempId)));
                                                }
                                            }}
                                            className="text-[10px] text-indigo-400 font-bold hover:text-white underline"
                                        >
                                            Invertir / Todos
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {copyCandidates.interventions.map((int: any) => (
                                            <label key={int._tempId} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedInterventionsToCopy.has(int._tempId)}
                                                    onChange={() => {
                                                        const newSet = new Set(selectedInterventionsToCopy);
                                                        if (newSet.has(int._tempId)) newSet.delete(int._tempId);
                                                        else newSet.add(int._tempId);
                                                        setSelectedInterventionsToCopy(newSet);
                                                    }}
                                                    className="mt-0.5 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-white leading-tight">{int.category} <span className="text-slate-400">({int.subType})</span></span>
                                                    {int.notes && <span className="text-[10px] text-slate-500 line-clamp-1">{int.notes}</span>}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* BLOQUE EJERCICIOS */}
                            {copyCandidates.exercises.length > 0 && (
                                <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="text-[11px] font-black tracking-widest text-emerald-300 uppercase">Ejercicios Prescritos ({copyCandidates.exercises.length})</h4>
                                        <button
                                            onClick={() => {
                                                if (selectedExercisesToCopy.size === copyCandidates.exercises.length) {
                                                    setSelectedExercisesToCopy(new Set());
                                                } else {
                                                    setSelectedExercisesToCopy(new Set(copyCandidates.exercises.map(i => i._tempId)));
                                                }
                                            }}
                                            className="text-[10px] text-emerald-400 font-bold hover:text-white underline"
                                        >
                                            Invertir / Todos
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        {copyCandidates.exercises.map((ex: any) => (
                                            <label key={ex._tempId} className="flex items-start gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-emerald-500/50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedExercisesToCopy.has(ex._tempId)}
                                                    onChange={() => {
                                                        const newSet = new Set(selectedExercisesToCopy);
                                                        if (newSet.has(ex._tempId)) newSet.delete(ex._tempId);
                                                        else newSet.add(ex._tempId);
                                                        setSelectedExercisesToCopy(newSet);
                                                    }}
                                                    className="mt-0.5 rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 bg-slate-950"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-white leading-tight">{ex.name || 'Sin nombre'}</span>
                                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-medium">
                                                        <span>{ex.sets || '-'} series</span> •
                                                        <span>{ex.repsOrTime || '-'} reps</span> •
                                                        <span>Carga: {ex.loadKg || '-'}kg</span>
                                                    </div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* FOOTER MODAL */}
                        <div className="p-4 border-t border-slate-800 bg-slate-900/80 rounded-b-2xl flex justify-between items-center">
                            <span className="text-xs text-slate-500 font-medium">
                                Seleccionados: {selectedInterventionsToCopy.size} intervs. / {selectedExercisesToCopy.size} ejs.
                            </span>
                            <div className="flex gap-3">
                                <button onClick={() => setShowCopyModal(false)} className="px-5 py-2 rounded-xl text-sm font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition">
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmDuplicate}
                                    disabled={selectedInterventionsToCopy.size === 0 && selectedExercisesToCopy.size === 0}
                                    className="px-6 py-2 rounded-xl text-sm font-black text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-700 transition"
                                >
                                    Importar Seleccionados
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* BOTTOM BAR FIJA (Thumb-friendly Actions con Safe-Area) */}
            <div className="bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] md:pb-4 fixed bottom-0 left-0 right-0 z-40 shadow-[0_-15px_40px_-15px_rgba(0,0,0,0.1)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">

                    {!isClosed && (
                        <>
                            <button
                                type="submit"
                                form="evolution-form" // Triggers onSaveDraft
                                disabled={loading}
                                className={`flex-1 max-w-[200px] py-4 md:py-3 rounded-2xl border-2 font-bold transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50
                                    ${saveStatus === 'saved' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                                        saveStatus === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                                            'border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300'}`}
                            >
                                {saveStatus === 'saving' || loading ? (
                                    <><span className="animate-spin text-slate-400 font-normal">↻</span> <span>Guardando...</span></>
                                ) : saveStatus === 'saved' ? (
                                    <><span className="text-emerald-500 font-black">✓</span> <span>Guardado</span></>
                                ) : saveStatus === 'error' ? (
                                    <><span className="text-rose-500 font-black">✗</span> <span>Error</span></>
                                ) : (
                                    <span>Guardar Borrador</span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleAttemptClose}
                                disabled={loading || !canClose}
                                className="flex-1 py-4 md:py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-xl shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
                            >
                                {canClose ? "Cerrar Evolución" : "Faltan Campos Clínicos"}
                            </button>
                        </>
                    )}

                    {isClosed && (
                        <div className="flex-1 flex justify-between items-center bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                            <p className="text-slate-500 font-bold text-sm tracking-wide py-4 w-full text-center">DOCUMENTO FIRMADO Y SELLADO</p>
                            {user?.role === "DOCENTE" && (
                                <button type="button" onClick={handleReopen} disabled={loading} className="px-6 py-4 bg-orange-100/50 hover:bg-orange-100 text-orange-700 font-black tracking-wide border-l border-slate-200 transition-colors text-xs whitespace-nowrap active:bg-orange-200">
                                    Reabrir <span className="hidden md:inline opacity-60">(Docente)</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </form >
    );
}
