import React, { useState, useEffect, useCallback } from 'react';
import { EvaluacionInicial, AnamnesisProximaV4, FocoV4 } from '@/types/clinica';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
            tiempoDesdeInicio: "",
            contextoDetallado: "",
            dolorActual: null,
            mejor24h: null,
            peor24h: null,
            irradiacion: "NoDefinido",
            tags: [],
            agravantes: "",
            aliviantes: "",
            dolorPostActividad: "NoDefinida",
            tiempoCalma: "",
            signoComparable: "",
            dolorEnSigno: null,
            mecanismoCategoria: "NoDefinido",
            mecanismoApellido: [],
            mecanismoTextoFinal: "",
            notaRapida: ""
        }],
        psfsGlobal: [],
        seguridad: {
            fiebre_sistemico_cancerPrevio: false,
            bajaPeso_noIntencionada: false,
            dolorNocturno_inexplicable_noMecanico: false,
            trauma_altaEnergia_caidaImportante: false,
            neuroGraveProgresivo_esfinteres_sillaMontar: false,
            sospechaFractura_incapacidadCarga: false,
            overrideUrgenciaMedica: false,
            justificacionUrgencia: ""
        },
        bps: {
            sueno: 0, estres: 0, miedoMoverCargar: 0, preocupacionDano: 0,
            bajaAutoeficacia: 0, catastrofizacion: 0, presionRetorno: 0, frustracion: 0, otros: ""
        },
        contextoDeportivo: {
            aplica: false, deportePrincipal: "", nivel: "NoDefinido", frecuenciaSemanal: null,
            volumenRecienteCambio: "NoDefinido", eventoProximo: "", gestoProvocador: "", objetivoRetorno: ""
        },
        experienciaPersona: {
            creencia: "", preocupacion: "NoDefinido", expectativa: ""
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

    const [activeFocoId, setActiveFocoId] = useState<string>(interviewV4.focos[0]?.id || "");
    const activeFoco = interviewV4.focos.find(f => f.id === activeFocoId) || interviewV4.focos[0];
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
        if (!activeFoco) return;

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

            const existingTags = new Set(activeFoco.tags);
            finalTagsToAdd.forEach(t => existingTags.add(t));
            updates.tags = Array.from(existingTags);
            modified = true;
        }

        // 3. Nota / Contexto
        if (contextInput.trim() !== "") {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const newLine = `[${timeStr}] ${contextInput.trim()}`;
            updates.notaRapida = activeFoco.notaRapida ? `${activeFoco.notaRapida}\n${newLine}` : newLine;
            modified = true;
        }

        if (modified) {
            const newFocos = interviewV4.focos.map(f => f.id === activeFoco.id ? { ...f, ...updates } : f);
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

    const handleUpdateActiveFoco = (patch: any) => {
        if (!activeFoco) return;
        const newFocos = interviewV4.focos.map(f => f.id === activeFoco.id ? { ...f, ...patch } : f);
        updateV4({ focos: newFocos });
    };

    const handleAddFoco = () => {
        if (interviewV4.focos.length >= 5) return;
        const newId = generateId();
        const newFoco = {
            id: newId,
            esPrincipal: interviewV4.focos.length === 0,
            region: "", lado: "N/A", inicio: "NoDefinido", tiempoDesdeInicio: "", contextoDetallado: "",
            dolorActual: null, mejor24h: null, peor24h: null, irradiacion: "N/A", tags: [],
            agravantes: "", aliviantes: "", dolorPostActividad: "NoDefinida", tiempoCalma: "",
            signoComparable: "", dolorEnSigno: null, notaRapida: "", mecanismoCategoria: "NoDefinido", mecanismoApellido: "", mecanismoTextoFinal: ""
        } as any;
        updateV4({ focos: [...interviewV4.focos, newFoco] });
        setActiveFocoId(newId);
    };

    const handleCloseAnamnesis = () => {
        if (interviewV4.focos.length === 0) return alert("Debe existir al menos 1 foco para aprobar.");
        const f1 = interviewV4.focos[0];
        if (!f1.region || f1.region.trim() === '') return alert("El foco principal debe tener una región definida.");
        if (f1.dolorActual === null) return alert("El foco principal debe tener el Dolor Actual informado.");
        if (interviewV4.seguridad.overrideUrgenciaMedica && !interviewV4.seguridad.justificacionUrgencia) {
            return alert("Debe justificar la urgencia médica si está activada.");
        }
        updateV4({ status: "approved" });
        alert("¡Anamnesis V4 Aprobada! P2 habilitado.");
    };

    // LOGICA DE SEGURIDAD (CHIP)
    const hasRedFlagExtrema = interviewV4.seguridad.overrideUrgenciaMedica ||
        interviewV4.seguridad.neuroGraveProgresivo_esfinteres_sillaMontar ||
        interviewV4.seguridad.sospechaFractura_incapacidadCarga ||
        interviewV4.seguridad.fiebre_sistemico_cancerPrevio;

    const hasAnyRedFlag = interviewV4.seguridad.bajaPeso_noIntencionada ||
        interviewV4.seguridad.dolorNocturno_inexplicable_noMecanico ||
        interviewV4.seguridad.trauma_altaEnergia_caidaImportante ||
        hasRedFlagExtrema;

    let seguridadColor = "Verde";
    let seguridadStyles = "bg-emerald-50 border-emerald-200 text-emerald-800";
    let seguridadDot = "bg-emerald-500";

    if (hasRedFlagExtrema) {
        seguridadColor = "Roja";
        seguridadStyles = "bg-rose-50 border-rose-200 text-rose-800";
        seguridadDot = "bg-rose-500";
    } else if (hasAnyRedFlag) {
        seguridadColor = "Amarilla";
        seguridadStyles = "bg-amber-50 border-amber-200 text-amber-800";
        seguridadDot = "bg-amber-500";
    }

    const isRiesgoAlto = hasRedFlagExtrema;

    // UI RENDER
    return (
        <div className="flex flex-col gap-6 pb-12">
            {/* STICKY HEADER & CAPTURA CONVERSACIONAL */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 pb-3 pt-4 mb-4 -mx-4 px-4 sm:mx-0 sm:px-0 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                            Anamnesis Próxima y Riesgo
                            {isSavingDraft ? (
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-normal border shadow-sm animate-pulse">Guardando...</span>
                            ) : lastSaved ? (
                                <span className="text-[10px] text-emerald-600 font-medium">Auto-guardado {lastSaved}</span>
                            ) : null}
                        </h2>
                        <p className="text-xs text-slate-500">Razonamiento Estructurado V4</p>
                    </div>
                    {/* Select Global Escala Dolor */}
                    <div className="flex items-center gap-2">
                        <select
                            className="bg-indigo-50 border border-indigo-200 text-xs rounded p-1.5 outline-none font-bold text-indigo-800"
                            value={interviewV4.escalaDolorGlobal}
                            onChange={e => updateV4({ escalaDolorGlobal: e.target.value as any })}
                            disabled={isClosed}
                        >
                            <option value="EVA">Global: EVA</option>
                            <option value="ENA">Global: ENA</option>
                        </select>
                    </div>
                </div>

                {/* CHIPS GLOBALES */}
                <div className="flex flex-wrap gap-2">
                    <div className={`flex items-center gap-1.5 border px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${seguridadStyles}`}>
                        <span className={`w-2 h-2 rounded-full ${seguridadDot}`}></span>
                        Seguridad: {seguridadColor}
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                        Irritabilidad: No calculada
                    </div>
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        Mecanismo: {focoPrincipal?.mecanismoTextoFinal || 'No definido'}
                    </div>
                </div>

                {/* BARRA DE CAPTURA RÁPIDA */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 mt-1 flex flex-col gap-2 relative">
                    <div className="absolute -top-2.5 left-3 bg-white border border-slate-200 text-[9px] font-bold text-slate-500 px-1.5 rounded uppercase tracking-wider">
                        Captura Conversacional Rápida
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap items-center gap-2 mt-1">
                        {/* Selector Foco Activo y Botón */}
                        <div className="flex items-center gap-1 shrink-0">
                            <select
                                className="bg-white border border-slate-300 text-xs rounded p-1.5 outline-none font-bold text-slate-700 w-28 truncate"
                                value={activeFoco?.id || ""}
                                onChange={e => setActiveFocoId(e.target.value)}
                                disabled={isClosed}
                            >
                                {interviewV4.focos.map((f, i) => (
                                    <option key={f.id} value={f.id}>{f.esPrincipal ? '⭐ Foco 1' : `Foco ${i + 1}`} {f.region && `- ${f.region}`}</option>
                                ))}
                            </select>
                            <button onClick={handleAddFoco} disabled={isClosed || interviewV4.focos.length >= 5} className="bg-slate-200 text-slate-600 px-2 py-1.5 rounded text-xs font-bold hover:bg-slate-300 disabled:opacity-50" title="Añadir foco (+)">
                                +
                            </button>
                        </div>

                        {/* Input Dolor */}
                        <input
                            type="number"
                            min="0" max="10"
                            placeholder={`Dolor (${interviewV4.escalaDolorGlobal})`}
                            className="w-24 text-xs p-1.5 border border-slate-300 rounded outline-none shrink-0 text-center font-bold"
                            value={painInput}
                            onChange={e => setPainInput(e.target.value)}
                            disabled={isClosed}
                        />

                        {/* Input Chips (Síntomas) */}
                        <div className="flex-1 flex flex-wrap items-center gap-1 bg-white border border-slate-300 rounded p-1 min-w-[150px]">
                            {tagsList.map((t, i) => (
                                <span key={i} className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    {t}
                                    <button onClick={() => setTagsList(tagsList.filter((_, index) => index !== i))} className="hover:text-rose-500 leading-none">×</button>
                                </span>
                            ))}
                            <input
                                type="text"
                                placeholder={tagsList.length === 0 ? "Síntoma/Hecho (Enter)" : "..."}
                                className="flex-1 min-w-[80px] text-xs outline-none bg-transparent p-0.5"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                disabled={isClosed}
                            />
                        </div>

                        {/* Input Contexto */}
                        <input
                            type="text"
                            placeholder="Contexto / Nota al foco..."
                            className="flex-1 md:flex-[1.5] text-xs p-1.5 border border-slate-300 rounded outline-none min-w-[150px]"
                            value={contextInput}
                            onChange={e => setContextInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
                            disabled={isClosed}
                        />

                        {/* Botón Añadir */}
                        <button
                            onClick={handleQuickAdd}
                            disabled={isClosed || (!painInput && !tagInput && tagsList.length === 0 && !contextInput)}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 shrink-0 shadow-sm"
                        >
                            Añadir
                        </button>
                    </div>
                </div>
            </div>

            {/* MAPA DE FOCOS ESTRUCTURADO */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 md:p-5">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-slate-800 text-lg">Mapa de Focos</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setExpandedFociIds([])}
                            disabled={isClosed || expandedFociIds.length === 0}
                            className="text-xs bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 font-bold text-slate-600 disabled:opacity-40"
                        >
                            Colapsar Todos
                        </button>
                        {interviewV4.focos.length < 5 && (
                            <button
                                onClick={() => {
                                    const nid = generateId();
                                    updateV4({ focos: [...interviewV4.focos, { id: nid, esPrincipal: false, region: "", lado: "N/A", inicio: "NoDefinido", tiempoDesdeInicio: "", contextoDetallado: "", dolorActual: null, mejor24h: null, peor24h: null, irradiacion: "N/A", tags: [], agravantes: "", aliviantes: "", dolorPostActividad: "NoDefinida", tiempoCalma: "", signoComparable: "", dolorEnSigno: null, notaRapida: "", mecanismoCategoria: "NoDefinido", mecanismoApellido: "", mecanismoTextoFinal: "" }] });
                                    setExpandedFociIds(prev => [...prev, nid]);
                                    setActiveFocoId(nid);
                                }}
                                disabled={isClosed}
                                className="bg-indigo-600 text-white font-bold px-3 py-1.5 rounded text-xs hover:bg-indigo-700 shadow-sm transition-colors"
                            >
                                + Foco Nuevo
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {interviewV4.focos.map((foco, index) => {
                        const isExpanded = expandedFociIds.includes(foco.id);

                        // Determinar Completitud (básica)
                        let filled = 0; let total = 5;
                        if (foco.region) filled++;
                        if (foco.dolorActual !== null) filled++;
                        if (foco.tags.length > 0) filled++;
                        if (foco.mecanismoTextoFinal) filled++;
                        if (foco.contextoDetallado) filled++;
                        const percent = Math.round((filled / total) * 100);

                        return (
                            <div key={foco.id} className={`border rounded-xl bg-white shadow-sm overflow-hidden transition-all duration-200 ${foco.esPrincipal ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200'}`}>
                                {/* HEADER / VISTA COLAPSADA */}
                                <div
                                    className="p-3 md:p-4 cursor-pointer hover:bg-slate-50 flex flex-col md:flex-row gap-3 md:items-center justify-between"
                                    onClick={() => toggleFocoExpand(foco.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col items-center justify-center bg-slate-100 rounded-lg w-10 h-10 border border-slate-200 shrink-0">
                                            <span className="text-[10px] font-bold text-slate-500">F-{index + 1}</span>
                                            {foco.esPrincipal && <span className="text-amber-500 text-xs mt-0.5">⭐</span>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                {foco.region || "Sin región"}
                                                <span className="text-slate-500 font-normal text-xs">{foco.lado !== 'N/A' ? `(${foco.lado})` : ''}</span>
                                            </div>
                                            <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                <span><strong className={foco.dolorActual !== null ? 'text-indigo-600' : ''}>Dolor: {foco.dolorActual ?? '-'}</strong> (M:{foco.mejor24h ?? '-'} P:{foco.peor24h ?? '-'})</span>
                                                {foco.irradiacion !== 'N/A' && <span className="text-amber-600 font-medium">⚡ {foco.irradiacion}</span>}
                                                <span className="truncate max-w-[200px]" title={foco.mecanismoTextoFinal}>
                                                    {foco.mecanismoTextoFinal || <span className="italic text-slate-400">Mecanismo: No definido</span>}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 md:w-auto w-full justify-between sm:justify-end">
                                        {/* Tags resumen (Max 8) */}
                                        <div className="flex flex-wrap gap-1 max-w-[200px] sm:justify-end">
                                            {foco.tags.slice(0, 8).map(t => <span key={t} className="bg-slate-100 text-slate-600 text-[9px] px-1.5 py-0.5 rounded font-bold border border-slate-200 truncate max-w-[80px]" title={t}>{t}</span>)}
                                            {foco.tags.length > 8 && <span className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1 border rounded">+{foco.tags.length - 8}</span>}
                                        </div>

                                        <div className="flex items-center gap-3 self-end sm:self-auto">
                                            <div className="flex flex-col items-end">
                                                <span className="text-[9px] font-bold text-emerald-600 mb-0.5">{percent}% completado</span>
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${percent}%` }}></div>
                                                </div>
                                            </div>
                                            <div className={`transform transition-transform ${isExpanded ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`}>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* VISTA EXPANDIDA (FORMULARIO) */}
                                {isExpanded && (
                                    <div className="px-4 md:px-5 pb-5 pt-3 border-t border-slate-200 bg-slate-50/50">

                                        {/* Selector Principal y Eliminar */}
                                        <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200/50">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="radio"
                                                    className="w-4 h-4 accent-amber-500"
                                                    checked={foco.esPrincipal}
                                                    onChange={() => {
                                                        const newFocos = interviewV4.focos.map(f => ({ ...f, esPrincipal: f.id === foco.id }));
                                                        updateV4({ focos: newFocos });
                                                    }}
                                                    disabled={isClosed}
                                                />
                                                <span className="text-sm font-bold text-slate-700 group-hover:text-amber-600 transition-colors">Seleccionar como Foco Principal <span className="text-amber-500">★</span></span>
                                            </label>
                                            <button
                                                onClick={() => {
                                                    if (confirm("¿Estás seguro de eliminar este foco por completo?")) {
                                                        const nf = interviewV4.focos.filter(f => f.id !== foco.id);
                                                        if (nf.length > 0 && foco.esPrincipal) nf[0].esPrincipal = true;
                                                        updateV4({ focos: nf });
                                                    }
                                                }}
                                                disabled={isClosed || interviewV4.focos.length <= 1}
                                                className="text-[10px] text-rose-500 hover:text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                                            >
                                                Eliminar Foco
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">

                                            {/* A) HISTORIA Y MECANISMO */}
                                            <div className="space-y-3">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> A) Historia y Mecanismo</h4>

                                                <div className="flex gap-2">
                                                    <input type="text" placeholder="Región (Ej. Hombro)" className="flex-1 text-xs p-2 border border-slate-300 rounded outline-none w-full" value={foco.region} onChange={e => updateFocoDetail(foco.id, { region: e.target.value })} disabled={isClosed} />
                                                    <select className="w-28 text-xs p-2 border border-slate-300 rounded outline-none bg-white shrink-0" value={foco.lado} onChange={e => updateFocoDetail(foco.id, { lado: e.target.value as FocoV4["lado"] })} disabled={isClosed}>
                                                        <option value="N/A">Lado: N/A</option><option value="Izquierdo">Izquierdo</option><option value="Derecho">Derecho</option><option value="Bilateral">Bilateral</option>
                                                    </select>
                                                </div>

                                                <div className="flex gap-2">
                                                    <select className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none bg-white" value={foco.inicio} onChange={e => updateFocoDetail(foco.id, { inicio: e.target.value as FocoV4["inicio"] })} disabled={isClosed}>
                                                        <option value="NoDefinido">Inicio (Tipo)</option><option value="Subito_Trauma">Súbito con Trauma</option><option value="Subito_SinTrauma">Súbito Sin Trauma</option><option value="Gradual">Gradual / Insidioso</option><option value="Recurrente">Recurrente</option>
                                                    </select>
                                                    <input type="text" placeholder="Tiempo desde inicio (ej 3 meses)" className="w-1/2 text-xs p-2 border border-slate-300 rounded outline-none" value={foco.tiempoDesdeInicio} onChange={e => updateFocoDetail(foco.id, { tiempoDesdeInicio: e.target.value })} disabled={isClosed} />
                                                </div>

                                                <textarea className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" rows={3} placeholder="Contexto o mecanismo detallado..." value={foco.contextoDetallado} onChange={e => updateFocoDetail(foco.id, { contextoDetallado: e.target.value })} disabled={isClosed} />

                                                <div className="bg-white border text-xs p-2.5 rounded shadow-sm">
                                                    <div className="font-bold text-slate-600 mb-1.5">Mecanismo de Dolor (Pilar 3)</div>

                                                    {/* Dropdown Categoría */}
                                                    <select className="w-full p-2 border border-slate-200 bg-slate-50 rounded outline-none mb-2 font-bold text-indigo-700" value={foco.mecanismoCategoria} onChange={e => {
                                                        const cat = e.target.value as FocoV4["mecanismoCategoria"];
                                                        // Auto-set the first sub-type if moving from Undefined/Nothing to a valid category. Otherwise clear it until selected.
                                                        const firstTypeOrEmpty = MECANISMOS_SUBTIPOS[cat]?.[0] || "";

                                                        let newTextoFinal = "";
                                                        if (cat === "NoDefinido") newTextoFinal = "No definido";
                                                        else if (cat === "Nociplástico") newTextoFinal = "Aparente nociplástico (sensibilización central probable)";
                                                        else if (cat === "Mixto") newTextoFinal = `Mixto: ${firstTypeOrEmpty}`;
                                                        else newTextoFinal = `Aparente ${cat.toLowerCase()} de origen ${firstTypeOrEmpty}`;

                                                        updateFocoDetail(foco.id, {
                                                            mecanismoCategoria: cat,
                                                            mecanismoApellido: firstTypeOrEmpty,
                                                            mecanismoTextoFinal: newTextoFinal
                                                        });
                                                    }} disabled={isClosed}>
                                                        {MECANISMOS_CATEGORIAS.map(c => <option key={c} value={c}>{c === 'NoDefinido' ? 'Categoría: No Definido' : `Categoría: ${c}`}</option>)}
                                                    </select>

                                                    {/* Dropdown Apellido */}
                                                    {foco.mecanismoCategoria !== "NoDefinido" && (
                                                        <select className="w-full p-2 border border-slate-200 bg-slate-50 rounded outline-none mb-2 font-bold text-slate-700" value={foco.mecanismoApellido} onChange={e => {
                                                            const cat = foco.mecanismoCategoria;
                                                            const apellido = e.target.value;

                                                            let newTextoFinal = "";
                                                            if (cat === "Nociplástico") newTextoFinal = "Aparente nociplástico (sensibilización central probable)";
                                                            else if (cat === "Mixto") newTextoFinal = `Mixto: ${apellido}`;
                                                            else newTextoFinal = `Aparente ${cat.toLowerCase()} de origen ${apellido}`;

                                                            updateFocoDetail(foco.id, {
                                                                mecanismoApellido: apellido,
                                                                mecanismoTextoFinal: newTextoFinal
                                                            });
                                                        }} disabled={isClosed}>
                                                            {MECANISMOS_SUBTIPOS[foco.mecanismoCategoria].map(sub => (
                                                                <option key={sub} value={sub}>{sub}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </div>
                                            </div>

                                            {/* B) PERFIL SINTOMÁTICO */}
                                            <div className="space-y-3">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> B) Perfil Sintomático</h4>

                                                <div className="flex gap-2">
                                                    <div className="flex-1 bg-white border border-slate-300 rounded p-2 flex flex-col items-center justify-center shadow-sm">
                                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">Actual ({interviewV4.escalaDolorGlobal})</span>
                                                        <input type="number" min="0" max="10" placeholder="-" className="w-full text-center text-lg font-black text-indigo-700 outline-none" value={foco.dolorActual ?? ''} onChange={e => updateFocoDetail(foco.id, { dolorActual: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                                    </div>
                                                    <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded p-2 flex flex-col items-center justify-center">
                                                        <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mb-1">Mejor 24h</span>
                                                        <input type="number" min="0" max="10" placeholder="-" className="w-full text-center text-lg font-black bg-transparent text-emerald-800 outline-none" value={foco.mejor24h ?? ''} onChange={e => updateFocoDetail(foco.id, { mejor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                                    </div>
                                                    <div className="flex-1 bg-rose-50 border border-rose-200 rounded p-2 flex flex-col items-center justify-center">
                                                        <span className="text-[9px] font-bold text-rose-700 uppercase tracking-widest mb-1">Peor 24h</span>
                                                        <input type="number" min="0" max="10" placeholder="-" className="w-full text-center text-lg font-black bg-transparent text-rose-800 outline-none" value={foco.peor24h ?? ''} onChange={e => updateFocoDetail(foco.id, { peor24h: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                                    </div>
                                                </div>

                                                <select className="w-full text-xs p-2 border border-slate-300 rounded outline-none bg-white font-bold text-slate-700" value={foco.irradiacion} onChange={e => updateFocoDetail(foco.id, { irradiacion: e.target.value as FocoV4["irradiacion"] })} disabled={isClosed}>
                                                    <option value="N/A">Irradiación / Trayecto: N/A</option><option value="Local">Localizado</option><option value="Referido">Referido</option><option value="Radicular">Radicular</option>
                                                </select>

                                                <div className="bg-white border text-xs border-slate-300 p-2.5 rounded shadow-sm">
                                                    <div className="font-bold text-slate-600 mb-2">Tags Clave (Síntomas / Sensaciones)</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {TAGS_SINTOMAS.map(tag => {
                                                            const isIncluded = foco.tags.includes(tag);
                                                            return (
                                                                <button key={tag} disabled={isClosed}
                                                                    onClick={() => {
                                                                        const curr = foco.tags;
                                                                        updateFocoDetail(foco.id, { tags: isIncluded ? curr.filter(x => x !== tag) : [...curr, tag] });
                                                                    }}
                                                                    className={`text-[10px] px-2 py-1 rounded-full font-bold transition-colors border ${isIncluded ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                                                                    {tag}
                                                                </button>
                                                            )
                                                        })}
                                                        <button
                                                            disabled={isClosed}
                                                            onClick={() => {
                                                                const custom = prompt("Ingresa un síntoma u otro tag (Ej. Cansancio):", "");
                                                                if (custom && custom.trim() && !foco.tags.includes(custom.trim())) {
                                                                    updateFocoDetail(foco.id, { tags: [...foco.tags, custom.trim()] });
                                                                }
                                                            }}
                                                            className="text-[10px] px-2 py-1 rounded-full font-bold bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50"
                                                        >
                                                            + Otro
                                                        </button>
                                                    </div>

                                                    {/* Mostrar Custom Tags */}
                                                    {foco.tags.filter(t => !TAGS_SINTOMAS.includes(t)).length > 0 && (
                                                        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap gap-1.5">
                                                            {foco.tags.filter(t => !TAGS_SINTOMAS.includes(t)).map(ct => (
                                                                <span key={ct} className="bg-indigo-50 text-indigo-800 text-[10px] px-2 py-1 rounded-full font-bold border border-indigo-200 flex items-center gap-1 shadow-sm">
                                                                    {ct} <button onClick={() => updateFocoDetail(foco.id, { tags: foco.tags.filter(x => x !== ct) })} className="hover:text-rose-500 font-bold ml-0.5">×</button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* C) MODIFICADORES E IRRITABILIDAD */}
                                            <div className="space-y-3">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> C) Modificadores e Irritabilidad</h4>

                                                <input type="text" placeholder="Agravantes (+)" className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={foco.agravantes} onChange={e => updateFocoDetail(foco.id, { agravantes: e.target.value })} disabled={isClosed} />
                                                <input type="text" placeholder="Aliviantes (-)" className="w-full text-xs p-2.5 border border-slate-300 rounded outline-none" value={foco.aliviantes} onChange={e => updateFocoDetail(foco.id, { aliviantes: e.target.value })} disabled={isClosed} />

                                                <div className="flex gap-2">
                                                    <select className="flex-1 text-xs p-2.5 border border-slate-300 rounded outline-none bg-white" value={foco.dolorPostActividad} onChange={e => updateFocoDetail(foco.id, { dolorPostActividad: e.target.value as FocoV4["dolorPostActividad"] })} disabled={isClosed}>
                                                        <option value="NoDefinida">Dolor post-actividad?</option><option value="Nunca">Nunca</option><option value="A veces">A veces / Moderado</option><option value="Siempre">Siempre / Intenso</option>
                                                    </select>
                                                    <input type="text" placeholder="Latencia / Cede en (ej. 2 hrs)" className="flex-1 text-xs p-2.5 border border-slate-300 rounded outline-none" value={foco.tiempoCalma} onChange={e => updateFocoDetail(foco.id, { tiempoCalma: e.target.value })} disabled={isClosed} />
                                                </div>
                                            </div>

                                            {/* D) SIGNO COMPARABLE & LOG */}
                                            <div className="space-y-3 flex flex-col">
                                                <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> D) Signo Comparable / Log</h4>

                                                <div className="flex gap-2">
                                                    <input type="text" placeholder="Gesto/Movimiento/Test Clínico limitante" className="flex-1 text-xs p-2.5 border border-slate-300 rounded outline-none" value={foco.signoComparable} onChange={e => updateFocoDetail(foco.id, { signoComparable: e.target.value })} disabled={isClosed} />
                                                    <input type="number" min="0" max="10" placeholder="Dolor" className="w-20 text-xs p-2.5 border border-slate-300 rounded outline-none text-center bg-indigo-50 font-bold" value={foco.dolorEnSigno ?? ''} onChange={e => updateFocoDetail(foco.id, { dolorEnSigno: e.target.value ? Number(e.target.value) : null })} disabled={isClosed} />
                                                </div>

                                                <div className="flex-1 flex flex-col mt-2">
                                                    <div className="font-bold text-slate-500 mb-1 text-[11px] flex justify-between">
                                                        <span>Notas Históricas de Captura</span>
                                                    </div>
                                                    <textarea
                                                        className="w-full h-full min-h-[100px] text-xs p-2.5 border border-slate-200 rounded outline-none bg-amber-50/30 text-slate-700 leading-relaxed"
                                                        placeholder="Aquí se acumulan los contextos añadidos desde la captura conversacional rápida sin borrar nada..."
                                                        value={foco.notaRapida || ""}
                                                        onChange={e => updateFocoDetail(foco.id, { notaRapida: e.target.value })}
                                                        disabled={isClosed}
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECCIÓN Experiencia y Contexto (Combinado en grid) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2 mb-3">Experiencia (Creencias/Expectativas)</h3>
                    <div className="space-y-3">
                        <textarea rows={1} placeholder="Causa percibida (creencia)" className="w-full text-xs p-2 border rounded outline-none" value={interviewV4.experienciaPersona.creencia} onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, creencia: e.target.value } })} disabled={isClosed} />
                        <select className="w-full text-xs p-2 border rounded outline-none font-medium" value={interviewV4.experienciaPersona.preocupacion} onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, preocupacion: e.target.value as any } })} disabled={isClosed}>
                            <option value="NoDefinido">Preocupación Principal...</option>
                            <option value="Daño grave">Daño grave</option>
                            <option value="Perder rendimiento">Perder rendimiento</option>
                            <option value="No poder trabajar">No poder trabajar</option>
                            <option value="Dolor no se irá">Dolor no se irá</option>
                            <option value="Otra">Otra</option>
                        </select>
                        <textarea rows={1} placeholder="Expectativas..." className="w-full text-xs p-2 border rounded outline-none" value={interviewV4.experienciaPersona.expectativa} onChange={e => updateV4({ experienciaPersona: { ...interviewV4.experienciaPersona, expectativa: e.target.value } })} disabled={isClosed} />
                    </div>
                </section>

                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2 mb-3">PSFS Global (1 - 5 Ítems)</h3>
                    {interviewV4.psfsGlobal.map((psfs, idx) => (
                        <div key={psfs.id} className="flex gap-1 mb-2">
                            <input type="text" placeholder="Actividad" className="flex-1 text-xs p-1.5 border rounded outline-none" value={psfs.actividad} onChange={e => {
                                const nf = [...interviewV4.psfsGlobal]; nf[idx].actividad = e.target.value; updateV4({ psfsGlobal: nf });
                            }} disabled={isClosed} />
                            <input type="number" min="0" max="10" placeholder="0-10" className="w-16 text-center text-xs p-1.5 border rounded outline-none bg-indigo-50 font-bold" value={psfs.score ?? ''} onChange={e => {
                                const nf = [...interviewV4.psfsGlobal]; nf[idx].score = e.target.value ? Number(e.target.value) : null; updateV4({ psfsGlobal: nf });
                            }} disabled={isClosed} />
                            <button onClick={() => updateV4({ psfsGlobal: interviewV4.psfsGlobal.filter(x => x.id !== psfs.id) })} disabled={isClosed} className="px-2 border rounded text-rose-500 font-bold hover:bg-rose-50 bg-slate-50">×</button>
                        </div>
                    ))}
                    {interviewV4.psfsGlobal.length < 5 && (
                        <button onClick={() => updateV4({ psfsGlobal: [...interviewV4.psfsGlobal, { id: generateId(), actividad: "", score: null, focoAsociado: "General" }] })} disabled={isClosed} className="text-xs bg-indigo-50 text-indigo-700 font-bold py-1.5 w-full rounded border border-indigo-200 mt-1">
                            + Añadir PSFS
                        </button>
                    )}
                </section>
            </div>

            {/* SECCIÓN Red Flags y BPS Rápido */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <section className="bg-rose-50/30 border text-sm border-rose-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-rose-800 border-b border-rose-100 pb-2 mb-3">Seguridad (Red Flags)</h3>
                    <div className="space-y-2 text-xs">
                        {/* 6 Ítems Exactos */}
                        {[
                            { key: 'fiebre_sistemico_cancerPrevio', label: 'Fiebre / compromiso sistémico / cáncer previo' },
                            { key: 'dolorNocturno_inexplicable_noMecanico', label: 'Dolor nocturno inexplicable (no mecánico)' },
                            { key: 'neuroGraveProgresivo_esfinteres_sillaMontar', label: 'Déficit neuro grave / progresivo (esfínteres / silla de montar)' },
                            { key: 'bajaPeso_noIntencionada', label: 'Baja de peso no intencionada' },
                            { key: 'trauma_altaEnergia_caidaImportante', label: 'Trauma alta energía / caída importante' },
                            { key: 'sospechaFractura_incapacidadCarga', label: 'Sospecha fractura / incapacidad de carga' },
                        ].map(flag => (
                            <label key={flag.key} className="flex items-start gap-2 cursor-pointer">
                                <input type="checkbox" className="mt-0.5 accent-rose-600" checked={(interviewV4.seguridad as any)[flag.key]} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, [flag.key]: e.target.checked } })} disabled={isClosed} />
                                <span className="text-slate-700">{flag.label}</span>
                            </label>
                        ))}
                    </div>

                    {/* OVERRIDE URGENCIA MÉDICA */}
                    <div className="mt-4 pt-3 border-t border-rose-200">
                        <label className="flex items-start gap-2 cursor-pointer mb-2">
                            <input type="checkbox" className="mt-0.5 accent-rose-700 w-4 h-4" checked={interviewV4.seguridad.overrideUrgenciaMedica} onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, overrideUrgenciaMedica: e.target.checked } })} disabled={isClosed} />
                            <span className="text-rose-900 font-bold uppercase tracking-tight text-[11px]">Marcar urgencia médica pura manualmente (bloquea flujo kinésico)</span>
                        </label>
                        {interviewV4.seguridad.overrideUrgenciaMedica && (
                            <textarea
                                rows={2}
                                className="w-full text-xs p-2 border border-rose-300 rounded outline-none bg-rose-50 text-rose-900 placeholder-rose-400 mt-1"
                                placeholder="Justificación de la urgencia..."
                                value={interviewV4.seguridad.justificacionUrgencia || ""}
                                onChange={e => updateV4({ seguridad: { ...interviewV4.seguridad, justificacionUrgencia: e.target.value } })}
                                disabled={isClosed}
                            />
                        )}
                    </div>
                </section>

                <section className="bg-white border text-sm border-slate-200 rounded-xl shadow-sm overflow-hidden p-4">
                    <h3 className="font-bold text-slate-800 border-b pb-2 mb-3">BPS Rápido (0 - 2)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {/* 8 Ítems Exactos */}
                        {[
                            { key: 'sueno', label: 'Alteración sueño' },
                            { key: 'estres', label: 'Alto estrés' },
                            { key: 'miedoMoverCargar', label: 'Miedo al mover/cargar' },
                            { key: 'preocupacionDano', label: 'Preocupación de daño' },
                            { key: 'bajaAutoeficacia', label: 'Baja autoeficacia' },
                            { key: 'catastrofizacion', label: 'Catastrofización' },
                            { key: 'presionRetorno', label: 'Presión por retorno' },
                            { key: 'frustracion', label: 'Alta frustración' }
                        ].map(flag => (
                            <div key={flag.key} className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-bold text-slate-600 truncate" title={flag.label}>{flag.label}</label>
                                <div className="flex gap-1">
                                    {[0, 1, 2].map(val => (
                                        <button key={val} disabled={isClosed}
                                            onClick={() => updateV4({ bps: { ...interviewV4.bps, [flag.key]: val } })}
                                            className={`flex-1 py-1.5 text-[11px] rounded font-black border transition-colors ${(interviewV4.bps as any)[flag.key] === val ? (val === 0 ? 'bg-slate-700 text-white border-slate-700' : val === 1 ? 'bg-amber-500 text-white border-amber-500' : 'bg-rose-600 text-white border-rose-600 shadow-sm') : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'}`}
                                        >
                                            {val}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200">
                        <textarea
                            rows={2}
                            className="w-full text-xs p-2 border border-slate-300 rounded outline-none text-slate-700 placeholder-slate-400"
                            placeholder="Otros factores BPS..."
                            value={interviewV4.bps.otros || ""}
                            onChange={e => updateV4({ bps: { ...interviewV4.bps, otros: e.target.value } })}
                            disabled={isClosed}
                        />
                    </div>
                </section>
            </div>

            {/* SECCIÓN Cierre Estructurado */}
            <section className="bg-emerald-50 border text-sm border-emerald-200 rounded-xl shadow-sm p-5 text-center flex flex-col items-center">
                <h3 className="font-bold text-emerald-900 mb-2 text-lg">Cierre de Anamnesis V4</h3>
                <p className="text-xs text-emerald-700 mb-5 max-w-lg">
                    Revisa que los focos importantes estén capturados.
                    {isRiesgoAlto && <span className="block mt-2 font-bold text-rose-600 bg-rose-100 p-2 rounded border border-rose-200">ATENCIÓN: Riesgo Alto / Urgencia Médica detectada. {interviewV4.seguridad.overrideUrgenciaMedica ? 'Flujo kinésico bloqueado.' : 'Evalúe detenidamente.'}</span>}
                </p>
                <button
                    onClick={handleCloseAnamnesis}
                    disabled={isClosed || interviewV4.seguridad.overrideUrgenciaMedica}
                    className={`font-black px-8 py-3 rounded-xl transition shadow text-sm uppercase tracking-wider border ${interviewV4.seguridad.overrideUrgenciaMedica
                        ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed'
                        }`}
                >
                    {interviewV4.seguridad.overrideUrgenciaMedica ? '🔒 Bloqueado por Urgencia' : '🔒 Aprobar y Avanzar a Examen Físico (P2)'}
                </button>
            </section>
        </div >
    );
}
