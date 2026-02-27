import React, { useState, useEffect } from "react";
import { Evolucion, ExercisePrescription, Evaluacion, TreatmentObjective } from "@/types/clinica";
import { doc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";
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
    SparklesIcon
} from '@heroicons/react/20/solid';
import { EvaSlider } from "./ui/EvaSlider";
import { NumericStepper } from "./ui/NumericStepper";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// CACHÉ EN MEMORIA (FASE 2.1.9) PARA EVITAR RE-LECTURAS DE OBJETIVOS
const globalEvalCache: Record<string, { objectives: TreatmentObjective[], versionId: string, timestamp: number }> = {};

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
        audit: {}
    };

    // Migración Legacy -> Pro
    const legacyData = data as any;
    const isLegacy = legacyData.estado !== undefined || legacyData.dolorInicio !== undefined;
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
        sessionAt: data.sessionAt || legacyData.fechaHoraAtencion || new Date().toISOString(),
        pain: data.pain || {
            evaStart: legacyData.dolorInicio ?? "",
            evaEnd: legacyData.dolorSalida ?? ""
        },
        sessionGoal: data.sessionGoal || legacyData.objetivoSesion || "",
        interventions: data.interventions || {
            categories: [],
            notes: legacyData.intervenciones || ""
        },
        exercises: data.exercises || [],
        nextPlan: data.nextPlan || legacyData.planProximaSesion || "",
        audit: data.audit || {
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
    initialData: Evolucion | null;
    onClose: () => void;
    onSaveSuccess: (evolucion: Evolucion, isNew: boolean, willClose?: boolean) => void;
}

export function EvolucionForm({ usuariaId, procesoId, initialData, onClose, onSaveSuccess }: EvolucionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Si viene `initialData`, significa que estamos en modo EDIT.
    const isEditMode = !!initialData;
    const isClosed = initialData?.status === "CLOSED" || initialData?.estado === "CERRADA";

    const [loading, setLoading] = useState(false);

    // Estado interno del formulario (Copia Inicial mode Pro)
    const [formData, setFormData] = useState<Partial<Evolucion>>(() => mapLegacyToPro(initialData, usuariaId));

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    // Control para la regla de las 36 Horas
    const [requiresLateReason, setRequiresLateReason] = useState(false);
    const [isAttemptingClose, setIsAttemptingClose] = useState(false);
    const [isLateDraft, setIsLateDraft] = useState(false);

    // UI Layout States
    const [activeSection, setActiveSection] = useState("admin"); // "admin", "soap", "interventions", "results"

    // Dropdown + Texto para justificación
    const [lateCategory, setLateCategory] = useState("");
    const [lateText, setLateText] = useState("");

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

    const handleNestedChange = (parent: "pain" | "interventions" | "outcomesSnapshot", field: string, value: any) => {
        setFormData((prev: any) => ({
            ...prev,
            [parent]: {
                ...(prev[parent] || {}),
                [field]: value
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
        setFormData((prev: any) => ({ ...prev, sessionAt: new Date(val).toISOString() }));
    };

    // --- MANEJO DE OBJETIVOS VIGENTES (FASE 2.1.4) ---
    const [availableObjectives, setAvailableObjectives] = useState<TreatmentObjective[]>([]);
    const [currentVersionId, setCurrentVersionId] = useState<string | undefined>();
    const [loadingObjectives, setLoadingObjectives] = useState(false);

    useEffect(() => {
        // En modo edición de evoluciones cerradas o antiguas que no son de la versión actual,
        // no re-escribiremos sus versionIds asique solo mostramos las elegidas (read-only real),
        // pero por ahora para poder cambiarlos si es borrador, cargamos la última meta.
        if (!procesoId || !globalActiveYear) return;

        const fetchLatestEval = async () => {
            const cacheKey = `${globalActiveYear}_${procesoId}`;
            const timeNow = Date.now();

            // Retornamos desde caché en memoria si existe y tiene menos de 10 minutos de antigüedad (SPA Optimization)
            if (globalEvalCache[cacheKey] && (timeNow - globalEvalCache[cacheKey].timestamp < 600000)) {
                const cached = globalEvalCache[cacheKey];
                const isOldVersion = formData.objectivesWorked?.objectiveSetVersionId
                    && formData.objectivesWorked.objectiveSetVersionId !== cached.versionId;
                if (isOldVersion && isClosed) return;

                setAvailableObjectives(cached.objectives);
                setCurrentVersionId(cached.versionId);
                return;
            }

            setLoadingObjectives(true);
            try {
                const q = query(
                    collection(db, "programs", globalActiveYear, "evaluaciones"),
                    where("procesoId", "==", procesoId),
                    orderBy("sessionAt", "desc"),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const evDoc = querySnapshot.docs[0];
                    const evData = evDoc.data() as Evaluacion;
                    const finalVersion = evData.versionId || evDoc.id;
                    const finalObjectives = evData.objectives?.filter(o => o.status === 'ACTIVE') || [];

                    // Guardamos la consulta costosa de Firebase en el caché local
                    globalEvalCache[cacheKey] = {
                        objectives: finalObjectives,
                        versionId: finalVersion,
                        timestamp: timeNow
                    };

                    // Si ya tenía objetivos guardados (legacy borrador o edit mode) e intentamos cargar
                    const isOldVersion = formData.objectivesWorked?.objectiveSetVersionId
                        && formData.objectivesWorked.objectiveSetVersionId !== finalVersion;

                    if (isOldVersion && isClosed) {
                        return;
                    }

                    setAvailableObjectives(finalObjectives);
                    setCurrentVersionId(finalVersion);
                } else {
                    // MOCK Fallback rápido
                    setAvailableObjectives([
                        { id: "obj-mock-001", description: "Lograr flexión de rodilla a 120° sin dolor", status: "ACTIVE", category: "ROM" },
                        { id: "obj-mock-002", description: "Reducir respuesta inflamatoria aguda (VAS < 3)", status: "ACTIVE", category: "Pain" },
                        { id: "obj-mock-003", description: "Dominio de marcha sin ayudas técnicas", status: "ACTIVE", category: "Function" }
                    ]);
                    setCurrentVersionId("mock-version-eval-001");
                }
            } catch (err) {
                console.error("Error cargando objetivos", err);
            } finally {
                setLoadingObjectives(false);
            }
        };

        fetchLatestEval();
    }, [procesoId, globalActiveYear, formData.objectivesWorked?.objectiveSetVersionId, isClosed]);

    const toggleObjective = (objId: string) => {
        if (isClosed) return;
        const currentIds = formData.objectivesWorked?.objectiveIds || [];
        const isSelected = currentIds.includes(objId);

        const newIds = isSelected
            ? currentIds.filter(id => id !== objId)
            : [...currentIds, objId];

        setFormData(prev => ({
            ...prev,
            objectivesWorked: {
                objectiveIds: newIds,
                objectiveSetVersionId: currentVersionId
            }
        }));
    };

    // --- MANEJO DE EJERCICIOS DINÁMICOS ---
    const addExercise = () => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: [
                ...(prev.exercises || []),
                { id: generateId(), name: "", sets: "", repsOrTime: "", loadKg: "", rpeOrRir: "", notes: "" }
            ]
        }));
    };

    const updateExercise = (id: string, field: keyof ExercisePrescription, value: string) => {
        setFormData((prev: any) => ({
            ...prev,
            exercises: prev.exercises?.map((ex: ExercisePrescription) => ex.id === id ? { ...ex, [field]: value } : ex)
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
                q = query(evolsRef, where("procesoId", "==", procesoId), orderBy("sessionAt", "desc"), limit(2));
            } else {
                q = query(evolsRef, where("usuariaId", "==", usuariaId), orderBy("sessionAt", "desc"), limit(2));
            }
            const querySnapshot = await getDocs(q);
            // La primera podría ser ESTA MISMA si ya guardamos un draft. 
            // Buscamos la primera evolución distinta a la actual que tenga ejercicios.
            let lastEvol: any = null;
            querySnapshot.forEach(doc => {
                if (doc.id !== initialData?.id && !lastEvol) {
                    lastEvol = { id: doc.id, ...doc.data() };
                }
            });

            if (!lastEvol || !lastEvol.exercises || lastEvol.exercises.length === 0) {
                alert("No se encontró una evolución médica previa con ejercicios para duplicar.");
                return;
            }

            // Duplicar creando IDs frescos para la UI, copiando propiedades
            const duplicatedExercises = lastEvol.exercises.map((ex: any) => ({
                ...ex,
                id: generateId()
            }));

            setFormData(prev => ({
                ...prev,
                exercises: [
                    ...(prev.exercises || []),
                    ...duplicatedExercises
                ],
                audit: {
                    ...(prev.audit || {}),
                    copiedFromEvolutionId: lastEvol.id
                }
            }));

            alert(`✅ Se han copiado ${duplicatedExercises.length} ejercicios desde una evolución anterior.`);
        } catch (error) {
            console.error("Error al duplicar ejercicios:", error);
            alert("Hubo un error al intentar acceder a los ejercicios anteriores.");
        }
    };

    // Método universal de Guardado para Borrador o Cierre
    const executeSave = async (willClose: boolean, overrideReason?: string) => {
        if (!globalActiveYear || !user) {
            alert("No hay un Año de Programa activo seleccionado o sesión inválida.");
            return;
        }

        try {
            setLoading(true);
            setSaveStatus('saving');
            const targetId = formData.id || (isEditMode && initialData?.id ? initialData.id : generateId());

            const currentAudit = formData.audit || {};
            const finalAudit = {
                ...currentAudit,
                createdAt: currentAudit.createdAt || new Date().toISOString(),
                createdBy: currentAudit.createdBy || user.uid,
                updatedAt: new Date().toISOString(),
                updatedBy: user.uid,
                closedAt: willClose ? new Date().toISOString() : currentAudit.closedAt,
                closedBy: willClose ? user.uid : currentAudit.closedBy,
                lateReason: overrideReason || currentAudit.lateReason
            };

            const payload: Partial<Evolucion> = {
                id: targetId,
                usuariaId,
                casoId: formData.casoId || null,
                sesionId: formData.sesionId || null,

                status: willClose ? 'CLOSED' : 'DRAFT',
                sessionAt: formData.sessionAt!,
                clinicianResponsible: user.uid,

                pain: formData.pain || { evaStart: "", evaEnd: "" },
                sessionGoal: formData.sessionGoal || "",
                interventions: formData.interventions || { categories: [], notes: "" },
                exercises: formData.exercises || [],
                nextPlan: formData.nextPlan || "",
                educationNotes: formData.educationNotes || "",
                objectivesWorked: formData.objectivesWorked,
                outcomesSnapshot: formData.outcomesSnapshot,

                audit: finalAudit,
                notesLegacy: formData.notesLegacy
            };

            const docRef = doc(db, "programs", globalActiveYear, "evoluciones", targetId);

            await setDocCounted(docRef, payload, { merge: true });

            setFormData(prev => ({ ...prev, id: targetId }));
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 3000);

            onSaveSuccess(payload as Evolucion, (!isEditMode && !formData.id), willClose);

        } catch (error) {
            console.error("Error al guardar Evolución", error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus('idle'), 5000);
            alert("Ha ocurrido un error al conectar con la base de datos.");
        } finally {
            setLoading(false);
            setIsAttemptingClose(false);
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

        // Validación 2: Regla Estricta 36 Horas
        const hoursPassed = getDifferenceInHours(formData.sessionAt!, new Date().toISOString());

        if (hoursPassed > 36) {
            setRequiresLateReason(true);
            setIsAttemptingClose(true);
            return; // Cortamos flujo si falta el motivo
        }

        executeSave(true);
    };

    // Cuando superó 36hrs y ahora escribe la justificación para confirmar el cierre final
    const confirmLateClose = (e: React.FormEvent) => {
        e.preventDefault();
        if (!lateCategory) {
            alert("Debe seleccionar una Categoría de Motivo para el cierre tardío.");
            return;
        }
        if (lateText.trim().length < 5) {
            alert("Debe agregar un detalle específico del motivo (mínimo 5 caracteres).");
            return;
        }
        const finalReason = `[${lateCategory}] ${lateText}`;
        executeSave(true, finalReason);
    };

    // --- RENDER HELPERS PARA ACORDEÓN ---
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

    const scrollToSection = (id: string) => {
        setActiveSection(id);
        const container = document.getElementById('evo-scroll-container');
        const element = document.getElementById(id);
        if (element && container) {
            // Offset del top de element comparado con el top del scroll container
            const topPos = element.offsetTop;
            container.scrollTo({ top: topPos - 16, behavior: 'smooth' });
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
            ['sec-esencial', 'interv', 'sec-ejerc', 'sec-result'].forEach(id => {
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
        // Faltantes de cierre
        const hasValidStart = formData.pain?.evaStart !== undefined && formData.pain?.evaStart !== "";
        const hasValidEnd = formData.pain?.evaEnd !== undefined && formData.pain?.evaEnd !== "";

        if (!hasValidStart) missingFields.push("EVA Inicio");
        if (!hasValidEnd) missingFields.push("EVA Salida");
        if (!formData.sessionGoal?.trim()) missingFields.push("Objetivo de Sesión");
        if (!formData.nextPlan?.trim()) missingFields.push("Plan Próximo");

        const hasEmptyNames = formData.exercises?.some((ex: any) => !ex.name.trim());
        if (hasEmptyNames) missingFields.push("Nombre en Fila de Ejercicio");

        const hasIntervenciones = (formData.interventions?.notes?.trim().length || 0) > 0;
        const hasEjercicios = formData.exercises && formData.exercises.length > 0;
        if (!hasIntervenciones && !hasEjercicios) {
            missingFields.push("Intervenciones Manuales o al menos 1 Ejercicio");
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
                const posWords = ["mejor", "alivio", "disminuy", "baj", "positivo", "excelent", "exito", "buen", "favorable", "progreso"];
                if (posWords.some(w => txt.includes(w))) {
                    missingFields.push("Aclaración de Contradicción Clínica (Dolor aumentó pero texto sugiere mejora)");
                    assistantCards.push({
                        id: 'contradiction',
                        type: 'error',
                        title: 'Contradicción Clínica Detectada',
                        message: `El EVA reporta un aumento de dolor (${evaIn} a ${evaOut}), pero el texto sugiere mejoría. Corrija los EVAs o elimine las palabras ambiguas del texto para liberar la firma.`,
                        icon: <ExclamationCircleIcon className="w-5 h-5 text-rose-500" />,
                        style: "bg-rose-50 border-rose-200 text-rose-800"
                    });
                }
            }
        }

        // Objetivos No Marcados
        if (availableObjectives.length > 0 && (!formData.objectivesWorked?.objectiveIds || formData.objectivesWorked.objectiveIds.length === 0)) {
            assistantCards.push({
                id: 'objectives_missing',
                type: 'info',
                title: 'Objetivos Transversales Aislados',
                message: "Existen objetivos de tratamiento planificados. Sugerimos vincular los abordados hoy.",
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

    return (
        <div className="fixed inset-0 z-50 bg-slate-50 md:relative md:z-auto md:bg-transparent flex flex-col h-[100dvh] md:h-auto overflow-hidden">

            {/* TOP BAR FIJA (Mobile First) */}
            <div className="bg-white border-b border-slate-200 shadow-sm z-40 sticky top-0 shrink-0">
                <div className="flex items-center justify-between p-4 md:px-6">
                    <div className="flex items-center gap-3">
                        {/* Botón Volver solo en versión Móvil Total */}
                        <button onClick={onClose} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                            <ChevronLeftIcon className="w-6 h-6" />
                        </button>

                        <div>
                            <h2 className="text-sm font-bold text-slate-800 truncate max-w-[200px] md:max-w-xs">
                                {isEditMode ? "Evolución Clínica" : "Nueva Evolución"}
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

                    {/* Botón Volver Desktop */}
                    <button onClick={onClose} className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                        Descartar / Volver
                    </button>
                </div>

                {/* SCROLL SPY CHIPS - Navegación Rápida */}
                <div className="px-4 md:px-6 pb-3 pt-1 overflow-x-auto hide-scrollbar flex gap-2 snap-x">
                    {[
                        { id: 'sec-esencial', label: 'Esencial' },
                        { id: 'sec-interv', label: 'Intervenciones' },
                        { id: 'sec-ejerc', label: 'Ejercicios' },
                        { id: 'sec-result', label: 'Cierre y Resultados' }
                    ].map(chip => (
                        <button
                            key={chip.id}
                            id={`chip-${chip.id}`}
                            type="button"
                            onClick={() => scrollToSection(chip.id)}
                            className={`snap-start whitespace-nowrap px-4 py-1.5 rounded-full text-[11px] font-black tracking-wide transition-all border ${activeSection === chip.id
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-md transform scale-105'
                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                }`}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL SCROLLEABLE */}
            <div id="evo-scroll-container" className="flex-1 overflow-y-auto w-full mx-auto relative px-4 md:px-6 pb-40 scroll-smooth">
                <div className="max-w-4xl mx-auto mt-2">
                    <form onSubmit={handleSaveDraft} id="evolution-form" className="space-y-4">

                        {/* GRUPO ESENCIAL DEL PACIENTE (Scroll Spy agrupa estos acórdeones) */}
                        <div id="sec-esencial" className="space-y-4 scroll-mt-6">
                            {/* 1. SECCIÓN ADMINISTRATIVA */}
                            <AccordionSection
                                id="sec-admin"
                                title="Datos Administrativos de Sesión"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                                defaultOpen={true}
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

                            {/* 2. SECCIÓN S.O.A.P. */}
                            <AccordionSection
                                id="sec-soap"
                                title="Evaluación y Planificación (S.O.A.P)"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                                theme="emerald"
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-2">
                                    <div className="col-span-1 md:col-span-12">
                                        <EvaSlider
                                            label="Dolor Inicio (EVA)"
                                            value={formData.pain?.evaStart !== "" && formData.pain?.evaStart !== undefined ? Number(formData.pain.evaStart) : undefined}
                                            onChange={(val) => handleNestedChange("pain", "evaStart", val !== undefined ? String(val) : "")}
                                            disabled={isClosed}
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-12">
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Objetivo de la Sesión <span className="text-emerald-600">*</span></label>
                                        <textarea
                                            name="sessionGoal"
                                            value={formData.sessionGoal}
                                            onChange={handleChange}
                                            disabled={isClosed}
                                            rows={1}
                                            placeholder="Ej: Disminuir dolor peripatelar y reactivar cuádriceps..."
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none disabled:bg-slate-100 transition-all font-medium text-slate-700 shadow-inner"
                                        />
                                    </div>

                                    {/* OBJETIVOS VIGENTES DE LA EVALUACIÓN (CHIPS) */}
                                    {availableObjectives.length > 0 && (
                                        <div className="md:col-span-12 mt-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                            <h4 className="flex items-center gap-2 text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-3">
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                Objetivos Clínicos Vigentes
                                                {loadingObjectives && <span className="text-xs text-emerald-500 lowercase ml-2 font-normal animate-pulse">(Cargando...)</span>}
                                            </h4>

                                            <div className="flex flex-wrap gap-2">
                                                {availableObjectives.map(obj => {
                                                    const isSelected = formData.objectivesWorked?.objectiveIds?.includes(obj.id);
                                                    return (
                                                        <button
                                                            key={obj.id}
                                                            type="button"
                                                            disabled={isClosed}
                                                            onClick={() => toggleObjective(obj.id)}
                                                            className={`
                                                        px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border
                                                        ${isSelected
                                                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                                                                    : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                }
                                                        ${isClosed && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}
                                                    `}
                                                        >
                                                            {isSelected && <span className="mr-1.5">✓</span>}
                                                            {obj.description}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-[10px] text-emerald-600/70 mt-3 font-semibold text-right">
                                                Última v. Evaluación activa
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </AccordionSection>
                        </div> {/* Fin Envoltura Esencial */}

                        {/* 3. SECCIÓN INTERVENCIONES PASIVAS */}
                        <div id="sec-interv" className="scroll-mt-6">
                            <AccordionSection
                                id="interv-pass"
                                title="Intervenciones y Agentes Físicos"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>}
                                theme="amber"
                            >
                                <div className="mt-2">
                                    <textarea
                                        name="interventions.notes"
                                        value={formData.interventions?.notes || ""}
                                        onChange={(e) => handleNestedChange("interventions", "notes", e.target.value)}
                                        disabled={isClosed}
                                        placeholder="Terapias manuales, MEP, Punción Seca, Criomedicina, TENS, Ondas de Choque..."
                                        className="w-full border border-slate-300 rounded-xl px-4 py-4 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:bg-slate-100 transition-all font-medium text-slate-700 shadow-inner min-h-[120px]"
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
                                                <p className="text-xs text-indigo-200/80 font-medium mt-1">Estructura para Machine Learning y Progreso Físico.</p>
                                            </div>
                                        </div>
                                        <span className="inline-flex max-w-max items-center bg-indigo-800 text-indigo-100 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider border border-indigo-600/50 shadow-inner">
                                            Módulo Analítico Principal
                                        </span>
                                    </div>

                                    <label className="block text-[11px] font-bold text-indigo-300 mb-2 uppercase tracking-wide ml-1">Planilla Dinámica de Ejercicios</label>

                                    {formData.exercises?.map((ex, index) => (
                                        <div key={ex.id} className="bg-slate-900/50 border border-indigo-700/50 rounded-2xl p-4 mb-3 relative group transition-all hover:border-indigo-500/80">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest bg-indigo-950/50 px-2 py-1 rounded shadow-inner border border-indigo-800/50">Ejercicio {index + 1}</span>
                                                    {!isClosed && (
                                                        <div className="flex bg-slate-900/50 rounded-lg border border-indigo-900/50 overflow-hidden">
                                                            <button type="button" onClick={() => moveExercise(index, 'up')} disabled={index === 0} className="p-1 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                                                                <ChevronUpIcon className="w-4 h-4" />
                                                            </button>
                                                            <button type="button" onClick={() => moveExercise(index, 'down')} disabled={index === (formData.exercises?.length || 0) - 1} className="p-1 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors border-l border-indigo-900/50">
                                                                <ChevronDownIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {!isClosed && (
                                                    <button type="button" onClick={() => removeExercise(ex.id)} className="text-rose-400/70 hover:text-rose-400 bg-rose-950/30 hover:bg-rose-950/80 p-1.5 rounded-lg transition-colors border border-transparent hover:border-rose-900">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-3">
                                                <div className="col-span-1 md:col-span-12">
                                                    <input type="text" placeholder="Ej: Sentadilla Búlgara" disabled={isClosed} value={ex.name} onChange={e => updateExercise(ex.id, "name", e.target.value)} className="w-full bg-slate-950/50 border border-indigo-800/50 rounded-xl px-3 py-2.5 text-sm font-bold text-indigo-50 outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/40" />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <NumericStepper label="Series" placeholder="Sets" disabled={isClosed} value={ex.sets} onChange={val => updateExercise(ex.id, "sets", val)} />
                                                </div>
                                                <div className="col-span-1 md:col-span-3">
                                                    <NumericStepper label="Repeticiones / Tiempo" placeholder="Reps / Tiempo" disabled={isClosed} value={ex.repsOrTime} onChange={val => updateExercise(ex.id, "repsOrTime", val)} />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <NumericStepper label="Carga (Kg)" placeholder="Carga" step={2.5} disabled={isClosed} value={ex.loadKg || ""} onChange={val => updateExercise(ex.id, "loadKg", val)} />
                                                </div>
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="block text-[9px] font-bold text-indigo-400 mb-1.5 ml-1 uppercase tracking-wider">Percepción (RIR/RPE)</label>
                                                    <input type="text" placeholder="RIR/RPE" disabled={isClosed} value={ex.rpeOrRir || ""} onChange={e => updateExercise(ex.id, "rpeOrRir", e.target.value)} className="w-full bg-slate-950/50 border border-indigo-800/50 rounded-xl px-3 text-sm font-bold text-indigo-50 outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/40 text-center h-11" />
                                                </div>
                                                <div className="col-span-1 md:col-span-3">
                                                    <NumericStepper label="Descanso (Seg/Min)" placeholder="Rest" disabled={isClosed} value={ex.rest || ""} onChange={val => updateExercise(ex.id, "rest", val)} />
                                                </div>

                                                <div className="col-span-1 md:col-span-6">
                                                    <input type="text" placeholder="Criterio de Progresión (Ej: Subir carga si RIR > 2)" disabled={isClosed} value={ex.progressionCriteria || ""} onChange={e => updateExercise(ex.id, "progressionCriteria", e.target.value)} className="w-full bg-slate-950/50 border border-indigo-800/50 rounded-xl px-3 py-2 text-sm text-indigo-50 outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/40" />
                                                </div>
                                                <div className="col-span-1 md:col-span-6">
                                                    <input type="text" placeholder="Notas / Frecuencia / Ajustes biomecánicos" disabled={isClosed} value={ex.notes || ""} onChange={e => updateExercise(ex.id, "notes", e.target.value)} className="w-full bg-slate-950/50 border border-indigo-800/50 rounded-xl px-3 py-2 text-sm text-indigo-50 outline-none focus:border-indigo-400 focus:bg-slate-900 transition-all placeholder:text-indigo-400/40" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {!isClosed && (
                                        <div className="flex flex-col md:flex-row gap-3 mt-4">
                                            <button type="button" onClick={addExercise} className="flex-1 border-2 border-dashed border-indigo-700/50 hover:border-indigo-500 hover:bg-indigo-900/30 text-indigo-300 font-bold py-3.5 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm">
                                                <PlusIcon className="w-5 h-5" />
                                                Agregar Fila de Ejercicio
                                            </button>
                                            <button type="button" onClick={duplicatePreviousExercises} className="md:w-auto w-full border border-indigo-600 bg-indigo-800/40 hover:bg-indigo-700/60 text-indigo-100 font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm backdrop-blur-sm group">
                                                <DocumentDuplicateIcon className="w-5 h-5 text-indigo-300 group-hover:text-white transition-colors" />
                                                Duplicar Evolución Anterior
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 5. SECCIÓN RESULTADOS */}
                        <div id="sec-result" className="scroll-mt-6">
                            <AccordionSection
                                id="result-panel"
                                title="Resultados y Pronóstico"
                                icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                                theme="rose"
                                defaultOpen={true}
                            >
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-2">
                                    <div className="col-span-1 md:col-span-12">
                                        <EvaSlider
                                            label="Dolor Salida (EVA)"
                                            value={formData.pain?.evaEnd !== "" && formData.pain?.evaEnd !== undefined ? Number(formData.pain.evaEnd) : undefined}
                                            onChange={(val) => handleNestedChange("pain", "evaEnd", val !== undefined ? String(val) : "")}
                                            disabled={isClosed}
                                            isEnd={true}
                                            onSameAsStart={() => {
                                                if (formData.pain?.evaStart !== undefined && formData.pain?.evaStart !== "") {
                                                    handleNestedChange("pain", "evaEnd", formData.pain.evaStart);
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-12">
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Hito Logrado y Plan Próxima Sesión <span className="text-rose-600">*</span></label>
                                        <textarea
                                            name="nextPlan"
                                            value={formData.nextPlan}
                                            onChange={handleChange}
                                            disabled={isClosed}
                                            rows={2}
                                            placeholder="Ej: Bajó dolor general. Próxima: Iniciar cargas excéntricas..."
                                            className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 resize-none disabled:bg-slate-100 transition-all font-medium text-slate-700 shadow-inner"
                                        />
                                    </div>

                                    {/* OUTCOMES RÁPIDOS (FASE 2.1.5) */}
                                    <div className="md:col-span-12 mt-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                                        <div>
                                            <div className="flex justify-between items-end mb-3">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                                    GROC <span className="text-[9px] text-slate-400 font-medium normal-case ml-1">(Cambio Global)</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {formData.outcomesSnapshot?.groc !== undefined && !isClosed && (
                                                        <button type="button" onClick={() => handleNestedChange("outcomesSnapshot", "groc", undefined)} className="text-[10px] text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5 rounded-full hover:bg-rose-100 transition-colors">Borrar ✕</button>
                                                    )}
                                                    <span className={`text-sm font-black px-2.5 py-0.5 rounded-full border ${formData.outcomesSnapshot?.groc !== undefined ? 'text-rose-600 bg-rose-100 border-rose-200' : 'text-slate-400 bg-slate-200 border-slate-300'}`}>
                                                        {formData.outcomesSnapshot?.groc !== undefined && formData.outcomesSnapshot?.groc !== "" && !isNaN(Number(formData.outcomesSnapshot.groc))
                                                            ? (Number(formData.outcomesSnapshot.groc) > 0 ? `+${formData.outcomesSnapshot.groc}` : formData.outcomesSnapshot.groc)
                                                            : "N/A"}
                                                    </span>
                                                </div>
                                            </div>
                                            {formData.outcomesSnapshot?.groc !== undefined ? (
                                                <>
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
                                                </>
                                            ) : (
                                                <button type="button" disabled={isClosed} onClick={() => handleNestedChange("outcomesSnapshot", "groc", 0)} className="w-full py-2 bg-white border-2 border-dashed border-slate-300 text-slate-500 font-bold text-xs rounded-xl hover:border-rose-300 hover:text-rose-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                    + Registrar GROC
                                                </button>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-end mb-3">
                                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                                                    SANE <span className="text-[9px] text-slate-400 font-medium normal-case ml-1">(Evaluación Numérica)</span>
                                                </label>
                                                <div className="flex items-center gap-2">
                                                    {formData.outcomesSnapshot?.sane !== undefined && !isClosed && (
                                                        <button type="button" onClick={() => handleNestedChange("outcomesSnapshot", "sane", undefined)} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold px-2 py-0.5 rounded-full hover:bg-blue-100 transition-colors">Borrar ✕</button>
                                                    )}
                                                    <span className={`text-sm font-black px-2.5 py-0.5 rounded-full border ${formData.outcomesSnapshot?.sane !== undefined ? 'text-blue-600 bg-blue-100 border-blue-200' : 'text-slate-400 bg-slate-200 border-slate-300'}`}>
                                                        {formData.outcomesSnapshot?.sane !== undefined && formData.outcomesSnapshot?.sane !== "" && !isNaN(Number(formData.outcomesSnapshot.sane))
                                                            ? `${formData.outcomesSnapshot.sane}%`
                                                            : "N/A"}
                                                    </span>
                                                </div>
                                            </div>
                                            {formData.outcomesSnapshot?.sane !== undefined ? (
                                                <>
                                                    <input
                                                        type="range"
                                                        min="0" max="100" step="5"
                                                        disabled={isClosed}
                                                        value={formData.outcomesSnapshot?.sane || 0}
                                                        onChange={(e) => handleNestedChange("outcomesSnapshot", "sane", Number(e.target.value))}
                                                        className="w-full accent-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                                    />
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 px-1">
                                                        <span>0% (Pésimo)</span>
                                                        <span>50%</span>
                                                        <span>100% (Normal)</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <button type="button" disabled={isClosed} onClick={() => handleNestedChange("outcomesSnapshot", "sane", 0)} className="w-full py-2 bg-white border-2 border-dashed border-slate-300 text-slate-500 font-bold text-xs rounded-xl hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                                    + Registrar SANE
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </AccordionSection>
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
                                            <div>
                                                <h4 className="text-[11px] font-black uppercase tracking-wider mb-1">{card.title}</h4>
                                                <p className="text-xs font-medium leading-relaxed opacity-90">{card.message}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </form>
                </div>

                {/* MODAL / PANTALLA TRAMPA DE CIERRE TARDÍO (Al intentar cerrar >36h) */}
                {isAttemptingClose && requiresLateReason && (
                    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6 pb-24 md:pb-6">
                        <div className="bg-white w-full max-w-lg rounded-t-3xl md:rounded-3xl p-6 md:p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-amber-100 text-amber-600 p-3 rounded-2xl">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                </div>
                                <div>
                                    <h4 className="font-black text-xl text-slate-800">Cierre Extemporáneo</h4>
                                    <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Protocolo de Auditoría Requerido</p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed">
                                Ha expirado la regla hospitalaria de <b>36 horas</b> desde la fecha médica indicada de la sesión.
                                Para cerrar esta ficha de forma permanente e inmutable, firme y declare el motivo del atraso.
                            </p>

                            <div className="space-y-4 mb-8">
                                <select
                                    value={lateCategory}
                                    onChange={(e) => setLateCategory(e.target.value)}
                                    className="w-full p-4 text-sm font-semibold border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 text-slate-800 outline-none transition-all"
                                >
                                    <option value="" disabled>Seleccione Causal Directa...</option>
                                    <option value="Corte de Energía/Internet">Fallo de Infraestructura (Luz/Internet)</option>
                                    <option value="Traspaso desde Papel">Retraso por Traspaso desde Ficha de Papel</option>
                                    <option value="Emergencia Clínica">Extensión por Emergencia Médica en Box</option>
                                    <option value="Error de Sistema">Fallo temporal de la Plataforma KinePoli</option>
                                    <option value="Olvido/Omisión Administrativa">Reconocimiento Culpable: Olvido Administrativo</option>
                                    <option value="Otro">Otro motivo inusual (Detallar debajo)</option>
                                </select>

                                <textarea
                                    value={lateText}
                                    onChange={(e) => setLateText(e.target.value)}
                                    placeholder="Justificación extendida obligatoria (Min. 5 letras)..."
                                    className="w-full p-4 text-sm font-medium border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-amber-500/20 focus:border-amber-500 bg-slate-50 text-slate-800 outline-none transition-all resize-none min-h-[120px]"
                                />
                            </div>

                            <div className="flex flex-col-reverse md:flex-row gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAttemptingClose(false)}
                                    className="w-full py-4 text-sm font-bold text-slate-500 bg-white hover:bg-slate-50 rounded-2xl border-2 border-slate-200 transition-colors"
                                >
                                    Cancelar (Dejar Abierto)
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmLateClose}
                                    className="w-full py-4 text-sm font-black text-white bg-amber-600 hover:bg-amber-700 rounded-2xl shadow-lg shadow-amber-600/30 transition-all active:scale-[0.98]"
                                >
                                    Firmar y Cerrar Evolución
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

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

        </div>
    );
}
