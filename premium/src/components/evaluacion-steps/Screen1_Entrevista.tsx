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
    const { isValidForP2, validationErrors } = React.useMemo(() => {
        const errors: string[] = [];

        // 1. Prioridad principal
        if (!interviewV4.experienciaPersona.prioridadPrincipal) {
            errors.push("Prioridad #1: Es obligatorio definir la queja o prioridad del paciente hoy.");
        }

        // 2 & 3. Datos Críticos del Foco Principal (Antigüedad y Dolor Actual)
        const fp = focoPrincipal;
        if (fp) {
            if (!fp.antiguedad || fp.antiguedad === "NoDefinido") errors.push("Foco Principal: Falta tiempo de evolución (antigüedad).");
            if (fp.dolorActual === null || fp.dolorActual === undefined) errors.push("Foco Principal: Falta intensidad de dolor actual (EVA 0-10).");
        } else {
            errors.push("Anamnesis: Se requiere al menos 1 foco clínico estructurado.");
        }

        // 4. Limitación Funcional Condicionada (1 PSFS completo)
        if (interviewV4.hayLimitacionFuncional) {
            const hasValidPsfs = interviewV4.psfsGlobal.some(p => p.actividad && p.actividad.trim() !== "" && p.score !== null);
            if (!hasValidPsfs) {
                errors.push("PSFS: Ha indicado limitación funcional. Debe ingresar al menos 1 actividad con texto y puntaje válido.");
            }
        }

        return { isValidForP2: errors.length === 0, validationErrors: errors };
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

        let color = "Verde";
        let styles = "bg-emerald-50 border-emerald-200 text-emerald-800";
        let dot = "bg-emerald-500";
        let motivoStr = "Sin banderas de riesgo detectadas.";

        if (rojas >= 2 || naranjas >= 1 || interviewV4.seguridad.overrideUrgenciaMedica) {
            color = "Roja";
            styles = "bg-rose-50 border-rose-200 text-rose-800";
            dot = "bg-rose-500";
            motivoStr = `Riesgo Alto. Motivos: ${motivos.join(", ")}.`;
        } else if (rojas === 1) {
            color = "Amarilla";
            styles = "bg-amber-50 border-amber-200 text-amber-800";
            dot = "bg-amber-500";
            motivoStr = `Precaución. Motivo: ${motivos.join(", ")}.`;
        } // Verde de lo contrario

        // Requerimiento de detalle breve si hay cualquier bandera
        if (rojas > 0 || naranjas > 0) {
            if (interviewV4.seguridad.detalleBanderas && interviewV4.seguridad.detalleBanderas.trim() !== "") {
                motivoStr += ` Detalle clínico: ${interviewV4.seguridad.detalleBanderas}`;
            } else {
                motivoStr += " (Falta detalle clínico justificador)";
            }
        }

        return {
            seguridadColor: color,
            seguridadStyles: styles,
            seguridadDot: dot,
            seguridadMotivo: motivoStr,
            isRiesgoAlto: color === "Roja"
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

                {/* FILA 2: Inputs Contextuales (Motivos y Quejas) */}
                <div className="flex flex-col sm:grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-4 flex flex-col justify-end">
                        <div className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-500 mb-0.5 sm:mb-1">Motivo Principal (Foco 1)</div>
                        <div className="flex gap-1 h-8">
                            <input
                                type="text"
                                placeholder="Región (ej. Rodilla)"
                                className="w-2/3 text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50"
                                value={focoPrincipal.region || ""}
                                onChange={e => {
                                    const newFocos = [...interviewV4.focos];
                                    newFocos[0].region = e.target.value;
                                    updateV4({ focos: newFocos });
                                }}
                                disabled={isClosed}
                            />
                            <select
                                className="w-1/3 text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50"
                                value={focoPrincipal.lado || "N/A"}
                                onChange={e => {
                                    const newFocos = [...interviewV4.focos];
                                    newFocos[0].lado = e.target.value as any;
                                    updateV4({ focos: newFocos });
                                }}
                                disabled={isClosed}
                            >
                                <option value="N/A">- Lado -</option><option value="Derecho">Der</option><option value="Izquierdo">Izq</option><option value="Bilateral">Bilat</option><option value="Axial/Central">Axial</option>
                            </select>
                        </div>
                    </div>
                    <div className="md:col-span-4 flex flex-col justify-end">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Motivos secundarios</div>
                        <input
                            type="text"
                            placeholder="Ej: Pinchazo al saltar"
                            className="w-full h-8 text-xs p-1.5 border border-slate-300 rounded outline-none bg-slate-50"
                            onChange={() => { }} // Placeholder temporal antes del array múltiple completo
                            disabled={isClosed}
                        />
                    </div>
                    <div className="md:col-span-4 flex flex-col justify-end">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1">Queja(s) principal(es)</div>
                        <div className="flex flex-col gap-1">
                            <div className="flex flex-wrap gap-1 items-center">
                                {["Dolor", "Rigidez", "Hinchazón", "Inestabilidad", "Debilidad", "Hormigueos/Adormecimiento", "Rendimiento", "Miedo al movimiento", "Otro"].map(q => {
                                    const isSelected = interviewV4.experienciaPersona.quejas.includes(q);
                                    return (
                                        <button
                                            key={q}
                                            disabled={isClosed}
                                            onClick={() => {
                                                const current = interviewV4.experienciaPersona.quejas;
                                                const next = isSelected ? current.filter(x => x !== q) : [...current, q];
                                                updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, quejas: next } });
                                            }}
                                            className={`text-[9px] px-2 py-1 rounded-full border transition-colors ${isSelected ? 'bg-indigo-500 text-white border-indigo-600 font-bold' : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-600'}`}
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
                                    className="w-full h-7 text-xs p-1.5 border border-slate-300 rounded outline-none bg-indigo-50/50"
                                    value={interviewV4.experienciaPersona.quejaOtro || ""}
                                    onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, quejaOtro: e.target.value } })}
                                    disabled={isClosed}
                                />
                            )}
                        </div>
                    </div>
                    <div className="md:col-span-4 flex flex-col justify-end">
                        <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 border-b border-rose-200 pb-0.5 text-rose-800">Prioridad #1 <span className="text-[9px] text-rose-500 italic normal-case">*obligatorio</span></div>
                        <select
                            className="w-full h-8 text-xs p-1.5 border border-rose-300 rounded outline-none bg-rose-50/30 text-rose-900 font-bold"
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

                {/* FILA 3: 3 Badges AUTO */}
                <div className="flex flex-wrap gap-2 pt-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm transition-colors ${seguridadStyles}`} title={seguridadMotivo}>
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${seguridadDot}`} />
                        Seguridad [AUTO]: {seguridadColor}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[10px] font-bold uppercase tracking-wider shadow-sm 
                        ${focoPrincipal?.irritabilidadAuto?.nivel === 'Alta' ? 'border-rose-200 bg-rose-50 text-rose-800' :
                            focoPrincipal?.irritabilidadAuto?.nivel === 'Media' ? 'border-amber-200 bg-amber-50 text-amber-800' :
                                focoPrincipal?.irritabilidadAuto?.nivel === 'Baja' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' :
                                    'border-slate-200 bg-slate-50 text-slate-800'
                        }`}>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Irritabilidad [AUTO]: {focoPrincipal?.irritabilidadAuto?.nivel || 'No definido'}
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded border border-sky-200 bg-sky-50 text-sky-800 text-[10px] font-bold uppercase tracking-wider shadow-sm truncate max-w-[250px]" title={focoPrincipal.mecanismoTextoFinal || 'No definido'}>
                        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" /></svg>
                        Tipo de dolor sugerido [AUTO]: {focoPrincipal.mecanismoTextoFinal || 'No definido'}
                    </div>
                </div>
            </div>

            {/* CONTENEDOR ACORDEONES (1 al 14) */}
            <div className="px-4 flex flex-col gap-3">

                {/* --- 1. HISTORIA DEL USUARIO Y OBJETIVOS --- */}
                <details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[1]}>
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(1); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">1</span>
                                <h3 className="font-bold text-slate-800 text-sm">Historia del Usuario y Objetivos</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {reqSec1.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">{1 - reqSec1.length}/1 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[1] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {reqSec1.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec1.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 flex flex-col gap-5">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-0 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Entender las expectativas y lo que el paciente más necesita resolver hoy.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Quiero volver a trotar 5km sin dolor en la rodilla".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        {/* A. RELATO LIBRE */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <label className="text-xs font-bold text-slate-700">Relato del usuario (opcional)</label>
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200 flex items-center gap-1">
                                    <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                                    Usa comillas para frases textuales ("...")
                                </span>
                            </div>
                            <textarea
                                rows={3}
                                placeholder="Escribe aquí lo que cuenta el paciente en sus propias palabras..."
                                className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none resize-y"
                                value={interviewV4.experienciaPersona.relatoLibre || ""}
                                onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, relatoLibre: e.target.value } })}
                                disabled={isClosed}
                            />
                        </div>

                        {/* B. OBJETIVO PRINCIPAL */}
                        <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                            <h4 className="text-xs font-bold text-indigo-900 mb-3 border-b border-indigo-100 pb-2">Objetivo del Usuario</h4>
                            {interviewV4.experienciaPersona.objetivos.map((obj, i) => (
                                <div key={obj.id} className="flex flex-col gap-3 mb-4 pb-4 border-b border-indigo-100 last:border-0 last:mb-0 last:pb-0 relative">
                                    <div className="flex items-center justify-between">
                                        <b className="text-[10px] uppercase text-indigo-700">{obj.esPrincipal ? 'Prioridad #1' : `Secundario #${i}`}</b>
                                        {!obj.esPrincipal && (
                                            <button
                                                className="text-rose-500 text-xs hover:text-rose-700"
                                                disabled={isClosed}
                                                onClick={() => {
                                                    const newObjs = interviewV4.experienciaPersona.objetivos.filter(o => o.id !== obj.id);
                                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                }}
                                            >Eliminar</button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Contexto Multi */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-600">Contexto</label>
                                            <div className="flex flex-wrap gap-1">
                                                {["Vida diaria", "Trabajo-Estudio", "Deporte", "Gimnasio"].map(ctx => {
                                                    const isSel = obj.contexto.includes(ctx);
                                                    return (
                                                        <button
                                                            key={ctx} disabled={isClosed}
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const newCtx = isSel ? obj.contexto.filter(c => c !== ctx) : [...obj.contexto, ctx];
                                                                const newObjs = interviewV4.experienciaPersona.objetivos.map(o => o.id === obj.id ? { ...o, contexto: newCtx } : o);
                                                                updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                            }}
                                                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${isSel ? 'bg-indigo-100 border-indigo-300 text-indigo-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                                        >
                                                            {ctx}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Plazo */}
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-600">Plazo esperado</label>
                                            <select
                                                className="w-full text-xs p-2 border border-slate-300 rounded outline-none h-8"
                                                value={obj.plazoSemanas}
                                                disabled={isClosed}
                                                onChange={(e) => {
                                                    const newObjs = interviewV4.experienciaPersona.objetivos.map(o => o.id === obj.id ? { ...o, plazoSemanas: e.target.value as any } : o);
                                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                }}
                                            >
                                                <option value="">- Seleccione -</option>
                                                <option value="1-2">Corto (1 - 2 semanas)</option>
                                                <option value="3-6">Medio (3 - 6 semanas)</option>
                                                <option value="7-12">Largo (7 - 12 semanas)</option>
                                                <option value=">12">Crónico (+12 semanas)</option>
                                            </select>
                                        </div>

                                        {/* Estructura Verbo + Actividad */}
                                        <div className="col-span-1 md:col-span-2 flex gap-2 items-end">
                                            <div className="w-1/3 flex flex-col gap-1">
                                                <label className="text-[10px] font-bold text-slate-600">Quiero...</label>
                                                <select
                                                    className="w-full text-xs p-2 border border-slate-300 rounded outline-none h-8 font-bold text-slate-700"
                                                    value={obj.verbo}
                                                    disabled={isClosed}
                                                    onChange={(e) => {
                                                        const newObjs = interviewV4.experienciaPersona.objetivos.map(o => o.id === obj.id ? { ...o, verbo: e.target.value as any } : o);
                                                        updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                    }}
                                                >
                                                    <option value="">- Verbo -</option><option value="volver a">Volver a</option><option value="mejorar">Mejorar</option><option value="tolerar">Tolerar</option><option value="reducir">Reducir</option><option value="otro">Otro</option>
                                                </select>
                                            </div>
                                            <div className="flex-1 flex flex-col gap-1">
                                                <input
                                                    type="text"
                                                    placeholder="Ej: Correr 5km / Jugar con mis hijos / El dolor al despertar"
                                                    className="w-full text-xs p-2 border border-slate-300 rounded outline-none h-8 font-medium"
                                                    value={obj.actividad}
                                                    onChange={(e) => {
                                                        const newObjs = interviewV4.experienciaPersona.objetivos.map(o => o.id === obj.id ? { ...o, actividad: e.target.value } : o);
                                                        updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                    }}
                                                    disabled={isClosed}
                                                />
                                            </div>
                                        </div>

                                        {/* En sus palabras */}
                                        <div className="col-span-1 md:col-span-2">
                                            <input
                                                type="text"
                                                placeholder='Propio objetivo (Textual, opcional): Ej: "Quiero sentirme yo mismo otra vez"'
                                                className="w-full text-xs p-2 border border-slate-200 border-dashed rounded outline-none h-8 text-slate-600 italic bg-white"
                                                value={obj.enSusPalabras || ""}
                                                onChange={(e) => {
                                                    const newObjs = interviewV4.experienciaPersona.objetivos.map(o => o.id === obj.id ? { ...o, enSusPalabras: e.target.value } : o);
                                                    updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                                }}
                                                disabled={isClosed}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {interviewV4.experienciaPersona.objetivos.length < 3 && (
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const newObjs = [...interviewV4.experienciaPersona.objetivos, { id: generateId(), contexto: [], verbo: "", actividad: "", plazoSemanas: "", enSusPalabras: "", esPrincipal: false } as any];
                                        updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, objetivos: newObjs } });
                                    }}
                                    disabled={isClosed}
                                    className="mt-2 text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-3 py-1.5 rounded shadow-sm hover:bg-slate-50 transition-colors"
                                >
                                    + Agregar Objetivo Secundario
                                </button>
                            )}
                        </div>

                        {/* C. EXPECTATIVAS GENERALES ADICIONALES (Mantenemos como compatibilidad V3/V4 Base) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-600">Preocupación Principal</label>
                                <select className="w-full h-[42px] text-xs p-2.5 border border-slate-300 rounded outline-none font-medium bg-slate-50" value={interviewV4.experienciaPersona.preocupacion} onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, preocupacion: e.target.value as any } })} disabled={isClosed}>
                                    <option value="NoDefinido">Seleccione Preocupación Principal...</option>
                                    <option value="Daño grave">Daño grave a los tejidos</option>
                                    <option value="No poder entrenar">No poder entrenar / jugar</option>
                                    <option value="Empeorar al mover">Creencia de empeorar al moverse</option>
                                    <option value="Cirugía">Miedo a necesitar cirugía</option>
                                    <option value="Impacto laboral/académico">Impacto en trabajo/estudio</option>
                                    <option value="Tiempo de recuperación">Incertidumbre en tiempos</option>
                                    <option value="Otra">Otra</option>
                                </select>
                            </div>
                        </div>
                    </div >
                </details >

                {/* --- 2. ¿POR QUÉ CONSULTA AHORA? --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[2]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(2); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">2</span>
                            <h3 className="font-bold text-slate-800 text-sm">¿Por qué consulta ahora?</h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[2] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Identificar el detonante principal que lo hizo buscar ayuda profesional en este momento.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "El dolor empeoró" o "Tengo competencia la próxima semana".</p>
                            </div>
                        )}
                        <select
                            className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none font-medium bg-slate-50 mb-3"
                            value={interviewV4.experienciaPersona.motivoConsultaAhora || ""}
                            onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, motivoConsultaAhora: e.target.value as any } })}
                            disabled={isClosed}
                        >
                            <option value="">- Seleccione el detonante actual -</option>
                            <option value="empeoró">Empeoró recientemente</option>
                            <option value="apareció síntoma nuevo">Apareció un síntoma nuevo</option>
                            <option value="no mejora">No mejora con el tiempo</option>
                            <option value="miedo">Miedo/Preocupación por algo específico</option>
                            <option value="se acerca evento deportivo">Se acerca un evento deportivo</option>
                            <option value="afecta trabajo">Está afectando su trabajo/estudios</option>
                            <option value="recomendación de tercero">Recomendación de un tercero (médico, familiar)</option>
                            <option value="otro">Otro (especificar)</option>
                        </select>

                        {interviewV4.experienciaPersona.motivoConsultaAhora === "otro" && (
                            <input
                                type="text"
                                placeholder="Especifique el motivo..."
                                className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none"
                                value={interviewV4.experienciaPersona.motivoConsultaAhoraOtro || ""}
                                onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, motivoConsultaAhoraOtro: e.target.value } })}
                                disabled={isClosed}
                            />
                        )}
                    </div>
                </details >

                {/* --- 3. SEGURIDAD (ROJAS + NARANJAS) --- */}
                < details className="group bg-rose-50/50 border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[3]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(3); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">3</span>
                            <h3 className="font-bold text-slate-800 text-sm">Seguridad Clínica (Rojas y Naranjas)</h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[3] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Descartar patologías graves (ej. tumor, fractura) que requieran derivación médica urgente.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Dolor nocturno inexplicable", "Baja de peso", "Trauma grave".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs mb-4">
                            {/* ROJAS */}
                            {[
                                { key: 'fiebre_sistemico_cancerPrevio', label: 'Fiebre / compromiso sistémico / cáncer previo', type: 'roja' },
                                { key: 'bajaPeso_noIntencionada', label: 'Baja de peso no intencionada', type: 'roja' },
                                { key: 'dolorNocturno_inexplicable_noMecanico', label: 'Dolor nocturno inexplicable (no mecánico)', type: 'roja' },
                                { key: 'trauma_altaEnergia_caidaImportante', label: 'Trauma alta energía / caída importante', type: 'roja' },
                                { key: 'neuroGraveProgresivo_esfinteres_sillaMontar', label: 'Déficit neuro grave o progresivo (ej. esfínteres)', type: 'roja' },
                                { key: 'sospechaFractura_incapacidadCarga', label: 'Sospecha fractura / incapacidad de carga pura', type: 'roja' }
                            ].map(flag => (
                                <label key={flag.key} className="flex items-start gap-2 cursor-pointer p-1.5 hover:bg-rose-100/30 rounded transition-colors">
                                    <input type="checkbox" className="mt-0.5 accent-rose-600 w-4 h-4 cursor-pointer" checked={(interviewV4.seguridad as any)[flag.key] || false} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, [flag.key]: e.target.checked } })} disabled={isClosed} />
                                    <span className="text-slate-700 font-medium">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 mr-1.5 shadow-sm"></span>
                                        {flag.label}
                                    </span>
                                </label>
                            ))}

                            {/* NARANJAS */}
                            <label className="flex items-start gap-2 cursor-pointer p-1.5 hover:bg-amber-100/30 rounded transition-colors col-span-1 md:col-span-2 border-t border-slate-200/60 pt-3 mt-1">
                                <input type="checkbox" className="mt-0.5 accent-amber-500 w-4 h-4 cursor-pointer" checked={interviewV4.seguridad.riesgoEmocionalAgudo || false} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, riesgoEmocionalAgudo: e.target.checked } })} disabled={isClosed} />
                                <span className="text-slate-700 font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400 mr-1.5 shadow-sm"></span>
                                    Bandera Naranja: Riesgo emocional agudo u otro trastorno psiquiátrico descompensado
                                </span>
                            </label>
                        </div>

                        {/* CONDICIONAL: DETALLE (Si > 0 banderas) */}
                        {(interviewV4.seguridad.fiebre_sistemico_cancerPrevio || interviewV4.seguridad.bajaPeso_noIntencionada || interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico || interviewV4.seguridad.trauma_altaEnergia_caidaImportante || interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar || interviewV4.seguridad.sospechaFractura_incapacidadCarga || interviewV4.seguridad.riesgoEmocionalAgudo) && (
                            <div className="mb-4 bg-white p-3 border border-slate-200 rounded text-xs shadow-sm">
                                <label className="block font-bold text-slate-700 mb-1">
                                    Detalle Clínico / Justificación <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none min-h-[60px]"
                                    placeholder="Detalle los hallazgos relativos a las banderas seleccionadas..."
                                    value={interviewV4.seguridad.detalleBanderas || ""}
                                    onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, detalleBanderas: e.target.value } })}
                                    disabled={isClosed}
                                />
                            </div>
                        )}

                        {/* ANULACIÓN URGENCIA A MANO */}
                        <div className="pt-3 border-t border-rose-200/60">
                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                <input type="checkbox" className="mt-0.5 accent-rose-700 w-4 h-4 cursor-pointer" checked={interviewV4.seguridad?.overrideUrgenciaMedica || false} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, overrideUrgenciaMedica: e.target.checked } })} disabled={isClosed} />
                                <span className="text-rose-900 font-black uppercase tracking-tight text-[11px]">Marcar urgencia médica pura de forma manual (Bloquea flujo)</span>
                            </label>
                            {interviewV4.seguridad?.overrideUrgenciaMedica && (
                                <textarea rows={2} className="w-full text-xs p-2.5 border border-rose-300 rounded outline-none bg-rose-50 text-rose-900 placeholder-rose-400 shadow-inner" placeholder="Escriba la justificación estricta de la urgencia..." value={interviewV4.seguridad.justificacionUrgencia || ""} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, justificacionUrgencia: e.target.value } })} disabled={isClosed} />
                            )}
                        </div>
                    </div>
                </details >

                {/* --- 4. HISTORIA Y MECANISMO (FOCO ACTIVO) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[5]} >
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(5); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">4</span>
                                <h3 className="font-bold text-slate-800 text-sm">Historia y Mecanismo <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {reqSec4.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">{3 - reqSec4.length}/3 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[5] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {reqSec4.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec4.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Entender cómo, cuándo y por qué empezó el problema en el foco principal.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Aparición insidiosa, hace 3 meses, empeorando gradualmente".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        {/* --- FOCO PRINCIPAL --- */}
                        <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 mb-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-indigo-600 font-bold text-xs uppercase tracking-wider">⭐ Foco Principal</span>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" placeholder="Región (Ej. Hombro)" className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none w-full bg-white" value={focoPrincipal?.region || ""} onChange={e => handleUpdateFocoPrincipal({ region: e.target.value })} disabled={isClosed} />
                                <select className="w-28 text-xs p-2 border border-slate-300 rounded outline-none bg-white shrink-0" value={focoPrincipal?.lado || "N/A"} onChange={e => handleUpdateFocoPrincipal({ lado: e.target.value as any })} disabled={isClosed}>
                                    <option value="N/A">Lado: N/A</option><option value="Izquierdo">Izquierdo</option><option value="Derecho">Derecho</option><option value="Bilateral">Bilateral</option>
                                </select>
                            </div>
                        </div>

                        {/* --- FOCOS SECUNDARIOS --- */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100">
                                <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Focos Secundarios (Opcional)</span>
                                <button onClick={handleAddFocoSecundario} disabled={isClosed || interviewV4.focos.length >= 5} className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-1 px-2 rounded border border-slate-200 transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50">
                                    <span>+</span> Añadir Foco Secundario
                                </button>
                            </div>
                            <div className="space-y-2">
                                {interviewV4.focos.filter(f => !f.esPrincipal).map((fs, idx) => (
                                    <div key={fs.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200 shadow-sm animate-fadeIn">
                                        <span className="text-[10px] text-slate-400 font-black w-4 text-center">{idx + 2}.</span>
                                        <input type="text" placeholder="Región secundaria..." className="flex-1 text-xs p-1.5 border border-slate-300 rounded outline-none w-full bg-white" value={fs.region || ""} onChange={e => {
                                            const newFocos = interviewV4.focos.map(f => f.id === fs.id ? { ...f, region: e.target.value } : f);
                                            updateV4({ focos: newFocos });
                                        }} disabled={isClosed} />
                                        <select className="w-24 text-xs p-1.5 border border-slate-300 rounded outline-none bg-white shrink-0" value={fs.lado || "N/A"} onChange={e => {
                                            const newFocos = interviewV4.focos.map(f => f.id === fs.id ? { ...f, lado: e.target.value as any } : f);
                                            updateV4({ focos: newFocos });
                                        }} disabled={isClosed}>
                                            <option value="N/A">N/A</option><option value="Izquierdo">Izq</option><option value="Derecho">Der</option><option value="Bilateral">Bilat</option>
                                        </select>
                                        <button onClick={() => handleDeleteFoco(fs.id)} disabled={isClosed} className="text-rose-400 hover:text-rose-600 p-1 flex items-center justify-center transition-colors">
                                            🗑
                                        </button>
                                    </div>
                                ))}
                                {interviewV4.focos.filter(f => !f.esPrincipal).length === 0 && (
                                    <div className="text-[10px] text-slate-400 italic py-1 text-center bg-slate-50/50 rounded border border-slate-100 border-dashed">No hay focos secundarios registrados.</div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-600">Inicio <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                    <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700" value={focoPrincipal?.inicio || "NoDefinido"} onChange={e => handleUpdateFocoPrincipal({ inicio: e.target.value as any })} disabled={isClosed}>
                                        <option value="NoDefinido">Inicio (Tipo)</option>
                                        <option value="Súbito">Súbito (Con/Sin Trauma)</option>
                                        <option value="Gradual">Gradual / Insidioso</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold text-slate-600">Antigüedad <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                    <input type="text" placeholder="Antigüedad (ej: 3 meses)" className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none" value={focoPrincipal?.antiguedad || ""} onChange={e => handleUpdateFocoPrincipal({ antiguedad: e.target.value })} disabled={isClosed} />
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal?.evolucion || "NoDefinido"} onChange={e => handleUpdateFocoPrincipal({ evolucion: e.target.value as any })} disabled={isClosed}>
                                    <option value="NoDefinido">Evolución Global</option>
                                    <option value="Mejorando">Mejorando</option>
                                    <option value="Estable">Estable / Igual</option>
                                    <option value="Empeorando">Empeorando</option>
                                    <option value="Fluctuante">Fluctuante</option>
                                </select>
                                <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal?.episodiosPrevios || "NoDefinido"} onChange={e => handleUpdateFocoPrincipal({ episodiosPrevios: e.target.value as any })} disabled={isClosed}>
                                    <option value="NoDefinido">Episodios Previos</option>
                                    <option value="Primer episodio">Primer episodio</option>
                                    <option value="Recurrencia (mismo dolor)">Recurrencia (mismo dolor)</option>
                                    <option value="Dolor similar lado contrario">Dolor similar lado contrario</option>
                                </select>
                            </div>
                        </div>

                        {/* --- RAMA SÚBITO --- */}
                        {focoPrincipal?.inicio === "Súbito" && (
                            <div className="bg-orange-50/50 border border-orange-100 p-3 rounded-lg space-y-3 mt-2">
                                <div className="font-bold text-orange-800 text-xs mb-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Detalles del Inicio Súbito
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">¿Hubo Contacto Externo?</label>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`contacto_${focoPrincipal.id}`} checked={focoPrincipal.subito?.contacto === true} onChange={() => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, contacto: true } })} disabled={isClosed} /> Sí</label>
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`contacto_${focoPrincipal.id}`} checked={focoPrincipal.subito?.contacto === false} onChange={() => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, contacto: false } })} disabled={isClosed} /> No</label>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[10px] uppercase font-bold text-slate-500">¿Hinchazón Rápida (0-2h)?</label>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`hinchazon_${focoPrincipal.id}`} checked={focoPrincipal.subito?.hinchazonRapida === "Sí"} onChange={() => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, hinchazonRapida: "Sí" } })} disabled={isClosed} /> Sí</label>
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`hinchazon_${focoPrincipal.id}`} checked={focoPrincipal.subito?.hinchazonRapida === "No"} onChange={() => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, hinchazonRapida: "No" } })} disabled={isClosed} /> No</label>
                                            <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name={`hinchazon_${focoPrincipal.id}`} checked={focoPrincipal.subito?.hinchazonRapida === "No Sabe"} onChange={() => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, hinchazonRapida: "No Sabe" } })} disabled={isClosed} /> N/S</label>
                                        </div>
                                    </div>
                                </div>

                                <select className="w-full text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal.subito?.capacidadInmediata || ""} onChange={e => handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, capacidadInmediata: e.target.value as any } })} disabled={isClosed}>
                                    <option value="" disabled>Capacidad inmediata post-lesión...</option>
                                    <option value="Continuó actividad">Continuó la actividad normalmente</option>
                                    <option value="Tuvo que parar">Tuvo que parar, pero podía caminar/cargar</option>
                                    <option value="Incapacidad total">Incapacidad total de carga/movimiento</option>
                                    <option value="No aplicable">No aplicable</option>
                                </select>

                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Cinemática (Opcional, Multiselección)</label>
                                    <div className="flex flex-wrap gap-1">
                                        {["Torsión", "Caída", "Golpe Directo", "Acel./Freno", "Aterrizaje", "Sobrestiramiento"].map(op => {
                                            const active = focoPrincipal.subito?.cinematica?.includes(op);
                                            return (
                                                <button key={op} onClick={() => {
                                                    const curr = focoPrincipal.subito?.cinematica || [];
                                                    const next = active ? curr.filter(x => x !== op) : [...curr, op];
                                                    handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, cinematica: next } });
                                                }} disabled={isClosed} className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${active ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    {op}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Sonido/Sensación (Opcional)</label>
                                    <div className="flex flex-wrap gap-1">
                                        {["Pop", "Crujido", "Chasquido", "Desgarro", "Bloqueo", "Inestabilidad"].map(op => {
                                            const active = focoPrincipal.subito?.sonidoSensacion?.includes(op);
                                            return (
                                                <button key={op} onClick={() => {
                                                    const curr = focoPrincipal.subito?.sonidoSensacion || [];
                                                    const next = active ? curr.filter(x => x !== op) : [...curr, op];
                                                    handleUpdateFocoPrincipal({ subito: { ...focoPrincipal.subito!, sonidoSensacion: next } });
                                                }} disabled={isClosed} className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${active ? 'bg-orange-100 border-orange-300 text-orange-800 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    {op}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* --- RAMA GRADUAL --- */}
                        {focoPrincipal?.inicio === "Gradual" && (
                            <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-lg space-y-4 mt-2">
                                <div className="font-bold text-indigo-800 text-xs mb-1 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Desglose de Cargas (Insidioso)
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Componente Lógico/Visual de Slider Custom */}
                                    {[
                                        { label: "Volumen", prop: "volumen" },
                                        { label: "Intensidad", prop: "intensidad" },
                                        { label: "Frecuencia", prop: "frecuencia" }
                                    ].map(item => {
                                        const val = focoPrincipal.gradual![item.prop as keyof typeof focoPrincipal.gradual] as number;
                                        return (
                                            <div key={item.prop} className="flex flex-col bg-white border border-slate-200 rounded p-2 shadow-sm">
                                                <div className="text-[10px] font-bold text-slate-600 uppercase text-center mb-1">{item.label}</div>
                                                <select className="text-[10px] p-1 border border-slate-100 rounded bg-slate-50 outline-none text-center"
                                                    value={val}
                                                    onChange={e => handleUpdateFocoPrincipal({ gradual: { ...focoPrincipal.gradual!, [item.prop]: Number(e.target.value) } })} disabled={isClosed}>
                                                    <option value={1}>Mucho Menos</option>
                                                    <option value={2}>Menos</option>
                                                    <option value={3}>Igual / Estable</option>
                                                    <option value={4}>Más</option>
                                                    <option value={5}>Mucho Más ↑</option>
                                                </select>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal.gradual?.recuperacion || ""} onChange={e => handleUpdateFocoPrincipal({ gradual: { ...focoPrincipal.gradual!, recuperacion: e.target.value as "Mejor" | "Igual" | "Peor" | "" } })} disabled={isClosed}>
                                        <option value="" disabled>Recuperación entre estímulos...</option>
                                        <option value="Mejor">Mejor / Más rápida</option>
                                        <option value="Igual">Igual</option>
                                        <option value="Peor">Peor / Lenta / Sin reparar</option>
                                    </select>
                                    <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal.gradual?.aparicionSintoma || ""} onChange={e => handleUpdateFocoPrincipal({ gradual: { ...focoPrincipal.gradual!, aparicionSintoma: e.target.value as "Al inicio" | "Durante" | "Después" | "Día siguiente" | "Constante" | "" } })} disabled={isClosed}>
                                        <option value="" disabled>¿Cuándo duele primario?</option>
                                        <option value="Al inicio">Al inicio (calienta y pasa)</option>
                                        <option value="Durante">Durante la acción/esfuerzo</option>
                                        <option value="Después">Después (enfriamiento)</option>
                                        <option value="Día siguiente">Día siguiente (DOMS+)</option>
                                        <option value="Constante">Constante</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-500">Cambios Específicos (Multiselección)</label>
                                    <div className="flex flex-wrap gap-1">
                                        {["Calzado", "Superficie", "Implemento", "Técnica biomecánica", "Estrés Vital Alto", "Mala nutrición / sueño"].map(op => {
                                            const active = focoPrincipal.gradual?.cambiosEspecificos?.includes(op);
                                            return (
                                                <button key={op} onClick={() => {
                                                    const curr = focoPrincipal.gradual?.cambiosEspecificos || [];
                                                    const next = active ? curr.filter(x => x !== op) : [...curr, op];
                                                    handleUpdateFocoPrincipal({ gradual: { ...focoPrincipal.gradual!, cambiosEspecificos: next } });
                                                }} disabled={isClosed} className={`px-2 py-1 text-[10px] rounded-full border transition-colors ${active ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                    {op}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* PICO DE CARGA [AUTO] */}
                                {(() => {
                                    const g = focoPrincipal.gradual;
                                    if (g && (g.volumen >= 4 || g.intensidad >= 4 || g.frecuencia >= 4)) {
                                        const motivos = [];
                                        if (g.volumen >= 4) motivos.push("aumento de volumen");
                                        if (g.intensidad >= 4) motivos.push("aumento de intensidad");
                                        if (g.frecuencia >= 4) motivos.push("aumento de frecuencia");
                                        const motivoStr = motivos.join(" y ");
                                        // Actualizamos el estado interno en background con useEffect en otro lado si fuera estricto, 
                                        // o lo derivamos para la UI y el envío. Lo mantenemos como derivada UI.
                                        return (
                                            <div className="mt-4 bg-purple-50/50 border border-purple-200 p-3 rounded-lg text-xs text-purple-900 flex flex-col gap-2">
                                                <div className="flex items-center gap-2 pb-2 border-b border-purple-200/60">
                                                    <span className="text-purple-500 font-bold">⚡</span>
                                                    <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">AUTO (no editable)</span>
                                                </div>
                                                <div>
                                                    <strong>Pico de Carga Probable</strong><br />
                                                    Identificado por reporte de {motivoStr}. Sugiere revisar la tolerancia de los tejidos previo a intervenciones estructurales puras.
                                                </div>
                                            </div>
                                        )
                                    }
                                    return null;
                                })()}
                            </div>
                        )}

                        <textarea className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" rows={2} placeholder="Contexto detallado (Ej: Cayó esquiando, o empezó a doler tras maratón)..." value={focoPrincipal?.contextoDetallado || ""} onChange={e => handleUpdateFocoPrincipal({ contextoDetallado: e.target.value })} disabled={isClosed} />

                        {/* --- MECANISMO DE DOLOR SUGERIDO (FASE 09) --- */}
                        <div className="bg-white border text-xs p-3.5 rounded-lg shadow-sm border-slate-200 mt-4">
                            <div className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span className="text-base">🧠</span> Tipo de Dolor Sugerido [AUTO]
                            </div>

                            {(() => {
                                const sugerencia = calcularMecanismoSugerido(focoPrincipal, interviewV4.bps);
                                if (!sugerencia) return null;

                                return (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded flex flex-col justify-center">
                                                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wide mb-0.5">Clasificación Principal</span>
                                                <span className="font-black text-indigo-900 text-sm leading-tight">{sugerencia.principal.categoria}</span>
                                                <span className="text-[10px] text-indigo-700 mt-0.5">"{sugerencia.principal.apellido}"</span>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 p-2.5 rounded flex flex-col justify-center opacity-80">
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide mb-0.5">Alternativa a revisar</span>
                                                <span className="font-bold text-slate-700 text-xs leading-tight">{sugerencia.alternativa.categoria}</span>
                                                <span className="text-[10px] text-slate-500 mt-0.5">"{sugerencia.alternativa.apellido}"</span>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Criterios Detectados</div>
                                            <ul className="text-[10px] text-slate-600 list-disc pl-4 space-y-1">
                                                {sugerencia.razones.map((r, i) => <li key={i}>{r}</li>)}
                                            </ul>
                                        </div>

                                        <div className="border-t border-slate-100 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="font-bold text-slate-600 text-[10px] uppercase">Decisión del Alumno:</div>
                                            <div className="flex bg-slate-100 rounded p-1 border border-slate-200">
                                                {(["De acuerdo", "Cambiar", "Dejar pendiente"] as const).map(opt => (
                                                    <button key={opt}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            let updateObj: any = { mecanismoConfirmacion: opt };
                                                            if (opt === "De acuerdo") {
                                                                updateObj.mecanismoCategoria = sugerencia.principal.categoria;
                                                                updateObj.mecanismoApellido = sugerencia.principal.apellido;
                                                                updateObj.mecanismoTextoFinal = `${sugerencia.principal.categoria}: de aparente origen ${sugerencia.principal.apellido}`;
                                                            }
                                                            handleUpdateFocoPrincipal(updateObj);
                                                        }}
                                                        disabled={isClosed}
                                                        className={`px-3 py-1 text-[10px] rounded font-bold transition-all whitespace-nowrap ${focoPrincipal?.mecanismoConfirmacion === opt ? 'bg-white shadow text-indigo-700 border border-slate-200/60' : 'text-slate-500 hover:text-slate-700'}`}>
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {focoPrincipal?.mecanismoConfirmacion === "Cambiar" && (
                                            <div className="bg-orange-50/50 p-3 rounded-lg border border-orange-200 mt-3 space-y-2 animate-fadeIn">
                                                <div className="text-[10px] font-bold text-orange-800 uppercase flex gap-1 items-center mb-1">
                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                    Sobreescritura Manual Activa
                                                </div>
                                                <select className="w-full p-2 text-xs border border-orange-200 bg-white rounded outline-none font-bold text-slate-700" value={focoPrincipal?.mecanismoCategoria || "NoDefinido"} onChange={e => {
                                                    const cat = e.target.value as FocoV4["mecanismoCategoria"];
                                                    const firstTypeOrEmpty = MECANISMOS_SUBTIPOS[cat]?.[0] || "";
                                                    let newTextoFinal = "";
                                                    if (cat === "NoDefinido") newTextoFinal = "No definido";
                                                    else if (cat === "Nociplástico") newTextoFinal = "Aparente nociplástico (sensibilización central probable)";
                                                    else if (cat === "Mixto") newTextoFinal = `Mixto: ${firstTypeOrEmpty}`;
                                                    else newTextoFinal = `Aparente ${cat.toLowerCase()} de origen ${firstTypeOrEmpty}`;
                                                    handleUpdateFocoPrincipal({ mecanismoCategoria: cat, mecanismoApellido: firstTypeOrEmpty, mecanismoTextoFinal: newTextoFinal });
                                                }} disabled={isClosed}>
                                                    {MECANISMOS_CATEGORIAS.map(c => <option key={c} value={c}>{c === 'NoDefinido' ? 'Categoría: No Definido' : `Categoría: ${c}`}</option>)}
                                                </select>

                                                {focoPrincipal?.mecanismoCategoria !== "NoDefinido" && (
                                                    <select className="w-full p-2 text-xs border border-orange-200 bg-white rounded outline-none font-bold text-slate-600" value={focoPrincipal?.mecanismoApellido || ""} onChange={e => {
                                                        const cat = focoPrincipal?.mecanismoCategoria || "NoDefinido";
                                                        const apellido = e.target.value;
                                                        let newTextoFinal = "";
                                                        if (cat === "Nociplástico") newTextoFinal = "Aparente nociplástico (sensibilización central probable)";
                                                        else if (cat === "Mixto") newTextoFinal = `Mixto: ${apellido}`;
                                                        else newTextoFinal = `Aparente ${cat.toLowerCase()} de origen ${apellido}`;
                                                        handleUpdateFocoPrincipal({ mecanismoApellido: apellido, mecanismoTextoFinal: newTextoFinal });
                                                    }} disabled={isClosed}>
                                                        {MECANISMOS_SUBTIPOS[focoPrincipal?.mecanismoCategoria || "NoDefinido"].map(sub => (
                                                            <option key={sub} value={sub}>{sub}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </details >

                {/* --- 5. TAGS CLAVE (FOCO ACTIVO) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[6]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(6); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">5</span>
                            <h3 className="font-bold text-slate-800 text-sm">Tags y Modificadores <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[6] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Identificar características del dolor y actividades que lo alteran.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Dolor punzante, empeora al agacharse, alivia en reposo".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        <div className="bg-white border text-xs border-slate-300 p-2.5 rounded shadow-sm">
                            <div className="font-bold text-slate-600 mb-2">Tags Clave (Síntomas / Sensaciones)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {TAGS_SINTOMAS.map(tag => {
                                    const isIncluded = focoPrincipal?.tags.includes(tag);
                                    return (
                                        <button key={tag} disabled={isClosed}
                                            onClick={() => {
                                                const curr = focoPrincipal?.tags || [];
                                                handleUpdateFocoPrincipal({ tags: isIncluded ? curr.filter(x => x !== tag) : [...curr, tag] });
                                            }}
                                            className={`px-2.5 py-1 rounded-full border transition-colors ${isIncluded ? 'bg-indigo-500 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            {tag}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <textarea rows={2} placeholder="Factores Agravantes (movimientos, posturas)..." className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={focoPrincipal?.agravantes || ""} onChange={e => handleUpdateFocoPrincipal({ agravantes: e.target.value })} disabled={isClosed} />
                        <textarea rows={2} placeholder="Factores Aliviantes (reposo, hielo, fármacos)..." className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={focoPrincipal?.aliviantes || ""} onChange={e => handleUpdateFocoPrincipal({ aliviantes: e.target.value })} disabled={isClosed} />
                    </div>
                </details >

                {/* --- 6. PERFIL DEL SÍNTOMA (FOCO ACTIVO) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[7]} >
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(7); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">6</span>
                                <h3 className="font-bold text-slate-800 text-sm">Perfil del Síntoma <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {reqSec5.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">{1 - reqSec5.length}/1 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[7] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {reqSec5.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec5.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-4">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Cuantificar la intensidad del síntoma actual y sus extremos recientes.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Dolor actual 4/10, peor momento en la mañana 7/10".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>

                        {/* 1. Ubicación Detallada */}
                        <div className="space-y-2">
                            <div className="font-bold text-slate-600 text-xs">Ubicación y Dispersión</div>
                            <div className="flex gap-2">
                                <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal?.extension || "NoDefinido"} onChange={e => handleUpdateFocoPrincipal({ extension: e.target.value as any })} disabled={isClosed}>
                                    <option value="NoDefinido">Extensión de la zona...</option>
                                    <option value="Local">Local (puntual, dedo)</option>
                                    <option value="Se expande">Se expande (área amplia)</option>
                                    <option value="Línea que baja/sube">Línea que baja/sube</option>
                                    <option value="Cambia de lugar">Cambia de lugar erráticamente</option>
                                </select>
                                <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal?.profundidad || "NoDefinido"} onChange={e => handleUpdateFocoPrincipal({ profundidad: e.target.value as any })} disabled={isClosed}>
                                    <option value="NoDefinido">Profundidad...</option>
                                    <option value="Superficial">Superficial (Piel / Cerca)</option>
                                    <option value="Profundo">Profundo</option>
                                    <option value="Articular">Adentro de la articulación</option>
                                    <option value="NoSabe">Difícil de precisar</option>
                                </select>
                            </div>
                        </div>

                        {/* 2. Naturaleza (Chips) */}
                        <div className="space-y-1.5">
                            <div className="font-bold text-slate-600 text-xs">Naturaleza (A qué se parece)</div>
                            <div className="flex flex-wrap gap-1.5">
                                {["Punzante/Aguja", "Quemazón/Ardor", "Sordo/Pesado", "Eléctrico/Corriente", "Latido/Palpitante", "Tensión/Tirón", "Calambre"].map(op => {
                                    const active = focoPrincipal?.naturaleza?.includes(op);
                                    return (
                                        <button key={op} disabled={isClosed}
                                            onClick={() => {
                                                const curr = focoPrincipal?.naturaleza || [];
                                                const next = active ? curr.filter(x => x !== op) : [...curr, op];
                                                handleUpdateFocoPrincipal({ naturaleza: next });
                                            }}
                                            className={`px-2.5 py-1 text-[10px] rounded-full border transition-colors ${active ? 'bg-indigo-100 border-indigo-300 text-indigo-800 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                                            {op}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Escala y Severidad */}
                        <div className="space-y-3 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                                <div className="font-bold text-slate-800 text-xs">Severidad e Intensidad</div>
                                <div className="flex gap-3 text-xs">
                                    <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-600">
                                        <input type="radio" checked={interviewV4.escalaDolorGlobal === "EVA"} onChange={() => updateV4({ escalaDolorGlobal: "EVA" })} disabled={isClosed} />
                                        Escala Visual Análoga (EVA)
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer font-bold text-slate-600">
                                        <input type="radio" checked={interviewV4.escalaDolorGlobal === "ENA"} onChange={() => updateV4({ escalaDolorGlobal: "ENA" })} disabled={isClosed} />
                                        Escala Numérica Análoga (ENA)
                                    </label>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 flex-wrap" title={interviewV4.escalaDolorGlobal === "EVA" ? "Escala Visual Análoga" : "Escala Numérica Análoga"}>Actual <span className="text-[9px] text-slate-400 font-normal border border-slate-200 rounded px-1">{interviewV4.escalaDolorGlobal}</span><span className="text-[9px] text-rose-500 italic normal-case w-full mt-0.5">*obligatorio</span></label>
                                    <input type="number" min="0" max="10" placeholder="0-10" className="w-full text-center text-xs p-2 border border-slate-300 rounded outline-none mt-1" value={focoPrincipal?.dolorActual ?? ''} onChange={e => handleUpdateFocoPrincipal({ dolorActual: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Peor 24h <span className="text-[9px] text-slate-400 font-normal border border-slate-200 rounded px-1">{interviewV4.escalaDolorGlobal}</span></label>
                                    <input type="number" min="0" max="10" placeholder="0-10" className="w-full text-center text-xs p-2 border border-slate-300 rounded outline-none mt-1" value={focoPrincipal?.peor24h ?? ''} onChange={e => handleUpdateFocoPrincipal({ peor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                </div>
                                <div className="flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">Mejor 24h <span className="text-[9px] text-slate-400 font-normal border border-slate-200 rounded px-1">{interviewV4.escalaDolorGlobal}</span></label>
                                    <input type="number" min="0" max="10" placeholder="0-10" className="w-full text-center text-xs p-2 border border-slate-300 rounded outline-none mt-1" value={focoPrincipal?.mejor24h ?? ''} onChange={e => handleUpdateFocoPrincipal({ mejor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 bg-white p-2 border border-slate-200 rounded">
                                <div className="flex-1 w-full flex flex-col">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">En Actividad Índice (Agravante req.)</label>
                                    <div className="flex flex-col sm:flex-row gap-2 relative">
                                        <input type="text" placeholder="Ej: Correr 5km, subir escaleras..." className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none w-full"
                                            value={focoPrincipal?.actividadIndice || ""}
                                            onChange={e => handleUpdateFocoPrincipal({ actividadIndice: e.target.value })}
                                            disabled={isClosed} />
                                        {/* Botón de auto-fill si existe un PSFS principal */}
                                        {interviewV4.psfsGlobal?.length > 0 && interviewV4.psfsGlobal[0].actividad.trim() !== "" && (
                                            <button
                                                onClick={() => handleUpdateFocoPrincipal({ actividadIndice: interviewV4.psfsGlobal[0].actividad })}
                                                disabled={isClosed}
                                                className="absolute -top-5 right-1 text-[9px] text-indigo-600 font-bold hover:underline bg-white px-1"
                                            >
                                                Usar Escala Funcional Específica (PSFS) 1
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="w-full sm:w-20 flex flex-col shrink-0">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 hidden sm:block">{interviewV4.escalaDolorGlobal}</label>
                                    <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 sm:hidden">Dolor en la actividad</label>
                                    <input type="number" min="0" max="10" placeholder="0-10" className="w-full text-center text-xs p-2 border border-slate-300 rounded outline-none" value={focoPrincipal?.dolorActividadIndice ?? ''} onChange={e => handleUpdateFocoPrincipal({ dolorActividadIndice: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                </div>
                            </div>
                        </div>

                        {/* 4. Patrón Temporal */}
                        <div className="space-y-2">
                            <div className="font-bold text-slate-600 text-xs">Patrón Temporal</div>
                            <div className="flex gap-2">
                                <select className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={focoPrincipal?.patronTemporal?.frecuencia || "NoDefinido"} onChange={e => {
                                    const curr = focoPrincipal?.patronTemporal || { frecuencia: "NoDefinido", rigidezMatinalMinutos: null, despiertaNoche: null };
                                    handleUpdateFocoPrincipal({ patronTemporal: { ...curr, frecuencia: e.target.value as any } });
                                }} disabled={isClosed}>
                                    <option value="NoDefinido">Frecuencia...</option>
                                    <option value="Constante (24/7)">Constante (24/7)</option>
                                    <option value="Intermitente">Intermitente (Va y viene)</option>
                                    <option value="Solo al mover">Solo al realizar el movimiento</option>
                                </select>
                                <div className="flex-1 border border-slate-300 rounded overflow-hidden flex items-center bg-white px-2">
                                    <span className="text-xs text-slate-500 mr-2 whitespace-nowrap">Rigidez am:</span>
                                    <input type="number" min="0" placeholder="Mins" className="w-full text-xs p-1 outline-none text-right placeholder-slate-300 bg-transparent" value={focoPrincipal?.patronTemporal?.rigidezMatinalMinutos ?? ''} onChange={e => {
                                        const curr = focoPrincipal?.patronTemporal || { frecuencia: "NoDefinido", rigidezMatinalMinutos: null, despiertaNoche: null };
                                        handleUpdateFocoPrincipal({ patronTemporal: { ...curr, rigidezMatinalMinutos: e.target.value ? Number(e.target.value) : null } });
                                    }} disabled={isClosed} />
                                </div>
                            </div>
                            <div className="flex gap-2 text-xs bg-slate-50 p-2.5 border border-slate-200 rounded items-center justify-between">
                                <span className="font-bold text-slate-600">¿El síntoma lo(a) despierta por la noche?</span>
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={focoPrincipal?.patronTemporal?.despiertaNoche === true} onChange={() => {
                                            const curr = focoPrincipal?.patronTemporal || { frecuencia: "NoDefinido", rigidezMatinalMinutos: null, despiertaNoche: null };
                                            handleUpdateFocoPrincipal({ patronTemporal: { ...curr, despiertaNoche: true } });
                                        }} disabled={isClosed} /> Sí
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input type="radio" checked={focoPrincipal?.patronTemporal?.despiertaNoche === false} onChange={() => {
                                            const curr = focoPrincipal?.patronTemporal || { frecuencia: "NoDefinido", rigidezMatinalMinutos: null, despiertaNoche: null };
                                            handleUpdateFocoPrincipal({ patronTemporal: { ...curr, despiertaNoche: false } });
                                        }} disabled={isClosed} /> No
                                    </label>
                                </div>
                            </div>
                        </div>

                    </div>
                </details >

                {/* --- 7. IRRITABILIDAD AUTO (FOCO ACTIVO) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[8] || true} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(8); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">7</span>
                            <h3 className="font-bold text-slate-800 text-sm">Irritabilidad <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[75] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-4">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Medir la facilidad con la que el dolor se activa y su tiempo de recuperación.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Se irrita fácilmente al trotar 1 min y tarda horas en calmarse".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>

                        {/* Fila 1: Facilidad y Tiempo */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Facilidad de provocación</label>
                                <div className="flex bg-slate-100 rounded border border-slate-200 p-1">
                                    {(["Baja", "Media", "Alta"] as const).map(f => (
                                        <button key={f} disabled={isClosed}
                                            onClick={(e) => { e.preventDefault(); handleUpdateFocoPrincipal({ irritabilidadFacilidad: f }); }}
                                            className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-all ${focoPrincipal?.irritabilidadFacilidad === f ? 'bg-white shadow text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Tiempo a línea base</label>
                                <select className="w-full p-2 border border-slate-300 bg-white rounded outline-none text-xs text-slate-700"
                                    value={focoPrincipal?.irritabilidadTiempo || "NoDefinido"}
                                    onChange={e => handleUpdateFocoPrincipal({ irritabilidadTiempo: e.target.value as any })}
                                    disabled={isClosed}>
                                    <option value="NoDefinido">Seleccionar...</option>
                                    <option value="<15m">&lt; 15 minutos</option>
                                    <option value="15-60m">15 a 60 minutos</option>
                                    <option value="1-24h">1 a 24 horas</option>
                                    <option value=">24h">&gt; 24 horas</option>
                                </select>
                            </div>
                        </div>

                        {/* Fila 2: Magnitud y After-Efecto */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1.5 block">After-efecto al día siguiente</label>
                                <div className="flex bg-slate-100 rounded border border-slate-200 p-1">
                                    {(["Nunca", "A veces", "Frecuente"] as const).map(a => (
                                        <button key={a} disabled={isClosed}
                                            onClick={(e) => { e.preventDefault(); handleUpdateFocoPrincipal({ irritabilidadAfterEfecto: a }); }}
                                            className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-all ${focoPrincipal?.irritabilidadAfterEfecto === a ? 'bg-white shadow text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {a}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 mb-1.5 block">Magnitud típica al gatillarse (0-10)</label>
                                <input type="number" min="0" max="10" placeholder="0-10"
                                    className="w-full text-center text-xs p-2.5 border border-slate-300 rounded outline-none"
                                    value={focoPrincipal?.irritabilidadMagnitud ?? ''}
                                    onChange={e => handleUpdateFocoPrincipal({ irritabilidadMagnitud: e.target.value ? Number(e.target.value) : null })}
                                    disabled={isClosed} />
                            </div>
                        </div>

                    </div>
                </details >

                {/* --- 8. SÍNTOMAS ASOCIADOS (FOCO ACTIVO) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[9]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(9); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">8</span>
                            <h3 className="font-bold text-slate-800 text-sm">Síntomas Asociados <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[8] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-4">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Rastrear otros signos mecánicos o neurológicos relacionados al foco.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Rodilla cruje y se traba (mecánico), hormigueo hasta el pie (neuro)".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        {/* Síntomas Mecánicos */}
                        <div>
                            <div className="font-bold text-slate-600 text-[10px] uppercase mb-1.5 tracking-wide">Síntomas Mecánicos Asociados</div>
                            <div className="flex flex-wrap gap-1.5">
                                {["Chasquido/Ruido", "Bloqueo/Trabe", "Fallo/Inestabilidad", "Rigidez Severa", "Pérdida Rango"].map(mec => (
                                    <button key={mec} disabled={isClosed}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const arr = focoPrincipal?.sintomasMecanicos || [];
                                            const newArr = arr.includes(mec) ? arr.filter(x => x !== mec) : [...arr, mec];
                                            handleUpdateFocoPrincipal({ sintomasMecanicos: newArr });
                                        }}
                                        className={`px-2.5 py-1 text-[9px] rounded-full font-bold transition-all border ${focoPrincipal?.sintomasMecanicos?.includes(mec) ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                        {mec}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Síntomas Sistémicos */}
                        <div>
                            <div className="font-bold text-rose-600 text-[10px] uppercase mb-1.5 tracking-wide">Síntomas Sistémicos</div>
                            <div className="flex flex-wrap gap-1.5">
                                {["Fiebre constante", "Sudoración nocturna", "Baja de peso inexplicada", "Mareos/Vértigo", "Malestar general"].map(sis => (
                                    <button key={sis} disabled={isClosed}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const arr = focoPrincipal?.sintomasSistemicos || [];
                                            const newArr = arr.includes(sis) ? arr.filter(x => x !== sis) : [...arr, sis];
                                            handleUpdateFocoPrincipal({ sintomasSistemicos: newArr });
                                        }}
                                        className={`px-2.5 py-1 text-[9px] rounded-full font-bold transition-all border ${focoPrincipal?.sintomasSistemicos?.includes(sis) ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}>
                                        {sis}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Síntomas Neurológicos */}
                        <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                            <div className="font-bold text-indigo-800 text-xs mb-2 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Síntomas Neurológicos
                            </div>
                            <div className="flex flex-wrap gap-1.5 mb-3">
                                {["Hormigueo/Adormecimiento", "Pérdida de Sensibilidad", "Debilidad/Pérdida de fuerza", "Corriente eléctrica"].map(neu => (
                                    <button key={neu} disabled={isClosed}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const neuro = focoPrincipal?.sintomasNeurologicos || { activados: [], zona: "", asociacion: [] };
                                            const activados = [...neuro.activados];
                                            const idx = activados.indexOf(neu);
                                            if (idx > -1) activados.splice(idx, 1); else activados.push(neu);
                                            handleUpdateFocoPrincipal({ sintomasNeurologicos: { ...neuro, activados } });
                                        }}
                                        className={`px-2.5 py-1 text-[9px] rounded-full font-bold transition-all border ${focoPrincipal?.sintomasNeurologicos?.activados?.includes(neu) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>
                                        {neu}
                                    </button>
                                ))}
                            </div>

                            {/* Sub-bloque Neurológico */}
                            {focoPrincipal?.sintomasNeurologicos?.activados?.length > 0 && (
                                <div className="mt-3 p-3 bg-white rounded border border-indigo-200 space-y-3 animate-fadeIn">
                                    <div>
                                        <div className="font-bold text-[10px] text-indigo-700 uppercase mb-1">Zona Anatómica Específica:</div>
                                        <select className="w-full p-2 border border-slate-200 bg-slate-50 rounded outline-none text-xs text-slate-700 font-bold"
                                            value={focoPrincipal.sintomasNeurologicos.zona}
                                            onChange={e => handleUpdateFocoPrincipal({ sintomasNeurologicos: { ...focoPrincipal.sintomasNeurologicos, zona: e.target.value } })}
                                            disabled={isClosed}>
                                            <option value="">Selecciona Zona Dermatómica / Territorio</option>
                                            <option value="Cervical Alto (C1-C4)">Cervical Alto (C1-C4)</option>
                                            <option value="Braquial (C5-T1)">Braquial (C5-T1) - Hombro/Brazo/Mano</option>
                                            <option value="Truncular / Tórax (T2-T12)">Truncular / Tórax (T2-T12)</option>
                                            <option value="Lumbar (L1-L4)">Lumbar (L1-L4) - Muslo anterior/Ingle</option>
                                            <option value="Lumbosacro (L5-S3)">Lumbosacro (L5-S3) - Posterior/Pierna/Pie</option>
                                            <option value="Pudendo / Pélvico (S2-S4)">Pudendo / Pélvico (S2-S4)</option>
                                            <option value="Otro / Periférico distal">Otro / Periférico distal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <div className="font-bold text-[10px] text-indigo-700 uppercase mb-1">Se gatillan / asocian a: (Disparadores)</div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {["Mover Cuello/Cabeza", "Sentado mucho rato", "Levantar brazos", "Caminar prolongado", "Agacharse/Flexión", "Cambios postura ráp.", "Esfuerzo/Tos/Estornudo"].map(aso => (
                                                <button key={aso} disabled={isClosed}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const neuro = focoPrincipal?.sintomasNeurologicos || { activados: [], zona: "", asociacion: [] };
                                                        const asociacion = [...neuro.asociacion];
                                                        const idx = asociacion.indexOf(aso);
                                                        if (idx > -1) asociacion.splice(idx, 1); else asociacion.push(aso);

                                                        // Lógica AUTO para Descartes
                                                        const disp = `${neuro.zona || "Neuro"}: ${aso}`;
                                                        let descartesCpy = [...(focoPrincipal?.disparadoresParaDescartes || [])];
                                                        if (idx > -1) {
                                                            descartesCpy = descartesCpy.filter(d => d !== disp);
                                                        } else {
                                                            if (!descartesCpy.includes(disp)) descartesCpy.push(disp);
                                                        }

                                                        handleUpdateFocoPrincipal({
                                                            sintomasNeurologicos: { ...neuro, asociacion },
                                                            disparadoresParaDescartes: descartesCpy
                                                        });
                                                    }}
                                                    className={`px-2 py-1 text-[9px] rounded font-bold transition-all ${focoPrincipal?.sintomasNeurologicos?.asociacion?.includes(aso) ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-sm' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                                                    {aso}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </details >

                {/* --- 9. SIGNO COMPARABLE (C0 BASAL) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[10]} >
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(10); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">9</span>
                                <h3 className="font-bold text-slate-800 text-sm">Signo Comparable <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {reqSec9.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">{2 - reqSec9.length}/2 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[10] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {reqSec9.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec9.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Establecer un test clínico rápido para medir progreso intradía.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Dolor 6/10 al hacer una sentadilla profunda".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                            <div className="flex-1 w-full flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-slate-600">Gesto o movimiento <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                <input type="text" placeholder="Ej: Ponerse de pie..." className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={focoPrincipal?.signoComparable || ""} onChange={e => handleUpdateFocoPrincipal({ signoComparable: e.target.value })} disabled={isClosed} />
                            </div>
                            <div className="w-full sm:w-20 flex flex-col gap-1 sm:items-center">
                                <label className="text-[10px] font-bold text-slate-600 sm:whitespace-nowrap">Dolor allí <span className="text-[9px] text-rose-500 italic font-normal">*</span></label>
                                <input type="number" min="0" max="10" className="w-full text-center text-xs p-2.5 border border-slate-300 rounded outline-none" value={focoPrincipal?.dolorEnSigno ?? ''} onChange={e => handleUpdateFocoPrincipal({ dolorEnSigno: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                            </div>
                        </div>
                    </div>
                </details >

                {/* --- 10. FUNCIÓN Y PSFS (GLOBAL) --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[11] || true} >
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(11); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">10</span>
                                <h3 className="font-bold text-slate-800 text-sm">Escala Funcional Específica (PSFS) <span className="text-slate-400 font-normal">(Global)</span></h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {!interviewV4.hayLimitacionFuncional ? (
                                    <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">No Aplica</span>
                                ) : reqSec10.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">0/1 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[11] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {interviewV4.hayLimitacionFuncional && reqSec10.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec10.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3 space-y-4 bg-slate-50/50 rounded-b-xl">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Identificar actividades clave limitadas y su impacto en la vida.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "No puedo subir escaleras (3/10) - Afecta mi trabajo".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-2 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>

                        {/* Pregunta Control */}
                        <div className="flex items-center justify-between bg-white p-3 rounded shadow-sm border border-slate-200">
                            <span className="font-bold text-slate-700 text-xs">¿Hay limitación funcional actual?</span>
                            <div className="flex bg-slate-100 rounded p-1">
                                <button
                                    onClick={(e) => { e.preventDefault(); updateV4({ hayLimitacionFuncional: true }); }}
                                    className={`px-4 py-1.5 text-[10px] rounded font-bold transition-all ${interviewV4.hayLimitacionFuncional ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}
                                >
                                    Sí
                                </button>
                                <button
                                    onClick={(e) => { e.preventDefault(); updateV4({ hayLimitacionFuncional: false }); }}
                                    className={`px-4 py-1.5 text-[10px] rounded font-bold transition-all ${!interviewV4.hayLimitacionFuncional ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}
                                >
                                    No
                                </button>
                            </div>
                        </div>

                        {!interviewV4.hayLimitacionFuncional ? (
                            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-800 text-xs text-center">
                                <strong>Sin Escala Funcional Específica (PSFS) (preventivo / rendimiento).</strong><br />
                                Se usa el <span className="underline">Objetivo Estructurado</span> (Sección 1) como ancla de revaluación.
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fadeIn">
                                {/* Lista PSFS */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-slate-700">Escala Funcional Específica (PSFS) <span className="text-[9px] text-rose-500 italic font-normal">* 1 obligatorio</span></label>
                                        <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded">{interviewV4.psfsGlobal.length} / 5</span>
                                    </div>

                                    <div className="space-y-2">
                                        {interviewV4.psfsGlobal.map((item, index) => (
                                            <div key={item.id} className="flex gap-2 items-center">
                                                <span className="text-slate-400 font-bold text-xs w-4">{index + 1}.</span>
                                                <input
                                                    type="text"
                                                    placeholder="Actividad limitada (ej: Correr 5km)"
                                                    className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none"
                                                    value={item.actividad}
                                                    onChange={(e) => {
                                                        const newPsfs = [...interviewV4.psfsGlobal];
                                                        newPsfs[index].actividad = e.target.value;
                                                        updateV4({ psfsGlobal: newPsfs });
                                                    }}
                                                    disabled={isClosed}
                                                />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="10"
                                                    placeholder="0-10"
                                                    className="w-16 text-center text-xs p-2 border border-slate-300 rounded outline-none"
                                                    value={item.score ?? ''}
                                                    onChange={(e) => {
                                                        const newPsfs = [...interviewV4.psfsGlobal];
                                                        newPsfs[index].score = e.target.value ? Number(e.target.value) : null;
                                                        updateV4({ psfsGlobal: newPsfs });
                                                    }}
                                                    disabled={isClosed}
                                                />
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const newPsfs = interviewV4.psfsGlobal.filter((_, i) => i !== index);
                                                        updateV4({ psfsGlobal: newPsfs });
                                                    }}
                                                    className="text-rose-400 hover:text-rose-600 p-1"
                                                    disabled={isClosed}
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    {interviewV4.psfsGlobal.length < 5 && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                updateV4({
                                                    psfsGlobal: [...interviewV4.psfsGlobal, { id: uuidv4(), actividad: "", score: null, focoAsociado: "General" }]
                                                });
                                            }}
                                            className="mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                            disabled={isClosed}
                                        >
                                            + Agregar Actividad
                                        </button>
                                    )}
                                </div>

                                {/* Participación e Impacto */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1.5 block">Participación afectada (Roles)</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {["Trabajo", "Deporte", "Hogar", "Estudio", "Social/Recreación"].map(part => (
                                                <button key={part} disabled={isClosed}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        const arr = interviewV4.participacionAfectada || [];
                                                        const newArr = arr.includes(part) ? arr.filter(x => x !== part) : [...arr, part];
                                                        updateV4({ participacionAfectada: newArr });
                                                    }}
                                                    className={`px-2.5 py-1 text-[9px] rounded-full font-bold transition-all border ${interviewV4.participacionAfectada?.includes(part) ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                                    {part}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1.5 block">Impacto Global</label>
                                        <div className="flex bg-slate-100 rounded border border-slate-200 p-1">
                                            {(["Bajo", "Medio", "Alto"] as const).map(imp => (
                                                <button key={imp} disabled={isClosed}
                                                    onClick={(e) => { e.preventDefault(); updateV4({ impactoGlobal: imp }); }}
                                                    className={`flex-1 text-[10px] py-1.5 rounded font-bold transition-all ${interviewV4.impactoGlobal === imp ? 'bg-white shadow text-indigo-700 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                                    {imp}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </details >


                {/* --- 11. NOTAS RÁPIDAS (FOCO ACTIVO) --- */}
                {/* --- MÓDULO: NOTAS RÁPIDAS --- */}
                <div className="group bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📝</span>
                            <h3 className="font-bold text-slate-800 text-sm">Notas Rápidas <span className="text-indigo-400 font-normal">({focoPrincipal?.region || 'Sin región'})</span></h3>
                        </div>
                    </div>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        <div className="bg-amber-50/30 border border-amber-200 text-xs p-2.5 rounded shadow-sm">
                            <div className="font-bold text-amber-700 mb-2">Notas Históricas de Captura</div>
                            <textarea
                                className="w-full h-full min-h-[100px] text-xs p-2.5 border border-slate-200 rounded outline-none bg-amber-50/30 text-slate-700 leading-relaxed"
                                placeholder="..."
                                value={focoPrincipal?.notaRapida || ""}
                                onChange={e => handleUpdateFocoPrincipal({ notaRapida: e.target.value })}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>

                {/* --- 11. BPS & FACTORES PSICOSOCIALES --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[12]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(12); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">11</span>
                            <h3 className="font-bold text-slate-800 text-sm">Factores Biopsicosociales (BPS)</h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[12] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        <div className="flex items-center gap-2 pb-2 mb-3 border-b border-blue-200 mt-4">
                            {!isExpertMode && (
                                <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 w-full">
                                    <p><span className="font-bold text-blue-700">Objetivo:</span> Detectar miedos, estrés o factores sociales que podrían cronificar el dolor.</p>
                                    <p><span className="font-bold text-blue-700">Ejemplo:</span> "Miedo enorme a tener que operarse".</p>
                                </div>
                            )}
                            <div className="flex items-center gap-2 w-full pt-1">
                                <span className="text-blue-500 font-bold">✏️</span>
                                <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-3">
                            {FACTORES_BPS_LIST.map(factor => (
                                <div key={factor} className={`text-xs border rounded p-2 flex flex-col justify-between transition-colors ${(interviewV4.bps as any)[factor] === 2 ? 'bg-rose-50 border-rose-200' : (interviewV4.bps as any)[factor] === 1 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-200'}`}>
                                    <div className="font-bold text-slate-700 mb-2 truncate" title={factor}>{factor}</div>
                                    <div className="flex bg-white rounded overflow-hidden border border-slate-200">
                                        {[0, 1, 2].map(val => (
                                            <button
                                                key={val}
                                                disabled={isClosed}
                                                onClick={() => { updateV4({ bps: { ...interviewV4.bps, [factor]: val } }); }}
                                                className={`flex-1 py-1 text-[10px] font-black transition-colors ${(interviewV4.bps as any)[factor] === val ? (val === 0 ? 'bg-emerald-500 text-white' : val === 1 ? 'bg-amber-400 text-white' : 'bg-rose-500 text-white') : 'bg-transparent text-slate-400 hover:bg-slate-100'}`}
                                            >
                                                {val === 0 ? '0' : val === 1 ? '1' : '2'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <textarea rows={1} placeholder="Otros factores BPS relevantes..." className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={interviewV4.bps?.otros || ""} onChange={e => updateV4({ bps: { ...interviewV4.bps, otros: e.target.value } })} disabled={isClosed} />
                    </div>
                </details >

                {/* --- 12. CONTEXTO DEPORTIVO Y TRABAJO --- */}
                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[13]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(13); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">12</span>
                            <h3 className="font-bold text-slate-800 text-sm">Contexto Deportivo y Laboral</h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[12] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-slate-100 pt-3">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Conocer demandas físicas habituales y barreras de tiempo o dinero.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Trabaja cargando peso, entrena CrossFit 3x/semana".</p>
                            </div>
                        )}
                        <div className="flex items-center gap-2 pb-3 mb-3 border-b border-blue-200">
                            <span className="text-blue-500 font-bold">✏️</span>
                            <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                        </div>
                        {/* DEPORTIVO */}
                        <div className="mb-6">
                            <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
                                <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500" checked={interviewV4.contextoDeportivo?.aplica || false} onChange={e => updateV4({ contextoDeportivo: { ...(interviewV4.contextoDeportivo || {}), aplica: e.target.checked } as any })} disabled={isClosed} />
                                <span className="text-sm font-bold text-slate-800">Practica deporte o actividad física regular</span>
                            </label>
                            {interviewV4.contextoDeportivo?.aplica && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6 border-l-2 border-indigo-100">
                                    <input type="text" placeholder="Deporte Principal (ej. Fútbol, CrossFit)" className="text-xs p-2.5 border border-slate-300 rounded outline-none" value={interviewV4.contextoDeportivo?.deportePrincipal || ""} onChange={e => updateV4({ contextoDeportivo: { ...interviewV4.contextoDeportivo, deportePrincipal: e.target.value } as any })} disabled={isClosed} />
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input type="number" min="0" placeholder="Horas/sem" className="w-full sm:w-24 text-xs p-2.5 border border-slate-300 rounded outline-none" value={interviewV4.contextoDeportivo?.horasSemanales || ""} onChange={e => updateV4({ contextoDeportivo: { ...interviewV4.contextoDeportivo, horasSemanales: e.target.value ? parseFloat(e.target.value) : 0 } as any })} disabled={isClosed} />
                                        <select className="w-full sm:flex-1 text-xs p-2.5 border border-slate-300 rounded outline-none bg-white font-medium" value={interviewV4.contextoDeportivo?.nivel || "Recreativo"} onChange={e => updateV4({ contextoDeportivo: { ...interviewV4.contextoDeportivo, nivel: e.target.value as any } as any })} disabled={isClosed}>
                                            <option value="Recreativo">Recreativo</option><option value="Amateur">Amateur / Competitivo</option><option value="Semipro">Semiprofesional</option><option value="Profesional">Profesional / Elite</option>
                                        </select>
                                    </div>
                                    <select className="text-xs p-2.5 border border-slate-300 rounded outline-none bg-white font-medium" value={interviewV4.contextoDeportivo?.objetivoRetorno || "Recreativo"} onChange={e => updateV4({ contextoDeportivo: { ...interviewV4.contextoDeportivo, objetivoRetorno: e.target.value as any } as any })} disabled={isClosed}>
                                        <option value="Recreativo">Objetivo: Salud y recreación</option><option value="Mantener">Objetivo: Mantener rendimiento</option><option value="Retornar">Objetivo: Retornar tras lesión (RTP)</option><option value="Competir">Objetivo: Competencia inminente</option>
                                    </select>
                                    <textarea rows={1} placeholder="Cambios recientes de carga, calzado, técnica..." className="text-xs p-2.5 border border-slate-300 rounded outline-none" value={interviewV4.contextoDeportivo?.notaCarga || ""} onChange={e => updateV4({ contextoDeportivo: { ...interviewV4.contextoDeportivo, notaCarga: e.target.value } as any })} disabled={isClosed} />
                                </div>
                            )}
                        </div>
                        {/* LABORAL Y BARRERAS */}
                        <div className="pt-4 border-t border-slate-100 mt-4">
                            <h4 className="text-sm font-bold text-slate-700 mb-3">Trabajo y Barreras</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                {/* Dificulta R */}
                                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col justify-between">
                                    <span className="text-xs font-bold text-slate-700 mb-2 leading-tight">¿Siente que su trabajo actual dificulta su recuperación?</span>
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded">
                                        <button
                                            onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, trabajoDificultaRecuperacion: true } as any }); }}
                                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.trabajoDificultaRecuperacion === true ? 'bg-white shadow text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}>Sí</button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, trabajoDificultaRecuperacion: false } as any }); }}
                                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.trabajoDificultaRecuperacion === false ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>No</button>
                                    </div>
                                </div>

                                {/* Temor Empeorar */}
                                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col justify-between">
                                    <span className="text-xs font-bold text-slate-700 mb-2 leading-tight">¿Siente temor a que el dolor empeore al trabajar?</span>
                                    <div className="flex gap-1 bg-slate-100 p-1 rounded">
                                        <button
                                            onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, temorEmpeorarTrabajo: true } as any }); }}
                                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.temorEmpeorarTrabajo === true ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}>Sí</button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, temorEmpeorarTrabajo: false } as any }); }}
                                            className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.temorEmpeorarTrabajo === false ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>No</button>
                                    </div>
                                </div>

                                {/* Barreras Reales */}
                                <div className="bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col justify-between">
                                    <span className="text-xs font-bold text-slate-700 mb-2 leading-tight">¿Existen barreras reales para asistir/adherir al tratamiento?</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex gap-1 bg-slate-100 p-1 rounded">
                                            <button
                                                onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, barrerasReales: true, barrerasDetalles: interviewV4.contextoLaboral?.barrerasDetalles || [] } as any }); }}
                                                className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.barrerasReales === true ? 'bg-white shadow text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}>Sí</button>
                                            <button
                                                onClick={(e) => { e.preventDefault(); updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, barrerasReales: false, barrerasDetalles: [] } as any }); }}
                                                className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${interviewV4.contextoLaboral?.barrerasReales === false ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>No</button>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Chips Barreras Detalles */}
                            {interviewV4.contextoLaboral?.barrerasReales && (
                                <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-lg">
                                    <span className="text-xs font-bold text-rose-800 mb-2 block">Identifique las barreras principales:</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {['tiempo', 'dinero', 'transporte', 'permisos'].map(b => {
                                            const selected = interviewV4.contextoLaboral?.barrerasDetalles?.includes(b) || false;
                                            return (
                                                <button
                                                    key={b}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        let arr = [...(interviewV4.contextoLaboral?.barrerasDetalles || [])];
                                                        if (selected) arr = arr.filter(x => x !== b);
                                                        else arr.push(b);
                                                        updateV4({ contextoLaboral: { ...interviewV4.contextoLaboral, barrerasDetalles: arr } as any });
                                                    }}
                                                    className={`text-[9px] px-2.5 py-1 rounded-full font-bold transition-colors border ${selected ? 'bg-rose-600 text-white border-rose-700' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-100'}`}
                                                >
                                                    {b.toUpperCase()}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </details >

                {/* --- 13. CIERRE, TRIAGE Y PASE A P2 --- */}
                <details className="group bg-blue-50 border border-blue-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[14] || true}>
                    <summary
                        className="flex flex-col p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(14); }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md">13</span>
                                <h3 className="font-bold text-blue-900 text-sm">Resumen Clínico, Triage e Inteligencia</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                {reqSec13.length === 0 ? (
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 font-bold shadow-sm">✅ Completo</span>
                                ) : (
                                    <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded font-bold shadow-sm">0/1 completo</span>
                                )}
                                <svg className={`w-5 h-5 text-blue-400 transition-transform ${activeAccordions[14] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                        {reqSec13.length > 0 && <div className="text-[10px] text-rose-500 font-medium ml-9 mt-1 italic">Falta: {reqSec13.join(" / ")}</div>}
                    </summary>
                    <div className="px-4 pb-4 px-10 border-t border-blue-100 pt-5 space-y-4 bg-white rounded-b-xl">
                        {!isExpertMode && (
                            <div className="bg-blue-50/50 border-l-2 border-blue-400 p-2 text-[10px] text-slate-600 rounded-r mb-3 mt-1">
                                <p><span className="font-bold text-blue-700">Objetivo:</span> Sintetizar los hallazgos automáticos y confirmar la viabilidad de continuar con la evaluación.</p>
                                <p><span className="font-bold text-blue-700">Ejemplo:</span> "Apto para P2, enfocar en fuerza de cuádriceps derecho".</p>
                            </div>
                        )}

                        {/* --- PANEL AUTO GIGANTE CREADO EN MP9 --- */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl shadow-sm mt-4 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 bg-slate-100 flex flex-col gap-2">
                                <div className="flex items-center gap-2 pb-2">
                                    <span className="text-slate-500 font-bold">🧠</span>
                                    <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Triage e Inteligencia Automática (Paneles Consolidados)</span>
                                </div>
                            </div>
                            <div className="p-4 space-y-4">

                                {/* 1. Seguridad Clínica (Rojas/Naranjas) AUTO */}
                                <div className={`p-3 rounded-lg border ${isRiesgoAlto ? 'bg-rose-50 border-rose-200 text-rose-900' : (interviewV4.seguridad.riesgoEmocionalAgudo ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900')}`}>
                                    <div className="flex items-center gap-2 font-bold mb-1 text-xs">
                                        {isRiesgoAlto ? '🚨 Riesgo Alto (Banderas Rojas)' : (interviewV4.seguridad.riesgoEmocionalAgudo ? '⚠️ Atención (Bandera Naranja)' : '✅ Sin Alertas Graves de Seguridad')}
                                    </div>
                                    {(isRiesgoAlto || interviewV4.seguridad.riesgoEmocionalAgudo) && (
                                        <div className="text-[10px] opacity-80 mt-1">
                                            {interviewV4.seguridad.detalleBanderas ? `Detalle: ${interviewV4.seguridad.detalleBanderas}` : 'Revise sección de Seguridad Clínica para detalles.'}
                                        </div>
                                    )}
                                </div>

                                {/* 2. Irritabilidad AUTO */}
                                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                                    <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold text-white shadow-sm shrink-0 ${focoPrincipal?.irritabilidadAuto?.nivel === 'Alta' ? 'bg-rose-500' :
                                        focoPrincipal?.irritabilidadAuto?.nivel === 'Media' ? 'bg-amber-500' :
                                            focoPrincipal?.irritabilidadAuto?.nivel === 'Baja' ? 'bg-emerald-500' : 'bg-slate-400'
                                        }`}>
                                        Irritabilidad: {focoPrincipal?.irritabilidadAuto?.nivel || 'N/A'}
                                    </div>
                                    <div className="text-[10px] text-slate-600">
                                        <strong>Por qué:</strong> {focoPrincipal?.irritabilidadAuto?.explicacion || 'Faltan datos en Historial.'}
                                        {focoPrincipal?.irritabilidadAuto?.nivel === 'Alta' && <span className="block mt-1 text-rose-600">Evite pruebas máximas provocativas en P2.</span>}
                                    </div>
                                </div>

                                {/* 3. Impacto BPS AUTO */}
                                {interviewV4.bps?.impactoAuto && (
                                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-start gap-3">
                                        <div className={`mt-0.5 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold text-white shadow-sm shrink-0 ${interviewV4.bps.impactoAuto.nivel === 'Alto' ? 'bg-rose-500' :
                                            interviewV4.bps.impactoAuto.nivel === 'Medio' ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}>
                                            BPS: {interviewV4.bps.impactoAuto.nivel}
                                        </div>
                                        <div className="text-[10px] text-slate-600">
                                            <strong>Por qué ({interviewV4.bps.impactoAuto.score}/12):</strong> {interviewV4.bps.impactoAuto.razon}
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* --- PANEL AUTO: AUTOMATIZACIÓN HACIA P2 --- */}
                        <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm mt-4">
                            <div className="p-4 border-b border-purple-200/60 flex flex-col gap-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-purple-200/60">
                                    <span className="text-purple-500 font-bold">⚡</span>
                                    <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">AUTO (no editable)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🤖</span>
                                    <h3 className="font-bold text-purple-900 text-sm">Automatización hacia Examen Físico (P2)</h3>
                                </div>
                            </div>
                            <div className="px-4 pb-4 px-10 pt-3">
                                {sugerenciasP2.length === 0 ? (
                                    <p className="text-xs text-purple-500 italic bg-white p-3 rounded border border-purple-100">No hay sugerencias automáticas aún. Complete el foco principal.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {sugerenciasP2.map(s => (
                                            <div key={s.id} className="flex items-start gap-3 bg-white p-3 rounded border border-purple-100 shadow-sm">
                                                <input type="checkbox" className="mt-1 accent-purple-600" checked={true} readOnly />
                                                <div>
                                                    <div className="font-bold text-slate-700 text-xs">{s.label}</div>
                                                    <div className="text-[10px] text-purple-500 mt-0.5 leading-tight">{s.razon}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* --- PANEL AUTO: TRIAGE --- */}
                        <div className="bg-purple-50 border border-purple-200 rounded-xl shadow-sm mt-4">
                            <div className="p-4 border-b border-purple-200/60 flex flex-col gap-2">
                                <div className="flex items-center gap-2 pb-2 border-b border-purple-200/60">
                                    <span className="text-purple-500 font-bold">⚡</span>
                                    <span className="text-[10px] font-black text-purple-900 uppercase tracking-widest">AUTO (no editable)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">🩺</span>
                                    <h3 className="font-bold text-purple-900 text-sm">Resumen de Decisión Inmediata (Triage)</h3>
                                </div>
                            </div>
                            <div className="p-4 space-y-5 bg-white rounded-b-xl">

                                {/* Summary Badges Panel */}
                                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 md:grid-cols-5 gap-3">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Irritabilidad Global</span>
                                        <span className={`text-xs font-bold ${focoPrincipal?.irritabilidadAuto?.nivel === 'Alta' ? 'text-rose-600' : focoPrincipal?.irritabilidadAuto?.nivel === 'Media' ? 'text-amber-600' : 'text-emerald-600'}`}>{focoPrincipal?.irritabilidadAuto?.nivel || 'No definido'}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">L. Funcional</span>
                                        <span className="text-xs font-bold text-indigo-700">{interviewV4.hayLimitacionFuncional ? "Confirmada" : "No observada"}</span>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Impacto BPS AUTO</span>
                                        {interviewV4.bps?.impactoAuto ? (
                                            <span className={`text-xs font-bold ${interviewV4.bps.impactoAuto.nivel === 'Alto' ? 'text-rose-600' :
                                                interviewV4.bps.impactoAuto.nivel === 'Medio' ? 'text-amber-600' : 'text-emerald-600'
                                                }`} title={interviewV4.bps.impactoAuto.razon}>
                                                {interviewV4.bps.impactoAuto.nivel} ({interviewV4.bps.impactoAuto.score}/12)
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400">Pendiente</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Adherencia AUTO</span>
                                        {interviewV4.contextoLaboral?.riesgoAdherenciaAuto === true ? (
                                            <span className="text-xs font-bold text-rose-600" title="Riesgo de baja adherencia por barreras reales detectadas o confianza muy baja.">Alto Riesgo</span>
                                        ) : (
                                            <span className="text-xs font-bold text-emerald-600">Riesgo Bajo</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">D. Neurológicos</span>
                                        <span className="text-[10px] font-bold text-orange-600">{focoPrincipal && focoPrincipal.disparadoresParaDescartes && focoPrincipal.disparadoresParaDescartes.length > 0 ? (focoPrincipal.disparadoresParaDescartes.length + " Pendientes") : "Ninguno en esta revisión"}</span>
                                    </div>
                                </div>

                                {/* Descartes Pendientes (De MiniFase 10) */}
                                {focoPrincipal?.disparadoresParaDescartes && focoPrincipal.disparadoresParaDescartes.length > 0 && (
                                    <div className="p-3 bg-orange-50/50 border border-orange-200 rounded-lg">
                                        <span className="text-[10px] uppercase font-bold text-orange-800 tracking-wide block mb-1">🚨 Validar en fase 2 por alerta de síntomas neurológicos o irradiados:</span>
                                        <ul className="list-disc pl-5 text-[10px] text-orange-700 space-y-0.5 mt-2">
                                            {focoPrincipal.disparadoresParaDescartes.map((d, i) => (
                                                <li key={i}>{d}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-blue-200">
                                    <span className="text-blue-500 font-bold">✏️</span>
                                    <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-700 mb-1.5 block">¿Es adecuado proceder a exploración física (P2)? <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                        <div className="flex bg-slate-100 rounded border border-slate-200 p-1">
                                            <button disabled={isClosed} onClick={(e) => { e.preventDefault(); updateV4({ decisionEvalFisica: "Sí" }); }} className={`flex-1 text-xs py-2 rounded font-bold transition-all ${interviewV4.decisionEvalFisica === "Sí" ? 'bg-white shadow text-emerald-700 border border-emerald-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                                Sí, avanzar a P2
                                            </button>
                                            <button disabled={isClosed} onClick={(e) => { e.preventDefault(); updateV4({ decisionEvalFisica: "No" }); }} className={`flex-1 text-xs py-2 rounded font-bold transition-all ${interviewV4.decisionEvalFisica === "No" ? 'bg-white shadow text-rose-700 border border-rose-200' : 'text-slate-500 hover:text-slate-700'}`}>
                                                No, derivar/cerrar
                                            </button>
                                        </div>
                                    </div>

                                    {interviewV4.decisionEvalFisica === "No" && (
                                        <div>
                                            <label className="text-xs font-bold text-rose-800 mb-1 block">Razón o tipo de Derivación (Ej. bandera roja grave) <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                            <input type="text" placeholder="No apto para P2 porque..." className="w-full text-xs p-2 border border-rose-300 bg-rose-50 rounded outline-none" value={interviewV4.razonNoEvalFisica || ""} onChange={e => updateV4({ razonNoEvalFisica: e.target.value })} disabled={isClosed} />
                                        </div>
                                    )}

                                    {interviewV4.decisionEvalFisica === "Sí" && (
                                        <div>
                                            <label className="text-xs font-bold text-emerald-800 mb-1 block">Estrategia/Plan sugerido para examen hoy (Refleja Irritabilidad) <span className="text-[9px] text-rose-500 italic font-normal">*obligatorio</span></label>
                                            <input type="text" placeholder="Tacto suave, evitar pruebas máximas provocativas..." className="w-full text-xs p-2.5 border border-emerald-300 rounded outline-none bg-emerald-50/50" value={interviewV4.planEvaluacionFisica || ""} onChange={e => updateV4({ planEvaluacionFisica: e.target.value })} disabled={isClosed} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- PANEL: RESUMEN FINAL --- */}
                        <div className="mt-6 border-t border-blue-100 pt-5 space-y-4">

                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleGenerateResumen();
                                        // Auto-append draft text if generated by AI
                                        if (!interviewV4.cierre?.resumenClinico.includes("[Borrador IA]")) {
                                            updateV4({ cierre: { ...interviewV4.cierre!, resumenClinico: "[Borrador IA]\n" + (interviewV4.cierre?.resumenClinico || "Resumen generado automáticamente en base a los hallazgos clínicos...") } });
                                        }
                                    }}
                                    disabled={isClosed}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded shadow transition-colors flex items-center justify-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Redactar Resumen (IA)
                                </button>
                                <button
                                    disabled={true}
                                    className="bg-purple-100 text-purple-700 text-xs font-bold py-2 px-4 rounded border border-purple-200 opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
                                    title="Próximamente"
                                >
                                    ✨ IA: Sugerir preguntas faltantes
                                </button>
                                <button
                                    disabled={true}
                                    className="bg-purple-100 text-purple-700 text-xs font-bold py-2 px-4 rounded border border-purple-200 opacity-60 cursor-not-allowed flex items-center justify-center gap-2"
                                    title="Próximamente"
                                >
                                    ✨ IA: Sugerir plan físico
                                </button>
                            </div>

                            {/* --- CAJA DE RECOMENDACIONES P2 (MOTOR DE REGLAS FASE 18) --- */}
                            {interviewV4.p2_recommendations && interviewV4.p2_recommendations.length > 0 && (
                                <div className="bg-purple-50/50 border border-purple-200 p-4 rounded-lg mt-4 shadow-sm animate-fadeIn">
                                    <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wide mb-2 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        Recomendaciones Inteligentes para Examen Físico (P2)
                                    </h4>
                                    <ul className="space-y-2">
                                        {interviewV4.p2_recommendations.map((rec, i) => (
                                            <li key={i} className="text-[11px] text-purple-800 font-medium flex items-start gap-2 bg-white p-2 rounded border border-purple-100 shadow-sm">
                                                <span className="flex-shrink-0 mt-0.5">•</span>
                                                <span>{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {interviewV4.cierre && (
                                <div className="space-y-4 mt-4 animate-fadeIn">
                                    <div className="flex items-center gap-2 pb-2 mb-3 border-b border-blue-200">
                                        <span className="text-blue-500 font-bold">✏️</span>
                                        <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Para completar</span>
                                    </div>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                        {/* Columna Izquierda: Redacción */}
                                        <div className="space-y-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-xs font-bold text-slate-700 block">Resumen Clínico (Editable)</label>
                                                    {interviewV4.cierre.resumenClinico.includes("[Borrador IA]") && (
                                                        <span className="text-[9px] bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold uppercase tracking-widest flex items-center gap-1">
                                                            <span>✨</span> Generado por IA
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="relative">
                                                    <textarea
                                                        className={`w-full text-xs p-3 border rounded outline-none leading-relaxed transition-colors ${interviewV4.cierre.resumenClinico.includes("[Borrador IA]") ? 'bg-purple-50/30 border-purple-300 focus:bg-white focus:border-purple-400' : 'bg-slate-50 border-slate-300 focus:bg-white'}`}
                                                        rows={9}
                                                        value={interviewV4.cierre.resumenClinico}
                                                        onChange={(e) => updateV4({ cierre: { ...interviewV4.cierre!, resumenClinico: e.target.value } })}
                                                        disabled={isClosed}
                                                    />
                                                    {interviewV4.cierre.resumenClinico.includes("[Borrador IA]") && (
                                                        <div className="absolute -bottom-6 left-0 flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 shadow-sm z-10">
                                                            <span>⚠️</span> Revisar antes de guardar
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Columna Derecha: Listas AUTO */}
                                        <div className="space-y-4">
                                            <div className="bg-slate-50 p-3 rounded border border-slate-200">
                                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Lo más importante detectado</h4>
                                                <ul className="text-[11px] text-slate-700 space-y-1.5">
                                                    <li><span className="font-semibold text-slate-500">Queja Primordial:</span> {interviewV4.cierre.loMasImportante?.quejaPrioritaria}</li>
                                                    <li><span className="font-semibold text-slate-500">Objetivo Crítico:</span> {interviewV4.cierre.loMasImportante?.objetivoPrioritario}</li>
                                                    <li><span className="font-semibold text-slate-500">Irritabilidad:</span> {interviewV4.cierre.loMasImportante?.irritabilidad}</li>
                                                    <li><span className="font-semibold text-slate-500">Dolor/Mecanismo:</span> {interviewV4.cierre.loMasImportante?.tipoDolorSugerido}</li>
                                                    <li><span className="font-semibold text-slate-500">Banderas:</span> {interviewV4.cierre.loMasImportante?.resumenBanderas}</li>
                                                </ul>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="bg-blue-50/50 p-3 rounded border border-blue-100 flex flex-col justify-start">
                                                    <h4 className="text-[10px] font-bold text-blue-800 uppercase tracking-wide mb-2">Hipótesis Sugeridas</h4>
                                                    <div className="text-[10px] text-blue-900 font-semibold mb-1">Tags Transversales:</div>
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {interviewV4.cierre.hipotesisSugeridas?.tagsTransversales.map(t => <span key={t} className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[9px] font-medium">{t}</span>)}
                                                        {interviewV4.cierre.hipotesisSugeridas?.tagsTransversales.length === 0 && <span className="text-slate-400 italic text-[10px]">Ninguno detectado</span>}
                                                    </div>
                                                    <div className="text-[10px] text-blue-900 font-semibold mb-1">Tags Regionales:</div>
                                                    <div className="flex flex-wrap gap-1">
                                                        {interviewV4.cierre.hipotesisSugeridas?.tagsRegionales.map(t => <span key={t} className="bg-white px-1.5 py-0.5 rounded border border-blue-200 text-[9px] font-medium">{t}</span>)}
                                                        {interviewV4.cierre.hipotesisSugeridas?.tagsRegionales.length === 0 && <span className="text-slate-400 italic text-[10px]">Ninguno detectado</span>}
                                                    </div>
                                                </div>

                                                <div className="bg-orange-50/50 p-3 rounded border border-orange-100">
                                                    <h4 className="text-[10px] font-bold text-orange-800 uppercase tracking-wide mb-2">Falta Descartar</h4>
                                                    {interviewV4.cierre.faltaDescartar && interviewV4.cierre.faltaDescartar.length > 0 ? (
                                                        <ul className="text-[10px] text-orange-900 list-disc pl-4 space-y-1">
                                                            {interviewV4.cierre.faltaDescartar.map((d, i) => <li key={i}>{d}</li>)}
                                                        </ul>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 italic">No hay alertas críticas neurológicas.</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-emerald-50/50 p-3 rounded border border-emerald-100">
                                                <h4 className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide mb-1.5">Menos probable según evaluación</h4>
                                                <ul className="text-[10px] text-emerald-900 list-disc pl-4 space-y-0.5">
                                                    {interviewV4.cierre.menosProbable?.map((m, i) => <li key={i} className="line-through opacity-70 decoration-emerald-800">{m}</li>)}
                                                    {(!interviewV4.cierre.menosProbable || interviewV4.cierre.menosProbable.length === 0) && <li className="list-none ml-[-1rem] text-slate-500 italic">No hay suficientes datos confirmados para descartar graves.</li>}
                                                </ul>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </details>

                {/* --- 18. GUARDADO O PASE DE V4 --- */}
                <div className={`mt-6 border rounded-xl shadow-sm p-6 text-center flex flex-col items-center transition-colors ${isValidForP2 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <h3 className={`font-black mb-3 text-lg ${isValidForP2 ? 'text-emerald-900' : 'text-slate-700'}`}>Cierre de Anamnesis V4</h3>

                    {!isValidForP2 ? (
                        <div className="text-left w-full max-w-lg mb-5 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-xs space-y-2 shadow-sm">
                            <strong className="block mb-1 text-rose-900 uppercase tracking-widest text-[10px] pb-2 border-b border-rose-200/60 flex items-center gap-2">
                                <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                Datos Obligatorios Faltantes
                            </strong>
                            {validationErrors.map((err, i) => (
                                <div key={i} className="flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></span>
                                    <span className="font-bold">{err}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-left w-full max-w-lg mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-lg text-xs flex items-center gap-3 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                <span className="text-emerald-600 text-lg">✅</span>
                            </div>
                            <div>
                                <strong className="block text-emerald-900">Todos los datos críticos completados</strong>
                                <span className="opacity-80">La anamnesis está lista para ser guardada y avanzar a Exámenes Físicos (P2).</span>
                            </div>
                        </div>
                    )}

                    {isRiesgoAlto && (
                        <span className="block mb-5 font-black text-rose-700 bg-rose-100 px-4 py-2 rounded border border-rose-300 shadow-sm">
                            ATENCIÓN: Riesgo Alto detectado en la P1. {interviewV4.seguridad?.overrideUrgenciaMedica ? '' : 'Flujo hacia el Tratamiento y Exámenes bloqueado.'}
                        </span>
                    )}

                    <div className="flex gap-4 w-full flex-col sm:flex-row mt-4">
                        <button
                            onClick={handleCloseAnamnesis}
                            disabled={isClosed || !isValidForP2}
                            className={`flex-1 font-black px-8 py-3.5 rounded-xl transition-all shadow-md text-sm uppercase tracking-wider border w-full ${!isValidForP2
                                ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-70'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 hover:shadow-lg'
                                }`}
                        >
                            {interviewV4.seguridad?.overrideUrgenciaMedica ? '🔒 Override Aplicado' : (isValidForP2 ? (isClosed ? '✓ Finalizada' : 'Confirmar e Ir a Exámenes P2') : 'Revise validaciones para avanzar')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
