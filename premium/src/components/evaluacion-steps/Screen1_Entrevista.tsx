import React, { useState, useEffect, useCallback } from 'react';
import { EvaluacionInicial, AnamnesisProximaV4, FocoV4 } from '@/types/clinica';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { useYear } from "@/context/YearContext";


export interface Screen1Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
}

const REGIONES = ['Hombro', 'Codo', 'Muñeca/Mano', 'Col. Cervical', 'Col. Dorsal', 'Col. Lumbar', 'Pelvis/Sacro', 'Cadera', 'Rodilla', 'Tobillo/Pie', 'Otro'];
const LADOS = ['Izquierdo', 'Derecho', 'Bilateral', 'N/A'];

const MECANISMOS_CATEGORIAS = ["NoDefinido", "Nociceptivo", "Neuropático", "Nociplástico", "Mixto"];
const MECANISMOS_SUBTIPOS: Record<string, string[]> = {
    "Nociceptivo": ["inflamatorio", "mecánico", "miofascial"],
    "Neuropático": ["radicular", "nervio periférico", "túnel-atrapamiento"],
    "Nociplástico": ["sensibilización central probable"],
    "Mixto": ["nociceptivo + neuropático", "nociceptivo + nociplástico", "neuropático + nociplástico"],
    "NoDefinido": []
};

export const TAGS_SINTOMAS = [
    'Dolor punzante', 'Dolor opresivo', 'Quemazón', 'Corriente', 'Hormigueo', 'Adormecimiento', 'Pesadez', 'Rigidez', 'Tirantez', 'Pulsátil', 'Profundo',
    'Inestabilidad', 'Bloqueo', 'Chasquido', 'Debilidad', 'Fallo',
    'Inflamación', 'Edema', 'Hematoma', 'Eritema', 'Calor'
];

// Generador de ID temporal seguro
const generateId = () => Math.random().toString(36).substring(2, 9);

// Custom hook para debounce
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);
    useEffect(() => {
        const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
        return () => { clearTimeout(handler); };
    }, [value, delay]);
    return debouncedValue;
}

export function Screen1_Entrevista({ formData, updateFormData, isClosed }: Screen1Props) {
    const { globalActiveYear } = useYear();
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const [isProcessingAI, setIsProcessingAI] = useState(false);
    const [isProcessingPreguntasIA, setIsProcessingPreguntasIA] = useState(false);
    const [isProcessingExamenIA, setIsProcessingExamenIA] = useState(false);
    const [showFocoGuide, setShowFocoGuide] = useState(false);
    const [focoGuideTab, setFocoGuideTab] = useState(0);
    const [showRelatoGuide, setShowRelatoGuide] = useState(false);

    // FASE 8 & 9: Highlight State (Multiple Highlight support)
    const [highlightTexts, setHighlightTexts] = useState<string[]>([]);

    const hasRedFlags = Boolean(
        formData.interview?.v4?.seguridad?.fiebre_sistemico_cancerPrevio ||
        formData.interview?.v4?.seguridad?.bajaPeso_noIntencionada ||
        formData.interview?.v4?.seguridad?.dolorNocturno_inexplicable_noMecanico ||
        formData.interview?.v4?.seguridad?.trauma_altaEnergia_caidaImportante ||
        formData.interview?.v4?.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar || false
    );

    const FACTORES_BPS_LIST = [
        "sueno", "estres", "miedoMoverCargar", "preocupacionDano",
        "confianzaBaja", "frustracion"
    ] as const;

    // 1. Inicialización V4 segura (Crear si no existe)
    const interviewV4: AnamnesisProximaV4 = formData.interview?.v4 || {
        version: "v4",
        status: "draft",
        updatedAt: new Date().toISOString(),
        escalaDolorGlobal: "EVA",
        focos: [{
            id: generateId(),
            esPrincipal: true,
            region: "",
            lado: "N/A",
            inicio: "NoDefinido",
            antiguedad: "",
            evolucion: "NoDefinido",
            episodiosPrevios: "NoDefinido",
            contextoDetallado: "",
            subito: { contacto: null, cinematica: [], sonidoSensacion: [], capacidadInmediata: "", hinchazonRapida: null },
            gradual: { volumen: 3, intensidad: 3, frecuencia: 3, recuperacion: null, cambiosEspecificos: [], aparicionSintoma: "", picoCargaSugerido: "" },
            dolorActual: null,
            mejor24h: null,
            peor24h: null,
            dolorActividadIndice: null,
            actividadIndice: "",
            extension: "NoDefinido",
            profundidad: "NoDefinido",
            naturaleza: [],
            patronTemporal: { frecuencia: "", rigidezMatinalMinutos: null, despiertaNoche: null },
            irradiacion: "NoDefinido",
            tags: [],
            agravantes: "",
            aliviantes: "",
            dolorPostActividad: "NoDefinida",
            tiempoCalma: "",
            signoComparable: "",
            dolorEnSigno: null,
            sintomasMecanicos: [],
            sintomasSistemicos: [],
            sintomasNeurologicos: { activados: [], zona: "", asociacion: [] },
            disparadoresParaDescartes: [],
            mecanismoCategoria: "NoDefinido",
            mecanismoApellido: "",
            mecanismoTextoFinal: "",
            mecanismoConfirmacion: "NoDefinido",
            notaRapida: ""
        }],
        hayLimitacionFuncional: true,
        psfsGlobal: [
            { id: uuidv4(), actividad: "", score: null, focoAsociado: "General" }
        ],
        capacidadPercibidaActividad: null,
        contextosAnclas: [],
        objetivoPersona: "",
        plazoEsperado: "",
        participacionAfectada: [],
        impactoGlobal: "NoDefinido",
        resumenLimitaciones: "",
        resumenRestricciones: "",
        seguridad: {
            fiebre_sistemico_cancerPrevio: false,
            bajaPeso_noIntencionada: false,
            dolorNocturno_inexplicable_noMecanico: false,
            trauma_altaEnergia_caidaImportante: false,
            neuroGraveProgresivo_esfinteres_sillaMontar: false,
            sospechaFractura_incapacidadCarga: false,
            riesgoEmocionalAgudo: false,
            detalleBanderas: "",
            overrideUrgenciaMedica: false,
            justificacionUrgencia: ""
        },
        bps: {
            sueno: 0, estres: 0, miedoMoverCargar: 0, preocupacionDano: 0,
            confianzaBaja: 0, frustracion: 0, otros: ""
        },
        contextoDeportivo: {
            aplica: false, deportePrincipal: "", nivel: "NoDefinido", frecuenciaSemanal: null,
            volumenRecienteCambio: "NoDefinido", eventoProximo: "", gestoProvocador: "", objetivoRetorno: ""
        },
        experienciaPersona: {
            relatoLibre: "",
            quejas: [],
            quejaOtro: "",
            prioridadPrincipal: "",
            objetivos: [{
                id: generateId(),
                contexto: [],
                verbo: "",
                actividad: "",
                plazoSemanas: "",
                enSusPalabras: "",
                esPrincipal: true
            }],
            causaPercibida: undefined, causaPercibidaOtro: "", autoeficaciaRecuperacion: undefined,
            estrategiasPrevias: [],
            expectativa: ""
        },
        contextoLaboral: {
            trabajoDificultaRecuperacion: null,
            temorEmpeorarTrabajo: null,
            barrerasReales: null,
            barrerasDetalles: []
        },
        automatizacionP2: []
    } as unknown as AnamnesisProximaV4;

    // 2. Persistencia inicial: Si no venía de formData (es nueva carga de fallback), inyectarlo en Background
    useEffect(() => {
        if (!formData.interview?.v4) {
            updateFormData({
                interview: {
                    ...formData.interview,
                    v4: interviewV4
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Helper update local/remoto integrado
    const updateV4 = (patch: Partial<AnamnesisProximaV4>) => {
        updateFormData(prev => ({
            interview: {
                ...prev.interview,
                v4: { ...(prev.interview?.v4 as AnamnesisProximaV4 || interviewV4), ...patch, updatedAt: new Date().toISOString() }
            }
        }));
    };

    // 3. AUTO-SAVE DEBOUNCED ROBUSTO EN BACKGROUND
    const debouncedV4 = useDebounce(interviewV4, 2000); // 2 segundos de inactividad
    const [initialRenderComplete, setInitialRenderComplete] = useState(false);
    const [isExpertMode, setIsExpertMode] = useState(false);

    // ELIMINADO: TIMER STICKY HEADER (MP1) - Usando Timer Global Superior

    // 5. ESTADO DE ACORDEONES (Mini Fase 03)
    // Secciones 1 a 5 abiertas por defecto, 6 a 15 cerradas.
    const [activeAccordions, setActiveAccordions] = useState<Record<number, boolean>>({
        1: true, 2: true, 3: true, 4: true, 5: true,
        6: false, 7: false, 8: false, 9: false, 10: false, 11: false, 12: false, 13: false, 14: false, 15: false
    });

    const toggleAccordion = (id: number) => {
        setActiveAccordions(prev => ({ ...prev, [id]: !prev[id] }));
    };

    useEffect(() => {
        setInitialRenderComplete(true);
    }, []);

    const autoSaveDraftToFirebase = useCallback(async (v4Data: AnamnesisProximaV4) => {
        if (!formData.id || !globalActiveYear || isClosed) return;
        setIsSavingDraft(true);
        try {
            const docRef = doc(db, "programs", globalActiveYear, "evaluaciones", formData.id);
            await setDoc(docRef, {
                interview: {
                    ...formData.interview,
                    v4: v4Data
                },
                audit: {
                    ...formData.audit,
                    lastEditedAt: new Date().toISOString()
                }
            }, { merge: true });

            setLastSaved(new Date().toLocaleTimeString());
        } catch (err) {
            console.error("Error auto-saving draft:", err);
        } finally {
            setIsSavingDraft(false);
        }
    }, [formData.id, formData.interview, formData.audit, globalActiveYear, isClosed]);

    useEffect(() => {
        // Evitamos disparar save en mount.
        if (initialRenderComplete && !isClosed) {
            autoSaveDraftToFirebase(debouncedV4);
        }
    }, [debouncedV4, initialRenderComplete, isClosed, autoSaveDraftToFirebase]);

    const focoPrincipal = interviewV4.focos.find(f => f.esPrincipal) || interviewV4.focos[0];

    const [expandedFociIds, setExpandedFociIds] = useState<string[]>([]);

    const updateFocoDetail = (id: string, patch: Partial<FocoV4>) => {
        const nf = interviewV4.focos.map(f => f.id === id ? { ...f, ...patch } : f);
        updateV4({ focos: nf });
    };

    const toggleFocoExpand = (id: string) => {
        setExpandedFociIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // Estados Locales para Captura Conversacional Rápida
    const [painInput, setPainInput] = useState<string>("");
    const [tagInput, setTagInput] = useState<string>("");
    const [tagsList, setTagsList] = useState<string[]>([]);
    const [contextInput, setContextInput] = useState<string>("");

    const handleQuickAdd = () => {
        if (!focoPrincipal) return;

        const updates: any = {};
        let modified = false;

        // 1. Dolor
        if (painInput.trim() !== "") {
            updates.dolorActual = Number(painInput);
            modified = true;
        }

        // 2. Tags
        if (tagsList.length > 0 || tagInput.trim() !== "") {
            const finalTagsToAdd = [...tagsList];
            if (tagInput.trim() !== "") finalTagsToAdd.push(tagInput.trim());

            const existingTags = new Set(focoPrincipal.tags);
            finalTagsToAdd.forEach(t => existingTags.add(t));
            updates.tags = Array.from(existingTags);
            modified = true;
        }

        // 3. Nota / Contexto
        if (contextInput.trim() !== "") {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newLine = `[${timeStr}] ${contextInput.trim()}`;
            updates.notaRapida = focoPrincipal.notaRapida ? `${focoPrincipal.notaRapida}\n${newLine}` : newLine;
            modified = true;
        }

        if (modified) {
            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, ...updates } : f);
            updateV4({ focos: newFocos });
        }

        // Limpieza de inputs (salvo el dolor que se puede quedar pegado para referencia, pero el prompt dice "Limpia A3 y A4, A2 puede quedarse")
        setTagsList([]);
        setTagInput("");
        setContextInput("");
    };

    const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && tagInput.trim() !== "") {
            e.preventDefault();
            setTagsList([...tagsList, tagInput.trim()]);
            setTagInput("");
        }
    };

    const handleUpdateFocoPrincipal = (patch: any) => {
        if (!focoPrincipal) return;
        const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, ...patch } : f);
        updateV4({ focos: newFocos });
    };

    const calcularMecanismoSugerido = (foco: FocoV4 | undefined, bps: AnamnesisProximaV4["bps"]) => {
        if (!foco) return null;

        let isNeuro = false;
        let isNociplastico = false;
        let isMixto = false;

        const nat = foco.naturaleza || [];
        const ext = foco.extension || "";
        const tags = foco.tags || [];

        // Neuro
        if (nat.includes("Quemazón/Ardor") || nat.includes("Eléctrico/Corriente") || tags.includes("Hormigueo") || tags.includes("Adormecimiento")) {
            if (ext === "Línea que baja/sube" || ext === "Se expande" || ext === "Cambia de lugar") {
                isNeuro = true;
            }
        }

        // Nociplastico
        let bpsHigh = false;
        if (bps.estres >= 2 || bps.miedoMoverCargar >= 2 || bps.frustracion >= 2 || bps.confianzaBaja >= 2 || bps.preocupacionDano >= 2) {
            bpsHigh = true;
        }
        if (bpsHigh && (foco.evolucion === "Fluctuante" || foco.patronTemporal?.frecuencia === "Intermitente") && (ext === "Cambia de lugar" || ext === "Se expande" || ext === "NoDefinido") && !isNeuro) {
            isNociplastico = true;
        }

        // Mixto (Neuro + Mecánico)
        const rigidezMin = Number(foco.patronTemporal?.rigidezMatinalMinutos) || 0;
        const signosMecanicos = rigidezMin > 0 || foco.subito?.sonidoSensacion?.includes("Bloqueo") || foco.subito?.sonidoSensacion?.includes("Inestabilidad") || ext === "Local";

        if (isNeuro && signosMecanicos) {
            isMixto = true;
        }

        let catPrincipal = "Nociceptivo";
        let apelPrincipal = "Mecánico por carga";
        if (rigidezMin > 60 || foco.subito?.hinchazonRapida === "Sí") {
            apelPrincipal = "Inflamatorio";
        }

        if (isMixto) {
            catPrincipal = "Mixto";
            apelPrincipal = "Neuropático y mecánico";
        } else if (isNociplastico) {
            catPrincipal = "Nociplástico";
            apelPrincipal = "Sensibilización central probable";
        } else if (isNeuro) {
            catPrincipal = "Neuropático";
            apelPrincipal = "Periférico probable";
            const rc = foco.region.toLowerCase();
            if (rc.includes("cuello") || rc.includes("cervical") || rc.includes("espalda") || rc.includes("lumbar") || rc.includes("columna") || rc.includes("ciática") || rc.includes("ciatica")) {
                apelPrincipal = "Radicular probable";
            }
        }

        const razones: string[] = [];
        if (catPrincipal === "Neuropático" || isMixto) razones.push("La naturaleza del síntoma (ej. eléctrico/quemazón) junto con la expansión territorial descrita sugieren un fuerte componente neuropático.");
        if (catPrincipal === "Nociplástico") razones.push("La fluctuación del cuadro asociado a banderas psicosociales (BPS) elevadas de manera sistémica y dolor errático orientan a una sensibilización primaria o secundaria.");
        if (catPrincipal === "Mixto") razones.push("A pesar de los signos neuropáticos, coexisten síntomas mecánicos locales francos (ej. rigidez mantenida, bloqueos).");
        if (catPrincipal === "Nociceptivo") razones.push(`El cuadro responde predominantemente a características locales y estructurales, calificando preeliminarmente como ${apelPrincipal.toLowerCase()}.`);

        let alternativaCat = "Nociceptivo";
        let alternativaApel = "Mecánico";

        if (catPrincipal === "Nociceptivo") {
            alternativaCat = "Mixto"; alternativaApel = "Con compromiso nervioso subclínico";
        } else if (catPrincipal === "Neuropático") {
            alternativaCat = "Mixto"; alternativaApel = "Componente musculoesquelético activo asociado";
        } else if (catPrincipal === "Nociplástico") {
            alternativaCat = "Nociceptivo"; alternativaApel = "Dolor persistente sin sensibilización predominante";
        } else if (catPrincipal === "Mixto") {
            alternativaCat = "Neuropático"; alternativaApel = "Puro sin rasgo mecánico relevante";
        }

        return {
            principal: { categoria: catPrincipal as FocoV4["mecanismoCategoria"], apellido: apelPrincipal },
            alternativa: { categoria: alternativaCat, apellido: alternativaApel },
            razones
        };
    };

    const handleAddFocoSecundario = () => {
        if (interviewV4.focos.length >= 5) return;
        const newId = generateId();
        const newFoco = {
            id: newId,
            esPrincipal: false,
            region: "", lado: "N/A",
            inicio: "NoDefinido", antiguedad: "", evolucion: "NoDefinido", episodiosPrevios: "NoDefinido", contextoDetallado: "",
            subito: { contacto: null, cinematica: [], sonidoSensacion: [], capacidadInmediata: "", hinchazonRapida: null },
            gradual: { volumen: 3, intensidad: 3, frecuencia: 3, recuperacion: null, cambiosEspecificos: [], aparicionSintoma: "", picoCargaSugerido: "" },
            dolorActual: null, mejor24h: null, peor24h: null, dolorActividadIndice: null, actividadIndice: "",
            extension: "NoDefinido", profundidad: "NoDefinido", naturaleza: [],
            patronTemporal: { frecuencia: "", rigidezMatinalMinutos: null, despiertaNoche: null },
            irradiacion: "N/A", tags: [],
            agravantes: "", aliviantes: "", dolorPostActividad: "NoDefinida", tiempoCalma: "",
            signoComparable: "", dolorEnSigno: null, notaRapida: "",
            sintomasMecanicos: [], sintomasSistemicos: [], sintomasNeurologicos: { activados: [], zona: "", asociacion: [] }, disparadoresParaDescartes: [],
            mecanismoConfirmacion: "NoDefinido", mecanismoCategoria: "NoDefinido", mecanismoApellido: "", mecanismoTextoFinal: ""
        } as any;
        updateV4({ focos: [...interviewV4.focos, newFoco] });
    };

    const handleDeleteFoco = (id: string) => {
        if (interviewV4.focos.length <= 1) return;
        const newFocos = interviewV4.focos.filter(f => f.id !== id);
        updateV4({ focos: newFocos });
    };

    // IsRiesgoAlto is parsed inside the components logic section
    // --- COMPLETITUD (MP4) ---
    const { reqSec1, reqSec4, reqSec5, reqSec9, reqSec10, reqSec13 } = React.useMemo(() => {
        const r1: string[] = [];
        if (!interviewV4.experienciaPersona.prioridadPrincipal) r1.push("Prioridad #1");

        const r4: string[] = [];
        if (focoPrincipal) {
            if (!focoPrincipal.inicio || focoPrincipal.inicio === "NoDefinido") r4.push("Inicio");
            if (!focoPrincipal.antiguedad) r4.push("Antigüedad");
            if (!focoPrincipal.mecanismoTextoFinal) r4.push("Mecanismo Sugerido");
        } else {
            r4.push("Foco");
        }

        const r5: string[] = [];
        if (focoPrincipal && focoPrincipal.dolorActual === null) r5.push("Dolor Actual");

        const r9: string[] = [];
        if (focoPrincipal) {
            if (!focoPrincipal.signoComparable) r9.push("Gesto");
            if (focoPrincipal.dolorEnSigno === null || focoPrincipal.dolorEnSigno === undefined) r9.push("Dolor Gesto");
        }

        const r10: string[] = [];
        if (interviewV4.hayLimitacionFuncional) {
            if (!interviewV4.psfsGlobal.some(p => p.actividad.trim() !== "" && p.score !== null)) r10.push("1 PSFS");
        }

        const r13: string[] = [];
        if (!interviewV4.decisionEvalFisica) {
            r13.push("Confirmación a P2");
        } else if (interviewV4.decisionEvalFisica === "Sí" && !interviewV4.planEvaluacionFisica) {
            r13.push("Plan Examen");
        } else if (interviewV4.decisionEvalFisica === "No" && !interviewV4.razonNoEvalFisica) {
            r13.push("Razón Derivación");
        }

        return { reqSec1: r1, reqSec4: r4, reqSec5: r5, reqSec9: r9, reqSec10: r10, reqSec13: r13 };
    }, [interviewV4, focoPrincipal]);

    // --- VALIDACIÓN DE CIERRE ESTRICTA (MP10) ---
    const { isValidForP2, validationErrors, hasRedFlags: localHasRedFlags, hayContradiccionSeguridad } = React.useMemo(() => {
        const errors: string[] = [];

        // 1. Prioridad principal
        if (!interviewV4.experienciaPersona.prioridadPrincipal) {
            errors.push("Prioridad #1: Es obligatorio definir la queja o prioridad del paciente hoy.");
        }

        // 2 & 3. Datos Críticos del Foco Principal (Antigüedad)
        const fp = focoPrincipal;
        if (fp) {
            if (!fp.antiguedad || fp.antiguedad === "NoDefinido") errors.push("Foco Principal: Falta tiempo de evolución (antigüedad).");
        } else {
            errors.push("Anamnesis: Se requiere al menos 1 foco clínico estructurado.");
        }

        // 4. Anclas Mínimas
        if (!focoPrincipal?.inicio || focoPrincipal.inicio === "NoDefinido") errors.push("Anclas: Seleccione Inicio (Súbito/Gradual).");
        if (!focoPrincipal?.evolucion || focoPrincipal.evolucion === "NoDefinido") errors.push("Anclas: Seleccione Evolución global.");
        if (!focoPrincipal?.actividadIndice?.trim()) errors.push("Anclas: Ingrese la Actividad índice principal.");

        if (interviewV4.hayLimitacionFuncional) {
            const hasValidPsfs = interviewV4.psfsGlobal.some(p => p.actividad && p.actividad.trim() !== "" && p.score !== null);
            if (!hasValidPsfs) errors.push("Anclas: Ha indicado limitación funcional. Ingrese 1 actividad con texto y puntaje válido.");
        } else {
            if (interviewV4.capacidadPercibidaActividad === null || interviewV4.capacidadPercibidaActividad === undefined) {
                errors.push("Anclas: Si no hay limitación, ingrese la Capacidad percibida (0-10).");
            }
        }

        if (!interviewV4.contextosAnclas || interviewV4.contextosAnclas.length === 0) errors.push("Anclas: Seleccione al menos un Contexto.");
        if (!interviewV4.objetivoPersona?.trim()) errors.push("Anclas: Ingrese el Objetivo de la persona usuaria.");
        if (!interviewV4.plazoEsperado?.trim()) errors.push("Anclas: Ingrese el Plazo esperado.");

        // Condicionales de Quejas (Fase 5)
        const quejas = interviewV4.experienciaPersona.quejas || [];
        const quejaOtro = interviewV4.experienciaPersona.quejaOtro?.toLowerCase() || "";

        const hasPainOrTingle = quejas.includes('Dolor') || quejas.includes('Hormigueo/Adormecimiento') || quejaOtro.includes('dolor');
        if (hasPainOrTingle) {
            if (focoPrincipal?.dolorActual === null || focoPrincipal?.dolorActual === undefined) errors.push("Anclas (Intensidad): Falta Dolor Actual.");
            if (focoPrincipal?.dolorActividadIndice === null || focoPrincipal?.dolorActividadIndice === undefined) errors.push("Anclas (Intensidad): Falta Dolor en la Actividad Índice.");
        }

        const hasPainOrStiff = quejas.includes('Dolor') || quejas.includes('Rigidez') || quejaOtro.includes('dolor');
        const isChronic = focoPrincipal?.antiguedad === '1-3 meses' || focoPrincipal?.antiguedad === '3-6 meses' || focoPrincipal?.antiguedad === '>6 meses';
        if (hasPainOrStiff && isChronic) {
            if (focoPrincipal?.patronTemporal.despiertaNoche === null || focoPrincipal?.patronTemporal.despiertaNoche === undefined) {
                errors.push("Anclas: Indique confirmar si presenta Despertar Nocturno por el síntoma.");
            }
        }

        // 5. Seguridad Clínica Obligatoria
        if (!interviewV4.seguridad?.confirmado) {
            errors.push("Seguridad Clínica: Confirme que ha realizado la evaluación de banderas rojas/naranjas.");
        }

        const hasRedFlags = interviewV4.seguridad?.fiebre_sistemico_cancerPrevio ||
            interviewV4.seguridad?.bajaPeso_noIntencionada ||
            interviewV4.seguridad?.dolorNocturno_inexplicable_noMecanico ||
            interviewV4.seguridad?.trauma_altaEnergia_caidaImportante ||
            interviewV4.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar ||
            interviewV4.seguridad?.sospechaFractura_incapacidadCarga;

        if (hasRedFlags && !interviewV4.seguridad?.accionBanderaRoja) {
            errors.push("Seguridad Clínica: Debe seleccionar una acción debido a la marcación de Banderas Rojas.");
        }

        // FASE 10: Contradicciones de Seguridad IA vs Checklist
        const analisisSeguridad = interviewV4.analisisIA?.extraccion_general?.seguridad_mencionada_en_relato?.valor;
        const IA_detecta_bandera = !!analisisSeguridad && analisisSeguridad !== "No_mencionado" && String(analisisSeguridad).trim() !== "";
        const checklist_negative = !hasRedFlags && !interviewV4.seguridad?.riesgoEmocionalAgudo;
        const hayContradiccionSeguridad = IA_detecta_bandera && checklist_negative;
        const contradiccionNoResuelta = hayContradiccionSeguridad && !interviewV4.seguridad?.resolucionContradiccionIA?.resuelto;

        if (contradiccionNoResuelta) {
            errors.push("Seguridad Clínica: Existe una posible señal de alerta detectada por la IA que no ha sido resuelta en las Confirmaciones Críticas.");
        }

        // FASE 11: Confirmaciones Críticas Obligatorias
        if (interviewV4.analisisIA) {
            const confs = interviewV4.confirmacionesCriticas;

            const reqIrr = !!interviewV4.analisisIA.SINS?.irritabilidad;
            const reqNat = !!interviewV4.analisisIA.SINS?.naturaleza_sugerida;
            const reqHip = (interviewV4.analisisIA.hipotesis_orientativas_por_sistema?.length || 0) > 0;

            if (reqIrr && (!confs || !confs.irritabilidad_global || confs.irritabilidad_global.estado === 'Pendiente' || (confs.irritabilidad_global.estado === 'Editado' && !confs.irritabilidad_global.justificacion?.trim()))) {
                errors.push("Confirmaciones Críticas: Falta revisar o justificar la 'Irritabilidad Global'.");
            }
            if (reqNat && (!confs || !confs.naturaleza_sugerida || confs.naturaleza_sugerida.estado === 'Pendiente' || (confs.naturaleza_sugerida.estado === 'Editado' && !confs.naturaleza_sugerida.justificacion?.trim()))) {
                errors.push("Confirmaciones Críticas: Falta revisar o justificar la 'Naturaleza Sugerida'.");
            }
            if (reqHip && (!confs || !confs.hipotesis_orientativas || confs.hipotesis_orientativas.estado === 'Pendiente' || (confs.hipotesis_orientativas.estado === 'Editado' && !confs.hipotesis_orientativas.justificacion?.trim()))) {
                errors.push("Confirmaciones Críticas: Falta revisar o justificar las 'Hipótesis Orientativas'.");
            }
        }

        return { isValidForP2: errors.length === 0, validationErrors: errors, hasRedFlags, hayContradiccionSeguridad };
    }, [interviewV4, focoPrincipal]);

    // --- AUTOMATIZACIÓN DETERMINÍSTICA P2 ---
    const sugerenciasP2 = React.useMemo(() => {
        const sugerencias: Array<FocoV4["id"] extends string ? any : any> = []; // workaround interface typings
        const fp = interviewV4.focos.find(f => f.esPrincipal);

        if (fp && fp.region) {
            sugerencias.push({ id: `rom_${fp.id}`, focoId: fp.id, tipo: "ROM", label: `ROM activo/pasivo de ${fp.region}`, razon: "Evaluación basal de región principal", prioridad: "Alta", agregarAP2: true });
            sugerencias.push({ id: `fuerza_${fp.id}`, focoId: fp.id, tipo: "Fuerza", label: `Fuerza basal relacionada a ${fp.region}`, razon: "Evaluación basal de región principal", prioridad: "Alta", agregarAP2: true });

            if (fp.dolorPostActividad === 'A veces' || fp.dolorPostActividad === 'Siempre' || fp.dolorPostActividad === 'Frecuente') {
                sugerencias.push({ id: `carga_${fp.id}`, focoId: fp.id, tipo: "Carga", label: "Test de carga progresiva", razon: "Dolor reportado post-actividad", prioridad: "Media", agregarAP2: true });
            }

            const isInflammatory = fp.tags.some(t => ['Inflamación', 'Edema', 'Hematoma', 'Eritema', 'Calor'].includes(t));
            if (isInflammatory || fp.mecanismoApellido === "inflamatorio") {
                sugerencias.push({ id: `inflam_${fp.id}`, focoId: fp.id, tipo: "Palpacion", label: "Inspección/palpación signos inflamatorios", razon: "Tags o mecanismo inflamatorio detectado", prioridad: "Media", agregarAP2: true });
            }
        }

        if (interviewV4.contextoDeportivo.aplica) {
            sugerencias.push({ id: "historia_carga", focoId: fp ? fp.id : "General", tipo: "Screening", label: "Historia de carga: spikes, volumen, intensidad", razon: "Paciente con contexto deportivo activo", prioridad: "Media", agregarAP2: true });
        }

        return sugerencias;
    }, [interviewV4]);


    // === [GENERACIÓN AUTO DE RESUMEN CLÍNICO Y CIERRE] ===
    const handleGenerateResumen = () => {
        const fp = focoPrincipal;
        const mainObj = interviewV4.experienciaPersona.objetivos.find(o => o.esPrincipal) || interviewV4.experienciaPersona.objetivos[0];

        let resumenBase = `Paciente se presenta por ${interviewV4.experienciaPersona.prioridadPrincipal || interviewV4.experienciaPersona.quejas[0] || 'molestias'}. `;
        if (fp) {
            resumenBase += `Presenta foco principal en ${fp.region} (${fp.lado}), de inicio ${fp.inicio} hace ${fp.antiguedad}. `;
            if (fp.mecanismoCategoria) {
                resumenBase += `Mecanismo aparente ${fp.mecanismoCategoria} (${fp.mecanismoApellido || ''}). `;
            }
        }
        resumenBase += `Objetivo principal: ${mainObj ? mainObj.verbo + ' ' + mainObj.actividad : 'No definido'}. `;
        if (isRiesgoAlto) {
            resumenBase += `\nALERTA: Se detectaron banderas rojas importantes (${seguridadMotivo}).`;
        }

        const tagsTransversales = fp?.tags?.filter(t => !['Inflamación', 'Edema', 'Hematoma', 'Eritema', 'Calor', 'Articular'].includes(t)) || [];
        const tagsRegionales = fp?.tags?.filter(t => ['Inflamación', 'Articular', 'Neuropático'].includes(t)) || [];

        const menosProbable: string[] = [];
        if (!interviewV4.seguridad.sospechaFractura_incapacidadCarga) menosProbable.push("Patología estructural grave (fractura)");
        if (!interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar) menosProbable.push("Compromiso radicular/medular severo");

        updateV4({
            cierre: {
                resumenClinico: resumenBase,
                loMasImportante: {
                    quejaPrioritaria: interviewV4.experienciaPersona.prioridadPrincipal || interviewV4.experienciaPersona.quejas[0] || 'No registrada',
                    objetivoPrioritario: mainObj ? `${mainObj.verbo} ${mainObj.actividad}` : 'No registrado',
                    irritabilidad: fp?.irritabilidadAuto?.nivel || 'No calculada',
                    tipoDolorSugerido: fp?.mecanismoTextoFinal || 'No clasificado',
                    resumenBanderas: isRiesgoAlto ? `⚠️ Alto riesgo: ${seguridadMotivo}` : (interviewV4.seguridad.riesgoEmocionalAgudo ? '⚠️ Riesgo emocional (naranja)' : '✅ Sin banderas de riesgo')
                },
                hipotesisSugeridas: {
                    tagsTransversales,
                    tagsRegionales
                },
                menosProbable,
                faltaDescartar: fp?.disparadoresParaDescartes || []
            }
        });
    };

    const handleCloseAnamnesis = () => {
        if (!isValidForP2) {
            alert("No se puede avanzar. Revise los errores al final de la pantalla.\n\n" + validationErrors.join("\n"));
            return;
        }
        updateV4({ status: "approved", automatizacionP2: sugerenciasP2 }); // Guardar las sugerencias como automatizaciones iniciales
        alert("¡Anamnesis V4 Aprobada! P2 habilitado.");
    };

    // === [CÁLCULO AUTOMÁTICO BPS] ===
    useEffect(() => {
        if (!initialRenderComplete || isClosed) return;

        const b = interviewV4.bps;
        const score = (b.sueno || 0) + (b.estres || 0) + (b.miedoMoverCargar || 0) +
            (b.preocupacionDano || 0) + (b.confianzaBaja || 0) + (b.frustracion || 0);

        let nivel: "Bajo" | "Medio" | "Alto" = "Bajo";
        if (score >= 8) nivel = "Alto";
        else if (score >= 4) nivel = "Medio";

        let razon = `Puntaje ${score}/12. `;
        if (nivel === "Alto") razon += "Múltiples banderas amarillas activas.";
        else if (nivel === "Medio") razon += "Algunos factores psicosociales presentes.";
        else razon += "Sin riesgo psicosocial evidente.";

        // Solo actualizar si realmente cambió para evitar ciclos infinitos
        const currAuto = interviewV4.bps.impactoAuto;
        if (!currAuto || currAuto.score !== score || currAuto.nivel !== nivel) {
            updateV4({
                bps: {
                    ...interviewV4.bps,
                    impactoAuto: { score, nivel, razon }
                }
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        interviewV4.bps.sueno, interviewV4.bps.estres, interviewV4.bps.miedoMoverCargar,
        interviewV4.bps.preocupacionDano, interviewV4.bps.confianzaBaja, interviewV4.bps.frustracion,
        initialRenderComplete, isClosed
    ]);

    // === [CÁLCULO AUTOMÁTICO ADHERENCIA LABORAL/BARRERAS] ===
    useEffect(() => {
        if (!initialRenderComplete || isClosed) return;

        const barreras = interviewV4.contextoLaboral?.barrerasReales === true;
        const bajaConfianza = (interviewV4.bps?.confianzaBaja || 0) >= 2;
        const riesgoAdh = barreras || bajaConfianza;

        if (interviewV4.contextoLaboral?.riesgoAdherenciaAuto !== riesgoAdh) {
            updateV4({
                contextoLaboral: {
                    ...interviewV4.contextoLaboral,
                    riesgoAdherenciaAuto: riesgoAdh
                } as any
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        interviewV4.contextoLaboral?.barrerasReales,
        interviewV4.bps?.confianzaBaja,
        initialRenderComplete, isClosed
    ]);

    // === [CÁLCULO AUTOMÁTICO MOTOR DE REGLAS P2 (MINI FASE 18)] ===
    useEffect(() => {
        if (!initialRenderComplete || isClosed) return;

        // Para evitar problemas de inicialización (isRiesgoAlto se calcula abajo),
        // recalculamos rápidamente si hay banderas rojas acá
        const tieneRojas =
            interviewV4.seguridad.fiebre_sistemico_cancerPrevio ||
            interviewV4.seguridad.bajaPeso_noIntencionada ||
            interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico ||
            interviewV4.seguridad.trauma_altaEnergia_caidaImportante ||
            interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar ||
            interviewV4.seguridad.sospechaFractura_incapacidadCarga ||
            interviewV4.seguridad.overrideUrgenciaMedica;
        const tieneNaranjas = interviewV4.seguridad.riesgoEmocionalAgudo;
        const _isRiesgoAlto = (tieneRojas ? 1 : 0) >= 2 || (tieneNaranjas ? 1 : 0) >= 1 || interviewV4.seguridad.overrideUrgenciaMedica;

        const recs: string[] = [];
        const fp = focoPrincipal;

        if (fp) {
            // Regla 1: Inflamación
            const notas = fp.notaRapida?.toLowerCase() || '';
            const tieneHinchazon = notas.includes('hinchazón') || notas.includes('hinchazon') || fp.mecanismoApellido === 'pulsátil';
            const tieneSignosInflamacion = fp.tags?.some(t => ['Inflamación', 'Edema', 'Eritema', 'Calor', 'Hematoma'].includes(t));
            if (tieneHinchazon || tieneSignosInflamacion) {
                recs.push("🔍 Buscar signos inflamatorios/edema en P2 (Inspección/Palpación).");
            }

            // Regla 2: Neuropático
            const isCorriente = fp.mecanismoApellido === 'corriente' || fp.mecanismoApellido === 'quemante' ||
                fp.tags?.some(t => ['corriente', 'quemante', 'hormigueo', 'adormecimiento'].includes(t.toLowerCase()));
            const isBajaSube = fp.irradiacion === 'Referido' || fp.irradiacion === 'Radicular' || fp.irradiacion === 'Distal';
            if (isCorriente && isBajaSube) {
                recs.push("🧠 Hipótesis neuropática probable: Priorizar descarte neurológico e integridad nerviosa en P2.");
            }

            // Regla 4: Irritabilidad
            const irritabilidadAlta = fp.irritabilidadAuto?.nivel === 'Alta';
            const afterFrecuente = fp.dolorPostActividad === 'Siempre' || fp.tiempoCalma === 'Horas' || fp.tiempoCalma === 'Días';
            if (irritabilidadAlta && afterFrecuente) {
                recs.push("⚠️ Riesgo de sobre-provocación: Priorizar descartar hipótesis graves vs exceso de pruebas físicas hoy.");
            }
        }

        // Regla 3: Urgencia / Rojas
        if (_isRiesgoAlto) {
            recs.push(`🚨 Banderas rojas activas: Lista corta para confirmar o derivar inmediatamente.`);
        }

        // Regla 5: Adherencia
        if (interviewV4.contextoLaboral?.riesgoAdherenciaAuto) {
            recs.push("💡 Riesgo de baja adherencia detectado: Enfocar P2 en educación y pactar un plan funcional realista.");
        }

        // Evitar render loop comparando arrays (JSON stringify superficial)
        const currentRecsStr = JSON.stringify(interviewV4.p2_recommendations || []);
        const newRecsStr = JSON.stringify(recs);

        if (currentRecsStr !== newRecsStr) {
            updateV4({ p2_recommendations: recs });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        focoPrincipal,
        interviewV4.seguridad,
        interviewV4.contextoLaboral?.riesgoAdherenciaAuto,
        initialRenderComplete, isClosed
    ]);

    // === [CÁLCULO AUTOMÁTICO PARA ALERTAS SEGURIDAD/FLAGS] === (MINI FASE 06)
    const { seguridadColor, seguridadStyles, seguridadDot, seguridadMotivo, isRiesgoAlto } = React.useMemo(() => {
        let rojas = 0;
        let naranjas = 0;
        let motivos: string[] = [];

        // Evaluar Rojas
        if (interviewV4.seguridad.fiebre_sistemico_cancerPrevio) { rojas++; motivos.push("Compromiso sistémico"); }
        if (interviewV4.seguridad.bajaPeso_noIntencionada) { rojas++; motivos.push("Baja de peso inexplicable"); }
        if (interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico) { rojas++; motivos.push("Dolor nocturno no mecánico"); }
        if (interviewV4.seguridad.trauma_altaEnergia_caidaImportante) { rojas++; motivos.push("Trauma alta energía"); }
        if (interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar) { rojas++; motivos.push("Déficit neurológico grave"); }
        if (interviewV4.seguridad.sospechaFractura_incapacidadCarga) { rojas++; motivos.push("Sospecha fractura"); }
        if (interviewV4.seguridad.overrideUrgenciaMedica) { rojas += 2; motivos.push(`Urgencia Manual (${interviewV4.seguridad.justificacionUrgencia || 'Sin justificación'})`); }

        // Evaluar Naranjas
        if (interviewV4.seguridad.riesgoEmocionalAgudo) { naranjas++; motivos.push("Riesgo emocional agudo"); }

        let color = "Pendiente";
        let styles = "bg-slate-50 border-slate-200 text-slate-500";
        let dot = "bg-slate-300";
        let motivoStr = "Pendiente de evaluación.";

        const isRiesgoAltoCalc = rojas >= 2 || naranjas >= 1 || interviewV4.seguridad.overrideUrgenciaMedica;
        const hasFlags = rojas > 0 || naranjas > 0 || interviewV4.seguridad.overrideUrgenciaMedica;

        if (hasFlags) {
            color = "Revisar";
            styles = "bg-rose-50 border-rose-200 text-rose-800";
            dot = "bg-rose-500";
            motivoStr = `Revisar. Motivos: ${motivos.join(", ")}.`;
            if (interviewV4.seguridad.detalleBanderas?.trim()) {
                motivoStr += ` Detalle clínico: ${interviewV4.seguridad.detalleBanderas}`;
            } else {
                motivoStr += " (Falta detalle clínico justificador)";
            }
        } else if (interviewV4.seguridad.confirmado) {
            color = "OK";
            styles = "bg-emerald-50 border-emerald-200 text-emerald-800";
            dot = "bg-emerald-500";
            motivoStr = "Sin banderas de riesgo detectadas.";
        }

        return {
            seguridadColor: color,
            seguridadStyles: styles,
            seguridadDot: dot,
            seguridadMotivo: motivoStr,
            isRiesgoAlto: isRiesgoAltoCalc
        };
    }, [interviewV4.seguridad]);

    // -------------------------------------------------------------
    // RENDER ======================================================
    // -------------------------------------------------------------
    const completedFoci = interviewV4.focos.filter(f => f.region && f.lado !== "N/A" && f.dolorActual !== null).length;
    const completitudString = `${completedFoci}/${interviewV4.focos.length} Focos`;

    return (
        <div className="flex flex-col w-full h-full relative font-sans max-w-3xl mx-auto pb-48">
            {/* STICKY TOP BAR (MINI FASE 02) */}
            <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 py-2 sm:py-3 mb-6 -mx-4 sm:mx-0 sm:px-0 flex flex-col gap-2">

                {/* FILA 1: Título, IA y Guardado */}
                <div className="flex flex-row justify-between items-center gap-2">
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-bold text-slate-600 tracking-tight hidden sm:block">Sección actual: Anamnesis próxima</h2>
                        <h2 className="text-sm font-bold text-slate-600 tracking-tight sm:hidden">Anamnesis</h2>
                    </div>

                    <div className="flex items-center gap-2 w-auto overflow-x-auto pb-0 hide-scrollbar justify-end">
                        <span className="flex items-center gap-1.5 shrink-0 bg-slate-50 border border-slate-200 px-2.5 py-1 sm:py-1.5 rounded text-[10px] font-bold text-slate-500 mr-1" title="Cambia entre modo pedagógico y flujo rápido">
                            <span>Alumno</span>
                            <button
                                onClick={() => setIsExpertMode(!isExpertMode)}
                                className={`w-7 h-3.5 sm:w-8 sm:h-4 rounded-full flex items-center transition-colors duration-200 focus:outline-none ${isExpertMode ? 'bg-blue-600' : 'bg-slate-300'}`}
                            >
                                <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 bg-white rounded-full shadow-md transform transition-transform duration-200 ${isExpertMode ? 'translate-x-[14px] sm:translate-x-[18px]' : 'translate-x-[2px]'}`} />
                            </button>
                            <span className={isExpertMode ? 'text-blue-600' : ''}>Experto</span>
                        </span>
                        <button disabled className="text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed flex items-center gap-1 shrink-0" title="Sugerir checklist de preguntas faltantes (No autocompleta)">
                            <span>✨</span> <span className="hidden sm:inline">IA: qué falta preguntar</span><span className="sm:hidden">Sugerir</span>
                        </button>
                        <button disabled className="text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed flex items-center gap-1 shrink-0" title="Redactar borrador de resumen (Revisión manual requerida)">
                            <span>📝</span> <span className="hidden sm:inline">IA: redactar resumen</span><span className="sm:hidden">Resumen</span>
                        </button>

                        {isSavingDraft ? (
                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 sm:py-1.5 rounded animate-pulse whitespace-nowrap shrink-0">Guardando...</span>
                        ) : lastSaved ? (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 sm:py-1.5 rounded whitespace-nowrap shrink-0 border border-emerald-100">✔ {lastSaved}</span>
                        ) : null}
                    </div>
                </div>

                {/* 1. Foco y etiquetas rápidas */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 relative">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-800 text-white font-bold text-[10px]">1</span>
                        <h3 className="font-bold text-slate-800 text-sm">Foco y etiquetas rápidas</h3>
                        <button
                            onClick={() => setShowFocoGuide(true)}
                            className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center text-xs font-bold transition-colors ml-1"
                            title="Guía de entrevista clínica"
                        >
                            ?
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        {/* Foco Principal */}
                        <div className="md:col-span-4 flex flex-col justify-end">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 border-b border-rose-200 pb-0.5 text-rose-800">Foco Principal <span className="text-[9px] text-rose-500 italic normal-case">*obligatorio</span></div>
                            <div className="flex gap-1 h-8">
                                <input
                                    type="text"
                                    placeholder="Región (ej. Rodilla)"
                                    className="w-2/3 text-xs p-1.5 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
                                    value={focoPrincipal.region || ""}
                                    onChange={e => {
                                        const newFocos = [...interviewV4.focos];
                                        newFocos[0].region = e.target.value;
                                        updateV4({ focos: newFocos });
                                    }}
                                    disabled={isClosed}
                                />
                                <select
                                    className="w-1/3 text-xs p-1.5 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
                                    value={focoPrincipal.lado || "N/A"}
                                    onChange={e => {
                                        const newFocos = [...interviewV4.focos];
                                        newFocos[0].lado = e.target.value as any;
                                        updateV4({ focos: newFocos });
                                    }}
                                    disabled={isClosed}
                                >
                                    <option value="N/A">- Lado -</option><option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option><option value="Bilateral">Bilateral</option>
                                </select>
                            </div>
                        </div>

                        {/* Motivos Secundarios */}
                        <div className="md:col-span-3 flex flex-col justify-end">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Motivos secundarios (2 máx)</div>
                            <div className="flex flex-col gap-1">
                                <select
                                    className="w-full h-8 text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50"
                                    value={interviewV4.experienciaPersona.objetivos[1]?.actividad || ""}
                                    onChange={e => {
                                        const val = e.target.value;
                                        const newObjs = [...interviewV4.experienciaPersona.objetivos];
                                        if (val === "") {
                                            newObjs.splice(1, 1);
                                        } else {
                                            if (!newObjs[1]) newObjs[1] = { id: generateId(), contexto: [], verbo: "", actividad: "", plazoSemanas: "", enSusPalabras: "", esPrincipal: false } as any;
                                            newObjs[1].actividad = val;
                                        }
                                        updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                    }}
                                    disabled={isClosed}
                                >
                                    <option value="">- Seleccionar motivo secundario -</option>
                                    {["Recidiva Constante", "Poca confianza/Miedo", "Baja Performance", "Otro"].map(m => (
                                        <option key={m} value={m}>{m}</option>
                                    ))}
                                </select>
                                {interviewV4.experienciaPersona.objetivos[1]?.actividad === "Otro" && (
                                    <input
                                        type="text"
                                        placeholder="Especifique otro motivo..."
                                        className="w-full text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50 mt-1"
                                        value={interviewV4.experienciaPersona.objetivos[1]?.enSusPalabras || ""}
                                        onChange={e => {
                                            const newObjs = [...interviewV4.experienciaPersona.objetivos];
                                            newObjs[1].enSusPalabras = e.target.value;
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                        }}
                                        disabled={isClosed}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Quejas Principales */}
                        <div className="md:col-span-5 flex flex-col justify-end">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Queja(s) principal(es)</div>
                            <div className="flex flex-wrap gap-1 items-center">
                                {["Dolor", "Rigidez", "Hinchazón", "Inestabilidad", "Debilidad", "Hormigueo/Adormecimiento", "Miedo al movimiento", "Rendimiento/Preventivo", "Otro"].map(q => {
                                    const isSelected = interviewV4.experienciaPersona.quejas.includes(q);
                                    return (
                                        <button
                                            key={q}
                                            disabled={isClosed}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const current = interviewV4.experienciaPersona.quejas;
                                                const next = isSelected ? current.filter(x => x !== q) : [...current, q];
                                                updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, quejas: next } });
                                            }}
                                            className={`text-[9.5px] px-2 py-1 rounded-full border transition-colors ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 font-bold shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'}`}
                                        >
                                            {q}
                                        </button>
                                    );
                                })}
                            </div>
                            {interviewV4.experienciaPersona.quejas.includes("Otro") && (
                                <input
                                    type="text"
                                    placeholder="Especifique otra queja..."
                                    className="w-full h-7 text-xs p-1.5 border border-slate-300 rounded outline-none bg-indigo-50/50 mt-1"
                                    value={interviewV4.experienciaPersona.quejaOtro || ""}
                                    onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, quejaOtro: e.target.value } })}
                                    disabled={isClosed}
                                />
                            )}
                        </div>

                        {/* Prioridad #1 - RE-ADDED */}
                        <div className="md:col-span-12 flex flex-col justify-end mt-2">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 border-b border-rose-200 pb-0.5 text-rose-800">Prioridad #1 <span className="text-[9px] text-rose-500 italic normal-case">*obligatorio</span></div>
                            <select
                                className="w-full sm:w-1/2 h-8 text-xs p-1.5 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
                                value={interviewV4.experienciaPersona.prioridadPrincipal || ""}
                                onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, prioridadPrincipal: e.target.value } })}
                                disabled={isClosed}
                            >
                                <option value="">- Seleccione Prioridad -</option>
                                {interviewV4.experienciaPersona.quejas.map(q => (
                                    <option key={q} value={q === "Otro" ? interviewV4.experienciaPersona.quejaOtro || "Otro" : q}>
                                        {q === "Otro" ? interviewV4.experienciaPersona.quejaOtro || "Otro" : q}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Modal Guía Rápida */}
                    {showFocoGuide && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowFocoGuide(false)}>
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">?</span>
                                        Guía Rápida de Entrevista
                                    </h3>
                                    <button onClick={() => setShowFocoGuide(false)} className="text-slate-400 hover:text-rose-500 font-bold p-1">✕</button>
                                </div>
                                <div className="p-4 flex-1">
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-1 hide-scrollbar">
                                        {["Dolor agudo/traumático", "Sobrecarga gradual", "Rendimiento/preventivo", "Dolor persistente"].map((tab, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => setFocoGuideTab(idx)}
                                                className={`text-[11px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors border ${focoGuideTab === idx ? "bg-indigo-600 text-white border-indigo-700 shadow-sm" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>

                                    {focoGuideTab === 0 && (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                <h4 className="text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wide">5 Preguntas Clave</h4>
                                                <ul className="text-xs text-blue-800 list-disc ml-4 space-y-1">
                                                    <li>¿Puedes describir exactamente el momento en que ocurrió y cómo estaba posicionado tu cuerpo?</li>
                                                    <li>¿Sentiste, escuchaste o notaste algún chasquido, crujido o "pop" en ese instante?</li>
                                                    <li>¿El dolor inicial te impidió continuar con la actividad inmediatamente?</li>
                                                    <li>¿La articulación se hinchó enseguida (primeras 2 horas) o fue apareciendo al día siguiente?</li>
                                                    <li>¿Se te "traba", "bloquea" o sientes que "cede/falla" al apoyar peso?</li>
                                                </ul>
                                            </div>
                                            <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                                                <h4 className="text-[11px] font-bold text-rose-900 mb-2 uppercase tracking-wide">3 Errores Frecuentes</h4>
                                                <ul className="text-xs text-rose-800 list-disc ml-4 space-y-1">
                                                    <li>Asumir directamente que hay daño estructural severo sin descartar (ej: ligamentos vs tendinopatía aguda).</li>
                                                    <li>No indagar en la urgencia y banderas rojas ocultas (fracturas por avulsión).</li>
                                                    <li>Saturar al paciente de miedos sobre tiempos largos de recuperación en la primera sesión.</li>
                                                </ul>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                                <h4 className="text-[11px] font-bold text-emerald-900 mb-2 uppercase tracking-wide">Validación y Escucha (Frases)</h4>
                                                <ul className="text-xs text-emerald-800 list-disc ml-4 space-y-1">
                                                    <li>"Es totalmente comprensible que esto asuste al ser tan repentino, vamos a revisarlo con calma."</li>
                                                    <li>"Entiendo que el dolor agudo cansa rápido, me avisarás si te molesta cualquier movimiento de evaluación."</li>
                                                    <li>"Sé que querías jugar el fin de semana, evaluemos bien para ver plazos realistas."</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {focoGuideTab === 1 && (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                <h4 className="text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wide">5 Preguntas Clave</h4>
                                                <ul className="text-xs text-blue-800 list-disc ml-4 space-y-1">
                                                    <li>¿Puedes recordar si hubo algún cambio en tus entrenamientos/rutina hace 2 a 4 semanas? (Carga, volumen, calzado, superficie).</li>
                                                    <li>¿El dolor suele ser peor al INICIO del movimiento (frío o por la mañana) y luego "calienta" y mejora?</li>
                                                    <li>¿Sientes que empeora 24 horas después de haber entrenado fuerte o cargado peso?</li>
                                                    <li>Si tuvieras que apuntar con 1 dedo el lugar de máximo dolor, ¿puedes hacerlo exacto o es muy difuso?</li>
                                                    <li>¿A qué hora del día sientes tus peores molestias (patrón horario)?</li>
                                                </ul>
                                            </div>
                                            <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                                                <h4 className="text-[11px] font-bold text-rose-900 mb-2 uppercase tracking-wide">3 Errores Frecuentes</h4>
                                                <ul className="text-xs text-rose-800 list-disc ml-4 space-y-1">
                                                    <li>Creer que es agudo repentino porque "dolió de la nada ayer" (ignorar los picos de carga previos semanas atrás).</li>
                                                    <li>Recomendar reposo total en vez de adaptación de la carga.</li>
                                                    <li>Atribuir erróneamente el dolor a malas posturas o alteraciones biomecánicas ignorando la capacidad de carga (overload).</li>
                                                </ul>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                                <h4 className="text-[11px] font-bold text-emerald-900 mb-2 uppercase tracking-wide">Validación y Escucha (Frases)</h4>
                                                <ul className="text-xs text-emerald-800 list-disc ml-4 space-y-1">
                                                    <li>"Escucho que viene picando hace unas semanas, es un clásico patrón de sobrecarga. Tiene solución manejando bien las dosis."</li>
                                                    <li>"Es muy frustrante cuando el dolor vuelve después de haber 'calentado', sé que rompe el ritmo."</li>
                                                    <li>"No hiciste nada 'mal', tu tejido solo necesita una estrategia gradual para tolerar todo eso de nuevo."</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {focoGuideTab === 2 && (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                <h4 className="text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wide">5 Preguntas Clave</h4>
                                                <ul className="text-xs text-blue-800 list-disc ml-4 space-y-1">
                                                    <li>¿Cuál es tu métrica de éxito actual y en cuánto tiempo buscas tu objetivo principal competitivo/deportivo?</li>
                                                    <li>¿Sientes alguna rigidez, "aviso" previo, asimetría clara o "sensación de pesadez" al llegar al límite en tus ejercicios?</li>
                                                    <li>¿Cómo es tu rutina típica de calentamiento y recuperación inter-entrenamientos?</li>
                                                    <li>¿Has notado alguna debilidad específica en algún rango de movimiento (fondo de sentadilla, bloqueo, extensión final)?</li>
                                                    <li>¿Cómo se sienten tus niveles de estrés, sueño y nutrición en las últimas 4 semanas de entrenamiento fuerte?</li>
                                                </ul>
                                            </div>
                                            <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                                                <h4 className="text-[11px] font-bold text-rose-900 mb-2 uppercase tracking-wide">3 Errores Frecuentes</h4>
                                                <ul className="text-xs text-rose-800 list-disc ml-4 space-y-1">
                                                    <li>Tratar a un deportista sano como si tuviera diagnóstico médico por un hallazgo accidental de imagen (sobre-medicalización).</li>
                                                    <li>Olvidar indagar en los factores BPS (Biopsicosociales) y de recuperación, creyendo que el rendimiento solo es fuerza pura.</li>
                                                    <li>Querer cambiar drásticamente la biomecánica habitual de un atleta cerca de su momento competitivo (incluso siendo "no ideal" en libros).</li>
                                                </ul>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                                <h4 className="text-[11px] font-bold text-emerald-900 mb-2 uppercase tracking-wide">Validación y Escucha (Frases)</h4>
                                                <ul className="text-xs text-emerald-800 list-disc ml-4 space-y-1">
                                                    <li>"Me gusta mucho ese enfoque preventivo; la idea aquí es ser proactivos, no esperar a que haya lesión."</li>
                                                    <li>"Ese nivel de exigencia requiere optimizar cada detalle de tu recuperación; revisaremos tus eslabones más débiles."</li>
                                                    <li>"Buscaremos ese 5% extra enfocándonos en robustez y tolerancia a tus peores escenarios de carga."</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {focoGuideTab === 3 && (
                                        <div className="space-y-4 animate-fadeIn">
                                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                                                <h4 className="text-[11px] font-bold text-blue-900 mb-2 uppercase tracking-wide">5 Preguntas Clave</h4>
                                                <ul className="text-xs text-blue-800 list-disc ml-4 space-y-1">
                                                    <li>A lo largo de todos estos meses/años, ¿a qué cosas crees realmente que se debe este dolor constante? (Tus propias creencias).</li>
                                                    <li>¿Hay días de la semana donde sientas dolor 0 o muy bajo? Si es así, ¿qué haces distinto en esos días?</li>
                                                    <li>¿Sientes que el dolor es intermitente, que "se mueve", que sube y baja de intensidad sin mucha lógica con lo que haces?</li>
                                                    <li>En qué cosas de tu vida diaria o trabajo esto tiene mayor impacto hoy (ánimo, frustración, aislamiento, dormir).</li>
                                                    <li>¿Cómo logras calmar la molestia o brotes fuertes cuando aparece su peor versión (qué has intentado, medicación, terapias anteriores fallidas)?</li>
                                                </ul>
                                            </div>
                                            <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                                                <h4 className="text-[11px] font-bold text-rose-900 mb-2 uppercase tracking-wide">3 Errores Frecuentes</h4>
                                                <ul className="text-xs text-rose-800 list-disc ml-4 space-y-1">
                                                    <li>Tratar la sesión intentando "curar el tejido" creyendo que sigue irritado como en un dolor agudo, ignorando el sistema nervioso sensibilizado.</li>
                                                    <li>Frenar a los pacientes por su miedo al movimiento (kinesiofobia), en lugar de fomentar exposición gradual segura.</li>
                                                    <li>Desestimar la carga de estrés vital, malos hábitos de sueño y frustración como verdaderos agravantes de la percepción del dolor.</li>
                                                </ul>
                                            </div>
                                            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                                                <h4 className="text-[11px] font-bold text-emerald-900 mb-2 uppercase tracking-wide">Validación y Escucha (Frases)</h4>
                                                <ul className="text-xs text-emerald-800 list-disc ml-4 space-y-1">
                                                    <li>"Llevar cargando con esto tanto tiempo agota a cualquiera. Te escucho y tu dolor es completamente real, incluso si las imágenes salen 'limpias'."</li>
                                                    <li>"Vamos a ir a tu ritmo. No te forzaré de a golpe a los movimientos que temes, esto es paso a paso construyendo confianza."</li>
                                                    <li>"Mi objetivo es darte herramientas para que tú sientas control sobre esas reagudizaciones, en vez de depender siempre de que te traten."</li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* FILA 3: 3 Badges AUTO */}
                {(interviewV4.seguridad.confirmado || !!interviewV4.analisisIA) && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors ${seguridadStyles}`} title={seguridadMotivo}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${seguridadDot}`} />
                            Seguridad: {seguridadColor}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm 
                            ${focoPrincipal?.irritabilidadAuto?.nivel === 'Alta' ? 'border-rose-200 bg-rose-50 text-rose-800' :
                                focoPrincipal?.irritabilidadAuto?.nivel === 'Media' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                                    focoPrincipal?.irritabilidadAuto?.nivel === 'Baja' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                                        'border-slate-200 bg-slate-50 text-slate-500'
                            }`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Irritabilidad: {focoPrincipal?.irritabilidadAuto?.nivel && focoPrincipal.irritabilidadAuto.nivel !== 'NoDefinido' ? focoPrincipal.irritabilidadAuto.nivel : 'Pendiente'}
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-[250px]
                            ${focoPrincipal?.mecanismoTextoFinal && focoPrincipal.mecanismoTextoFinal !== 'NO' && focoPrincipal.mecanismoTextoFinal !== 'NoDefinido' ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                            title={focoPrincipal?.mecanismoTextoFinal && focoPrincipal.mecanismoTextoFinal !== 'NO' && focoPrincipal.mecanismoTextoFinal !== 'NoDefinido' ? `posible ${focoPrincipal.mecanismoTextoFinal.toLowerCase()}` : 'Pendiente'}>
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                            Naturaleza sugerida: {focoPrincipal?.mecanismoTextoFinal && focoPrincipal.mecanismoTextoFinal !== 'NO' && focoPrincipal.mecanismoTextoFinal !== 'NoDefinido' ? `posible ${focoPrincipal.mecanismoTextoFinal.toLowerCase()}` : 'Pendiente'}
                        </div>
                    </div>
                )}
            </div>

            {/* CONTENEDOR NUEVA ESTRUCTURA FASE 1 */}
            <div className="px-4 flex flex-col gap-5 mt-4">

                {/* 1. Foco y etiquetas rápidas */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-800 text-white font-bold text-[10px]">1</span>
                        <h3 className="font-bold text-slate-800 text-sm">Foco y etiquetas rápidas</h3>
                    </div>
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-700">Etiquetas Clínicas Rápidas (Transversales)</label>
                        <div className="flex flex-wrap gap-1">
                            {["Inflamación", "Mecánico", "Agudo", "Crónico", "Inestable"].map(t => {
                                const selected = focoPrincipal?.tags.includes(t);
                                return (
                                    <button
                                        key={t}
                                        disabled={isClosed}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            let current = focoPrincipal.tags || [];
                                            const newTags = selected ? current.filter(x => x !== t) : [...current, t];
                                            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, tags: newTags } : f);
                                            updateV4({ focos: newFocos });
                                        }}
                                        className={`text-[10px] px-2.5 py-1.5 rounded-lg border transition-colors ${selected ? 'bg-slate-800 text-white border-slate-900 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {t}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 2. Relato del caso */}
                <div id="section-relato" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[10px]">2</span>
                            <h3 className="font-bold text-slate-800 text-sm">Relato del caso</h3>
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={isClosed}
                                onClick={(e) => {
                                    e.preventDefault();
                                    const template = `Motivo de consulta\n[Qué registrar: palabras exactas de la persona usuaria]\n\nObjetivo y expectativa\n[Qué registrar: qué quiere lograr y en qué plazo]\n\nAntigüedad/Inicio y evolución\n[Cómo preguntarlo: ¿Desde cuándo lo siente y cómo ha cambiado?]\n\nLocalización y extensión\n[Qué registrar: dónde es puntualmente y si es difuso]\n\nIrradiación/Referencia\n[Cómo preguntarlo: ¿El síntoma se mueve a otra zona, hay hormigueo o adormecimiento?]\n\nCarácter/Naturaleza del síntoma\n[Cómo preguntarlo: ¿Cómo se siente: punzante, opresivo, quemazón, corriente, tirantez?]\n\nIntensidad\n[Qué registrar: actual, peor 24h, mejor 24h y en qué actividad o movimiento]\n\nAtenuantes y agravantes\n[Cómo preguntarlo: ¿Qué cosas mejoran o empeoran el síntoma?]\n\nComportamiento 24h y despertar nocturno\n[Cómo preguntarlo: ¿Cómo varía en el día y si lo despierta de noche?]\n\nSeveridad funcional\n[Qué registrar: qué limita exactamente y cuánto impacta en la vida diaria]\n\nIrritabilidad\n[Cómo preguntarlo: ¿Qué tan fácil se gatilla, cuánto demora en calmarse y qué queda después?]\n\nHistoria del episodio y mecanismo\n[Qué registrar: historia de episodios previos y cómo ocurrió el actual si aplica]\n\nManejo previo y respuesta\n[Qué registrar: qué intentó hacer/tomar y cómo le fue con eso]\n\nSeguridad clínica\n[Qué registrar: mencionar descartes o alertas que la persona haya dicho]\n\nNotas libres relevantes\n[Qué registrar: observaciones extra]\n`;
                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: (interviewV4.experienciaPersona.relatoLibre || "") + (interviewV4.experienciaPersona.relatoLibre ? "\n\n" : "") + template } });
                                }}
                                className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1.5 rounded font-bold shadow-sm hover:bg-indigo-100 transition-colors flex items-center gap-1"
                            >
                                + Insertar plantilla
                            </button>
                            <button
                                disabled={isClosed || !interviewV4.experienciaPersona.relatoLibre?.includes('[')}
                                onClick={(e) => {
                                    e.preventDefault();
                                    const cleanedText = (interviewV4.experienciaPersona.relatoLibre || "")
                                        .replace(/^\[.*?\]/gm, '')
                                        .replace(/\n{3,}/g, '\n\n')
                                        .trim();
                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: cleanedText } });
                                }}
                                className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1.5 rounded font-bold shadow-sm hover:bg-amber-100 transition-colors flex items-center gap-1"
                                title="Elimina las líneas de guía entre corchetes"
                            >
                                Limpiar guías
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); setShowRelatoGuide(!showRelatoGuide); }}
                                className={`text-[10px] px-2 py-1.5 rounded font-bold shadow-sm transition-colors border flex items-center gap-1 ${showRelatoGuide ? 'bg-slate-700 text-white border-slate-800' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                            >
                                Guía de entrevista (?)
                            </button>
                        </div>
                    </div>

                    {showRelatoGuide && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-700 overflow-y-auto max-h-80 shadow-inner">
                            <h4 className="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">Guía Clínica Extendida (Sin IA)</h4>
                            <div className="space-y-4">
                                <div>
                                    <strong className="text-indigo-800">Motivo de consulta:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Qué te trae por aquí hoy?" / "Cuéntame con tus propias palabras qué está pasando."</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Asumir el diagnóstico del derivador sin escuchar a la persona primero.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Revela la prioridad número 1 del paciente, más enfocada en su narrativa que en la patología médica.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">Objetivo y expectativa:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Qué esperas lograr con las sesiones?" / "Si esto saliera perfecto, ¿qué estarías haciendo en 1 mes?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Imponer metas biomecánicas (ej: "lograr 90° de flexión") en vez de metas participativas ("poder alzar a mi hijo").</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Define la brújula del tratamiento y establece el contrato terapéutico inicial.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Antigüedad/Inicio y evolución:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Cuándo empezó esto exactamente?" / "¿Y desde ese día ha ido mejorando, empeorando o sigue igual?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Quedarse con "duele hace rato" sin indagar si el patrón es constante o episódico.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Diferencia fase inflamatoria aguda vs estado persistente/nociplástico.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Localización y extensión:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Puedes apuntar con un dedo dónde duele más?" / "¿Se siente profundo o superficial?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Creer siempre que "donde duele, está la lesión" sin testear distalmente.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Apunta a tejidos generadores de síntomas (ej: puntual = fascia/ligamento; difuso = muscular/nervioso).</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Irradiación/Referencia:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿El dolor viaja o se mueve a otra zona?" / "¿Sientes adormecimiento o corriente en otra parte de la pierna/brazo?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Confundir dolor irradiado radicular con dolor somático referido (el segundo rara vez cruza la rodilla/codo de forma eléctrica).</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Permite detectar posible involucramiento del tejido neural periférico o central.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Carácter/Naturaleza:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Cómo describirías la sensación: como una punzada, quemazón, peso, corrientazo?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Inducir la respuesta dando solo una opción ("¿Te quema, cierto?").</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Sugiere neurodinamia patológica (quemazón, eléctrico), nociceptivo inflamatorio (latido, presión) o mecánico (punzada, pellizco al mover).</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Intensidad:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "De 0 a 10, ¿cuánto te duele ahora? ¿cuánto ha sido lo peor y cuánto lo mejor en las últimas 24h?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Obsesionarse solo con el número sin darle contexto (un 8 post-maratón no es igual a un 8 sentado en reposo).</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Permite medir tolerancias y la necesidad de priorizar control analgésico por sobre cargas.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">ALICIA — Atenuantes y agravantes:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Hay algo exacto que hagas para que el dolor empeore/mejore?" / "¿Caminar te duele pero andar en bici no?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Asumir que "todo" movimiento duele igual; no explorar posiciones de alivio.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Fundamental para prescribir ejercicio y determinar el mecanismo (tensión, compresión, fricción).</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">S.I.N.S — Comportamiento 24h:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Cómo se comporta el síntoma desde que despiertas hasta que vas a dormir?" / "¿Te despierta por la noche?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Ignorar dolor nocturno incesante real que no cambia de posición (Red Flag).</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Patrón AM de rigidez {'>'}30m sugiere inflamación sistémica. Fatiga PM sugiere ineficiencia muscular.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">S.I.N.S — Severidad funcional:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿A qué porcentaje de tu máximo sientes que rindes hoy?" / "¿Qué dejaste de hacer en tu día a día?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Basar el alta o progresión en el dolor (0/10) mientras ignoras la pobre funcionalidad restaurada.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Refleja el impacto en la vida real. Alto dolor no siempre equivale a alta severidad si el paciente no restringe actividades.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">S.I.N.S — Irritabilidad:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Con qué facilidad empieza a doler, qué tan fuerte es y cuánto demora en desaparecer cuando te detienes?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Provocar máximo dolor en la sesión de evaluación a un tejido irritable solo "para ver si da positivo el test".</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Exige dosificar rigor evaluativo (Alta = menos test mecánicos agresivos, énfasis en descarga).</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">Historia del episodio / Mecanismo:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Habías tenido esto igual en el pasado?" / "¿Recuerdas la posición de tu rodilla cuando caíste?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> No indagar los picos inusuales de carga en la semana previa al inicio de síntomas de "aparición progresiva".</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Determina pronóstico (episodios recurrentes sanan más lento) e infiere la carga lesiva exacta.</li>
                                    </ul>
                                </div>
                                <div className="border-t border-slate-200 pt-2">
                                    <strong className="text-indigo-800">Manejo previo y respuesta:</strong>
                                    <ul className="list-disc ml-4 space-y-1 mt-1 text-[11px]">
                                        <li><strong>Cómo preguntarlo:</strong> "¿Has ido a otro profesional o tomado medicación por esto? ¿Resultó?"</li>
                                        <li><strong className="text-rose-600">Qué NO hacer:</strong> Repetir la misma terapia pasiva que la persona ya te dijo que no le hizo efecto hace un mes.</li>
                                        <li><strong className="text-emerald-700">Qué significa clínicamente:</strong> Modula las creencias y expectativas, e ilumina vías de tratamiento que es mejor abandonar.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isExpertMode && !showRelatoGuide && (
                        <div className="bg-indigo-50/50 border-l-2 border-indigo-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 text-justify leading-relaxed">
                            <p>Escriba aquí todo el relato libre directamente o use el botón <strong>"+ Insertar plantilla"</strong> para insertar una estructura base guiada. La IA requiere este campo para extraer el JSON final.</p>
                        </div>
                    )}

                    {/* FASE 8: Overlay para Resaltado Exacto */}
                    <div className="relative w-full">
                        <textarea
                            id="relato-libre-textarea"
                            rows={12}
                            placeholder="Relato clínico de la persona en consulta..."
                            className="w-full text-xs p-3 border border-slate-300 rounded outline-none resize-y leading-relaxed bg-slate-50 focus:bg-white focus:border-indigo-400 transition-colors relative z-10"
                            style={highlightTexts.length > 0 ? { color: 'transparent', caretColor: 'black' } : {}}
                            value={interviewV4.experienciaPersona.relatoLibre || ""}
                            onChange={e => {
                                updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: e.target.value } });
                                if (highlightTexts.length > 0) setHighlightTexts([]); // Clear highlights on user edit
                            }}
                            disabled={isClosed}
                        />
                        {highlightTexts.length > 0 && (() => {
                            const text = interviewV4.experienciaPersona.relatoLibre || "";
                            // Regex escape and exact match for ALL highlights
                            const escapedHighlights = highlightTexts.map(h => h.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                            const regexPattern = `(${escapedHighlights.join('|')})`;
                            const parts = text.split(new RegExp(regexPattern, 'g'));

                            return (
                                <div
                                    className="absolute top-0 left-0 w-full h-full text-xs p-3 border border-transparent rounded whitespace-pre-wrap leading-relaxed overflow-hidden z-0 pointer-events-none"
                                    aria-hidden="true"
                                >
                                    {parts.map((p, i) => (
                                        highlightTexts.includes(p)
                                            ? <mark key={i} className="bg-emerald-300 text-emerald-900 font-bold rounded px-0.5 shadow-sm transition-all duration-300 ring-2 ring-emerald-400">{p}</mark>
                                            : <span key={i} className="text-slate-400">{p}</span>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* 3. Seguridad clínica (rojas y naranjas) */}
                <div id="section-seguridad" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-rose-600 text-white font-bold text-[10px]">3</span>
                        <h3 className="font-bold text-slate-800 text-sm">Seguridad clínica (pasada rápida)</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.fiebre_sistemico_cancerPrevio} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, fiebre_sistemico_cancerPrevio: e.target.checked } })} />
                            <span className="leading-tight">Fiebre / Compromiso Sistémico / Cáncer Previo</span>
                        </label>
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.bajaPeso_noIntencionada} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, bajaPeso_noIntencionada: e.target.checked } })} />
                            <span className="leading-tight">Baja de peso progresiva inexplicada</span>
                        </label>
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, dolorNocturno_inexplicable_noMecanico: e.target.checked } })} />
                            <span className="leading-tight">Dolor nocturno constante e inexplicable</span>
                        </label>
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.trauma_altaEnergia_caidaImportante} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, trauma_altaEnergia_caidaImportante: e.target.checked } })} />
                            <span className="leading-tight">Trauma alta energía / Caída importante</span>
                        </label>
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, neuroGraveProgresivo_esfinteres_sillaMontar: e.target.checked } })} />
                            <span className="leading-tight">Alt. esfínteres / Anestesia en silla montar</span>
                        </label>
                        <label className="flex items-start gap-2 text-[11px] p-2 bg-amber-50 border border-amber-100 rounded-lg hover:border-amber-300 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-amber-600 w-3.5 h-3.5" disabled={isClosed} checked={interviewV4.seguridad.riesgoEmocionalAgudo} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, riesgoEmocionalAgudo: e.target.checked } })} />
                            <span className="text-amber-900 font-medium leading-tight">Riesgo emocional agudo (Naranja)</span>
                        </label>
                    </div>

                    {/* Action Panel: Sólo aparece si hay Banderas Rojas marcadas explícitamente */}
                    {hasRedFlags && (
                        <div className="mt-4 p-4 bg-rose-50 border-2 border-rose-200 rounded-xl">
                            <h4 className="font-bold text-rose-800 text-sm mb-2 flex items-center gap-2">
                                <span>🚨</span> Detención Requerida: Bandera Roja Detectada
                            </h4>
                            <p className="text-xs text-rose-700 mb-3 font-medium">
                                Ha marcado un síntoma de alerta que requiere decisión clínica explícita para continuar.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${interviewV4.seguridad?.accionBanderaRoja === 'Derivar / cerrar caso' ? 'bg-rose-100 border-rose-600 text-rose-900 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <input
                                        type="radio"
                                        name="accionBanderaRoja"
                                        className="hidden"
                                        disabled={isClosed}
                                        checked={interviewV4.seguridad?.accionBanderaRoja === 'Derivar / cerrar caso'}
                                        onChange={() => updateV4({ seguridad: { ...interviewV4.seguridad, accionBanderaRoja: 'Derivar / cerrar caso' } })}
                                    />
                                    <span>Derivar / cerrar caso</span>
                                </label>
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${interviewV4.seguridad?.accionBanderaRoja === 'Continuar bajo supervisión' ? 'bg-orange-100 border-orange-600 text-orange-900 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <input
                                        type="radio"
                                        name="accionBanderaRoja"
                                        className="hidden"
                                        disabled={isClosed}
                                        checked={interviewV4.seguridad?.accionBanderaRoja === 'Continuar bajo supervisión'}
                                        onChange={() => updateV4({ seguridad: { ...interviewV4.seguridad, accionBanderaRoja: 'Continuar bajo supervisión' } })}
                                    />
                                    <span>Continuar bajo supervisión</span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                disabled={isClosed}
                                checked={interviewV4.seguridad?.confirmado || false}
                                onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, confirmado: e.target.checked } })}
                                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                            />
                            <span className="text-xs font-bold text-slate-700">Confirmo evaluación de seguridad (Obligatorio)</span>
                        </label>
                    </div>
                </div>

                {/* 4. Anclas mínimas */}
                <div id="section-anclas" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[10px]">4</span>
                        <h3 className="font-bold text-slate-800 text-sm">Anclas mínimas</h3>
                    </div>

                    <div className="flex flex-col gap-4">
                        {/* Row 1: Inicio, Antigüedad, Evolución */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-600">Inicio</label>
                                <select disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" value={focoPrincipal.inicio || "NoDefinido"} onChange={e => {
                                    const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, inicio: e.target.value as any } : f);
                                    updateV4({ focos: newFocos });
                                }}>
                                    <option value="NoDefinido">Seleccione...</option>
                                    <option value="Súbito">Súbito</option>
                                    <option value="Gradual">Gradual</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-600">Antigüedad Foco</label>
                                <select disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" value={focoPrincipal.antiguedad || ""} onChange={e => {
                                    const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, antiguedad: e.target.value } : f);
                                    updateV4({ focos: newFocos });
                                }}>
                                    <option value="">Seleccione...</option>
                                    <option value="<24hrs">{'< 24 horas'}</option>
                                    <option value="1-7 dias">1 a 7 días</option>
                                    <option value="1-4 semanas">1 a 4 semanas</option>
                                    <option value="1-3 meses">1 a 3 meses</option>
                                    <option value="3-6 meses">3 a 6 meses</option>
                                    <option value=">6 meses">{'> 6 meses'}</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-600">Evolución global</label>
                                <select disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" value={focoPrincipal.evolucion || "NoDefinido"} onChange={e => {
                                    const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, evolucion: e.target.value as any } : f);
                                    updateV4({ focos: newFocos });
                                }}>
                                    <option value="NoDefinido">Seleccione...</option>
                                    <option value="Mejorando">Mejorando</option>
                                    <option value="Estable">Igual / Estable</option>
                                    <option value="Empeorando">Empeorando</option>
                                    <option value="Fluctuante">Fluctuante</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 2: Actividad Índice */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600">Actividad índice principal</label>
                            <input type="text" disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50" placeholder="Ej. Bajar escaleras, dormir de lado, lanzar balón..." value={focoPrincipal.actividadIndice || ""} onChange={e => {
                                const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, actividadIndice: e.target.value } : f);
                                updateV4({ focos: newFocos });
                            }} />
                        </div>

                        {/* Lógica Condicional: Intensidad Actual y en Actividad si Duele/Hormiguea */}
                        {(() => {
                            const quejas = interviewV4.experienciaPersona.quejas || [];
                            const quejaOtro = interviewV4.experienciaPersona.quejaOtro?.toLowerCase() || "";
                            const hasPainOrTingle = quejas.includes('Dolor') || quejas.includes('Hormigueo/Adormecimiento') || quejaOtro.includes('dolor');
                            if (!hasPainOrTingle) return null;
                            return (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-red-50/50 border border-red-100 rounded-lg">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-red-800">Intensidad actual (0-10)</label>
                                        <input type="number" min={0} max={10} disabled={isClosed} className="text-center text-xs p-2.5 border border-red-200 rounded-lg outline-none bg-white font-bold text-slate-800" value={focoPrincipal.dolorActual ?? ""} onChange={e => {
                                            const val = e.target.value !== "" ? Number(e.target.value) : null;
                                            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, dolorActual: val } : f);
                                            updateV4({ focos: newFocos });
                                        }} placeholder="EVA/ENA" />
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-bold text-red-800">Intensidad en activ. índice</label>
                                        <input type="number" min={0} max={10} disabled={isClosed} className="text-center text-xs p-2.5 border border-red-200 rounded-lg outline-none bg-white font-bold text-slate-800" value={focoPrincipal.dolorActividadIndice ?? ""} onChange={e => {
                                            const val = e.target.value !== "" ? Number(e.target.value) : null;
                                            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, dolorActividadIndice: val } : f);
                                            updateV4({ focos: newFocos });
                                        }} placeholder="EVA/ENA" />
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Lógica Condicional: Despertar Nocturno */}
                        {(() => {
                            const quejas = interviewV4.experienciaPersona.quejas || [];
                            const quejaOtro = interviewV4.experienciaPersona.quejaOtro?.toLowerCase() || "";
                            const hasPainOrStiff = quejas.includes('Dolor') || quejas.includes('Rigidez') || quejaOtro.includes('dolor');
                            const isChronic = focoPrincipal.antiguedad === '1-3 meses' || focoPrincipal.antiguedad === '3-6 meses' || focoPrincipal.antiguedad === '>6 meses';
                            if (!(hasPainOrStiff && isChronic)) return null;
                            return (
                                <div className="flex items-center flex-wrap gap-4 border border-orange-200 bg-orange-50/50 p-3 rounded-lg">
                                    <label className="text-xs font-bold text-orange-900 flex-1 min-w-[200px]">¿Presenta despertar nocturno por el síntoma?</label>
                                    <div className="flex flex-wrap gap-4">
                                        <label className="flex items-center gap-1.5 text-xs font-bold bg-white px-3 py-1.5 rounded-md border border-orange-200 cursor-pointer"><input type="radio" disabled={isClosed} className="accent-orange-600" checked={focoPrincipal.patronTemporal.despiertaNoche === true} onChange={() => {
                                            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, patronTemporal: { ...f.patronTemporal, despiertaNoche: true } } : f);
                                            updateV4({ focos: newFocos });
                                        }} /> Sí</label>
                                        <label className="flex items-center gap-1.5 text-xs font-bold bg-white px-3 py-1.5 rounded-md border border-orange-200 cursor-pointer"><input type="radio" disabled={isClosed} className="accent-orange-600" checked={focoPrincipal.patronTemporal.despiertaNoche === false} onChange={() => {
                                            const newFocos = interviewV4.focos.map(f => f.id === focoPrincipal.id ? { ...f, patronTemporal: { ...f.patronTemporal, despiertaNoche: false } } : f);
                                            updateV4({ focos: newFocos });
                                        }} /> No</label>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* Row 3: Limitación Funcional */}
                        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <label className="text-xs font-bold text-slate-800">¿Hay limitación funcional actual?</label>
                                <div className="flex flex-wrap gap-3">
                                    <label className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border cursor-pointer transition-colors ${interviewV4.hayLimitacionFuncional ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}><input type="radio" disabled={isClosed} className="hidden" checked={interviewV4.hayLimitacionFuncional} onChange={() => updateV4({ hayLimitacionFuncional: true })} /> Sí, limita</label>
                                    <label className={`flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg border cursor-pointer transition-colors ${!interviewV4.hayLimitacionFuncional ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}><input type="radio" disabled={isClosed} className="hidden" checked={!interviewV4.hayLimitacionFuncional} onChange={() => updateV4({ hayLimitacionFuncional: false })} /> No, sin límite</label>
                                </div>
                            </div>

                            {interviewV4.hayLimitacionFuncional ? (
                                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-lg flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold text-indigo-800">Actividades PSFS (0=Incapaz, 10=Normal)</label>
                                        {interviewV4.psfsGlobal.length < 3 && (
                                            <button disabled={isClosed} onClick={(e) => {
                                                e.preventDefault();
                                                updateV4({ psfsGlobal: [...interviewV4.psfsGlobal, { id: generateId(), actividad: "", score: null, focoAsociado: focoPrincipal.id }] });
                                            }} className="text-[10px] bg-white border border-indigo-200 text-indigo-600 px-2 py-1 rounded shadow-sm font-bold hover:bg-indigo-50">+ Agregar</button>
                                        )}
                                    </div>
                                    {interviewV4.psfsGlobal.map((psfs, index) => (
                                        <div key={psfs.id} className="flex gap-2">
                                            <input type="text" disabled={isClosed} className="flex-1 text-xs p-2.5 border border-indigo-200 rounded-lg outline-none bg-white font-medium" placeholder={`Actividad limitada #${index + 1}`} value={psfs.actividad} onChange={e => {
                                                const newPsfs = [...interviewV4.psfsGlobal];
                                                newPsfs[index].actividad = e.target.value;
                                                updateV4({ psfsGlobal: newPsfs });
                                            }} />
                                            <input type="number" disabled={isClosed} min={0} max={10} className="w-16 text-center text-xs p-2.5 border border-indigo-200 rounded-lg outline-none bg-white font-bold" placeholder="0-10" value={psfs.score ?? ""} onChange={e => {
                                                const newPsfs = [...interviewV4.psfsGlobal];
                                                newPsfs[index].score = e.target.value !== "" ? Number(e.target.value) : null;
                                                updateV4({ psfsGlobal: newPsfs });
                                            }} />
                                            {index > 0 && (
                                                <button disabled={isClosed} onClick={(e) => {
                                                    e.preventDefault();
                                                    const newPsfs = [...interviewV4.psfsGlobal];
                                                    newPsfs.splice(index, 1);
                                                    updateV4({ psfsGlobal: newPsfs });
                                                }} className="text-xs text-rose-500 hover:text-rose-700 px-1 font-bold">✕</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-3 bg-teal-50/40 border border-teal-100 rounded-lg flex flex-col gap-2">
                                    <label className="text-[11px] font-bold text-teal-800">Capacidad percibida en actividad clave (0=Nula, 10=Óptima)</label>
                                    <input type="number" disabled={isClosed} min={0} max={10} className="w-full text-center text-xs p-2.5 border border-teal-200 rounded-lg outline-none bg-white font-bold text-slate-800" placeholder="Ej. 8" value={interviewV4.capacidadPercibidaActividad ?? ""} onChange={e => {
                                        updateV4({ capacidadPercibidaActividad: e.target.value !== "" ? Number(e.target.value) : null });
                                    }} />
                                </div>
                            )}
                        </div>

                        {/* Row 4: Contexto de las anclas */}
                        <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                            <label className="text-xs font-bold text-slate-800">Contexto principal afectado</label>
                            <div className="flex flex-wrap gap-2">
                                {['Vida diaria', 'Trabajo-Estudio', 'Deporte', 'Gimnasio'].map(ctx => {
                                    const isSelected = interviewV4.contextosAnclas?.includes(ctx);
                                    return (
                                        <button key={ctx} disabled={isClosed} onClick={(e) => {
                                            e.preventDefault();
                                            let current = interviewV4.contextosAnclas || [];
                                            const newCtx = isSelected ? current.filter(x => x !== ctx) : [...current, ctx];
                                            updateV4({ contextosAnclas: newCtx });
                                        }} className={`text-[11px] px-3 py-1.5 border rounded-lg transition-colors shadow-sm ${isSelected ? 'bg-slate-800 text-white border-slate-900 font-bold' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                            {ctx}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Row 5: Objetivos */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                            <div className="flex flex-col gap-1.5 sm:col-span-2">
                                <label className="text-xs font-bold text-slate-800">Objetivo de la persona usuaria</label>
                                <input type="text" disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" placeholder="Ej. Poder volver a correr 10k" value={interviewV4.objetivoPersona || ""} onChange={e => updateV4({ objetivoPersona: e.target.value })} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-bold text-slate-800">Plazo esperado</label>
                                <input type="text" disabled={isClosed} className="text-xs p-2.5 border border-slate-300 rounded-lg outline-none bg-slate-50 font-medium text-slate-700" placeholder="Ej. 1 mes, para el verano..." value={interviewV4.plazoEsperado || ""} onChange={e => updateV4({ plazoEsperado: e.target.value })} />
                            </div>
                        </div>
                    </div>

                </div>

                {/* 5. Faltantes Estructurales (Sin IA) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500 text-white font-bold text-[10px]">5</span>
                            <h3 className="font-bold text-slate-800 text-sm">Faltantes estructurales (Sin IA)</h3>
                        </div>
                        <button
                            onClick={(e) => {
                                e.preventDefault();

                                const list: Array<{ texto: string, link: string }> = [];

                                // 1. Chequeos de Anclas
                                if (!focoPrincipal?.inicio || focoPrincipal.inicio === "NoDefinido") list.push({ texto: "Falta Inicio (Anclas)", link: "section-anclas" });
                                if (!focoPrincipal?.antiguedad || focoPrincipal.antiguedad === "NoDefinido") list.push({ texto: "Falta Antigüedad Foco (Anclas)", link: "section-anclas" });
                                if (!focoPrincipal?.evolucion || focoPrincipal.evolucion === "NoDefinido") list.push({ texto: "Falta Evolución (Anclas)", link: "section-anclas" });
                                if (!focoPrincipal?.actividadIndice?.trim()) list.push({ texto: "Falta Actividad índice (Anclas)", link: "section-anclas" });

                                if (interviewV4.hayLimitacionFuncional) {
                                    const hasValidPsfs = interviewV4.psfsGlobal.some(p => p.actividad && p.actividad.trim() !== "" && p.score !== null);
                                    if (!hasValidPsfs) list.push({ texto: "Falta Actividad PSFS válida (Anclas)", link: "section-anclas" });
                                } else {
                                    if (interviewV4.capacidadPercibidaActividad === null || interviewV4.capacidadPercibidaActividad === undefined) list.push({ texto: "Falta Capacidad percibida (Anclas)", link: "section-anclas" });
                                }

                                if (!interviewV4.contextosAnclas || interviewV4.contextosAnclas.length === 0) list.push({ texto: "Falta Contexto afectado (Anclas)", link: "section-anclas" });
                                if (!interviewV4.objetivoPersona?.trim()) list.push({ texto: "Falta Objetivo de la persona (Anclas)", link: "section-anclas" });
                                if (!interviewV4.plazoEsperado?.trim()) list.push({ texto: "Falta Plazo esperado (Anclas)", link: "section-anclas" });

                                // 2. Chequeo de Seguridad
                                if (!interviewV4.seguridad?.confirmado) {
                                    list.push({ texto: "Falta confirmar Seguridad Clínica", link: "section-seguridad" });
                                }

                                // 3. Chequeo de Plantilla en Relato
                                const relato = interviewV4.experienciaPersona.relatoLibre || "";
                                const subtitulosPlantilla = [
                                    "Motivo de consulta",
                                    "Objetivo y expectativa",
                                    "ALICIA — Antigüedad/Inicio y evolución",
                                    "ALICIA — Localización (dónde) y extensión",
                                    "ALICIA — Irradiación/Referencia",
                                    "ALICIA — Carácter/Naturaleza del síntoma",
                                    "ALICIA — Intensidad",
                                    "ALICIA — Atenuantes y agravantes",
                                    "S.I.N.S — Comportamiento",
                                    "S.I.N.S — Severidad funcional",
                                    "S.I.N.S — Irritabilidad",
                                    "Historia del episodio",
                                    "Manejo previo y respuesta",
                                    "Seguridad clínica"
                                ];

                                const lineas = relato.split('\\n');

                                subtitulosPlantilla.forEach(sub => {
                                    const index = lineas.findIndex(l => l.includes(sub));
                                    if (index !== -1) {
                                        // Revisar las siguientes 1 a 2 lineas a ver si hay texto
                                        let tieneTexto = false;
                                        for (let i = 1; i <= 3; i++) {
                                            const sig = lineas[index + i];
                                            if (sig !== undefined && sig.trim().length > 2 && !subtitulosPlantilla.some(s => sig.includes(s))) {
                                                tieneTexto = true;
                                                break;
                                            }
                                        }
                                        if (!tieneTexto) {
                                            const corto = sub.split('—')[0].replace(' (dónde) y extensión', '').replace(' (qué quiere lograr y en qué plazo)', '').replace(' (palabras de la persona usuaria)', '').trim();
                                            list.push({ texto: `Falta llenar en relato: ${corto}`, link: "section-relato" });
                                        }
                                    }
                                });

                                // Truncar a 12 items
                                const final = list.slice(0, 12);

                                // Store output into state for render
                                updateV4({ faltantesEstructuralesPanel: final } as any);
                            }}
                            className="bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 transition-colors font-bold text-xs py-2 px-4 rounded-lg shadow-sm flex items-center gap-2"
                        >
                            <span>🔍 Ver faltantes</span>
                        </button>
                    </div>

                    {(interviewV4 as any).faltantesEstructuralesPanel && (
                        <div className="mt-4 pt-3 border-t border-slate-200">
                            {((interviewV4 as any).faltantesEstructuralesPanel as any[]).length === 0 ? (
                                <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg text-xs font-medium flex items-center gap-2">
                                    <span>✅</span> No se detectaron campos estructurales vacíos.
                                </div>
                            ) : (
                                <ul className="space-y-2">
                                    {((interviewV4 as any).faltantesEstructuralesPanel as any[]).map((f, i) => (
                                        <li key={i} className="flex items-center justify-between text-xs bg-white border border-slate-100 p-2 rounded-lg shadow-sm">
                                            <span className="text-rose-600 font-medium">⚠️ {f.texto}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    document.getElementById(f.link)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                    // highlight animation could be added here
                                                }}
                                                className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded transition-colors"
                                            >
                                                Ir a sección
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>

                {/* 6. Procesar con IA */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-700 text-white font-bold text-[10px]">6</span>
                        <h3 className="font-bold text-purple-900 text-sm">Procesar con Inteligencia Artificial</h3>
                    </div>

                    <button
                        onClick={async (e) => {
                            e.preventDefault();
                            setIsProcessingAI(true);
                            try {
                                const payload = {
                                    interviewV4: interviewV4
                                };
                                const response = await fetch('/api/ai/fase7-extract', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(payload)
                                });
                                const data = await response.json();

                                if (response.ok && data) {
                                    updateV4({
                                        analisisIA: data,
                                        confirmacionesCriticas: {
                                            irritabilidad_global: { estado: 'Pendiente' },
                                            naturaleza_sugerida: { estado: 'Pendiente' },
                                            hipotesis_orientativas: { estado: 'Pendiente' }
                                        }
                                    } as any);
                                } else {
                                    console.error("Error from AI:", data);
                                    alert("Error en la extracción IA: " + (data.error || "Desconocido"));
                                }
                            } catch (err: any) {
                                console.error("Fetch error:", err);
                                alert("Error servidor: " + err.message);
                            } finally {
                                setIsProcessingAI(false);
                            }
                        }}
                        disabled={isClosed || isProcessingAI}
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold py-4 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-purple-800"
                    >
                        {isProcessingAI ? (
                            <><span className="animate-spin text-sm">⏳</span> Analizando datos con IA (Puede tomar unos segundos)...</>
                        ) : (
                            <><span>🧠</span> IA: Ordenar y extraer (Strict Mode)</>
                        )}
                    </button>

                    {/* FASE 13: Botones Opcionales Rápidos */}
                    <div className="flex flex-col sm:flex-row gap-3 mt-3">
                        <button
                            onClick={async (e) => {
                                e.preventDefault();
                                if (!interviewV4.experienciaPersona.relatoLibre?.trim()) {
                                    alert("El relato libre está vacío. Especifique detalles antes de preguntar a la IA.");
                                    return;
                                }
                                setIsProcessingPreguntasIA(true);
                                try {
                                    const payload = { interviewV4 };
                                    const response = await fetch('/api/ai/f13-preguntas', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    const data = await response.json();
                                    if (response.ok && data) {
                                        updateV4({
                                            analisisIA: {
                                                ...(interviewV4.analisisIA || {}),
                                                preguntas_faltantes: data.preguntas_faltantes
                                            }
                                        } as any);
                                    } else {
                                        alert("Error en la extracción IA: " + (data.error || "Desconocido"));
                                    }
                                } catch (err: any) {
                                    alert("Error servidor: " + err.message);
                                } finally {
                                    setIsProcessingPreguntasIA(false);
                                }
                            }}
                            disabled={isClosed || isProcessingPreguntasIA || isProcessingAI}
                            className="flex-1 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 text-[11px] font-bold py-2.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessingPreguntasIA ? (
                                <><span className="animate-spin text-sm">⏳</span> Preguntando...</>
                            ) : (
                                <><span>❓</span> IA: Preguntas faltantes (máx 5)</>
                            )}
                        </button>

                        <button
                            onClick={async (e) => {
                                e.preventDefault();
                                if (!interviewV4.experienciaPersona.relatoLibre?.trim()) {
                                    alert("El relato libre está vacío. Especifique detalles antes de preguntar a la IA.");
                                    return;
                                }
                                setIsProcessingExamenIA(true);
                                try {
                                    const payload = { interviewV4 };
                                    const response = await fetch('/api/ai/f13-examen', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    const data = await response.json();
                                    if (response.ok && data) {
                                        updateV4({
                                            analisisIA: {
                                                ...(interviewV4.analisisIA || {}),
                                                sugerencias_examen_fisico_P2: data.sugerencias_examen_fisico_P2
                                            }
                                        } as any);
                                    } else {
                                        alert("Error en la extracción IA: " + (data.error || "Desconocido"));
                                    }
                                } catch (err: any) {
                                    alert("Error servidor: " + err.message);
                                } finally {
                                    setIsProcessingExamenIA(false);
                                }
                            }}
                            disabled={isClosed || isProcessingExamenIA || isProcessingAI}
                            className="flex-1 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300 text-[11px] font-bold py-2.5 px-3 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                        >
                            {isProcessingExamenIA ? (
                                <><span className="animate-spin text-sm">⏳</span> Sugiriendo...</>
                            ) : (
                                <><span>🩺</span> IA: Sugerir examen físico (P2)</>
                            )}
                        </button>
                    </div>

                    {/* Salida IA de FASE 7 y Renderizado FASE 8 */}
                    {interviewV4.analisisIA && (
                        <div className="mt-4 flex flex-col gap-4">

                            {/* FASE 12: Banner de No Definitivo */}
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 font-medium">
                                <span>ℹ️</span>
                                <span><strong>Modo Sugerencia:</strong> Toda esta extracción es una hipótesis generada para ser validada en P2/P3. Nada está fijado como diagnóstico definitivo en esta etapa.</span>
                            </div>

                            {/* FASE 11: La alerta de seguridad se ha movido al bloque final de confirmaciones críticas */}

                            {/* 1. Resúmenes Editables */}
                            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">📝 Resumen Clínico (Editable)</span>
                                </div>
                                <div className="p-3">
                                    <textarea
                                        disabled={isClosed}
                                        rows={4}
                                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors leading-relaxed text-slate-700"
                                        value={interviewV4.analisisIA.resumen_clinico || ""}
                                        onChange={e => updateV4({ analisisIA: { ...interviewV4.analisisIA!, resumen_clinico: e.target.value } })}
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">🗣️ Resumen para la Persona Usuaria (Editable)</span>
                                </div>
                                <div className="p-3 flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Lo que entendí:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.analisisIA.resumen_persona_usuaria?.lo_que_entiendi || ""} onChange={e => updateV4({ analisisIA: { ...interviewV4.analisisIA!, resumen_persona_usuaria: { ...interviewV4.analisisIA!.resumen_persona_usuaria, lo_que_entiendi: e.target.value } } })} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Lo que te preocupa:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.analisisIA.resumen_persona_usuaria?.lo_que_te_preocupa || ""} onChange={e => updateV4({ analisisIA: { ...interviewV4.analisisIA!, resumen_persona_usuaria: { ...interviewV4.analisisIA!.resumen_persona_usuaria, lo_que_te_preocupa: e.target.value } } })} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Lo que haremos ahora:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.analisisIA.resumen_persona_usuaria?.lo_que_haremos_ahora || ""} onChange={e => updateV4({ analisisIA: { ...interviewV4.analisisIA!, resumen_persona_usuaria: { ...interviewV4.analisisIA!.resumen_persona_usuaria, lo_que_haremos_ahora: e.target.value } } })} />
                                    </div>
                                </div>
                            </div>

                            {/* Función Helper para las Tarjetas */}
                            {(() => {
                                const handleHighlight = (evidencia: string) => {
                                    if (!evidencia || evidencia === "No_mencionado") return;

                                    const relatoRaw = interviewV4.experienciaPersona.relatoLibre || "";
                                    if (relatoRaw.indexOf(evidencia) === -1) {
                                        alert("No se pudo resaltar: cita no encontrada");
                                        return;
                                    }

                                    setHighlightTexts(prev => prev.includes(evidencia) ? prev.filter(e => e !== evidencia) : [...prev, evidencia]);

                                    // Scroll to the relato textarea
                                    const textarea = document.getElementById("relato-libre-textarea");
                                    if (textarea) {
                                        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                };

                                const renderTarjeta = (titulo: string, data: any, key: string) => {
                                    if (!data) return null;
                                    const hasEvidencia = data.evidencia_textual && data.evidencia_textual !== "No_mencionado";
                                    return (
                                        <div key={key} className="bg-white border border-slate-200 rounded-lg p-3 flex flex-col justify-between hover:shadow-md transition-shadow">
                                            <div>
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{titulo.replace(/_/g, ' ')}</h4>
                                                    {data.origen && (
                                                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold">{data.origen}</span>
                                                    )}
                                                </div>
                                                <p className={`text-xs font-semibold ${data.valor === 'No_mencionado' ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                                                    {data.valor}
                                                </p>
                                            </div>
                                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                <span className={`text-[9px] truncate max-w-[60%] ${hasEvidencia ? 'text-slate-500 italic' : 'text-slate-300'}`}>
                                                    {hasEvidencia ? `"${data.evidencia_textual}"` : 'Sin evidencia directa'}
                                                </span>
                                                <button
                                                    disabled={!hasEvidencia}
                                                    onClick={(e) => { e.preventDefault(); handleHighlight(data.evidencia_textual); }}
                                                    className={`text-[9px] font-bold px-2 py-1 rounded transition-colors ${!hasEvidencia ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : highlightTexts.includes(data.evidencia_textual) ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'}`}
                                                    title={hasEvidencia ? "Ver en texto original" : "No hay cita exacta para resaltar"}
                                                >
                                                    {highlightTexts.includes(data.evidencia_textual) ? '👁️ Quitar' : '👁️ Resaltar'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {/* 2. ALICIA */}
                                        {interviewV4.analisisIA.ALICIA && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                                    <span className="text-xs font-bold text-slate-700">🔎 A.L.I.C.I.A (Extraído)</span>
                                                </div>
                                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
                                                    {Object.entries(interviewV4.analisisIA.ALICIA).map(([key, val]) => {
                                                        if (key === 'intensidad' && val) {
                                                            // Handle nested intensidad object specially if needed, or map its subkeys
                                                            return Object.entries(val).map(([subKey, subVal]) => renderTarjeta(`Intensidad: ${subKey}`, subVal, `alicia-int-${subKey}`));
                                                        }
                                                        return renderTarjeta(key, val, `alicia-${key}`);
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* 3. SINS */}
                                        {interviewV4.analisisIA.SINS && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 flex justify-between items-center">
                                                    <span className="text-xs font-bold text-slate-700">⚖️ S.I.N.S (Sugerido/Calculado)</span>
                                                </div>
                                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
                                                    {renderTarjeta("Severidad", interviewV4.analisisIA.SINS.severidad, "sins-sev")}
                                                    {renderTarjeta("Naturaleza Sugerida", interviewV4.analisisIA.SINS.naturaleza_sugerida, "sins-nat")}
                                                    {renderTarjeta("Etapa", interviewV4.analisisIA.SINS.etapa, "sins-etapa")}

                                                    {/* Irritabilidad (Nested) */}
                                                    {interviewV4.analisisIA.SINS.irritabilidad && (
                                                        <div className="col-span-1 sm:col-span-2 bg-white border border-rose-100 rounded-lg p-3">
                                                            <div className="flex justify-between items-center mb-2 border-b border-rose-50 pb-2">
                                                                <h4 className="text-[11px] font-bold text-rose-800">Irritabilidad Global: {interviewV4.analisisIA.SINS.irritabilidad.irritabilidad_global?.valor || "Desconocida"}</h4>
                                                                <p className="text-[9px] text-rose-600 max-w-[60%] text-right italic">{interviewV4.analisisIA.SINS.irritabilidad.explicacion}</p>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {renderTarjeta("Facilidad Provocación", interviewV4.analisisIA.SINS.irritabilidad.facilidad_provocacion, "irr-fac")}
                                                                {renderTarjeta("Momento Aparición", interviewV4.analisisIA.SINS.irritabilidad.momento_aparicion, "irr-mom")}
                                                                {renderTarjeta("Tiempo a Calmarse", interviewV4.analisisIA.SINS.irritabilidad.tiempo_a_calmarse, "irr-tie")}
                                                                {renderTarjeta("Efecto Posterior (After-efecto)", interviewV4.analisisIA.SINS.irritabilidad.after_efecto, "irr-aft")}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* 4. Extracción General */}
                                        {interviewV4.analisisIA.extraccion_general && (
                                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                                    <span className="text-xs font-bold text-slate-700">📋 Datos Generales (Extraído)</span>
                                                </div>
                                                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
                                                    {Object.entries(interviewV4.analisisIA.extraccion_general).map(([key, val]) => {
                                                        if (key === 'banderas_amarillas_orientativas') return null; // Handle separately or skip
                                                        return renderTarjeta(key, val, `gen-${key}`);
                                                    })}
                                                </div>

                                                {/* Banderas amarillas orientativas */}
                                                {interviewV4.analisisIA.extraccion_general.banderas_amarillas_orientativas && interviewV4.analisisIA.extraccion_general.banderas_amarillas_orientativas.length > 0 && (
                                                    <div className="px-3 pb-3">
                                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                                                            <strong className="text-[10px] text-yellow-800 uppercase block mb-1">Posibles Banderas Amarillas Mencionadas:</strong>
                                                            <ul className="list-disc pl-4 text-[10px] text-yellow-700">
                                                                {interviewV4.analisisIA.extraccion_general.banderas_amarillas_orientativas.map((b, i) => <li key={i}>{b}</li>)}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 5. Listas Estáticas (Hipótesis, Preguntas, Examen) */}
                                        {interviewV4.analisisIA.hipotesis_orientativas_por_sistema && interviewV4.analisisIA.hipotesis_orientativas_por_sistema.length > 0 && (
                                            <div className="bg-indigo-50/30 rounded-xl shadow-sm border border-indigo-100 p-3">
                                                <h4 className="text-xs font-bold text-indigo-800 mb-2">💡 Hipótesis Orientativas</h4>
                                                <div className="space-y-2">
                                                    {interviewV4.analisisIA.hipotesis_orientativas_por_sistema.map((h, i) => (
                                                        <div key={i} className="bg-white p-2 rounded border border-indigo-50 flex flex-col gap-1">
                                                            <div className="flex justify-between items-start">
                                                                <strong className="text-[11px] text-indigo-900">{h.nombre}</strong>
                                                                <button onClick={(e) => { e.preventDefault(); handleHighlight(h.evidencia_textual); }} className={`text-[8px] px-1 py-0.5 rounded transition-colors flex items-center gap-1 ${highlightTexts.includes(h.evidencia_textual) ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>👁️ {highlightTexts.includes(h.evidencia_textual) ? 'Quitar' : 'Resaltar'}</button>
                                                            </div>
                                                            <p className="text-[10px] text-indigo-700 leading-relaxed">{h.explicacion}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {interviewV4.analisisIA.preguntas_faltantes && interviewV4.analisisIA.preguntas_faltantes.length > 0 && (
                                            <div className="bg-amber-50/30 rounded-xl shadow-sm border border-amber-100 p-3">
                                                <h4 className="text-xs font-bold text-amber-800 mb-2">❓ Preguntas Faltantes (Sugeridas)</h4>
                                                <div className="space-y-2">
                                                    {interviewV4.analisisIA.preguntas_faltantes.map((p, i) => (
                                                        <div key={i} className="bg-white p-2 rounded border border-amber-50 flex flex-col gap-1">
                                                            <strong className="text-[11px] text-amber-900">Falta: {p.tema_faltante}</strong>
                                                            <p className="text-[10px] text-slate-600"><em>Ejemplo: "{p.como_preguntarlo}"</em></p>
                                                            <p className="text-[9px] text-amber-700 mt-1 border-t border-amber-50 pt-1"><strong>Por qué:</strong> {p.por_que_importa}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {interviewV4.analisisIA.sugerencias_examen_fisico_P2 && interviewV4.analisisIA.sugerencias_examen_fisico_P2.length > 0 && (
                                            <div className="bg-teal-50/30 rounded-xl shadow-sm border border-teal-100 p-3 mb-2">
                                                <h4 className="text-xs font-bold text-teal-800 mb-2">🩺 Sugerencias Examen Físico (Paso 2)</h4>
                                                <div className="space-y-2">
                                                    {interviewV4.analisisIA.sugerencias_examen_fisico_P2.map((s, i) => (
                                                        <div key={i} className="bg-white p-2 rounded border border-teal-50 flex items-start gap-2">
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded text-white mt-0.5 ${s.objetivo === 'confirmar' ? 'bg-emerald-500' : s.objetivo === 'descartar' ? 'bg-rose-500' : 'bg-blue-500'}`}>
                                                                {s.objetivo.substring(0, 4).toUpperCase()}
                                                            </span>
                                                            <div className="flex-1">
                                                                <strong className="text-[11px] text-teal-900 block">{s.paso}</strong>
                                                                <p className="text-[10px] text-teal-700 leading-tight">{s.por_que}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}

                            {/* Raw JSON Debug View */}
                            <details className="mt-2 bg-slate-900 rounded-xl shadow-inner border border-slate-700">
                                <summary className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center cursor-pointer outline-none select-none text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors">
                                    <span>Ver JSON Crudo (Developer)</span>
                                </summary>
                                <pre className="p-3 whitespace-pre-wrap font-mono text-[11px] text-blue-300 overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
                                    {JSON.stringify(interviewV4.analisisIA, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>

                {/* 7. Confirmaciones críticas */}
                {interviewV4.analisisIA && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-2 mb-2 w-full">
                            <span className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-600 text-white font-bold text-xs">7</span>
                            <h3 className="font-black text-slate-800 text-base">Confirmaciones críticas de IA</h3>
                        </div>

                        <div className="flex flex-col gap-3">
                            {/* Factory for Confirmation Rows */}
                            {(() => {
                                const renderConfRow = (
                                    keyID: 'irritabilidad_global' | 'naturaleza_sugerida' | 'hipotesis_orientativas',
                                    title: string,
                                    iaValue: string,
                                    showIf: boolean = true
                                ) => {
                                    if (!showIf) return null;
                                    const confState = interviewV4.confirmacionesCriticas?.[keyID] || { estado: 'Pendiente' };

                                    return (
                                        <div key={keyID} className={`p-3 rounded-lg border flex flex-col gap-2 transition-colors ${confState.estado === 'De acuerdo' ? 'bg-emerald-50 border-emerald-200' : confState.estado === 'Editado' ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}>
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{title}</span>
                                                    <span className="text-sm font-bold text-slate-800">{iaValue}</span>
                                                </div>
                                                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                                                    <button
                                                        disabled={isClosed}
                                                        onClick={(e) => { e.preventDefault(); updateV4({ confirmacionesCriticas: { ...interviewV4.confirmacionesCriticas as any, [keyID]: { ...confState, estado: 'De acuerdo' } } }); }}
                                                        className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${confState.estado === 'De acuerdo' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        De acuerdo
                                                    </button>
                                                    <button
                                                        disabled={isClosed}
                                                        onClick={(e) => { e.preventDefault(); updateV4({ confirmacionesCriticas: { ...interviewV4.confirmacionesCriticas as any, [keyID]: { ...confState, estado: 'Editado' } } }); }}
                                                        className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${confState.estado === 'Editado' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        disabled={isClosed}
                                                        onClick={(e) => { e.preventDefault(); updateV4({ confirmacionesCriticas: { ...interviewV4.confirmacionesCriticas as any, [keyID]: { ...confState, estado: 'Pendiente' } } }); }}
                                                        className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all ${confState.estado === 'Pendiente' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
                                                    >
                                                        Pendiente
                                                    </button>
                                                </div>
                                            </div>

                                            {confState.estado === 'Editado' && (
                                                <div className="mt-2 pt-2 border-t border-blue-100/50 flex flex-col sm:flex-row gap-2">
                                                    <input
                                                        type="text"
                                                        disabled={isClosed}
                                                        placeholder="Nuevo valor..."
                                                        value={confState.valorEditado || ""}
                                                        onChange={(e) => updateV4({ confirmacionesCriticas: { ...interviewV4.confirmacionesCriticas as any, [keyID]: { ...confState, valorEditado: e.target.value } } })}
                                                        className="flex-1 text-xs p-2 border border-blue-200 rounded outline-none focus:border-blue-500"
                                                    />
                                                    <input
                                                        type="text"
                                                        disabled={isClosed}
                                                        placeholder="Breve justificación (1 línea)..."
                                                        value={confState.justificacion || ""}
                                                        onChange={(e) => updateV4({ confirmacionesCriticas: { ...interviewV4.confirmacionesCriticas as any, [keyID]: { ...confState, justificacion: e.target.value } } })}
                                                        className="flex-2 text-xs p-2 border border-blue-200 rounded outline-none focus:border-blue-500"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    );
                                };

                                return (
                                    <>
                                        {/* 1. Irritabilidad Global */}
                                        {renderConfRow(
                                            'irritabilidad_global',
                                            'SINS: Irritabilidad Global',
                                            String(interviewV4.analisisIA?.SINS?.irritabilidad?.irritabilidad_global?.valor || "Desconocida"),
                                            !!interviewV4.analisisIA?.SINS?.irritabilidad
                                        )}

                                        {/* 2. Naturaleza Sugerida */}
                                        {renderConfRow(
                                            'naturaleza_sugerida',
                                            'SINS: Naturaleza Sugerida',
                                            String(interviewV4.analisisIA?.SINS?.naturaleza_sugerida?.valor || "Desconocida"),
                                            !!interviewV4.analisisIA?.SINS?.naturaleza_sugerida
                                        )}

                                        {/* 3. Hipotesis Orientativas */}
                                        {renderConfRow(
                                            'hipotesis_orientativas',
                                            'Hipótesis Orientativas por Sistema',
                                            `${interviewV4.analisisIA?.hipotesis_orientativas_por_sistema?.length || 0} hipótesis generadas`,
                                            (interviewV4.analisisIA?.hipotesis_orientativas_por_sistema?.length || 0) > 0
                                        )}
                                    </>
                                );
                            })()}

                            {/* FASE 11: Mover aquí la alerta de contradicción (obligatoria) si existe */}
                            {hayContradiccionSeguridad && (
                                <div className="p-3 bg-orange-50 border-2 border-orange-400 rounded-lg shadow-sm">
                                    <div className="flex items-start gap-3">
                                        <div className="text-xl mt-0.5">⚠️</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-orange-900 text-xs mb-1">Alerta de Seguridad por Contradicción (Obligatoria)</h4>
                                            <p className="text-[10px] text-orange-800 mb-2">
                                                IA Extrajo: "{interviewV4.analisisIA.extraccion_general?.seguridad_mencionada_en_relato?.valor}"
                                            </p>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={(e) => { e.preventDefault(); document.getElementById("section-seguridad")?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                                                    className="flex-1 bg-white border border-slate-300 text-slate-700 font-bold text-[10px] p-1.5 rounded shadow-sm hover:bg-slate-50 transition-colors"
                                                >
                                                    ⬆️ Marcar en checklist
                                                </button>
                                                <div className="flex-2 flex flex-col relative w-full sm:w-2/3">
                                                    <input
                                                        type="text"
                                                        disabled={isClosed}
                                                        placeholder="Descartar (explicar breve)..."
                                                        className="w-full text-[10px] p-2 border border-orange-300 rounded outline-none focus:border-orange-500 bg-white"
                                                        value={interviewV4.seguridad?.resolucionContradiccionIA?.explicacionDescarte || ""}
                                                        onChange={e => {
                                                            const text = e.target.value;
                                                            updateV4({
                                                                seguridad: {
                                                                    ...interviewV4.seguridad,
                                                                    resolucionContradiccionIA: { resuelto: text.trim().length > 3, explicacionDescarte: text }
                                                                }
                                                            });
                                                        }}
                                                    />
                                                    {interviewV4.seguridad?.resolucionContradiccionIA?.resuelto && (
                                                        <span className="absolute -top-1 -right-1 text-[8px] bg-emerald-100 text-emerald-800 border border-emerald-300 rounded px-1 font-bold shadow-sm">✅</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex justify-center w-full">
                            <button
                                onClick={handleCloseAnamnesis}
                                disabled={isClosed || !isValidForP2}
                                className={`w-full max-w-md font-black px-6 py-4 rounded-xl transition-all shadow-md text-sm uppercase tracking-wider border ${!isValidForP2
                                    ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-70'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 hover:shadow-lg hover:-translate-y-0.5'
                                    }`}
                            >
                                {isClosed ? '✓ FINALIZADA' : 'Confirmar e Ir a Exámenes P2'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
