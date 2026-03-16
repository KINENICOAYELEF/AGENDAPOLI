import React, { useState, useEffect, useCallback } from 'react';
import { EvaluacionInicial, AnamnesisProximaV4, FocoV4 } from '@/types/clinica';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { useYear } from "@/context/YearContext";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";


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

// Helper universal para extraer strings tanto de textos planos antiguos como de JSON estructurados nuevos
export const getFieldText = (input: any): string => {
    if (!input) return "";
    if (typeof input === 'string') return input === "No_mencionado" || input === "Pendiente" ? "" : input;
    if (typeof input === 'object') {
        const txt = input.valor || input.evidencia_textual || "";
        return txt === "No_mencionado" || txt === "Pendiente" ? "" : String(txt);
    }
    return "";
};

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
    const [showFocoGuide, setShowFocoGuide] = useState(false);
    const [focoGuideTab, setFocoGuideTab] = useState(0);
    const [showRelatoGuide, setShowRelatoGuide] = useState(false);

    // FASE 8 & 9: Highlight State (Multiple Highlight support)
    const [highlightTexts, setHighlightTexts] = useState<string[]>([]);
    
    // FASE 12: Bloqueo de IA
    const [aiBlockInfo, setAiBlockInfo] = useState<{isBlocked: boolean, reason?: string, telemetry?: any} | null>(null);

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
            causaPercibida: null, causaPercibidaOtro: "", autoeficaciaRecuperacion: null,
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

    const handleAISynthesis = async () => {
        const relatoLength = interviewV4.experienciaPersona.relatoLibre?.trim().length || 0;
        if (relatoLength < 10) {
            alert("El relato es demasiado corto o está vacío. Por favor escriba la historia clínica completa antes de solicitar el análisis a la IA.");
            return;
        }

        setIsProcessingAI(true);
        updateV4({ jsonExtractError: false } as any); // Limpiar error anterior

        try {
            // FASE 36: Enriquecer payload con Contexto Local Robustos (Sin getDoc inseguro)
            const snap = formData.remoteHistorySnapshot || {};
            
            const p1_context_for_ai = {
                // Identidad Básica (De existir en el snap o formData)
                nombre: (snap as any)?.identity?.fullName || "Usuaria",
                edad: (snap as any)?.identity?.edad || "No especificada",
                sexo: (snap as any)?.identity?.sexoRegistrado || "No especificado",
                
                // Contexto Ocupacional y Deportivo (Moduladores de carga)
                ocupacion: (snap as any)?.occupationalContext?.mainRole || "No especificada",
                deporte_basal: (snap as any)?.sportsContext?.mainSport || "No especificado",
                calidad_sueno: (snap as any)?.lifestyle?.sleepQuality || "No especificada",
                estres_percibido: (snap as any)?.lifestyle?.stressLevel || "No especificado",
                
                // Antecedentes MSK y Alertas
                antecedentes_msk_relevantes: (snap as any)?.medicalHistory?.previousInjuries || "No especificados",
                red_flags_basales: (snap as any)?.p15_context_flags || [],
                
                // Factores Contextuales (BPS)
                facilitadores: (snap as any)?.environmentalFactors?.facilitators || "No especificados",
                barreras: (snap as any)?.environmentalFactors?.barriers || "No especificadas",
                factores_personales: (snap as any)?.personalFactors?.positiveFactors || "No especificados",
                
                // Datos Estructurados de P1.5 (Si existen ya normalizados)
                p15_context_structured: (snap as any)?.p15_context_structured || null,
                p15_context_flags: (snap as any)?.p15_context_flags || []
            };

            console.log("🟦 [DEBUG IA P1] Usando contexto local/snapshot:", {
                hasRemoteHistory: !!formData.remoteHistorySnapshot,
                contextSources: ["interviewV4", "remoteHistorySnapshot"]
            });

            const payload = {
                interviewV4: interviewV4,
                remoteHistorySnapshot: formData.remoteHistorySnapshot,
                p1_context_for_ai: p1_context_for_ai
            };
            const response = await fetch('/api/ai/p1-synthesis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload })
            });
            const data = await response.json();

            if (response.ok && data.success) {
                const aiData = data.data;

                // Auto-hidratar Foco Principal Básico si viene en el JSON
                let updatedFocos = [...interviewV4.focos];
                if (updatedFocos.length > 0 && aiData.foco_principal) {
                    const f0 = { ...updatedFocos[0] };
                    if (aiData.foco_principal.region) f0.region = aiData.foco_principal.region;
                    if (aiData.foco_principal.lado) f0.lado = aiData.foco_principal.lado;
                    if (aiData.foco_principal.actividad_indice) f0.actividadIndice = aiData.foco_principal.actividad_indice;
                    updatedFocos[0] = f0;
                }

                updateV4({
                    jsonExtractError: false,
                    jsonExtractErrorMsg: null,
                    p1_ai_structured: aiData,
                    focos: updatedFocos
                } as any);

                if (data.telemetry) console.log("Telemetry P1:", data.telemetry);
                
            } else {
                console.error("Error from AI Synthesis:", data);
                updateV4({ 
                    jsonExtractError: true, 
                    jsonExtractErrorMsg: data.errDetails || data.error || "Fallo desconocido de la IA (Timeout o filtro seguro)." 
                } as any);
            }
        } catch (err: any) {
            console.error("Fetch error:", err);
            updateV4({ jsonExtractError: true } as any);
        } finally {
            setIsProcessingAI(false);
        }
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
            const sanitizedAutoSave = sanitizeForFirestoreDeep({
                interview: {
                    ...formData.interview,
                    v4: v4Data
                },
                audit: {
                    ...formData.audit,
                    lastEditedAt: new Date().toISOString()
                }
            });
            await setDoc(docRef, sanitizedAutoSave, { merge: true });

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
    // --- COMPLETITUD REMOVIDA (Módulo 4 y 6 Eliminados) ---

    // --- VALIDACIÓN DE CIERRE ESTRICTA (MP10) ---
    const { isValidForP2, validationErrors, hasRedFlags: localHasRedFlags, hayContradiccionSeguridad } = React.useMemo(() => {
        const errors: string[] = [];

        // 1. Prioridad principal
        if (!interviewV4.experienciaPersona.prioridadPrincipal) {
            errors.push("Prioridad #1: Es obligatorio definir la queja o prioridad del paciente hoy.");
        }

        // 2. Foco Estructurado Mínimo
        const fp = focoPrincipal;
        if (!fp) {
            errors.push("Anamnesis: Se requiere al menos 1 foco clínico estructurado.");
        }

        // --- VALIDACIONES DE MÓDULO 6 ELIMINADAS --- 
        // (La IA extrae automáticamente esta información)

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

                        {isSavingDraft ? (
                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 sm:py-1.5 rounded animate-pulse whitespace-nowrap shrink-0">Guardando...</span>
                        ) : lastSaved ? (
                            <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 px-2 py-1 sm:py-1.5 rounded whitespace-nowrap shrink-0 border border-emerald-100">✔ {lastSaved}</span>
                        ) : null}
                    </div>
                </div>

                {/* El bloque 'Foco y etiquetas rápidas' ha sido extraído de este sticky header (Fase 22) */}

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

                {/* 1. Foco y etiquetas rápidas (MOVIDO Y REFACTORIZADO A MOBILE-FIRST FASE 22) */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 relative">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-slate-800 text-white font-bold text-[10px]">1</span>
                        <h3 className="font-bold text-slate-800 text-sm">Foco clínico inicial</h3>
                        <button
                            onClick={() => setShowFocoGuide(true)}
                            className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 flex items-center justify-center text-xs font-bold transition-colors ml-1 shrink-0"
                            title="Guía de entrevista clínica"
                        >
                            ?
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-5">
                        {/* Foco Principal - Refactorizado Mobile First (Flex Col vertical stack) */}
                        <div className="md:col-span-12 flex flex-col justify-end w-full">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 border-b border-rose-200 pb-0.5 text-rose-800">Foco Principal <span className="text-[9px] text-rose-500 italic normal-case">*obligatorio</span></div>
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                                <input
                                    type="text"
                                    placeholder="Región (ej. Rodilla)"
                                    className="w-full h-9 text-xs p-2 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
                                    value={focoPrincipal.region || ""}
                                    onChange={e => {
                                        const newFocos = [...interviewV4.focos];
                                        newFocos[0].region = e.target.value;
                                        updateV4({ focos: newFocos });
                                    }}
                                    disabled={isClosed}
                                />
                                <select
                                    className="w-full h-9 text-xs p-2 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
                                    value={focoPrincipal.lado || "N/A"}
                                    onChange={e => {
                                        const newFocos = [...interviewV4.focos];
                                        newFocos[0].lado = e.target.value as any;
                                        updateV4({ focos: newFocos });
                                    }}
                                    disabled={isClosed}
                                >
                                    <option value="N/A">- Lado principal -</option><option value="Derecho">Derecho</option><option value="Izquierdo">Izquierdo</option><option value="Bilateral">Bilateral</option>
                                </select>
                            </div>
                        </div>

                        {/* Focos Secundarios Reales (Prompt 3 - Fase 23) */}
                        <div className="md:col-span-12 flex flex-col gap-3 mt-4 w-full border-t border-slate-100 pt-4">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold uppercase text-slate-500">Focos secundarios <span className="text-[9px] text-slate-400 normal-case">(opcional, máx 2)</span></div>

                                {interviewV4.focos.length < 3 && !isClosed && (
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const newFocos = [...interviewV4.focos];
                                            newFocos.push({
                                                id: generateId(),
                                                region: "",
                                                lado: "N/A",
                                                tags: [], // Mapeo temporal del Motivo Secundario (Fase 23)
                                                esFocoPrincipal: false,
                                                dolorActual: null
                                            } as any);
                                            updateV4({ focos: newFocos });
                                        }}
                                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-full border border-indigo-200 transition-colors flex items-center gap-1 shadow-sm"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                                        Agregar foco secundario
                                    </button>
                                )}
                            </div>

                            {interviewV4.focos.length > 1 && (
                                <div className="flex flex-col gap-3 w-full">
                                    {interviewV4.focos.slice(1).map((foco, mappedIndex) => {
                                        const globalIndex = mappedIndex + 1; // Índice real en array original (1 ó 2)
                                        return (
                                            <div key={foco.id} className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg relative w-full shadow-sm animate-fadeIn">
                                                {/* Botón Eliminar Foco Secundario */}
                                                {!isClosed && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const newFocos = [...interviewV4.focos];
                                                            newFocos.splice(globalIndex, 1);
                                                            updateV4({ focos: newFocos });
                                                        }}
                                                        className="absolute -top-2 -right-2 bg-rose-100 text-rose-600 hover:bg-rose-500 hover:text-white rounded-full w-5 h-5 flex items-center justify-center border border-rose-200 shadow-sm transition-colors z-10"
                                                        title="Eliminar foco secundario"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                )}

                                                <div className="flex flex-col sm:flex-row gap-2 w-full">
                                                    <input
                                                        type="text"
                                                        placeholder="Región secundaria (ej. Tobillo)"
                                                        className="w-full sm:w-1/2 h-8 text-[11px] p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700"
                                                        value={foco.region || ""}
                                                        onChange={e => {
                                                            const newFocos = [...interviewV4.focos];
                                                            newFocos[globalIndex].region = e.target.value;
                                                            updateV4({ focos: newFocos });
                                                        }}
                                                        disabled={isClosed}
                                                    />
                                                    <select
                                                        className="w-full sm:w-1/2 h-8 text-[11px] p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700"
                                                        value={foco.lado || "N/A"}
                                                        onChange={e => {
                                                            const newFocos = [...interviewV4.focos];
                                                            newFocos[globalIndex].lado = e.target.value as any;
                                                            updateV4({ focos: newFocos });
                                                        }}
                                                        disabled={isClosed}
                                                    >
                                                        <option value="N/A">- Lado secundario -</option>
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                    </select>
                                                </div>

                                                <select
                                                    className="w-full h-8 text-[11px] p-2 border border-slate-300 rounded outline-none bg-white italic text-slate-600"
                                                    value={foco.tags?.[0] || ""}
                                                    onChange={e => {
                                                        const newFocos = [...interviewV4.focos];
                                                        newFocos[globalIndex].tags = [e.target.value];
                                                        updateV4({ focos: newFocos });
                                                    }}
                                                    disabled={isClosed}
                                                >
                                                    <option value="">- Motivo / Contexto asociado -</option>
                                                    <option value="Recidiva">Recidiva</option>
                                                    <option value="Prevención">Prevención</option>
                                                    <option value="Retorno al deporte">Retorno al deporte</option>
                                                    <option value="Miedo/evitación">Miedo/evitación</option>
                                                    <option value="Rendimiento">Rendimiento</option>
                                                    <option value="Otro">Otro</option>
                                                </select>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Quejas Principales - Refactorizado con Gap y py más tactil */}
                        <div className="md:col-span-5 flex flex-col justify-end w-full">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-2">Queja(s) principal(es)</div>
                            <div className="flex flex-wrap gap-2 items-center w-full">
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
                                            className={`text-[10px] px-3 py-1.5 rounded-full border transition-colors ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 font-bold shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'}`}
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
                                    className="w-full h-9 text-xs p-2 border border-slate-300 rounded outline-none bg-indigo-50/50 mt-2"
                                    value={interviewV4.experienciaPersona.quejaOtro || ""}
                                    onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, quejaOtro: e.target.value } })}
                                    disabled={isClosed}
                                />
                            )}
                        </div>

                        {/* Prioridad 1 (Queja prioritaria) - Refactorizado de Dropdown a Botones */}
                        <div className="md:col-span-12 flex flex-col justify-end mt-2 w-full">
                            <div className="text-[10px] font-bold uppercase text-slate-500 mb-2 border-b border-rose-200 pb-0.5 text-rose-800">Queja prioritaria <span className="text-[9px] text-rose-500 italic normal-case">*obligatorio</span></div>

                            {interviewV4.experienciaPersona.quejas.length === 0 ? (
                                <div className="text-xs text-rose-400 italic bg-rose-50 border border-rose-100 rounded p-2 text-center w-full">
                                    Seleccione al menos una Queja principal arriba para decidir la prioridad.
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2 w-full">
                                    {interviewV4.experienciaPersona.quejas.map(q => {
                                        const actualName = q === "Otro" ? (interviewV4.experienciaPersona.quejaOtro || "Otro") : q;
                                        const isSelected = interviewV4.experienciaPersona.prioridadPrincipal === actualName;
                                        return (
                                            <button
                                                key={q}
                                                disabled={isClosed}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, prioridadPrincipal: actualName } });
                                                }}
                                                className={`text-[11px] px-4 py-2 rounded border font-bold transition-all shadow-sm ${isSelected ? 'bg-rose-500 text-white border-rose-600 ring-2 ring-rose-200 scale-[1.02]' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 active:scale-95'}`}
                                            >
                                                {actualName}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
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

                {/* 2. Relato del caso */}
                <div id="section-relato" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 sm:p-5 pb-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 border-b border-slate-100 pb-3 gap-3">
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[10px]">2</span>
                            <h3 className="font-bold text-slate-800 text-sm">Relato del caso</h3>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <button
                                disabled={isClosed}
                                onClick={(e) => {
                                    e.preventDefault();
                                    const template = `■ MOTIVO DE CONSULTA\n[Qué registrar: palabras exactas de la persona usuaria]\n\n■ OBJETIVO Y EXPECTATIVA\n[Qué registrar: qué quiere lograr y en qué plazo]\n\n■ ANTIGÜEDAD/INICIO Y EVOLUCIÓN\n[Cómo preguntarlo: ¿Desde cuándo lo siente y cómo ha cambiado?]\n\n■ LOCALIZACIÓN Y EXTENSIÓN\n[Qué registrar: dónde es puntualmente y si es difuso]\n\n■ IRRADIACIÓN/REFERENCIA\n[Cómo preguntarlo: ¿El síntoma se mueve a otra zona, hay hormigueo o adormecimiento?]\n\n■ CARÁCTER/NATURALEZA DEL SÍNTOMA\n[Cómo preguntarlo: ¿Cómo se siente: punzante, opresivo, quemazón, corriente, tirantez?]\n\n■ INTENSIDAD\n[Qué registrar: actual, peor 24h, mejor 24h y en qué actividad o movimiento]\n\n■ ATENUANTES Y AGRAVANTES\n[Cómo preguntarlo: ¿Qué cosas mejoran o empeoran el síntoma?]\n\n■ COMPORTAMIENTO 24H Y DESPERTAR NOCTURNO\n[Cómo preguntarlo: ¿Cómo varía en el día y si lo despierta de noche?]\n\n■ SEVERIDAD FUNCIONAL\n[Qué registrar: qué limita exactamente y cuánto impacta en la vida diaria]\n\n■ IRRITABILIDAD\n[Cómo preguntarlo: ¿Qué tan fácil se gatilla, cuánto demora en calmarse y qué queda después?]\n\n■ HISTORIA DEL EPISODIO Y MECANISMO\n[Qué registrar: historia de episodios previos y cómo ocurrió el actual si aplica]\n\n■ MANEJO PREVIO Y RESPUESTA\n[Qué registrar: qué intentó hacer/tomar y cómo le fue con eso]\n\n■ SEGURIDAD CLÍNICA\n[Qué registrar: mencionar descartes o alertas que la persona haya dicho]\n\n■ NOTAS LIBRES RELEVANTES\n[Qué registrar: observaciones extra]\n`;
                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: (interviewV4.experienciaPersona.relatoLibre ? interviewV4.experienciaPersona.relatoLibre + "\n\n" : "") + template } });
                                    // Trigger auto-resize after insertion
                                    setTimeout(() => {
                                        const tx = document.getElementById("relato-libre-textarea");
                                        if (tx) {
                                            tx.style.height = "auto";
                                            tx.style.height = (tx.scrollHeight) + "px";
                                        }
                                    }, 10);
                                }}
                                className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-3 min-h-[44px] rounded-lg font-bold shadow-sm hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1 flex-1 sm:flex-none"
                            >
                                ✨ + Plantilla
                            </button>
                            <button
                                disabled={isClosed || !interviewV4.experienciaPersona.relatoLibre?.includes('[')}
                                onClick={(e) => {
                                    e.preventDefault();
                                    const cleanedText = (interviewV4.experienciaPersona.relatoLibre || "")
                                        .replace(/^\[.*?\]/gm, '') // Remove instruction lines
                                        .replace(/\n{3,}/g, '\n\n') // Normalize multiple line breaks to just two
                                        .trim();
                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: cleanedText } });
                                    // Trigger auto-resize after deletion
                                    setTimeout(() => {
                                        const tx = document.getElementById("relato-libre-textarea");
                                        if (tx) {
                                            tx.style.height = "auto";
                                            tx.style.height = (tx.scrollHeight) + "px";
                                        }
                                    }, 10);
                                }}
                                className="text-[11px] disabled:opacity-50 disabled:cursor-not-allowed bg-white text-slate-600 border border-slate-300 px-3 py-3 min-h-[44px] rounded-lg font-bold shadow-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 flex-1 sm:flex-none"
                                title="Elimina las líneas de guía entre corchetes"
                            >
                                🧹 Limpiar guías
                            </button>
                            <button
                                onClick={(e) => { e.preventDefault(); setShowRelatoGuide(!showRelatoGuide); }}
                                className={`text-[11px] px-3 py-3 min-h-[44px] rounded-lg font-bold shadow-sm transition-colors border flex items-center justify-center gap-1 flex-1 sm:flex-none w-full sm:w-auto ${showRelatoGuide ? 'bg-slate-800 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'}`}
                            >
                                📖 Guía de entrevista
                            </button>

                            {/* FASE 20: QA Mínima (Oculto en ProD por regla 8) */}
                            {process.env.NODE_ENV === 'development' && (
                                <details className="relative ml-auto [&_summary::-webkit-details-marker]:hidden">
                                    <summary className="text-[11px] bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 px-3 py-3 min-h-[44px] rounded-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-1 cursor-pointer select-none">
                                        <span>💉</span> Data QA
                                    </summary>
                                    <div className="absolute right-0 top-full mt-1 w-64 sm:w-80 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-3 flex flex-col gap-2">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-1 tracking-wider border-b border-slate-100 pb-2">Casos de Prueba (QA Auto-Fill)</div>
                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: "Hola. Vengo porque me duele el hombro derecho cuando levanto el brazo." } });
                                        }} className="text-xs text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-medium transition-colors">1. Caso Corto (Faltantes)</button>

                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: "Llevo 3 semanas con un dolor punzante en la rodilla izquierda. Me duele un 6 de 10 cuando bajo escaleras. En reposo no me duele (0). Me alivia ponerme hielo. En la noche duermo súper bien, no me despierta. Mi principal meta es poder volver a trotar mis 5km para fin de año sin sentir que me pincha." } });
                                        }} className="text-xs text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-medium transition-colors">2. Caso Medio (Ideal Auto-Fill)</button>

                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: "Mira, hace como 10 años me operaron de meniscos en la pierna derecha... desde entonces siempre ha estado medio rara, pero hace como 4 días, iba caminando por la calle, pisé mal la cuneta, se me torció el tobillo feo y sentí un chasquido. Fui a la urgencia, me dieron ibuprofeno y me dijeron que era esguince. Ha estado súper hinchado todo el pie derecho. El dolor ahorita es constante, como un latido, yo diría que un 8/10. Ayer apenas podía pisar al levantarme en la mañana. Lo que más me urge es poder caminar normal al trabajo la próxima semana. De noche late pero logro dormir. Si camino dos cuadras, se inflama y tengo que parar media hora para que se pase." } });
                                        }} className="text-xs text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-slate-700 font-medium transition-colors">3. Caso Largo (Ruido e Historia)</button>

                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: "Me está doliendo horrible la espalda baja hace 3 meses, pero esta semana me empezó a bajar una corriente eléctrica fuerte por las dos piernas al mismo tiempo. Además, no he querido decirle a nadie, pero creo que no estoy controlando bien el pipí desde ayer, se me escapa, y ayer en la noche tuve fiebre de 38. Tengo susto." } });
                                        }} className="text-xs text-left px-3 py-2 hover:bg-rose-50 rounded-lg text-rose-800 font-bold transition-colors">4. Caso Red Flags (Alarmas)</button>

                                        <button onClick={(e) => {
                                            e.preventDefault();
                                            updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: "Tengo el cuello tieso hace 2 meses. No puedo mover la cabeza para atrás. Me duele un chorro. De hecho, apenas la echo para atrás duele 10/10 al instante, y después me quedo con dolor agudo toda la maldita tarde, se demora unas 4 horas en bajar y me deja mareado." } });
                                        }} className="text-xs text-left px-3 py-2 hover:bg-orange-50 rounded-lg text-orange-800 font-medium transition-colors">5. Caso Irritabilidad Alta</button>
                                    </div>
                                </details>
                            )}
                        </div>
                    </div>

                    {showRelatoGuide && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-xs text-slate-700 overflow-y-auto max-h-96 shadow-inner">
                            <h4 className="font-bold text-slate-800 mb-2 border-b border-slate-200 pb-1">Guía de entrevista (para estudiantes)</h4>
                            <div className="space-y-2 mt-2">
                                {[
                                    {
                                        titulo: "Motivo de consulta",
                                        preguntar: "¿Qué te trae por aquí hoy? / Cuéntame qué te está pasando.",
                                        noHacer: "Asumir el diagnóstico médico sin escuchar la historia de la persona primero.",
                                        importa: "Revela la prioridad principal del paciente, enfocada en su narrativa y no sólo en la lesión."
                                    },
                                    {
                                        titulo: "Objetivo y expectativa",
                                        preguntar: "¿Qué esperas lograr con las sesiones? / Si esto saliera perfecto, ¿qué estarías haciendo en 1 mes?",
                                        noHacer: "Imponer metas tuyas (ej: lograr 90° de flexión) en vez de metas del paciente (ej: poder alzar a mi hijo).",
                                        importa: "Define el norte del tratamiento y establece el compromiso inicial de ambas partes."
                                    },
                                    {
                                        titulo: "Inicio y evolución",
                                        preguntar: "¿Cuándo empezó esto exactamente y cómo ha cambiado desde ese día?",
                                        noHacer: "Anotar 'le duele hace rato' sin preguntar si el dolor es siempre igual o va y viene por episodios.",
                                        importa: "Ayuda a diferenciar si es un problema muy reciente (agudo) o algo que lleva tiempo y se ha adaptado (persistente)."
                                    },
                                    {
                                        titulo: "Localización y extensión",
                                        preguntar: "¿Puedes apuntar con un dedo dónde duele más? ¿Se siente profundo o superficial?",
                                        noHacer: "Creer que donde duele está necesariamente la lesión real. A veces el origen está más arriba o abajo.",
                                        importa: "Ayuda a entender qué tejidos podrían estar generando el síntoma."
                                    },
                                    {
                                        titulo: "Irradiación y referencia",
                                        preguntar: "¿El dolor viaja o se mueve a otra zona? ¿Sientes hormigueo o corriente lejos de ahí?",
                                        noHacer: "Asumir que todo dolor que baja por la pierna o brazo es 'ciática' automáticamente.",
                                        importa: "Permite ver si un nervio está involucrado o si es otro tejido el que envía dolor a lo lejos."
                                    },
                                    {
                                        titulo: "Carácter y naturaleza",
                                        preguntar: "¿Cómo describirías la sensación? (Ej: punzada, quemazón, peso, corrientazo, tirantez).",
                                        noHacer: "Empujar a la persona a decir sí a tus opciones (ej: '¿te quema, cierto?').",
                                        importa: "Da pistas clave: quemazón/corriente (nervio), latido/presión (inflamación), punzada/pellizco al mover (mecánico)."
                                    },
                                    {
                                        titulo: "Intensidad",
                                        preguntar: "De 0 a 10, ¿cuánto duele ahora? ¿Cuánto ha sido lo peor y cuánto lo mejor en las últimas 24 hrs?",
                                        noHacer: "Obsesionarse sólo con el número. Un dolor '8' sentado en reposo es más grave que un '8' tras trotar 10km.",
                                        importa: "Sirve para medir qué tanto tolera la persona y si necesitamos calmar dolor antes de dar mucho ejercicio."
                                    },
                                    {
                                        titulo: "Atenuantes y agravantes",
                                        preguntar: "¿Hay algo exacto que hagas para que el dolor empeore o mejore? (Ej: posiciones, calor, frío).",
                                        noHacer: "Creer que 'todo movimiento le duele' por igual sin explorar en qué posturas encuentra verdadero alivio.",
                                        importa: "Es fundamental parar saber qué ejercicios recetar y enseñar a calmar el dolor en casa."
                                    },
                                    {
                                        titulo: "Comportamiento 24h",
                                        preguntar: "¿Cómo cambia el síntoma en la mañana vs la noche? ¿Te despierta mientras duermes?",
                                        noHacer: "Ignorar si el dolor de noche no la deja dormir y no cambia de posición. Podría requerir atención extra.",
                                        importa: "Mucha rigidez al despertar indica inflamación. Fatiga o dolor al final del día indica debilidad muscular."
                                    },
                                    {
                                        titulo: "Severidad funcional",
                                        preguntar: "¿A qué porcentaje de tu capacidad sientes que estás rindiendo hoy? ¿Qué dejaste de hacer?",
                                        noHacer: "Dar el alta sólo porque el dolor bajó a cero, ignorando que el paciente aún tiene miedo a moverse.",
                                        importa: "Mide el impacto real en la vida. Un paciente puede tener mucho dolor pero poca limitación, o viceversa."
                                    },
                                    {
                                        titulo: "Irritabilidad",
                                        preguntar: "¿Qué tan fácil empieza a doler, qué tan intenso se pone, y cuánto demora en calmarse cuando te detienes?",
                                        noHacer: "Provocarle dolor máximo evaluando para 'estar seguro', dejando al paciente muy adolorido por días.",
                                        importa: "Te dice cuánto puedes exigirle hoy: si se irrita muy fácil, hoy toca evaluar suave."
                                    },
                                    {
                                        titulo: "Mecanismo e historia",
                                        preguntar: "¿Habías tenido esto igual en el pasado? Si fue un accidente, ¿cómo estabas cuando pasó?",
                                        noHacer: "Olvidar preguntar si hubo estrés extra, falta de sueño o picos de trabajo físico justo antes de que apareciera.",
                                        importa: "Ver repeticiones pasadas aclara el pronóstico, y conocer la caída ayuda a saber qué se pudo dañar."
                                    },
                                    {
                                        titulo: "Manejo previo",
                                        preguntar: "¿Has ido a otro profesional o tomado medicaciones por esto? ¿Te funcionó?",
                                        noHacer: "Repetirle exactamente la misma terapia pasiva que la persona ya te dijo que no le hizo efecto hace un mes.",
                                        importa: "Modula expectativas y nos enseña qué tratamientos previos fallaron para intentar un camino nuevo."
                                    },
                                    {
                                        titulo: "Seguridad clínica",
                                        preguntar: "¿Has notado pérdida de peso, fiebre, o adormecimiento serio en piernas últimamente?",
                                        noHacer: "Descartar estas 'banderas rojas' asumiendo que el médico ya lo vio o que es un dolor muscular común.",
                                        importa: "Descarta problemas graves que requieren urgencia médica por sobre nuestro proceso kinésico."
                                    }
                                ].map((seccion, index) => (
                                    <details key={index} className="group border border-slate-200 rounded bg-white overflow-hidden open:bg-slate-50 transition-colors">
                                        <summary className="flex items-center justify-between p-3 cursor-pointer text-slate-800 font-bold hover:bg-slate-50 transition-colors marker:content-none list-none select-none">
                                            {seccion.titulo}
                                            <svg className="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </summary>
                                        <div className="p-3 pt-0 text-[11px] space-y-2 border-t border-slate-100 mt-1">
                                            <p><strong className="text-indigo-800">Cómo preguntarlo:</strong> {seccion.preguntar}</p>
                                            <p><strong className="text-rose-600">Qué NO hacer:</strong> {seccion.noHacer}</p>
                                            <p><strong className="text-emerald-700">Por qué importa:</strong> {seccion.importa}</p>
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}

                    {!isExpertMode && !showRelatoGuide && (
                        <div className="bg-indigo-50/50 border-l-2 border-indigo-400 p-3 text-xs text-slate-700 rounded-r-lg mb-4 text-justify leading-relaxed shadow-sm">
                            <p>Escribe aquí todo el relato libre directamente para tener un flujo natural, o bien, usa el botón <strong>"✨ + Plantilla"</strong> de arriba para inyectar una estructura base guiada.</p>
                        </div>
                    )}

                    {/* FASE 8 y 32: Overlay para Resaltado Exacto sin perder Visibilidad */}
                    <div className="relative w-full">
                        <textarea
                            id="relato-libre-textarea"
                            placeholder="Relato clínico de la persona en consulta... (la caja se agrandará sola a medida que escribas)"
                            className="w-full text-sm sm:text-[13px] p-4 border border-slate-300 rounded-xl outline-none resize-none leading-relaxed min-h-[250px] overflow-hidden bg-slate-50 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all font-medium text-slate-800 relative z-10 disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed"
                            style={highlightTexts.length > 0 && !isClosed ? { color: 'transparent', caretColor: '#1e293b' } : { WebkitTextFillColor: 'inherit', opacity: 1 }}
                            value={interviewV4.experienciaPersona.relatoLibre || ""}
                            onInput={(e) => {
                                const target = e.target as HTMLTextAreaElement;
                                target.style.height = 'auto'; // Reset height
                                target.style.height = `${target.scrollHeight}px`; // Set to scrollHeight
                                // Auto-scroll into view for iOS Safari Smoothness
                                if (window.innerWidth < 768) {
                                    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                }
                            }}
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

                {/* 3. Seguridad clínica (rojas y naranjas) del episodio actual */}
                <div id="section-seguridad" className="bg-white border border-slate-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-rose-600 text-white font-bold text-[10px]">3</span>
                        <h3 className="font-bold text-slate-800 text-sm">Seguridad clínica del episodio actual (Banderas Rojas)</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.fiebre_sistemico_cancerPrevio} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, fiebre_sistemico_cancerPrevio: e.target.checked } })} />
                            <span className="leading-tight mt-0.5">Fiebre / Compromiso Sistémico / Cáncer Previo</span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.bajaPeso_noIntencionada} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, bajaPeso_noIntencionada: e.target.checked } })} />
                            <span className="leading-tight mt-0.5">Baja de peso progresiva inexplicada</span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, dolorNocturno_inexplicable_noMecanico: e.target.checked } })} />
                            <span className="leading-tight mt-0.5">Dolor nocturno constante e inexplicable</span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.trauma_altaEnergia_caidaImportante} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, trauma_altaEnergia_caidaImportante: e.target.checked } })} />
                            <span className="leading-tight mt-0.5">Trauma alta energía / Caída importante</span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-slate-50 border border-slate-100 rounded-lg hover:border-rose-200 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, neuroGraveProgresivo_esfinteres_sillaMontar: e.target.checked } })} />
                            <span className="leading-tight mt-0.5">Alt. esfínteres / Anestesia en silla montar</span>
                        </label>
                        <label className="flex items-start gap-2 text-[12px] p-3 min-h-[44px] bg-amber-50 border border-amber-100 rounded-lg hover:border-amber-300 transition-colors cursor-pointer">
                            <input type="checkbox" className="mt-0.5 accent-amber-600 w-4 h-4" disabled={isClosed} checked={interviewV4.seguridad.riesgoEmocionalAgudo} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, riesgoEmocionalAgudo: e.target.checked } })} />
                            <span className="text-amber-900 font-medium leading-tight mt-0.5">Riesgo emocional agudo del episodio actual (Naranja)</span>
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
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 min-h-[44px] rounded-lg border-2 cursor-pointer transition-all ${interviewV4.seguridad?.accionBanderaRoja === 'Derivar / cerrar caso' ? 'bg-rose-100 border-rose-600 text-rose-900 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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
                                <label className={`flex-1 flex items-center justify-center gap-2 p-3 min-h-[44px] rounded-lg border-2 cursor-pointer transition-all ${interviewV4.seguridad?.accionBanderaRoja === 'Continuar bajo supervisión' ? 'bg-orange-100 border-orange-600 text-orange-900 font-bold shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
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
                        <label className="flex items-center gap-3 p-2 min-h-[44px] cursor-pointer bg-white rounded-lg hover:bg-slate-50 transition-colors w-full sm:w-auto">
                            <input
                                type="checkbox"
                                disabled={isClosed}
                                checked={interviewV4.seguridad?.confirmado || false}
                                onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, confirmado: e.target.checked } })}
                                className="w-5 h-5 accent-emerald-600 rounded cursor-pointer"
                            />
                            <span className="text-sm font-bold text-slate-700">Confirmo evaluación de banderas del episodio actual (Obligatorio)</span>
                        </label>
                    </div>
                </div>



                {/* 4. Chequeo de completitud eliminado (Fase 24 visual cleanup) */}

                {/* 5. Procesar con IA (FASE 11: Unified P1 Refactor) */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-5 h-5 rounded-md bg-purple-700 text-white font-bold text-[10px]">5</span>
                        <h3 className="font-bold text-purple-900 text-sm">Sintetizar Entrevista Clínica con Inteligencia Artificial</h3>
                    </div>

                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            handleAISynthesis();
                        }}
                        disabled={isClosed || isProcessingAI}
                        id="btn-ia-main-extract"
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold py-4 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 border border-purple-800"
                    >
                        {isProcessingAI ? (
                            <><span className="animate-spin text-sm">⏳</span> Analizando toda la entrevista (Tomará unos segundos)...</>
                        ) : (
                            <><span>🧠</span> Generar Síntesis Clínica en 1 Clic</>
                        )}
                    </button>

                    <p className="text-center text-[10px] text-purple-600 font-medium mt-3 mb-1">
                        La IA razona, extrae y ordena el relato de arriba. No reemplaza tu criterio clínico.
                    </p>

                    {/* FASE 14 UX Simple Error Fallback */}
                    {interviewV4.jsonExtractError && (
                        <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                            <div className="flex items-start gap-3">
                                <span className="text-xl shrink-0 leading-none mt-1">⚠️</span>
                                <div className="flex flex-col flex-1">
                                    <h4 className="font-bold text-rose-800 text-sm">No se pudo procesar la síntesis clínica en este intento.</h4>
                                    <p className="text-[12px] text-rose-600">Tu relato está guardado y no se ha borrado. Reintenta.</p>
                                    {(interviewV4 as any).jsonExtractErrorMsg && (
                                        <div className="mt-2 text-[10px] p-2 bg-rose-100/50 rounded text-rose-900 border border-rose-200 break-words font-mono">
                                            Detalle Técnico: {(interviewV4 as any).jsonExtractErrorMsg}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Salida Estructurada FASE 11 */}
                    {(!interviewV4.jsonExtractError && interviewV4.p1_ai_structured) && (
                        <div className="mt-4 flex flex-col gap-4 animate-in fade-in duration-300">
                            
                            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-3 rounded-xl shadow-sm text-xs flex items-center justify-center gap-2 font-medium">
                                <span>ℹ️</span>
                                <span><strong>Modo Hipótesis:</strong> Todo este bloque proviene del análisis estructurado de IA basado en el relato. Debes confirmarlo en P2/P3.</span>
                            </div>

                            {/* 1. Resúmenes Editables */}
                            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">📝 Resumen Médico-Clínico Editable</span>
                                </div>
                                <div className="p-3">
                                    <textarea
                                        disabled={isClosed}
                                        rows={4}
                                        className="w-full text-xs p-2.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white focus:border-emerald-400 transition-colors leading-relaxed text-slate-700"
                                        value={interviewV4.p1_ai_structured.resumen_clinico_editable || ""}
                                        onChange={e => updateV4({ p1_ai_structured: { ...interviewV4.p1_ai_structured, resumen_clinico_editable: e.target.value } })}
                                    />
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden">
                                <div className="bg-emerald-50 px-3 py-2 border-b border-emerald-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">🗣️ Resumen para la Persona Usuaria (Borrador)</span>
                                </div>
                                <div className="p-3 flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Lo que entendí:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.p1_ai_structured.resumen_persona_usuaria?.lo_que_entendi || ""} onChange={e => updateV4({ p1_ai_structured: { ...interviewV4.p1_ai_structured, resumen_persona_usuaria: { ...interviewV4.p1_ai_structured.resumen_persona_usuaria, lo_que_entendi: e.target.value } } })} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Lo que te preocupa:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.p1_ai_structured.resumen_persona_usuaria?.lo_que_te_preocupa || ""} onChange={e => updateV4({ p1_ai_structured: { ...interviewV4.p1_ai_structured, resumen_persona_usuaria: { ...interviewV4.p1_ai_structured.resumen_persona_usuaria, lo_que_te_preocupa: e.target.value } } })} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[11px] font-bold text-slate-600">Opciones para empezar:</label>
                                        <textarea disabled={isClosed} rows={2} className="w-full text-xs p-2 border border-slate-200 rounded outline-none bg-slate-50 focus:border-emerald-400" value={interviewV4.p1_ai_structured.resumen_persona_usuaria?.lo_que_haremos_ahora || ""} onChange={e => updateV4({ p1_ai_structured: { ...interviewV4.p1_ai_structured, resumen_persona_usuaria: { ...interviewV4.p1_ai_structured.resumen_persona_usuaria, lo_que_haremos_ahora: e.target.value } } })} />
                                    </div>
                                </div>
                            </div>

                            {/* ALICIA */}
                            {interviewV4.p1_ai_structured.alicia && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                        <span className="text-xs font-bold text-slate-700">🔎 Extracción A.L.I.C.I.A</span>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
                                        {Object.entries(interviewV4.p1_ai_structured.alicia).map(([k, v]) => (
                                            <div key={k} className="bg-white border border-slate-200 rounded p-2 text-xs">
                                                <strong className="text-slate-500 uppercase text-[9px] block mb-0.5">{k.replace(/_/g, " ")}</strong>
                                                <span className="text-slate-800 font-medium">{String(v || "N/A")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* SINS */}
                            {interviewV4.p1_ai_structured.sins && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                                    <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                        <span className="text-xs font-bold text-slate-700">⚖️ Foco S.I.N.S Evaluado</span>
                                    </div>
                                    <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50">
                                        {Object.entries(interviewV4.p1_ai_structured.sins).map(([k, v]) => (
                                            <div key={k} className="bg-white border border-slate-200 rounded p-2 text-xs">
                                                <strong className="text-slate-500 uppercase text-[9px] block mb-0.5">{k.replace(/_/g, " ")}</strong>
                                                <span className="text-slate-800 font-medium">{String(v || "N/A")}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Hipótesis, Módulo P2, Contexto */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 lg:col-span-2">
                                    <h4 className="text-xs font-bold text-indigo-800 mb-2">💡 Hipótesis Orientativas</h4>
                                    <div className="space-y-2">
                                        {interviewV4.p1_ai_structured.hipotesis_orientativas?.map((h: any, i: number) => (
                                            <div key={i} className="bg-white border border-indigo-50 p-2 rounded text-[11px] gap-1 flex flex-col">
                                                <div className="flex justify-between">
                                                    <strong className="text-indigo-900">{h.ranking}. {h.titulo}</strong>
                                                    <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">{h.probabilidad?.replace("_", " ")}</span>
                                                </div>
                                                <p className="text-indigo-700">{h.fundamento_breve}</p>
                                                <div className="grid grid-cols-2 gap-2 mt-1 border-t border-indigo-50 pt-1">
                                                    <p className="text-emerald-700"><strong className="block text-[9px] uppercase">A Confirmar:</strong>{h.que_hay_que_confirmar}</p>
                                                    <p className="text-rose-700"><strong className="block text-[9px] uppercase">A Descartar:</strong>{h.que_hay_que_descartar}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex flex-col gap-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-amber-800 mb-2">❓ Preguntas Faltantes Clave</h4>
                                        <div className="space-y-2">
                                            {interviewV4.p1_ai_structured.preguntas_faltantes?.map((p: any, i: number) => (
                                                <div key={i} className="bg-white border border-amber-50 rounded p-2">
                                                    <p className="text-[11px] text-amber-900 font-medium">{p.pregunta}</p>
                                                    <p className="text-[9px] text-amber-700 border-t border-amber-50 mt-1 pt-1 opacity-80">{p.por_que_importa}</p>
                                                </div>
                                            ))}
                                            {(!interviewV4.p1_ai_structured.preguntas_faltantes || interviewV4.p1_ai_structured.preguntas_faltantes.length === 0) && (
                                                <p className="text-xs text-amber-700 italic">No hay preguntas sugeridas.</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-emerald-800 mb-2 mt-2 pt-2 border-t border-amber-200">Factores Contextuales</h4>
                                        <div className="text-[10px] space-y-2">
                                            {interviewV4.p1_ai_structured.factores_contextuales_clave?.banderas_rojas?.length > 0 && <p><strong className="text-rose-600 block">Rojas:</strong> {interviewV4.p1_ai_structured.factores_contextuales_clave.banderas_rojas.join(", ")}</p>}
                                            {interviewV4.p1_ai_structured.factores_contextuales_clave?.banderas_amarillas?.length > 0 && <p><strong className="text-amber-600 block">Amarillas:</strong> {interviewV4.p1_ai_structured.factores_contextuales_clave.banderas_amarillas.join(", ")}</p>}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-3 lg:col-span-3">
                                    <h4 className="text-xs font-bold text-teal-800 mb-2">🩺 Foco Examen Físico (Paso 2) Recomendado</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px]">
                                        {Object.entries(interviewV4.p1_ai_structured.recomendaciones_p2_por_modulo || {}).map(([mod, data]: any) => (
                                            <div key={mod} className="bg-white border border-teal-100 rounded p-2 flex flex-col justify-between max-h-[160px] overflow-y-auto">
                                                <strong className="text-teal-900 mb-1 block capitalize tracking-wider">{mod.replace(/_/g, " ")}</strong>
                                                <p className="text-teal-800 font-medium mb-1">{data.objetivo}</p>
                                                {data.por_que_aporta_en_este_caso && <p className="text-teal-700 mb-1"><strong className="opacity-80">Por qué aporta:</strong> {data.por_que_aporta_en_este_caso}</p>}
                                                {data.hallazgo_que_apoya_hipotesis_principal && <p className="text-emerald-700 mb-1 border-t border-emerald-50 pt-1"><strong className="opacity-80">Confirma H1 si:</strong> {data.hallazgo_que_apoya_hipotesis_principal}</p>}
                                                {data.hallazgo_que_debilita_hipotesis_principal && <p className="text-rose-700"><strong className="opacity-80">Debilita H1 si:</strong> {data.hallazgo_que_debilita_hipotesis_principal}</p>}
                                                {data.pruebas_o_tareas_sugeridas?.length > 0 && <span className="mt-1 bg-teal-50 text-teal-800 text-[9px] px-1.5 py-0.5 rounded border border-teal-100 w-fit">🎯 {data.pruebas_o_tareas_sugeridas.join(', ')}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Raw JSON Debug View */}
                            <details className="mt-2 bg-slate-900 rounded-xl shadow-inner border border-slate-700">
                                <summary className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center cursor-pointer outline-none select-none text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors">
                                    <span>Ver JSON Crudo (Developer)</span>
                                </summary>
                                <pre className="p-3 whitespace-pre-wrap font-mono text-[11px] text-blue-300 overflow-x-auto leading-relaxed max-h-96 overflow-y-auto">
                                    {JSON.stringify(interviewV4.p1_ai_structured, null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}
                </div>

                {/* 6. Datos de Seguimiento y Anclas eliminados (Fase 24 visual cleanup) */}

                {/* 7. Confirmaciones críticas */}
                {interviewV4.analisisIA && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
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
                                                    <span className="text-sm font-bold text-slate-800 break-words">{iaValue}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
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
                                            getFieldText(interviewV4.analisisIA?.SINS?.irritabilidad?.irritabilidad_global) || getFieldText(interviewV4.analisisIA?.SINS?.irritabilidad) || "Desconocida",
                                            !!interviewV4.analisisIA?.SINS?.irritabilidad
                                        )}

                                        {/* 2. Naturaleza Sugerida */}
                                        {renderConfRow(
                                            'naturaleza_sugerida',
                                            'SINS: Naturaleza Sugerida',
                                            getFieldText(interviewV4.analisisIA?.SINS?.naturaleza_sugerida) || "Desconocida",
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
            </div >
        </div >
    );
}
